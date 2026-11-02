import { useCallback, useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { ROLE_REGISTRY } from '../config/roles';
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
  createRoom,
  createRoomCode,
  createSeats,
  getOccupiedSeats,
  HOST_PEER_ID,
  shuffle,
} from '../utils/game';

export function getHostPeerId(roomId: string) {
  return `best-werewolf-v1-${roomId}`;
}

export function toPublicRoom(room: RoomState): PublicRoomState {
  return {
    ...room,
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

export function usePeerHost(createInfo: CreateInfo) {
  const [room, setRoom] = useState<RoomState>(() => createRoom(createRoomCode(), createInfo.selectedRoleIds, createInfo.playerName));
  const [connectionState, setConnectionState] = useState<'CONNECTING' | 'OPEN' | 'ERROR'>('CONNECTING');
  const [connectionCount, setConnectionCount] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const roomRef = useRef(room);
  const connectionsRef = useRef(new Map<string, DataConnection>());
  const playerNamesRef = useRef(new Map<string, string>([[HOST_PEER_ID, createInfo.playerName]]));
  const messageHandlerRef = useRef<(peerId: string, message: ClientMessage) => void>(() => undefined);

  const notify = useCallback((peerId: string, message: string) => {
    if (peerId === HOST_PEER_ID) setNotice(message);
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
    broadcast({ type: 'SYNC_ROOM_STATE', room: toPublicRoom(nextRoom) });
    if (nextRoom.godPeerId && nextRoom.godPeerId !== HOST_PEER_ID) {
      sendToPeer(nextRoom.godPeerId, { type: 'SYNC_GOD_STATE', room: nextRoom });
    }
  }, [broadcast, sendToPeer]);

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
      return;
    }

    if (message.type === 'CLAIM_GOD') {
      if (current.godPeerId === peerId) return;
      if (current.godPeerId) {
        notify(peerId, `上帝位已由 ${current.godName} 使用。`);
        return;
      }
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

    if (current.godPeerId !== peerId) {
      notify(peerId, '只有坐在上帝位的玩家可以执行这个操作。');
      return;
    }

    if (message.type === 'CHANGE_ROLE_COUNT') {
      if (current.gameStatus === 'DEALT' || current.gameStatus === 'FINISHED') return;
      const { roleId, delta } = message;
      if (!ROLE_REGISTRY[roleId] || (delta !== 1 && delta !== -1)) return;
      const count = current.selectedRoleIds.filter((id) => id === roleId).length;
      const unique = roleId !== 'villager' && roleId !== 'werewolf';
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
      const roles = shuffle(current.selectedRoleIds);
      const dealtRoom: RoomState = {
        ...current,
        gameStatus: 'DEALT',
        seats: current.seats.map((seat, index) => ({ ...seat, roleId: roles[index] })),
      };
      publish(dealtRoom);
      dealtRoom.seats.forEach((seat) => {
        if (seat.peerId && seat.peerId !== HOST_PEER_ID && seat.roleId) {
          sendToPeer(seat.peerId, { type: 'ASSIGN_ROLE', role: ROLE_REGISTRY[seat.roleId] });
        }
      });
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
      updateRoom((state) => ({
        ...state,
        gameStatus: 'SETUP',
        seats: state.seats.map((seat) => ({ ...seat, roleId: null, status: 'ALIVE', tags: [] })),
      }));
      broadcast({ type: 'RESET_GAME' });
    }
  };

  useEffect(() => {
    const peer = new Peer(getHostPeerId(roomRef.current.roomId), { debug: 0 });
    peer.on('open', () => {
      setConnectionState('OPEN');
      setError('');
    });
    peer.on('error', (peerError) => {
      setConnectionState('ERROR');
      setError(peerError.type === 'unavailable-id' ? '房间码冲突，请返回重新创建。' : '无法连接信令服务，请检查网络。');
    });
    peer.on('disconnected', () => {
      setError('信令连接中断，正在恢复；已连接玩家可继续游戏。');
      if (!peer.destroyed) peer.reconnect();
    });
    peer.on('connection', (connection) => {
      const peerId = connection.peer;
      connectionsRef.current.get(peerId)?.close();
      connectionsRef.current.set(peerId, connection);
      connection.on('open', () => {
        setConnectionCount(connectionsRef.current.size);
        sendToPeer(peerId, { type: 'SYNC_ROOM_STATE', room: toPublicRoom(roomRef.current) });
        if (roomRef.current.godPeerId === peerId) {
          sendToPeer(peerId, { type: 'SYNC_GOD_STATE', room: roomRef.current });
        }
        const seat = roomRef.current.seats.find((item) => item.peerId === peerId);
        if (seat?.roleId) sendToPeer(peerId, { type: 'ASSIGN_ROLE', role: ROLE_REGISTRY[seat.roleId] });
      });
      connection.on('data', (data) => messageHandlerRef.current(peerId, data as ClientMessage));
      connection.on('close', () => {
        if (connectionsRef.current.get(peerId) !== connection) return;
        connectionsRef.current.delete(peerId);
        playerNamesRef.current.delete(peerId);
        setConnectionCount(connectionsRef.current.size);
        updateRoom((state) => ({
          ...state,
          godPeerId: state.godPeerId === peerId ? null : state.godPeerId,
          godName: state.godPeerId === peerId ? '' : state.godName,
          seats: state.gameStatus === 'SETUP' || state.gameStatus === 'READY'
            ? state.seats.map((seat) => seat.peerId === peerId ? { ...seat, peerId: null, playerName: '' } : seat)
            : state.seats,
        }));
      });
    });
    return () => {
      peer.destroy();
      connectionsRef.current.clear();
    };
  }, [sendToPeer, updateRoom]);

  const send = useCallback((message: ClientMessage) => {
    setNotice('');
    messageHandlerRef.current(HOST_PEER_ID, message);
  }, []);

  return {
    room,
    publicRoom: toPublicRoom(room),
    connectionState,
    connectionCount,
    error,
    notice,
    setNotice,
    send,
  };
}
