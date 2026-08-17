import { useEffect, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { Btn, DualPanelPicker, useDialog } from '@rolvium/ui';
import { ADMIN_ROLE_NAME, type Role, type RolePermissions } from '@rolvium/shared-types';
import { ADMIN_PERMISSIONS, GRANTABLE_MODULES } from '@/shared/modules/registry';
import { slugifyRoleName } from '@/shared/lib/utils';
import type { RolePort } from '../domain/ports/RolePort';

interface Props { roleRepo: RolePort; readOnly?: boolean }

export function AdminRoles({ roleRepo, readOnly = false }: Props): JSX.Element {
  const { t } = useTranslation();
  const dialog = useDialog();
  const [roles, setRoles] = useState<Role[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { roleRepo.findAll().then(setRoles).catch(e => setMsg(String(e.message ?? e))); }, [roleRepo]);

  const sel = roles.find(r => r.id === selId) ?? null;
  const locked = readOnly || sel?.name === ADMIN_ROLE_NAME;

  const createRole = async () => {
    const label = newName.trim();
    const name = slugifyRoleName(label);
    if (!name) return;
    try {
      const r = await roleRepo.create({ name, description: label });
      setRoles(rs => [...rs, r]); setSelId(r.id); setNewName(''); setMsg(null);
    } catch (e) { setMsg((e as Error).message ?? 'Error'); }
  };

  const deleteRole = async (id: string) => {
    if (!(await dialog.confirm(t('admin.deleteRoleConfirm'), { danger: true }))) return;
    try {
      await roleRepo.remove(id);
      setRoles(rs => rs.filter(r => r.id !== id));
      if (selId === id) setSelId(null);
    } catch (e) { setMsg((e as Error).message ?? 'Error'); }
  };

  const savePerms = async (next: RolePermissions) => {
    if (!sel || locked) return;
    setRoles(rs => rs.map(r => r.id === sel.id ? { ...r, permissions: next } : r));
    try { await roleRepo.updatePermissions(sel.id, next); } catch (e) { setMsg((e as Error).message ?? 'Error'); }
  };
  const toggleModule = (id: string) => sel && savePerms({ ...sel.permissions, modules: sel.permissions.modules.includes(id) ? sel.permissions.modules.filter(m => m !== id) : [...sel.permissions.modules, id] });
  const togglePerm = (id: string) => sel && savePerms({ ...sel.permissions, admin: { ...sel.permissions.admin, [id]: !sel.permissions.admin[id as keyof typeof sel.permissions.admin] } });

  const saveDescription = async (description: string) => {
    if (!sel || locked) return;
    setRoles(rs => rs.map(r => r.id === sel.id ? { ...r, description } : r));
    try { await roleRepo.updateDescription(sel.id, description); } catch (e) { setMsg((e as Error).message ?? 'Error'); }
  };

  const selectedPerms = ADMIN_PERMISSIONS.filter(p => sel?.permissions.admin[p.id]).map(p => p.id);

  return (
    <div style={{ display: 'flex', gap: 20, height: '100%', minHeight: 0 }}>
      <aside style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {!readOnly && (
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="rv-inp" aria-label={t('admin.newRolePlaceholder')} placeholder={t('admin.newRolePlaceholder')} value={newName}
              onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void createRole(); }} />
            <Btn variant="primary" size="sm" onClick={createRole} aria-label={t('common.add')}>+</Btn>
          </div>
        )}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {roles.map(r => (
            <div key={r.id} role="button" tabIndex={0} className={`rv-list-item ${selId === r.id ? 'active' : ''}`}
              onClick={() => setSelId(r.id)} onKeyDown={e => { if (e.key === 'Enter') setSelId(r.id); }} data-testid={`role-${r.name}`}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: selId === r.id ? 'var(--ac2)' : 'var(--tx)' }}>
                  {r.name} {r.isSystem && <span className="rv-chip" style={{ marginLeft: 6 }}>{t('admin.systemRole')}</span>}
                </div>
                {r.description && <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</div>}
              </div>
              {!r.isSystem && !readOnly && (
                <button type="button" className="rv-row-btn danger" aria-label={`${t('common.delete')} ${r.name}`} onClick={e => { e.stopPropagation(); void deleteRole(r.id); }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>close</span>
                </button>
              )}
            </div>
          ))}
        </div>
        {msg && <div className="rv-err" role="alert">{msg}</div>}
      </aside>

      {sel ? (
        <section style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>
          <div>
            <div style={{ fontFamily: 'var(--display)', fontSize: 'var(--fs-lg)', color: 'var(--tx)', marginBottom: 6 }}>{sel.name}</div>
            <input className="rv-inp" key={sel.id} defaultValue={sel.description} disabled={locked}
              aria-label={t('admin.roleDescription')} placeholder={t('admin.roleDescription')}
              onBlur={e => void saveDescription(e.target.value)} style={{ maxWidth: 420 }} />
          </div>
          <DualPanelPicker
            label={t('admin.modulesPicker')}
            allItems={GRANTABLE_MODULES.map(m => ({ value: m.id, label: t(m.labelKey) }))}
            selected={sel.permissions.modules}
            onAdd={v => { if (!locked) toggleModule(v); }}
            onRemove={v => { if (!locked) toggleModule(v); }}
          />
          <DualPanelPicker
            label={t('admin.permsPicker')}
            allItems={ADMIN_PERMISSIONS.map(p => ({ value: p.id, label: t(p.labelKey), hint: t(p.descKey) }))}
            selected={selectedPerms}
            onAdd={v => { if (!locked) togglePerm(v); }}
            onRemove={v => { if (!locked) togglePerm(v); }}
            fillHeight
            labelColumnWidth={200}
          />
          {sel.name === ADMIN_ROLE_NAME && (
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--tx3)', padding: '8px 12px', background: 'var(--sf2)', borderRadius: 'var(--r)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>lock</span>{t('admin.adminLocked')}
            </div>
          )}
        </section>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)', fontSize: 'var(--fs-sm)' }}>{t('admin.selectRole')}</div>
      )}
    </div>
  );
}
