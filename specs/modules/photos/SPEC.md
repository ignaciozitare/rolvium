# Photos (H13) — SPEC

> **Written to REBUILD the module from scratch**, not as a decisions diary — the nine-section template that
> `CLAUDE.md` § «Specs» mandates. English throughout; his own words are quoted verbatim in Spanish, because
> they are the evidence for why something is the way it is.
>
> Closed with him on 2026-09-22 («*si*»), the day v0.15.0 (Notas · Bitácora · Aventuras) reached production.
> Not built yet: it is steps 3 to 5 of the branch `feat/aventuras-segunda-vuelta` (see § Decisions, the order).

## Purpose

The GM of a campaign keeps **every photo of the campaign in one place**: the ones they put in an adventure, the
ones they send through the chat, and the ones they upload on purpose. From there they **show** a photo to the
players — dropping it into the scene or sending it through the chat — and find it again later by searching.

Before this there was nowhere to keep a picture: an adventure could not hold images («Images inside the
document» was out of scope in `adventures`), the chat did not take attachments, and the only images of a campaign
were backgrounds, textures, objects, tokens and avatars — each one tied to its own job.

**Who uses it:** the **GM** of the campaign. A player never sees the library; they only see a photo the GM has
shown them (§ Rules & limits). A platform admin can reach it for support, like adventures.

**Photos belong to the CAMPAIGN**, not to Rolvium and not to the GM's account: «*las fotos estas viven dentro de
la cmapaña no es para rolvium en general*». Each campaign has its own library; nothing is shared between them.
This is the opposite of the objects and textures libraries of `maps`, which belong to the tool.

## What the user can do

**The GM**
- **Open the library** from a new tab of the table's side rail, next to Bitácora and Notas. Only the GM has
  that tab.
- **See every photo of the campaign**, newest first, as a grid of thumbnails with their names.
- **Search** by name (accent- and case-insensitive, like the Bestiary's search).
- **Upload** photos from disk (or by dragging them in), one or several at a time. Each one is compressed in
  the browser before it is uploaded (§ Rules & limits).
- **Rename** a photo. It is born with the name of the file it came from, without the extension.
- **Delete** a photo. It asks first, and says **where it is used** (which adventures, which scenes, which
  conversations). Then it disappears from the scenes, and the adventures and the chat show «foto borrada»
  where it was.
- **See it bigger**, by clicking it.
- **Drop it into the scene**: from the library, choose it for the scene and click where it goes on the map —
  the same gesture as «Colocar» from the Bestiary. If the GM is on another tab, the table switches to Escena.
- **Send it through the chat**, to a conversation (one-to-one or group), from the library or from the chat
  itself.

**In an adventure** (the editor of `adventures`, only there)
- **Insert a photo** from the editor bar: upload one from disk, or pick one from the library. An uploaded one
  goes into the library by itself.
- It is shown at the width of the text; clicking it shows it bigger.
- Removing it from the text does **not** delete it from the library.

**In the scene** (`maps`)
- **Move** it, **scale** it by pulling its corners (it keeps its proportions), **rotate** it, **copy** it and
  **delete** it — the same handles and gestures as a planted object.
- Put it **inside the play area** to show it to the players, or **beside it** to keep it for the GM only.

**In the chat** (`chat`)
- **Attach a photo** to a message: upload one from disk, or pick one from the library. An uploaded one goes
  into the library by itself.
- Whoever receives it sees it in the conversation and can see it bigger.

**The player**
- **Does not see the library**, nor any photo the GM has not shown them.
- Sees a photo **inside the play area** of the scene they are looking at (only the part inside, if it sticks
  out), and a photo the GM sent to a conversation they are in.
- **Cannot send photos** through the chat: «*solo yo*».

## Screens

| Screen / part | What it is | Plate |
|---|---|---|
| Library tab | The side rail's new tab, GM only: search · upload · grid of photos | ⏳ to be drawn in `rolvium.pen` § 4 · LA MESA |
| Photo menu | On each photo: rename · to the scene · send through the chat · delete | ⏳ to be drawn |
| Delete dialog | «Se usa en…» with the adventures, scenes and conversations, then confirm | ⏳ to be drawn |
| Photo, bigger | The photo on its own over the table | ⏳ to be drawn (reuse the Bestiary's `PhotoModal` look if it fits) |
| Photo block in an adventure | The photo at text width inside the document; the editor bar's photo button with «Subir» / «De la biblioteca» | ⏳ to be drawn in § 4 (AVENTURAS) |
| Photo in the scene | The selected photo with its corner handles and rotation handle; the same one beside the play area, marked as GM-only | ⏳ to be drawn in § 5/§ 6 (LA ESCENA) |
| Photo in the chat | A message with a photo, in a conversation and in its pill; the attach button (GM only) | ⏳ to be drawn in the chat's section |
| Compression level in Ajustes | A fourth column «Fotos» next to textures, objects and backgrounds | ⏳ to be drawn in Admin → Ajustes |

The tab's label is not his yet: it is proposed in the drawing and he names it when he approves it.

## Rules & limits

- **GM only.** Listing, uploading, renaming, deleting, placing and sending are the GM's (and an admin's, for
  support). A player can do none of it and cannot list the library.
- **One library per campaign.** A photo belongs to exactly one campaign; it can never be used in another.
- **A player sees a photo only when the GM has shown it to them**, and the database — not the screen — decides
  it:
  - it is placed in a scene the player can see, **inside the play area**; or
  - it is attached to a message of a conversation the player is in.
  A photo in an adventure is never shown to players (adventures are the GM's).
- **Inside the play area** means inside the scene's map rectangle. What sticks out is cut, exactly like the rest
  of the map; a photo entirely outside is not sent to the player's browser at all.
- **The files are private.** Not in the public buckets the other images use («*nada sensible en una imagen*»
  in `core/images` does not hold here: an adventure's photo can be a spoiler). The file name is set by the
  server (uuid), never taken from the user.
- **Compressed in the browser before uploading, to WebP**, like textures, objects and backgrounds («*se tienen
  que comprimir como lo hicimos con las texturas*»), with the shared compressor of `packages/ui`. Photos get
  **their own level** in Admin → Ajustes (Ligero · Equilibrado · Máximo ahorro, Equilibrado by default). The
  numbers are **measured on a real photo and shown to him before building**, as was done with textures.
- The limits of `core/images` apply: 8 MB input file at most, 1.5 MB after compressing; PNG, JPEG, WebP and GIF
  (a GIF keeps its first frame).
- **Name**: 1 to 120 characters; the file's name without extension by default.
- **Deleting a photo** removes it from every scene it is placed in; the adventures and conversations that used
  it keep a «foto borrada» placeholder, so no document or message breaks.
- **Removing a photo from an adventure or from the scene never deletes it** from the library.
- **Only the GM sends photos through the chat.** A message with a photo from a player is refused by the
  database, not only hidden by the screen.

## States & errors

| State | When | What the GM sees |
|---|---|---|
| Empty library | No photo yet | A line saying there are no photos, and the upload button |
| Loading | Opening the tab | The tab in its loading state, never blank |
| Searching with no result | The search matches nothing | «Ninguna foto se llama así» and the search stays |
| Uploading | One or more files on their way | Each one with its progress, and how much it shrank («2,4 MB → 180 KB») |
| File too big / wrong type | Over 8 MB, or not an image | The file is refused with the reason; the others keep going |
| Upload failed | Network or permissions | The photo is marked failed with «Reintentar»; nothing is half-saved |
| Deleting a photo in use | Its menu → delete | The dialog listing where it is used, then confirm |
| A deleted photo in an adventure or chat | After deleting it | «foto borrada» in its place |
| Placing with no scene open | «A la escena» with no scene | The table goes to Escena and says there is no scene to place it in |
| A broken part | The library throws while painting | The side rail's net (`core/errors`): the rail falls, not the table |
| A player who somehow reaches it | Direct URL / id | Nothing: for them the row does not exist |

## Permissions

| Action | Who | How it is enforced |
|---|---|---|
| List / upload / rename / delete / place / send | The GM of that campaign | RLS: `public.is_campaign_dm(campaign_id)` |
| Same, for support | A platform admin | RLS: `public.is_admin()` |
| See a photo placed in the play area | Players of the campaign who can see that scene | RLS on the placement + the file's storage policy |
| See a photo sent through the chat | The members of that conversation | RLS of `chat` + the file's storage policy |
| Change the photos' compression level | Whoever has `manage_settings` | The existing rule of Admin → Ajustes |

No new key in the role engine: being the GM of the campaign decides, as in `adventures` and `bestiary`.

## Data model

> Pending — the DBA Agent completes this section (private storage bucket and its policies, the photos table,
> the placements in a scene with the «inside the play area» rule, the chat attachment, and the new compression
> level in `app_settings`).

## Out of scope

- **Players sending photos** through the chat — «*solo yo*».
- **Photos in Notas or Bitácora** — «*solo en la aventura*».
- **Sharing photos between campaigns**, or a Rolvium-wide photo library — «*viven dentro de la cmapaña*».
- **Cropping** a photo (as in `core/images`: it is scaled whole).
- Folders or tags in the library (search by name only in v1).
- Cleaning the files of deleted photos from storage (the same open debt as `core/images`).

## Connections

| With | What for |
|---|---|
| `table` (H3) | hosts the side rail tab; switches to Escena when a photo is placed |
| `adventures` (H12) | the photo block of the editor; an uploaded photo goes into the library |
| `maps` (H7) | the photo placed in the scene: gestures, play-area rule, what reaches the player |
| `chat` (H8) | the photo attached to a message; only the GM attaches |
| `core/images` | the shared compressor and the new «Fotos» level |
| `campaigns` (H2) | whose photo it is, and who the GM is |

## Decisions

### His, 2026-09-22 (verbatim)

1. **A library, only for the GM, in the side rail**: «*lo que si tenemos que agregar en algun lado que solo lo
   vea el dm una suerte de libreria en el menu donde esta bitacora etc etc donde esten todas las fotos de la
   campaña cargadas y pueda buscarlas y poder tirarlas a una escena para mostrarlas, o mandarlas por el chat si
   lo necesito. si subo una foto al chat o aventura tiene que aparecer en esa libreria*».
2. **In the scene, like an object, and only the play area is shown**: «*En la escena estas fotos las tengo que
   poder redimensionar escalandolas desde sus nodos girarla etc, y moverla borrarla copiarla. solo se tienen que
   ver las fotos dentro de la escena en el area de juego si las pongo al costado los jugadores no las ven solo
   el dm*».
3. **Photos only in adventures**, not in Notas or Bitácora: «*solo en la aventura*».
4. **They belong to the campaign**: «*recuerda que las fotos estas viven dentro de la cmapaña no es para rolvium
   en general*».
5. **Only the GM sends photos, compressed like textures**: «*solo yo, recuerda que se tienen que comprimir como
   lo hicimos con las texturas etc etc*».
6. **The order** (agreed: «*vale*»): (1) the quick adventure fixes, (2) the Bestiary in the tables, (3) the
   library and photos in the adventure, (4) photos in the scene, (5) photos in the chat — all in the same branch,
   without merging halfway.

### Mine, 2026-09-22 (shown to him in the summary he confirmed with «*si*»)

- **Private files**, not the public buckets: an adventure's photo can be a spoiler, and the players must only
  get what the GM showed them. The database decides who can read each file.
- **Deleting asks and says where the photo is used**; scenes lose it, adventures and chat keep a «foto borrada»
  placeholder — nothing breaks, and nothing is deleted behind the GM's back.
- **Half inside the play area → the player sees the inside half**, cut like everything else on the map.
- **Its own compression level** («Fotos») rather than borrowing the background's, with numbers measured on a
  real photo before building.
- **The photo keeps its proportions** when scaled from a corner.
