import { useCallback, useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { RoleDefinition } from '../config/roles';
import type { ClientMessage, HostMessage, JoinInfo, PublicRoomState, RoomState } from '../types/protocol';
import {
  getOrCreateClientPeerId,
  saveClientSession,
} from '../utils/sessionPersist';
import { getHostPeerId } from './usePeerHost';

type ConnectionState = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

const RECONNECT_MAX_MS = 12000;
const SOFT_HINT_AFTER_ATTEMPTS = 3;
const CONNECT_TIMEOUT_MS = 10000;

function reconnectDelay(attempt: number) {
  if (attempt <= 0) return 1000;
  if (attempt === 1) return 1600;
  if (attempt === 2) return 2500;
  return Math.min(RECONNECT_MAX_MS, 3000 * (2 ** Math.min(attempt - 2, 2)));
}

export function usePeerClient(joinInfo: JoinInfo) {
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [godRoom, setGodRoom] = useState<RoomState | null>(null);
  const [role, setRole] = useState<RoleDefinition | null>(null);
  const [myPreselectRoleId, setMyPreselectRoleId] = useState<string | null>(null);
  const [myBlockedPreselectRoleIds, setMyBlockedPreselectRoleIds] = useState<string[]>([]);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('CONNECTING');
  const [error, setError] = useState('');
  const [statusHint, setStatusHint] = useState('正在连接房间…');
  const [notice, setNotice] = useState('');
  const connectionRef = useRef<DataConnection | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const roomSnapshotRef = useRef<PublicRoomState | null>(null);
  const disposedRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const connectTimeoutRef = useRef<number | null>(null);
  const ignoreCloseRef = useRef(false);
  const reconnectScheduledRef = useRef(false);

  const send = useCallback((message: ClientMessage) => {
    setNotice('');
    if (connectionRef.current?.open) connectionRef.current.send(message);
  }, []);

  useEffect(() => {
    disposedRef.current = false;
    saveClientSession(joinInfo);

    const clientId = getOrCreateClientPeerId(joinInfo.roomId);

    const clearConnectTimeout = () => {
      if (connectTimeoutRef.current !== null) {
        window.clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
    };

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      reconnectScheduledRef.current = false;
    };

    const detachConnection = (connection: DataConnection | null) => {
      if (!connection) return;
      ignoreCloseRef.current = true;
      try {
        connection.close();
      } catch {
        // ignore
      }
      window.setTimeout(() => {
        ignoreCloseRef.current = false;
      }, 0);
    };

    const updateSoftHint = (reason: 'drop' | 'missing-host', attempt: number) => {
      if (roomSnapshotRef.current) {
        setStatusHint('');
        return;
      }
      if (attempt >= SOFT_HINT_AFTER_ATTEMPTS) {
        setStatusHint(reason === 'missing-host'
          ? '仍在寻找房间，请确认房主页面已打开…'
          : '连接较慢，仍在重试…');
      } else {
        setStatusHint('正在连接房间…');
      }
    };

    const scheduleReconnect = (reason: 'drop' | 'missing-host') => {
      if (disposedRef.current || reconnectScheduledRef.current) return;
      // 已有进行中的连接（含握手中），等它自己结束，避免并行连接互相掐断
      if (connectionRef.current) return;

      reconnectScheduledRef.current = true;
      const attempt = reconnectAttemptRef.current;
      const delay = reconnectDelay(attempt);
      reconnectAttemptRef.current = attempt + 1;

      setConnectionState((state) => (state === 'ERROR' ? state : 'CONNECTING'));
      setError('');
      updateSoftHint(reason, attempt + 1);

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        reconnectScheduledRef.current = false;
        openHostConnection();
      }, delay);
    };

    const failCurrentAttempt = (reason: 'drop' | 'missing-host') => {
      if (disposedRef.current) return;
      clearConnectTimeout();
      const current = connectionRef.current;
      connectionRef.current = null;
      detachConnection(current);
      scheduleReconnect(reason);
    };

    const handleHostMessage = (data: unknown) => {
      const message = data as HostMessage;
      if (message.type === 'SYNC_ROOM_STATE') {
        roomSnapshotRef.current = message.room;
        setRoom(message.room);
        if (message.room.godPeerId !== peerRef.current?.id) setGodRoom(null);
        if (message.room.gameStatus === 'SETUP' || message.room.gameStatus === 'READY') setRole(null);
        setMyPreselectRoleId((current) => (
          current && !message.room.selectedRoleIds.includes(current) ? null : current
        ));
      } else if (message.type === 'SYNC_GOD_STATE') {
        setGodRoom(message.room);
      } else if (message.type === 'ASSIGN_ROLE') {
        setRole(message.role);
      } else if (message.type === 'SYNC_MY_PRESELECT') {
        setMyPreselectRoleId(message.roleId);
        setMyBlockedPreselectRoleIds(message.blockedRoleIds);
      } else if (message.type === 'RESET_GAME') {
        setRole(null);
        setMyPreselectRoleId(null);
        setNotice('上帝已重开游戏，请重新等待发牌。');
      } else if (message.type === 'NOTICE') {
        setNotice(message.message);
      }
    };

    const openHostConnection = () => {
      if (disposedRef.current) return;
      const peer = peerRef.current;
      if (!peer || peer.destroyed) return;
      if (!peer.open) {
        scheduleReconnect('drop');
        return;
      }
      if (connectionRef.current) return;

      clearConnectTimeout();
      clearReconnectTimer();
      setConnectionState('CONNECTING');
      if (!roomSnapshotRef.current) setStatusHint('正在连接房间…');

      let settled = false;
      const connection = peer.connect(getHostPeerId(joinInfo.roomId), { reliable: true });
      connectionRef.current = connection;

      connectTimeoutRef.current = window.setTimeout(() => {
        if (disposedRef.current || settled || connectionRef.current !== connection) return;
        failCurrentAttempt('missing-host');
      }, CONNECT_TIMEOUT_MS);

      const onOpened = () => {
        if (disposedRef.current || connectionRef.current !== connection || settled) return;
        settled = true;
        clearConnectTimeout();
        clearReconnectTimer();
        reconnectAttemptRef.current = 0;
        setConnectionState('CONNECTED');
        setError('');
        setStatusHint('');
        connection.send({ type: 'JOIN', playerName: joinInfo.playerName });
      };

      connection.on('open', onOpened);
      if (connection.open) onOpened();

      connection.on('data', handleHostMessage);
      connection.on('close', () => {
        if (disposedRef.current || ignoreCloseRef.current) return;
        if (connectionRef.current !== connection) return;
        connectionRef.current = null;
        clearConnectTimeout();
        if (!roomSnapshotRef.current) {
          scheduleReconnect('drop');
          return;
        }
        setConnectionState('DISCONNECTED');
        scheduleReconnect('drop');
      });
      connection.on('error', () => {
        if (disposedRef.current || ignoreCloseRef.current) return;
        if (connectionRef.current !== connection) return;
        failCurrentAttempt(settled ? 'drop' : 'missing-host');
      });
    };

    const peer = new Peer(clientId, { debug: 0 });
    peerRef.current = peer;

    peer.on('open', (id) => {
      if (disposedRef.current) return;
      setPeerId(id);
      openHostConnection();
    });

    peer.on('error', (peerError) => {
      if (disposedRef.current) return;
      if (peerError.type === 'unavailable-id') {
        setConnectionState('ERROR');
        setError('当前身份冲突，请返回后重新加入。');
        setStatusHint('');
        return;
      }
      // 握手中的连接交给 close/error/timeout，避免被 peer-unavailable 提前掐断
      if (connectionRef.current) return;
      scheduleReconnect(peerError.type === 'peer-unavailable' ? 'missing-host' : 'drop');
    });

    peer.on('disconnected', () => {
      if (disposedRef.current || peer.destroyed) return;
      peer.reconnect();
    });

    return () => {
      disposedRef.current = true;
      clearConnectTimeout();
      clearReconnectTimer();
      detachConnection(connectionRef.current);
      connectionRef.current = null;
      peer.destroy();
      peerRef.current = null;
    };
  }, [joinInfo.playerName, joinInfo.roomId]);

  return {
    room,
    godRoom,
    role,
    myPreselectRoleId,
    myBlockedPreselectRoleIds,
    peerId,
    connectionState,
    error,
    statusHint,
    notice,
    setNotice,
    send,
  };
}
