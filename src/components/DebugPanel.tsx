import { Bug, RotateCcw, UserPlus, Users, X } from 'lucide-react';
import { resolveRole } from '../config/roles';
import type { RoomState } from '../types/protocol';
import type { DebugParticipant } from '../utils/debugMode';

interface DebugPanelProps {
  room: RoomState;
  players: DebugParticipant[];
  activePeerId: string;
  onSwitchPeer: (peerId: string) => void;
  onAddPlayers: (count: number) => void;
  onClearPlayers: () => void;
}

export function DebugPanel({
  room,
  players,
  activePeerId,
  onSwitchPeer,
  onAddPlayers,
  onClearPlayers,
}: DebugPanelProps) {
  const remainingSeats = room.seats.filter((seat) => seat.peerId === null).length;
  const canAdd = remainingSeats > 0 && (room.gameStatus === 'SETUP' || room.gameStatus === 'READY');
  const hostSeat = room.seats.find((seat) => seat.peerId === 'host');
  const hostName = hostSeat?.playerName || (room.godPeerId === 'host' ? room.godName : '真实房主');

  return (
    <section className="debug-panel" aria-label="测试模式控制台">
      <div className="debug-panel__header">
        <div>
          <span className="debug-panel__icon"><Bug size={15} /></span>
          <strong>测试模式</strong>
          <em>debug=1</em>
        </div>
        <span>{players.length} 名模拟玩家</span>
      </div>

      <div className="debug-panel__actions">
        <button type="button" disabled={!canAdd} onClick={() => onAddPlayers(1)}>
          <UserPlus size={13} />加 1 人
        </button>
        <button type="button" disabled={!canAdd} onClick={() => onAddPlayers(remainingSeats)}>
          <Users size={13} />补满座位
        </button>
        <button type="button" disabled={players.length === 0} onClick={onClearPlayers}>
          <X size={13} />清除模拟玩家
        </button>
      </div>

      <div className="debug-panel__switch-label">
        <span>切换当前视角</span>
        <small>身份牌和操作权限会随所选玩家切换</small>
      </div>
      <div className="debug-peer-switch">
        <button
          type="button"
          className={activePeerId === 'host' ? 'active' : ''}
          onClick={() => onSwitchPeer('host')}
        >
          <strong>{hostName}</strong>
          <small>真实房主</small>
        </button>
        {players.map((player) => {
          const role = player.roleId ? resolveRole(player.roleId, room.customRoles) : null;
          const position = player.isGod ? '上帝位' : player.seatNumber ? `${player.seatNumber} 号位` : '未入座';
          return (
            <button
              type="button"
              key={player.peerId}
              className={activePeerId === player.peerId ? 'active' : ''}
              onClick={() => onSwitchPeer(player.peerId)}
            >
              <strong>{player.playerName}</strong>
              <small>{position}{role ? ` · ${role.name}` : ''}</small>
            </button>
          );
        })}
      </div>

      {players.length === 0 && (
        <p className="debug-panel__empty">添加模拟玩家后，可在这里自由切换每个人的身份视角。</p>
      )}
      <p className="debug-panel__note">
        <RotateCcw size={11} />测试玩家只在房主端模拟，不会创建额外的设备连接。
      </p>
    </section>
  );
}
