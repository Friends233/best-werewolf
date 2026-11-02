import { useCallback, useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { RoleDefinition } from '../config/roles';
import type { ClientMessage, HostMessage, JoinInfo, PublicRoomState, RoomState } from '../types/protocol';
import { getHostPeerId } from './usePeerHost';

type ConnectionState = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

export function usePeerClient(joinInfo: JoinInfo) {
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [godRoom, setGodRoom] = useState<RoomState | null>(null);
  const [role, setRole] = useState<RoleDefinition | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('CONNECTING');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const connectionRef = useRef<DataConnection | null>(null);

  const send = useCallback((message: ClientMessage) => {
    setNotice('');
    if (connectionRef.current?.open) connectionRef.current.send(message);
  }, []);

  useEffect(() => {
    const storageKey = `best-werewolf:player:${joinInfo.roomId}`;
    let clientId = sessionStorage.getItem(storageKey);
    if (!clientId) {
      const randomValues = new Uint32Array(4);
      crypto.getRandomValues(randomValues);
      const suffix = Array.from(randomValues, (value) => value.toString(36)).join('-');
      clientId = `best-werewolf-player-${suffix}`;
      sessionStorage.setItem(storageKey, clientId);
    }
    const peer = new Peer(clientId, { debug: 0 });
    const timeout = window.setTimeout(() => {
      setConnectionState((state) => {
        if (state === 'CONNECTING') {
          setError('连接超时，请确认房间码正确，并与房主处于同一网络。');
          return 'ERROR';
        }
        return state;
      });
    }, 15000);

    peer.on('open', (id) => {
      setPeerId(id);
      const connection = peer.connect(getHostPeerId(joinInfo.roomId), { reliable: true });
      connectionRef.current = connection;
      connection.on('open', () => {
        window.clearTimeout(timeout);
        setConnectionState('CONNECTED');
        connection.send({ type: 'JOIN', playerName: joinInfo.playerName });
      });
      connection.on('data', (data) => {
        const message = data as HostMessage;
        if (message.type === 'SYNC_ROOM_STATE') {
          setRoom(message.room);
          if (message.room.godPeerId !== peer.id) setGodRoom(null);
          if (message.room.gameStatus === 'SETUP' || message.room.gameStatus === 'READY') setRole(null);
        } else if (message.type === 'SYNC_GOD_STATE') {
          setGodRoom(message.room);
        } else if (message.type === 'ASSIGN_ROLE') {
          setRole(message.role);
        } else if (message.type === 'RESET_GAME') {
          setRole(null);
          setNotice('上帝已重开游戏，请重新等待发牌。');
        } else if (message.type === 'NOTICE') {
          setNotice(message.message);
        }
      });
      connection.on('close', () => setConnectionState('DISCONNECTED'));
    });

    peer.on('error', (peerError) => {
      window.clearTimeout(timeout);
      setConnectionState('ERROR');
      setError(peerError.type === 'peer-unavailable'
        ? '没有找到这个房间，请核对房间码，并确认创建者页面保持打开。'
        : '连接失败，请检查网络或稍后重试。');
    });
    peer.on('disconnected', () => setConnectionState('DISCONNECTED'));

    return () => {
      window.clearTimeout(timeout);
      peer.destroy();
      connectionRef.current = null;
    };
  }, [joinInfo.playerName, joinInfo.roomId]);

  return {
    room,
    godRoom,
    role,
    peerId,
    connectionState,
    error,
    notice,
    setNotice,
    send,
  };
}
