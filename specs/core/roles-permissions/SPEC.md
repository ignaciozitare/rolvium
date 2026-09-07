# Roles & permissions — SPEC

## Purpose
Control who sees which modules and who can administer the platform, without hardcoding
role names in features. Who: admins (and anyone granted `manage_roles`).

## Model
- A **role** has a name, description, `is_system` flag and `permissions`, in **three separate buckets**:
  - `modules: string[]` — module ids the role can open (registry: `apps/web/src/shared/modules/registry.ts`).
  - `admin: { manage_users?, manage_roles?, manage_settings? }` — administer the platform. **These, and only
    these, decide who sees the Administración section.**
  - `tools?: { manage_textures? }` — use a capability **inside** a tool. Optional: rows predating the bucket
    lack it, and the `admin` role cannot be given one (`roles_guard_system` forbids editing its permissions),
    so a missing key means «none». Registry: `TOOL_PERMISSIONS`; checked with `hasTool()` / `has_tool(key)`.
- Every user has exactly one role. System roles: `admin` (locked, full access), `game_master`, `player` (default).
- Custom roles can be created/edited/deleted; system roles cannot be deleted or renamed; `admin` cannot be edited.

## Admin area (`/admin?mod=settings|users|roles`)
- Visible only to users with at least one admin permission (else redirect `/home`); each section requires its permission.
- **Users**: list (name, email, role selector, active chip), add user (name/email/role/password, validated), change password,
  block/unblock (not yourself), delete (not yourself). Create/password/delete go through the API (`/admin/*`).
- **Roles**: create (label slugified to `snake_case` name), select, edit description, dual-panel pickers for modules and permissions, delete custom.
- **Settings**: placeholder.
- The **Roles** section has three pickers: modules, admin permissions, and **«Permisos de Rolvium»** (tool
  permissions — one item per capability, so a new tool can be handed to a role without touching the screen).

## Rules & limits
- Security boundary is the DB (RLS with `is_admin()`, `has_permission()`, `has_module()`, `has_tool()`) and the API (`authorize.ts`). The UI only hides.
- 🔒 **A tool permission must NEVER live in the `admin` bucket.** Who sees Administración is decided by
  `hasAnyAdminPermission`, which returns true for *any* truthy value inside `admin` — it is used by the top
  nav, the user menu and `AdminShell`. Putting a tool permission there and granting it to game masters would
  show them an **Administración link leading to an empty page**. Verified before the `tools` bucket was added
  (2026-09-04, owner: «*cuidado con el tema roles… ojo con cagarla aquí*»); pinned by the tests in
  `apps/web/src/shared/permissions/permissions.test.ts` § «el cajón aparte».
- Permissions are granted **per role, never per user** (owner, 2026-09-04). A user has exactly one role.
- Adding a tool permission = the `ToolPermissionKey` union + `TOOL_PERMISSIONS` + its two i18n keys + the RLS
  policy that requires `has_tool(key)`. It then appears on its own in «Permisos de Rolvium» in the roles screen.
- Deleting a role holding users is blocked by FK (`ON DELETE RESTRICT`) — reassign first.

## Connections
- Every future module: registers in the module registry, gates its tables with `has_module('{id}')`.

## Modelo de datos
`public.roles` (id, name unique `^[a-z][a-z0-9_]{1,39}$`, description, is_system, permissions jsonb with shape check, timestamps).
Guards: trigger `roles_guard_system`. Access: authenticated read all; `manage_roles` writes.
Helpers (SECURITY DEFINER): `current_role_name()`, `is_admin()`, `has_permission(text)`, `has_module(text)`,
`has_tool(text)` (`20260904230000_tool_permissions.sql` — reads `permissions -> 'tools'`, admin short-circuits).
Seeded: `game_master` holds `manage_textures`; `admin` holds nothing in `tools` on purpose.
