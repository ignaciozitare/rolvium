import type { SupabaseClient } from '@supabase/supabase-js';
import type { IdentityPort } from '../domain/ports/IdentityPort';
import type { DeviceSession, ProfileUpdate, SignUpInput, SignUpResult } from '../domain/entities/Identity';

const AVATAR_BUCKET = 'avatars';

interface SessionRow { id: string; user_agent: string | null; ip: string | null; created_at: string; last_seen_at: string; is_current: boolean }

export class SupabaseIdentityRepo implements IdentityPort {
  constructor(private readonly db: SupabaseClient) {}

  async signUp(input: SignUpInput): Promise<SignUpResult> {
    const { data, error } = await this.db.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: { data: { name: input.name.trim(), alias: input.name.trim(), locale: input.locale }, ...(input.redirectTo ? { emailRedirectTo: input.redirectTo } : {}) },
    });
    if (error) {
      const m = error.message.toLowerCase();
      if (/already|registered|exists/.test(m)) return { error: 'email_taken' };
      if (/password/.test(m)) return { error: 'weak_password' };
      if (/email/.test(m)) return { error: 'invalid_email' };
      return { error: 'unknown' };
    }
    // Supabase returns an empty identities array for an existing e-mail when confirmations are on.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) return { error: 'email_taken' };
    return { status: data.session ? 'signed_in' : 'confirm_email' };
  }

  async requestPasswordReset(email: string, redirectTo: string): Promise<void> {
    // Errors are swallowed on purpose: the UI shows the same message whether or not the address exists.
    await this.db.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  }

  async updatePassword(newPassword: string): Promise<{ error?: 'weak_password' | 'unknown' }> {
    const { error } = await this.db.auth.updateUser({ password: newPassword });
    if (!error) return {};
    return { error: /password/i.test(error.message) ? 'weak_password' : 'unknown' };
  }

  async updateProfile(userId: string, patch: ProfileUpdate): Promise<void> {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row['name'] = patch.name.trim();
    if (patch.alias !== undefined) row['alias'] = patch.alias;
    if (patch.locale !== undefined) row['locale'] = patch.locale;
    if (patch.themePref !== undefined) row['theme_pref'] = patch.themePref;
    if (Object.keys(row).length === 0) return;
    const { error } = await this.db.from('users').update(row).eq('id', userId);
    if (error) throw new Error(error.message);
  }

  async uploadAvatar(userId: string, file: Blob): Promise<string> {
    const path = `${userId}/avatar.png`;
    const { error } = await this.db.storage.from(AVATAR_BUCKET).upload(path, file, { upsert: true, contentType: file.type || 'image/png', cacheControl: '3600' });
    if (error) throw new Error(error.message);
    const { data } = this.db.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    const url = `${data.publicUrl}?v=${Date.now()}`;
    const { error: e2 } = await this.db.from('users').update({ avatar_url: url }).eq('id', userId);
    if (e2) throw new Error(e2.message);
    return url;
  }

  async removeAvatar(userId: string): Promise<void> {
    await this.db.storage.from(AVATAR_BUCKET).remove([`${userId}/avatar.png`]);
    const { error } = await this.db.from('users').update({ avatar_url: null }).eq('id', userId);
    if (error) throw new Error(error.message);
  }

  async listSessions(): Promise<DeviceSession[]> {
    const { data, error } = await this.db.rpc('identity_my_sessions');
    if (error) throw new Error(error.message);
    return ((data ?? []) as SessionRow[]).map(r => ({ id: r.id, userAgent: r.user_agent, ip: r.ip, createdAt: r.created_at, lastSeenAt: r.last_seen_at, isCurrent: r.is_current }));
  }

  async revokeSession(sessionId: string): Promise<void> {
    const { error } = await this.db.rpc('identity_revoke_session', { sid: sessionId });
    if (error) throw new Error(error.message);
  }
}
