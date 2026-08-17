# Rolvium

Platform to play tabletop role-playing games online. Monorepo (npm workspaces):
`apps/web` (Vite + React), `apps/api` (Fastify), shared `packages/*`. Auth, users,
roles & permissions and the admin area are the base every game module builds on.

## Requirements
- Node ≥ 20, npm ≥ 10
- A Supabase project (Auth + Postgres). Apply `supabase/migrations/*.sql` in order.

## Setup
```bash
npm install
cp .env.example apps/web/.env        # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL
cp .env.example apps/api/.env        # SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ALLOWED_ORIGIN, PORT
```
Create the first admin: sign up a user in Supabase Auth (dashboard → Authentication →
Add user). The `on_auth_user_created` trigger creates the profile with role `player`;
then run once in the SQL editor:
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

## Layout
See [ARCHITECTURE.md](ARCHITECTURE.md). Functional specs live in [specs/](specs/SPEC.md).
The dev-agent rules and pipeline (Spec → DBA → Scaffold → Design → Dev → Review → QA →
Deploy) live in [.claude/CLAUDE.md](.claude/CLAUDE.md).

## Deploy (Vercel)
Two Vercel projects pointing at this repo: **web** (root `vercel.json`, output
`apps/web/dist`) and **api** (root directory `apps/api`, build via `bundle.mjs`).
Env vars per project as in `.env.example`. Add the web preview/prod origins to
`ALLOWED_ORIGIN` on the api project (comma-separated).
