import type { SupabaseClient } from '@supabase/supabase-js';
import { EMPTY_PERMISSIONS, type RolePermissions } from '@rolvium/shared-types';
import type { IUserRepository, UserProfile } from '../../domain/user/IUserRepository.js';

interface UserRow {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role_id: string;
  active: boolean;
  created_at: string;
  roles: { name: string; permissions: RolePermissions } | { name: string; permissions: RolePermissions }[] | null;
}

const SELECT = 'id, name, email, avatar_url, role_id, active, created_at, roles ( name, permissions )';

export function mapUserRow(row: UserRow): UserProfile {
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

export class SupabaseUserRepo implements IUserRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findById(id: string): Promise<UserProfile | null> {
    const { data, error } = await this.db.from('users').select(SELECT).eq('id', id).maybeSingle();
    if (error || !data) return null;
    return mapUserRow(data as unknown as UserRow);
  }

  async findByEmail(email: string): Promise<UserProfile | null> {
    const { data, error } = await this.db.from('users').select(SELECT).ilike('email', email).maybeSingle();
    if (error || !data) return null;
    return mapUserRow(data as unknown as UserRow);
  }
}
