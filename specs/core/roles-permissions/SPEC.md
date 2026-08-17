# Roles & permissions — SPEC

## Purpose
Control who sees which modules and who can administer the platform, without hardcoding
role names in features. Who: admins (and anyone granted `manage_roles`).

## Model
- A **role** has a name, description, `is_system` flag and `permissions`:
  - `modules: string[]` — module ids the role can open (registry: `apps/web/src/shared/modules/registry.ts`).
  - `admin: { manage_users?, manage_roles?, manage_settings? }` — admin capabilities.
- Every user has exactly one role. System roles: `admin` (locked, full access), `game_master`, `player` (default).
- Custom roles can be created/edited/deleted; system roles cannot be deleted or renamed; `admin` cannot be edited.

## Admin area (`/admin?mod=settings|users|roles`)
- Visible only to users with at least one admin permission (else redirect `/home`); each section requires its permission.
- **Users**: list (name, email, role selector, active chip), add user (name/email/role/password, validated), change password,
  block/unblock (not yourself), delete (not yourself). Create/password/delete go through the API (`/admin/*`).
- **Roles**: create (label slugified to `snake_case` name), select, edit description, dual-panel pickers for modules and permissions, delete custom.
- **Settings**: placeholder.

## Rules & limits
- Security boundary is the DB (RLS with `is_admin()`, `has_permission()`, `has_module()`) and the API (`authorize.ts`). The UI only hides.
- Deleting a role holding users is blocked by FK (`ON DELETE RESTRICT`) — reassign first.

## Connections
- Every future module: registers in the module registry, gates its tables with `has_module('{id}')`.

## Modelo de datos
`public.roles` (id, name unique `^[a-z][a-z0-9_]{1,39}$`, description, is_system, permissions jsonb with shape check, timestamps).
Guards: trigger `roles_guard_system`. Access: authenticated read all; `manage_roles` writes.
Helpers (SECURITY DEFINER): `current_role_name()`, `is_admin()`, `has_permission(text)`, `has_module(text)`.
