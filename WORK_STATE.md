# WORK_STATE.md — Rolvium

## 🎯 Current task
Building the v1 hexagons in order (map: ARCHITECTURE.md "Product hexagons"; specs: specs/modules/*).
**DONE:** design (`rolvium.pen`) · specs · `packages/core` · `campaigns` (H2) · `table` (H3) shell · `@rolvium/ui` primitives ·
`identity` (H1, 5c51f39) · `characters` (H4) slice 1 (7f3f5e3: DB + Plenilunio engine audited vs the manual 8eef64b) ·
`characters` slice 2 (de01d40 + 10f8b49: `<Sheet>`, `/characters`, `/characters/:id`, generator, progression, table tabs, API
authority `PUT /characters/:id/sheet`) · **`dice` (H6, 149b3bf: immutable `dice_rolls`, `POST /rolls` persists + server effects +
pool rebuilt from the sheet, Registro live, floating roller, side panel)** — review APPROVED WITH NOTES, QA see below.
· **campaigns polish (DM Gestionar panel, Abandonar, `/systems`, `dev:api` fixed, Crescent dedupe)** — review PASSED.
**NEXT:** `maps` (H7) → `chat/journal` (H8/H9) → DM panel → bestiary.

## 📍 Exact point (2026-08-18 morning)
- **dice (H6) shipped** (149b3bf): `dice_rolls` immutable log (RLS: table = members; dm/secret = author or DM; realtime), RPC
  `dice_commit_roll` (service role; membership as actor; shared-hand debit atomic via `table_spend_hand`; `pool_empty` → 409),
  API `POST /rolls` = `performRoll` (rights → **rebuild groups with `engine.poolFor(sheet, options)`** → CSPRNG → `engine.resolve`
  → commit → sheet `effects.patch` applied via `saveSheet` origin `roll` → `{id, request, dice, result, effectsApplied, sheet}`).
  Web `modules/dice` (RollsPort/HttpRollsAdapter moved here; RollLogPort/SupabaseRollLogRepo; `RollLog` Registro live;
  `DiceRoller` floating draggable; `SidePanel` Registro·Chat·Notas·Bitácora placeholders) in the table's right column.
  Deviations: die tones system-agnostic (max face/1); specialty not shown in the log title; own-dice trust fixed server-side.
- Campaigns polish shipped: `CampaignManagePanel` (Modal from the DM card «Gestionar»), player «Abandonar», `/systems` page
  (`modules/systems/ui/SystemsPage.tsx`), `npm run dev:api` works again, duplicate `Crescent` removed.
- Owner plan: **test everything together tomorrow** (2026-08-19) — identity, campaigns, table, characters, dice — light/dark + functional.

- characters slice 2 shipped (see commit de01d40 body). Key architecture now in place:
  - **Client = preview**: `<Sheet>` (packages/ui, schema-driven, `--sys-*` only) + `useCharacterSheet` (draft, debounced autosave,
    origin-tagged) call `CharactersPort.saveSheet` → `HttpSheetAdapter` → **API `PUT /characters/:id/sheet`** which validates
    (`validateSheet`, @rolvium/core), recomputes derived/health with the engine, enforces XP authority (DM awards; players only
    spend via origin `progression`), mirrors name/concept into the row and persists **as the actor** through
    `characters_api_update` (SECURITY DEFINER, service_role only, sets `request.jwt.claims.sub` so guards + audit run as the user).
  - Rolls: `RollsPort` (dice module) → `HttpRollsAdapter` → **API `POST /rolls`** (see dice below: persisted, effects server-side).
  - Table: tabs Ficha (SheetTab: my sheet / create CTA → GeneratorWizard), Mejorar (ImproveTab → ProgressionPanel, blocked unless
    `campaigns.progression_enabled`), El grupo (DM: PCs with avatar precedence, health, xp, «Ver ficha»).
- Suites: web 139 · api 28 · core 2 · system-plenilunio 60; typecheck OK; audit 0 hard (4 pre-existing warns); builds + API bundle OK.
- Local e2e verified with curl for the API (validation 400 with issues, owner save 200 + derived, player origin 'dm' 403, xp with
  progression off 403, audit author/origin, rolls). Local test data (wiped by `db:reset`): players marta2@ / pip@ejemplo.com
  (supersecret1); campaign "Test chars" (DM admin) with PC "Marta la Loba".
- Design deviations accepted for now (spec «Estado v1» lists them): generator gifts/specialties = generic list/select; both attack icons
  per weapon; fortune/destiny/xp as counters; no Registro side panel on `/characters/:id`; avatar upload from sheet not wired;
  per-field INVALID_SHEET issues not surfaced.
- Known: `npm run dev:api` broken (pre-existing tsx watch arg order) → `cd apps/api && npx tsx --env-file=.env src/server.ts`.
- **Owner: light/dark + functional pass in the browser** on `/characters`, `/characters/:id`, table tabs Ficha/Mejorar/El grupo,
  generator (`npm run dev:web` + the API command above; log in as pip@ejemplo.com, join campaign, create character).

## ✅ Decisions made
- Hexagons: identity, campaigns, table, characters (PJ only), bestiary (PNJ/monsters/encounters), dice, maps, chat,
  journal (notes+log together), realtime (cross-cutting), notifications (future), HX = `packages/system-*` behind the
  `GameSystem` port in `packages/core`. Code/ids in English; UI via i18n (platform multi-language, systems ship locales).
- Table role `dm`/`player` lives in `campaigns_members`; platform roles admin/game_master/player. Only game_master/admin create campaigns.
- Campaign pinned to `system_id`+`system_version` forever (DB trigger). Shared resources jsonb on the campaign; only via
  SECURITY DEFINER RPCs; `perTakeMax` stored server-side. Invite code readable only by DM via RPC; players may only
  update `character_id` on their member row.
- Identity: no `device_sessions` table — sessions read from `auth.sessions` via RPCs (revoke = delete refresh tokens + session;
  the other device drops when its access token expires ≤ 1 h). Invite preview never returns the campaign id nor why a code
  fails. Email is read-only in the profile (v1). Alias falls back to name. Sign-up passes `emailRedirectTo` back to
  `/join/:code` so the intent survives e-mail confirmation on hosted projects.
- Avatars: user avatar is the default for characters without their own; then initials+color.
- Design: Candlelit Grimoire tokens (RolviumApp.css) for the platform; game-system look enters as `--sys-*` CSS vars on
  the table container (`VisualTheme.vars`), never per-system components. Plenilunio hojas: no border, shadow, 50% white,
  moons without stroke, casillas white with shadow.
- Harness: design in .pen → spec → dba → dev → **review + qa subagents** (run via general-purpose agent reading
  `.claude/agents/review.md` / `qa.md` since custom agent types are not registered when the session cwd is not the repo).
  QA mode agreed with owner: spec deviations = warning; light/dark = user-accepted per round.

## ⏳ Next immediate step
Resume prompt for a new chat: «Retomo Rolvium: lee WORK_STATE.md y ARCHITECTURE.md. Siguiente hexágono: dice (H6) según
rolvium.pen (PL/Lanzador flotante SRdGf, panel Registro XwDVn). Flujo: spec → dba → dev → review → qa».
1. `dice` (H6): table `dice_rolls` (campaign, character, author, request, dice, result, visibility table|dm|secret, created_at) with RLS
   by visibility; `POST /rolls` persists there (and debits shared-resource dice atomically with the existing RPC); Registro panel
   in the table (realtime), floating roller (`PL/Lanzador flotante`), free roller; apply `effects` (destinyUp/fortuneRefill/ammo)
   server-side after the roll instead of client-side patch.
2. characters follow-ups: avatar/token upload from the sheet (`onImagePick`), specialty change (3 px), audit log in «El grupo»,
   per-field validation issues in the UI, ⚔/◎ per weapon type in `<Sheet>` (needs a neutral hint in the schema), remove duplicate
   `Crescent` in `modules/table/ui/systemIcons.tsx`, membership check for `POST /rolls` without character.
3. Pending small items: WebP background, `campaigns_players_count` N+1 → set-returning RPC, specific messages for
   `campaign_full`/`already_resolved` in the manage panel, edit name/description/seats from the panel, bestiary base
   entries «Solitario/Chatarrero» → real book stat blocks when doing `bestiary` (RULES §8).

## 🚫 Blockers / notes
- No hosted Supabase (owner plan allows 2 projects) → local only; Vercel + `supabase link`/`db push` when table+characters+dice are playable.
  On hosted: verify `postgres` may DELETE from `auth.sessions`/`auth.refresh_tokens` (the identity RPCs rely on it) and that
  `site_url`/redirect allow-list include the Vercel domain (`/reset`, `/join/*`).
- Verify Realtime `postgres_changes` honours column grants (review says WALRUS does; re-check on hosted).
- Placeholder prod URLs in the harness (`rolvium.vercel.app`, `rolvium-api.vercel.app`).
