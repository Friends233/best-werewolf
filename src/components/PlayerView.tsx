import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  Check,
  Crown,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import type { RoleDefinition } from '../config/roles';
import { CAMP_LABELS } from '../config/roles';
import type { JoinInfo, PublicRoomState } from '../types/protocol';
import { SeatGrid } from './SeatGrid';

interface PlayerViewProps {
  joinInfo: JoinInfo;
  room: PublicRoomState | null;
  role: RoleDefinition | null;
  peerId: string | null;
  connectionState: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  error: string;
  notice: string;
  onNoticeClose: () => void;
  onSelectSeat: (seatNumber: number) => void;
  onLeaveSeat: () => void;
  onExit: () => void;
}

export function PlayerView({
  joinInfo,
  room,
  role,
  peerId,
  connectionState,
  error,
  notice,
  onNoticeClose,
  onSelectSeat,
  onLeaveSeat,
  onExit,
}: PlayerViewProps) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => setRevealed(false), [role]);

  const mySeat = room?.seats.find((seat) => seat.peerId === peerId);
  const dealt = room?.gameStatus === 'DEALT' || room?.gameStatus === 'FINISHED';
  const occupiedCount = room?.seats.filter((seat) => seat.peerId !== null).length ?? 0;

  return (
    <div className="app-shell player-shell">
      <header className="topbar">
        <div className="brand brand--small">
          <span className="brand__mark"><Moon size={19} fill="currentColor" /></span>
          <span>夜隐</span>
          <span className="brand__divider" />
          <span className="brand__sub">玩家端</span>
        </div>
        <div className="topbar__actions">
          <span className={`connection-pill ${connectionState !== 'CONNECTED' ? 'connection-pill--error' : ''}`}>
            {connectionState === 'CONNECTED' ? <Wifi size={14} /> : <WifiOff size={14} />}
            {connectionState === 'CONNECTED' ? '已连接房主' : connectionState === 'CONNECTING' ? '正在连接' : '连接中断'}
          </span>
          <button className="icon-text-button" type="button" onClick={onExit}><LogOut size={16} />离开房间</button>
        </div>
      </header>

      <main className="player-main">
        {notice && (
          <div className="notice-banner" role="status"><span>{notice}</span><button type="button" onClick={onNoticeClose}><X size={16} /></button></div>
        )}

        {!room ? (
          <section className="connection-state-card">
            {connectionState === 'ERROR' ? (
              <>
                <span className="connection-state-card__icon connection-state-card__icon--error"><WifiOff size={28} /></span>
                <h1>暂时无法加入</h1>
                <p>{error || '连接失败，请稍后重试。'}</p>
                <button className="button button--primary" type="button" onClick={onExit}><RefreshCw size={16} />返回重新加入</button>
              </>
            ) : (
              <>
                <LoaderCircle className="spin" size={32} />
                <h1>正在寻找房间 {joinInfo.roomId}</h1>
                <p>正在与房主建立点对点连接，请稍候…</p>
              </>
            )}
          </section>
        ) : (
          <>
            <section className="page-heading player-heading">
              <div>
                <span className="eyebrow"><Sparkles size={14} /> ROOM {room.roomId}</span>
                <h1>{dealt ? '你的专属身份' : `晚上好，${joinInfo.playerName}`}</h1>
                <p>{dealt ? '身份只属于你，查看时请留意周围环境。' : '选择座位，等待房主开启这场夜幕游戏。'}</p>
              </div>
              <span className={`phase-badge ${room.gameStatus === 'READY' ? 'phase-badge--ready' : ''}`}>
                <span className="phase-badge__dot" />
                {dealt ? '本局进行中' : room.gameStatus === 'READY' ? '等待发牌' : '选择座位'}
              </span>
            </section>

            {!dealt ? (
              <div className="player-setup-layout">
                <section className="panel player-seats-panel">
                  <div className="panel__heading">
                    <div>
                      <span className="section-kicker"><UsersRound size={16} />选择你的座位</span>
                      <h2>{occupiedCount}<span> / {room.totalSeats} 人已入座</span></h2>
                    </div>
                    <span className="room-mini">房间 <strong>{room.roomId}</strong></span>
                  </div>
                  <SeatGrid seats={room.seats} mode="player" myPeerId={peerId} onSelectSeat={onSelectSeat} />
                </section>

                <aside className="player-status-panel panel">
                  {mySeat ? (
                    <>
                      <span className="player-status-panel__check"><Check size={24} /></span>
                      <span className="section-kicker">入座成功</span>
                      <h2>{mySeat.seatNumber}<small>号位</small></h2>
                      <p>{room.gameStatus === 'READY' ? '所有玩家已就绪，房主即将发牌。' : '你可以改选其他空位，或暂时离开座位。'}</p>
                      {room.gameStatus === 'READY' && <LoaderCircle className="spin waiting-loader" size={20} />}
                      <button className="button button--secondary button--full" type="button" onClick={onLeaveSeat}>离开当前座位</button>
                    </>
                  ) : (
                    <>
                      <span className="player-status-panel__check player-status-panel__check--muted"><UsersRound size={24} /></span>
                      <span className="section-kicker">尚未入座</span>
                      <h2>选择一个空位</h2>
                      <p>点击左侧任意空座位。发牌后座位将不能更改。</p>
                    </>
                  )}
                  <div className="privacy-note"><ShieldCheck size={16} /><span>房主发牌后，只有你能收到自己的身份。</span></div>
                </aside>
              </div>
            ) : (
              <div className="role-view-layout">
                <section className="role-card-section">
                  <button
                    type="button"
                    className={`private-role-card ${revealed ? 'private-role-card--revealed' : ''}`}
                    style={{ '--role-color': role?.visual.badgeColor ?? '#a89578' } as CSSProperties}
                    onClick={() => role && setRevealed(!revealed)}
                    aria-label={revealed ? '隐藏身份' : '查看身份'}
                  >
                    {!revealed ? (
                      <div className="role-card-back">
                        <span className="role-card-back__ornament"><Moon size={40} fill="currentColor" /></span>
                        <span className="role-card-back__brand">夜 隐</span>
                        <span className="role-card-back__line" />
                        <strong>{role ? '点击确认身份' : '身份下发中'}</strong>
                        <small><LockKeyhole size={13} />请确保周围无人窥屏</small>
                      </div>
                    ) : role ? (
                      <div className="role-card-front">
                        <span className="role-card-front__private"><Eye size={13} />仅你可见</span>
                        <span className="role-card-front__symbol">{role.name.slice(0, 1)}</span>
                        <span className="role-card-front__camp">{CAMP_LABELS[role.camp]}</span>
                        <h2>{role.name}</h2>
                        <span className="role-card-front__line" />
                        <p>{role.description}</p>
                        <small><EyeOff size={13} />再次点击隐藏身份</small>
                      </div>
                    ) : null}
                  </button>
                  <p className="role-view-hint"><LockKeyhole size={13} />身份通过点对点连接单独加密下发</p>
                </section>

                <aside className="player-game-info">
                  <section className="panel my-game-panel">
                    <span className="section-kicker"><Crown size={15} />本局信息</span>
                    <div className="my-seat-display"><span>我的座位</span><strong>{mySeat?.seatNumber ?? '—'}<small>号位</small></strong></div>
                    <div className="my-game-row"><span>玩家昵称</span><strong>{joinInfo.playerName}</strong></div>
                    <div className="my-game-row"><span>存活状态</span><strong className={mySeat?.status === 'ALIVE' ? 'text-good' : 'text-danger'}>{mySeat?.status === 'ALIVE' ? '存活' : mySeat?.status === 'DEAD' ? '夜间出局' : '投票放逐'}</strong></div>
                    <div className="my-game-row"><span>房间人数</span><strong>{room.totalSeats} 人</strong></div>
                  </section>
                  {connectionState !== 'CONNECTED' && (
                    <div className="offline-card"><WifiOff size={18} /><div><strong>与房主连接中断</strong><p>请保持本页面，返回房间可尝试重新连接。</p></div></div>
                  )}
                </aside>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
