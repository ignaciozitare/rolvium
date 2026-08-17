import type { User } from '@rolvium/shared-types';

/** Reads + RLS-guarded writes on `users` (needs `manage_users`). */
export interface UserPort {
  findAll(): Promise<User[]>;
  updateRole(userId: string, roleId: string): Promise<void>;
  updateActive(userId: string, active: boolean): Promise<void>;
}
