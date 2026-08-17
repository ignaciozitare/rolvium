import type { Role, RolePermissions } from '@rolvium/shared-types';

export interface RolePort {
  findAll(): Promise<Role[]>;
  create(input: { name: string; description: string }): Promise<Role>;
  remove(id: string): Promise<void>;
  updatePermissions(id: string, permissions: RolePermissions): Promise<void>;
  updateDescription(id: string, description: string): Promise<void>;
}
