import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseMock } from '../../../../tests/helpers/supabaseMock';
import { SupabaseIdentityRepo } from './SupabaseIdentityRepo';

function makeClient(over: Record<string, unknown> = {}) {
  const m = createSupabaseMock({ tables: { users: { data: null, error: null } } });
  const auth = m.client.auth as Record<string, unknown>;
  auth['signUp'] = vi.fn().mockResolvedValue({ data: { user: { id: 'u1', identities: [{}] }, session: { access_token: 't' } }, error: null });
  auth['resetPasswordForEmail'] = vi.fn().mockResolvedValue({ data: {}, error: null });
  auth['updateUser'] = vi.fn().mockResolvedValue({ data: {}, error: null });
  const storageOps = { upload: vi.fn().mockResolvedValue({ data: { path: 'u1/avatar.png' }, error: null }), remove: vi.fn().mockResolvedValue({ data: null, error: null }), getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'http://x/storage/v1/object/public/avatars/u1/avatar.png' } })) };
  (m.client as Record<string, unknown>)['storage'] = { from: vi.fn(() => storageOps) };
  Object.assign(m.client, over);
  return { m, auth, storageOps, repo: new SupabaseIdentityRepo(m.client as unknown as SupabaseClient) };
}

describe('SupabaseIdentityRepo', () => {
  it('signUp passes name/alias/locale as metadata and reports signed_in with a session', async () => {
    const { repo, auth } = makeClient();
    const r = await repo.signUp({ email: ' m@x.co ', password: 'secret123', name: ' Marta ', locale: 'en', redirectTo: 'http://app/join/LUNA-4F7K' });
    expect(r).toEqual({ status: 'signed_in' });
    expect(auth['signUp']).toHaveBeenCalledWith({ email: 'm@x.co', password: 'secret123', options: { data: { name: 'Marta', alias: 'Marta', locale: 'en' }, emailRedirectTo: 'http://app/join/LUNA-4F7K' } });
  });
  it('signUp maps confirm_email, email_taken (message and empty identities) and weak_password', async () => {
    const { repo, auth } = makeClient();
    (auth['signUp'] as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { user: { identities: [{}] }, session: null }, error: null });
    expect(await repo.signUp({ email: 'a@b.co', password: 'secret123', name: 'A', locale: 'es' })).toEqual({ status: 'confirm_email' });
    (auth['signUp'] as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { user: null, session: null }, error: { message: 'User already registered' } });
    expect(await repo.signUp({ email: 'a@b.co', password: 'secret123', name: 'A', locale: 'es' })).toEqual({ error: 'email_taken' });
    (auth['signUp'] as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { user: { identities: [] }, session: null }, error: null });
    expect(await repo.signUp({ email: 'a@b.co', password: 'secret123', name: 'A', locale: 'es' })).toEqual({ error: 'email_taken' });
    (auth['signUp'] as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { user: null, session: null }, error: { message: 'Password should be at least 6 characters' } });
    expect(await repo.signUp({ email: 'a@b.co', password: 'x', name: 'A', locale: 'es' })).toEqual({ error: 'weak_password' });
  });
  it('requestPasswordReset forwards redirectTo and never throws', async () => {
    const { repo, auth } = makeClient();
    (auth['resetPasswordForEmail'] as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: null, error: { message: 'rate limit' } });
    await expect(repo.requestPasswordReset('a@b.co', 'http://app/reset')).resolves.toBeUndefined();
    expect(auth['resetPasswordForEmail']).toHaveBeenCalledWith('a@b.co', { redirectTo: 'http://app/reset' });
  });
  it('updatePassword maps errors', async () => {
    const { repo, auth } = makeClient();
    expect(await repo.updatePassword('newsecret1')).toEqual({});
    (auth['updateUser'] as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: null, error: { message: 'Password is too weak' } });
    expect(await repo.updatePassword('x')).toEqual({ error: 'weak_password' });
  });
  it('updateProfile writes only the given columns to users', async () => {
    const { repo, m } = makeClient();
    await repo.updateProfile('u1', { name: ' Ada ', alias: null, locale: 'en', themePref: 'light' });
    expect(m.fromSpy).toHaveBeenCalledWith('users');
    expect(m.updateSpy).toHaveBeenCalledWith({ name: 'Ada', alias: null, locale: 'en', theme_pref: 'light' });
    m.updateSpy.mockClear();
    await repo.updateProfile('u1', {});
    expect(m.updateSpy).not.toHaveBeenCalled();
  });
  it('uploadAvatar upserts to avatars/{uid}/avatar.png, stores a cache-busted public url', async () => {
    const { repo, m, storageOps } = makeClient();
    const url = await repo.uploadAvatar('u1', new Blob(['x'], { type: 'image/png' }));
    expect(storageOps.upload).toHaveBeenCalledWith('u1/avatar.png', expect.any(Blob), expect.objectContaining({ upsert: true, contentType: 'image/png' }));
    expect(url).toMatch(/avatars\/u1\/avatar\.png\?v=\d+/);
    expect(m.updateSpy).toHaveBeenCalledWith({ avatar_url: url });
  });
  it('removeAvatar deletes the object and nulls avatar_url', async () => {
    const { repo, m, storageOps } = makeClient();
    await repo.removeAvatar('u1');
    expect(storageOps.remove).toHaveBeenCalledWith(['u1/avatar.png']);
    expect(m.updateSpy).toHaveBeenCalledWith({ avatar_url: null });
  });
  it('listSessions / revokeSession go through the identity RPCs', async () => {
    const { repo, m } = makeClient();
    (m.client.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: [{ id: 's1', user_agent: 'UA', ip: '1.1.1.1', created_at: 'c', last_seen_at: 'l', is_current: true }], error: null });
    expect(await repo.listSessions()).toEqual([{ id: 's1', userAgent: 'UA', ip: '1.1.1.1', createdAt: 'c', lastSeenAt: 'l', isCurrent: true }]);
    await repo.revokeSession('s1');
    expect(m.client.rpc).toHaveBeenCalledWith('identity_revoke_session', { sid: 's1' });
    (m.client.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    await expect(repo.listSessions()).rejects.toThrow('boom');
  });
});
