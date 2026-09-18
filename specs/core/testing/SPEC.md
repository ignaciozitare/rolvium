# Testing — SPEC

## Purpose

To make sure a change that already worked keeps working, and that a bug once caught can never come back
silently. **Who it serves:** whoever writes the next change — and him, because a green gate is what lets a
merge reach production without him having to test everything by hand.

**The rule that gives it teeth** (`CLAUDE.md`, zero tolerance): **every non-cosmetic file you touch leaves at
least one test that exercises it.** Review rejects the task and QA rejects the merge otherwise.

## What the user can do

Nobody "uses" this: it is infrastructure. What a **developer** does with it:

- `npm -w apps/web run test:smoke` — the app boots, routing and the auth gate. Every commit on a branch.
- `npm run test:regression` (root) — **the merge gate**. Four packages (see § Rules & limits).
- `npm -w apps/web run test:functional` — fuller flows. Pre-deploy, or pre-merge when touching `auth`/`admin`.
- `npm run typecheck` — web + api. ⚠️ Neither the build nor vitest checks types; see § States & errors.
- `npm run audit` — the free deterministic checker (hexagonal leaks, RLS, secrets, design tokens, i18n,
  specs). Zero token cost, and it is the first thing to run on any "check everything" request.

## Screens

None. This area has no user interface.

## Rules & limits

### Layout

| Path | What lives there |
|---|---|
| `apps/web/src/**/*.test.tsx` | Co-located component/hook tests (Level B: render + interactions + persistence + callbacks) |
| `apps/web/tests/smoke/` | App boots, routing, auth gate |
| `apps/web/tests/regression/` | Cross-cutting bug pins, one file per bug, named after the bug in his words |
| `apps/web/tests/functional/` | End-to-end-ish flows |
| `apps/api/src/**/*.test.ts` | Routes via `createApp()` with fake ports; pure use cases |
| `packages/core/src/**/*.test.ts` | Rules shared by browser and server |
| `packages/ui/src/**/*.test.{ts,tsx}` | The shared library: `compressImage` (pure node) and the components |

### Stack

vitest + @testing-library/react (jsdom) for `apps/web` **and for `packages/ui`** — since 2026-09-17, when its
first React component landed (`ErrorBoundary`): `vitest.setup.ts` with jest-dom and the same `cleanup` as
`apps/web`, and that file inside the tsconfig `include` so the matchers are typed. vitest (node) for
`apps/api` and `packages/core`.

### Helpers (`apps/web/tests/helpers/`)

- `render.tsx` → `renderWithProviders(ui, { providers })` (router, react-query, i18n, dialog) + RTL re-exports
  + `userEvent`.
- `i18nWrapper.tsx` → `I18nTestProvider` (default `es`).
- `supabaseMock.ts` → `createSupabaseMock()` chainable client mock.
- `fakes.ts` → `fakeMapsRepo` (with `emit()` for realtime echoes), `fakeAuthRepo`, `fakeAdminDeps`, sample
  users, roles, scenes, tokens and props.

### The merge gate

`npm run test:regression` (root) is **the command QA runs before every merge**, and since 2026-09-17 it is
**four** packages, not three:

```
apps/web (regression) · apps/api · packages/core · packages/ui
```

⚠️ `packages/ui` was added because its tests **were not running at the gate**: 31 of them existed and only
passed if someone ran them by hand. **A test that does not run at the gate holds nothing.**

### What NOT to do

- **Do not invent test cases at QA time.** QA runs the persisted suite; missing coverage is flagged, and the
  Dev Agent should have written it when the file was modified.
- **Do not delete or skip a failing test** to go green. Fix the cause or revert.
- **Do not mock business logic away.** Mock at boundaries (Supabase client, fetch, ports). Domain code runs
  for real.
- **Do not write a timing-based test.** See § Decisions.

### Cosmetic exception (narrow and auditable)

A file may pass without a new test only if its diff is CSS-only, copy strings, an icon swap, comments, a pure
rename or formatting. **Adding any branch — conditional, state, effect, prop, callback, early return, error
path — is not cosmetic.** If the exception is used, Review must list the file with a one-line justification,
and he can challenge any entry.

## States & errors

| Situation | What happens | Why it matters |
|---|---|---|
| A test fails at the gate | QA blocks the merge | Working as intended |
| `tsc` red, build green, tests green | **Nothing stops it** | Neither esbuild nor vitest checks types. Happened on 2026-09-17: a test file missing 14 required props left `typecheck` red while everything else was green. `npm run typecheck` has to be run **after** writing tests, not before |
| `packages/core` / `packages/ui` typecheck red | **Nothing stops it** | Root `typecheck` covers web + api only. Both are red today (`Sheet.tsx:531`, and two in `core`), pre-existing and undeclared |
| A test passes but does not pin anything | Nothing | The only defence is mutation: see § Decisions |

## Permissions

None: nobody needs a role to run tests.

## Data model

None. Tests never touch the real database: `apps/web` fakes the ports, `apps/api` injects fake ports into
`createApp()`. The local Supabase stack (`npm run db:start`) is for running the app by hand, never for tests.

## Out of scope

- **End-to-end tests against a live browser and a real database.** Playwright is available and has been used
  by hand to reproduce a bug, but it is not part of any gate.
- **Coverage percentages.** The rule is per touched file, not a global number: a percentage can be green with
  the important paths untested.
- ⏳ **Known gap, not closed:** `packages/core` and `packages/ui` typecheck are not in any gate.

## Decisions

- **A test that does not fail when you remove the fix is worth nothing** (learned the hard way, 2026-09-17:
  three of the day's tests claimed to pin something they did not). **Verify every new regression test by
  mutation**: break the fix, watch the test fall, restore. State it in the report.
- **Never build a race test out of clocks.** A `setTimeout`-based test is intermittent, and an intermittent
  test at the merge gate holds nothing. Release the promises by hand instead — one of the day's tests failed
  once in a full run for exactly this reason.
- **Name a regression file after the bug in his words**, not after the module. `salas-a-mano-alzada-no-se-borran-al-pintar`
  says what broke; `useScene.test` says nothing to the person who finds it in a year.
- **Run the free checker first.** For any audit/compliance/"check everything" request, `npm run audit`
  reproduces the mechanical findings at zero token cost; only escalate to LLM agents for the judgement parts.
