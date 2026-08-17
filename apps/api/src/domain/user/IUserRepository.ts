import type { RolePermissions } from '@rolvium/shared-types';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  roleId: string;
  role: string;
  permissions: RolePermissions;
  active: boolean;
  createdAt: string;
}

export interface IUserRepository {
  findById(id: string): Promise<UserProfile | null>;
  findByEmail(email: string): Promise<UserProfile | null>;
}
