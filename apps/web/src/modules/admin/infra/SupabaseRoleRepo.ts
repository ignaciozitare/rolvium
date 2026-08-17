import type { SupabaseClient } from '@supabase/supabase-js';
import { EMPTY_PERMISSIONS, type Role, type RolePermissions } from '@rolvium/shared-types';
import type { RolePort } from '../domain/ports/RolePort';

interface RoleRow { id: string; name: string; description: string; is_system: boolean; permissions: RolePermissions | null; created_at: string }

export const mapRoleRow = (r: RoleRow): Role => ({
  id: r.id, name: r.name, description: r.description ?? '', isSystem: r.is_system,
  permissions: { modules: r.permissions?.modules ?? [], admin: r.permissions?.admin ?? {} },
  createdAt: r.created_at,
});

export class SupabaseRoleRepo implements RolePort {
  constructor(private readonly db: SupabaseClient) {}

  async findAll(): Promise<Role[]> {
    const { data, error } = await this.db.from('roles').select('*').order('created_at');
    if (error) throw error;
    return ((data ?? []) as RoleRow[]).map(mapRoleRow);
  }

  async create(input: { name: string; description: string }): Promise<Role> {
    const { data, error } = await this.db.from('roles').insert({ ...input, permissions: EMPTY_PERMISSIONS }).select('*').single();
    if (error) throw error;
    return mapRoleRow(data as RoleRow);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.db.from('roles').delete().eq('id', id);
    if (error) throw error;
  }

  async updatePermissions(id: string, permissions: RolePermissions): Promise<void> {
    const { error } = await this.db.from('roles').update({ permissions }).eq('id', id);
    if (error) throw error;
  }

  async updateDescription(id: string, description: string): Promise<void> {
    const { error } = await this.db.from('roles').update({ description }).eq('id', id);
    if (error) throw error;
  }
}
