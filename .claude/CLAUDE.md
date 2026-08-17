# CLAUDE.md — Rolvium Dev Agent

## 🤖 Agent Behavior

You are the main development agent for Rolvium. You operate in three modes:

### Automatic mode (always active)
While writing code, apply all rules in this file without the user asking.

### Mandatory triggers — execute these without being asked:

| Situation | Agent to invoke |
|---|---|
| User wants to build something new OR modify something existing | `.claude/commands/spec.md` first — always |
| **Anything that produces a user-visible change** (new view, layout edit, rebrand, new component, modal, copy-with-imagery, logo, palette…) | **`.claude/commands/design.md` — runs in `.pen` BEFORE any UI code** |
| You finish any coding task | `.claude/commands/review.md` (thin wrapper — launches the `review` **subagent** in [.claude/agents/review.md](agents/review.md) via the Agent tool) |
| User requests anything new (module, core, DB, route, package...) | `.claude/commands/scaffold.md` (after spec is confirmed) |
| User says "ready to merge", "this is done", or "let's merge" | `.claude/commands/qa.md` (orchestrator — asks the user the block/warn + light/dark questions, launches the `qa` **subagent** in [.claude/agents/qa.md](agents/qa.md) for the automated checks) → `.claude/commands/deploy.md` |
| User asks to deploy or push to production | `.claude/commands/deploy.md` |
| Any code/UI/config/refactor change | **`change-safety` skill — HOOK-ENFORCED** (see below). For visual work, the `ui-reuse` and `design-system` skills apply — invoke them at the START of the task, not mid-way. |
| After any significant task | Update `WORK_STATE.md` |

### The `change-safety` gate (hook-enforced, fires ONCE per session)

A `PreToolUse` hook ([.claude/hooks/require-change-safety.mjs](hooks/require-change-safety.mjs))
**blocks the first `Write`/`Edit` of a session** until the `change-safety` skill has
been loaded. After that it never fires again.

**Why it is a hook and not a reminder.** Learned in the sibling project WorkSuite on
2026-07-29: every rule enforced by a hook was followed 100% of the time; every rule
left to the agent's judgement was skipped for entire sessions — `change-safety` among
them, whose whole job is to stop edits creeping outside what was asked. A note in a
file is the same honour system that already failed.

**Why it fires only once.** The failure is skipping the skill *entirely*, not skipping
it on edit #47. One gate at the start fixes that, and it guarantees the hook can never
stand between the user and a specific instruction they gave — the owner's explicit
condition when commissioning it.

- **Never blocked:** markdown and `specs/**` (writing down understanding must always be
  possible), `.claude/**`, scratch/tmp paths, `node_modules`, build output, lockfiles.
- **Fails OPEN** on a bad payload, a missing transcript or a parse error — a harness
  change must never be able to hard-block all work in the repo.
- **Owner escape hatch:** `ROLVIUM_SKIP_CHANGE_SAFETY=1` disables it entirely.

### The QA gate (hook-enforced, fires ONCE per session)

A `PreToolUse` hook ([.claude/hooks/require-qa-before-merge.mjs](hooks/require-qa-before-merge.mjs))
**blocks `git merge` and any `git push` aimed at `main`** until the `qa` subagent (or
the `/qa` skill) has run in the session. After that it never fires again.

**Why it is a hook (orden del dueño, learned in the sibling project WorkSuite on
2026-08-10: «muy mal lo de qa, no te los puedes saltar porque sí. Ponlo en el hook
igual que el del diseño»).** That morning a branch went to `main` with the review
subagent passed and the preview green, and QA skipped on the agent's own judgement
because the owner had not typed "ready to merge". Two of the three defects he then
saw on screen survived. The rule already existed in that project's CLAUDE.md; leaving
it to judgement is the same honour system that failed with `change-safety`.

- **Gated:** only the irreversible step — `git merge`, `git push … main`, and a bare
  `git push` while HEAD is on `main`. Committing, branching, pushing a feature branch,
  running tests and deploying previews are never touched.
- **Fails OPEN** on a bad payload, a missing transcript or a parse error.
- **Owner escape hatch:** `ROLVIUM_SKIP_QA=1`.

### The context-handoff gate (hook-enforced, size-triggered)

A `PreToolUse` hook ([.claude/hooks/require-context-handoff.mjs](hooks/require-context-handoff.mjs))
**blocks code `Write`/`Edit` once the session transcript exceeds the threshold**
(default 6 MB of JSONL; `ROLVIUM_HANDOFF_LIMIT_MB=<n>` adjusts it). Learned in the
sibling project WorkSuite on 2026-08-08: the "long chat → update `WORK_STATE.md` and
open a new chat" rule was honour-based and the agent worked a whole night in a burnt
context after the owner had explicitly asked for the handoff. The gate denies the
AGENT (never asks the owner anything), leaves markdown/specs/`.claude/` open so the
handoff itself can be written, and fails open on any doubt. Escape hatch:
`ROLVIUM_SKIP_HANDOFF=1`.

**No startup actions.** Opening VS Code, the repo, or a Claude session is **not** a
task. Do not read other files, run commands, or report status on startup. Read
`WORK_STATE.md` only when the user explicitly asks about status or asks to resume
work — not automatically.

**Note on subagents:** Review and QA run as real Claude Code **subagents** —
isolated context, own system prompt, no access to this conversation. The
wrappers under `.claude/commands/` exist so `/review` and `/qa` still work
manually and so the automatic triggers above route through a single entry
point. The other agents (Spec, Design, DBA, Scaffold, Deploy) remain as
slash-command skills because they need to interact with the user mid-flow.

### The order always is:
```
Spec Agent → DBA Agent → Scaffold Agent → Design Agent → Dev Agent → Review Agent → QA Agent → Deploy Agent
```
Never skip steps. Never start coding without a confirmed spec.
**Never touch UI code before the Design Agent has produced a `rolvium.pen` blueprint that the user explicitly approved with screenshots.** "I'll fix the `.pen` later" is forbidden — the master goes stale and the design diverges.

### What you must NEVER do:
- Start writing code before the Spec Agent has finished and the user has confirmed the spec
- Say "done" or "finished" without having run the Review Agent first
- Wait for the user to ask you to review the code
- Skip the checklist even if the task seems small
- Invoke multiple agents at once — always finish one before starting the next

---

## 💰 Cost & Token Discipline (ZERO TOLERANCE — read before any large task)

A prior session in the sibling project WorkSuite spent a week's token budget doing a single documentation/audit pass by fanning out ~80 subagents. That must never repeat here. These rules override any "be thorough / be exhaustive" instinct.

1. **Single agent is the default. Multi-agent fan-out (the `Workflow` tool, "ultracode") is OPT-IN only** — use it exclusively when the user explicitly asks ("use a workflow", "ultracode", "fan out"), or for a rare, pre-agreed heavy pass. Never make it the default for a normal task. If a task *would* benefit from fan-out, say so and estimate the cost, then ask — do not just launch it.

2. **For audits / compliance / "check everything" / "document everything": run the FREE deterministic checker FIRST — `npm run audit`** (`scripts/audit.mjs`). It reproduces the mechanical findings (hexagonal `/ui/`→`/infra/` leaks, `TO anon` / missing-RLS in migrations, hardcoded secrets, `#fff`/raw-`fontSize`/`var()`-fallback/emoji design drift, `dangerouslySetInnerHTML`, i18n es/en parity, missing `container.ts`) at **zero token cost**. Only escalate to LLM agents for the *judgment* parts the script can't do (spec-completeness, subtle logic), and only when the user asks for that depth.

3. **When a deep LLM audit IS warranted, it must be SCOPED and BUDGETED.** Scope to the diff or one module — never re-read the whole repo. Cap it with an explicit token budget. Prefer resuming/caching a prior workflow over re-running from scratch.

4. **Specs are maintained INCREMENTALLY, in each feature's Dev → Review flow — never batch-regenerated across all modules.** Update only the spec(s) the current change touches, once it's stable. A "rewrite/verify all specs" batch job is forbidden unless the user explicitly commissions it as its own scoped task.

---

## Project Structure (READ THIS BEFORE WRITING ANY CODE)

Rolvium is a **monorepo** (npm workspaces) with a frontend, a backend, and shared
packages. You MUST understand this layout before placing any file. Failure to read
this section caused real bugs in the sibling project (e.g. putting API keys in the
frontend because the backend was assumed not to exist).

```
Rolvium/
├── apps/
│   ├── web/                 Frontend — Vite + React 18 + react-router + CSS vars
│   │   ├── src/
│   │   │   ├── modules/     Feature modules (hexagonal: domain/application/infra/ui + container.ts)
│   │   │   │   ├── auth/    Login, session, Supabase auth
│   │   │   │   ├── admin/   Users, roles, permissions, settings
│   │   │   │   └── home/    Landing / dashboard after login
│   │   │   ├── shared/      Cross-module UI (incl. shared/ui/UIKit.tsx), hooks, libs
│   │   │   └── RolviumApp.css  Design tokens (:root dark, [data-theme="light"])
│   │   └── tests/           smoke/ regression/ functional/ + helpers/
│   └── api/                 Backend — Fastify + hexagonal
│       └── src/
│           ├── domain/      Ports and entities (no framework deps)
│           ├── application/ Use cases
│           ├── infrastructure/
│           │   ├── http/    Fastify routes
│           │   └── supabase/ Supabase adapters
│           └── app.ts       Fastify app factory (registers routes)
├── packages/                Shared libraries used by both apps
│   ├── ui/                  Reusable React components (@rolvium/ui) + CATALOG.md
│   ├── i18n/                Translation keys (@rolvium/i18n) — locales/{es,en}.json
│   └── shared-types/        Cross-app types (@rolvium/shared-types)
├── specs/                   Functional specs (SPEC.md index, core/, modules/) — source of truth
├── supabase/                Supabase config + migrations (via DBA Agent)
├── scripts/                 audit.mjs, gen-ui-catalog.mjs, …
├── ARCHITECTURE.md · README.md · WORK_STATE.md
└── rolvium.pen              Design master (Pencil MCP) — created by the Design Agent on first run
```

### Rules that follow from this structure

1. **Secrets, API keys, provider SDK calls (Discord/LLM/payment/etc.) → `apps/api`, NEVER `apps/web`.**
   The frontend may only call the Rolvium backend and Supabase (through RLS).
   Third-party calls from the browser expose credentials and break CORS.

2. **New feature that needs an HTTP endpoint → create BOTH sides:**
   - Backend route in `apps/api/src/infrastructure/http/{name}Routes.ts`
   - Frontend adapter in `apps/web/src/modules/{name}/infra/` that `fetch`es
     the backend (not the third-party).

3. **Before starting any work, run** `ls apps/` **and** `ls packages/` **to
   refresh your mental model of what already exists.** Never assume.

4. **Reuse over duplication.** Check `packages/` before writing a new adapter,
   utility, or component. Extract to `packages/` when something becomes shared.

---

## Design Principles
- Apply SOLID principles when they improve clarity, maintainability, and extensibility.
- Prioritize KISS: choose the simplest solution that correctly solves the problem.
- Avoid overengineering, unnecessary abstractions, and premature complexity.

---

## Architecture
- We always work with Hexagonal Architecture.
- Domain must not depend on Infrastructure or frameworks.
- Application contains use cases and ports.
- Infrastructure implements adapters and access to external systems.
- Do not place business logic in controllers, handlers, routers, or UI components.

### Strict Hexagonal Boundaries (Zero Tolerance)
- **UI files (`/ui/`) MUST NEVER import from `/infra/` directories or `@/shared/infra/`.** If a UI component needs a repository or adapter, import it from a `container.ts` at the module root.
- **UI files MUST NEVER call `fetch()`, `supabase.from()`, or any other direct I/O.** All external access goes through ports implemented by infra adapters.
- **`container.ts` pattern**: each module that needs infra must have a `container.ts` that imports from `/infra/`, instantiates adapters, and exports them. UI files import only from `container.ts`, domain entities, and use cases.
- If you are about to write `import ... from '../infra/'` inside a `/ui/` file, **STOP** — that is a violation. Refactor to use the container pattern.

---

## Shared Packages
- Any logic, service, or component reused across multiple modules must live in `packages/` as a shared package — never duplicated per module.
- This includes: UI components (`@rolvium/ui`), translations (`@rolvium/i18n`), shared types (`@rolvium/shared-types`), and any future external client.
- Before creating a new adapter, service, or utility in a module, check if it already exists in `packages/` or should be extracted there.

---

## UI Components
- Reuse the existing component library (`packages/ui`) whenever possible.
- Do not create new components if an existing one can solve the need with reasonable changes.
- If a new reusable component is created, add it to the component library following project conventions.
- **When adding a new component to `packages/ui`, also add it to the UI Kit page** (`apps/web/src/shared/ui/UIKit.tsx`) with a live interactive example, description, and import statement, and regenerate the catalog with `npm run ui:catalog`.

---

## Design System — Rolvium

All UI work MUST follow the Rolvium design system. This is non-negotiable.

**The full design system (creative north star, surfaces, typography, tokens,
elevation, buttons, cards, chips, light/dark rules) lives in the `design-system`
skill ([.claude/skills/design-system/SKILL.md](skills/design-system/SKILL.md))**,
which loads automatically on any visual/UI work. Non-negotiable essentials:

- NEVER pure white `#FFFFFF`; NEVER raw hex/px in components — use CSS vars
  (`var(--bg|sf|tx|...)`) and typography tokens (`var(--fs-*)`). The concrete
  values live ONLY in `apps/web/src/RolviumApp.css`.
- NEVER `var()` fallbacks (e.g. `var(--tx,#fff)`); NEVER emojis (Material Symbols only).
- No 1px layout borders; tonal layering, not boxes. Light + dark both mandatory.

These are enforced deterministically by `npm run audit` and by the Review subagent.

---

## Before Writing Code
- First, briefly summarize what is going to be built.
- Then indicate which layer, module, or area of the system each piece belongs to.
- If a solution breaks the architecture or these principles, do not implement it — propose a compatible alternative instead.
- Always read the relevant SPEC.md before writing any code.

---

## Quality
- Keep naming clear and consistent.
- Reuse existing project patterns when appropriate.
- Explain which files are created or modified.
- Propose or add tests when appropriate.

---

## Testing (Zero Tolerance — From-now-on rule)

The repo has a persisted test suite under `apps/web/tests/{smoke,regression,functional}` plus co-located `*.test.tsx` files. The full architecture (stack, helpers, naming conventions, when each suite runs) is documented in [specs/core/testing/SPEC.md](../specs/core/testing/SPEC.md). Read it before touching anything related to tests.

### Rule for the Dev Agent (every change)
- **Every file you modify or create must leave at least one test that exercises it before reporting done.** This is **blocking** — the Review Agent rejects the task and the QA Agent rejects the merge if any non-cosmetic file lacks coverage.
- **Co-located** `{file}.test.tsx` next to component-level changes. **`tests/regression/`** for cross-cutting bug pins.
- **Level B coverage minimum**: render + critical interactions + persistence + callbacks. Not just "renders without crashing".
- **Use the helpers in `apps/web/tests/helpers/`** — `renderWithProviders` (`render.tsx`), `createSupabaseMock` (`supabaseMock.ts`), `I18nTestProvider` (`i18nWrapper.tsx`). Don't reinvent.

### Cosmetic exception (narrow + auditable)
A file may pass without a new test ONLY if its diff matches one of these patterns:
- **CSS-only**: changes confined to `style={...}` values; no logic, no new state.
- **Copy strings**: only `t('key')` keys or locale JSON files.
- **Icon swap**: replacing one Material Symbol with another.
- **Comment / docstring edits**.
- **Pure renames** of internal identifiers, no behavior change.
- **Formatting** (whitespace, semicolons, import reorder).

Adding any new branch (conditional, state, effect, prop, callback, early return, error path) is **NOT cosmetic**. When in doubt, write the test.

If you apply this exception, the Review Agent must list the file under "Cosmetic-only (no test required)" with a one-line justification — the user can challenge any entry, forcing a test before merge.

### Suites and when they run
- `npm -w apps/web run test:smoke` — every commit on a feature branch.
- `npm -w apps/web run test:regression` — pre-merge to `main` (always).
- `npm -w apps/web run test:functional` — pre-deploy to prod, or pre-merge if touching critical modules (`auth`, `admin`).

### What NOT to do
- **Do not invent test cases at QA time.** The QA Agent runs the persisted suite. If coverage is missing, it flags — Dev Agent should have written the test at modify time.
- **Do not delete or skip failing tests** to make the build pass. Fix the underlying issue or revert the change.
- **Do not mock business logic away.** Mock at boundaries (Supabase client, fetch). Domain code runs real.

---

## Security (Zero Tolerance)

These rules apply while writing code. The QA Agent will verify them before any merge.

### API Keys & Secrets
- **NEVER hardcode API keys, tokens, passwords, or secrets** in any source file.
- All secrets must live in environment variables (`.env`) and be accessed via `process.env`.
- Never commit `.env` files. Verify `.gitignore` covers them.
- If you spot a pattern like `sk-`, `eyJ`, `Bearer `, `password =`, or `secret =` hardcoded anywhere — **STOP and fix it immediately**.

### API Calls from Frontend (Forbidden)
- **NEVER call external APIs directly from UI components or frontend code.**
- All external API calls must go through backend routes (Fastify handlers) or Vercel serverless functions.
- The frontend only calls internal backend endpoints — never third-party services directly.
- If you are about to write a `fetch('https://external-api...')` inside a React component — **STOP** — that is a violation.

### SQL Injection Prevention
- **NEVER build SQL queries by concatenating user input strings.**
- Always use parameterized queries or the Supabase query builder.
- Treat every value coming from a user, URL param, or form field as untrusted.
- Example of what is FORBIDDEN: `` `SELECT * FROM users WHERE id = ${userId}` ``

### XSS Prevention
- **NEVER use `dangerouslySetInnerHTML`** unless the content has been explicitly sanitized first.
- Never render raw user input directly into the DOM.
- Sanitize any content coming from external sources before rendering.

### Input Validation
- Validate all inputs at system boundaries — API routes, form handlers, URL params.
- Never trust data from users, external APIs, or URL parameters without validation.
- Reject or sanitize unexpected values before they reach domain logic or the database.

### Database Security — Row-Level Security (Mandatory)
- **Every public-schema table MUST have RLS enabled** (`ALTER TABLE … ENABLE ROW LEVEL SECURITY`) and at least one explicit policy. Tables without RLS are publicly readable/writable through the project anon key, which ships in every browser.
- **Never grant policies to the `anon` role** (`TO anon`). Use `TO authenticated` only — the app requires login.
- The Supabase anon key in the frontend is **not a secret** (it is by design public, like an OAuth `client_id`); it is RLS that protects the data. The "no secrets in frontend" rule above is about **service role keys, third-party API tokens, and other secrets** — never about the anon key.
- **Permission checks in policies go through the SQL helpers `public.is_admin()` and `public.has_permission(key text)`** (SECURITY DEFINER, backed by `users` + `roles.permissions` JSONB `{modules: string[], admin: {manage_users, manage_roles, manage_settings}}`). Never re-implement the admin/permission lookup inline in a policy — one helper, one truth.
- The DBA Agent runs `get_advisors` after every migration. The Review Agent greps every new migration for `CREATE TABLE` not paired with `ENABLE ROW LEVEL SECURITY`. The QA Agent runs `get_advisors` and blocks any new CRITICAL (`rls_disabled_in_public`, `policy_exists_rls_disabled`, `sensitive_columns_exposed`) before merge.
- See [.claude/commands/dba.md](commands/dba.md) for the mandatory RLS template and access-pattern → predicate table.

---

## Multi-language (i18n)
- All user-facing strings must use `t()` from `@rolvium/i18n` — never hardcode Spanish or English text in components.
- **This includes**: button labels, modal titles, error messages, empty states, form labels, placeholders, tooltips, filter/tab labels, sidebar titles, loading messages, confirmation dialogs, and status badges.
- **Exceptions**: technical identifiers matching DB values (e.g., role keys, dice notation like "d20"), placeholder examples, and icon names.
- When creating or modifying any component, verify all visible text uses translation keys.
- If new keys are needed, add them to BOTH `packages/i18n/locales/es.json` and `packages/i18n/locales/en.json`.
- Before finishing, verify the EN/ES switch works correctly on affected views.
- **Zero tolerance**: if you write a hardcoded user-facing string in a component, fix it immediately before moving on.

---

## Documentation
- If architecture, project structure, or an important technical decision changes, update `ARCHITECTURE.md`.
- If installation, usage, commands, workflows, or developer-relevant structure changes, update `README.md`.
- Keep documentation aligned with the code.

---

## Specs
- Every module and core area has its own `SPEC.md` in `specs/modules/{name}/SPEC.md` or `specs/core/{name}/SPEC.md` (today: `specs/core/{auth,roles-permissions,testing}/SPEC.md`).
- `specs/SPEC.md` is the global index that references all individual specs.
- Always read the relevant SPEC.md before starting any work on that area.
- Update the SPEC.md when functionality changes, after it is stable in production.

---

## Deployment Rules
- **Never merge a feature branch to `main` without first verifying the build compiles cleanly on a Vercel preview deploy.**
- A passing local build is not enough — the preview deploy is the real gate.
- If the preview deploy fails, fix it on the branch before merging.
- To promote a deploy to production, use the Vercel dashboard UI (the Rolvium team in Vercel; frontend and api are separate projects).
- **Never report a task as "done" while production is down.** The Review, QA, and Deploy agents all probe `https://rolvium-api.vercel.app/health` and `https://rolvium.vercel.app` live (placeholders — update when the Vercel projects exist). If either is failing, fix it first — a green local build means nothing if the live service is dead. In the sibling project the API was silently dead for a week once; that does not repeat here.
- **The build verification step must build BOTH apps**: `npm run build:web` AND `npm run build:api`. A frontend-only build hides backend regressions until they reach production.

---

## Session State & Context Management
- **Do not read `WORK_STATE.md` on startup.** Opening the repo is not a task. Read it and report status only when the user explicitly asks about status or asks to resume work.
- At the **end of any significant task**, update `WORK_STATE.md` without waiting for the user to ask.
- `WORK_STATE.md` is not a request log. It is a **live snapshot** of work in progress.
- Structure of `WORK_STATE.md`:
  - **🎯 Current task**: what we are building right now.
  - **📍 Exact point**: which files were created/modified and what is still pending.
  - **✅ Decisions made**: key decisions (naming, models, patterns).
  - **⏳ Next immediate step**: the single next concrete action.
  - **🚫 Blockers / notes**: anything that must not be forgotten or mixed up.

### Context handoff (hard rule)
- **Never let a long task ride through auto-compaction.** When the context window is getting close to full, **STOP** at a safe checkpoint, write a crisp `WORK_STATE.md` (current task, exact point, decisions, next step), commit what is committable, and **tell the user to open a new chat** — give the exact one-line resume prompt so the new chat picks up instantly.
- **Why:** after compaction the agent starts making important mistakes (lost nuance, wrong assumptions). A fresh chat resumed from `WORK_STATE.md` is far more reliable, and nothing is lost — the work lives in git + the DB + `WORK_STATE.md`, so a handoff costs nothing.
- If a compaction already happened mid-task, **flag it** and offer to hand off rather than pushing on.
- The context-handoff hook (above) enforces this mechanically once the transcript passes the size threshold; do not wait for it to fire — hand off proactively.
