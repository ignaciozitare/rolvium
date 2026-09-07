import { ADMIN_ROLE_NAME, type AdminPermissionKey, type ModuleId, type ToolPermissionKey, type User } from '@rolvium/shared-types';

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

/**
 * ¿Puede USAR esta capacidad de una herramienta? Hermano de `hasPermission`, y a propósito separado de él:
 * `hasAnyAdminPermission` —quién ve «Administración»— sólo mira `admin`, así que dar un permiso de
 * herramienta no puede abrirle a nadie una sección que no le toca (§ `ToolPermissionKey`).
 *
 * La barrera de verdad es la base (`has_tool(key)` en la RLS); esto sólo esconde los botones.
 */
export function hasTool(user: Subject, tool: ToolPermissionKey): boolean {
  if (!user || !user.active) return false;
  if (isAdmin(user)) return true;
  return user.permissions.tools?.[tool] === true;
}

export function hasModule(user: Subject, moduleId: ModuleId): boolean {
  if (!user || !user.active) return false;
  if (isAdmin(user)) return true;
  return user.permissions.modules.includes(moduleId);
}
