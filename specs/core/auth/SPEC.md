# Auth — SPEC

## Purpose
Let a registered user enter Rolvium with email + password and keep the session across reloads.
Who: everyone. Unauthenticated visitors only see `/login`.

## What the user can do
- Sign in with email + password. Wrong credentials → inline error. Disabled account → explicit message, session dropped.
- Stay signed in (Supabase session persisted); sign out from the user menu.
- Sessions ended elsewhere (other tab / token revoked) drop the user to `/login`.

## Flows
1. `/login` → submit → `IAuthRepository.signInWithPassword` → profile (with role + permissions) loaded → redirect `/campaigns`.
2. Reload → `AuthProvider` restores session via `getCurrentUser()`; while loading, blank screen (no flash of login).
3. Protected routes wrap content in `RolviumApp` shell; public routes redirect signed-in users to `/campaigns`.

## Rules & limits
- Inactive users (`users.active = false`) cannot use the app even with a valid session.
- Self-signup (open or with invite code), password reset by e-mail, profile/avatar, devices and locale/theme
  preferences are specified in `specs/modules/identity/SPEC.md` (H1). Out of scope: OAuth/SSO, MFA, e-mail change.

## Connections
- Supabase Auth (browser, anon key). API `GET /auth/me` returns the same profile for server-side needs.

## Modelo de datos
`public.users` (id = auth.users.id, name, email, avatar_url, role_id, active, timestamps). Created by
trigger `on_auth_user_created` from `raw_user_meta_data.name/role_id`. Access: authenticated read all;
self-update of cosmetic fields (trigger `users_guard_self_update` blocks role_id/active/email);
`manage_users` may update anyone. Migration: `supabase/migrations/20260817_core_users_roles.sql`.
