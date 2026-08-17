import { ADMIN_ROLE_NAME, type AdminPermissionKey, type ModuleId, type User } from '@rolvium/shared-types';

type Subject = Pick<User, 'role' | 'permissions' | 'active'> | null | undefined;

/** Admin bypasses everything; inactive users have nothing. */
export function isAdmin(user: Subject): boolean {
  return !!user && user.active && user.role === ADMIN_ROLE_NAME;
}

export function hasPermission(user: Subject, perm: AdminPermissionKey): boolean {
  if (!user || !user.active) return false;
  if (isAdmin(user)) return true;
  return user.permissions.admin[perm] === true;
}

export function hasAnyAdminPermission(user: Subject): boolean {
  if (!user || !user.active) return false;
  if (isAdmin(user)) return true;
  return Object.values(user.permissions.admin).some(Boolean);
}

export function hasModule(user: Subject, moduleId: ModuleId): boolean {
  if (!user || !user.active) return false;
  if (isAdmin(user)) return true;
  return user.permissions.modules.includes(moduleId);
}
