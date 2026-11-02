import { useState } from 'react';
import { GodDashboard } from './components/GodDashboard';
import { HostSetup } from './components/HostSetup';
import { Landing } from './components/Landing';
import { PlayerView } from './components/PlayerView';
import { usePeerClient } from './hooks/usePeerClient';
import { usePeerHost } from './hooks/usePeerHost';
import type { JoinInfo } from './types/protocol';

type Session = { type: 'HOST' } | { type: 'CLIENT'; joinInfo: JoinInfo } | null;

function HostRoom({ onExit }: { onExit: () => void }) {
  const host = usePeerHost();
  if (host.room.gameStatus === 'DEALT' || host.room.gameStatus === 'FINISHED') {
    return (
      <GodDashboard
        room={host.room}
        connectionCount={host.connectionCount}
        notice={host.notice}
        onNoticeClose={() => host.setNotice('')}
        onSetPlayerStatus={host.setPlayerStatus}
        onToggleTag={host.toggleTag}
        onResetGame={host.resetGame}
        onExit={onExit}
      />
    );
  }
  return (
    <HostSetup
      room={host.room}
      connectionState={host.connectionState}
      connectionCount={host.connectionCount}
      error={host.error}
      notice={host.notice}
      onNoticeClose={() => host.setNotice('')}
      onChangeHostMode={host.changeHostMode}
      onChangeRoleCount={host.changeRoleCount}
      onSwapSeats={host.swapSeats}
      onDealCards={host.dealCards}
      onExit={onExit}
    />
  );
}

function ClientRoom({ joinInfo, onExit }: { joinInfo: JoinInfo; onExit: () => void }) {
  const client = usePeerClient(joinInfo);
  return (
    <PlayerView
      joinInfo={joinInfo}
      room={client.room}
      role={client.role}
      peerId={client.peerId}
      connectionState={client.connectionState}
      error={client.error}
      notice={client.notice}
      onNoticeClose={() => client.setNotice('')}
      onSelectSeat={client.selectSeat}
      onLeaveSeat={client.leaveSeat}
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

  if (session?.type === 'HOST') return <HostRoom onExit={exitRoom} />;
  if (session?.type === 'CLIENT') return <ClientRoom joinInfo={session.joinInfo} onExit={exitRoom} />;
  return (
    <Landing
      initialRoomId={initialRoomId}
      onCreate={() => setSession({ type: 'HOST' })}
      onJoin={(joinInfo) => setSession({ type: 'CLIENT', joinInfo })}
    />
  );
}
