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
| — | `packages/core` | shared ports and types: `GameSystem`, `SharedResource`, `RollRequest/RollResult`, table event types, the maps vision contract (`SceneVision`, `sightRadiusPx`), the turn-order contract (`Engine.turnOrder` + `orderTurns`/`TurnParticipant`/`TurnOrder` — the comparator may return `0` meaning "the system cannot break this tie", surfaced as `undecided` instead of being invented away) | everyone |
| — | `packages/ui` | Rolvium components + neutral table primitives (Sheet/`Hoja`, Tooltip, floating Modal). The game "look" comes in through the theme's CSS variables, never through per-system components | everyone |
| — | `packages/i18n` | platform locales; **the whole platform is multi-language** (es/en today). UI strings are keys, never literals; system packages ship their own locale files under the same mechanism | everyone |

Rules:
- A campaign is pinned to one system forever; changing system = new campaign.
- Anything security-relevant (who sees hidden tokens, walls, DM-only rolls) is filtered
  **server-side / RLS**, never in the client. Corollary for realtime: `postgres_changes` applies each subscriber's
  RLS, so a change to a row a user may not read never reaches them — anything they must still *react* to travels as
  a `broadcast` (H7 uses `fog.updated` to say «ask the server for your vision again»).
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
| `identity` (H1) | Sign-up (open / `/join/:code` with invite preview), password recovery (`/forgot` → `/reset`), `/account` (profile + avatar, password, devices, language & theme) | ports `IdentityPort`, `InvitePort`; adapters `SupabaseIdentityRepo` (auth, `users`, Storage `avatars`, RPCs `identity_my_sessions`/`identity_revoke_session`), `HttpInviteAdapter` (`GET /invites/:code`); `container.ts` exports `identityDeps` (also bridges `campaignsRepo.joinByCode`); UI `SignupPage`, `ForgotPage`, `ResetPage`, `AccountPage` + sections |
| `characters` (H4) | Player characters: `/characters` (mine by campaign + claim unassigned), `/characters/:id` (sheet in its own window, system-themed; DM read-only → «Editar»), generator, progression; the table's Ficha/El grupo/Crear personaje tabs («Mejorar» is a button inside the sheet, not a tab) | port `CharactersPort` (`SupabaseCharactersRepo`); rolls go through `dice`'s `RollsPort` (`container.ts` re-exports `rollsPort` from `@/modules/dice/container`); `domain/useCases/{characterRules,systemText,generatorRules}` (`tSys` = system locales lookup; `budgetAllows` = the wizard's budget guard, platform-side so the system only owns `GeneratorStep.budget`); UI `CharactersPage`, `CharacterSheetPage`, `CharacterSheetView` (+ `useCharacterSheet` autosave hook with audit origin), `GeneratorWizard`, `ProgressionPanel`; the neutral `<Sheet>` renderer lives in `@rolvium/ui` (schema-driven, `--sys-*` vars only) and the table hosts it via `modules/table/ui/tabs/*` |
| `dice` (H6) | Rolls: `POST /rolls` (server dice + immutable log + sheet effects), the table's side panel (Registro · Chat · Notas · Bitácora placeholders) with the live roll log and the floating draggable «Lanzador de dados» (free d4…d100/Fudge, visibility Todos/Director/Secreta, modifier) | ports `RollsPort` (`HttpRollsAdapter` → `POST /rolls`, body `RollRequest & { campaignId }`), `RollLogPort` (`SupabaseRollLogRepo`: `dice_rolls` under RLS + `postgres_changes` INSERT on channel `campaign-rolls:<id>`); `container.ts` exports `rollsPort`, `rollLog`; `domain/useCases/rollRules` (`freeRollRequest`, `dieTone`, `describeRoll`); UI `SidePanel`, `RollLog`, `DiceRoller` (module-specific, `--sys-*` themed via `dice.css`), hosted by `modules/table/ui/TablePage` |
| `bestiary` (H5) | Bestiario del director, pestaña `bestiary` de la mesa a pantalla completa: catálogo en rejilla con imagen grande, buscador sin acentos y filtros Todos/Manual/Propios/PNJ; encuentros propios (crear, editar, duplicar, borrar) con imagen a WebP; PNJ aliados con la ficha COMPLETA de personaje reutilizando `<Sheet>`; modal de la foto de la criatura. Las **45 criaturas del manual NO tienen fila**: son datos del paquete del sistema (`catalogs.bestiary`) y se unen al listado en memoria — el filtro «Manual» sale del catálogo y «Propios»/«PNJ» de la tabla. Instanciar en escena es cosa de `maps`: el token guarda su propia Resistencia y enlaza a la plantilla con `bestiary_entry_id` (ON DELETE SET NULL, para que borrar la plantilla no vacíe la escena) | puerto `BestiaryPort`; adaptador `SupabaseBestiaryRepo` (tabla `bestiary_entries` bajo RLS **sólo director**, bucket `tokens`); `container.ts` → `bestiaryRepo`; dominio `bestiaryRules` (une las dos fuentes, duplicar, ámbito, valores de juego); UI `BestiaryTab`, `EntryCard`, `EntrySheetModal`, `NpcSheetModal`, `PhotoModal`, `useBestiary` |
| `maps` (H7) | Escena, full-screen: scenes (collapsible left rail), background, walls/doors/windows with vertex editing, tokens (PC/bestiary), drawings incl. text, measure, focus pin, zoom/pan (panning is a modifier — space or middle button — never a tool), **fog + line of sight computed by the API**, scene light (day/night); one toolbar in three blocks with the dice roller first, DM tools behind the gold separator | ports `MapsPort` (Supabase) and `VisionPort` (API); adapters `SupabaseMapsRepo` (tables `maps_*`, bucket `backgrounds`, `postgres_changes` + broadcast for drag/pin/`fog.updated`) and `HttpVisionAdapter` (`POST /scenes/:id/{vision,fog}`); `container.ts` → `mapsRepo`, `visionPort`; UI `SceneTab` (table tab `scene`), `MapCanvas` + `canvasLayers` (`WallShape`, `FogMasks`), `Toolbar`, `StrokeBar` (doubles as the fog brush and as the wall-type picker), `DmOptionsBar`, `ScenesMenu`, `BackgroundPopover`, `EncounterMenu`, `CanvasControls`, `useScene` |
| `systems` | `/systems` catalogue: installed packages (lazy-loaded through `systemRegistry`, facts + `--sys-*` themed preview) and coming-soon systems; UI-only, no infra/container | `ui/SystemsPage.tsx` (`packageFacts` pure helper), `ui/systems.css` |

Game systems are also loaded in the API (`apps/api/src/infrastructure/systems.ts`, mirror of the web registry) so the
server can validate sheets and resolve rolls with the same engine the browser uses for previews.

Product hexagons (`campaigns`, `table`, `characters`, `bestiary`, `dice`, `maps`, `chat`, `journal`) are added under `apps/web/src/modules/<hex>/` following the same layout; see "Product hexagons" above.

Cross-cutting (`apps/web/src/shared/`): `hooks/useAuth.tsx` (AuthProvider), `hooks/useTheme.tsx` (ThemeProvider: dark/light/system,
`data-theme` on `<html>`), `hooks/PreferencesSync.tsx` (applies the profile's locale/theme once per sign-in), `ui/AuthShell.tsx` (hero + card
shared by every `Auth/*` screen), `permissions/`
(`hasPermission`, `hasModule`, `usePermissions`), `modules/registry.ts` (module registry +
admin permission keys), `lib/{supabaseClient,api,utils,errors}.ts`, `ui/{UserMenu,UIKit}.tsx`.
`lib/errors.ts` (`DbError`/`dbError`/`reasonOf`) normalises to a real `Error` whatever a DB client throws —
supabase-js throws a PLAIN object `{message, details, hint, code}`, so `e instanceof Error` silently discarded
the reason of every DB failure. Infra adapters wrap with `dbError()`; UI reads the reason with `reasonOf()`.
It is a pure normaliser with no imports, which is why `/ui/` may import it without breaking the hexagon.
`RolviumApp.tsx` is the authenticated shell (sidebar from the registry, theme toggle,
user menu); `AppRouter.tsx` the route table.

### API
`apps/api/src/app.ts` is the composition root: `createApp(deps)` (testable, fakes injected)
and `buildApp()` (Supabase deps from env). `authenticate` verifies the bearer token with
`ITokenVerifier` (Supabase `auth.getUser(jwt)` — signature + expiry checked server-side,
never decode-and-trust). Routes: `GET /health`, `GET /auth/me`, `GET /invites/:code` (public: invite preview via
`campaign_invite_preview` with the service role — never the campaign id, never why a code fails),
`PUT /characters/:id/sheet` (authoritative sheet save: `validateSheet` from `@rolvium/core` against the campaign
system's `sheetSchema` → `engine.derived` → persisted **as the actor** through `characters_api_update`, which
impersonates the user for the transaction so guards/audit/DM checks apply), `POST /rolls` (`application/rolls/performRoll`: membership check → server CSPRNG dice →
`engine.resolve` with the character's sheet → `dice_commit_roll` (immutable `dice_rolls` row + shared-resource hand debited in the
same transaction; `IRollRepository`/`SupabaseRollRepo`) → `result.effects.patch` applied server-side through `saveSheet` with origin
`roll`, returning `{ id, request, dice, result, rolledAt, effectsApplied?, sheet? }`), `POST /scenes/:id/vision` and
`POST /scenes/:id/fog` (maps H7: `application/maps/{vision,sceneVision}` — line of sight swept against EVERY wall with the
service role, explored cells persisted in `maps_fog`; the DM's brush writes on every player at once. The browser cannot
compute this: RLS never sends it a hidden wall, so asking the server IS the boundary),
`POST /combats` + `/combats/:id/{next,close,advance}` (dice H6 turn order: `application/combats/combat` —
**the server decides the order** with `orderTurns` from `@rolvium/core`, never the caller; a player character's
sheet is read from the DB so `stats` sent for that slot are ignored. Opening answers **409 `UNDECIDED`** with the
tied groups rather than inventing an order, because the rule literally ends at "the DM decides" (p.92–93); the app
re-sends his answer in `tiebreak`. `domain/combat/ICombatRepository` → `SupabaseCombatRepo` over four API-only
`SECURITY DEFINER` functions, which re-check the caller in SQL and take a `FOR UPDATE` row lock on the combat),
`POST /admin/users`,
`POST /admin/users/:id/password`, `DELETE /admin/users/:id` (all `/admin` routes require
`manage_users` via `application/authorize.ts`).

## Auth, roles & permissions
- Login happens in the browser against Supabase Auth (anon key is public; RLS protects data).
- `public.users` (1:1 with `auth.users`, created by trigger from sign-up metadata `name/alias/locale`) → `role_id` → `public.roles`.
  Profile prefs: `alias`, `locale`, `theme_pref`. Sessions are read from `auth.sessions` through SECURITY DEFINER RPCs scoped
  to `auth.uid()`; avatars live in the public Storage bucket `avatars/{uid}/avatar.png` (owner-folder policies).
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
Hosted Supabase is **live**: project `scfspsiemikfcnqteonq` (`Rolvium` org, free tier, eu-central-1), all 11
migrations applied, `get_advisors` clean of CRITICAL. Both Vercel projects are **live and git-connected**, so a
push to `main` redeploys them: api https://rolvium-api.vercel.app · web https://rolvium.vercel.app.

### 🌍 La función de la api vive en Frankfurt (`fra1`), y no es un capricho
`apps/api/vercel.json` fija `"regions": ["fra1"]`. **JSON no admite comentarios, así que la razón vive aquí.**

Medido el 2026-09-03, con el dueño diciendo que la niebla iba «estúpidamente lenta»: la cabecera de respuesta
era `x-vercel-id: cdg1::iad1::…` — el borde que le atendía estaba en **París**, pero la función corría en
**Washington** (`iad1`, el valor por omisión de Vercel), mientras la base de datos está en **Frankfurt**.

Cada respuesta de visión hace **cuatro consultas SEGUIDAS** a la base (escena → rol → luces → explorado), y
cada una cruzaba el Atlántico ida y vuelta. Medido en producción: **entre 0,6 y 1,2 s por respuesta**, y el
navegador manda varias por segundo mientras se arrastra una ficha, así que las respuestas llegaban tarde y
desordenadas y la niebla parecía ir a rastras.

> ⚠️ **Regla que se deriva:** la función de la api tiene que vivir SIEMPRE en la misma región que Supabase. Si
> algún día se mueve el proyecto de Supabase, esta línea se mueve con él — si no, la lentitud vuelve entera y
> sin avisar, porque nada falla: sólo tarda.
