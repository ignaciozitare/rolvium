# Journal (H9) — SPEC

> **Written to REBUILD the module from scratch**, not as a decisions diary — the nine-section template that
> `CLAUDE.md` § «Specs» mandates since 2026-09-17. English throughout; his own words are quoted verbatim in
> Spanish, because they are the evidence for why something is the way it is.

## Purpose

The two writing surfaces of a campaign, both in the table's side rail, today shipping as a «próximamente»
placeholder (`dice/ui/SidePanel.tsx`, tabs `notes` and `journal`):

- **Notas** — each person's own scratchpad for that campaign. **Private, with no exception: not even the GM
  reads them.**
- **Bitácora** — one shared document per campaign: what happened, session by session. Everyone reads and
  writes it.

**Who uses it:** every member of the campaign, GM and players alike, with the same rights on the Bitácora and
strictly separate Notas.

## What the user can do

**Any member**
- Open **Notas** from the table's side rail and write in **rich text**: headings (H1/H2), bold, italic, lists,
  quotes, dividers.
- Open **Bitácora** and write in the same editor, on the document shared by the whole campaign.
- **Press «Índice»** and get a navigation panel beside the text: every **H1**, and nested under each one, the
  **H2s that live inside it**. Clicking an entry scrolls the document to that heading.
- Watch it **save by itself** — no Save button; the header says «guardando…» / «guardado» with the time.
- Force a save with `Cmd+S`.

**Nobody can**
- Read another person's Notas — see § Permissions. The GM is not an exception, and neither is a platform admin.

## Screens

| Screen / part | What it is | Plate |
|---|---|---|
| Notas | Side-rail tab: the editor, filling the rail, plus the save indicator | ⏳ `rolvium.pen` — pending design |
| Bitácora | Same editor, shared document; header names the campaign | ⏳ `rolvium.pen` — pending design |
| Index panel | Opens beside the text on «Índice»: H1s with their H2s nested, click to jump | ⏳ `rolvium.pen` — pending design |
| Empty state | A campaign with nothing written yet | ⏳ `rolvium.pen` — pending design |

⚠️ **Not yet designed.** The `.pen` blueprint has to exist and be approved by him before a line of UI is
written (`CLAUDE.md` § Design Agent). These rows get their plate names once it does.

**The editor is not this module's.** It is a shared component in `packages/ui` — `Notas`, `Bitácora` and
`adventures` (H12) all mount the same one. See § Decisions.

**No light/dark here.** Both surfaces live under `.tb-root`, where the game system's theme rules (`--sys-*`).
App tokens are not used below the table (`specs/modules/table/SPEC.md` § Out of scope).

## Rules & limits

- **Notas are one per person and campaign.** The same person in two campaigns has two separate Notas.
- **Bitácora is one per campaign**, shared. Anyone who can enter the table can write in it.
- **A document is JSON, never HTML** — the same `{ v, blocks[] }` tree that `adventures` stores, painted by the
  client and never injected as markup (the project's XSS rule). One document vocabulary for the three
  surfaces, not two.
- **The index is computed, never stored.** It is read off the document's headings each time the panel opens,
  so it can never fall out of step with the text.
- **The index nests H2 under the H1 that contains it** — his words, 2026-09-19: «*le das al botón índice y te
  indexa todo lo que sea H1 y H2 de lo que esté en el h1 padre*». H2s written before any H1 hang at the root.
  Deeper levels (H3+) are not indexed.
- **One writer at a time on the Bitácora, in v1.** It saves with a delay, and if someone else's save landed
  first the second writer is told rather than silently overwritten (comparing `updated_at`) — the same rule
  `adventures` already sets.
- Size cap, same as an adventure: **200 KB per document**.

## States & errors

| State | When | What he sees |
|---|---|---|
| Empty | Nothing written yet | The editor, empty, with its placeholder line |
| Saving | A save is in flight | «guardando…» in the header |
| Saved | The save landed | «guardado» + the time |
| Save failed | Network or RLS refused | The notice stays, the text is NOT lost, and it retries |
| Conflict (Bitácora) | Someone else saved while you were writing | Told plainly, with the option to reload — never a silent overwrite |
| Index on an empty doc | «Índice» pressed with no headings | The panel says there are no headings yet |
| A broken part | The editor throws while painting | The net from `core/errors`: the rail falls, not the table |

## Permissions

| Action | Who | Role-engine key |
|---|---|---|
| Read / write **my** Notas | Their author, and only them | — (`user_id = auth.uid()` in RLS) |
| Read someone else's Notas | **Nobody** — GM and platform admin included | — (no policy grants it) |
| Read / write the **Bitácora** | Any member of the campaign | — (membership, via RLS) |

The Notas rule is deliberately stricter than the rest of the platform: this is the one table where
`public.is_admin()` does **not** open the door, for the same reason `chat`'s whispers don't — private has to
mean private, or nobody writes anything real in it.

## Data model

⏳ **Pending the DBA Agent** — migration not yet written. The shape this spec commits to:

```
journal_notes                                  journal_logbook
  id            uuid pk                          id           uuid pk
  campaign_id   uuid → campaigns_campaigns        campaign_id  uuid → campaigns_campaigns  (unique)
  user_id       uuid → users                      doc          jsonb not null default '{}'
  doc           jsonb not null default '{}'       updated_by   uuid → users on delete set null
  created_at / updated_at                         created_at / updated_at
  unique (campaign_id, user_id)
```

- `doc` is the **same block tree as `adventures_adventures.doc`** (`{ "v": 1, "blocks": [...] }`), minus the
  blocks that only make sense in an adventure (`sceneRef`, the npc/encounter tables). One schema, one painter.
- **RLS**, `TO authenticated` only, never `TO anon`:
  - `journal_notes`: every command gated on `user_id = auth.uid()`. No admin bypass.
  - `journal_logbook`: gated on being a member of the campaign, through the existing campaign helper.
- **No version history table in v1** — see § Out of scope.

## Out of scope

- **Version history of the Bitácora** (see and restore past versions, with author and date). The first draft
  of this spec promised it; it is a slice of its own, and he called this one «*sencillo*» (2026-09-19). The
  sibling module `adventures` deferred exactly the same thing, so deferring it here keeps the two consistent.
- **Live presence** («Laura está editando…») and concurrent editing / CRDT. Same reason.
- **Images inside a document**, import/export, printing.
- **Publishing a piece of an adventure into the Bitácora** — named as future in `adventures` (H12) and still is.
- **Sharing Notas** with anyone, under any flag. That is what the Bitácora is for.

## Decisions

- **The editor is built once, in `packages/ui`, and serves the three surfaces** (Notas · Bitácora ·
  Aventuras). There was no rich-text editor anywhere in the repo before this (checked 2026-09-19). Building it
  three times would be the exact duplication `CLAUDE.md` § Shared Packages forbids, and he ordered the three
  built together — «*haz las tres juntas*» (2026-09-19), after being told the first of them pays for the editor
  and the rest come cheap.
- **The index is a panel beside the text, not a block inside the document** (his call, 2026-09-19: «*al lado
  del navegador*»). It navigates; it does not become content that then has to be kept up to date.
- **No Save button**, on either surface — the same rule he set for `adventures` («*el editor guarda solo*»).
- **The document lives in the database, never in the front** — his general rule, recorded in `adventures`
  (2026-08-19): content is data, not code, so that something outside Rolvium (an MCP, a sync, an AI) can reach
  it one day.
- **No version history in v1**, decided by me and flagged to him rather than asked, because the first draft of
  this spec promised it and silence would have looked like it was coming.
