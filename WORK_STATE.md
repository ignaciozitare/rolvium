# WORK_STATE.md — Rolvium

## 🎯 Current task
Project bootstrap — DONE (2026-08-17). Base platform ready: monorepo, auth, users,
roles & permissions, admin area, i18n, @rolvium/ui, API, RLS migration, dev-agent harness.

## 📍 Exact point
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
2. Run the Spec agent for the first game module (e.g. campaigns).
3. When a hosted project is available: `supabase link` + `npm run db:push`, swap `.env`, create Vercel projects.

## 🚫 Blockers / notes
- Placeholder prod URLs in the harness (`rolvium.vercel.app`, `rolvium-api.vercel.app`) — update when Vercel projects exist.
