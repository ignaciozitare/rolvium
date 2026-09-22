# Errors while painting — the safety net — SPEC

## Purpose

So that an error **while the screen is being painted** breaks **only the affected part**, never the whole table.

His words, 2026-09-17: «*cualquier error al pintar te tumba la mesa entera en vez de estropear un trozo*».

**What exposed it** (v0.12.2, see § `core/realtime`): a realtime echo arrived without the `data` column of a
stroke, `DrawingShape` read `data.points` on nothing and threw **during render**. With no `ErrorBoundary`
anywhere in `apps/web`, React unmounts the **entire** tree on an uncaught render error: the table went
**blank**, mid-session, with the database perfectly intact. Reloading fixed it — which is the maddening part.

That particular hole is now closed at its source. This is the net for **the next one**, which will come: the
bug was one line and the consequence was total.

**Who uses it:** everyone, without doing anything. It is not a feature you turn on; it is a net you only ever
see when something has already gone wrong. **GM and players see the same thing.** No permissions involved.

## What the user can do

- Nothing, until something breaks. Then, in the hole left by the broken part: **read what happened** and press
  **Retry**, which remounts that part without reloading the page.
- In the last-resort, full-screen variant there is a second button: **Reload the page**.
- Everything else on screen keeps working and can still be used.

## Screens

| Screen / part | What it is | Plate |
|---|---|---|
| Broken part, inside the table | Paper card in the system theme, caps title, italic body, blood-red button | `rolvium.pen` § 11 · «Mesa/Un trozo se ha roto» |
| Broken screen, app chrome | `EmptyState` in amber, Retry + Reload the page | § 11 · «Error/La pantalla se ha roto» |

⚠️ **Two suits, and it is not a whim.** The four seams inside the table mount on the board, which is nearly
black under **any** theme; app tokens there measured **1.12:1** contrast — invisible — so inside the table only
`--sys-*` is used, which is what `table.css` mandates anyway.

## Rules & limits

### Where the nets go, outside in

The value is the **blast radius**. One net at the root turns «blank page» into «page with a message», which is
better but still loses everything. The inner ones are what save the session.

| Net | If what is inside throws… | …this stays alive |
|---|---|---|
| The whole app (`AppRouter`) | last resort | a page with a notice and a reload button, instead of blank |
| Each table tab (`TablePage`, `key={tab}`) | that tab falls | the other tabs and the navigation |
| The map (`SceneTab`) | the map falls | the toolbar, the panels and the rest of the table |
| Each floating panel (brush · builder · lights · props) | that panel falls | the map and the other panels |
| The layers panel | it falls | everything else |
| The table's side rail (`TablePage`, around `SidePanel`) | Notas, Bitácora, chat or the roll log fall | the tab, the map and the whole table |

**Nine instances, six kinds.** The side rail's was added on 2026-09-22 (4th QA of `journal`): its spec says
«the rail falls, not the table», and nothing was catching it — a throw in the shared editor took the table down
to the page-level net. It is the only one whose placement a test pins (`apps/web/tests/functional/table.test.tsx`);
removing any of the other eight today breaks no test — see § Out of scope.

### The rules themselves

- 🔑 **The net is never an excuse to stop fixing the cause.** A part that falls is a bug, not an acceptable
  state. When it fires, whatever made it fire gets fixed. The net only buys that the session is not lost.
- ⚠️ **It does not catch everything, and must not be sold as if it did.** A React net catches what throws
  **while painting** (and in lifecycle). It does **not** catch failures inside an event handler, inside a
  promise or an `async`, or on the server. Those paths still need their own error handling.
- Retry remounts the part from scratch. Anything unsaved in that part **is lost** — as it is today, except
  today the whole table is lost instead.
- A fallen part **must not drag its neighbours**: each net is independent.

## States & errors

| State | What he sees |
|---|---|
| Nothing broken | Nothing at all: the net adds no DOM when there is no error |
| A part broke, inside the table | Paper card: «Este trozo se ha roto» + «El resto de la mesa sigue funcionando…» + **Reintentar** |
| The screen broke | Amber notice: «Algo se ha roto en esta pantalla» + «No has perdido nada…» + **Reintentar** · **Recargar la página** |
| Retry, and it breaks again | The same card again. The underlying data is still bad; reloading is the next step |

The error is written to the browser console with the label of the part (`maps:canvas`, `table:scene`…), so it
can be diagnosed without guessing which one fell.

## Permissions

None. The net is not gated: GM and players get the same behaviour and the same wording.

## Data model

None. It touches no table, stores nothing and travels over no wire. No migrations.

## Out of scope

- ❌ **Sending errors to an external watchdog** (Sentry or similar). Decided with him on 2026-09-17: it is a
  separate thing with its own cost and its own privacy call. If it is ever wanted, `onError` on
  `ErrorBoundary` is the hook already waiting for it.
- ❌ Automatic retries, failure counters, or switching off a part «that fails a lot». Complexity with no case.
- ⏳ **Known debt, not closed:** the *placement* of eight of the nine seams is pinned by no test — remove a
  `SafeRegion` from `AppRouter` and the suite stays green. The behaviour is covered; the wiring is not. The
  exception is the side rail's (2026-09-22), whose placement `apps/web/tests/functional/table.test.tsx` pins.

## Decisions

- **Why a render prop and not a node** for the fallback: `@rolvium/ui` knows nothing about translations, the
  same way `Sheet` receives its own `t`. The package holds the behaviour; `apps/web` dresses it.
- **Amber, not red** (approved in the plate). Red in this family means «you did something wrong» — an invalid
  campaign code. This is not his fault and nothing is lost, and red would suggest otherwise.
- **Blood-red button inside the table, not gold.** The plate inherited gold from «Mesa/Reserva vacía», which
  is where it was copied from, but his standing rule wins: in the table, the active thing is blood. The
  `.pen` was corrected to match the code, not the other way round.
- **No reload button inside the table**: it would throw away the whole session over one broken part.
- **No global boundary beyond these nine.** His call; a net around everything would hide exactly the kind of
  bug this module exists to make visible.
