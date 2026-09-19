# Characters (H4) — SPEC

> **Player characters only.** NPCs, monsters and encounters live in `bestiary` (H5).
>
> **Written to REBUILD the module from scratch**, not as a decisions diary — the nine-section template that
> `CLAUDE.md` § «Specs» mandates since 2026-09-17. English throughout; his own words are quoted verbatim in
> Spanish. Restructured on 2026-09-20 from the previous version, diffing against it so nothing was lost.

## Purpose

Every player has their **sheet alive at the table**: created with the system's generator, with rolls and actions
one click away, progression controlled by the GM, and an audit trail of every change.

**Who uses it:** the player (their own sheet), and the GM (all of them, PC or NPC — they can assign a sheet or
leave it unassigned for anyone to take).

## What the user can do

**The player**
- **Read and write their sheet**, rendered from the system's `sheetSchema` by a single `<Sheet>` component:
  identity (name, player, concept, **its own avatar**; without one, the account's; without that, initials +
  colour), the roll block (difficulty, specialty, armour, extra), characteristics with **TIRAR n**, state
  (derived values, boxes, health levels, resources, experience, taking damage), armour, **weapons with their
  attack icon** (⚔ melee / ◎ ranged, ammunition and reloading), gifts and abilities **with their activate icon**
  (⚡, cost), equipment and background.
- **Understand every mechanical label**: a tooltip with a short explanation + «Manual · p.XX», from the system's
  references.
- **Create a character with the generator**, in the system's own steps: concept → characteristics (point
  economy, presets 16/21/25/30) → specialties → Destino → gifts → summary.
- **Improve it** when the GM allows: the system's costs. Blocked, it says why.
- **See all their sheets across campaigns** in `/characters`, and open one **in a separate window**.

**The GM**
- **Open anyone's sheet** in read mode, and switch it to editing.
- **Choose PC or NPC and who it belongs to** in the generator — unassigned means any member can take it.
- **Open and close progression** per campaign.
- **Read the audit trail** of a character. Nobody else can.

## Screens

| Screen | What it is | Plate |
|---|---|---|
| My characters | `/characters`: every sheet of mine, across campaigns | § 8 · `Personajes/Mis personajes · dark` + `· light` |
| Sheet in a separate window | `/characters/:id`, dressed with the system's paper | § 8 · `Personajes/Ficha en ventana aparte` |
| Sheet tab | The same `<Sheet>` inside the table | § 4 · `Mesa/Plenilunio · Jugador` |
| Generator | The system's steps, one plate each | § 3 · `Mesa/Plenilunio · Crear personaje · 1…6` |
| Improve | Progression, enabled and blocked | § 4 · `Mesa/Plenilunio · Mejorar · habilitada` + `· bloqueada` |

⚠ **The separate window must NOT inherit `.tb-root`**, which carries `height:100dvh; overflow:hidden` and would
leave it with no scroll: it uses the `.tb-root-page` modifier. Pinned by
`apps/web/tests/regression/sheet-standalone-scroll.test.tsx` — his complaint of 2026-08-19, «*cuando abres la
ficha de personaje en una nueva pestaña no tienes scroll*». The same trap applies to any standalone window
(`adventures` H12 hit it too).

`/characters` is outside the table and therefore has **both themes**; everything under `.tb-root` is dressed by
the game system instead.

## Rules & limits

- **The sheet is validated against `sheetSchema` in the API**, never only in the browser: types, ranges, options,
  list shapes, and unknown keys rejected (`validateSheet` of `@rolvium/core`). The browser only previews.
- **The server recomputes `derived` and `health`** with the engine on every save. The client never decides them.
- **Progression is disabled by default**; only the GM opens and closes it, per campaign. With it closed, a player
  cannot touch `xp`.
- **A player edits only their own sheet**; the GM any of their campaign's. **Deleting is the GM's only.**
- A player cannot change campaign, type, owner or archived state — not by API, not by policy.
- **The audit trail is readable only by the GM**, and written only by a trigger: nobody writes it directly.
- **Avatar and token** are uploaded to Storage with a size limit and cropping; PNG with transparency is
  recommended for tokens.
- **Rolls do not belong here**: pressing TIRAR sends the system's `RollRequest` to `dice` (H6) — `POST /rolls`
  generates the dice on the server, `engine.resolve` resolves them, the persistent log is `dice`'s, and whatever
  the roll changes on the sheet (Destino going up, Fortuna reloading…) comes back through the authoritative save
  with origin `roll`.
  ⚠ The old `character_audit` of the first draft is called **`characters_audit`** in the database; that is the
  name to use.

## States & errors

| State | When | What is seen |
|---|---|---|
| No characters | A new player in a campaign | The generator, or the option to take an unassigned sheet |
| Unassigned sheet | `owner_id` empty | Any member of the campaign can claim it (`characters_claim`) |
| Progression blocked | The GM keeps it closed | «Mejorar» explains **why** it is blocked instead of failing silently |
| Invalid sheet | The data does not match the system's schema | The API rejects the save; the sheet on screen is not lost |
| System not installed | The campaign's system is missing from the build | The sheet cannot be opened (same rule as the campaign) |
| Separate window with no scroll | The `.tb-root` trap | Fixed and pinned by a regression test — see § Screens |
| NPC seen by a player | A sheet of type `npc` | It does not exist for them: RLS does not return it |

## Permissions

| Action | Who | How it is enforced |
|---|---|---|
| Read a PC | Members of the campaign | RLS |
| Read an NPC | **Only the GM** | RLS |
| Create | A member, their own PC; the GM, any | RLS |
| Edit | The owner, or the GM | RLS + the API's guards |
| Edit `xp` | Only with progression open | Check against `campaigns.progression_enabled` |
| Change campaign / type / owner / archived | Only the GM | Trigger |
| Delete | Only the GM | RLS |
| Claim an unassigned sheet | Any member of the campaign | `characters_claim` |
| Read the audit trail | Only the GM of that campaign | RLS |
| Write the audit trail | **Nobody** — only the trigger | No write policy |

**The API saves *as the user*.** `characters_api_update` (service role only) adopts the actor's identity inside
the transaction, so guards, audit and the owner/GM check apply exactly as they would from the browser. Being the
API is not a way around the rules.

## Data model

Migrations: `supabase/migrations/20260818100000_characters.sql` and `20260818110000_characters_api.sql`.

- **`characters`** — one row per character of a campaign: campaign, owner (`owner_id`, empty = «sin asignar»),
  type `pc`/`npc`, name, concept, its own avatar and token, colour, `data` (the sheet, jsonb following the
  campaign system's `sheetSchema`, validated in the API), `derived` (the engine's cache), `health` and `xp`
  materialised for the table, archived, author, dates. On creation the member row is linked
  (`campaigns_members.character_id`, a real FK from here on).
- **`characters_audit`** — written **only by a trigger**: creation, every key of `data` that changes with its
  before/after, name, owner, xp and health, with the author and the origin
  (`sheet`|`roll`|`damage`|`progression`|`dm`|`system`; the writer states it with
  `set_config('rolvium.audit_origin', …)`).
- **Bucket `tokens`** — like `avatars`: public to read, writable under `{uid}/`, 2 MB, images only.
- **Authoritative save**: `PUT /characters/:id/sheet` validates, recomputes `derived`/`health` with the engine
  and persists with its `origin`.

### Connections

`game-system` (schema, engine, generator, progression, actions, references) · `dice` (every roll) · `identity`
(the avatar fallback) · `bestiary` (the same `<Sheet>` and generator for NPCs) · `maps` (the character's token) ·
`table` · `realtime`.

## Out of scope

Pending since v1 (2026-08-18), none of them started:
- Avatar and token **from the sheet** itself.
- Changing a specialty (3 px).
- The audit trail shown in «El grupo».
- Filters and **importing a sheet** in `/characters`.
- The Registro panel inside the separate window.
- ⚔ / ◎ icons by weapon type in the neutral `<Sheet>`.
- Rich tooltips — today they are the native `title`.

## Decisions

- **One `<Sheet>` for every system.** The sheet is drawn from the system's `sheetSchema`, so a new system brings
  its own sheet without a line of UI. That is the whole point of the game-system port.
- **The authority is the API, not the screen.** The browser previews; the server validates against the schema and
  recomputes what the engine owns. A sheet that the client could decide would be a sheet anyone could forge.
- **Damage goes through the engine** (`engine.applyDamage` → boxes + health level), and lands in the audit trail
  with origin `damage`.
- **Everything that changes a sheet is audited by a trigger**, with who, what, before/after and where it came
  from — not by the code that happened to write it. Code forgets; a trigger does not.
- **An unassigned sheet is a feature**, not a broken state: the GM prepares characters and a player takes one.
- **NPCs are the GM's**, and they are the reason `type` exists here at all — the rest of NPC work lives in
  `bestiary`.

### State of v1 (2026-08-18)

Built: the database, the Plenilunio engine, the generic `<Sheet>`, `/characters`, `/characters/:id` (separate
window, GM read → edit), the generator in the system's steps (GM: type + assign), «Mejorar» enabled and blocked,
the Ficha / Mejorar / El grupo tabs at the table, the authoritative save through the API, and rolls through the
API.
