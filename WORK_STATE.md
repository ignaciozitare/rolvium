# WORK_STATE.md — Rolvium

## 🎯 Current task
Building the v1 hexagons in order (map: ARCHITECTURE.md "Product hexagons"; specs: specs/modules/*).
**DONE 2026-08-17:** design (`rolvium.pen`, approved) · specs for all hexagons · `packages/core` · `system-plenilunio` skeleton ·
`campaigns` (H2) · `table` (H3) shell · login page from design · `@rolvium/ui` primitives · security hardening after review ·
**`identity` (H1)** (this session, review APPROVED WITH NOTES, QA see below).
**NEXT:** `characters` (H4, Plenilunio engine + sheet + generator) → `dice` → `maps` → `chat/journal` → DM panel.

## 📍 Exact point (2026-08-17 late night)
- `identity` built end-to-end: routes `/signup`, `/join`, `/join/:code` (public invite preview via API `GET /invites/:code`,
  sign-up → join → `/table/:id`; signed-in visitor sees only "Unirme"; "Iniciar sesión con el código" path), `/forgot` → mail →
  `/reset`, `/account` (Perfil + avatar upload/crop to Storage `avatars/{uid}/avatar.png` · Contraseña y acceso · Dispositivos
  via RPCs `identity_my_sessions`/`identity_revoke_session` on `auth.sessions` · Idioma y tema saved to `users.locale/theme_pref`).
  User menu → "Cuenta". Theme now lives in `shared/hooks/useTheme.tsx` (`ThemeProvider`, dark/light/system) and
  `PreferencesSync` applies profile locale+theme once per sign-in. `AuthShell` = shared hero for every `Auth/*` screen.
- Migration `20260818000000_identity_profile_sessions_avatars.sql` (users.alias/locale/theme_pref + checks, sign-up trigger copies
  alias/locale, 2 SECURITY DEFINER RPCs scoped to auth.uid(), bucket `avatars` public-read + owner-folder policies).
  Local stack: 5 migrations apply clean, `db lint` empty, e2e verified with curl (signup metadata → users row, join, avatar RLS
  own/other folder, guard email, theme check, recover mail `redirect_to=/reset`).
- `supabase/config.toml`: `site_url = http://localhost:5173`, redirect allow-list `localhost:5173/**` (needed `db:stop`+`db:start`).
- Tests: web 92 · api 15 green; typecheck OK; `npm run audit` 0 hard (warns = pre-existing inline buttons in UserMenu);
  builds OK. Review subagent = **APPROVED WITH NOTES** (added `SupabaseAuthRepository.test.ts` for `mapProfileRow`).
- Design: `.pen` gained `Auth/Registro` GdPGz/jEhok, `Auth/Recuperar contraseña` BC5HL/SlkGn, `Auth/Restablecer contraseña`
  OZtnB/qa5me (row y=17400) and the «Contraseña y acceso» section in Cuenta (SOUyO/MUQjG, height 1130).
  **⚠ The `.pen` tab must be saved by the owner (Cmd+S) — the Pencil buffer could not be flushed from the agent
  (no Accessibility permission for osascript). Check `ls -la rolvium.pen` mtime before committing it.**
- Dev: `npm run dev:web` → http://localhost:5173. **`npm run dev:api` is broken (pre-existing: `tsx --env-file=.env watch` arg
  order with tsx 4.x/Node 26)** → run `cd apps/api && npx tsx --env-file=.env src/server.ts` meanwhile. Test users this session:
  marta2@ejemplo.com / supersecret1 (player, member of "Las ruinas de Manhattan" code NFTE-8RGX, DM = admin). `db:reset` wipes them.

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
1. Owner: save `rolvium.pen` (Cmd+S), do the light/dark pass on `/signup`, `/join/:code`, `/forgot`, `/reset`, `/account`,
   then commit the `.pen`.
2. `characters` (H4): port the validated JSX engine (`~/Documents/Developer/Rolvium context/plenilunio-vtt-prototipo.jsx`)
   to `packages/system-plenilunio` (sheetSchema, catalogs, references, engine with tests vs manual examples, generator),
   migration `characters` + audit trigger, generic `<Sheet>` in the table's Ficha tab. Then wire nav `/characters`, `/systems`.
3. Pending small items: DM management UI (regenerate code, requests, kick, archive, next session — port/DB ready),
   leave campaign, WebP background, unit tests for packages/core, `campaigns_players_count` N+1 → set-returning RPC,
   fix `dev:api` script, `/join` intent after e-mail confirmation on hosted (done via emailRedirectTo — verify there).

## 🚫 Blockers / notes
- No hosted Supabase (owner plan allows 2 projects) → local only; Vercel + `supabase link`/`db push` when table+characters+dice are playable.
  On hosted: verify `postgres` may DELETE from `auth.sessions`/`auth.refresh_tokens` (the identity RPCs rely on it) and that
  `site_url`/redirect allow-list include the Vercel domain (`/reset`, `/join/*`).
- Verify Realtime `postgres_changes` honours column grants (review says WALRUS does; re-check on hosted).
- Placeholder prod URLs in the harness (`rolvium.vercel.app`, `rolvium-api.vercel.app`).
