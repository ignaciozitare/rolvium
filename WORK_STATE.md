# WORK_STATE.md — Rolvium

## 🎯 Current task
Building the v1 hexagons in order (map: ARCHITECTURE.md "Product hexagons"; specs: specs/modules/*).
**DONE 2026-08-17:** design (`rolvium.pen`, approved) · specs for all hexagons · `packages/core` · `system-plenilunio` skeleton ·
`campaigns` (H2) · `table` (H3) shell · login page from design · `@rolvium/ui` primitives · security hardening after review ·
**`identity` (H1)** (review APPROVED WITH NOTES, QA PASSED w/ warnings, commit 5c51f39; `.pen` saved by owner, commit 443bb29) ·
**`characters` (H4) slice 1** = DB + Plenilunio system package + web domain/infra (commit 7f3f5e3, review APPROVED WITH NOTES).
**NEXT:** `characters` slice 2 = UI (`<Sheet>`, generator, `/characters`, Ficha tab) + API validation/rolls → `dice` → `maps` → `chat/journal` → DM panel.

## 📍 Exact point (2026-08-17, end of session — HANDOFF)
- **identity (H1)** shipped: `/signup`, `/join`, `/join/:code` (public preview `GET /invites/:code`), `/forgot` → `/reset`, `/account`
  (profile+avatar, password, devices via `auth.sessions` RPCs, language & theme). `ThemeProvider` + `PreferencesSync` in shared/hooks,
  `AuthShell` hero shared by Auth screens, user menu → «Cuenta». Migration `20260818000000_identity_profile_sessions_avatars.sql`.
  Owner still owes the light/dark pass on those routes (QA manual step).
- **characters (H4) slice 1** shipped and verified with curl (player/DM RLS, audit, xp guard, claim, origin-tagged update):
  - Migration `20260818100000_characters.sql`: `characters` (campaign, owner nullable = «sin asignar», kind pc/npc, name, concept,
    avatar/token/color, `data` jsonb, `derived`, `health`, `xp`, archived, created_by), `characters_audit` (trigger-written, DM-only read,
    origin sheet|roll|damage|progression|dm|system via `set_config('rolvium.audit_origin')`), guard trigger (players: no campaign/kind/
    owner/archive changes; xp only if `campaigns.progression_enabled`), RPCs `characters_claim(cid)`, `characters_update_with_origin(cid,
    patch, origin)` (SECURITY INVOKER; 'dm' gated to DM), FK `campaigns_members.character_id`, bucket `tokens`.
  - `packages/system-plenilunio` 0.2.0 = real `GameSystem`: `schema.ts` (sheetSchema, newSheet, PRESETS 16/21/25/30 max 5/5/6/7,
    readers statOf/healthOf/weaponsOf/giftsOf), `catalogs.ts` (WEAPONS/ARMOURS/EQUIPMENT/27 GIFTS/SPECIALTIES/SIZES/BESTIARY/DIFFICULTIES),
    `references.ts` (17 keys), `engine.ts` (classify/applyArmour/resolveAction/derived/poolFor/resolve/applyDamage/progression/actions
    attack.melee·attack.ranged·gift.activate; RollRequest.options = {stat, specialty?, armourPenalty?, extraDice?, destinyDice?≤5,
    difficulty? (=opposition dice), weaponId?, ranged?, giftId?}; groups tagged own/destiny/opposition; effects {destinyUp, fortuneRefill,
    patch, setback, ammoSpent, fortuneSpent}), `generator.ts` (concept→stats→specialties→destiny→gifts→summary, budgetOf, finalizeDraft),
    `locales.ts` es+en, 48 tests (`npm -w packages/system-plenilunio test`, wired into root `npm test`).
  - Web `apps/web/src/modules/characters/`: `domain/entities/Character.ts`, `domain/ports/CharactersPort.ts` (listMine, listByCampaign,
    getById, create, update(patch, origin), claim, remove, listAudit, uploadImage), `domain/useCases/characterRules.ts`,
    `infra/SupabaseCharactersRepo.ts`, `container.ts` (`charactersRepo`). **No UI, no routes yet.**
- Tests: web 102 · api 15 · system-plenilunio 48; typecheck OK; audit 0 hard; builds OK.
- Local test data (wiped by `db:reset`): players marta2@ejemplo.com / pip@ejemplo.com (pw supersecret1); campaign "Test chars" (DM admin).
- Known: `npm run dev:api` broken (pre-existing tsx watch arg order) → `cd apps/api && npx tsx --env-file=.env src/server.ts`.

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
**Open a new chat** and resume with: «Retomo Rolvium: lee WORK_STATE.md y ARCHITECTURE.md. characters slice 2 (UI + API) según
rolvium.pen. Flujo: design(check) → dev → review → qa».
1. `characters` slice 2 (design already in `.pen`: Personajes ZhUSp/B4Wasr (y13400), Personajes/Ficha aparte PiVhB (x3040,y4680; Ficha
   main frame qjLDu), Mesa/Plenilunio·Jugador zt5B6 (Ficha tab), Generador GjeeD/kB8pn (y6700), Mejorar ORP75/lMRPP (y12000), PL/*
   components in frame z84erH — node ids in memory `project_rolvium_pen`):
   a. `packages/ui`: neutral `<Sheet>` renderer driven by `sheetSchema` (sections/fields/types text·number·counter·boxes·select·list·
      table·health·stat·image; `derived` read-only; `action` icon buttons; tooltips from `references`), themed only via `--sys-*` vars.
   b. `modules/characters/ui`: `CharactersPage` (`/characters`, mine grouped by campaign, «Abrir en la mesa»/«Ver ficha», claim
      unassigned), `CharacterSheetPage` (`/characters/:id`, separate window, DM read-only→edit), `GeneratorWizard` (system
      `generator` steps + budgets, DM: kind + assign-to), `ProgressionPanel` (enabled/blocked with reason from `campaigns.progression_enabled`).
   c. Table `Ficha` tab (`modules/table`) renders `<Sheet>` for my character (or pick/create); «El grupo» lists PCs with avatar precedence
      (own → account → initials, `characterRules.characterAvatar`).
   d. API authority: `PUT /characters/:id/sheet` (verify token, membership, validate `data` against the system's `sheetSchema`, compute
      `derived`/`health` with the engine, persist with origin) and `POST /rolls` (CSPRNG dice, `engine.resolve`, immutable log — this
      belongs to `dice` H6; at least stub the port). Web repo `update` for sheet edits should move to the API once it exists.
   e. i18n `characters.*` es/en; nav `/characters` route (registry entry exists); tests per file (Level B).
2. Then `dice` (H6), `maps`, `chat/journal`, DM panel. Pending small items: DM management UI (regenerate code, requests, kick, archive,
   next session), leave campaign, WebP background, unit tests for packages/core, `campaigns_players_count` N+1 → set-returning RPC,
   fix `dev:api` script, `/systems` page (designed mTux7/J6LAv).
3. Owner decisions pending: preset 30 max stat 7 (prototype) vs 10 (old spec); confirm gift/specialty English names with the manual.

## 🚫 Blockers / notes
- No hosted Supabase (owner plan allows 2 projects) → local only; Vercel + `supabase link`/`db push` when table+characters+dice are playable.
  On hosted: verify `postgres` may DELETE from `auth.sessions`/`auth.refresh_tokens` (the identity RPCs rely on it) and that
  `site_url`/redirect allow-list include the Vercel domain (`/reset`, `/join/*`).
- Verify Realtime `postgres_changes` honours column grants (review says WALRUS does; re-check on hosted).
- Placeholder prod URLs in the harness (`rolvium.vercel.app`, `rolvium-api.vercel.app`).
