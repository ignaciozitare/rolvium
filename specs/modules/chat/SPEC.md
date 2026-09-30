# Susurros (H8) — SPEC

> The module is called `chat` inside (folder, ids, tables) because that is how it was born and renaming it
> changes nothing for anyone. **On screen it is SUSURROS**, and that is the word — his, 2026-09-15: «*el chat
> son los susurros, es más cámbiale el nombre*». Never «chat» in the interface.

**Status: ✅ built, reviewed, QA passed and IN PRODUCTION since 2026-09-15 (v0.10.0)**; migrations
`chat_susurros` and `chat_susurros_harden` applied to the production project. **The pills** (LinkedIn-style
conversation windows over the table) arrived on 2026-09-16 with **v0.11.0**. **Photos in a conversation**
(H13, rebanada 5) arrived on 2026-09-28. ⏳ **Pending**: the entry point for bringing a Registro roll into a
conversation — the data model already supports it, the screen does not.

## Purpose

Talk privately without leaving the campaign: the GM tells ONE player «you hear a noise behind you» without
the rest finding out, and players write to each other. **Who uses it:** every member of the campaign.

**There is no public channel.** The table itself is where you speak to everyone, and the dice have the
Registro; this is only the private part. His decision of 2026-09-15, which voided the «canal **Mesa**
(todos)» of the older spec.

## What the user can do

- Open the **SUSURROS tab** in the table's side rail (next to Registro · Notas · Bitácora · Galería).
- See the **directory**: one row per campaign member, talked to or not, plus one row per group they are in,
  each with a preview of the last message and an unread count.
- **Open a 1:1 conversation** by clicking one person. The same pair always reopens the same conversation —
  clicking a name twice never makes a second one.
- **Start a group** by picking several people at once. A group is always a new conversation.
- **Write a message**, with avatar, name and time. Anyone writes to anyone: the GM to a player, a player to
  the GM, players between themselves. No special permission.
- **Break a line inside a message**: `Option+Enter` on a Mac, `Control+Enter` on Windows (and `Shift+Enter`).
  `Enter` on its own sends. His, 2026-09-28: «*en el chat no me deja hacer un salto de linea tocando otp en
  mac y control en windows*».
- **Roll privately inside the conversation.** Anyone can, not only the GM.
- **Bring a Registro roll into a conversation** to show it off («look at this»). ⏳ The data model supports
  it; the entry point is not built.
- **Send a photo — the GM only** (H13, rebanada 5). A **clip** next to the writing box, with two ways in:
  *upload one from the computer* (compressed, and it also goes into the campaign's gallery) and *from the
  gallery*. Whatever is typed travels as the caption, in one gesture. His, 2026-09-28: «*en el chat no tengo
  forma de enviar una foto, no hay un subir ni adjuntar desde la galeria, ten muchi ojo esto tiene que ser
  un icono no una palabra no hay mucho lugar*».
- **Keep talking while the rail is elsewhere**, through **the pills**: minimise, expand, close, several at
  once.
- **Read from any tab.** The pills live above the table, not inside the rail.

## Screens

| Screen / part | What it is | Plate |
|---|---|---|
| Directory | One row per member and per group, with preview and unread count | `rolvium.pen` `I9AY0o` |
| Conversation | Messages one under another with avatar, name and time; the writing row at the bottom | `rolvium.pen` `H8P1R` |
| The writing row | The box (it grows to about five lines), the **clip** (GM only), the die and **send** — the last two are icons, never words | `H8P1R`, plus his order of 2026-09-28 |
| Private roll | The die of the writing row opens the roller inside the conversation | `rolvium.pen` `H8P1R`, «Tirar» icon |
| The pill | A conversation window over the table: bar with avatar, name, unread count, minimise and X | `rolvium.pen` `oPbeF`, plate `XwDVn` |
| The pill dock | The row of pills, bottom right, clear of the side rail | `rolvium.pen` `oPbeF` |
| Sending a photo | The clip, its two ways in, and the photo inside a message with its caption | `rolvium.pen` § 4 · `Fotos/En el chat · mandarla y verla` (approved 2026-09-24) |

Two measurements that are his and not free choices: the pill is **442 px** wide (it was born at 248, went to
340, and seeing it he asked for «*un 30%*» more on 2026-09-28), and the writing row carries **icons, not
words**, because «*no hay mucho lugar*».

## Rules & limits

- **The history belongs to the CAMPAIGN and is kept** (his: «*vive dentro de la campaña, esto se guarda*»):
  today's is still there next week, and it survives closing the table or changing scene.
- A conversation **is read only by its participants** — RLS stops it, not the screen.
- **Dice go to the Registro by default.** That path does not change.
- **A private roll leaves NO trace in the Registro** — neither the result nor a «so-and-so rolled in
  private». His, 2026-09-15, asked expressly.
- A roll brought in from the Registro travels as a **reference**, never a copy.
- No editing and no deleting messages in v1 (simple audit trail).
- A group is created by anyone; in v1 it is **not renamed and not left**.
- Pills: **up to three open at once**; opening a fourth closes the oldest. The sound plays **only** when a
  pill appears because of someone else's whisper, never for what you write yourself.
- **Only the GM sends photos**, and only photos of that campaign's gallery. A player who tries through the
  API is refused by the database, not merely by a hidden button.
- **A photo message keeps neither the name nor the link of the photo** — only which photo it is. The link is
  signed separately and expires; the name can be a spoiler.
- **Deleting a photo from the gallery does not break the message**: its place keeps a «foto borrada» gap and
  the caption stays.

## States & errors

| State | When | What the user sees |
|---|---|---|
| Empty directory | A campaign with no other members | The directory with only the rows that exist |
| Conversation with no messages | Just opened, never written in | «Todavía no hay mensajes.» |
| Loading | Opening a conversation | The list marked busy, never blank |
| Messages failed to load | Network or permissions | «No se pudieron cargar los mensajes.» |
| Someone writes and you have no pill | A whisper arrives | A pill appears on its own, **minimised, in blood red**, with its unread count and a short sound |
| Someone writes and you are reading it | The conversation is open, in the rail or in a pill | The message goes straight in; no counter and no red — looking is looking, wherever you look from |
| Sending a photo | The clip, either way in | The photo grid, or «Subiendo la foto…» while it uploads |
| The gallery is empty | The GM has no photos yet | «Todavía no hay fotos.» and the hint to upload one from the computer |
| A file that is not an image | Wrong format or too heavy | The gallery's own warning; nothing is sent |
| A photo deleted from the gallery | After deleting it | «Foto borrada» in its place, with the caption intact |
| A photo you may not see | A conversation you are not in | Nothing: the database does not sign you the link, and there is no row for you either |
| A broken part | The rail throws while painting | The rail's own net (`core/errors`): the rail falls, not the table |

## Permissions

| Who | Can |
|---|---|
| Any campaign member | Open the tab, read the directory, start a 1:1 or a group, write, roll privately |
| The GM of the campaign | All of the above, **plus sending photos** (`is_campaign_dm` on the conversation's campaign) |
| A participant | Read **only** the conversations they belong to, and mark **their own** row as read |
| A platform admin | **Nothing extra.** On purpose, and unlike other tables of the project: not even an admin reads someone else's conversation. He asked expressly for private to mean private |
| Anyone else | Nothing. No policy is granted `TO anon` |

No role key from the permission engine gates this: belonging to the conversation is the permission.

## Data model

**Three tables.** `chat_conversations` is each conversation (1:1 or group), always inside ONE campaign.
`chat_conversation_members` says who is in each, and holds the per-person unread counter (when each of them
last opened it). `chat_messages` is each message, one under another — no editing and no deleting, enforced by
the database as in the Registro.

**Four kinds of message** (`chat_messages_kind_check`), each with its own shape enforced by
`chat_messages_check`:

| Kind | What it holds |
|---|---|
| `text` | A body that is not blank. No roll and no photo |
| `roll` | A private roll: the dice are thrown on the server, as in the Registro, but the result is stored **here**, never in `dice_rolls`. There is no data path by which such a roll could reach the Registro, not even for the GM |
| `roll_ref` | A reference to a roll that already exists in the Registro, never a copy — and only one that could already be seen (same campaign, and public, your own, or the GM's) |
| `photo` | `photo_id` → `photos_photos`, plus an optional `body` as the caption. **`photo_id` going null means «photo deleted», not «no photo»**: `ON DELETE SET NULL` keeps the message whole when the photo leaves the gallery |

**Who creates a conversation.** Any member, no special permission. The same single person reopens the same
conversation; a group is always new.

**Who reads what (RLS).** Only participants, with no admin bypass (see § Permissions).

**Marking read.** Each person on their own row, through a function — there is no direct table edit from the
browser.

**Sending a photo.** `chat_messages_insert` demands, for `kind = 'photo'`: a non-null `photo_id`, that the
photo belongs to the **same campaign** as the conversation, and `is_campaign_dm` on that campaign. Screen and
database say the same thing, and the database is the one that counts.

**Migrations.** `chat_susurros` and `chat_susurros_harden` (2026-09-15) created it;
`20260922120100_photos_en_escena_y_chat.sql` added `photo_id`, the fourth kind and the insert policy.

**The pills carry no data.** Which pills someone has open or minimised is screen state of THAT browser, not
of the campaign.

## Out of scope

- **Voice and video** — that is what Discord is for.
- **Reactions and threads.**
- **Attaching arbitrary files.** Only photos of the campaign's gallery, and only the GM (2026-09-28). The
  earlier line of this spec said «adjuntar ficheros o imágenes» was out of scope full stop; his order of
  2026-09-28 overrides it for images, and nothing else changes.
- **Editing and deleting messages** in v1.
- **Renaming or leaving a group** in v1.
- **A public channel** — the table itself is that.
- **Bringing a Registro roll into a conversation**: ⏳ not out of scope, just not built. The schema supports
  it; the entry point was not in the approved mockup, so it needs its own Design pass.

## Decisions

### His, 2026-09-15 (verbatim)

1. **They are SUSURROS, not «chat»**: «*el chat son los susurros, es más cámbiale el nombre*».
2. **It is kept**: «*vive dentro de la campaña, esto se guarda*».
3. **A private roll leaves no trace**, asked expressly. And **anyone** can roll privately, not only the GM.
4. **No public channel**: the table is where you talk to everyone.
5. **Private means private even from an admin.** This is why `chat` is the one module without the admin
   bypass the rest of the project's tables carry.

### His, 2026-09-16 (verbatim)

6. **The pill is a window, not a notice**: «*cuando abro una conversación tiene que estar la pastilla, se
   tiene que poder minimizar… no es fija, se tiene que poder cerrar*». What had been built the day before was
   an alert that popped up and vanished after eight seconds — my invention, not what he asked for.
7. **It is born minimised**, because otherwise the same conversation was on screen twice at once.
8. **Minimised with unread goes in blood red**: «*que se vea*».

### His, 2026-09-28 (verbatim)

9. **A line break**: «*en el chat no me deja hacer un salto de linea tocando otp en mac y control en
   windows*». It was not a loose wire — the box was an `<input>`, **where a line break does not exist**.
10. **Sending a photo**: «*en el chat no tengo forma de enviar una foto, no hay un subir ni adjuntar desde la
    galeria, ten muchi ojo esto tiene que ser un icono no una palabra no hay mucho lugar*». Hence the clip,
    and hence **ENVIAR stopped being a word** the same day — asked and answered: «*convierte el enviar en un
    icono*».
11. **Wider pills**: «*las pastillas del char deberían poder ser mas anchas*», and seeing them at 340 px,
    «*incrementa el ancho de la pastilla un 30%*» → 442 px.

### What failed

- **The alert that was not a pill** (2026-09-16): built from my reading of one word instead of asking what he
  meant by it. Cost a full day's work thrown away.
- **The clip that was not wired** (2026-09-28): `SusurrosPanel` declared `isDm` and never passed it on, so
  the GM had no clip **in the rail — which is where most writing happens**; and `TablePage` only handed the
  rail the gallery when it was injected, so in production **every received photo read «Foto borrada»**. The
  worst part is that it read as a fact, not as a failure. Neither was caught, because every test injected the
  port by hand: **a test that injects the port does not test the wire.** Two pins now mount the table bare,
  as the router does (`la-galeria-esta-enchufada-al-mapa`, `la-galeria-llega-sola-a-toda-la-mesa`).
- **The caret one frame late** (2026-09-28): the line break restored the caret in a `requestAnimationFrame`,
  so typing straight after a break scrambled the letters («Primera\ndasegun»). It is a `useLayoutEffect` now,
  and must stay one.

## Connections

- `dice` — the Registro (`RollLog`) is where rolls are brought from and where private ones never appear; its
  `RollEntry` renders a whispered roll as-is. `dice/ui/SidePanel` owns the rail's tab bar.
- `photos` (H13) — the gallery a sent photo comes from, and the signed link that paints it.
- `table` — hosts the rail and the pill dock; publishes `--tb-side-w` so the dock sits clear of the rail.
- `campaigns` — the participants are the campaign's members.
- `identity` — avatar, name and alias.
- `realtime` — a new message arrives on its own (`postgres_changes`), like the rest of the table.
