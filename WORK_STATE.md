# WORK_STATE.md — Rolvium

## 🎯 Current task
Building the v1 hexagons in order (see ARCHITECTURE.md "Product hexagons" + specs/modules/*):
**campaigns DONE · table shell DONE (2026-08-17)** → next `characters` (sheet from schema + generator + Plenilunio engine) → `dice` → `maps` → `chat` → DM panel.

## 📍 Exact point
- 2026-08-17 evening: design approved & committed (`rolvium.pen`, 31 frames); specs for all hexagons written;
  `packages/core` (GameSystem port, rolls, event bus, system registry) + `packages/system-plenilunio` skeleton
  (theme, locales, sharedResources; engine/schema TODO with `characters`);
  `campaigns` hexagon: migration `20260817120000_campaigns.sql` (RLS smoke-tested), web module
  (`modules/campaigns/{domain,infra,container,ui}`: home page, create wizard, join by code), top-bar shell
  (`RolviumApp.tsx` now renders the pen TopBar; `/campaigns` is the landing), `systems/registry.ts`, i18n es/en,
  9 web test files green (34 tests), audit 0 hard, build OK. `/characters`, `/systems` NOT implemented yet (nav links exist).
- `table` (H3) shell: migration `20260817130000_table_shared_resources.sql` (RPCs `table_take_resource` /
  `table_return_resource` / `table_reset_resource` / `table_spend_hand`, atomic, tested), `modules/table`
  (TablePage `/table/:id` without platform shell; system theme applied as `--sys-*` inline vars + bg image; Rolvium
  bar; header with presence halos via Realtime `presence`; SharedResourceBar = Destiny pool; tabs by role; side panel
  placeholder). Tabs content (sheet/scene/…) are placeholders until their hexagons land. Tests: web 45 + api 13 green (after review/QA 2026-08-17: review APPROVED WITH NOTES, QA READY WITH WARNINGS).
- All apps typecheck, build, and pass tests (web 28, api 13). `npm run audit` → 0 hard.
- **Local Supabase stack working** (`npm run db:start`, Docker): migration
  `supabase/migrations/20260817000000_core_users_roles.sql` + `supabase/seed.sql` applied; `.env` files
  in `apps/web` and `apps/api` point at it (gitignored). Dev admin: admin@rolvium.local / rolvium123.
  Verified end-to-end (2026-08-17): login, RLS reads, anon denied, API `/auth/me`, admin create user
  via API, player → 403 in API and in RLS.
- No hosted Supabase project (owner's plan only allows 2 → local for now, `supabase link` + `db push` later);
  no Vercel projects; `rolvium.pen` not created; no git remote.

## ✅ Decisions made
- Roles: `admin` (system, locked), `game_master`, `player` (default on signup). Custom roles allowed.
- Permissions JSONB `{modules[], admin{manage_users, manage_roles, manage_settings}}`; DB helpers
  `is_admin()/has_permission()/has_module()` are the security boundary; UI only hides.
- Login in-browser via Supabase; API verifies tokens with `auth.getUser(jwt)` (no unsigned decode).
- Privileged ops (create user, set password, delete) go through the API (`/admin/*`), not the browser.
- Design: "Candlelit Grimoire" (ink surfaces, parchment text, ember-gold accent). Tokens in RolviumApp.css.
- Harness inherited from a previous project, stripped of that project's business; env escape hatches `ROLVIUM_SKIP_*`.
- Database is LOCAL-first (Supabase CLI stack). Migrations are the contract; `seed.sql` is local-only. Explicit GRANTs in migrations (local stack has no default privileges).

- Design decisions (2026-08-17, in rolvium.pen): avatars — the **user** has an account avatar; **each character** can
  upload its own avatar/token; if the character has none, the user's avatar is the default (then initials+color).
- Product hexagons map lives in ARCHITECTURE.md ("Product hexagons"); characters (PJ) ≠ bestiary (PNJ/monsters);
  journal = notes + shared log; platform is multi-language (i18n keys everywhere, systems ship their own locales).

## ⏳ Next immediate step
1. `npm run db:start` (if Docker is up) → `npm run dev:api` + `npm run dev:web` → log in as the dev admin.
2. Next hexagon: `identity` (registro con código `/join/:code`, `/signup`, `/forgot`, perfil) → then `characters` (Plenilunio engine + sheet + generator).
3. When a hosted project is available: `supabase link` + `npm run db:push`, swap `.env`, create Vercel projects.

## 🚫 Blockers / notes
- Review 2026-08-17 (subagent) → BLOCKED → fixed by `20260817140000_campaigns_hardening.sql` (column grants on
  members/campaigns, invite code via RPC, perTakeMax server-side, players_count RPC, row locks). Pending MINORs:
  `/join`, `/signup`, `/forgot`, `/characters`, `/systems` routes; `fondo.png` 3.5 MB → WebP; raw px in inline styles;
  system font URL whitelisting; unit tests for packages/core. Verify Realtime `postgres_changes` payload respects the
  column grants on `campaigns_campaigns` (invite_code) — if not, move invite_code to its own table.
- Placeholder prod URLs in the harness (`rolvium.vercel.app`, `rolvium-api.vercel.app`) — update when Vercel projects exist.
