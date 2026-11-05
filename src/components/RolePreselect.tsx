import { Eye, Sparkles } from 'lucide-react';
import { resolveRole, ROLE_ORDER, type RoleDefinition } from '../config/roles';
import { RoleArtwork } from './RoleArtwork';

interface RolePreselectProps {
  selectedRoleIds: string[];
  customRoles: RoleDefinition[];
  myPreselectRoleId: string | null;
  blockedRoleIds: string[];
  cooldownRounds: number;
  onPreselect: (roleId: string | null) => void;
}

export function RolePreselect({
  selectedRoleIds,
  customRoles,
  myPreselectRoleId,
  blockedRoleIds,
  cooldownRounds,
  onPreselect,
}: RolePreselectProps) {
  const uniqueRoleIds = [
    ...ROLE_ORDER.filter((roleId) => selectedRoleIds.includes(roleId)),
    ...customRoles.map((role) => role.id).filter((roleId) => selectedRoleIds.includes(roleId)),
  ];
  const blockedSet = new Set(blockedRoleIds);
  const selected = myPreselectRoleId ? resolveRole(myPreselectRoleId, customRoles) : null;

  return (
    <section className="room-section role-preselect">
      <div className="room-section__heading">
        <div>
          <Sparkles size={15} />
          <strong>预选身份</strong>
          <span>仅自己可见</span>
        </div>
        {selected && <small>已预选 {selected.name}</small>}
      </div>
      <p className="role-preselect__hint">
        <Eye size={11} />
        仅一人预选时锁定；多人抢同一身份则失效。
        {cooldownRounds > 0 ? `近 ${cooldownRounds} 局预选过的身份不可再选。` : '本局无冷却限制。'}
      </p>
      <div className="role-preselect__grid">
        {uniqueRoleIds.map((roleId) => {
          const role = resolveRole(roleId, customRoles);
          if (!role) return null;
          const count = selectedRoleIds.filter((id) => id === roleId).length;
          const active = myPreselectRoleId === roleId;
          const blocked = blockedSet.has(roleId);
          return (
            <button
              type="button"
              key={roleId}
              className={`role-preselect__item ${active ? 'active' : ''} ${blocked ? 'blocked' : ''}`}
              onClick={() => {
                if (blocked && !active) return;
                onPreselect(active ? null : roleId);
              }}
              disabled={blocked && !active}
              aria-pressed={active}
              title={blocked ? `近 ${cooldownRounds} 局内已预选过` : undefined}
            >
              <RoleArtwork role={role} className="role-preselect__art" />
              <strong>{role.name}</strong>
              {blocked ? <em>冷却</em> : count > 1 ? <em>×{count}</em> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
