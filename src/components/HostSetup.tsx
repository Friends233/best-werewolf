import { useState } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  Eye,
  Link2,
  LogOut,
  Minus,
  Moon,
  Plus,
  QrCode,
  ShieldCheck,
  Sparkles,
  Users,
  UsersRound,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { CAMP_LABELS, ROLE_ORDER, ROLE_REGISTRY } from '../config/roles';
import type { HostMode, RoomState } from '../types/protocol';
import { getOccupiedSeats } from '../utils/game';
import { SeatGrid } from './SeatGrid';

interface HostSetupProps {
  room: RoomState;
  connectionState: 'CONNECTING' | 'OPEN' | 'ERROR';
  connectionCount: number;
  error: string;
  notice: string;
  onNoticeClose: () => void;
  onChangeHostMode: (mode: HostMode) => void;
  onChangeRoleCount: (roleId: string, delta: number) => void;
  onSwapSeats: (seatA: number, seatB: number) => void;
  onDealCards: () => void;
  onExit: () => void;
}

export function HostSetup({
  room,
  connectionState,
  connectionCount,
  error,
  notice,
  onNoticeClose,
  onChangeHostMode,
  onChangeRoleCount,
  onSwapSeats,
  onDealCards,
  onExit,
}: HostSetupProps) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const joinUrl = new URL(window.location.href);
  joinUrl.search = '';
  joinUrl.hash = '';
  joinUrl.searchParams.set('room', room.roomId);
  const occupiedCount = getOccupiedSeats(room).length;
  const emptyCount = room.totalSeats - occupiedCount;

  const copyInvite = async () => {
    const text = `加入我的狼人杀房间 ${room.roomId}：${joinUrl.toString()}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand brand--small">
          <span className="brand__mark"><Moon size={19} fill="currentColor" /></span>
          <span>夜隐</span>
          <span className="brand__divider" />
          <span className="brand__sub">房主控制台</span>
        </div>
        <div className="topbar__actions">
          <span className={`connection-pill ${connectionState === 'ERROR' ? 'connection-pill--error' : ''}`}>
            {connectionState === 'ERROR' ? <WifiOff size={14} /> : <Wifi size={14} />}
            {connectionState === 'CONNECTING' ? '正在创建房间' : connectionState === 'OPEN' ? `${connectionCount} 台设备在线` : '连接异常'}
          </span>
          <button className="icon-text-button" type="button" onClick={onExit}><LogOut size={16} />解散房间</button>
        </div>
      </header>

      <main className="host-main">
        {(error || notice) && (
          <div className="notice-banner" role="alert">
            <span>{error || notice}</span>
            {notice && <button type="button" onClick={onNoticeClose} aria-label="关闭提示"><X size={16} /></button>}
          </div>
        )}

        <section className="page-heading">
          <div>
            <span className="eyebrow"><Sparkles size={14} /> GAME PREPARATION</span>
            <h1>开局配置</h1>
            <p>分享房间码，等待玩家入座后私密发牌。</p>
          </div>
          <span className={`phase-badge ${room.gameStatus === 'READY' ? 'phase-badge--ready' : ''}`}>
            <span className="phase-badge__dot" />
            {room.gameStatus === 'READY' ? '全员就绪' : '准备阶段'}
          </span>
        </section>

        <div className="host-layout">
          <div className="host-layout__primary">
            <section className="panel invite-panel">
              <div className="invite-panel__content">
                <div>
                  <span className="section-kicker"><Link2 size={15} />邀请玩家</span>
                  <h2>输入房间码加入</h2>
                  <p>玩家打开本页面，输入下方四位房间码即可。</p>
                </div>
                <div className="room-code" aria-label={`房间码 ${room.roomId}`}>
                  {room.roomId.split('').map((letter, index) => <span key={`${letter}-${index}`}>{letter}</span>)}
                </div>
                <div className="invite-panel__actions">
                  <button className="button button--light button--small" type="button" onClick={copyInvite}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}{copied ? '已复制邀请' : '复制邀请链接'}
                  </button>
                  <button className="button button--ghost-light button--small" type="button" onClick={() => setShowQr(!showQr)}>
                    <QrCode size={16} />扫码加入<ChevronDown size={14} className={showQr ? 'rotate' : ''} />
                  </button>
                </div>
              </div>
              {showQr && (
                <div className="qr-wrap">
                  <QRCodeSVG value={joinUrl.toString()} size={152} bgColor="#ffffff" fgColor="#171a20" level="M" />
                  <span>使用手机相机扫码</span>
                </div>
              )}
            </section>

            <section className="panel seats-panel">
              <div className="panel__heading">
                <div>
                  <span className="section-kicker"><UsersRound size={16} />座位安排</span>
                  <h2>{occupiedCount}<span> / {room.totalSeats} 人已入座</span></h2>
                </div>
                <span className="subtle-label">座位号即发言顺序</span>
              </div>
              <SeatGrid seats={room.seats} mode="host" onSwapSeats={onSwapSeats} />
            </section>
          </div>

          <aside className="host-layout__sidebar">
            <section className="panel config-panel">
              <div className="panel__heading panel__heading--compact">
                <div>
                  <span className="section-kicker"><Eye size={16} />房主模式</span>
                </div>
              </div>
              <div className="segmented-control">
                <button
                  type="button"
                  className={room.hostMode === 'GOD_ONLY' ? 'active' : ''}
                  onClick={() => onChangeHostMode('GOD_ONLY')}
                >
                  <Eye size={16} />纯上帝
                </button>
                <button
                  type="button"
                  className={room.hostMode === 'PLAYER_AND_GOD' ? 'active' : ''}
                  onClick={() => onChangeHostMode('PLAYER_AND_GOD')}
                >
                  <Users size={16} />参战兼上帝
                </button>
              </div>
              <p className="field-help">{room.hostMode === 'GOD_ONLY' ? '你只做法官，不参与身份派发。' : '你将占用一个座位，也会获得身份。'}</p>
            </section>

            <section className="panel roles-panel">
              <div className="panel__heading panel__heading--compact">
                <div>
                  <span className="section-kicker"><ShieldCheck size={16} />身份牌配置</span>
                  <h2>{room.selectedRoleIds.length}<span> 张身份牌</span></h2>
                </div>
                <span className="subtle-label">4–12 人</span>
              </div>
              <div className="role-config-list">
                {ROLE_ORDER.map((roleId) => {
                  const role = ROLE_REGISTRY[roleId];
                  const count = room.selectedRoleIds.filter((id) => id === roleId).length;
                  const unique = roleId !== 'werewolf' && roleId !== 'villager';
                  return (
                    <div className="role-config" key={roleId}>
                      <span className="role-config__badge" style={{ backgroundColor: role.visual.badgeColor }}>{role.name.slice(0, 1)}</span>
                      <span className="role-config__name">
                        <strong>{role.name}</strong>
                        <small>{CAMP_LABELS[role.camp]}</small>
                      </span>
                      <div className="stepper">
                        <button
                          type="button"
                          aria-label={`减少${role.name}`}
                          disabled={count <= (roleId === 'werewolf' ? 1 : 0)}
                          onClick={() => onChangeRoleCount(roleId, -1)}
                        ><Minus size={14} /></button>
                        <span>{count}</span>
                        <button
                          type="button"
                          aria-label={`增加${role.name}`}
                          disabled={(unique && count >= 1) || room.totalSeats >= 12}
                          onClick={() => onChangeRoleCount(roleId, 1)}
                        ><Plus size={14} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="roles-tip">减少身份牌会移除最后一个座位</p>
            </section>

            <button
              className="button button--primary deal-button"
              type="button"
              disabled={room.gameStatus !== 'READY' || connectionState !== 'OPEN'}
              onClick={onDealCards}
            >
              <Sparkles size={18} />
              {room.gameStatus === 'READY' ? '确认并发牌' : emptyCount > 0 ? `还差 ${emptyCount} 位玩家入座` : '等待玩家就绪'}
            </button>
            <p className="deal-note"><ShieldCheck size={13} />身份仅单独发送给对应玩家</p>
          </aside>
        </div>
      </main>
    </div>
  );
}
