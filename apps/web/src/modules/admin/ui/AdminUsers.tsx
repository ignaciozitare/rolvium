import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { Btn, DataTable, Modal, UserAvatar, useDialog, type DataTableColumn } from '@rolvium/ui';
import type { Role, User } from '@rolvium/shared-types';
import { isValidEmail } from '@/shared/lib/utils';
import type { RolePort } from '../domain/ports/RolePort';
import type { UserPort } from '../domain/ports/UserPort';
import type { UserAdminPort } from '../domain/ports/UserAdminPort';

interface Props {
  userRepo: UserPort;
  roleRepo: RolePort;
  userAdmin: UserAdminPort;
  currentUserId: string;
}

// ── Add user ─────────────────────────────────────────────────────────────────
function AddUserModal({ roles, existing, userAdmin, onClose, onCreated }: { roles: Role[]; existing: User[]; userAdmin: UserAdminPort; onClose: () => void; onCreated: (u: User) => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(''); const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState(roles.find(r => r.name === 'player')?.id ?? roles[0]?.id ?? '');
  const [pwd, setPwd] = useState(''); const [conf, setConf] = useState('');
  const [er, setEr] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e['name'] = t('admin.errNameRequired');
    if (!email.trim()) e['email'] = t('admin.errEmailRequired');
    else if (!isValidEmail(email)) e['email'] = t('admin.errEmailInvalid');
    else if (existing.some(u => u.email.toLowerCase() === email.trim().toLowerCase())) e['email'] = t('admin.errEmailExists');
    if (pwd.length < 8) e['pwd'] = t('admin.errPasswordShort');
    if (pwd !== conf) e['conf'] = t('admin.errPasswordMatch');
    return e;
  };
  const submit = async () => {
    const e = validate(); setEr(e); if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const u = await userAdmin.createUser({ name: name.trim(), email: email.trim().toLowerCase(), password: pwd, roleId });
      onCreated(u); onClose();
    } catch (err) { setEr({ email: (err as Error).message }); } finally { setBusy(false); }
  };
  return (
    <Modal title={t('admin.addUser')} onClose={onClose} width={480}>
      <div className="rv-field"><label className="rv-label" htmlFor="au-name">{t('admin.fieldName')}</label><input id="au-name" className={`rv-inp ${er['name'] ? 'err' : ''}`} value={name} onChange={e => setName(e.target.value)} autoFocus />{er['name'] && <span className="rv-err">{er['name']}</span>}</div>
      <div className="rv-field"><label className="rv-label" htmlFor="au-email">{t('admin.fieldEmail')}</label><input id="au-email" className={`rv-inp ${er['email'] ? 'err' : ''}`} type="email" value={email} onChange={e => setEmail(e.target.value)} />{er['email'] && <span className="rv-err">{er['email']}</span>}</div>
      <div className="rv-field"><label className="rv-label" htmlFor="au-role">{t('admin.fieldRole')}</label><select id="au-role" className="rv-inp" value={roleId} onChange={e => setRoleId(e.target.value)}>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
      <div className="rv-field"><label className="rv-label" htmlFor="au-pwd">{t('admin.fieldPassword')}</label><input id="au-pwd" className={`rv-inp ${er['pwd'] ? 'err' : ''}`} type="password" autoComplete="new-password" value={pwd} onChange={e => setPwd(e.target.value)} />{er['pwd'] && <span className="rv-err">{er['pwd']}</span>}</div>
      <div className="rv-field"><label className="rv-label" htmlFor="au-conf">{t('admin.fieldConfirm')}</label><input id="au-conf" className={`rv-inp ${er['conf'] ? 'err' : ''}`} type="password" autoComplete="new-password" value={conf} onChange={e => setConf(e.target.value)} />{er['conf'] && <span className="rv-err">{er['conf']}</span>}</div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <Btn variant="ghost" onClick={onClose}>{t('common.cancel')}</Btn>
        <Btn variant="primary" onClick={submit} loading={busy} disabled={busy}>{t('admin.saveUser')}</Btn>
      </div>
    </Modal>
  );
}

// ── Change password ──────────────────────────────────────────────────────────
function PasswordModal({ user, userAdmin, onClose }: { user: User; userAdmin: UserAdminPort; onClose: () => void }) {
  const { t } = useTranslation();
  const [pwd, setPwd] = useState(''); const [conf, setConf] = useState('');
  const [er, setEr] = useState<string | null>(null); const [done, setDone] = useState(false);
  const submit = async () => {
    if (pwd.length < 8) return setEr(t('admin.errPasswordShort'));
    if (pwd !== conf) return setEr(t('admin.errPasswordMatch'));
    try { await userAdmin.setPassword(user.id, pwd); setDone(true); setTimeout(onClose, 700); }
    catch (e) { setEr((e as Error).message); }
  };
  return (
    <Modal title={t('admin.changePassword')} onClose={onClose} width={420}>
      {done ? <div style={{ color: 'var(--green)' }}>{t('admin.passwordChanged')}</div> : (
        <>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--tx2)', marginBottom: 14 }}>{user.name} · <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-2xs)' }}>{user.email}</span></div>
          <div className="rv-field"><label className="rv-label" htmlFor="pw-new">{t('admin.newPassword')}</label><input id="pw-new" className="rv-inp" type="password" autoComplete="new-password" value={pwd} onChange={e => setPwd(e.target.value)} autoFocus /></div>
          <div className="rv-field"><label className="rv-label" htmlFor="pw-conf">{t('admin.fieldConfirm')}</label><input id="pw-conf" className="rv-inp" type="password" autoComplete="new-password" value={conf} onChange={e => setConf(e.target.value)} /></div>
          {er && <div className="rv-err" role="alert">{er}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Btn variant="ghost" onClick={onClose}>{t('common.cancel')}</Btn>
            <Btn variant="primary" onClick={submit}>{t('common.save')}</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}

// ── Users table ──────────────────────────────────────────────────────────────
export function AdminUsers({ userRepo, roleRepo, userAdmin, currentUserId }: Props): JSX.Element {
  const { t } = useTranslation();
  const dialog = useDialog();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [modal, setModal] = useState<{ type: 'add' } | { type: 'pwd'; user: User } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([userRepo.findAll(), roleRepo.findAll()]).then(([u, r]) => { setUsers(u); setRoles(r); }).catch(e => setErr(String(e.message ?? e)));
  }, [userRepo, roleRepo]);

  const changeRole = async (u: User, roleId: string) => {
    const role = roles.find(r => r.id === roleId); if (!role) return;
    setUsers(us => us.map(x => x.id === u.id ? { ...x, roleId, role: role.name, permissions: role.permissions } : x));
    try { await userRepo.updateRole(u.id, roleId); } catch (e) { setErr((e as Error).message); }
  };
  const toggleActive = async (u: User) => {
    setUsers(us => us.map(x => x.id === u.id ? { ...x, active: !x.active } : x));
    try { await userRepo.updateActive(u.id, !u.active); } catch (e) { setErr((e as Error).message); }
  };
  const remove = async (u: User) => {
    if (!(await dialog.confirm(`${t('common.delete')} ${u.name}?`, { danger: true }))) return;
    try { await userAdmin.deleteUser(u.id); setUsers(us => us.filter(x => x.id !== u.id)); } catch (e) { setErr((e as Error).message); }
  };

  const columns = useMemo<DataTableColumn[]>(() => [
    { id: 'user', header: t('admin.colUser'), minWidth: 200, render: (row) => { const u = row as unknown as User; return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <UserAvatar user={{ id: u.id, name: u.name, email: u.email, avatarUrl: u.avatarUrl }} size={26} />
        <span style={{ fontWeight: 500 }}>{u.name}</span>
        {u.id === currentUserId && <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--tx3)' }}>({t('common.you')})</span>}
      </div>); } },
    { id: 'email', header: t('admin.colEmail'), minWidth: 180, render: (row) => <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-2xs)', color: 'var(--tx3)' }}>{(row as unknown as User).email}</span> },
    { id: 'role', header: t('admin.colRole'), minWidth: 150, render: (row) => { const u = row as unknown as User; return (
      <select className="rv-inp" aria-label={`${t('admin.colRole')} ${u.name}`} style={{ padding: '4px 8px', width: 'auto' }} value={u.roleId} onChange={e => void changeRole(u, e.target.value)}>
        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>); } },
    { id: 'access', header: t('admin.colAccess'), minWidth: 100, render: (row) => { const u = row as unknown as User; return <span className={`rv-chip ${u.active ? 'ok' : 'bad'}`}>{u.active ? t('admin.statusActive') : t('admin.statusBlocked')}</span>; } },
    { id: 'actions', header: t('admin.colActions'), minWidth: 240, render: (row) => { const u = row as unknown as User; return (
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <button type="button" className="rv-row-btn" onClick={() => setModal({ type: 'pwd', user: u })}>{t('admin.changePassword')}</button>
        {u.id !== currentUserId && <button type="button" className={`rv-row-btn ${u.active ? 'danger' : ''}`} onClick={() => void toggleActive(u)}>{u.active ? t('admin.blockUser') : t('admin.unblockUser')}</button>}
        {u.id !== currentUserId && <button type="button" className="rv-row-btn danger" onClick={() => void remove(u)}>{t('common.delete')}</button>}
      </div>); } },
  ], [roles, currentUserId, t]);

  return (
    <div>
      <div className="rv-page-title">{t('admin.usersTitle')}</div>
      <div className="rv-page-sub">{t('admin.usersSubtitle', { count: String(users.length) })}</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <Btn variant="primary" onClick={() => setModal({ type: 'add' })}>{t('admin.addUser')}</Btn>
      </div>
      {err && <div className="rv-err" role="alert" style={{ marginBottom: 10 }}>{err}</div>}
      <div style={{ background: 'var(--sf)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
        <DataTable columns={columns} rows={users as unknown as Record<string, unknown>[]} getRowKey={(r) => String(r['id'])} testIdPrefix="admin-users" />
      </div>
      {modal?.type === 'add' && <AddUserModal roles={roles} existing={users} userAdmin={userAdmin} onClose={() => setModal(null)} onCreated={u => setUsers(us => [...us, u])} />}
      {modal?.type === 'pwd' && <PasswordModal user={modal.user} userAdmin={userAdmin} onClose={() => setModal(null)} />}
    </div>
  );
}
