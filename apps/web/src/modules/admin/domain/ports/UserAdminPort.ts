import type { User } from '@rolvium/shared-types';

/** Privileged operations that go through the API (service role). */
export interface UserAdminPort {
  createUser(input: { name: string; email: string; password: string; roleId: string }): Promise<User>;
  setPassword(userId: string, password: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
}
