# Rolvium — Architecture

## Monorepo
```
apps/web        Vite + React 18 + react-router 6 + @tanstack/react-query
apps/api        Fastify 4 (serverless on Vercel via esbuild bundle) — verifies Supabase tokens
packages/ui     @rolvium/ui — shared React components + tokens/index.css (--rv-* vars)
packages/i18n   @rolvium/i18n — t(), I18nProvider, locales/{es,en}.json (es bundled, en code-split)
packages/shared-types  @rolvium/shared-types — User, Role, RolePermissions, ApiResponse…
supabase/migrations    SQL migrations (RLS mandatory)
specs/          Functional specs (source of truth)
scripts/        audit.mjs (deterministic compliance), gen-ui-catalog.mjs
.claude/        Dev-agent harness: CLAUDE.md, agents, commands, skills, hooks
```

## Hexagonal architecture (both apps)
- **domain/** ports (interfaces) + entities — no framework imports.
- **application/** use cases / pure policy (`apps/api/src/application/authorize.ts`).
- **infra/** adapters: `Supabase*Repo`, `Http*Adapter`.
- **ui/** React — imports ONLY from `container.ts`, domain types, shared hooks. Never
  from `/infra/`, never `fetch()`/`supabase.from()` directly.
- **container.ts** per module: instantiates adapters and exports them (`authRepository`,
  `adminDeps`). Tests inject fakes through props (`AdminShell deps=`, `AuthProvider repo=`).

### Web modules
| Module | Purpose | Key files |
|---|---|---|
| `auth` | Login/session/profile of the current user | `domain/ports/IAuthRepository.ts`, `infra/SupabaseAuthRepository.ts`, `ui/LoginPage.tsx` |
| `admin` | Users, roles & permissions, settings | ports `RolePort`, `UserPort`, `UserAdminPort`; adapters `SupabaseRoleRepo`, `SupabaseUserRepo`, `HttpUserAdminAdapter`; UI `AdminShell`, `AdminUsers`, `AdminRoles`, `AdminSettings` |
| `home` | Landing after login; lists granted modules | `ui/HomePage.tsx` |

Cross-cutting (`apps/web/src/shared/`): `hooks/useAuth.tsx` (AuthProvider), `permissions/`
(`hasPermission`, `hasModule`, `usePermissions`), `modules/registry.ts` (module registry +
admin permission keys), `lib/{supabaseClient,api,utils}.ts`, `ui/{UserMenu,UIKit}.tsx`.
`RolviumApp.tsx` is the authenticated shell (sidebar from the registry, theme toggle,
user menu); `AppRouter.tsx` the route table.

### API
`apps/api/src/app.ts` is the composition root: `createApp(deps)` (testable, fakes injected)
and `buildApp()` (Supabase deps from env). `authenticate` verifies the bearer token with
`ITokenVerifier` (Supabase `auth.getUser(jwt)` — signature + expiry checked server-side,
never decode-and-trust). Routes: `GET /health`, `GET /auth/me`, `POST /admin/users`,
`POST /admin/users/:id/password`, `DELETE /admin/users/:id` (all `/admin` routes require
`manage_users` via `application/authorize.ts`).

## Auth, roles & permissions
- Login happens in the browser against Supabase Auth (anon key is public; RLS protects data).
- `public.users` (1:1 with `auth.users`, created by trigger) → `role_id` → `public.roles`.
- `roles.permissions` JSONB: `{ modules: string[], admin: { manage_users, manage_roles, manage_settings } }`.
- The `admin` role is system-locked (DB trigger) and bypasses every check.
- Same rule in three places, always in sync:
  - **DB** (`is_admin()`, `has_permission(key)`, `has_module(id)` SECURITY DEFINER helpers → RLS)
  - **API** (`application/authorize.ts`)
  - **Web** (`shared/permissions/permissions.ts`) — only hides UI; never the security boundary.
- Adding a permission: `AdminPermissionKey` in shared-types → `ADMIN_PERMISSIONS` in
  `shared/modules/registry.ts` → i18n keys `admin.perm.*` → RLS predicates use it.
- Adding a module: `MODULES` in the registry → route in `AppRouter` → `modules/{id}/` →
  its tables' RLS use `has_module('{id}')`.

## Design system
Tokens live only in `apps/web/src/RolviumApp.css` (`:root` dark, `[data-theme="light"]`)
and `packages/ui/src/tokens/index.css`. Components use `var(--…)`; details in
`.claude/skills/design-system/SKILL.md`. Enforced by `npm run audit` + the Review agent.

## Testing
See `specs/core/testing/SPEC.md`. Helpers in `apps/web/tests/helpers/` (`renderWithProviders`,
`I18nTestProvider`, `createSupabaseMock`, `fakes.ts`). API tests use `createApp()` with fakes.

## Deployment
Vercel: web project (static, rewrites to index.html) + api project (Build Output API v3
via `apps/api/bundle.mjs`, function `/api/_handler`). Health: `GET /health`.
