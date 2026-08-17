# Rolvium

Platform to play tabletop role-playing games online. Monorepo (npm workspaces):
`apps/web` (Vite + React), `apps/api` (Fastify), shared `packages/*`. Auth, users,
roles & permissions and the admin area are the base every game module builds on.

## Requirements
- Node ≥ 20, npm ≥ 10
- Docker Desktop + Supabase CLI (`brew install supabase/tap/supabase`) for the **local** database.

## Setup (local database — default)
```bash
npm install
npm run db:start          # boots Postgres + Auth + Studio in Docker, applies supabase/migrations, runs supabase/seed.sql
npm run dev:api           # http://localhost:3001  (reads apps/api/.env)
npm run dev:web           # http://localhost:5173  (reads apps/web/.env)
```
`apps/web/.env` and `apps/api/.env` are pre-filled for the local stack (URL `http://127.0.0.1:54321`,
demo keys). Studio: http://127.0.0.1:54323. Local dev admin (from `supabase/seed.sql`):
**admin@rolvium.local / rolvium123**.

- New migration: `npm run db:migration <name>` → edit the file → `npm run db:reset` (re-applies everything + seed).
- `npm run db:status` prints URLs/keys; `npm run db:stop` stops the containers (data persists).
- E-mails (sign-up confirmation, password reset) land in the local Mailpit inbox: http://127.0.0.1:54324. Reset links
  point at `http://localhost:5173/reset` (`site_url` in `supabase/config.toml`; a config change needs `db:stop` + `db:start`).

## Moving to a hosted Supabase project (later)
```bash
supabase login
supabase link --project-ref <ref>
supabase db push          # applies supabase/migrations to the remote (seed.sql is NOT pushed)
```
Then point `.env` files at the remote URL/keys and create the first admin: sign up a user (Auth →
Add user) — the trigger creates the profile as `player` — and promote it once in the SQL editor:
```sql
update public.users set role_id = (select id from public.roles where name = 'admin') where email = 'you@example.com';
```

## Scripts
| Command | What |
|---|---|
| `npm run dev:web` / `npm run dev:api` | Dev servers (web :5173, api :3001) |
| `npm run build:web` / `npm run build:api` | Vite build / API typecheck (Vercel bundles via `apps/api/bundle.mjs`) |
| `npm run typecheck` | tsc for web + api |
| `npm test` | All tests (web + api) |
| `npm run test:smoke` · `test:regression` · `test:functional` | Test tiers (see `specs/core/testing/SPEC.md`) |
| `npm run audit` | Deterministic compliance audit (hexagonal, security, RLS, design tokens, i18n) — 0 tokens |
| `npm run ui:catalog` | Regenerate `packages/ui/CATALOG.md` |
| `npm run db:start` · `db:stop` · `db:reset` · `db:status` · `db:migration <name>` · `db:push` | Local Supabase stack / migrations |

## Layout
See [ARCHITECTURE.md](ARCHITECTURE.md). Functional specs live in [specs/](specs/SPEC.md).
The dev-agent rules and pipeline (Spec → DBA → Scaffold → Design → Dev → Review → QA →
Deploy) live in [.claude/CLAUDE.md](.claude/CLAUDE.md).

## Deploy (Vercel)
Two Vercel projects pointing at this repo: **web** (root `vercel.json`, output
`apps/web/dist`) and **api** (root directory `apps/api`, build via `bundle.mjs`).
Env vars per project as in `.env.example`. Add the web preview/prod origins to
`ALLOWED_ORIGIN` on the api project (comma-separated).
