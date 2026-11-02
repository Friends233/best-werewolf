import { useState } from 'react';
import { Landing } from './components/Landing';
import { RoomView } from './components/RoomView';
import { ROLE_REGISTRY } from './config/roles';
import { usePeerClient } from './hooks/usePeerClient';
import { usePeerHost } from './hooks/usePeerHost';
import type { CreateInfo, JoinInfo } from './types/protocol';
import { HOST_PEER_ID } from './utils/game';

type Session = { type: 'HOST'; createInfo: CreateInfo } | { type: 'CLIENT'; joinInfo: JoinInfo } | null;

function HostRoom({ createInfo, onExit }: { createInfo: CreateInfo; onExit: () => void }) {
  const host = usePeerHost(createInfo);
  const hostSeat = host.room.seats.find((seat) => seat.peerId === HOST_PEER_ID);
  const myRole = hostSeat?.roleId ? ROLE_REGISTRY[hostSeat.roleId] : null;
  return (
    <RoomView
      room={host.publicRoom}
      godRoom={host.room}
      myPeerId={HOST_PEER_ID}
      myName={createInfo.playerName}
      myRole={myRole}
      connectionLabel={host.connectionState === 'OPEN' ? `${host.connectionCount} 台设备` : '连接中'}
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
      connectionLabel={client.connectionState === 'CONNECTED' ? '已连接' : '未连接'}
      error={client.error}
      notice={client.notice}
      onNoticeClose={() => client.setNotice('')}
      onSend={client.send}
      onExit={onExit}
    />
  );
}

export default function App() {
  const initialRoomId = (new URLSearchParams(window.location.search).get('room') ?? '').toUpperCase().slice(0, 4);
  const [session, setSession] = useState<Session>(null);

  const exitRoom = () => {
    setSession(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState(null, '', url);
  };

  if (session?.type === 'HOST') return <HostRoom createInfo={session.createInfo} onExit={exitRoom} />;
  if (session?.type === 'CLIENT') return <ClientRoom joinInfo={session.joinInfo} onExit={exitRoom} />;
  return (
    <Landing
      initialRoomId={initialRoomId}
      onCreate={(createInfo) => setSession({ type: 'HOST', createInfo })}
      onJoin={(joinInfo) => setSession({ type: 'CLIENT', joinInfo })}
    />
  );
}
