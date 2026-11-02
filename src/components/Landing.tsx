import { useState } from 'react';
import { ArrowRight, KeyRound, Moon, Plus, UserRound } from 'lucide-react';
import type { CreateInfo, JoinInfo } from '../types/protocol';
import { DEFAULT_ROLES } from '../utils/game';
import { RoleEditor } from './RoleEditor';

interface LandingProps {
  initialRoomId: string;
  onCreate: (info: CreateInfo) => void;
  onJoin: (info: JoinInfo) => void;
}

export function Landing({ initialRoomId, onCreate, onJoin }: LandingProps) {
  const [tab, setTab] = useState<'create' | 'join'>(initialRoomId ? 'join' : 'create');
  const [roomId, setRoomId] = useState(initialRoomId);
  const [playerName, setPlayerName] = useState('');
  const [roles, setRoles] = useState([...DEFAULT_ROLES]);
  const [error, setError] = useState('');

  const changeRole = (roleId: string, delta: number) => {
    setRoles((current) => {
      const next = [...current];
      if (delta > 0) next.push(roleId);
      else next.splice(next.lastIndexOf(roleId), 1);
      return next;
    });
    setError('');
  };

  const validName = () => {
    if (!playerName.trim()) {
      setError('请输入昵称。');
      return false;
    }
    return true;
  };

  const handleJoin = () => {
    if (roomId.trim().length !== 4) {
      setError('请输入四位房间码。');
      return;
    }
    if (!validName()) return;
    onJoin({ roomId: roomId.trim().toUpperCase(), playerName: playerName.trim().slice(0, 12) });
  };

  return (
    <div className="simple-landing">
      <header className="simple-brand"><Moon size={20} fill="currentColor" /><strong>最好的狼人杀</strong></header>
      <main className="start-card">
        <div className="start-card__tabs">
          <button type="button" className={tab === 'create' ? 'active' : ''} onClick={() => { setTab('create'); setError(''); }}><Plus size={15} />创建房间</button>
          <button type="button" className={tab === 'join' ? 'active' : ''} onClick={() => { setTab('join'); setError(''); }}><KeyRound size={15} />加入房间</button>
        </div>
        <div className="start-card__body">
          {tab === 'join' && (
            <>
              <label className="field-label" htmlFor="room-code">房间码</label>
              <div className="input-wrap"><KeyRound size={16} /><input
                id="room-code"
                value={roomId}
                maxLength={4}
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="四位房间码"
                onChange={(event) => { setRoomId(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setError(''); }}
              /></div>
            </>
          )}
          <label className="field-label" htmlFor="player-name">你的昵称</label>
          <div className="input-wrap"><UserRound size={16} /><input
            id="player-name"
            value={playerName}
            maxLength={12}
            autoComplete="nickname"
            placeholder="输入昵称"
            onChange={(event) => { setPlayerName(event.target.value); setError(''); }}
            onKeyDown={(event) => { if (event.key === 'Enter' && tab === 'join') handleJoin(); }}
          /></div>

          {tab === 'create' && <RoleEditor selectedRoleIds={roles} onChange={changeRole} />}
          {error && <p className="field-error" role="alert">{error}</p>}
          <button
            className="button button--primary button--full start-button"
            type="button"
            onClick={() => {
              if (!validName()) return;
              if (tab === 'create') onCreate({ playerName: playerName.trim().slice(0, 12), selectedRoleIds: roles });
              else handleJoin();
            }}
          >{tab === 'create' ? '创建房间' : '加入房间'}<ArrowRight size={17} /></button>
          <p className="start-card__note">{tab === 'create' ? '创建后，任何人都可以坐上上帝位' : '创建者需保持房间页面打开'}</p>
        </div>
      </main>
    </div>
  );
}
