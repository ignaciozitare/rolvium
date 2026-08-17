import type { AdminPermissionKey, ModuleId } from '@rolvium/shared-types';

/**
 * Registry of product modules. A module here = a sidebar entry + a value a
 * role can be granted in `roles.permissions.modules`. Adding a module:
 *   1. add it here (id, i18n label key, icon, path)
 *   2. add the route in AppRouter + a `modules/{id}` folder (Scaffold agent)
 *   3. RLS for its tables uses `public.has_module('{id}')`
 * `home` is always visible and needs no grant.
 */
export interface ModuleDef {
  id: ModuleId;
  labelKey: string;   // i18n key
  icon: string;       // Material Symbols name
  path: string;
  /** Always visible; not grantable. */
  core?: boolean;
}

export const MODULES: ModuleDef[] = [
  { id: 'home', labelKey: 'modules.home', icon: 'castle', path: '/home', core: true },
  // Future RPG modules go here, e.g.:
  // { id: 'campaigns',  labelKey: 'modules.campaigns',  icon: 'auto_stories', path: '/campaigns' },
  // { id: 'characters', labelKey: 'modules.characters', icon: 'person_play',  path: '/characters' },
];

/** Modules a role can be granted (excludes core ones). */
export const GRANTABLE_MODULES = MODULES.filter(m => !m.core);

/** Admin permission keys, with i18n keys for label + description. */
export const ADMIN_PERMISSIONS: { id: AdminPermissionKey; labelKey: string; descKey: string }[] = [
  { id: 'manage_users',    labelKey: 'admin.perm.manage_users',    descKey: 'admin.perm.manage_users_desc' },
  { id: 'manage_roles',    labelKey: 'admin.perm.manage_roles',    descKey: 'admin.perm.manage_roles_desc' },
  { id: 'manage_settings', labelKey: 'admin.perm.manage_settings', descKey: 'admin.perm.manage_settings_desc' },
];
