import type { SupabaseClient } from '@supabase/supabase-js';
import type { IUserAdmin, CreateUserInput, CreatedUser } from '../../domain/user/IUserAdmin.js';

/**
 * Uses the Supabase Admin API (service role). The `on_auth_user_created`
 * trigger creates the `public.users` profile from `user_metadata.name` and
 * `user_metadata.role_id`.
 */
export class SupabaseUserAdmin implements IUserAdmin {
  constructor(private readonly db: SupabaseClient) {}

  async createUser(input: CreateUserInput): Promise<CreatedUser> {
    const { data, error } = await this.db.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { name: input.name, role_id: input.roleId },
    });
    if (error || !data.user) {
      throw Object.assign(new Error(error?.message ?? 'Could not create user'), { statusCode: 400, code: 'CREATE_USER_FAILED' });
    }
    return { id: data.user.id, email: data.user.email ?? input.email };
  }

  async setPassword(userId: string, password: string): Promise<void> {
    const { error } = await this.db.auth.admin.updateUserById(userId, { password });
    if (error) throw Object.assign(new Error(error.message), { statusCode: 400, code: 'SET_PASSWORD_FAILED' });
  }

  async deleteUser(userId: string): Promise<void> {
    const { error } = await this.db.auth.admin.deleteUser(userId);
    if (error) throw Object.assign(new Error(error.message), { statusCode: 400, code: 'DELETE_USER_FAILED' });
  }
}
