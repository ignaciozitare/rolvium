// ─── @rolvium/shared-types ────────────────────────────────────────────────────
// Types shared by apps/web and apps/api. No runtime code, no framework imports.

// ─── Modules ─────────────────────────────────────────────────────────────────
/**
 * A module is a product area a role can be granted access to (it shows up in
 * the sidebar). The registry of modules lives in the web app
 * (`apps/web/src/shared/modules/registry.ts`); this is only the identifier.
 */
export type ModuleId = string;

// ─── Permissions ─────────────────────────────────────────────────────────────
/**
 * Admin permission keys. Each one gates a capability, checked BOTH in the UI
 * (to hide controls) and in the DB via RLS `has_permission(key)` (to actually
 * deny). Add new keys here AND in `roles.permissions.admin` seeds/registry.
 */
export type AdminPermissionKey =
  | 'manage_users'
  | 'manage_roles'
  | 'manage_settings';

export interface RolePermissions {
  /** Modules the role can see/use. */
  modules: ModuleId[];
  /** Admin capabilities. Missing key === false. */
  admin: Partial<Record<AdminPermissionKey, boolean>>;
}

export const EMPTY_PERMISSIONS: RolePermissions = { modules: [], admin: {} };

// ─── Role ────────────────────────────────────────────────────────────────────
export interface Role {
  id: string;
  /** Machine name, unique, snake_case: 'admin' | 'game_master' | 'player' | custom. */
  name: string;
  description: string;
  /** System roles cannot be deleted; 'admin' cannot be edited either. */
  isSystem: boolean;
  permissions: RolePermissions;
  createdAt: string;
}

/** The one role that bypasses every permission check. */
export const ADMIN_ROLE_NAME = 'admin';

// ─── User ────────────────────────────────────────────────────────────────────
export type ThemePref = 'dark' | 'light' | 'system';

export interface User {
  id: string;
  name: string;
  email: string;
  /** Photo URL or `preset:NAME`; null → initials avatar. */
  avatarUrl: string | null;
  /** Name shown at the tables; falls back to `name` when empty. */
  alias: string | null;
  /** UI locale saved in the profile ('es' | 'en'). */
  locale: string;
  /** Platform theme preference; inside a table the game system's theme wins. */
  themePref: ThemePref;
  roleId: string;
  /** Denormalised role name — convenience for the UI (`user.role === 'admin'`). */
  role: string;
  /** Resolved permissions of the user's role. */
  permissions: RolePermissions;
  active: boolean;
  createdAt: string;
}

// ─── API envelope ────────────────────────────────────────────────────────────
export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { code: string; message: string } };
export type ApiResponse<T> = ApiOk<T> | ApiErr;
