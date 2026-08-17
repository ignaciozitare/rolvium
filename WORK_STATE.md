# WORK_STATE.md — Rolvium

## 🎯 Current task
Building the v1 hexagons in order (map: ARCHITECTURE.md "Product hexagons"; specs: specs/modules/*).
**DONE 2026-08-17:** design (`rolvium.pen`, approved) · specs for all hexagons · `packages/core` · `system-plenilunio` skeleton ·
`campaigns` (H2) · `table` (H3) shell · login page from design · `@rolvium/ui` primitives · security hardening after review.
**NEXT:** `identity` (H1) → `characters` (H4, Plenilunio engine + sheet + generator) → `dice` → `maps` → `chat/journal` → DM panel.

## 📍 Exact point (2026-08-17 night)
- Last commit: post-review/QA doc drift + `campaigns_players_count` guard. Review subagent = **APPROVED WITH NOTES**,
  QA subagent = **READY WITH WARNINGS** (spec scope gaps listed below, not defects). Local stack: `npm run db:start`
  (Docker) → 4 migrations apply clean (`20260817000000_core_users_roles`, `…120000_campaigns`,
  `…130000_table_shared_resources`, `…140000_campaigns_hardening`), lint 0, audit 0 hard, web 45 + api 13 tests green,
  builds OK. Dev: `cd ~/Documents/Developer/Rolvium && npm run dev:web` → http://localhost:5173 (admin@rolvium.local /
  rolvium123). Player flow: create a `player` user in Admin, join with the DM's invite code (DM sees it via RPC only in
  the create-wizard "Invitar" step for now).
- What exists in code: `/login` (design 1:1), `/campaigns` (home: mine/open/join-by-code/systems, create wizard 5
  steps, invite code+link), `/table/:id` (system-themed shell: Rolvium bar, presence halos, Destiny pool with atomic
  take/return/reset, tabs by role, side panel; tab contents are placeholders), `/admin`, `/ui-kit`.
  Nav links `/characters`, `/systems` and login links `/join`, `/signup`, `/forgot` have **no routes yet**.
- Design master `rolvium.pen` (31 frames) — node ids and Pencil gotchas in memory `project_rolvium_pen`.
  System assets: `design/plenilunio/fondo.png` (design) + `apps/web/public/systems/plenilunio/fondo.png` (runtime, 3.5 MB → WebP pending).

## ✅ Decisions made
- Hexagons: identity, campaigns, table, characters (PJ only), bestiary (PNJ/monsters/encounters), dice, maps, chat,
  journal (notes+log together), realtime (cross-cutting), notifications (future), HX = `packages/system-*` behind the
  `GameSystem` port in `packages/core`. Code/ids in English; UI via i18n (platform multi-language, systems ship locales).
- Table role `dm`/`player` lives in `campaigns_members`; platform roles admin/game_master/player. Only game_master/admin create campaigns.
- Campaign pinned to `system_id`+`system_version` forever (DB trigger). Shared resources jsonb on the campaign; only via
  SECURITY DEFINER RPCs; `perTakeMax` stored server-side. Invite code readable only by DM via RPC; players may only
  update `character_id` on their member row.
- Avatars: user avatar is the default for characters without their own; then initials+color.
- Design: Candlelit Grimoire tokens (RolviumApp.css) for the platform; game-system look enters as `--sys-*` CSS vars on
  the table container (`VisualTheme.vars`), never per-system components. Plenilunio hojas: no border, shadow, 50% white,
  moons without stroke, casillas white with shadow.
- Harness: design in .pen → spec → dba → dev → **review + qa subagents** (run via general-purpose agent reading
  `.claude/agents/review.md` / `qa.md` since custom agent types are not registered when the session cwd is not the repo).
  QA mode agreed with owner: spec deviations = warning; light/dark = user-accepted per round.

## ⏳ Next immediate step
1. `identity` (H1): route `/join/:code` (invite preview via API `GET /invites/:code` with service role, then signup or
   join), `/signup`, `/forgot`, `/account` (profile/avatar/devices/language/theme) — all designed in .pen
   (Auth/Registro con código, Cuenta/Perfil). Then wire nav `/characters`, `/systems` (designed).
2. `characters` (H4): port the validated JSX engine (`~/Documents/Developer/Rolvium context/plenilunio-vtt-prototipo.jsx`)
   to `packages/system-plenilunio` (sheetSchema, catalogs, references, engine with tests vs manual examples, generator),
   migration `characters` + audit trigger, generic `<Sheet>` in the table's Ficha tab.
3. Pending small items: DM management UI (regenerate code, requests, kick, archive, next session — port/DB ready),
   leave campaign, WebP background, unit tests for packages/core, `campaigns_players_count` N+1 → set-returning RPC.

## 🚫 Blockers / notes
- No hosted Supabase (owner plan allows 2 projects) → local only; Vercel + `supabase link`/`db push` when table+characters+dice are playable.
- Verify Realtime `postgres_changes` honours column grants (review says WALRUS does; re-check on hosted).
- Placeholder prod URLs in the harness (`rolvium.vercel.app`, `rolvium-api.vercel.app`).
