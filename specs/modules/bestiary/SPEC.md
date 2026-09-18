# Bestiary (H5) — SPEC

> **Written to REBUILD the module from scratch**, not as a decisions diary. Rewritten to the nine-section
> template that `CLAUDE.md` § «Specs» mandates since 2026-09-17. English throughout; his own words are quoted
> verbatim in Spanish, because they are the evidence for why something is the way it is.

## Purpose

The GM's bestiary: NPCs, monsters and their own encounters with **full game stats**, not just a token on the
map — so the GM can roll on their behalf and place them in a scene. **Who:** GM only. Players never see an
entry, not even an ally's — only the visible token once it is placed (governed by `maps`, untouched here).

**Why it exists** (owner, 2026-08-20: «*tenemos que construir el bestiario asap*»): the GM's roll panel cannot
be built without it — there is nothing to attack with if encounters have no stats.

## What the user can do

**GM only — the whole hexagon**

- **Browse** the catalog per campaign, tab `bestiary` of the table, full screen: filters Todos · Manual ·
  Propios · PNJ, accent-insensitive search. Each row: token (image or colour+initials), name, origin badge
  (MANUAL · PROPIO · PNJ·FICHA), notes, Resistencia · Protección, key stats, and the actions below.
- **Roll on its behalf** (`CreatureRollPopover`): pick a characteristic — only the ones the manual publishes
  for that block — or one of the attacks printed in its box; see the dice count before rolling; mark the
  specialty and the capabilities that might apply (with an «es de noche» checkbox when relevant); choose
  difficulty and who sees it (mesa / DJ / secreta). **Deflagración** rolls separately, by typing the metres.
- **Place** in the active scene (`DmEncounters`, the Encounter dropdown on the map toolbar): search across the
  manual (57 blocks) and every own entry; placing creates a scene **instance** with its own Resistencia/state,
  optionally hidden from players.
- **Attack from the token** (`TokenAttackModal`): the ATACAR button appears on a selected creature's token bar
  (never on a PC's). Melee (≤ 2 cells / 3 m) waits for the target's defence roll like any conflict; ranged
  resolves at once as a challenge, with `rangeForMetres` difficulty and the block's own weapon/attack chips
  when it prints more than one.
- **Create / edit / duplicate / delete** an own entry (`EntrySheetModal`): manual blocks can only be
  duplicated, never edited or deleted directly — duplicate, then edit the copy.
- **Build an allied NPC with a full sheet** (`NpcSheetModal`): reuses the same `<Sheet>` component a player
  character uses, with its own save button (see § Decisions — it does **not** autosave).
- **View a bigger photo** of an entry (`PhotoModal`).
- **Upload an image per entry**, compressed to WebP in the browser before upload — see
  [core/images](../../core/images/SPEC.md). `NULL` paints colour + initials instead.

## Screens

| Screen / part | What it is | Plate |
|---|---|---|
| `BestiaryTab` | Full-screen catalog: filters, search, grid of `EntryCard` | `rolvium.pen` — Bestiario |
| `EntryCard` | One row: token, name, origin badge, stats, Tirar · Colocar · menu | `rolvium.pen` — Bestiario |
| `EntrySheetModal` | Create / edit an own encounter or a quick copy of a manual block | `rolvium.pen` — Bestiario |
| `NpcSheetModal` | Allied NPC, full `<Sheet>`, manual save | `rolvium.pen` — Bestiario |
| `PhotoModal` | The entry's photo, larger | `rolvium.pen` — Bestiario |
| `CreatureRollPopover` | «Tirar por una criatura»: characteristic/attack, specialty, capabilities, visibility | `rolvium.pen` § «Bestiario/Tirar por una criatura · popover» + its «· Deflagración» twin |
| `TokenAttackModal` | Attack with a placed token: distance, weapon chips, difficulty | `rolvium.pen` — «Modal/Atacar con el token» |
| `DmEncounters` (in `maps`) | The scene's Encounter dropdown: search + place | `rolvium.pen` § «Panel/Director» |

## Rules & limits

- Nothing in this hexagon is visible by API to a player, except the visible tokens of the active scene (via
  `maps`).
- Placing an instance never modifies the template; deleting a template never deletes instances already placed
  — the token keeps its name and its own Resistencia on the map.
- Manual entries are **never edited or deleted**: duplicate to change one.
- A placed instance keeps its **own** Resistencia and state — two ogres in the same scene are hurt separately.
- **Resistencia is Aguante × 3** (p.25) and is **never typed**: it is computed, the same as on any character
  sheet.
- An incomplete block (the mutant, and any other missing a characteristic) keeps that stat **unset («—»)**:
  never invented.
- **No duplicated dice math.** `CreatureRollPopover` builds the sheet shape the system engine already knows
  how to read and calls `engine.poolFor` — the rules live in the system package only, and with rules **the
  manual commands** (owner rule, 2026-08-17).
- **No wound penalty on a creature roll**: a creature carries Resistencia, not a health track, and the book
  does not dock dice for damage. Docking them would be inventing a rule.
- **Never draws from the players' Destiny pool** (p.88): that pool belongs to the table.
- **An allied NPC rolls with its own character sheet** — its gifts, its armour, its wound penalty included.
- **An absent characteristic is never offered**: the manual leaves some blocks with an unpublished stat, and
  absent is not the same as zero.
- **Ranged attacks disable melee ones** (p.95, «sin ellas simplemente no se puede atacar a distancia») — a
  block's `ranged` attacks are the only ones offered past melee distance.
- **⚠ Interpretation, not the book** (documented in `packages/system-plenilunio/RULES.md` § 8.6): human blocks
  print no weapon line — what looks like one belongs to pre-generated sheets (pp. 26–35) or the weapon table
  (p.97) — so a ranged attack derives from the block's printed **Combat specialty** through that table, dice =
  Combat alone (no bonus on a shot, p.95–96). The Paramilitar stays without one: «Armas pesadas» is not in the
  table and no value is invented for it.

## States & errors

| State | When | What he sees |
|---|---|---|
| Empty catalog | No entries match the active filter/search | Empty state, per filter |
| Roll in flight | `CreatureRollPopover` mid-roll | Dice count shown before committing |
| Melee attack pending | `TokenAttackModal`, a melee attack was sent | «espera la defensa del jugador» — the modal says so before it is sent, no roll lands yet |
| Range too long | Target past the weapon's longest bracket | ATACAR disabled for that shot |
| Image upload fails | `EntrySheetModal` / `NpcSheetModal` | Inline error, entry keeps its previous image |
| A panel throws | Any bestiary panel hosted in the table | The net from `core/errors`: that panel falls, not the table |

## Permissions

| Action | Who | Role-engine key |
|---|---|---|
| Everything in this hexagon | GM of the campaign | — (`is_campaign_dm`, checked in RLS) |
| Read an entry | Nobody but its owner | — (no admin bypass; see § Data model) |
| See a placed token on the map | Campaign member, if visible | governed by `maps`, not here |

## Data model

Migration: `supabase/migrations/20260820000000_bestiary.sql`. One table, one column added to `maps`.

**`bestiary_entries`** — the GM's own templates: adjusted copies of a manual block, invented encounters, and
allied NPCs with a full sheet.

| Column | What it holds |
|---|---|
| `campaign_id` | `NULL` = «guardar para todas mis campañas» (owner decision: a checkbox on create, editable after); set = lives only in that campaign |
| `owner_id` | Always the GM who created it — carries the RLS for global (campaign-less) entries |
| `system_id` | So the list never mixes stats from different game systems |
| `origin` | `'custom'` (own encounter, incl. manual copies) or `'npc'` (allied NPC, same shape as `characters.data`) |
| `source_ref` | The manual block it was duplicated from, if any (not a foreign key — the catalog is code) |
| `data` | `BestiaryData` shape: partial `stats`, `endurance`, `destiny`, `protection`, `abilities[]`, `specialties {stat: string[]}`, `page` |
| `token_url` | Own image, bucket `tokens`, WebP; `NULL` → colour + initials |

**The 57 manual creatures are not in this table** — they are data in `packages/system-plenilunio`
(`catalogs.bestiary`). Putting them in the database would duplicate 57 rows per campaign for nothing, and the
manual, not the row, governs their values. The catalog feeds the «Manual» filter; this table feeds «Propios»
and «PNJ».

**A placed instance is not here either** — it is a `maps_tokens` row, which already had a free `state` jsonb
for its own Resistencia. This migration only adds `bestiary_entry_id` (`ON DELETE SET NULL`, never `CASCADE`:
deleting the template must not erase instances already on the map).

### Who reads and who writes

**Only the GM, and only their own.** RLS on `bestiary_entries` is a double condition on purpose: be the owner
**and**, if the row hangs off a campaign, still be that campaign's GM — so an entry does not survive the
campaign's GM changing hands. `TO authenticated` only, no `TO anon`; no admin bypass (a platform admin cannot
read another GM's bestiary through this table). Table grants (`SELECT/INSERT/UPDATE/DELETE` to `authenticated`
and `service_role`) sit next to the policies — without them PostgREST answers 403 before RLS is even evaluated.

## Out of scope

- Importing a bestiary from outside (JSON, another tool's compendium).
- A player seeing a creature's sheet, even an ally's.
- Behaviour AI or automatic turns.
- Cleaning up orphaned images in the bucket — see [core/images](../../core/images/SPEC.md).
- Exporting a token to PNG — the owner already renamed that row in `rolvium.pen` to «SUBIR IMAGEN (WEBP)», so
  the feature request behind it was already resolved the other way.
- Duplicating an allied NPC — its sheet does not offer «Duplicar» yet; own encounters do.

## Decisions

- **«tenemos que construir el bestiario asap»** (owner, 2026-08-20) — the whole hexagon in one pass: listing +
  own encounters (create/edit/duplicate/delete) + per-entry image (which required building the
  [core/images](../../core/images/SPEC.md) compressor, which did not exist yet) + allied NPCs with full sheet +
  scene instances + specialties as data. Not a slice: «el hexágono entero de una vez».
- **Colocar sends you straight to the map with the creature already chosen** (fixed 2026-08-21). Before, it
  only switched tabs and the GM had to search the dropdown again — «el colocar no funciona» (owner).
- **Tirar rolls loose dice, never the free roller** (owner, rejecting the first draft: «*no lo que
  establecimos*»). The free roller threw the creature away entirely; `CreatureRollPopover` builds the sheet
  shape the engine already reads.
- **A PNJ sheet does not autosave**, unlike a player's. It is a window the GM opens and closes; an autosave
  inside a modal leaves them unsure whether what they touched actually saved. There is a Save button, and it
  warns on unsaved changes.
- **A PNJ's numbers come from its own sheet**, never from `Aguante × 3`. Only the system engine
  (`engine.derived`) knows how to read a sheet, so it is passed in as a parameter — bestiary's domain does not
  know any system's sheet schema. Computed like a plain creature, every allied NPC would show Resistencia 0.
- **«Es de noche» lives on the roll itself, not on the scene** (owner, 2026-08-21): putting it on the scene
  meant a migration and new map design for a checkbox only some capabilities ever read.
- **Only a dark version** — inside a campaign the system's own theme rules (the Plenilunio paper), not the
  app's light/dark.
- **«N en escena» was designed but pulled from the code**: it needed the active scene's tokens, which this tab
  does not load. Better absent than a counter that never paints.
