import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Check,
  Eye,
  EyeOff,
  Heart,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  QrCode,
  RefreshCw,
  Skull,
  Users,
  Vote,
  WifiOff,
  X,
} from 'lucide-react';
import { resolveRole, type RoleDefinition } from '../config/roles';
import type { ClientMessage, PlayerStatus, PublicRoomState, RoomState } from '../types/protocol';
import { CARD_BACK_SRC, hasRoleArt, RoleArtwork } from './RoleArtwork';
import { PreselectGodSettings } from './PreselectGodSettings';
import { RoleEditor } from './RoleEditor';
import { RolePreselect } from './RolePreselect';
import { SeatGrid } from './SeatGrid';

interface RoomViewProps {
  room: PublicRoomState | null;
  godRoom: RoomState | null;
  myPeerId: string | null;
  myName: string;
  myRole: RoleDefinition | null;
  myPreselectRoleId: string | null;
  myBlockedPreselectRoleIds: string[];
  connectionLabel: string;
  /** 仅致命失败时为 true；重试中应保持 false，避免闪「无法加入」。 */
  connectionFailed?: boolean;
  error: string;
  statusHint?: string;
  notice: string;
  onNoticeClose: () => void;
  onSend: (message: ClientMessage) => void;
  onExit: () => void;
}

const STATUS_OPTIONS: { value: PlayerStatus; label: string; icon: typeof Heart }[] = [
  { value: 'ALIVE', label: '存活', icon: Heart },
  { value: 'DEAD', label: '夜死', icon: Skull },
  { value: 'VOTED_OUT', label: '放逐', icon: Vote },
];
const TAGS = ['警长', '中刀', '吃毒', '已查验'];

function GodControls({ room, onSend }: { room: RoomState; onSend: (message: ClientMessage) => void }) {
  const [selectedNumber, setSelectedNumber] = useState(room.seats[0]?.seatNumber ?? 1);
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => setConfirmReset(false), [room.gameStatus]);
  const selected = room.seats.find((seat) => seat.seatNumber === selectedNumber) ?? room.seats[0];

  return (
    <section className="god-compact-panel">
      <div className="room-section__heading">
        <div><Eye size={15} /><strong>全场身份</strong><span>{room.seats.filter((seat) => seat.status === 'ALIVE').length} 人存活</span></div>
      </div>
      <div className="god-seat-grid">
        {room.seats.map((seat) => {
          const role = seat.roleId ? resolveRole(seat.roleId, room.customRoles) : null;
          return (
            <button
              type="button"
              key={seat.seatNumber}
              className={`${selected?.seatNumber === seat.seatNumber ? 'selected' : ''} ${seat.status !== 'ALIVE' ? 'out' : ''}`}
              onClick={() => { setSelectedNumber(seat.seatNumber); setConfirmReset(false); }}
            >
              <span className="god-seat-card__number">{String(seat.seatNumber).padStart(2, '0')}</span>
              <span className={`god-seat-card__status ${seat.status !== 'ALIVE' ? 'out' : ''}`}>
                {seat.status === 'ALIVE' ? '存活' : seat.status === 'DEAD' ? '夜死' : '放逐'}
              </span>
              <strong>{seat.playerName || '空位'}</strong>
              <small style={{ color: role?.visual.badgeColor }}>{role?.name ?? '未发牌'}</small>
              {seat.tags.length > 0 && <span className="god-seat-card__badges">
                {seat.tags.map((tag) => <em key={tag}>{tag}</em>)}
              </span>}
            </button>
          );
        })}
      </div>
      {selected && (
        <div className="god-selected-player">
          <div className="god-selected-player__title">
            <strong>{selected.seatNumber} 号 · {selected.playerName || '空位'}</strong>
            <span>{selected.roleId ? resolveRole(selected.roleId, room.customRoles)?.name ?? '未知身份' : '未发牌'}</span>
          </div>
          <div className="compact-status-switch">
            {STATUS_OPTIONS.map((option) => {
              const Icon = option.icon;
              return <button
                type="button"
                key={option.value}
                className={selected.status === option.value ? 'active' : ''}
                onClick={() => onSend({ type: 'SET_PLAYER_STATUS', seatNumber: selected.seatNumber, status: option.value })}
              ><Icon size={12} />{option.label}</button>;
            })}
          </div>
          <div className="compact-tags">
            {TAGS.map((tag) => <button
              type="button"
              key={tag}
              className={selected.tags.includes(tag) ? 'active' : ''}
              onClick={() => onSend({ type: 'TOGGLE_TAG', seatNumber: selected.seatNumber, tag })}
            >{selected.tags.includes(tag) && <Check size={10} />}{tag}</button>)}
          </div>
        </div>
      )}
      <PreselectGodSettings
        enabled={room.preselectEnabled}
        cooldownRounds={room.preselectCooldownRounds}
        onToggle={(enabled) => onSend({ type: 'SET_PRESELECT_ENABLED', enabled })}
        onCooldownChange={(rounds) => onSend({ type: 'SET_PRESELECT_COOLDOWN', rounds })}
      />
      <button
        type="button"
        className={`god-reset-button ${confirmReset ? 'confirming' : ''}`}
        onClick={() => {
          if (confirmReset) onSend({ type: 'RESET_GAME' });
          else setConfirmReset(true);
        }}
      ><RefreshCw size={16} />{confirmReset ? '确认重开' : '重开'}</button>
    </section>
  );
}

export function RoomView({
  room,
  godRoom,
  myPeerId,
  myName,
  myRole,
  myPreselectRoleId,
  myBlockedPreselectRoleIds,
  connectionLabel,
  connectionFailed = false,
  error,
  statusHint = '',
  notice,
  onNoticeClose,
  onSend,
  onExit,
}: RoomViewProps) {
  const [revealed, setRevealed] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  useEffect(() => setRevealed(false), [myRole]);

  const isGod = room?.godPeerId === myPeerId && myPeerId !== null;
  const dealt = room?.gameStatus === 'DEALT' || room?.gameStatus === 'FINISHED';
  const mySeat = room?.seats.find((seat) => seat.peerId === myPeerId);
  const occupiedCount = room?.seats.filter((seat) => seat.peerId !== null).length ?? 0;
  const inviteUrl = room ? `${window.location.origin}${window.location.pathname}?room=${room.roomId}` : '';

  return (
    <div className="room-shell">
      <header className="room-topbar">
        {room && <button type="button" className="room-code-label room-code-button" onClick={() => setShowInvite(true)} aria-label="展示房间二维码">
          房间 <strong>{room.roomId}</strong><QrCode size={14} />
        </button>}
        {room && (
          <span className="room-occupancy" aria-label={`已入座 ${occupiedCount} 人，共 ${room.totalSeats} 个位置`}>
            <Users size={13} />
            <strong>{occupiedCount}</strong>
            <span>/{room.totalSeats}</span>
            <em>人</em>
          </span>
        )}
        <span className="online-label"><i />{connectionLabel}</span>
        <button type="button" className="room-exit" onClick={onExit} aria-label="离开房间"><LogOut size={17} /></button>
      </header>

      {showInvite && room && <div className="invite-modal" onClick={() => setShowInvite(false)}>
        <section className="invite-card" role="dialog" aria-modal="true" aria-labelledby="invite-title" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="invite-card__close" onClick={() => setShowInvite(false)} aria-label="关闭二维码"><X size={17} /></button>
          <strong id="invite-title">扫码加入房间</strong>
          <p>使用其他设备扫码，填写昵称即可加入</p>
          <div className="invite-card__qr"><QRCodeSVG value={inviteUrl} size={180} bgColor="#ffffff" fgColor="#111319" level="M" /></div>
          <span>房间码 <strong>{room.roomId}</strong></span>
        </section>
      </div>}

      {notice && <div className="compact-toast" role="status">
        <span>{notice}</span><button type="button" onClick={onNoticeClose}><X size={14} /></button>
      </div>}

      {!room ? (
        <main className="connecting-view">
          {connectionFailed ? <WifiOff size={28} /> : <LoaderCircle className="spin" size={28} />}
          <h1>{connectionFailed ? '无法加入房间' : '正在连接房间'}</h1>
          <p>{connectionFailed ? (error || '请返回后重试。') : (statusHint || '请稍候…')}</p>
          {connectionFailed && <button className="button button--primary" type="button" onClick={onExit}>返回重试</button>}
        </main>
      ) : (
        <main className="compact-room-main">
          <section className={`god-seat ${isGod ? 'god-seat--mine' : ''}`}>
            <span className="god-seat__icon"><Eye size={19} /></span>
            <div><strong>上帝位</strong><span>{room.godPeerId ? room.godName : '虚位以待'}</span></div>
            {isGod ? (
              <button type="button" onClick={() => onSend({ type: 'LEAVE_GOD' })}>离开上帝位</button>
            ) : !room.godPeerId ? (
              <button type="button" className="primary" onClick={() => onSend({ type: 'CLAIM_GOD' })}>坐上去</button>
            ) : <span className="god-seat__occupied">已就位</span>}
          </section>

          {dealt ? (
            isGod ? (
              godRoom ? <GodControls room={godRoom} onSend={onSend} /> : <div className="inline-loading"><LoaderCircle className="spin" size={20} />正在同步上帝视角…</div>
            ) : (
              <section className="player-role-section">
                <div className="room-section__heading">
                  <div><LockKeyhole size={15} /><strong>我的身份</strong><span>{mySeat ? `${mySeat.seatNumber} 号位` : '旁观者'}</span></div>
                  {mySeat && <span className={mySeat.status === 'ALIVE' ? 'alive-text' : 'out-text'}>{mySeat.status === 'ALIVE' ? '存活' : mySeat.status === 'DEAD' ? '夜死' : '放逐'}</span>}
                </div>
                <button
                  type="button"
                  className={`identity-flip ${revealed ? 'revealed' : ''}`}
                  style={{ '--role-color': myRole?.visual.badgeColor ?? '#a89578' } as CSSProperties}
                  onClick={() => myRole && setRevealed(!revealed)}
                  aria-label={revealed ? '隐藏我的身份' : '查看我的身份'}
                >
                  <span className="identity-flip__inner">
                    <span className="identity-card identity-card--back">
                      <img className="identity-card__back-art" src={CARD_BACK_SRC} alt="" draggable={false} />
                      <span className="identity-card__back-info">
                        <strong>{myRole ? myName : '等待身份同步'}</strong>
                        <span className="identity-card__privacy"><Eye size={11} />仅自己可见 · 点击翻转</span>
                      </span>
                    </span>
                    <span className={`identity-card identity-card--front ${myRole && !hasRoleArt(myRole) ? 'identity-card--blank' : ''}`}>
                      {myRole && <RoleArtwork role={myRole} className="identity-card__art" />}
                      {myRole && <span className="identity-card__front-info">
                        <strong>{myRole.name}</strong>
                        <small>{myRole.description}</small>
                      </span>}
                    </span>
                  </span>
                </button>
                <p className="identity-flip__hint">{revealed ? <EyeOff size={12} /> : <Eye size={12} />}{revealed ? '再次点击隐藏身份' : '点击卡片翻转查看'}</p>
              </section>
            )
          ) : (
            <>
              <section className="room-section">
                <div className="room-section__heading">
                  <div><strong>玩家座位</strong><span>{occupiedCount} 人已入座 · 共 {room.totalSeats} 位</span></div>
                  {mySeat && !isGod && <small>自动分配到 {mySeat.seatNumber} 号位，可点空位调整</small>}
                  {!mySeat && !isGod && <small>房间已满，等待自动补位</small>}
                  {isGod && <small>点两个座位可调位</small>}
                </div>
                <SeatGrid
                  seats={room.seats}
                  mode={isGod ? 'god' : 'player'}
                  myPeerId={myPeerId}
                  onSelectSeat={(targetSeat) => onSend({ type: 'SELECT_SEAT', targetSeat })}
                  onSwapSeats={(seatA, seatB) => onSend({ type: 'SWAP_SEATS', seatA, seatB })}
                />
              </section>
              <RoleEditor
                selectedRoleIds={room.selectedRoleIds}
                customRoles={room.customRoles}
                readOnly={!isGod}
                onChange={(roleId, delta) => onSend({ type: 'CHANGE_ROLE_COUNT', roleId, delta })}
                onAddCustom={(role) => onSend({ type: 'ADD_CUSTOM_ROLE', role })}
                onRemoveCustom={(roleId) => onSend({ type: 'REMOVE_CUSTOM_ROLE', roleId })}
              />
              {isGod && (
                <section className="room-section">
                  <PreselectGodSettings
                    enabled={room.preselectEnabled}
                    cooldownRounds={room.preselectCooldownRounds}
                    onToggle={(enabled) => onSend({ type: 'SET_PRESELECT_ENABLED', enabled })}
                    onCooldownChange={(rounds) => onSend({ type: 'SET_PRESELECT_COOLDOWN', rounds })}
                  />
                </section>
              )}
              {mySeat && !isGod && room.preselectEnabled && (
                <RolePreselect
                  selectedRoleIds={room.selectedRoleIds}
                  customRoles={room.customRoles}
                  myPreselectRoleId={myPreselectRoleId}
                  blockedRoleIds={myBlockedPreselectRoleIds}
                  cooldownRounds={room.preselectCooldownRounds}
                  onPreselect={(roleId) => onSend({ type: 'PRESELECT_ROLE', roleId })}
                />
              )}
              {isGod ? (
                <button
                  className="button button--primary button--full room-main-action"
                  type="button"
                  disabled={room.gameStatus !== 'READY'}
                  onClick={() => onSend({ type: 'DEAL_CARDS' })}
                >{room.gameStatus === 'READY' ? '确认发牌' : `还差 ${room.totalSeats - occupiedCount} 位玩家`}</button>
              ) : (
                <div className="waiting-action"><LoaderCircle className={room.godPeerId && mySeat ? 'spin' : ''} size={15} />{!mySeat ? '房间已满，上帝加牌后将自动入座' : room.godPeerId ? (room.preselectEnabled ? (myPreselectRoleId ? '已预选，等待上帝发牌' : '可预选身份，或等待上帝发牌') : '等待上帝发牌') : '等待有人坐上上帝位'}</div>
              )}
            </>
          )}
        </main>
      )}
    </div>
  );
}
