import { useCallback, useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { isCustomRoleId, isUniqueRole, resolveRole, stripRoleImages } from '../config/roles';
import type {
  ClientMessage,
  CreateInfo,
  HostMessage,
  PublicRoomState,
  PublicSeat,
  RoomState,
  SeatState,
} from '../types/protocol';
import {
  assignRolesWithPreferences,
  createRoom,
  createRoomCode,
  createSeats,
  getBlockedPreselectRoles,
  getOccupiedSeats,
  HOST_PEER_ID,
  MAX_CUSTOM_ROLES,
  MAX_PRESELECT_COOLDOWN,
  MIN_PRESELECT_COOLDOWN,
  recordPreselectRound,
} from '../utils/game';
import {
  mapToEntries,
  saveHostSession,
  type HostRestoreData,
} from '../utils/sessionPersist';
import {
  DEBUG_PEER_PREFIX,
  isDebugPeerId,
  nextDebugPlayerIndex,
  type DebugParticipant,
} from '../utils/debugMode';

export function getHostPeerId(roomId: string) {
  return `best-werewolf-v1-${roomId}`;
}

export function toPublicRoom(room: RoomState): PublicRoomState {
  return {
    ...room,
    customRoles: stripRoleImages(room.customRoles),
    seats: room.seats.map((seat) => {
      const publicSeat: Partial<SeatState> = { ...seat };
      delete publicSeat.roleId;
      return publicSeat as PublicSeat;
    }),
  };
}

function withReadyStatus(room: RoomState): RoomState {
  if (room.gameStatus !== 'SETUP' && room.gameStatus !== 'READY') return room;
  const ready =
    room.selectedRoleIds.length === room.totalSeats &&
    getOccupiedSeats(room).length === room.totalSeats;
  return { ...room, gameStatus: ready ? 'READY' : 'SETUP' };
}

export function usePeerHost(createInfo: CreateInfo, restore?: HostRestoreData) {
  const [room, setRoom] = useState<RoomState>(() => restore?.room ?? createRoom(
    createRoomCode(),
    createInfo.selectedRoleIds,
    createInfo.playerName,
    createInfo.customRoles,
  ));
  const [connectionState, setConnectionState] = useState<'CONNECTING' | 'OPEN' | 'ERROR'>('CONNECTING');
  const [connectionCount, setConnectionCount] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(() => (restore ? '已从本页缓存恢复房间，等待玩家重新连接。' : ''));
  const [myPreselectRoleId, setMyPreselectRoleId] = useState<string | null>(
    () => restore?.preferences.find(([peerId]) => peerId === HOST_PEER_ID)?.[1] ?? null,
  );
  const [myBlockedPreselectRoleIds, setMyBlockedPreselectRoleIds] = useState<string[]>([]);
  /** 测试玩家没有连接，预选变化后用它触发房主端重新读取。 */
  const [, setPreferenceRevision] = useState(0);
  const roomRef = useRef(room);
  const connectionsRef = useRef(new Map<string, DataConnection>());
  const playerNamesRef = useRef(new Map<string, string>(
    restore?.playerNames ?? [[HOST_PEER_ID, createInfo.playerName]],
  ));
  /** 预选仅存房主端，不进入公开房间状态。 */
  const preferencesRef = useRef(new Map<string, string>(restore?.preferences ?? []));
  /** 每人近几局的预选记录（含 null），用于冷却；断线重连同 peerId 仍生效。 */
  const preselectHistoryRef = useRef(new Map<string, Array<string | null>>(restore?.preselectHistory ?? []));
  const messageHandlerRef = useRef<(peerId: string, message: ClientMessage) => void>(() => undefined);
  const persistTimerRef = useRef<number | null>(null);

  const persistHostState = useCallback((immediate = false) => {
    const write = () => {
      saveHostSession({
        playerName: playerNamesRef.current.get(HOST_PEER_ID) ?? createInfo.playerName,
        room: roomRef.current,
        preferences: mapToEntries(preferencesRef.current),
        preselectHistory: mapToEntries(preselectHistoryRef.current),
        playerNames: mapToEntries(playerNamesRef.current),
      });
    };
    if (immediate) {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      write();
      return;
    }
    if (persistTimerRef.current !== null) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      write();
    }, 250);
  }, [createInfo.playerName]);

  const notify = useCallback((peerId: string, message: string) => {
    if (peerId === HOST_PEER_ID || isDebugPeerId(peerId)) setNotice(message);
    else {
      const connection = connectionsRef.current.get(peerId);
      if (connection?.open) connection.send({ type: 'NOTICE', message } satisfies HostMessage);
    }
  }, []);

  const sendToPeer = useCallback((peerId: string, message: HostMessage) => {
    const connection = connectionsRef.current.get(peerId);
    if (connection?.open) connection.send(message);
  }, []);

  const broadcast = useCallback((message: HostMessage) => {
    connectionsRef.current.forEach((connection) => {
      if (connection.open) connection.send(message);
    });
  }, []);

  const publish = useCallback((nextRoom: RoomState) => {
    roomRef.current = nextRoom;
    setRoom(nextRoom);
    persistHostState();
    broadcast({ type: 'SYNC_ROOM_STATE', room: toPublicRoom(nextRoom) });
    if (nextRoom.godPeerId && nextRoom.godPeerId !== HOST_PEER_ID) {
      sendToPeer(nextRoom.godPeerId, { type: 'SYNC_GOD_STATE', room: nextRoom });
    }
  }, [broadcast, persistHostState, sendToPeer]);

  const fillWaitingPlayers = useCallback((state: RoomState): RoomState => {
    if (state.gameStatus !== 'SETUP' && state.gameStatus !== 'READY') return state;
    const seats = state.seats.map((seat) => ({ ...seat }));
    let changed = false;
    seats.forEach((seat) => {
      if (seat.peerId !== null) return;
      const waiting = Array.from(playerNamesRef.current.entries()).find(([id]) =>
        id !== state.godPeerId && !seats.some((item) => item.peerId === id),
      );
      if (!waiting) return;
      seat.peerId = waiting[0];
      seat.playerName = waiting[1];
      changed = true;
    });
    return changed ? { ...state, seats } : state;
  }, []);

  const updateRoom = useCallback((updater: (current: RoomState) => RoomState) => {
    const nextRoom = fillWaitingPlayers(updater(roomRef.current));
    publish(withReadyStatus(nextRoom));
  }, [fillWaitingPlayers, publish]);

  const addDebugPlayers = useCallback((requestedCount = 1) => {
    const current = roomRef.current;
    if (current.gameStatus !== 'SETUP' && current.gameStatus !== 'READY') {
      setNotice('发牌后不能继续添加测试玩家，请先重开本局。');
      return;
    }

    const availableSeats = current.seats.filter((seat) => seat.peerId === null).length;
    const count = Math.min(Math.max(1, Math.floor(requestedCount)), availableSeats);
    if (count === 0) {
      setNotice('当前没有空座，无法添加测试玩家。');
      return;
    }

    const startIndex = nextDebugPlayerIndex(playerNamesRef.current.keys());
    for (let offset = 0; offset < count; offset += 1) {
      const index = startIndex + offset;
      playerNamesRef.current.set(`${DEBUG_PEER_PREFIX}${index}`, `测试玩家${index}`);
    }
    updateRoom((state) => state);
    setNotice(`已加入 ${count} 名测试玩家。`);
  }, [updateRoom]);

  const clearDebugPlayers = useCallback((force = false) => {
    const current = roomRef.current;
    const activeGame = current.gameStatus === 'DEALT' || current.gameStatus === 'FINISHED';
    if (activeGame && !force) {
      setNotice('发牌后不能单独移除测试玩家，请先重开本局。');
      return;
    }

    const debugPeerIds = new Set<string>();
    playerNamesRef.current.forEach((_, peerId) => {
      if (isDebugPeerId(peerId)) debugPeerIds.add(peerId);
    });
    current.seats.forEach((seat) => {
      if (isDebugPeerId(seat.peerId)) debugPeerIds.add(seat.peerId);
    });
    if (isDebugPeerId(current.godPeerId)) debugPeerIds.add(current.godPeerId);
    if (debugPeerIds.size === 0) return;

    debugPeerIds.forEach((peerId) => {
      playerNamesRef.current.delete(peerId);
      preferencesRef.current.delete(peerId);
      preselectHistoryRef.current.delete(peerId);
    });
    updateRoom((state) => ({
      ...state,
      gameStatus: activeGame ? 'SETUP' : state.gameStatus,
      godPeerId: isDebugPeerId(state.godPeerId) ? null : state.godPeerId,
      godName: isDebugPeerId(state.godPeerId) ? '' : state.godName,
      seats: state.seats.map((seat) => {
        if (isDebugPeerId(seat.peerId)) {
          return { ...seat, peerId: null, playerName: '', roleId: null, status: 'ALIVE', tags: [] };
        }
        if (!activeGame) return seat;
        return { ...seat, roleId: null, status: 'ALIVE', tags: [] };
      }),
    }));
    setNotice(activeGame ? '已清理测试玩家并重置本局。' : '已清理测试玩家。');
  }, [updateRoom]);

  const getBlockedForPeer = useCallback((peerId: string, cooldownRounds = roomRef.current.preselectCooldownRounds) => (
    getBlockedPreselectRoles(preselectHistoryRef.current.get(peerId), cooldownRounds)
  ), []);

  const syncPreselect = useCallback((peerId: string, roleId: string | null) => {
    const blockedRoleIds = getBlockedForPeer(peerId);
    if (peerId === HOST_PEER_ID) {
      setMyPreselectRoleId(roleId);
      setMyBlockedPreselectRoleIds(blockedRoleIds);
    } else {
      sendToPeer(peerId, { type: 'SYNC_MY_PRESELECT', roleId, blockedRoleIds });
    }
    setPreferenceRevision((revision) => revision + 1);
    persistHostState();
  }, [getBlockedForPeer, persistHostState, sendToPeer]);

  const clearPreference = useCallback((peerId: string) => {
    if (!preferencesRef.current.has(peerId)) {
      syncPreselect(peerId, null);
      return;
    }
    preferencesRef.current.delete(peerId);
    syncPreselect(peerId, null);
  }, [syncPreselect]);

  const clearAllPreferences = useCallback(() => {
    const peerIds = new Set([
      ...preferencesRef.current.keys(),
      ...preselectHistoryRef.current.keys(),
      HOST_PEER_ID,
    ]);
    preferencesRef.current.clear();
    peerIds.forEach((peerId) => syncPreselect(peerId, null));
    setMyPreselectRoleId(null);
  }, [syncPreselect]);

  const scrubInvalidPreferences = useCallback((selectedRoleIds: string[]) => {
    const available = new Set(selectedRoleIds);
    Array.from(preferencesRef.current.entries()).forEach(([peerId, roleId]) => {
      if (!available.has(roleId)) clearPreference(peerId);
    });
  }, [clearPreference]);

  const scrubBlockedPreferences = useCallback((cooldownRounds: number) => {
    Array.from(preferencesRef.current.entries()).forEach(([peerId, roleId]) => {
      if (getBlockedPreselectRoles(preselectHistoryRef.current.get(peerId), cooldownRounds).includes(roleId)) {
        clearPreference(peerId);
      } else {
        syncPreselect(peerId, roleId);
      }
    });
    // 刷新无当前预选者的冷却展示
    Array.from(preselectHistoryRef.current.keys()).forEach((peerId) => {
      if (!preferencesRef.current.has(peerId)) syncPreselect(peerId, null);
    });
  }, [clearPreference, syncPreselect]);

  messageHandlerRef.current = (peerId, message) => {
    const current = roomRef.current;
    const playerName = playerNamesRef.current.get(peerId) ?? '玩家';

    if (message.type === 'JOIN') {
      const nextName = message.playerName.trim().slice(0, 12);
      if (!nextName) {
        notify(peerId, '请输入有效的昵称。');
        return;
      }
      playerNamesRef.current.set(peerId, nextName);
      updateRoom((state) => ({
        ...state,
        godName: state.godPeerId === peerId ? nextName : state.godName,
        seats: state.seats.map((seat) => seat.peerId === peerId ? { ...seat, playerName: nextName } : seat),
      }));
      syncPreselect(peerId, preferencesRef.current.get(peerId) ?? null);
      return;
    }

    if (message.type === 'CLAIM_GOD') {
      if (current.godPeerId === peerId) return;
      if (current.godPeerId) {
        notify(peerId, `上帝位已由 ${current.godName} 使用。`);
        return;
      }
      clearPreference(peerId);
      updateRoom((state) => ({
        ...state,
        godPeerId: peerId,
        godName: playerName,
        seats: state.seats.map((seat) =>
          seat.peerId === peerId ? { ...seat, peerId: null, playerName: '' } : seat,
        ),
      }));
      return;
    }

    if (message.type === 'LEAVE_GOD') {
      if (current.godPeerId !== peerId) return;
      updateRoom((state) => ({ ...state, godPeerId: null, godName: '' }));
      return;
    }

    if (message.type === 'SELECT_SEAT') {
      if (current.godPeerId === peerId) {
        notify(peerId, '你正在上帝位，离开上帝位后才能参赛。');
        return;
      }
      if (current.gameStatus === 'DEALT' || current.gameStatus === 'FINISHED') {
        notify(peerId, '本局已经发牌，暂时不能换座。');
        return;
      }
      const target = current.seats.find((seat) => seat.seatNumber === message.targetSeat);
      if (!target || (target.peerId !== null && target.peerId !== peerId)) {
        notify(peerId, '这个座位刚被选走，请选择其他空位。');
        return;
      }
      updateRoom((state) => ({
        ...state,
        seats: state.seats.map((seat) => {
          if (seat.seatNumber === message.targetSeat) return { ...seat, peerId, playerName };
          if (seat.peerId === peerId) return { ...seat, peerId: null, playerName: '' };
          return seat;
        }),
      }));
      return;
    }

    if (message.type === 'PRESELECT_ROLE') {
      if (!current.preselectEnabled) {
        notify(peerId, '本局未开启身份预选。');
        return;
      }
      if (current.godPeerId === peerId) {
        notify(peerId, '上帝位不能预选身份。');
        return;
      }
      if (current.gameStatus === 'DEALT' || current.gameStatus === 'FINISHED') {
        notify(peerId, '本局已发牌，无法修改预选。');
        return;
      }
      if (!current.seats.some((seat) => seat.peerId === peerId)) {
        notify(peerId, '入座后才能预选身份。');
        return;
      }
      const roleId = message.roleId;
      if (roleId === null) {
        clearPreference(peerId);
        return;
      }
      if (!current.selectedRoleIds.includes(roleId) || !resolveRole(roleId, current.customRoles)) {
        notify(peerId, '该身份不在本局配置中。');
        return;
      }
      if (getBlockedForPeer(peerId).includes(roleId)) {
        notify(peerId, `近 ${current.preselectCooldownRounds} 局内已预选过该身份，请换一个。`);
        return;
      }
      preferencesRef.current.set(peerId, roleId);
      syncPreselect(peerId, roleId);
      return;
    }

    if (current.godPeerId !== peerId) {
      notify(peerId, '只有坐在上帝位的玩家可以执行这个操作。');
      return;
    }

    if (message.type === 'SET_PRESELECT_ENABLED') {
      const enabled = Boolean(message.enabled);
      if (enabled === current.preselectEnabled) return;
      if (!enabled) clearAllPreferences();
      updateRoom((state) => ({ ...state, preselectEnabled: enabled }));
      return;
    }

    if (message.type === 'SET_PRESELECT_COOLDOWN') {
      const rounds = Math.round(message.rounds);
      if (!Number.isFinite(rounds) || rounds < MIN_PRESELECT_COOLDOWN || rounds > MAX_PRESELECT_COOLDOWN) {
        notify(peerId, `冷却局数需在 ${MIN_PRESELECT_COOLDOWN}–${MAX_PRESELECT_COOLDOWN} 之间。`);
        return;
      }
      if (rounds === current.preselectCooldownRounds) return;
      updateRoom((state) => ({ ...state, preselectCooldownRounds: rounds }));
      scrubBlockedPreferences(rounds);
      return;
    }

    if (message.type === 'CHANGE_ROLE_COUNT') {
      if (current.gameStatus === 'DEALT' || current.gameStatus === 'FINISHED') return;
      const { roleId, delta } = message;
      if (!resolveRole(roleId, current.customRoles) || (delta !== 1 && delta !== -1)) return;
      const count = current.selectedRoleIds.filter((id) => id === roleId).length;
      const unique = isUniqueRole(roleId);
      if (delta > 0 && unique && count >= 1) return;
      if (delta < 0 && count <= (roleId === 'werewolf' ? 1 : 0)) return;
      const nextTotal = current.totalSeats + delta;
      if (nextTotal < 4 || nextTotal > 12) {
        notify(peerId, '当前支持 4–12 人游戏。');
        return;
      }
      if (delta < 0 && current.seats[current.totalSeats - 1]?.peerId !== null) {
        notify(peerId, '请先让末位玩家离座，再减少人数。');
        return;
      }
      const selectedRoleIds = [...current.selectedRoleIds];
      if (delta > 0) selectedRoleIds.push(roleId);
      else selectedRoleIds.splice(selectedRoleIds.lastIndexOf(roleId), 1);
      updateRoom((state) => ({
        ...state,
        totalSeats: nextTotal,
        selectedRoleIds,
        seats: createSeats(nextTotal, state.seats),
      }));
      scrubInvalidPreferences(selectedRoleIds);
      return;
    }

    if (message.type === 'ADD_CUSTOM_ROLE') {
      if (current.gameStatus === 'DEALT' || current.gameStatus === 'FINISHED') return;
      const role = message.role;
      if (!isCustomRoleId(role.id) || !role.name.trim()) return;
      if (current.customRoles.length >= MAX_CUSTOM_ROLES) {
        notify(peerId, `最多添加 ${MAX_CUSTOM_ROLES} 个自定义身份。`);
        return;
      }
      if (current.customRoles.some((item) => item.id === role.id)) return;
      if (current.totalSeats >= 12) {
        notify(peerId, '当前支持 4–12 人游戏。');
        return;
      }
      updateRoom((state) => {
        const selectedRoleIds = [...state.selectedRoleIds, role.id];
        const totalSeats = selectedRoleIds.length;
        return {
          ...state,
          customRoles: [...state.customRoles, {
            ...role,
            name: role.name.trim().slice(0, 8),
            description: role.description || '自定义身份，技能由线下协商。',
            visual: { ...role.visual },
          }],
          selectedRoleIds,
          totalSeats,
          seats: createSeats(totalSeats, state.seats),
        };
      });
      return;
    }

    if (message.type === 'REMOVE_CUSTOM_ROLE') {
      if (current.gameStatus === 'DEALT' || current.gameStatus === 'FINISHED') return;
      const { roleId } = message;
      if (!isCustomRoleId(roleId) || !current.customRoles.some((role) => role.id === roleId)) return;
      const removedCount = current.selectedRoleIds.filter((id) => id === roleId).length;
      const nextTotal = current.totalSeats - removedCount;
      if (nextTotal < 4) {
        notify(peerId, '删除后人数不能少于 4 人，请先调整其他身份。');
        return;
      }
      if (removedCount > 0) {
        for (let index = 0; index < removedCount; index += 1) {
          const seat = current.seats[current.totalSeats - 1 - index];
          if (seat?.peerId !== null) {
            notify(peerId, '请先让末位玩家离座，再删除该身份。');
            return;
          }
        }
      }
      const nextSelected = current.selectedRoleIds.filter((id) => id !== roleId);
      updateRoom((state) => {
        const selectedRoleIds = state.selectedRoleIds.filter((id) => id !== roleId);
        const totalSeats = selectedRoleIds.length;
        return {
          ...state,
          customRoles: state.customRoles.filter((role) => role.id !== roleId),
          selectedRoleIds,
          totalSeats,
          seats: createSeats(totalSeats, state.seats),
        };
      });
      scrubInvalidPreferences(nextSelected);
      return;
    }

    if (message.type === 'SWAP_SEATS') {
      if (current.gameStatus === 'DEALT' || current.gameStatus === 'FINISHED' || message.seatA === message.seatB) return;
      updateRoom((state) => ({
        ...state,
        seats: state.seats.map((seat) => {
          const sourceNumber = seat.seatNumber === message.seatA ? message.seatB : seat.seatNumber === message.seatB ? message.seatA : null;
          if (sourceNumber === null) return seat;
          const source = state.seats.find((item) => item.seatNumber === sourceNumber);
          if (!source) return seat;
          return { ...seat, peerId: source.peerId, playerName: source.playerName };
        }),
      }));
      return;
    }

    if (message.type === 'DEAL_CARDS') {
      if (current.gameStatus === 'DEALT') return;
      if (getOccupiedSeats(current).length !== current.totalSeats) {
        notify(peerId, '所有玩家入座后才能发牌。');
        return;
      }
      const activePreferences = current.preselectEnabled
        ? preferencesRef.current
        : new Map<string, string>();
      const occupiedPeerIds = getOccupiedSeats(current).map((seat) => seat.peerId!);
      recordPreselectRound(preselectHistoryRef.current, occupiedPeerIds, activePreferences);
      const dealtSeats = assignRolesWithPreferences(
        current.selectedRoleIds,
        current.seats,
        activePreferences,
      );
      const dealtRoom: RoomState = {
        ...current,
        gameStatus: 'DEALT',
        seats: dealtSeats,
      };
      publish(dealtRoom);
      dealtRoom.seats.forEach((seat) => {
        if (seat.peerId && seat.peerId !== HOST_PEER_ID && seat.roleId) {
          const role = resolveRole(seat.roleId, dealtRoom.customRoles);
          if (role) sendToPeer(seat.peerId, { type: 'ASSIGN_ROLE', role });
        }
      });
      // 本局预选已写入历史，清空当前预选并下发新的冷却封锁列表
      preferencesRef.current.clear();
      occupiedPeerIds.forEach((id) => syncPreselect(id, null));
      return;
    }

    if (message.type === 'SET_PLAYER_STATUS') {
      if (current.gameStatus !== 'DEALT' && current.gameStatus !== 'FINISHED') return;
      updateRoom((state) => ({
        ...state,
        seats: state.seats.map((seat) => seat.seatNumber === message.seatNumber ? { ...seat, status: message.status } : seat),
      }));
      return;
    }

    if (message.type === 'TOGGLE_TAG') {
      if (current.gameStatus !== 'DEALT' && current.gameStatus !== 'FINISHED') return;
      updateRoom((state) => ({
        ...state,
        seats: state.seats.map((seat) => {
          if (seat.seatNumber !== message.seatNumber) return seat;
          const tags = seat.tags.includes(message.tag)
            ? seat.tags.filter((tag) => tag !== message.tag)
            : [...seat.tags, message.tag];
          return { ...seat, tags };
        }),
      }));
      return;
    }

    if (message.type === 'RESET_GAME') {
      clearAllPreferences();
      updateRoom((state) => ({
        ...state,
        gameStatus: 'SETUP',
        seats: state.seats.map((seat) => ({ ...seat, roleId: null, status: 'ALIVE', tags: [] })),
      }));
      broadcast({ type: 'RESET_GAME' });
    }
  };

  useEffect(() => {
    // 恢复后同步房主自己的预选冷却展示；并立刻落盘一份快照。
    const hostPref = preferencesRef.current.get(HOST_PEER_ID) ?? null;
    setMyBlockedPreselectRoleIds(getBlockedForPeer(HOST_PEER_ID));
    setMyPreselectRoleId(hostPref);
    persistHostState(true);

    const flush = () => persistHostState(true);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [getBlockedForPeer, persistHostState]);

  useEffect(() => {
    const peer = new Peer(getHostPeerId(roomRef.current.roomId), { debug: 0 });
    peer.on('open', () => {
      setConnectionState('OPEN');
      setError('');
    });
    peer.on('error', (peerError) => {
      if (peerError.type === 'unavailable-id') {
        setConnectionState('ERROR');
        setError('房间码冲突，请返回重新创建。');
        return;
      }
      // 信令闪断很常见，已建连的玩家通常不受影响；不要反复弹 error toast
      if (peerError.type === 'network' || peerError.type === 'server-error' || peerError.type === 'socket-error' || peerError.type === 'socket-closed') {
        if (!peer.destroyed && !peer.open) peer.reconnect();
        return;
      }
      if (!peer.open) {
        setConnectionState('ERROR');
        setError('无法连接信令服务，请检查网络。');
      }
    });
    peer.on('disconnected', () => {
      // 仅与 PeerServer 的 WebSocket 断开，数据通道往往仍可用；静默重连即可
      if (!peer.destroyed) peer.reconnect();
    });
    peer.on('connection', (connection) => {
      const peerId = connection.peer;
      const previous = connectionsRef.current.get(peerId);
      connectionsRef.current.set(peerId, connection);
      if (previous && previous !== connection) {
        try {
          previous.close();
        } catch {
          // ignore
        }
      }

      const syncOnOpen = () => {
        if (connectionsRef.current.get(peerId) !== connection) return;
        setConnectionCount(connectionsRef.current.size);
        sendToPeer(peerId, { type: 'SYNC_ROOM_STATE', room: toPublicRoom(roomRef.current) });
        if (roomRef.current.godPeerId === peerId) {
          sendToPeer(peerId, { type: 'SYNC_GOD_STATE', room: roomRef.current });
        }
        const seat = roomRef.current.seats.find((item) => item.peerId === peerId);
        if (seat?.roleId) {
          const role = resolveRole(seat.roleId, roomRef.current.customRoles);
          if (role) sendToPeer(peerId, { type: 'ASSIGN_ROLE', role });
        }
        syncPreselect(peerId, preferencesRef.current.get(peerId) ?? null);
      };

      connection.on('open', syncOnOpen);
      if (connection.open) syncOnOpen();
      connection.on('data', (data) => messageHandlerRef.current(peerId, data as ClientMessage));
      connection.on('close', () => {
        if (connectionsRef.current.get(peerId) !== connection) return;
        connectionsRef.current.delete(peerId);
        setConnectionCount(connectionsRef.current.size);
        // 游戏中保留座位与昵称，便于断线重连；仅准备阶段清座。
        const inLobby = roomRef.current.gameStatus === 'SETUP' || roomRef.current.gameStatus === 'READY';
        if (inLobby) {
          playerNamesRef.current.delete(peerId);
          preferencesRef.current.delete(peerId);
        }
        updateRoom((state) => ({
          ...state,
          godPeerId: state.godPeerId === peerId ? null : state.godPeerId,
          godName: state.godPeerId === peerId ? '' : state.godName,
          seats: inLobby
            ? state.seats.map((seat) => seat.peerId === peerId ? { ...seat, peerId: null, playerName: '' } : seat)
            : state.seats,
        }));
      });
    });
    return () => {
      peer.destroy();
      connectionsRef.current.clear();
    };
  }, [sendToPeer, syncPreselect, updateRoom]);

  const sendAs = useCallback((peerId: string, message: ClientMessage) => {
    setNotice('');
    messageHandlerRef.current(peerId, message);
  }, []);

  const send = useCallback((message: ClientMessage) => {
    sendAs(HOST_PEER_ID, message);
  }, [sendAs]);

  const debugPlayers: DebugParticipant[] = Array.from(playerNamesRef.current.entries())
    .filter(([peerId]) => isDebugPeerId(peerId))
    .map(([peerId, playerName]) => {
      const seat = room.seats.find((item) => item.peerId === peerId);
      return {
        peerId,
        playerName,
        seatNumber: seat?.seatNumber ?? null,
        roleId: seat?.roleId ?? null,
        isGod: room.godPeerId === peerId,
      };
    })
    .sort((left, right) => (left.seatNumber ?? 99) - (right.seatNumber ?? 99));

  const getPreselectFor = (peerId: string) => ({
    roleId: preferencesRef.current.get(peerId) ?? null,
    blockedRoleIds: getBlockedForPeer(peerId),
  });

  return {
    room,
    publicRoom: toPublicRoom(room),
    myPreselectRoleId,
    myBlockedPreselectRoleIds,
    connectionState,
    connectionCount,
    error,
    notice,
    setNotice,
    send,
    sendAs,
    debugPlayers,
    getPreselectFor,
    addDebugPlayers,
    clearDebugPlayers,
  };
}
