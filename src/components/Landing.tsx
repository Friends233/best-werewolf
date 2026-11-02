import { useState } from 'react';
import {
  ArrowRight,
  Check,
  Eye,
  Gamepad2,
  KeyRound,
  Moon,
  Network,
  Plus,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  Wifi,
} from 'lucide-react';
import type { JoinInfo } from '../types/protocol';

interface LandingProps {
  initialRoomId: string;
  onCreate: () => void;
  onJoin: (info: JoinInfo) => void;
}

export function Landing({ initialRoomId, onCreate, onJoin }: LandingProps) {
  const [tab, setTab] = useState<'create' | 'join'>(initialRoomId ? 'join' : 'create');
  const [roomId, setRoomId] = useState(initialRoomId);
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');

  const handleJoin = () => {
    const normalizedRoom = roomId.trim().toUpperCase();
    const normalizedName = playerName.trim();
    if (normalizedRoom.length !== 4) {
      setError('请输入四位房间码。');
      return;
    }
    if (!normalizedName) {
      setError('请输入你的游戏昵称。');
      return;
    }
    onJoin({ roomId: normalizedRoom, playerName: normalizedName.slice(0, 12) });
  };

  return (
    <div className="landing">
      <div className="landing__glow" />
      <header className="landing-nav">
        <div className="brand">
          <span className="brand__mark"><Moon size={22} fill="currentColor" /></span>
          <span>夜隐</span>
          <span className="brand__en">WEREWOLF</span>
        </div>
        <span className="landing-nav__badge"><Wifi size={14} />局域网好友联机</span>
      </header>

      <main className="landing-main">
        <section className="hero-copy">
          <span className="eyebrow"><Sparkles size={14} /> YOUR NIGHT. YOUR SECRET.</span>
          <h1>夜幕之下，<br /><em>身份仅此可见。</em></h1>
          <p>无需下载，无需注册。一台设备做上帝，<br className="desktop-only" />与朋友面对面开启一场纯粹的狼人杀。</p>
          <div className="hero-features">
            <div><span><ShieldCheck size={19} /></span><div><strong>点对点私密发牌</strong><small>身份只发送到对应玩家设备</small></div></div>
            <div><span><Eye size={19} /></span><div><strong>专业上帝看板</strong><small>排座、身份与出局状态一手掌握</small></div></div>
            <div><span><Network size={19} /></span><div><strong>打开浏览器即玩</strong><small>支持手机、平板与电脑跨端联机</small></div></div>
          </div>
        </section>

        <section className="start-card">
          <div className="start-card__tabs">
            <button type="button" className={tab === 'create' ? 'active' : ''} onClick={() => { setTab('create'); setError(''); }}><Plus size={16} />创建房间</button>
            <button type="button" className={tab === 'join' ? 'active' : ''} onClick={() => { setTab('join'); setError(''); }}><KeyRound size={16} />加入房间</button>
          </div>

          {tab === 'create' ? (
            <div className="start-card__content create-content">
              <span className="start-card__icon"><Gamepad2 size={27} /></span>
              <h2>今晚，由你掌控全场</h2>
              <p>创建房间并成为上帝，邀请身边好友加入。</p>
              <div className="create-details">
                <span><Check size={15} />自定义 4–12 人身份牌</span>
                <span><Check size={15} />支持纯上帝或参战模式</span>
                <span><Check size={15} />洗牌与私密身份自动分发</span>
              </div>
              <button className="button button--primary button--large button--full" type="button" onClick={onCreate}>
                创建新房间<ArrowRight size={18} />
              </button>
              <small className="start-card__footnote">请保持房主页面打开，玩家才能持续联机</small>
            </div>
          ) : (
            <div className="start-card__content join-content">
              <div className="join-heading"><span className="start-card__icon"><UsersRound size={25} /></span><div><h2>加入好友的房间</h2><p>输入房间信息，选择座位后等待发牌。</p></div></div>
              <label className="field-label" htmlFor="room-code">四位房间码</label>
              <div className="input-wrap"><KeyRound size={17} /><input
                id="room-code"
                value={roomId}
                maxLength={4}
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="例如 A8K2"
                onChange={(event) => { setRoomId(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setError(''); }}
              /></div>
              <label className="field-label" htmlFor="player-name">你的昵称</label>
              <div className="input-wrap"><UserRound size={17} /><input
                id="player-name"
                value={playerName}
                maxLength={12}
                autoComplete="nickname"
                placeholder="让好友认出你"
                onChange={(event) => { setPlayerName(event.target.value); setError(''); }}
                onKeyDown={(event) => { if (event.key === 'Enter') handleJoin(); }}
              /></div>
              {error && <p className="field-error" role="alert">{error}</p>}
              <button className="button button--primary button--large button--full" type="button" onClick={handleJoin}>
                进入房间<ArrowRight size={18} />
              </button>
              <small className="start-card__footnote">房间码可在房主控制台顶部找到</small>
            </div>
          )}
        </section>
      </main>

      <footer className="landing-footer">
        <span>建议在同一 Wi-Fi 下使用</span><i />
        <span>WebRTC 点对点连接</span><i />
        <span>首次连接需要互联网完成握手</span>
      </footer>
    </div>
  );
}
