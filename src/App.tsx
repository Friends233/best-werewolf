import { useEffect, useState } from 'react';
import { DebugPanel } from './components/DebugPanel';
import { Landing } from './components/Landing';
import { RoomView } from './components/RoomView';
import { resolveRole } from './config/roles';
import { usePeerClient } from './hooks/usePeerClient';
import { usePeerHost } from './hooks/usePeerHost';
import type { CreateInfo, JoinInfo } from './types/protocol';
import { isDebugMode } from './utils/debugMode';
import { HOST_PEER_ID } from './utils/game';
import {
  clearPersistedSession,
  restoreAppSession,
  saveClientSession,
  type AppSession,
  type HostRestoreData,
} from './utils/sessionPersist';

function HostRoom({
  createInfo,
  restore,
  debugEnabled,
  onExit,
}: {
  createInfo: CreateInfo;
  restore?: HostRestoreData;
  debugEnabled: boolean;
  onExit: () => void;
}) {
  const host = usePeerHost(createInfo, restore);
  const [debugPeerId, setDebugPeerId] = useState(HOST_PEER_ID);
  const debugPlayerExists = host.debugPlayers.some((player) => player.peerId === debugPeerId);
  const activePeerId = debugEnabled && (debugPeerId === HOST_PEER_ID || debugPlayerExists)
    ? debugPeerId
    : HOST_PEER_ID;
  const activeSeat = host.room.seats.find((seat) => seat.peerId === activePeerId);
  const activeDebugPlayer = host.debugPlayers.find((player) => player.peerId === activePeerId);
  const myRole = activeSeat?.roleId ? resolveRole(activeSeat.roleId, host.room.customRoles) ?? null : null;
  const myName = activeDebugPlayer?.playerName || activeSeat?.playerName || createInfo.playerName;
  const myPreselect = host.getPreselectFor(activePeerId);

  useEffect(() => {
    if (!debugEnabled) host.clearDebugPlayers(true);
  }, [debugEnabled, host.clearDebugPlayers]);

  useEffect(() => {
    if (debugPeerId !== HOST_PEER_ID && !debugPlayerExists) setDebugPeerId(HOST_PEER_ID);
  }, [debugPeerId, debugPlayerExists]);

  return (
    <RoomView
      room={host.publicRoom}
      godRoom={host.room}
      myPeerId={activePeerId}
      myName={myName}
      myRole={myRole}
      myPreselectRoleId={myPreselect.roleId}
      myBlockedPreselectRoleIds={myPreselect.blockedRoleIds}
      connectionLabel={host.connectionState === 'OPEN' ? `${host.connectionCount} 台设备` : '连接中'}
      connectionFailed={host.connectionState === 'ERROR'}
      error={host.error}
      notice={host.notice}
      onNoticeClose={() => host.setNotice('')}
      onSend={(message) => host.sendAs(activePeerId, message)}
      onExit={onExit}
      debugPanel={debugEnabled ? (
        <DebugPanel
          room={host.room}
          players={host.debugPlayers}
          activePeerId={activePeerId}
          onSwitchPeer={setDebugPeerId}
          onAddPlayers={host.addDebugPlayers}
          onClearPlayers={() => host.clearDebugPlayers()}
        />
      ) : null}
    />
  );
}

function ClientRoom({ joinInfo, onExit }: { joinInfo: JoinInfo; onExit: () => void }) {
  const client = usePeerClient(joinInfo);
  return (
    <RoomView
      room={client.room}
      godRoom={client.godRoom}
      myPeerId={client.peerId}
      myName={joinInfo.playerName}
      myRole={client.role}
      myPreselectRoleId={client.myPreselectRoleId}
      myBlockedPreselectRoleIds={client.myBlockedPreselectRoleIds}
      connectionLabel={
        client.connectionState === 'CONNECTED'
          ? '已连接'
          : client.connectionState === 'CONNECTING'
            ? '重连中'
            : '未连接'
      }
      connectionFailed={client.connectionState === 'ERROR'}
      error={client.error}
      statusHint={client.statusHint}
      notice={client.notice}
      onNoticeClose={() => client.setNotice('')}
      onSend={client.send}
      onExit={onExit}
    />
  );
}

export default function App() {
  const debugEnabled = isDebugMode();
  const initialRoomId = (new URLSearchParams(window.location.search).get('room') ?? '').toUpperCase().slice(0, 4);
  const [session, setSession] = useState<AppSession | null>(() => restoreAppSession());

  const exitRoom = () => {
    clearPersistedSession();
    setSession(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState(null, '', url);
  };

  const enterHost = (createInfo: CreateInfo) => {
    clearPersistedSession();
    setSession({ type: 'HOST', createInfo });
  };

  const enterClient = (joinInfo: JoinInfo) => {
    saveClientSession(joinInfo);
    setSession({ type: 'CLIENT', joinInfo });
  };

  if (session?.type === 'HOST') {
    return <HostRoom createInfo={session.createInfo} restore={session.restore} debugEnabled={debugEnabled} onExit={exitRoom} />;
  }
  if (session?.type === 'CLIENT') return <ClientRoom joinInfo={session.joinInfo} onExit={exitRoom} />;
  return (
    <Landing
      initialRoomId={initialRoomId}
      debugEnabled={debugEnabled}
      onCreate={enterHost}
      onJoin={enterClient}
    />
  );
}
