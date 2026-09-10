import type { Layer, Room, Scene } from '../entities/Scene';

/**
 * EL PINCEL QUE PINTA ENCIMA (specs/modules/maps/SPEC.md § «Rebanada 10 · A»).
 *
 * 🔑 **PINTAR NO CAMBIA EL MAPA.** Ni por dónde se anda, ni qué se ve, ni la luz: es sólo cómo se ve. Es la
 * línea que separa este pincel del Builder, y es lo que la primera versión de la rebanada entendió al revés
 * —construyó un pincel que EXCAVABA— hasta que él lo paró en pantalla el 2026-09-10: «*lo que has hecho no es
 * un pincel para pintar sobre las habitaciones o muros o fotos que pongas, lo que eso es, es cavar con
 * construir*». Lo que excavaba se mudó al Builder (§ «Rebanada 10 · B»); esto es lo que pedía desde el
 * principio.
 *
 * Aquí vive SÓLO la aritmética del pincel: sobre qué se pinta, qué se puede hacer en cada sitio, y dónde vive
 * el PNG de cada cosa. Cómo se estampa el brochazo es de `usePaintBrush`, y la forma del brochazo sigue
 * viniendo de `@rolvium/core` como en la rebanada 9.
 */

/**
 * SOBRE QUÉ SE PINTA, en el orden del diseño aprobado (`rolvium.pen` · `TlJot` § S/1).
 *
 * 🔑 **LO ELEGIDO ES EL LÍMITE DEL PINCEL** (orden suya, 2026-09-10: «*si elijo pintar una habitación el
 * scope de ese pincel es la habitación; si se me va la mano al muro, el muro no se tiene que pintar*»). Y el
 * recorte NO sale de una comprobación que alguien pueda olvidarse de escribir: sale de DÓNDE SE GUARDA —la
 * pintura de una sala vive en su fila y se dibuja dentro de su contorno, la de la roca vive en la escena y se
 * dibuja dentro de la roca—. Salirse es imposible.
 *
 *  · `room`  — una HABITACIÓN: se pinta su suelo. El PNG cuelga de su fila, así que el día que una sala se
 *    pueda mover la pintura se va con ella (§ 10A.5) sin escribir una línea más.
 *  · `rock`  — el MURO: se pinta la roca. Va por ESCENA porque la roca no es una fila: es el negativo de lo
 *    excavado, «todo lo que no es habitación».
 *  · `layer` — una FOTO: la capa de terreno donde ya viven las fotos del mapa.
 *  · `fog`   — la NIEBLA, que es la de siempre y no se ha tocado: ahí «pintar» es ocultar y «borrar» revelar.
 */
export type PaintOn = 'room' | 'rock' | 'layer' | 'fog';
export const PAINT_ON: PaintOn[] = ['room', 'rock', 'layer', 'fog'];

/**
 * QUÉ HAGO (`rolvium.pen` · `TlJot` § S/2). Tres cosas, y cada una sobre su propio lienzo:
 *
 *  · `paint`   — PINTAR: pone pintura encima. La pintura **se suma** capa sobre capa, que es literalmente lo
 *    que hace un lienzo de píxeles (suyo: «*si tengo la base del piso a cuadros, pinto musgo arriba y pongo
 *    otro color arriba de éste, se van sumando*»).
 *  · `erase`   — BORRAR PINTURA: la quita y deja ver lo que había debajo. **No derriba nada** (§ 10A.6:
 *    preguntado si hacía falta un borrador que derribara, «*no hace falta*»).
 *  · `uncover` — DESTAPAR LO DE DEBAJO: es el pincel de la rebanada 9 intacto, el que QUITA para que asome la
 *    capa de abajo. Convive con los otros dos porque son lienzos distintos: aquél tapa lo que ya estaba, éste
 *    pone encima.
 */
export type PaintAction = 'paint' | 'erase' | 'uncover';

/**
 * QUÉ SE PUEDE HACER EN CADA SITIO. Y lo que no se puede **no sale**, no sale apagado: un mando que no hace
 * nada es peor que no tenerlo (misma regla que ya regía en el panel de la rebanada 10 anterior).
 *
 *  · Una HABITACIÓN y una FOTO tienen debajo algo que enseñar —la capa de abajo—, así que llevan las tres.
 *  · La ROCA no: no guarda máscara ninguna (la migración `20260910160000_maps_paint.sql` sólo le da pintura),
 *    y destapar la roca no significa nada — debajo no hay mapa, hay el fondo de la escena.
 *  · La NIEBLA es sí o no: pintarla la oculta y borrarla la revela. Destapar sería revelar otra vez.
 */
export function paintActionsFor(on: PaintOn): PaintAction[] {
  return on === 'room' || on === 'layer' ? ['paint', 'erase', 'uncover'] : ['paint', 'erase'];
}

/** CON QUÉ PINTO (`TlJot` § S/3): una textura del catálogo o un color. El mismo catálogo que ya usa Builder. */
export type PaintWith = 'texture' | 'color';
export const PAINT_WITH: PaintWith[] = ['texture', 'color'];

/**
 * ¿Se elige con qué se pinta? En la NIEBLA no: no es pintura, es sí o no. Por eso ahí no salen ni «con qué
 * pinto» ni la paleta — y tampoco la transparencia, que la niebla guarda por casillas.
 */
export const paintsWithStuff = (on: PaintOn): boolean => on !== 'fog';

/**
 * LA NIEBLA, TRADUCIDA. Es el único destino que no escribe un PNG: sigue yendo por `paintFog`, que es la
 * herramienta de la rebanada 2 y no se ha tocado. Pintar niebla es OCULTAR; borrarla es REVELAR.
 */
export const fogOpOf = (action: PaintAction): 'reveal' | 'hide' => (action === 'paint' ? 'hide' : 'reveal');

// ── DÓNDE VIVE EL PNG ────────────────────────────────────────────────────────
/**
 * Todos en el bucket `backgrounds`, que ya existe con sus políticas, bajo `paint/`. `foldername[1]` sigue
 * siendo la campaña —que es lo único que miran esas políticas—, así que **ninguna política de almacenamiento
 * nueva**. La carpeta aparte de `masks/` está sólo para que al mirarla se sepa de qué es cada fichero.
 */
export const roomPaintPath = (campaignId: string, roomId: string): string => `${campaignId}/paint/room-${roomId}.png`;
export const rockPaintPath = (campaignId: string, sceneId: string): string => `${campaignId}/paint/rock-${sceneId}.png`;
export const layerPaintPath = (campaignId: string, layerId: string): string => `${campaignId}/paint/layer-${layerId}.png`;

/**
 * EL ROMPE-CACHÉ. Sin él el navegador se queda con el PNG que ya tenía en esa dirección y parece que el
 * pincel no pinta — es el mismo fallo que la rebanada 7 dejó escrito para las máscaras.
 *
 * Cada tabla usa la convención QUE YA TENÍA, en vez de inventar una tercera: una sala y una escena mueven su
 * `updated_at` solo (disparadores `maps_rooms_touch` y `maps_scenes_touch`), y una capa lleva número de
 * versión desde la rebanada 7.
 */
const bust = (url: string, v: string | number): string => `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(String(v))}`;

export const roomPaintSrc = (room: Pick<Room, 'floorPaintUrl' | 'updatedAt'>): string | null =>
  room.floorPaintUrl ? bust(room.floorPaintUrl, room.updatedAt) : null;
export const rockPaintSrc = (scene: Pick<Scene, 'rockPaintUrl' | 'updatedAt'>): string | null =>
  scene.rockPaintUrl ? bust(scene.rockPaintUrl, scene.updatedAt) : null;
export const layerPaintSrc = (layer: Pick<Layer, 'paintUrl' | 'paintVersion'>): string | null =>
  layer.paintUrl ? bust(layer.paintUrl, layer.paintVersion) : null;
