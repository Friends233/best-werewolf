import { useCallback, useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { ROLE_REGISTRY } from '../config/roles';
import type {
  ClientMessage,
  HostMessage,
  HostMode,
  PlayerStatus,
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

function toPublicRoom(room: RoomState): PublicRoomState {
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

export function usePeerHost() {
  const [room, setRoom] = useState<RoomState>(() => createRoom(createRoomCode()));
  const [connectionState, setConnectionState] = useState<'CONNECTING' | 'OPEN' | 'ERROR'>('CONNECTING');
  const [connectionCount, setConnectionCount] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const roomRef = useRef(room);
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef(new Map<string, DataConnection>());
  const playerNamesRef = useRef(new Map<string, string>());
  const messageHandlerRef = useRef<(peerId: string, message: ClientMessage) => void>(() => undefined);

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
  }, [broadcast]);

  const updateRoom = useCallback((updater: (current: RoomState) => RoomState) => {
    publish(withReadyStatus(updater(roomRef.current)));
  }, [publish]);

  messageHandlerRef.current = (peerId, message) => {
    const current = roomRef.current;

    if (message.type === 'JOIN') {
      const playerName = message.playerName.trim().slice(0, 12);
      if (!playerName) {
        sendToPeer(peerId, { type: 'NOTICE', message: '请输入有效的昵称。' });
        return;
      }
      playerNamesRef.current.set(peerId, playerName);
      updateRoom((roomState) => ({
        ...roomState,
        seats: roomState.seats.map((seat) =>
          seat.peerId === peerId ? { ...seat, playerName } : seat,
        ),
      }));
      return;
    }

    if (message.type === 'SELECT_SEAT') {
      if (current.gameStatus === 'DEALT' || current.gameStatus === 'FINISHED') {
        sendToPeer(peerId, { type: 'NOTICE', message: '本局已经发牌，暂时不能换座。' });
        return;
      }
      const target = current.seats.find((seat) => seat.seatNumber === message.targetSeat);
      if (!target || (target.peerId !== null && target.peerId !== peerId)) {
        sendToPeer(peerId, { type: 'NOTICE', message: '这个座位刚被选走，请选择其他空位。' });
        return;
      }
      const playerName = playerNamesRef.current.get(peerId) ?? `玩家 ${peerId.slice(0, 4)}`;
      updateRoom((roomState) => ({
        ...roomState,
        seats: roomState.seats.map((seat) => {
          if (seat.seatNumber === message.targetSeat) {
            return { ...seat, peerId, playerName, isHost: false };
          }
          if (seat.peerId === peerId) {
            return { ...seat, peerId: null, playerName: '', isHost: false };
          }
          return seat;
        }),
      }));
      return;
    }

    if (message.type === 'LEAVE_SEAT') {
      if (current.gameStatus === 'DEALT' || current.gameStatus === 'FINISHED') return;
      updateRoom((roomState) => ({
        ...roomState,
        seats: roomState.seats.map((seat) =>
          seat.peerId === peerId ? { ...seat, peerId: null, playerName: '' } : seat,
        ),
      }));
    }
  };

  useEffect(() => {
    const peer = new Peer(getHostPeerId(roomRef.current.roomId), { debug: 0 });
    peerRef.current = peer;

    peer.on('open', () => {
      setConnectionState('OPEN');
      setError('');
    });
    peer.on('error', (peerError) => {
      setConnectionState('ERROR');
      setError(
        peerError.type === 'unavailable-id'
          ? '房间码发生冲突，请返回后重新创建。'
          : '无法连接信令服务，请检查网络后重试。',
      );
    });
    peer.on('disconnected', () => {
      setError('与信令服务的连接已断开，正在尝试恢复；已连接玩家可继续游戏。');
      if (!peer.destroyed) peer.reconnect();
    });

    peer.on('connection', (connection) => {
      const peerId = connection.peer;
      connectionsRef.current.get(peerId)?.close();
      connectionsRef.current.set(peerId, connection);

      connection.on('open', () => {
        setConnectionCount(connectionsRef.current.size);
        sendToPeer(peerId, { type: 'SYNC_ROOM_STATE', room: toPublicRoom(roomRef.current) });
        const seat = roomRef.current.seats.find((item) => item.peerId === peerId);
        if (seat?.roleId) {
          sendToPeer(peerId, { type: 'ASSIGN_ROLE', role: ROLE_REGISTRY[seat.roleId] });
        }
      });
      connection.on('data', (data) => {
        messageHandlerRef.current(peerId, data as ClientMessage);
      });
      connection.on('close', () => {
        if (connectionsRef.current.get(peerId) === connection) {
          connectionsRef.current.delete(peerId);
          playerNamesRef.current.delete(peerId);
          setConnectionCount(connectionsRef.current.size);
          if (roomRef.current.gameStatus === 'SETUP' || roomRef.current.gameStatus === 'READY') {
            updateRoom((roomState) => ({
              ...roomState,
              seats: roomState.seats.map((seat) =>
                seat.peerId === peerId ? { ...seat, peerId: null, playerName: '' } : seat,
              ),
            }));
          }
        }
      });
    });

    return () => {
      peer.destroy();
      connectionsRef.current.clear();
    };
  }, [sendToPeer, updateRoom]);

  const changeHostMode = useCallback((hostMode: HostMode) => {
    setNotice('');
    const current = roomRef.current;
    if (current.gameStatus === 'DEALT' || current.gameStatus === 'FINISHED') return;
    if (hostMode === current.hostMode) return;
    if (hostMode === 'GOD_ONLY') {
      updateRoom((roomState) => ({
        ...roomState,
        hostMode,
        seats: roomState.seats.map((seat) =>
          seat.isHost ? { ...seat, peerId: null, playerName: '', isHost: false } : seat,
        ),
      }));
      return;
    }
    const emptySeat = current.seats.find((seat) => seat.peerId === null);
    if (!emptySeat) {
      setNotice('房主参战需要一个空位，请先调整座位。');
      return;
    }
    updateRoom((roomState) => ({
      ...roomState,
      hostMode,
      seats: roomState.seats.map((seat) =>
        seat.seatNumber === emptySeat.seatNumber
          ? { ...seat, peerId: HOST_PEER_ID, playerName: '房主', isHost: true }
          : seat,
      ),
    }));
  }, [updateRoom]);

  const changeRoleCount = useCallback((roleId: string, delta: number) => {
    setNotice('');
    const current = roomRef.current;
    if (current.gameStatus === 'DEALT' || current.gameStatus === 'FINISHED') return;
    const currentCount = current.selectedRoleIds.filter((id) => id === roleId).length;
    const isUniqueRole = roleId !== 'villager' && roleId !== 'werewolf';
    if (delta > 0 && isUniqueRole && currentCount >= 1) return;
    if (delta < 0 && currentCount <= (roleId === 'werewolf' ? 1 : 0)) return;
    const nextTotal = current.totalSeats + delta;
    if (nextTotal < 4 || nextTotal > 12) {
      setNotice('当前支持 4–12 人游戏。');
      return;
    }
    if (delta < 0 && current.seats[current.totalSeats - 1]?.peerId !== null) {
      setNotice('请先让末位玩家离座，再减少人数。');
      return;
    }

    const selectedRoleIds = [...current.selectedRoleIds];
    if (delta > 0) selectedRoleIds.push(roleId);
    else selectedRoleIds.splice(selectedRoleIds.lastIndexOf(roleId), 1);
    updateRoom((roomState) => ({
      ...roomState,
      totalSeats: nextTotal,
      selectedRoleIds,
      seats: createSeats(nextTotal, roomState.hostMode, roomState.seats),
    }));
  }, [updateRoom]);

  const swapSeats = useCallback((seatA: number, seatB: number) => {
    if (seatA === seatB) return;
    const current = roomRef.current;
    if (current.gameStatus === 'DEALT' || current.gameStatus === 'FINISHED') return;
    updateRoom((roomState) => ({
      ...roomState,
      seats: roomState.seats.map((seat) => {
        const sourceNumber = seat.seatNumber === seatA ? seatB : seat.seatNumber === seatB ? seatA : null;
        if (sourceNumber === null) return seat;
        const source = roomState.seats.find((item) => item.seatNumber === sourceNumber)!;
        return {
          ...seat,
          peerId: source.peerId,
          playerName: source.playerName,
          isHost: source.isHost,
        };
      }),
    }));
  }, [updateRoom]);

  const dealCards = useCallback(() => {
    setNotice('');
    const current = roomRef.current;
    if (current.gameStatus === 'DEALT') return;
    if (getOccupiedSeats(current).length !== current.totalSeats) {
      setNotice('还有空座位，所有玩家入座后才能发牌。');
      return;
    }
    if (current.selectedRoleIds.length !== current.totalSeats) {
      setNotice('卡牌数量需要与座位数一致。');
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
  }, [publish, sendToPeer]);

  const setPlayerStatus = useCallback((seatNumber: number, status: PlayerStatus) => {
    updateRoom((roomState) => ({
      ...roomState,
      seats: roomState.seats.map((seat) => seat.seatNumber === seatNumber ? { ...seat, status } : seat),
    }));
  }, [updateRoom]);

  const toggleTag = useCallback((seatNumber: number, tag: string) => {
    updateRoom((roomState) => ({
      ...roomState,
      seats: roomState.seats.map((seat) => {
        if (seat.seatNumber !== seatNumber) return seat;
        const tags = seat.tags.includes(tag)
          ? seat.tags.filter((item) => item !== tag)
          : [...seat.tags, tag];
        return { ...seat, tags };
      }),
    }));
  }, [updateRoom]);

  const resetGame = useCallback(() => {
    updateRoom((roomState) => ({
      ...roomState,
      gameStatus: 'SETUP',
      seats: roomState.seats.map((seat) => ({
        ...seat,
        roleId: null,
        status: 'ALIVE',
        tags: [],
      })),
    }));
    broadcast({ type: 'RESET_GAME' });
  }, [broadcast, updateRoom]);

  return {
    room,
    connectionState,
    connectionCount,
    error,
    notice,
    setNotice,
    changeHostMode,
    changeRoleCount,
    swapSeats,
    dealCards,
    setPlayerStatus,
    toggleTag,
    resetGame,
  };
}
