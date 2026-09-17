# Table (H3) — SPEC

> **Written to REBUILD the module from scratch**, not as a decisions diary. First spec written with the
> nine-section template that `CLAUDE.md` § «Specs» mandates since 2026-09-17. English throughout; his own
> words are quoted verbatim in Spanish, because they are the evidence for why something is the way it is.

## Purpose

The live session: the place where people actually play. On entering a campaign the table **dresses itself in
the game system** (paper, typefaces, moons in Plenilunio) and gathers the sheet, the scene, the dice, the chat,
the notes and the GM panel into one screen.

**Who uses it:** the members of that campaign, and nobody else. Two roles with different views — **GM** (one
per campaign, whoever created it) and **player** — and what one sees is never served to the other.

## What the user can do

**Any member**
- Enter the table of a campaign they belong to (`/table/:id`).
- See **who is connected**: the GM with a gold ring, players with a green halo when present and dimmed when
  away, their own marked. And on how many devices they themselves are connected.
- Move between **tabs**. Player: Sheet · Scene · Create character. GM: Sheet · The group · Scene · Bestiary ·
  Create character.
- Open and close the **dice roller**, a floating panel that can be dragged.
- Use the **side rail**: roll log · chat · notes · campaign journal. And fold it away for room.
- **Take and return** the system's shared resources (in Plenilunio, the Fate pool).
- Open **their sheet in a separate window** (`/table/:id/sheet/:charId`), synced with the table.

**GM only**
- See **«The group»**: every player with their character, resistance, health state, resources, and the
  **change log** of the sheets.
- Open any player's sheet read-only.
- **Reset** a shared resource.
- Everything in the Scene tab that carries a permission (see § Permissions).

## Screens

| Screen / part | What it is | Plate |
|---|---|---|
| The table | The whole shell: Rolvium bar, header, tabs, body, side rail | `rolvium.pen` § 4 · LA MESA |
| Rolvium bar | Thin, on top: ← Campaigns · name · system chip · devices · alerts · avatar | § 4 · LA MESA |
| Table header | System + campaign · who is connected · role · open sheet apart | § 4 · LA MESA |
| Shared resources | Centred under the header. Plenilunio: big moons, «in your hand», Return | § 4 · LA MESA |
| Side rail (272 px) | Dice roller + roll log · chat · notes · journal | § 4 · LA MESA |
| The group (GM) | One row per player, labelled «SOLO DIRECTOR» | § 4 · LA MESA |
| Sheet in its own window | `/table/:id/sheet/:charId`, with the «synced with the table» note | § 4 · LA MESA |
| Empty and error states | No active scene · no sheet · pool empty · offline | § 11 · ESTADOS VACÍOS Y ERRORES |

⚠️ **Pending**: the exact plate names inside § 4 go in next time `rolvium.pen` is reachable (it was not, on
2026-09-17). The section and the contents are confirmed.

## Rules & limits

- **One GM per campaign.** The role is granted once, automatically, when the campaign is created; everyone who
  joins later joins as a player, and **there is no way in the app to appoint another**. The database does not
  forbid it with a constraint, but nothing can create a second one.
- **The GM view is never served to a player**: the filtering is server-side, not screen-side.
- Shared resources are spent **atomically on the server** (`UPDATE … WHERE pool >= n`, row lock). If two people
  ask for the last one, one gets an error and is told why.
- A character **already at the cap** of a resource cannot take more; it is blocked and explained.
- **Only the GM resets** a resource. The GM **does not take dice**.
- **«Mejorar» is NOT a tab**: it is a button inside the sheet (owner, 2026-08-20). See § Decisions.

## States & errors

| State | When | What he sees |
|---|---|---|
| Loading | While the campaign and the system are fetched | «Cargando…», full screen |
| Not a member | Entering a campaign they do not belong to | Padlock + «No eres miembro de esta campaña» |
| System not installed | The campaign uses a system missing from the registry | Extension icon + the notice |
| Error | The load fails, or campaign/system/user is missing | Error icon + «Ha habido un error» |
| No active scene | The GM has not activated one | «El director aún no ha activado ninguna escena» |
| Pool empty | All the adventure's dice are spent | Said plainly, and that only the GM can reset |
| A broken part | Something throws while painting inside a tab | The net from § `core/errors`: that part falls, not the table |

## Permissions

| Action | Who | Role-engine key |
|---|---|---|
| Enter the table | Campaign member | — (membership, via RLS) |
| See «The group» and other people's sheets | GM | — (campaign role `dm`) |
| Reset a shared resource | GM | — (checked inside the DB function) |
| Upload and order map textures | GM with permission | `manage_textures` |
| Upload and order map props | GM with permission | `manage_props` |
| Order the toolbar for everyone | Admin | `manage_settings` |

Permissions are resolved **in the shell** (`usePermissions`) and passed down as props: `maps` has no business
knowing how roles are read.

## Data model

**No tables of its own.** The shared-resource state lives in `campaigns_campaigns.shared_resources`
(jsonb `{ id: { value, max, hands: { userId: n } } }`). Migration:
`20260817130000_table_shared_resources.sql`.

Players **never write that column directly**: everything goes through atomic `SECURITY DEFINER` functions
with a row lock.

| Function | What it does | Errors |
|---|---|---|
| `table_take_resource(cid, rid, n)` | Take n (the per-take cap is read from the stored resource) | `pool_empty` · `per_take_max` · `not_member` |
| `table_return_resource` | Return what is in hand | — |
| `table_reset_resource` | Reset (GM only) | `forbidden` |
| `table_spend_hand` | Spend the dice on a roll (**`service_role` only**: called by the API) | — |

**Realtime:** `campaigns_campaigns` and `campaigns_members` are in the publication; presence rides the
`campaign:{id}` channel.

## Out of scope

- **More than one GM per campaign.** Not built until he asks: today a campaign belongs to whoever created it.
- **Light/dark inside the table.** It does not exist: the system theme rules (`--sys-*`). App tokens
  (`--tx`, `--sf`…) **are not used below `.tb-table`**.
- Voice and video. Never requested.

## Decisions

- **«Mejorar» is not a tab** (owner, 2026-08-20). Improving is something you do *to the sheet you are looking
  at*, not a place you go; as a tab it pulled you out of the sheet only to load it again beside you. It is a
  button inside the sheet, next to «Editar» and «Abrir ficha aparte», and it opens the panel on top.
- **Resource spending is server-side and atomic** from day one: with two players asking for the last die at
  once, anything done in the browser hands it to both.
- **The table wears the system, not the brand.** Everything under `.tb-table` uses only `--sys-*`, which is
  why a new system looks different without touching a line of this module.
- **The GM does not take dice** from the pool: the pool belongs to the players.
