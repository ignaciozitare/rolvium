# Images: upload and compression (core) — SPEC

> **Written to REBUILD this area from scratch**, not as a decisions diary — the nine-section template that
> `CLAUDE.md` § «Specs» mandates. English throughout; his own words are quoted verbatim in Spanish, because they
> are the evidence for why something is the way it is.
>
> Rewritten to the template on 2026-09-27, when the gallery (H13) added a fourth compression level and the audit
> turned this area hard. Nothing was dropped: the numbers, the background warning, the one-off conversion of his
> library and the data model are all still here, in the section they belong to.

## Purpose

**One single path for uploading an image anywhere in the app, so that no image weighs more than it has to.**

**Who uses it:** every member, for their character's avatar; the **GM**, for a bestiary entry's token, for
textures, for objects and for scene backgrounds, and since 2026-09-27 for the **photos of their gallery** (H13).
A **platform admin** chooses how hard each kind is compressed.

Where it came from (2026-09-14): his local library weighed **134 MB in textures alone**, and Supabase's free
allowance (5 GB/month) ran out after roughly **90 openings of the table**. He was shown a real before/after in
WebP — first on a texture of his, then on an object and on a background — and he approved the three conversions,
with the background deliberately reopening an earlier decision of his (see § Decisions).

## What the user can do

**Anyone uploading an image**
- **Pick an image from disk**, or drag it in, in six places: a character's **avatar**, a bestiary entry's
  **token**, a **texture**, an **object** (a piece of the objects library), a scene **background**, and a
  **photo** of the campaign's gallery.
- **See it before confirming**, and **how much it lost weight** — «2,4 MB → 180 KB».
- **Remove it** and go back to the initial image or the default colour.
- Upload **several at once** where the screen offers it (objects, textures, backgrounds and photos).

**A platform admin**
- **Choose the compression level separately for textures, objects, backgrounds and photos**, in
  Admin → Ajustes → «Compresión de imágenes»: **Ligero**, **Equilibrado** (the default) or **Máximo ahorro**.
- Avatar and token have **no level**: they are painted at 64 px or at one grid square, so there is nothing to win.

## Screens

| Screen / part | What it is | Plate |
|---|---|---|
| Compression levels in Ajustes | The four columns (Texturas · Objetos · Fondos · Fotos), each with its three levels | § 14 · `Admin/Ajustes · dark` / `· light` and `Admin/Ajustes · compresión con FOTOS` |
| Batch upload of objects | The drop zone, which pack they go to, and the queue with each file's state | § 6 · `PL/Subir piezas en lote` |
| Batch upload of textures | The same window, with categories instead of packs | § 6 · `PL/Subir texturas en lote · LA MISMA VENTANA QUE…` |
| Texture catalogue | Where a texture is picked and uploaded from | § 5 · `PL/Catálogo de texturas` |
| Background catalogue | Where a background is picked and uploaded from | § 5 · `PL/Catálogo de fondos · TUS FONDOS ARRIBA…` |
| The gallery's upload | The photos of a campaign, with what each one lost weight, inside the side rail | § 4 · `Fotos/Biblioteca · el carril · sólo el director` |
| Avatar and token | The picker of a character sheet and of a bestiary entry | See `specs/modules/characters/SPEC.md` and `specs/modules/bestiary/SPEC.md` |

## Rules & limits

- **It is compressed IN THE BROWSER before uploading, to WebP.** The image is drawn on a `canvas` and taken out
  with `canvas.toBlob(…, 'image/webp', quality)`. No server is needed: the work happens in the user's own tab, so
  it costs neither an extra function nor a Vercel quota.
  - ⚠ If the browser cannot produce WebP (an old Safari), **the original is uploaded**: an upload must never
    depend on an optimisation.
- **Avatar and token — fixed, with no level**: 512×512, quality 0,85.
- **Texture, object, background and photo — they follow the level chosen in Ajustes**, one per kind:

  | Level | Texture (max side · quality) | Object (max side · quality) | Background (max side · quality) | Photo (max side · quality) |
  |---|---|---|---|---|
  | Ligero | 1280 px · 0,85 | 1024 px · 0,85 | not reduced · 0,95 | 1600 px · 0,88 |
  | **Equilibrado (default)** | 1024 px · 0,82 | 768 px · 0,80 | not reduced · 0,90 | 1280 px · 0,82 |
  | Máximo ahorro | 800 px · 0,80 | 640 px · 0,75 | not reduced · 0,82 | 1024 px · 0,76 |

  Numbers **measured for real** (headless Chromium, the same `canvas.toBlob` as production) on a real texture, a
  real object and a real background of his library before he approved them. They live in `LEVELED_TARGETS`
  (`packages/ui/src/lib/compressImage.ts`) and a test pins each one, so nobody changes them without measuring again.

  > ⚠ **A background NEVER loses resolution, it only changes format/quality** — unlike a texture or an object.
  > It is what is looked at most closely on the whole table (full screen and zoomed), and that was his original
  > objection: «*¿pero se comprimen y pierden calidad? porque eso sería un problema*» (2026-09-14). A 1:1 zoom
  > test over the darkest, most detailed area of a real background showed no visible loss even at Máximo ahorro
  > (0,82); even so it was left at 0,90 by default, with more headroom.

  > **The PHOTO (H13) was measured on 2026-09-27** with an image of his — a knight, 1122×1402, **2,68 MB PNG** —
  > and he approved it («*si*»): **Ligero 362 KB** (resolution untouched), **Equilibrado 204 KB** (1024×1280,
  > −93 %) and **Máximo ahorro 124 KB** (819×1024). At 1:1 over the face and the engraving of the breastplate,
  > Ligero is indistinguishable and Equilibrado holds the face; Máximo ahorro shows in the fine detail only when
  > blown up past its own size. A photo is read at the width of an adventure's text (~600 px) or in the big sheet
  > (760 px), so all three are above what is ever shown — which is why a photo **does** reduce resolution and a
  > background does not.
- **Changing a level in Ajustes converts nothing retroactively**: it only affects what is uploaded from then on.
  Re-converting what is already uploaded is a separate action (see below).
- **A hard cap of 8 MB on the input file**, before compressing: above that it is refused with a reason, not
  attempted. And a cap of **1,5 MB on the uploaded result**.
- Only `image/png`, `image/jpeg`, `image/webp` and `image/gif` (a gif is flattened to its first frame).
- **The file name is set by the server** (a uuid), never taken from the user — a file name is untrusted input.
- Deleting the row that points at an image **does not delete the object** from the bucket; cleaning up is a
  separate job and is not done.

### The one-off conversion of his existing library (2026-09-14)

His local library of that day (41 textures · 50 objects · 18 backgrounds) was converted **once**, at each kind's
Equilibrado level — the same one he approved seeing the real before/after. It is not a recurring job and nothing
triggers it: it was a one-time migration against his **local** Supabase (production had those three libraries
empty, so it did not apply; they go up the normal way when he moves them).
- **Object**: reducing the max side also updates the natural width/height stored next to the piece, so its
  default scale stays correct.
- **Texture and background**: they do not store width/height apart, so there is nothing else to sync.
- The same file is overwritten at the same storage path — so anything already planted in a scene (which keeps its
  own copy of the URL) is served just as light without touching a single planted row.

## States & errors

| State | When | What the user sees |
|---|---|---|
| Compressing | The file has been picked | «comprimiendo…» — the tab is doing the work, not a server |
| Compressed | It is ready to upload | How much it lost weight: «2,4 MB → 180 KB» |
| File too big | Over 8 MB before compressing | Refused with the reason, and **the others in the batch carry on** |
| Wrong type | Not PNG / JPEG / WebP / GIF | Refused with the reason; the rest carry on |
| Still too big | Over 1,5 MB after compressing | Refused rather than uploading a brick |
| Cannot be decoded | A broken or unreadable file | Said plainly; nothing half-uploaded is left behind |
| No WebP in the browser | An old Safari | **The original is uploaded**, quietly: the upload never fails over an optimisation |
| The level cannot be read | No row saved yet, or no network | «Equilibrado» is used and the upload goes ahead |
| Saving a level fails | No permission, no network | The screen says so and goes back to what was really saved |

## Permissions

| Action | Who | How it is enforced |
|---|---|---|
| Upload an image of their own (avatar) | Any signed-in member | The RLS of the owning module (`characters`, …) |
| Upload a token, texture, object, background or photo | The **GM** of that campaign | The RLS of `bestiary`, `maps` and `photos` |
| **Read** the compression levels | Anyone signed in | `app_settings` is readable by any session — it is needed to compress before uploading |
| **Change** the compression levels | Whoever has `manage_settings` | The existing rule of `app_settings`; no new policy was needed |

The compressor itself enforces nothing: it is a pure function that returns a `Blob`. Who may upload is decided by
the database of the module that owns the image.

## Data model

**No new table.** The four levels are one more row in `app_settings` (the generic `key`/`value` table already used
by the map toolbar's order):

```
key   = 'images.compression_levels'
value = { texture: 'light'|'balanced'|'max', prop: …, background: …, photo: … }
```

The keys are the same words the compressor already uses (`texture`/`prop`/`background`/`photo`), so there are not
two vocabularies. If the row does not exist yet (nobody ever saved from Ajustes), the code uses its own default —
all four at «Equilibrado» — exactly like the toolbar order when there is no saved row.

- The shape is **not** validated in the database (like the rest of `app_settings`): anything odd that ever arrives
  is treated as «nothing saved» and the default is used (`parseCompressionLevels`, key by key).
- The buckets of avatars, tokens, textures, objects and backgrounds are **public**: «nada sensible en una imagen».
  **The gallery's bucket is the exception and is private** — an adventure's photo can be a spoiler; see
  `specs/modules/photos/SPEC.md`.

## Out of scope

- **Cropping / framing** an image (today it is scaled whole).
- Thumbnails in several sizes.
- Cleaning orphaned objects out of the buckets.
- Automatic re-conversion when a level changes (see above: it only affects what is new).
- A different level per avatar/token (they stay fixed) or per campaign/user (the level is for the whole app).

## Connections

| With | What for |
|---|---|
| `characters` | the character's avatar |
| `bestiary` (H5) | a bestiary entry's token |
| `maps` (H7) | textures, the objects library and the scene background |
| `photos` (H13) | the campaign's gallery, with its own level and a **private** bucket |
| `admin` | the Ajustes screen that saves the four levels |

The compressor is **one only** and lives in `packages/ui` as a utility, never copied into a module. Uploading is
still each module's adapter: the compressor returns a `Blob` and knows nothing about Supabase. The level chosen in
Ajustes is read by each upload before compressing.

## Decisions

### His, 2026-09-14 (verbatim)

1. **A background must not lose quality**: «*¿pero se comprimen y pierden calidad? porque eso sería un
   problema*». That is why a background is the only kind that **never reduces resolution** — it only changes
   format and quality — and why its default was left at 0,90 with headroom, even though the 1:1 test showed no
   visible loss at 0,82.
2. He approved the three conversions after seeing a **real** before/after on images of his own, not on samples.

### His, 2026-09-27 (verbatim)

3. **The photo's numbers**: shown the three levels measured on an image of his and asked whether they were good,
   he answered «*si*». Equilibrado is the default, as in every other kind.

### Mine

- **Compressing in the browser, not on a server**: it costs nothing and needs no function. The price is the old
  Safari case, which is handled by uploading the original rather than failing.
- **A level per kind, not one for everything**: a texture tiles, a background is zoomed, a photo is a handout.
  One number for all three would have to be the most conservative, and would waste the savings on the other two.
- **Uploading one file at a time inside a batch**, in order: a file that fails leaves the rest untouched, and the
  queue says which one it was.
