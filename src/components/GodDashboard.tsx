import { useState } from 'react';
import {
  Check,
  Crown,
  Eye,
  Heart,
  LogOut,
  Moon,
  RefreshCw,
  RotateCcw,
  Shield,
  Skull,
  Sparkles,
  Tags,
  Vote,
  Wifi,
  X,
} from 'lucide-react';
import { CAMP_LABELS, ROLE_REGISTRY } from '../config/roles';
import type { PlayerStatus, RoomState } from '../types/protocol';

interface GodDashboardProps {
  room: RoomState;
  connectionCount: number;
  notice: string;
  onNoticeClose: () => void;
  onSetPlayerStatus: (seatNumber: number, status: PlayerStatus) => void;
  onToggleTag: (seatNumber: number, tag: string) => void;
  onResetGame: () => void;
  onExit: () => void;
}

const STATUS_OPTIONS: { value: PlayerStatus; label: string; icon: typeof Heart }[] = [
  { value: 'ALIVE', label: '存活', icon: Heart },
  { value: 'DEAD', label: '夜死', icon: Skull },
  { value: 'VOTED_OUT', label: '放逐', icon: Vote },
];
const AVAILABLE_TAGS = ['警长', '中刀', '吃毒', '已查验'];

export function GodDashboard({
  room,
  connectionCount,
  notice,
  onNoticeClose,
  onSetPlayerStatus,
  onToggleTag,
  onResetGame,
  onExit,
}: GodDashboardProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const aliveCount = room.seats.filter((seat) => seat.status === 'ALIVE').length;
  const wolfAliveCount = room.seats.filter((seat) => seat.roleId === 'werewolf' && seat.status === 'ALIVE').length;
  const hostSeat = room.seats.find((seat) => seat.isHost);
  const hostRole = hostSeat?.roleId ? ROLE_REGISTRY[hostSeat.roleId] : null;

  return (
    <div className="app-shell god-shell">
      <header className="topbar">
        <div className="brand brand--small">
          <span className="brand__mark"><Moon size={19} fill="currentColor" /></span>
          <span>夜隐</span>
          <span className="brand__divider" />
          <span className="brand__sub">上帝视角</span>
        </div>
        <div className="topbar__actions">
          <span className="connection-pill"><Wifi size={14} />{connectionCount} 台设备在线</span>
          <span className="room-mini">房间 <strong>{room.roomId}</strong></span>
          <button className="icon-text-button" type="button" onClick={onExit}><LogOut size={16} />解散房间</button>
        </div>
      </header>

      <main className="god-main">
        {notice && (
          <div className="notice-banner" role="status">
            <span>{notice}</span><button type="button" onClick={onNoticeClose}><X size={16} /></button>
          </div>
        )}
        <section className="page-heading god-heading">
          <div>
            <span className="eyebrow"><Eye size={14} /> GOD'S VIEW</span>
            <h1>夜幕记录者</h1>
            <p>掌控全场身份，记录每一位玩家的状态。</p>
          </div>
          <button className="button button--outline" type="button" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={16} />再来一局
          </button>
        </section>

        <section className="game-stats">
          <div className="game-stat"><span className="game-stat__icon game-stat__icon--alive"><Heart size={18} /></span><div><strong>{aliveCount}</strong><span>存活玩家</span></div></div>
          <div className="game-stat"><span className="game-stat__icon game-stat__icon--wolf"><Moon size={18} /></span><div><strong>{wolfAliveCount}</strong><span>存活狼人</span></div></div>
          <div className="game-stat"><span className="game-stat__icon game-stat__icon--dead"><Skull size={18} /></span><div><strong>{room.totalSeats - aliveCount}</strong><span>出局玩家</span></div></div>
          <div className="game-stat game-stat--room"><span className="game-stat__icon"><Tags size={18} /></span><div><strong>{room.totalSeats}</strong><span>本局人数</span></div></div>
        </section>

        {hostRole && (
          <section className="host-private-role">
            <span><Shield size={18} />你的身份</span>
            <strong style={{ color: hostRole.visual.badgeColor }}>{hostRole.name}</strong>
            <small>{CAMP_LABELS[hostRole.camp]} · 仅你可见</small>
          </section>
        )}

        <section className="god-grid">
          {room.seats.map((seat) => {
            const role = seat.roleId ? ROLE_REGISTRY[seat.roleId] : null;
            const isOut = seat.status !== 'ALIVE';
            return (
              <article className={`god-card ${isOut ? 'god-card--out' : ''}`} key={seat.seatNumber}>
                <div className="god-card__header">
                  <span className="god-card__seat">{String(seat.seatNumber).padStart(2, '0')}</span>
                  <div className="god-card__player">
                    <strong>{seat.playerName || '空座位'}{seat.isHost && <Crown size={13} />}</strong>
                    <span className={`status-text status-text--${seat.status.toLowerCase()}`}>
                      {seat.status === 'ALIVE' ? '存活中' : seat.status === 'DEAD' ? '夜间出局' : '投票放逐'}
                    </span>
                  </div>
                  {role && <span className="god-role-badge" style={{ borderColor: role.visual.badgeColor, color: role.visual.badgeColor }}>{role.name}</span>}
                </div>

                <div className="god-card__role">
                  <span className="role-config__badge" style={{ backgroundColor: role?.visual.badgeColor ?? '#555' }}>{role?.name.slice(0, 1) ?? '?'}</span>
                  <div><strong>{role?.name ?? '未知身份'}</strong><small>{role ? CAMP_LABELS[role.camp] : '尚未发牌'}</small></div>
                  {seat.status === 'ALIVE' ? <Heart size={17} /> : <Skull size={17} />}
                </div>

                <div className="status-switch">
                  {STATUS_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        type="button"
                        key={option.value}
                        className={seat.status === option.value ? 'active' : ''}
                        onClick={() => onSetPlayerStatus(seat.seatNumber, option.value)}
                      ><Icon size={13} />{option.label}</button>
                    );
                  })}
                </div>
                <div className="tag-row">
                  {AVAILABLE_TAGS.map((tag) => (
                    <button
                      type="button"
                      key={tag}
                      className={seat.tags.includes(tag) ? 'active' : ''}
                      onClick={() => onToggleTag(seat.seatNumber, tag)}
                    >{seat.tags.includes(tag) && <Check size={11} />}{tag}</button>
                  ))}
                </div>
              </article>
            );
          })}
        </section>
        <footer className="god-footer"><Sparkles size={14} />身份与标记变化会实时同步，底牌不会出现在公共房间状态中。</footer>
      </main>

      {confirmReset && (
        <div className="modal-backdrop" role="presentation" onClick={() => setConfirmReset(false)}>
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title" onClick={(event) => event.stopPropagation()}>
            <span className="confirm-modal__icon"><RefreshCw size={24} /></span>
            <h2 id="reset-title">开始新的一局？</h2>
            <p>将清除所有身份、出局状态与标记，保留当前玩家和座位。确认后需重新发牌。</p>
            <div className="confirm-modal__actions">
              <button className="button button--secondary" type="button" onClick={() => setConfirmReset(false)}>取消</button>
              <button className="button button--primary" type="button" onClick={() => { onResetGame(); setConfirmReset(false); }}>确认重置</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
