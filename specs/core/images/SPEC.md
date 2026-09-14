# Imágenes: subida y compresión (core) — SPEC

## Purpose
Un solo camino para subir imágenes en toda la app, y que ninguna pese más de lo necesario. Who: todos los
miembros para su avatar; el director para fichas de bestiario, texturas, objetos y fondos.

Origen de este apartado (2026-09-14): su biblioteca local pesaba 134 MB en texturas y el tráfico de Supabase
(5 GB/mes en el plan gratis) se agotaba a los ~90 aperturas de mesa. Se le enseñó un antes/después real (WebP)
sobre una textura suya, luego sobre un objeto y sobre un fondo, y aprobó las tres conversiones — con el fondo
reabriendo a propósito una decisión suya anterior (ver el aviso más abajo).

## What the user can do
- Elegir una imagen de su disco (o arrastrarla) en cinco sitios: **avatar** de personaje, **token** de una entrada
  de bestiario, **textura**, **objeto** (pieza de la galería) y **fondo** de escena.
- Ver la imagen antes de confirmarla, y cuánto ha adelgazado («2,4 MB → 180 KB»).
- Quitarla y volver a la inicial/color por defecto.
- **Un administrador** (quien ya puede entrar a Admin → Ajustes) elige, **por separado para texturas, para
  objetos y para fondos**, uno de tres niveles: **Ligero**, **Equilibrado** (por defecto) o **Máximo ahorro**.
  Avatar y token no tienen nivel — su tamaño ya es mínimo y no es donde pesa el problema.

## Rules & limits
- **Se comprime en el navegador ANTES de subir, a WebP.** Se dibuja en un `canvas` y se saca con
  `canvas.toBlob(…, 'image/webp', calidad)`. No hace falta servidor: es la misma pestaña del usuario la que hace el
  trabajo, así que no cuesta ni una función más ni una cuota de Vercel.
  - ⚠ Si el navegador no sabe generar WebP (Safari viejo), **se sube el original**: la subida no puede depender de
    una optimización.
- **Avatar y token — fijos, sin nivel:** 512×512, calidad 0,85 (se pintan a 64 px o a una casilla; no hay margen
  que ganar ahí).
- **Textura, objeto y fondo — dependen del nivel elegido en Ajustes**, uno independiente por tipo:

  | Nivel | Textura (lado máx. · calidad) | Objeto (lado máx. · calidad) | Fondo (lado máx. · calidad) |
  |---|---|---|---|
  | Ligero | 1280 px · 0,85 | 1024 px · 0,85 | sin reducir · 0,95 |
  | **Equilibrado (por defecto)** | 1024 px · 0,82 | 768 px · 0,80 | sin reducir · 0,90 |
  | Máximo ahorro | 800 px · 0,80 | 640 px · 0,75 | sin reducir · 0,82 |

  Números probados de verdad (Chromium headless, el mismo `canvas.toBlob` de producción) sobre una textura, un
  objeto y un fondo reales de su biblioteca antes de aprobarlos.

  > ⚠ **El fondo NUNCA reduce resolución, solo cambia de formato/calidad** — a diferencia de textura y objeto.
  > Es lo que más de cerca se mira de toda la mesa (pantalla completa y con zoom), y esa era su objeción
  > original: *«¿pero se comprimen y pierden calidad? porque eso sería un problema»* (2026-09-14). La prueba de
  > zoom 1:1 sobre la zona más oscura y detallada de un fondo real no mostró pérdida visible ni siquiera en
  > Máximo ahorro (0,82); aun así se dejó 0,90 de nivel por defecto, con más colchón.
- **Cambiar un nivel en Ajustes no reconvierte nada retroactivo**: solo afecta a lo que se suba a partir de ese
  momento. Reconvertir lo ya subido es una acción aparte (ver «Conversión de la biblioteca existente»).
- **Tope duro de 8 MB en el fichero de entrada**, antes de comprimir: por encima se rechaza con un aviso, no se
  intenta. Y tope de 1,5 MB en el resultado subido.
- Sólo `image/png`, `image/jpeg`, `image/webp` y `image/gif` (el gif se aplana al primer fotograma).
- Los buckets ya existen y son públicos: **nada sensible en una imagen**. El nombre del fichero lo pone el
  servidor (uuid), nunca el del usuario — un nombre de fichero es entrada no fiable.
- Borrar la fila que apunta a una imagen **no borra el objeto** del bucket; la limpieza es aparte y no está hecha.

### Conversión de la biblioteca existente (única vez, 2026-09-14)
Su biblioteca local de ese día (41 texturas · 50 objetos · 18 fondos) se convierte **una sola vez**, con el nivel
Equilibrado de cada tipo — el mismo que aprobó viendo el antes/después real. No es un job recurrente ni algo que
se dispare solo; es una migración puntual contra su Supabase LOCAL (la de producción tiene esas tres bibliotecas
vacías today, así que no aplica todavía — se sube por el camino normal cuando él la traslade).
- Objeto: al reducir el lado máximo, se actualiza también el ancho/alto natural guardado junto a la pieza para
  que la escala por defecto siga siendo correcta.
- Textura y fondo: no guardan ancho/alto aparte, así que no hay nada más que sincronizar.
- Se sobrescribe el mismo fichero en el mismo storage path — así lo ya plantado en una escena (que guarda su
  propia copia de la URL) se sirve igual de liviano sin tocar una sola fila de lo plantado.

## Connections
`characters` (avatar), `bestiary` (token de entrada), `maps` (texturas, piezas de la galería y fondo de escena).
`admin` (pantalla de Ajustes, guarda los tres niveles). El compresor es **uno solo** y vive en `packages/ui` como
utilidad, no copiado en cada módulo. La subida sigue siendo del adaptador de cada módulo: el compresor devuelve
un `Blob` y no sabe de Supabase. El nivel elegido en Ajustes lo lee cada subida antes de comprimir.

## Out of scope
- Recortar/encuadrar la imagen (hoy se escala entera).
- Miniaturas en varios tamaños.
- Limpieza de objetos huérfanos en los buckets.
- Reconversión automática al cambiar de nivel (ver arriba: solo afecta a lo nuevo).
- Un nivel distinto por avatar/token (se quedan fijos) o por campaña/usuario (el nivel es de toda la app).

## Modelo de datos
**No hace falta tabla nueva.** Los tres niveles (textura, objeto, fondo) son una fila más en `app_settings`
(`key`/`value` genérico, ya usada por el orden de la barra de mapas): `key = 'images.compression_levels'`,
`value = { texture: 'light'|'balanced'|'max', prop: …, background: … }` (mismas claves que ya usa el
compresor — `texture`/`prop`/`background` — para no tener dos vocabularios distintos). Si la fila no existe todavía
(nadie ha guardado nunca desde Ajustes), se usa un valor por defecto en el código — los tres en «equilibrado» —
igual que el orden de la barra cuando no hay fila guardada.

- **Lee** cualquiera con sesión (hace falta para comprimir al subir, sea quien sea quien suba).
- **Escribe** solo quien tiene el permiso `manage_settings` — la misma regla que ya protege el resto de Ajustes
  y el orden de la barra. No hace falta ninguna política nueva: `app_settings` ya tiene exactamente esta forma
  de acceso (lectura para todos, escritura por permiso) desde que se creó.
- No se valida la forma del valor en la base (igual que el resto de `app_settings`): si alguna vez llega algo
  raro, el código lo trata como si no hubiera nada guardado y usa el valor por defecto.
