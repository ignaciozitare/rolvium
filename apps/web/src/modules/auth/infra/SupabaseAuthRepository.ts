import type { SupabaseClient } from '@supabase/supabase-js';
import { EMPTY_PERMISSIONS, type RolePermissions, type User } from '@rolvium/shared-types';
import type { IAuthRepository, SignInResult } from '../domain/ports/IAuthRepository';

interface ProfileRow {
  id: string; name: string; email: string; avatar_url: string | null; role_id: string; active: boolean; created_at: string;
  roles: { name: string; permissions: RolePermissions } | { name: string; permissions: RolePermissions }[] | null;
}

const PROFILE_SELECT = 'id, name, email, avatar_url, role_id, active, created_at, roles ( name, permissions )';

export function mapProfileRow(row: ProfileRow): User {
  const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url,
    roleId: row.role_id,
    role: role?.name ?? '',
    permissions: role?.permissions ?? EMPTY_PERMISSIONS,
    active: row.active,
    createdAt: row.created_at,
  };
}

export class SupabaseAuthRepository implements IAuthRepository {
  constructor(private readonly db: SupabaseClient) {}

  async signInWithPassword(email: string, password: string): Promise<SignInResult> {
    const { error } = await this.db.auth.signInWithPassword({ email, password });
    if (error) {
      return { user: null, error: /invalid/i.test(error.message) ? 'invalid_credentials' : 'unknown' };
    }
    const user = await this.getCurrentUser();
    if (!user) return { user: null, error: 'unknown' };
    if (!user.active) {
      await this.db.auth.signOut();
      return { user: null, error: 'account_disabled' };
    }
    return { user };
  }

  async signOut(): Promise<void> {
    await this.db.auth.signOut();
  }

  async getCurrentUser(): Promise<User | null> {
    const { data: { session } } = await this.db.auth.getSession();
    if (!session) return null;
    const { data, error } = await this.db.from('users').select(PROFILE_SELECT).eq('id', session.user.id).maybeSingle();
    if (error || !data) return null;
    return mapProfileRow(data as unknown as ProfileRow);
  }

  onAuthStateChange(cb: (signedIn: boolean) => void): () => void {
    const { data } = this.db.auth.onAuthStateChange((_event, session) => cb(!!session));
    return () => data.subscription.unsubscribe();
  }
}
