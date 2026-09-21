# Adventures (H12) — SPEC

> **Written to REBUILD the module from scratch**, not as a decisions diary — the nine-section template that
> `CLAUDE.md` § «Specs» mandates since 2026-09-17. English throughout; his own words are quoted verbatim in
> Spanish, because they are the evidence for why something is the way it is.
>
> Rewritten to the template on 2026-09-20, when the module started being built. Nothing was dropped: the eleven
> numbered decisions of 2026-08-19 and 2026-09-19 are kept word for word in § Decisions, and the rest of the old
> text is redistributed into the sections it belongs to.

## Purpose

Inside a campaign, the **GM** writes and organises **adventures**: the script of a story, with its text, its
scenes and its encounters. It is where the GM prepares the session before sitting at the table, and where they
jump from to the scene that comes next.

Before this, scenes hung straight off the campaign and there was nowhere to write anything: preparation lived
outside Rolvium (a document somewhere else) and the table only had the map.

**Who uses it:** the **GM** of the campaign, and nobody else. A platform admin can reach it (support); a player
cannot, not even by asking for one by its id — see § Permissions.

## What the user can do

**The GM**
- **Open the AVENTURAS tab** of the table, next to BESTIARIO. Only they have it.
- **See the adventures of the campaign** in the rail, numbered in their order, with their state (draft ·
  running · done) and how many scenes each one has. The archived ones wait folded underneath, in
  «ARCHIVADAS · n»; unfolded, they open and read like the others.
- **Create an adventure**: a title, and little else — the rest is written inside.
- **Write the adventure** in rich text: headings (H1/H2), paragraphs, bold, italic, lists, quotes (to read out
  loud) and dividers.
- **Insert a PNJ or encounter table** from the editor, with a ready-made template:
  - *PNJ*: name · what it is · what it wants · notes.
  - *Encounter*: PNJ · how many · difficulty · notes.
- **Press «Índice»** and get a navigation panel beside the text: every **H1** with its **H2s** nested under it.
- **Link a scene** from the text: a chip that opens it at the table.
- **Manage the scenes of the adventure**, from the three dots of each scene in the rail:
  - **create** one with the «+» of «ESCENAS DE ESTA AVENTURA» — it asks for the name, exactly like «+ ESCENA» at
    the table, and it is born in THIS adventure;
  - **rename** it;
  - **move it up / down** inside the adventure;
  - **move it to another adventure** — a list beside the menu with the other adventures of the rail. The scene
    goes whole, with everything inside it; it is never copied;
  - **open it at the table** — clicking the scene itself, as before.
  Deleting a scene is NOT here: it stays where it always was, in the table's scene rail.
- **Mark an adventure as running**, from its three dots or from the header of the document. Only one is running:
  it is the one the tab opens, and where the scenes created from the table go.
- **Change the state** from the header of the document: the state is a button that drops down «Borrador · En
  curso · Terminada».
- **Move an adventure up / down** in the rail, from its three dots.
- **Archive** an adventure (it is not deleted: it leaves the rail and waits in «ARCHIVADAS»), and **take it out
  of the archive** (it comes back at the end of the rail, as a draft).
- **Delete** an adventure. Without scenes it only asks for confirmation. With scenes it first asks **which
  adventure they go to** — they are never deleted with it.
- **Open the adventure in a separate window**, the same pattern as a character sheet, to read it while the map
  stays on the other screen.
- Watch it **save by itself** — no Save button; the header says «guardando…» / «guardado» with the time, and
  `Cmd+S` forces a save.

**The player**
- **Does not see adventures.** It is the GM's material. The player still sees only the active scene, or the one
  marked visible, exactly as before.

## Screens

| Screen / part | What it is | Plate |
|---|---|---|
| Adventures tab | The table's AVENTURAS tab: rail of adventures + their scenes · index panel · the document, on the game system's paper | § 4 · `Mesa/Plenilunio · Director · AVENTURAS · sólo el director` |
| Separate window | The same notebook for ONE adventure, without the rail, opened by «ABRIR APARTE» | § 4 · `Aventuras/Aventura en ventana aparte` |
| Index panel | Opens beside the text: H1s with their H2s nested, click to jump | Inside both plates above |
| Editor bar | H1 · H2 · bold · italic · lists · quote · divider · PNJ/encounter table · link a scene | Inside both plates above |
| Menu of an adventure + the state | The three dots of an adventure (mark running · up · down · archive · delete) and the state drop-down of the header | § 4 · `Aventuras/Carril · MENÚ DE UNA AVENTURA y el ESTADO` |
| Menu of a scene | Rename · up · down · move to another adventure, with the list of adventures beside it | § 4 · `Aventuras/Carril · MENÚ DE UNA ESCENA · mover a otra aventura` |
| Archived + delete | «ARCHIVADAS» unfolded with «Sacar del archivo», and the dialog that asks where the scenes go | § 4 · `Aventuras/ARCHIVADAS y BORRAR una aventura con escenas` |

Approved by him on 2026-09-19 («*aprobado*»); the separate window on 2026-09-20; the rail controls on
2026-09-21 («*aprobado*»).

**The rail**, left side: the adventures of the campaign, and under them the scenes of the open one. The «+» of
each block creates. Collapsible, like the table's scene rail.

**The document header**: the editable title, the **state** (a drop-down in the tab; read-only in the separate
window, which cannot see the other adventures), the save indicator and the **open-in-a-separate-window** button.

**The three dots** sit on every adventure and every scene of the rail, like the scenes of the table's rail. The
menu floats FIXED to the window, never inside the rail: the rail scrolls and would clip it (the lesson of the
table's scene menu, «*que el modal quede por encima, que no se tape*»). It closes on a click outside, on Escape
(focus back to its three dots) and when the window scrolls or resizes. The open adventure is painted in blood,
never in black.

⚠️ **The known trap of the separate window** (carried over from the character sheet, and the reason
`sheet-standalone-scroll.test.tsx` exists): the standalone page **must NOT inherit `.tb-root`**, which carries
`height:100dvh; overflow:hidden` and would leave it with no scroll. Same pattern as «Abrir ficha aparte», same
trap, same test to pin it.

**No light/dark here.** The whole surface lives under `.tb-root`, where the game system's theme rules
(`--sys-*`). App tokens are not used below the table (`specs/modules/table/SPEC.md` § Out of scope).

**The editor is not this module's.** It is a shared component in `packages/ui` — `Notas`, `Bitácora` and
`adventures` all mount the same one (see § Decisions, point 6).

## Rules & limits

- Only the **GM of the campaign** (and a platform admin) reads or writes adventures. The player does not list
  them, and cannot fetch one by its id.
- **Every campaign has adventures.** There are no loose scenes: the migration created an «Aventura 1» per
  campaign and hung the existing scenes off it, and a trigger gives every new campaign its own.
- A scene belongs **always and only** to one adventure, of the same campaign. Moving a scene between adventures
  is changing its `adventure_id`, never duplicating it.
- **Creating a scene never has to name an adventure**: if none is given, the database drops it into the
  campaign's running adventure (or the first of the rail). The table's scene rail knows nothing about
  adventures, and that is fine.
- Deleting an adventure **does not delete its scenes**: it asks first where they go, or it is archived.
- The document is **single-author at a time** in v1: no concurrent editing, no CRDT. It saves with a delay, and
  a save that would overwrite someone else's is refused and reported (comparing `updated_at`).
- **Only ONE adventure is running.** Marking another one passes the one that was running to **done**.
- **The last adventure of the campaign cannot be deleted** (archived ones count): its scenes would have nowhere to
  go. It can be archived; if every adventure ends up archived, a scene created from the table gets a new
  «Aventura 1» from the database trigger.
- **Order**: up / down swap places with the neighbour. Ties in `sort_order` are real (every adventure used to be
  born with 0; the table numbers its scenes with `scenes.length`), so the move redistributes the existing slots
  and breaks ties — the same rule as the terrain layers. A new adventure, or one taken out of the archive, goes
  at the end. The list is ordered by `sort_order` and then `created_at`, so ties never shuffle between loads.
- **Everything written to the open adventure goes through ONE queue**, with ONE timestamp per adventure. Any
  change of the row —title, state, order— moves `updated_at` (`adventures_touch`), and the text is saved against
  it: without the queue, renaming and then writing reported a conflict nobody had caused (measured on his local
  database, 2026-09-21). Text still pending when the tab jumps to another adventure (archiving or deleting the
  open one) is saved into ITS adventure, with ITS timestamp.
- **200 KB per document**, checked before every save: over it, the save is not sent, the header says so, and
  the text stays on screen.
- **50 adventures per campaign is the size the rail is designed for, NOT a lock**: nothing stops the 51st. The
  spec of 2026-08-19 called both figures «orientativos»; the 200 KB one protects the document from becoming
  impossible to open, the 50 one protects nothing, so it is not enforced (decided 2026-09-21, when the second QA
  found it written and unchecked).
- Title: 1 to 120 characters, enforced by the database.

## States & errors

| State | When | What the GM sees |
|---|---|---|
| Empty | A campaign that has never been written in | «Aventura 1» in the rail, an empty document with its placeholder line |
| Loading | Opening the tab | The rail and the sheet in their loading state, never a blank tab |
| Saving | A save is in flight | «guardando…» in the document header |
| Saved | The save landed | «guardado» + the time |
| Save failed | Network or RLS refused | The notice stays, the text is NOT lost, and it retries |
| Conflict | The tab and the separate window (or two admins) saved the same document | Told plainly, with the option to reload — never a silent overwrite |
| Index on a document with no headings | «Índice» pressed | The panel says there are no headings yet |
| Deleting an adventure that still has scenes | Its menu → «Borrar aventura» | A dialog: «Tiene n escenas, y las escenas no se borran con ella». The other adventures to choose from (rail first, archived last), the RUNNING one preselected; «MOVER Y BORRAR» moves them first and only then deletes (the database would refuse otherwise: `ON DELETE RESTRICT`) |
| Deleting an adventure without scenes | Its menu → «Borrar aventura» | A plain confirmation |
| The last adventure of the campaign | Its menu | «Borrar aventura» switched off, with the reason underneath |
| Moving a scene with no other adventure | The scene's menu | «Mover a otra aventura» switched off, with the reason underneath |
| Every adventure archived | The tab | The rail with «ARCHIVADAS», and a line saying none is left in the rail |
| An action of the rail fails | Network or RLS refused (mark running, order, archive, delete, scenes…) | A line in the rail («No se ha podido hacer…») and the rail reloads what is REALLY in the database, without flashing |
| A broken part | The editor throws while painting | The net from `core/errors`: the tab falls, not the table |
| A player who somehow reaches it | Direct URL / id | Nothing: for them the row does not exist |

## Permissions

| Action | Who | How it is enforced |
|---|---|---|
| List / read / write adventures | The **GM** of that campaign | RLS: `public.is_campaign_dm(campaign_id)` |
| Same, for support | A platform admin | RLS: `public.is_admin()` |
| Anything, as a player | **Nobody** | No policy grants it — the row does not exist for them |

There is **no new role-engine key**: being the GM of the campaign is what decides, and that already exists.
Proved, not assumed (2026-09-19, inside a rolled-back transaction): a REAL player of his campaign sees **0**
adventures, even asking for one by its exact id.

**`maps_scenes` does not change its policies.** Its access already goes by campaign (`is_campaign_dm`, plus
`maps_scene_visible` for the player), and the adventure is the GM's — so hanging a scene off an adventure adds
no new way in and takes none away. The new column is data, not a permission boundary.

## Data model

Migrations, in this order: `supabase/migrations/20260919120100_adventures_aventuras.sql` (the table, the column
on scenes and the seed trigger), `20260920090000_maps_scenes_adventure_por_defecto.sql` (a new scene falls into
an adventure by itself) and `20260920093000_maps_scenes_aventura_de_su_campana.sql` (a scene can only hang off
an adventure of ITS OWN campaign). All applied and verified on the local stack; `supabase db lint --local
--level error` reports nothing.

```
adventures_adventures
  id             uuid pk
  campaign_id    uuid not null → campaigns_campaigns(id) on delete cascade
  title          text not null (1..120)
  summary        text                          -- one line, for the rail
  doc            jsonb not null default '{"v":1,"blocks":[]}'
  status         text not null default 'draft' check in ('draft','running','done','archived')
  sort_order     int  not null default 0
  created_by     uuid → users(id) on delete set null
  created_at / updated_at  timestamptz          -- updated_at moved by `adventures_touch` on ANY update
  unique (id, campaign_id)                      -- adventures_id_campaign_key: the target of the scene's key

maps_scenes
  + adventure_id uuid not null
  foreign key (adventure_id, campaign_id) → adventures_adventures(id, campaign_id) on delete restrict
                                                -- maps_scenes_adventure_fkey
```

- **The scene's key is COMPOSITE** (`20260920093000`): until then the foreign key only proved the adventure
  EXISTS, not whose it is — a GM could, with an id at hand, hang his scene off another campaign's adventure and
  the database accepted it. Not a privacy hole (RLS of both tables still rules what each one sees), but broken,
  silent data: the scene would vanish from its campaign's rail. With `UNIQUE (id, campaign_id)` on the adventure
  and the composite key from the scene, both campaigns have to be the same.

- The author is filled from **`campaigns_campaigns.dm_id`** — that table has no `created_by`.
- **Migration of what already existed**: for every campaign, create «Aventura 1» (status `running`) and put its
  id on all of its scenes. Campaigns without scenes get one too, so the rule «every scene has an adventure» has
  no exceptions. The column went in nullable, was filled, and only then set `NOT NULL`.
- **Two triggers, both in the database and not in the screen**, for the same reason the GM role is: they are
  invariants of the campaign, not steps a screen (or the next one somebody writes) can forget.
  - `campaigns_seed_adventure`: every new campaign is born with its «Aventura 1».
  - `maps_scenes_default_adventure`: a scene inserted without an adventure falls into the campaign's running
    one (or the first of the rail; if the campaign has none left, it gets its «Aventura 1» there and then).
    Added on 2026-09-20 after **proving by running it** that creating a scene from the table's rail failed with
    `null value in column "adventure_id" … violates not-null constraint`.

### The document (`doc`)

JSON, never HTML: it is painted by the client and never injected as markup (the project's XSS rule). A block
tree, each block with its `type`. The shape lives in code at `packages/core/src/richDoc.ts` (`parseDoc` is the
only way in, and it drops what it does not understand instead of breaking the screen).

```
{ "v": 1, "blocks": [
  { "id": "…", "type": "heading", "level": 2, "text": [...] },
  { "id": "…", "type": "paragraph", "text": [...] },
  { "id": "…", "type": "quote", "text": [...] },              // to read out loud
  { "id": "…", "type": "list", "ordered": false, "items": [[...], ...] },
  { "id": "…", "type": "divider" },
  { "id": "…", "type": "sceneRef", "sceneId": "uuid", "label": "El sótano" },
  { "id": "…", "type": "table", "kind": "npc" | "encounter" | "plain",
    "columns": ["PNJ", "N.º", "Notas"],
    "rows": [ { "cells": [[...], ...], "npcId": null } ] }
]}
```

- `text` is an array of spans `{ "t": "…", "b": true, "i": true }` — bold and italic, and little else.
- **`npcId` is on every row from day one**, always `null` in v1. It is the hole the Bestiary (H5) will fill
  without migrating a single document.
- `sceneRef` is what ties the text to the table: a chip with the scene's name in the editor, a button that
  opens it when reading. It carries the `label` it was written with, so a renamed or deleted scene cannot break
  the document.
- **`id` per block** (added 2026-09-20, the only addition to the shape closed on 2026-08-19): it is what the
  index jumps to. Without it the index could only point at a position, which moves as soon as anything is typed.
- **`journal` (H9) uses the same tree**, minus `sceneRef` and `table` — one vocabulary, one painter, one editor.

### Connections

| With | What for |
|---|---|
| `campaigns` (H2) | whose adventure it is, and who the GM is |
| `maps` (H7) | scenes hang off the adventure (`Scene.adventureId`); `sceneRef` opens one from the text |
| `table` (H3) | it is a tab of the table, GM only |
| `journal` (H9) | the shared rich-text editor and the block vocabulary |
| `bestiary` (H5) | **future**: fill `npcId` and drop an encounter into the scene |

## Out of scope

- A hard cap on the number of adventures of a campaign (see § Rules & limits: 50 is a design size, not a lock).
- Linking real PNJs (needs H5) · dropping an encounter onto the map from the table.
- Two GMs editing at once · version history of the document.
- Images inside the document · import / export.
- Sharing the adventure with the players, or publishing a piece of it into the Bitácora (named as future in
  `journal` H9, and still future).

## Decisions

### His, 2026-08-19 (points 1 to 5, when the spec was closed)

1. **Every campaign has adventures.** No loose scenes: the migration creates one «Aventura 1» per campaign and
   hangs the existing scenes off it. One single way to organise.
2. **PNJ and encounter tables are rich text in v1.** They are written and read inside the document, like in a
   printed manual. Linking them to real entities requires the **Bestiary (H5)**, which is not built, and is
   another slice.
3. ⚠️ *(Read together with points 10 and 11, which overrule the first sentence.)* **Its own section in the
   platform header**, not one more tab of the Table. With a **side rail** of adventures (1, 2, 3…) OneNote
   style, and **openable in a separate window** like a character sheet.
4. **The editor saves by itself.** No Save button.
5. **All content lives in the DATABASE, never in the front.** A general rule of his, not only for adventures:
   characters, encounters and adventures are data, not code. The intent is to be able to reach them from
   outside one day —an MCP, a Drive sync, an AI that reads them— and that only works if the source is the
   database. See § «Debt this uncovers».

### His, 2026-09-19 (points 6 to 11, when he ordered it built)

6. **It is built TOGETHER with Notas and Bitácora** (`journal`, H9): «*haz las tres juntas*». The three are
   rich text and **share ONE editor**, built once in `packages/ui` and not three times (`CLAUDE.md` § Shared
   Packages). Before this there was no rich-text editor anywhere in the repo — checked 2026-09-19.
7. **The «Índice» button**, the same one as Notas and Bitácora: it opens a panel **BESIDE the text** —not a
   block inside the document— with every **H1** and, nested under each one, **the H2s that live inside it**
   («*le das al botón índice y te indexa todo lo que sea H1 y H2 de lo que esté en el h1 padre*» · «*al lado
   del navegador*»). It is computed by reading the headings each time it opens, so it can never fall out of step.
8. **Separate window, NOT a modal.** Asked on 2026-09-19 whether the «button that opens a modal with what is
   written» was something different from point 3's «open in a separate window», he answered: «*es lo mismo mal
   dicho, hazlo como te había dicho originalmente*». Point 3 rules: a separate window, like a character sheet.
9. **An adventure's document and a Notas/Bitácora document are the SAME block tree** (`{ v, blocks[] }`).
   Adventures adds its own —`sceneRef` and the PNJ/encounter tables—; `journal` uses the subset. One vocabulary
   and one painter.
10. ⚠️ **ADVENTURES LIVE INSIDE THE CAMPAIGN — this corrects how point 3 was read.** Point 3 says «its own
    section in the platform header», and on 2026-09-19 that was read as one more entry of the top menu
    (Campañas · **Aventuras** · Personajes · Sistemas), with a campaign picker inside. He stopped it the moment
    he saw it: «*pero estas poniendo las aventuras fuera de la cmapaña, y una campaña es un conjunto de
    aventuras, no tiene sentido lo que haces*». And it was what he had asked for from the start: «*la vista de
    la campaña donde el director en algo similar a one note pueda poner las aventuras*».
    ~~What rules: adventures are what you see when you enter a campaign.~~ *(Overruled by point 11.)*
11. 🔴 **IT IS A TAB OF THE TABLE, GM ONLY — this overrules points 3 and 10.** Point 10 was not right either: a
    screen that appears WHEN ENTERING the campaign, before the table, is still «outside», and it looks public
    even though the database gives it to no player. Him: «*¿te das cuenta que las aventuras no son algo público
    no? sino los jugadores las verían*» · «*va dentro de la campaña no fuera!*». Asked whether it was a tab of
    the table like the Bestiary, warned that point 3 had discarded that because the bar was already tight and
    the GM would go to six tabs: «*no importa lo estas poniendo fuera de la cmapaña joder*» · «*ponlo dentro me
    cago en todo!*».
    **What rules**: an **AVENTURAS** tab in the table bar, next to BESTIARIO, **GM only** — like El grupo and
    the Bestiary, the player does not have it. Inside, the notebook on the game system's paper (not the app's
    chrome, and therefore **no light/dark**): rail of adventures and their scenes · index beside it · the
    document.

**What this cost, and why it is written down:** the same screen was placed «outside» the campaign twice — first
as a top-menu entry (following the letter of point 3), then as a screen on entering the campaign. He had said it
right from the beginning. **His words today rule over an old line of the spec.**

### Mine, 2026-09-20, while building it (flagged, not asked)

- **A scene created from the table's rail falls into the running adventure, by database trigger.** The
  alternative —making every screen pass an adventure— would break the rail (which has no adventures in sight)
  and any future path that forgets. Proved broken by running it before fixing it, not by reasoning about it.
- **`id` per block** in the document tree, so the index has something stable to jump to.
- **Conflict detection on save** (`updated_at`) was already in the spec for two GMs; it matters with a single
  one, because the tab and the separate window are two views of the same document.

### Mine, 2026-09-21, flagged when he approved the rail controls («*aprobado*»)

When the QA stopped the merge (2026-09-20: the spec promised a GM who **organises** and the code only let him
**write** — every new scene fell into «Aventura 1» and could not be moved), he chose to build what was missing
(«*a, pero actualiza ws y vamos a chat nuevo*»). Designed first, and these were decided by me and shown to him
before his approval, to be corrected if he disagrees:
- **Only one running**; marking another passes the previous one to **done** (the usual thing is to start the
  next adventure when the previous one ends).
- **Up / down from the menu, no dragging.**
- **Deleting a scene stays at the table**, not in this rail.
- **The last adventure of the campaign cannot be deleted**; it can be archived.
- **Deleting with scenes preselects the running adventure** as their destination — where they would go by
  themselves if created from the table.
- **Taking one out of the archive** brings it back at the end of the rail, as a draft.
- In the `.pen` the open adventure was painted in **black**; the code already had it in blood. Fixed in the
  master (his rule of 2026-09-04: no black chrome at the table).

### Debt this uncovers

His rule —**content lives in the database, not in the front**— is already met for characters, campaigns, scenes
and rolls, and this spec meets it for adventures (`doc` is a `jsonb` column, not a file in the bundle).

**Where it is NOT met today is the game system's rules texts.** Plenilunio's tooltips and references live in
`packages/system-plenilunio/src/{references,locales}.ts` and are compiled into the browser bundle: a typo means
touching code and deploying. Checked (2026-08-19): there is no table of texts in any migration.

That is **its own slice**, and it needs thinking through first: moving the rules into the database clashes with
«the system package is pluggable and ships with its rules» (ARCHITECTURE.md), so the likely answer is a mixed
model — the package brings the default texts and the database stores only the **corrections**, per system and
per language. Noted in the backlog, not decided.
