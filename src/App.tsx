import { useState } from 'react';
import { Landing } from './components/Landing';
import { RoomView } from './components/RoomView';
import { resolveRole } from './config/roles';
import { usePeerClient } from './hooks/usePeerClient';
import { usePeerHost } from './hooks/usePeerHost';
import type { CreateInfo, JoinInfo } from './types/protocol';
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
  onExit,
}: {
  createInfo: CreateInfo;
  restore?: HostRestoreData;
  onExit: () => void;
}) {
  const host = usePeerHost(createInfo, restore);
  const hostSeat = host.room.seats.find((seat) => seat.peerId === HOST_PEER_ID);
  const myRole = hostSeat?.roleId ? resolveRole(hostSeat.roleId, host.room.customRoles) ?? null : null;
  return (
    <RoomView
      room={host.publicRoom}
      godRoom={host.room}
      myPeerId={HOST_PEER_ID}
      myName={createInfo.playerName}
      myRole={myRole}
      myPreselectRoleId={host.myPreselectRoleId}
      myBlockedPreselectRoleIds={host.myBlockedPreselectRoleIds}
      connectionLabel={host.connectionState === 'OPEN' ? `${host.connectionCount} 台设备` : '连接中'}
      connectionFailed={host.connectionState === 'ERROR'}
      error={host.error}
      notice={host.notice}
      onNoticeClose={() => host.setNotice('')}
      onSend={host.send}
      onExit={onExit}
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
    return <HostRoom createInfo={session.createInfo} restore={session.restore} onExit={exitRoom} />;
  }
  if (session?.type === 'CLIENT') return <ClientRoom joinInfo={session.joinInfo} onExit={exitRoom} />;
  return (
    <Landing
      initialRoomId={initialRoomId}
      onCreate={enterHost}
      onJoin={enterClient}
    />
  );
}
