import { useRef, useState } from 'react';
import { ImagePlus, Minus, Plus, Trash2, X } from 'lucide-react';
import {
  createCustomRole,
  isCustomRoleId,
  isUniqueRole,
  ROLE_ORDER,
  ROLE_REGISTRY,
  type RoleDefinition,
} from '../config/roles';
import { MAX_CUSTOM_ROLES } from '../utils/game';
import { compressRoleImage } from '../utils/image';

interface RoleEditorProps {
  selectedRoleIds: string[];
  customRoles?: RoleDefinition[];
  readOnly?: boolean;
  onChange?: (roleId: string, delta: number) => void;
  onAddCustom?: (role: RoleDefinition) => void;
  onRemoveCustom?: (roleId: string) => void;
}

export function RoleEditor({
  selectedRoleIds,
  customRoles = [],
  readOnly = false,
  onChange,
  onAddCustom,
  onRemoveCustom,
}: RoleEditorProps) {
  const [draftName, setDraftName] = useState('');
  const [draftPreview, setDraftPreview] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const roleIds = [...ROLE_ORDER, ...customRoles.map((role) => role.id)];

  const resetForm = () => {
    setDraftName('');
    setDraftPreview(undefined);
    setFormError('');
    setShowForm(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handlePickImage = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setFormError('');
    try {
      setDraftPreview(await compressRoleImage(file));
    } catch (error) {
      setDraftPreview(undefined);
      setFormError(error instanceof Error ? error.message : '图片处理失败。');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleAddCustom = () => {
    const name = draftName.trim();
    if (!name) {
      setFormError('请输入身份名称。');
      return;
    }
    if (customRoles.length >= MAX_CUSTOM_ROLES) {
      setFormError(`最多添加 ${MAX_CUSTOM_ROLES} 个自定义身份。`);
      return;
    }
    if (selectedRoleIds.length >= 12) {
      setFormError('当前支持 4–12 人游戏。');
      return;
    }
    onAddCustom?.(createCustomRole(name, draftPreview));
    resetForm();
  };

  return (
    <div className="role-editor">
      <div className="role-editor__heading">
        <span>身份牌</span>
        <strong>{selectedRoleIds.length} 人局</strong>
      </div>
      <div className="role-editor__grid">
        {roleIds.map((roleId) => {
          const role = ROLE_REGISTRY[roleId] ?? customRoles.find((item) => item.id === roleId);
          if (!role) return null;
          const count = selectedRoleIds.filter((id) => id === roleId).length;
          const unique = isUniqueRole(roleId);
          const custom = isCustomRoleId(roleId);
          return (
            <div className={`role-editor__item ${custom ? 'role-editor__item--custom' : ''}`} key={roleId}>
              {custom && !readOnly && (
                <button
                  type="button"
                  className="role-editor__remove"
                  aria-label={`删除${role.name}`}
                  onClick={() => onRemoveCustom?.(roleId)}
                ><Trash2 size={10} /></button>
              )}
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

      {!readOnly && (
        <div className="role-editor__custom">
          {!showForm ? (
            <button
              type="button"
              className="role-editor__add"
              disabled={customRoles.length >= MAX_CUSTOM_ROLES || selectedRoleIds.length >= 12}
              onClick={() => setShowForm(true)}
            ><Plus size={13} />自定义身份</button>
          ) : (
            <div className="role-editor__form">
              <div className="role-editor__form-row">
                <input
                  value={draftName}
                  maxLength={8}
                  placeholder="身份名称"
                  onChange={(event) => { setDraftName(event.target.value); setFormError(''); }}
                />
                <button
                  type="button"
                  className="role-editor__upload"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  {draftPreview ? <img src={draftPreview} alt="" /> : <ImagePlus size={14} />}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => void handlePickImage(event.target.files?.[0])}
                />
                <button type="button" className="role-editor__confirm" disabled={busy} onClick={handleAddCustom}>添加</button>
                <button type="button" className="role-editor__cancel" aria-label="取消" onClick={resetForm}><X size={14} /></button>
              </div>
              <small>图片仅本局临时使用，会压缩后发给对应玩家</small>
              {formError && <p className="role-editor__form-error">{formError}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
