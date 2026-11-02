import { Minus, Plus } from 'lucide-react';
import { ROLE_ORDER, ROLE_REGISTRY } from '../config/roles';

interface RoleEditorProps {
  selectedRoleIds: string[];
  readOnly?: boolean;
  onChange?: (roleId: string, delta: number) => void;
}

export function RoleEditor({ selectedRoleIds, readOnly = false, onChange }: RoleEditorProps) {
  return (
    <div className="role-editor">
      <div className="role-editor__heading">
        <span>身份牌</span>
        <strong>{selectedRoleIds.length} 人局</strong>
      </div>
      <div className="role-editor__grid">
        {ROLE_ORDER.map((roleId) => {
          const role = ROLE_REGISTRY[roleId];
          const count = selectedRoleIds.filter((id) => id === roleId).length;
          const unique = roleId !== 'werewolf' && roleId !== 'villager';
          return (
            <div className="role-editor__item" key={roleId}>
              <span className="role-editor__dot" style={{ backgroundColor: role.visual.badgeColor }} />
              <span className="role-editor__name">{role.name}</span>
              {readOnly ? (
                <strong className="role-editor__count">× {count}</strong>
              ) : (
                <div className="role-editor__stepper">
                  <button
                    type="button"
                    aria-label={`减少${role.name}`}
                    disabled={count <= (roleId === 'werewolf' ? 1 : 0) || selectedRoleIds.length <= 4}
                    onClick={() => onChange?.(roleId, -1)}
                  ><Minus size={12} /></button>
                  <strong>{count}</strong>
                  <button
                    type="button"
                    aria-label={`增加${role.name}`}
                    disabled={(unique && count >= 1) || selectedRoleIds.length >= 12}
                    onClick={() => onChange?.(roleId, 1)}
                  ><Plus size={12} /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
