# Testing — SPEC

## Stack
vitest + @testing-library/react (jsdom) for `apps/web` **y para `packages/ui`** — desde el 2026-09-17, cuando
entró su primer componente de React (`ErrorBoundary`): `vitest.setup.ts` con jest-dom y el mismo `cleanup` que
`apps/web`, y ese fichero dentro del `include` del tsconfig para que los matchers tengan tipos. vitest (node)
para `apps/api` y `packages/core`.

## Layout
- `packages/ui/src/**/*.test.{ts,tsx}` — la librería compartida: `compressImage` (node puro) y los componentes.
- `packages/core/src/**/*.test.ts` — reglas que comparten navegador y servidor.
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

## La puerta del merge

`npm run test:regression` (en la raíz) es **el comando que corre el QA antes de cada merge**, y desde el
2026-09-17 son CUATRO paquetes, no tres:

```
apps/web (regresión) · apps/api · packages/core · packages/ui
```

⚠️ `packages/ui` se añadió porque sus tests **no corrían en la puerta**: se escribieron 31 y sólo pasaban si
alguien los lanzaba a mano. Un test que no corre en la puerta no sujeta nada.

## Rules
- Every modified non-cosmetic file leaves at least one test (Review blocks otherwise).
- Mock at boundaries (ports/Supabase/fetch), never business logic. Prefer injecting fakes through props/`deps`.
- Scripts: `npm -w apps/web run test:smoke|test:regression|test:functional`, `npm -w apps/api run test`.
