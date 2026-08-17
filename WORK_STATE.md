# WORK_STATE.md — Rolvium

## 🎯 Current task
Project bootstrap — DONE (2026-08-17). Base platform ready: monorepo, auth, users,
roles & permissions, admin area, i18n, @rolvium/ui, API, RLS migration, dev-agent harness.

## 📍 Exact point
- All apps typecheck, build, and pass tests (web 28, api 13). `npm run audit` → 0 hard.
- Supabase project NOT created yet → migration `supabase/migrations/20260817_core_users_roles.sql`
  not applied; no `.env` files; no Vercel projects; `rolvium.pen` not created.

## ✅ Decisions made
- Roles: `admin` (system, locked), `game_master`, `player` (default on signup). Custom roles allowed.
- Permissions JSONB `{modules[], admin{manage_users, manage_roles, manage_settings}}`; DB helpers
  `is_admin()/has_permission()/has_module()` are the security boundary; UI only hides.
- Login in-browser via Supabase; API verifies tokens with `auth.getUser(jwt)` (no unsigned decode).
- Privileged ops (create user, set password, delete) go through the API (`/admin/*`), not the browser.
- Design: "Candlelit Grimoire" (ink surfaces, parchment text, ember-gold accent). Tokens in RolviumApp.css.
- Harness ported from WorkSuite minus OIH/Momentum/Jira; env escape hatches `ROLVIUM_SKIP_*`.

## ⏳ Next immediate step
1. Create the Supabase project, apply the migration, create the first admin (see README).
2. Fill `apps/web/.env` + `apps/api/.env`, run `npm run dev:web` + `npm run dev:api`, log in.
3. Run the Spec agent for the first game module (e.g. campaigns).

## 🚫 Blockers / notes
- Placeholder prod URLs in the harness (`rolvium.vercel.app`, `rolvium-api.vercel.app`) — update when Vercel projects exist.
