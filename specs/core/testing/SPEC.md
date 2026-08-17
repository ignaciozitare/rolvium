# Testing — SPEC

## Stack
vitest + @testing-library/react (jsdom) for `apps/web`; vitest (node) for `apps/api`.

## Layout
- `apps/web/src/**/*.test.tsx` — co-located component/hook tests (Level B: render + interactions + persistence + callbacks).
- `apps/web/tests/smoke/` — app boots, routing + auth gate. Runs on every commit.
- `apps/web/tests/regression/` — cross-cutting bug pins. Pre-merge to main.
- `apps/web/tests/functional/` — end-to-end-ish flows. Pre-deploy / critical modules (`auth`, `admin`).
- `apps/api/src/**/*.test.ts` — routes via `createApp()` with fake ports; pure use cases.

## Helpers (`apps/web/tests/helpers/`)
- `render.tsx` → `renderWithProviders(ui, { providers })` (router, react-query, i18n, dialog) + RTL re-exports + `userEvent`.
- `i18nWrapper.tsx` → `I18nTestProvider` (default `es`).
- `supabaseMock.ts` → `createSupabaseMock()` chainable client mock.
- `fakes.ts` → `fakeAuthRepo`, `fakeAdminDeps`, sample users/roles.

## Rules
- Every modified non-cosmetic file leaves at least one test (Review blocks otherwise).
- Mock at boundaries (ports/Supabase/fetch), never business logic. Prefer injecting fakes through props/`deps`.
- Scripts: `npm -w apps/web run test:smoke|test:regression|test:functional`, `npm -w apps/api run test`.
