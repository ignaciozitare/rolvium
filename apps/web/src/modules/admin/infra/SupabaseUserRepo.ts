import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@rolvium/shared-types';
import type { UserPort } from '../domain/ports/UserPort';
import { mapProfileRow } from '@/modules/auth/infra/SupabaseAuthRepository';

const SELECT = 'id, name, email, avatar_url, alias, locale, theme_pref, role_id, active, created_at, roles ( name, permissions )';

export class SupabaseUserRepo implements UserPort {
  constructor(private readonly db: SupabaseClient) {}

  async findAll(): Promise<User[]> {
    const { data, error } = await this.db.from('users').select(SELECT).order('name');
    if (error) throw error;
    return ((data ?? []) as unknown as Parameters<typeof mapProfileRow>[0][]).map(mapProfileRow);
  }

  async updateRole(userId: string, roleId: string): Promise<void> {
    const { error } = await this.db.from('users').update({ role_id: roleId }).eq('id', userId);
    if (error) throw error;
  }

  async updateActive(userId: string, active: boolean): Promise<void> {
    const { error } = await this.db.from('users').update({ active }).eq('id', userId);
    if (error) throw error;
  }
}
