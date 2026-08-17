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


## Product hexagons (the ruling map)

Rolvium is a multi-system virtual tabletop. The platform is a set of **hexagons**
(bounded contexts). Each one owns its tables (prefix `<hex>_`), its RLS, its
`domain/ports/useCases`, `infra/` and `ui/`. Hexagons talk **only through ports and
events** — never by importing another hexagon's `infra/`. Game systems are
**plug-in packages** behind one port; the platform knows nothing about any game.

| # | Hexagon (id) | Owns | Talks to |
|---|---|---|---|
| H1 | `identity` (today `auth` + `admin`) | login, sign-up (open or by invitation code), multi-device sessions, profile/avatar, roles & permissions, user administration | everyone via `IAuthRepository` / `usePermissions` |
| H2 | `campaigns` | create/join (invite code, open campaigns), members and their table role (`dm`/`player`), the pinned `system_id`+version, table options (progression enabled, initial shared resources), invitations | H1, HX (choose system), H9 |
| H3 | `table` | the live table shell: presence/connected users, tabs, DM panel, shared resources (e.g. Destiny pool), applying the system's `VisualTheme` to the table container | H2, HX, H4–H8, H9 |
| H4 | `characters` | **player characters only**: sheet (`jsonb` per the system's `sheetSchema`), generator, progression, avatar/token, change audit log, "open in separate window" | HX (schema, engine), H5 (asks for rolls), H9 |
| H5 | `bestiary` | NPCs, monsters and encounters: system creatures, DM-made NPCs (via the generator), quick copies, token images, encounter instances (own HP per copy) | H4 (reuses sheet/generator), H6 (placing tokens), HX, H9 |
| H6 | `dice` | generic `NdX` engine, free roller, **server-side rolls** (CSPRNG, immutable, visibility `table`/`dm`/`secret`), roll log | HX (counting/resolution rules), H9 |
| H7 | `maps` | scenes, backgrounds + image library, walls, vision/fog (computed server-side), tokens, drawings, focus pin, measuring | H4/H5 (tokens), H9 |
| H8 | `chat` | table channel, private messages, DM whispers, roll attachments | H6 (attachment), H9 |
| H9 | `journal` | private notes per user/campaign + shared log with versions | H10 |
| H10 | `realtime` (cross-cutting, no UI) | one channel per campaign (`postgres_changes` / `broadcast` / `presence`) and the in-table **event bus** | used by H3–H9 |
| H11 | `notifications` (future) | e-mails: invitations, next session, summaries | H1, H2 |
| HX | `packages/system-plenilunio`, `packages/system-<other>` | implement the `GameSystem` port: `sheetSchema`, catalogs, manual references, `VisualTheme`, engine (derived stats, dice pool, resolve, damage, progression, shared resources), generator steps, **own i18n locales** | nothing inward; consumed through `packages/core` |
| — | `packages/core` | shared ports and types: `GameSystem`, `SharedResource`, `RollRequest/RollResult`, table event types | everyone |
| — | `packages/ui` | Rolvium components + neutral table primitives (Sheet/`Hoja`, Tooltip, floating Modal). The game "look" comes in through the theme's CSS variables, never through per-system components | everyone |
| — | `packages/i18n` | platform locales; **the whole platform is multi-language** (es/en today). UI strings are keys, never literals; system packages ship their own locale files under the same mechanism | everyone |

Rules:
- A campaign is pinned to one system forever; changing system = new campaign.
- Anything security-relevant (who sees hidden tokens, walls, DM-only rolls) is filtered
  **server-side / RLS**, never in the client.
- New hexagon = new entry here + `MODULES` in `shared/modules/registry.ts` + route +
  `specs/modules/<hex>/SPEC.md` + its own migration with `has_module('<hex>')` RLS.
- Design source of truth is `rolvium.pen`; system visual assets live in
  `design/<system>/` (design) and `apps/web/public/systems/<system>/` (runtime).

Naming: **code and ids in English**, UI copy through i18n keys, specs written in Spanish.

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

Product hexagons (`campaigns`, `table`, `characters`, `bestiary`, `dice`, `maps`, `chat`, `journal`) are added under `apps/web/src/modules/<hex>/` following the same layout; see "Product hexagons" above.

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
