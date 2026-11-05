import { Minus, Plus, Sparkles } from 'lucide-react';
import { MAX_PRESELECT_COOLDOWN, MIN_PRESELECT_COOLDOWN } from '../utils/game';

interface PreselectGodSettingsProps {
  enabled: boolean;
  cooldownRounds: number;
  onToggle: (enabled: boolean) => void;
  onCooldownChange: (rounds: number) => void;
}

export function PreselectGodSettings({
  enabled,
  cooldownRounds,
  onToggle,
  onCooldownChange,
}: PreselectGodSettingsProps) {
  return (
    <div className="preselect-god-settings">
      <div className="room-section__heading">
        <div>
          <Sparkles size={15} />
          <strong>身份预选</strong>
          <span>仅玩家自己可见</span>
        </div>
      </div>
      <div className="preselect-god-settings__row">
        <div>
          <strong>允许预选</strong>
          <small>关闭后本局发牌全部随机</small>
        </div>
        <button
          type="button"
          className={`preselect-toggle ${enabled ? 'on' : ''}`}
          onClick={() => onToggle(!enabled)}
          aria-pressed={enabled}
        >
          <i />
          {enabled ? '开' : '关'}
        </button>
      </div>
      <div className={`preselect-god-settings__row ${enabled ? '' : 'disabled'}`}>
        <div>
          <strong>冷却局数</strong>
          <small>近 N 局预选过的身份不可再选，0 为不限制</small>
        </div>
        <div className="preselect-cooldown-stepper">
          <button
            type="button"
            disabled={!enabled || cooldownRounds <= MIN_PRESELECT_COOLDOWN}
            onClick={() => onCooldownChange(cooldownRounds - 1)}
            aria-label="减少冷却局数"
          >
            <Minus size={12} />
          </button>
          <strong>{cooldownRounds}</strong>
          <button
            type="button"
            disabled={!enabled || cooldownRounds >= MAX_PRESELECT_COOLDOWN}
            onClick={() => onCooldownChange(cooldownRounds + 1)}
            aria-label="增加冷却局数"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
