# Imágenes: subida y compresión (core) — SPEC

## Purpose
Un solo camino para subir imágenes en toda la app, y que ninguna pese más de lo necesario. Hoy hay **tres sitios**
que las quieren y **cada uno va por su lado**: los fondos de mapa (ya suben, sin comprimir), los avatares de
personaje (la ficha dice «Subir imagen: pronto» — no existe) y los tokens de encuentro (el bucket `tokens` está
creado y vacío). Who: todos los miembros para su avatar; el director para fondos y tokens.

## What the user can do
- Elegir una imagen de su disco (o arrastrarla) en tres sitios: **avatar** de personaje, **token** de una entrada de
  bestiario, **fondo** de escena.
- Ver la imagen antes de confirmarla, y cuánto ha adelgazado («2,4 MB → 180 KB»).
- Quitarla y volver a la inicial/color por defecto.

## Rules & limits
- **Se comprime en el navegador ANTES de subir, a WebP.** Se dibuja en un `canvas` y se saca con
  `canvas.toBlob(…, 'image/webp', calidad)`. No hace falta servidor: es la misma pestaña del usuario la que hace el
  trabajo, así que no cuesta ni una función más ni una cuota de Vercel.
  - ⚠ Si el navegador no sabe generar WebP (Safari viejo), **se sube el original**: la subida no puede depender de
    una optimización.
- **Tamaños máximos por destino**, en píxeles, aplicados al redimensionar:
  | Destino | Máximo | Calidad | Por qué |
  |---|---|---|---|
  | Avatar | 512×512 | 0,85 | se pinta a 64 px como mucho |
  | Token de encuentro | 512×512 | 0,85 | una casilla del mapa |
  | Fondo de escena | 2560 px de lado mayor | 0,82 | se ve a pantalla completa y con zoom |
- **Tope duro de 8 MB en el fichero de entrada**, antes de comprimir: por encima se rechaza con un aviso, no se
  intenta. Y tope de 1,5 MB en el resultado subido.
- Sólo `image/png`, `image/jpeg`, `image/webp` y `image/gif` (el gif se aplana al primer fotograma).
- Los tres buckets ya existen (`avatars`, `tokens`, `backgrounds`) y son públicos: **nada sensible en una imagen**.
  El nombre del fichero lo pone el servidor (uuid), nunca el del usuario — un nombre de fichero es entrada no fiable.
- Borrar la fila que apunta a una imagen **no borra el objeto** del bucket; la limpieza es aparte y no está hecha.

## Connections
`characters` (avatar), `bestiary` (token de entrada), `maps` (fondo de escena). El compresor es **uno solo** y vive
en `packages/ui` como utilidad, no copiado en cada módulo. La subida sigue siendo del adaptador de cada módulo:
el compresor devuelve un `Blob` y no sabe de Supabase.

## Out of scope
- Recortar/encuadrar la imagen (hoy se escala entera).
- Miniaturas en varios tamaños.
- Limpieza de objetos huérfanos en los buckets.

## Modelo de datos
> No añade tablas. `characters.data.avatar`, `bestiary_entries.token_url` y `maps_images.url` guardan la URL pública.
