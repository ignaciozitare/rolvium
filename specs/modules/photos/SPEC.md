# Photos (H13) — SPEC

> **Written to REBUILD the module from scratch**, not as a decisions diary — the nine-section template that
> `CLAUDE.md` § «Specs» mandates. English throughout; his own words are quoted verbatim in Spanish, because
> they are the evidence for why something is the way it is.
>
> Closed with him on 2026-09-22 («*si*»), the day v0.15.0 (Notas · Bitácora · Aventuras) reached production.
> **Built on 2026-09-27/28** (steps 3 to 5 of the branch `feat/aventuras-segunda-vuelta`; see § Decisions):
> the library, the photo in the scene and the photo in the chat. ⏳ Everything still missing is listed, and
> marked where it is read, in § Out of scope — the photo block inside an adventure above all.

## Purpose

The GM of a campaign keeps **every photo of the campaign in one place**: the ones they will put in an adventure (⏳ that block is not built yet), the
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
- **Open the library** from the side rail's **GALERÍA** tab, next to Bitácora and Notas. Only the GM has that
  tab. He named it on 2026-09-24 («*cambia fotos por galeria*»); the module is still `photos` in the code. With
  five tabs the bar wraps onto a second line, which is what `.dc-tabs` already does (`flex-wrap: wrap`).
- **See every photo of the campaign**, newest first, as a grid of thumbnails with their names.
- **Search** by name (accent- and case-insensitive, like the Bestiary's search).
- **Upload** photos from disk (or by dragging them in), one or several at a time. Each one is compressed in
  the browser before it is uploaded (§ Rules & limits).
- **Rename** a photo. It is born with the name of the file it came from, without the extension.
- **Delete** a photo. It asks first, and says **where it is used** (which scenes, which conversations — and
  which adventures once the photo block exists). Then it disappears from the scenes, and the chat shows
  «foto borrada» where it was.
- **See it bigger**, by clicking it.
- **Remove it from the scene** from the placed photo's right-click menu («Quitarla de la escena»), which is
  **not** deleting it from the library — the two are kept visibly apart in the drawing, because they read the
  same and are not.
- **Drag it onto the scene** (2026-09-24, «*asegurate que pueda arrastrar las fotos a la escena y no que solo
  sea con el boton*»): grab the photo in the grid and drop it on the map. **It lands where it is dropped.** This
  is the everyday gesture, and it works whenever the Escena tab is showing — the rail sits right beside the map.
- ⏳ **NOT BUILT** — **Or send it to the scene from its menu** («A la escena»), which arms it and clicks where
  it goes, the same gesture as «Colocar» from the Bestiary. If the GM is on another tab, the table switches to
  Escena. **The button stays**: it is the way in when the map is not on screen. Dragging does not replace it.
- **Send it through the chat**, to a conversation (one-to-one or group), **from the chat itself**: the clip of
  the writing row offers «Subir una del ordenador» and «De la galería». ⏳ Starting from the **library's own
  menu** is not built — the gallery has no way out towards the chat.

**In an adventure** (the editor of `adventures`, only there) — ⏳ **NOT BUILT YET** (see § Out of scope)
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
| Library tab | The side rail's GALERÍA tab, GM only: search · upload · grid of photos, plus the empty and the uploading states | § 4 · `Fotos/Biblioteca · el carril · sólo el director` |
| Photo menu | On each photo today: **rename · see it bigger · delete**. ⏳ «A la escena» and «send through the chat» are in the plate, **not built** — «no se pinta un botón que todavía no hace nada» | § 4 · same plate, column «EL MENÚ DE UNA FOTO» |
| Dragging it onto the scene | Grabbing it in the grid, the drop on the map, and what is inside the play area vs beside it | § 4 · same plate, column «ARRASTRARLA A LA ESCENA» |
| Delete dialog | «Se usa en…» with the adventures, scenes and conversations, then confirm | § 4 · `Fotos/Borrar una foto que se usa · y LA FOTO A LO GRANDE` |
| Photo, bigger | The photo on its own over the table, on the same parchment sheet as the Bestiary's `PhotoModal` | § 4 · same plate, right-hand column |
| Photo block in an adventure ⏳ | Drawn and approved, **not built**: the photo at text width inside the document, the «foto borrada» gap, and the editor bar's photo button with «Subir una del ordenador» / «De la galería» | § 4 · `Fotos/En una aventura · el bloque de foto` |
| Photo in the scene | The selected photo with its corner handles and rotation handle, one beside the play area marked GM-only, and the right-click menu | § 6 · `Fotos/En la escena · puesta, cogida y al lado` |
| Photo in the chat | A message with a photo, the pill it arrives in, and the attach clip (GM only) with its two ways in | § 4 · `Fotos/En el chat · mandarla y verla` |
| Compression level in Ajustes | A fourth column «Fotos» next to textures, objects and backgrounds, dark and light | § 14 · `Admin/Ajustes · compresión con FOTOS` |

The tab's label is **GALERÍA**, his own (2026-09-24). It was drawn proposed as «FOTOS» and he renamed it.
All the plates above were drawn on 2026-09-24 and approved («*esta bien*»).

It was asked, and he answered on 2026-09-27: **«debajo»** — see § Rules & limits.

## Rules & limits

- **GM only.** Listing, uploading, renaming, deleting, placing and sending are the GM's (and an admin's, for
  support). A player can do none of it and cannot list the library.
- **One library per campaign.** A photo belongs to exactly one campaign; it can never be used in another.
- **A player sees a photo only when the GM has shown it to them**, and the database — not the screen — decides
  it:
  - it is placed in a scene the player can see, **inside the play area**; or
  - it is attached to a message of a conversation the player is in.
  A photo in an adventure is never shown to players (adventures are the GM's).
- **A photo sits UNDER the tokens** (his word, 2026-09-27: «*debajo*»). That is exactly where the planted
  objects of `maps` are already painted — `mp-layer-props`, above the floor and the rooms, below the walls,
  below what is drawn by hand and below the tokens. So **a photo never covers a character**, and nothing new
  has to be invented for the stack: a placed photo is a row of `maps_scene_props` and inherits that order.
- **Dragging is the everyday way in, the button is the fallback.** A drag only exists while the map is on
  screen, so the menu's «A la escena» is kept for every other case; both end in the same placed photo, and
  neither is a different kind of object. A photo dropped **outside the map's own frame** (on the chrome around
  it) is not placed and nothing happens — it is not an error, the drag simply does not land.
- **Inside the play area** means touching the scene's map rectangle (the exact rotated shape, not the box around
  it; touching the edge exactly does not count). What sticks out is cut, exactly like the rest of the map. A photo
  entirely outside **never reaches the player's browser**: the player's screen knows *where* it is (so that it
  disappears the moment it leaves), but the database refuses to hand over the picture itself.
- **The files are private.** Not in the public buckets the other images use («*nada sensible en una imagen*»
  in `core/images` does not hold here: an adventure's photo can be a spoiler). The file name is set by the
  server (uuid), never taken from the user.
- **Compressed in the browser before uploading, to WebP**, like textures, objects and backgrounds («*se tienen
  que comprimir como lo hicimos con las texturas*»), with the shared compressor of `packages/ui`. Photos have
  **their own level** in Admin → Ajustes (Equilibrado by default), **measured on a real image of his on
  2026-09-27 and approved by him** («*si*») — a knight, 1122×1402, 2.68 MB PNG:

  | Level | Longest side · quality | It became | Saved |
  |---|---|---|---|
  | Ligero | 1600 px · 0,88 | 1122×1402 (not reduced) · 362 KB | 87 % |
  | **Equilibrado (default)** | 1280 px · 0,82 | 1024×1280 · 204 KB | 93 % |
  | Máximo ahorro | 1024 px · 0,76 | 819×1024 · 124 KB | 95 % |

  Unlike a background, a photo **does** lose resolution: a background is read full-screen and zoomed, a photo is
  read at the width of the text (~600 px) or in the big sheet (760 px), so even Máximo ahorro leaves it above
  what is ever shown. The numbers live in `LEVELED_TARGETS.photo` and are pinned by a test.
- The limits of `core/images` apply: 8 MB input file at most, 1.5 MB after compressing; PNG, JPEG, WebP and GIF
  (a GIF keeps its first frame).
- **Name**: 1 to 120 characters; the file's name without extension by default.
- **Deleting a photo** removes it from every scene it is placed in; the conversations that used it keep a
  «foto borrada» placeholder, so no message breaks. ⏳ The same will hold for adventures once the photo block
  is built: the database already does its half (`ON DELETE SET NULL` on the message, `CASCADE` on the scene).
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
| Upload failed | Network or permissions | The photo is marked failed with the reason; nothing is half-saved. ⏳ The «Reintentar» this table used to promise is **not built**: today it can only be dismissed |
| Rename failed | The database refuses, or the network drops | «No se ha podido cambiar el nombre.» stays until the GM closes it, and the old name comes back |
| Delete failed | The database refuses, or the network drops | «No se ha podido borrar.» stays until the GM closes it, and the photo is still there |
| Cancelling while «where is it used» is still in flight | The GM cancels before the database answers | Nothing: a late answer is dropped and the dialog stays closed |
| Deleting a photo in use | Its menu → delete | The dialog listing where it is used, then confirm |
| A deleted photo in a chat message | After deleting it | «foto borrada» in its place, and the caption stays. ⏳ Same for an adventure once that block exists |
| Placing with no scene open ⏳ | «A la escena» with no scene | NOT BUILT (the button does not exist): the table would go to Escena and say there is no scene to place it in |
| Dragging with no scene open | The map is not there to drop on | There is nothing to drop onto, so nothing happens. ⏳ The button that would be the way in is not built, so today there is simply no way in from another tab |
| Dropping it outside the map | The drag ends on the chrome around the map | Nothing is placed and nothing is said: a drag that does not land is not a mistake |
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

Migrations, in this order: `supabase/migrations/20260922120000_photos_biblioteca.sql` (the library table and the
private bucket, with who can write), `20260922120100_photos_en_escena_y_chat.sql` (a photo in a scene, a photo in
the chat, and who can read each file) and `20260922120200_adventures_funciones_de_trigger_cerradas.sql` (unrelated
hygiene: the two trigger functions of `adventures` locked like `chat`'s). Applied on the local stack with
`supabase migration up --local` (never `db:reset`); `supabase db lint --local --level error` reports nothing.

**`photos_photos` — one row per photo of the library.** Which campaign it belongs to, its name (1 to 120
characters, searched on), its natural width and height after compressing (what lets it be placed in a scene
keeping its proportions), who uploaded it and when. `(id, campaign_id)` is unique: it is what the scene and the
chat point at, so a photo can only ever be used in its own campaign. Deleting the campaign deletes its photos.
- **Reads and writes: the GM of the campaign, and a platform admin** (`is_campaign_dm` · `is_admin`). For a
  player the row does not exist — not even its name, which can be a spoiler.

**The `photos` bucket — PRIVATE**, unlike every other bucket of the app. Each file lives at
`{campaign_id}/{photo_id}`, with no extension, so a player who has a photo in front of them (they know the
campaign and the id) can ask for its signed link without being able to read the table. 1.5 MB per file, the same
cap as the compressor's output; PNG, JPEG, WebP and GIF.
- **Writing a file**: the GM of that campaign (or an admin). Uploading also requires that the photo's row already
  exists in that campaign — nobody drops loose files in the bucket. Deleting does not require the row, so the
  row and its file can be removed in either order.
- **Reading a file** — the database decides, per file (`photos_can_read_object`): the GM (or an admin) always; a
  player only if the photo is **placed in a scene they can see, on a layer that reaches them, touching the play
  area**, or **attached to a message of a conversation they are in**. A photo in an adventure is never readable
  by a player through here.
- Names that are not `{uuid}/{uuid}` are simply «no»: the helpers validate the name before reading it, because
  storage policies are also evaluated on other buckets' files and Postgres does not promise the order of an AND.

**A photo in a scene is one more row of `maps_scene_props`** (the table of everything planted on a scene), with
`photo_id` set. That is what gives it, for free, the same handles and gestures as a planted object: move, scale
from the corners, rotate, copy, delete, stacking order and layer. Its position is its centre, like any object.
- `(photo_id, campaign_id)` points at the library; deleting the photo **removes it from every scene**.
- A photo row carries **no name and no image link** (both forced empty), does not come from the objects library,
  and **never blocks sight or movement** — the server's vision has nothing to know about it.
- Its visibility rule is the one of any planted object (`maps_scene_props` RLS unchanged): the player gets the
  row, i.e. where it is. **The picture** is what the play-area rule protects, through the bucket.
- The «touches the play area» test is `maps_rect_touches_play_area(x, y, width, height, rotation, scene width,
  scene height)`: the separating-axis test of a rotated rectangle against the map, exact.

**A photo in the chat is a message of kind `photo`** in `chat_messages`, with `photo_id` and an optional caption
in `body`. Messages stay immutable.
- **Only the GM of the conversation's campaign can send one**, and only a photo of that same campaign — refused
  by the database for anyone else, not just hidden on screen. A photo message must carry its photo when sent.
- Deleting the photo empties `photo_id` (and only that column): the message stays, and the screen shows «foto
  borrada».

**The compression level** needs no migration: it is one more key, `photo`, inside the existing
`app_settings` row `images.compression_levels` (read by anyone signed in, written with `manage_settings`). With
no value saved, the code uses «Equilibrado».

**Proved on the local database, inside a rolled-back transaction (2026-09-22)**, as the GM and as a real player of
his campaign: the player sees 0 library rows; sees the placed photo's row; can read the file while it is inside,
cannot when it is fully outside, can when it is half inside; cannot write files; cannot send a photo through the
chat (refused by RLS) while the GM can, and then the player can read it through the chat; a GM photo message
without a photo is refused; a placed photo with a name is refused; deleting the photo removes it from the scene
and leaves the chat message without a photo. The geometry: a 45° square next to the corner but outside → no;
moved to touch it → yes; touching the edge exactly → no. A player's ordinary text message still goes through.

## Out of scope

- **Players sending photos** through the chat — «*solo yo*».
- **Photos in Notas or Bitácora** — «*solo en la aventura*».
- **Sharing photos between campaigns**, or a Rolvium-wide photo library — «*viven dentro de la cmapaña*».
- **Cropping** a photo (as in `core/images`: it is scaled whole).
- Folders or tags in the library (search by name only in v1).
- Cleaning the files of deleted photos from storage (the same open debt as `core/images`).

**Not out of scope, but NOT BUILT YET** (2026-09-30) — written down because this spec described them as if they
shipped, and anyone reading it would go looking for them:

- **The photo block inside an adventure.** `RichTextEditor` exposes `features: { tables, sceneRef, bestiary }`
  and has **no image block**. The plate is drawn and approved; the code is not written. ⚠️ Whoever builds it
  must also fix `usage()`: `SupabasePhotosRepo.ts` asks the database for a `RichBlock` of type `image` with a
  `photoId` that **does not exist yet**, and its test pins the guessed shape, so it would stay green even if
  the real block were named differently. The honesty of the delete warning depends on that.
- **«A la escena» in the photo's menu.** Dragging is built and is the everyday way in; the button is the way in
  when the map is not on screen (another tab of the table), and it is not built.
- **«Mandarla por el chat» from the photo's menu.** Sending a photo IS built, but only from inside the chat
  (the clip, with its two ways in). The gallery's menu has no way out towards a conversation.
- **«Reintentar» on a failed upload.** § States & errors promises it; the screen only offers to dismiss the
  warning.

## Connections

| With | What for |
|---|---|
| `table` (H3) | hosts the side rail tab; switches to Escena when a photo is placed |
| `adventures` (H12) | ⏳ the photo block of the editor — **not built**; when it is, an uploaded photo goes into the library |
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

### His, 2026-09-24 (verbatim)

7. **The tab is GALERÍA**: «*cambia fotos por galeria*». It had been drawn proposed as «FOTOS», which the spec
   had left for him to name. The code's module keeps its name (`photos`); what he named is what is read on screen.
8. **Under the tokens**: asked whether a photo dropped on the map goes over or under the tokens, he answered
   «*debajo*». It costs nothing: the props layer already paints there. Drawn in § 6 · `Fotos/En la escena…`.
9. **Dragging, not only the button**: «*asegurate que pueda arrastrar las fotos a la escena y no que solo sea
   con el boton*». The table has **no drag-onto-the-map today** — everything is placed by arming and clicking
   (`armEncounter`), and the only drag-and-drop that exists is inside the objects library, for reordering and for
   dropping files in. So this is a new gesture on the map, not a reuse. The button stays, because a drag needs
   the map on screen and he does not always have it there.

### Mine, 2026-09-22 (shown to him in the summary he confirmed with «*si*»)

- **Private files**, not the public buckets: an adventure's photo can be a spoiler, and the players must only
  get what the GM showed them. The database decides who can read each file.
- **Deleting asks and says where the photo is used**; scenes lose it, adventures and chat keep a «foto borrada»
  placeholder — nothing breaks, and nothing is deleted behind the GM's back.
- **Half inside the play area → the player sees the inside half**, cut like everything else on the map.
- **Its own compression level** («Fotos») rather than borrowing the background's, with numbers measured on a
  real photo before building.
- **The photo keeps its proportions** when scaled from a corner.

### Placing it in the scene — built 2026-09-28

He said it plainly, seeing the gallery on screen with nothing to do: «*no me sirve de nada poder subir la foto
y no poder arrastrarla a la escena como te pedi*». He was right — the library alone (slice 3) is a shelf with
no door. What went in:

- **A placed photo is a row of `maps_scene_props`**, not a new kind of thing. That one decision is what gives
  it moving, resizing by the corners, rotating, copying, `Ctrl+Z` and the stacking order **for free**, and it
  is also what puts it **under the tokens** without inventing a layer — his «*debajo*» of 2026-09-27.
- **The row carries neither the name nor the link** (`name = ''`, `image_url = ''`, enforced by the database):
  a player reads this row, and a photo's name can be a spoiler. What is painted comes from signing the file
  separately, which is also why the link is not stored — it expires.
- **Dragging carries the id and the natural size together**, so the map knows the footprint at the instant of
  the drop instead of asking the database and having the photo appear late and elsewhere.
- **It lands six grid cells across its longest side** (`PHOTO_SPAN_CELLS`), never distorted. Mine, not his:
  on a normal grid (~70 px) that is ~420 px, which is the width a photo is read at everywhere else in the
  tool. It is a starting size, not a rule — the corners change it and the row keeps it.
- **The screen now enforces the play area too, not only the database.** His rule of 2026-09-22 — «*si las
  pongo al costado los jugadores no las ven solo el dm*» — was already enforced at signing time, but a signed
  link is a bearer pass valid for an hour, so a photo *dragged out* of the map kept showing to players, and a
  photo *dragged in* was never asked for again and stayed invisible until a reload. The screen now runs the
  **same separating-axis test as the database** (`rectTouchesPlayArea` mirrors `maps_rect_touches_play_area`,
  down to «touching the edge exactly is outside») and returns links only for what may be shown *right now*.
  The GM keeps seeing everything, including what is parked aside waiting for its moment.
- **Sending a photo through the chat (slice 5) was built two days later, on 2026-09-28**, when he said he had
  no way to do it. **Still not built**: the menu's «A la escena» (the way in when the map is not on screen)
  and the photo block inside an adventure. Neither is drawn into the screen, because a button that does
  nothing is worse than no button.

🐞 **Two traps found by the tests, both worth remembering because they are the same shape** — an effect whose
correctness depends on a combination nobody stated:

- The signing effect first hung off the list of placed pieces, which changes identity on every frame of a drag.
  It now hangs off the list of ids **by value**. That is a performance fix, not the safety net.
- The safety net is that **the effect has no cleanup, and must not have one**. Adding the textbook
  `return () => { alive = false }` would make placing a second photo cancel the first one's signature in
  flight; since its id already counts as «asked for», it would never be asked for again and that photo would
  never appear. A test pins exactly this, so the «obvious» cleanup cannot be added silently.

### What failed — the review of 2026-09-27

Three defects, all on the **error paths**, which is exactly what the thirteen tests written with the feature did
not cover. Written down because the shape of the mistake repeats: state that a caller had just set was wiped by
the resync that followed it.

- **A failed rename or delete was SILENT.** `reload()` began with `setError(null)`, and because it runs to its
  first `await` synchronously it erased the warning its own caller had just set. Fixed by clearing only the
  *loading* warning, and only on success: `setError(prev => prev === 'photos.error.load' ? null : prev)`.
- **The wrong-format warning erased itself** the moment a mixed batch finished, for the same reason. The irony
  is that when *every* file was bad the warning survived, because the upload returned before the resync — it
  held up precisely when it mattered least.
- **Cancelling the delete dialog reopened it by itself** on a slow connection: the answer to «where is it used»
  arrived late and called `setOpen` unconditionally. A late answer now only patches a dialog that is still open
  on the same photo.

Each one is pinned by a test in `GalleryPanel.test.tsx` § «cuando algo falla, se ve», and all four were checked
against the unfixed code first: they failed there and pass here.
