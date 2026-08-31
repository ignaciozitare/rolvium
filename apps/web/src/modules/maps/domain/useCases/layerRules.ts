import { sightRadiusPx } from '@rolvium/core';
import type { GridSettings, Layer, LayerKind, Light, LightKind, LightShape, NewLight } from '../entities/Scene';

/**
 * Reglas de las capas de contenido y de las luces de ambiente (rebanada 7).
 * Viven aquí y no en `mapRules.ts` porque ése ya pasa de las 400 líneas y va de geometría del lienzo.
 * Nada de esto toca la visión ni las reglas del manual: las capas son composición y las luces son pintura.
 */

// ── Capas ────────────────────────────────────────────────────────────────────

export const LAYER_KINDS: LayerKind[] = ['terrain', 'objects', 'creatures', 'dm_notes'];
/** Las tres de las que hay exactamente una por escena. El terreno es el único sin límite. */
export const FIXED_LAYER_KINDS: LayerKind[] = ['objects', 'creatures', 'dm_notes'];
export const isFixedKind = (k: LayerKind): boolean => FIXED_LAYER_KINDS.includes(k);

/**
 * En qué franja pinta cada tipo. NO se guarda porque no se elige: es el motor. Lo que el director ordena es
 * el terreno entre sí (`sortOrder`), y para eso están las flechas del panel.
 */
export const PAINT_BAND: Record<LayerKind, number> = { terrain: 0, objects: 1, creatures: 2, dm_notes: 3 };

const byBandThenOrder = (a: Layer, b: Layer): number =>
  PAINT_BAND[a.kind] - PAINT_BAND[b.kind] || a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt);

/** Orden de PINTADO: primero lo de más abajo. Es el orden en el que el lienzo las dibuja. */
export const paintOrder = (layers: readonly Layer[]): Layer[] => [...layers].sort(byBandThenOrder);
/** Orden del PANEL: primero lo de más arriba, como en cualquier editor. */
export const panelOrder = (layers: readonly Layer[]): Layer[] => paintOrder(layers).reverse();

export const terrainLayers = (layers: readonly Layer[]): Layer[] =>
  paintOrder(layers).filter(l => l.kind === 'terrain');
export const layerOfKind = (layers: readonly Layer[], kind: LayerKind): Layer | null =>
  layers.find(l => l.kind === kind) ?? null;

/** Qué se coloca por defecto en cada capa cuando su `layerId` viene vacío. */
export type ElementKind = 'drawing' | 'token' | 'light';
export const NATURAL_LAYER: Record<ElementKind, LayerKind> = { drawing: 'objects', token: 'creatures', light: 'objects' };

/**
 * La capa en la que está de verdad un elemento. `layerId` vacío significa «su capa natural», que es lo que
 * vale para todo lo dibujado antes de esta rebanada — por eso no hubo que rellenar nada al migrar.
 */
export function resolveLayer(layers: readonly Layer[], layerId: string | null, of: ElementKind): Layer | null {
  if (layerId) return layers.find(l => l.id === layerId) ?? null;
  return layerOfKind(layers, NATURAL_LAYER[of]);
}

/**
 * ¿Esta capa viaja al navegador de un jugador? Misma verdad que el helper SQL
 * `public.maps_layer_sends_to_players`, repetida aquí SÓLO para pintar: quien manda es la RLS. Un jugador
 * nunca recibe nada de «Notas del director» —no es que se pinte oculta, es que no se envía— ni de una capa
 * apagada.
 */
export const layerSendsToPlayers = (layer: Layer | null): boolean =>
  layer === null || (layer.visible && layer.kind !== 'dm_notes');

/**
 * ¿Se pinta este elemento? Apagar una capa la quita para TODOS, director incluido: es el ojo de Photoshop,
 * no un interruptor de privacidad (dueño, 2026-08-31). Lo único que separa al director del jugador es que a
 * él sí se le pinta la capa de notas.
 */
export function isPainted(layer: Layer | null, isDm: boolean): boolean {
  if (layer === null) return true;
  if (!layer.visible) return false;
  return layer.kind !== 'dm_notes' || isDm;
}

/** Bloqueada = se ve pero no se toca. Es lo que evita arrastrar el terreno al mover una ficha. */
export const canEditIn = (layer: Layer | null): boolean => layer === null || !layer.locked;

/** A partir de aquí la escena empieza a pesar. AVISA, no bloquea: «sin límite» fue elección del dueño. */
export const TERRAIN_WARN_AT = 3;
export const terrainOverweight = (layers: readonly Layer[]): boolean => terrainLayers(layers).length >= TERRAIN_WARN_AT;

export const nextTerrainSortOrder = (layers: readonly Layer[]): number =>
  terrainLayers(layers).reduce((max, l) => Math.max(max, l.sortOrder), -1) + 1;

/**
 * Subir o bajar una capa de terreno: devuelve SÓLO las filas que cambian de orden, para no reescribir la
 * lista entera en cada clic. Vacío si ya está en el extremo.
 */
export function reorderTerrain(layers: readonly Layer[], id: string, dir: 'up' | 'down'): { id: string; sortOrder: number }[] {
  const list = terrainLayers(layers);
  const i = list.findIndex(l => l.id === id);
  if (i < 0) return [];
  // «Subir» en el panel es subir en la pila de pintado, y el panel se ve al revés que el orden de pintado.
  const j = dir === 'up' ? i + 1 : i - 1;
  if (j < 0 || j >= list.length) return [];
  const a = list[i]!, b = list[j]!;
  return [{ id: a.id, sortOrder: b.sortOrder }, { id: b.id, sortOrder: a.sortOrder }];
}

/**
 * Soltar una capa de terreno ENCIMA de otra: la arrastrada pasa a ocupar el sitio de la otra y las de en
 * medio se corren. Es el mismo resultado que dar a subir o bajar varias veces, en un solo gesto.
 *
 * Los sitios no se recalculan desde cero: se REPARTEN los `sortOrder` que ya existían, en orden. Así el
 * hueco entre dos capas sigue siendo el que era, y sólo viajan a la base de datos las filas que de verdad
 * han cambiado de sitio — soltar una capa donde ya estaba no escribe nada.
 */
export function reorderTerrainTo(layers: readonly Layer[], id: string, targetId: string): { id: string; sortOrder: number }[] {
  const list = terrainLayers(layers);
  const from = list.findIndex(l => l.id === id);
  const to = list.findIndex(l => l.id === targetId);
  if (from < 0 || to < 0 || from === to) return [];
  const next = [...list];
  next.splice(to, 0, ...next.splice(from, 1));
  const slots = list.map(l => l.sortOrder).sort((a, b) => a - b);
  return next
    .map((l, i) => ({ id: l.id, sortOrder: slots[i]! }))
    .filter(m => list.find(l => l.id === m.id)!.sortOrder !== m.sortOrder);
}

// ── La máscara del pincel de transparencia ───────────────────────────────────

/** Dónde vive el PNG de la máscara. `foldername[1]` sigue siendo la campaña, que es lo que mira la política. */
export const maskPath = (campaignId: string, layerId: string): string => `${campaignId}/masks/${layerId}.png`;

/** La URL con la que pintarla, con la versión pegada para que ningún navegador se quede con la vieja. */
export const maskSrc = (layer: Pick<Layer, 'maskUrl' | 'maskVersion'>): string | null =>
  layer.maskUrl ? `${layer.maskUrl}${layer.maskUrl.includes('?') ? '&' : '?'}v=${layer.maskVersion}` : null;

/**
 * Fuerza del pincel, de 0 a 1. A tope borra del todo y asoma la capa de abajo; a media deja translúcido.
 * No es un borrador: la foto original no se toca nunca y subir la fuerza en sentido contrario la devuelve.
 */
export const DEFAULT_MASK_STRENGTH = 0.6;
export const clampStrength = (v: number): number => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
/** El porcentaje que se enseña junto al deslizador. */
export const strengthLabel = (v: number): string => `${Math.round(clampStrength(v) * 100)} %`;

/**
 * TAMAÑO del pincel de transparencia, en CASILLAS y **continuo**.
 *
 * Va aparte de `BRUSH_SIZES` (los cuatro discos del pincel de niebla) a propósito: el dueño pidió el tamaño
 * «gradual, no me sirve eso» para ESTE pincel, y tocar la constante compartida le habría cambiado también la
 * niebla, que nadie pidió.
 */
export const MASK_SIZE_MIN = 0.2;
export const MASK_SIZE_MAX = 6;
export const DEFAULT_MASK_SIZE = 1.2;
export const clampMaskSize = (v: number): number =>
  Math.min(MASK_SIZE_MAX, Math.max(MASK_SIZE_MIN, Number.isFinite(v) ? v : DEFAULT_MASK_SIZE));

/**
 * DUREZA del borde, de 0 a 1. **Es el BORDE, no la fuerza ni el tamaño** (los tres se confundían y el dueño
 * lo dejó claro): a 0 el brochazo se difumina desde el centro, a 1 corta a filo.
 */
export const DEFAULT_MASK_HARDNESS = 0.4;
export const clampHardness = (v: number): number => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
export const hardnessLabel = (v: number): string => `${Math.round(clampHardness(v) * 100)} %`;

/** Una parada del degradado radial del pincel: a qué distancia del centro (0 = centro, 1 = borde) y con qué opacidad. */
export interface MaskStop { at: number; alpha: number }

/**
 * Las paradas del degradado con el que se estampa el pincel.
 *
 * Antes estaban ESCRITAS A FUEGO en `useMaskPainter` (`0 → a`, `0.6 → 0.75a`, `1 → 0`), así que el borde era
 * siempre el mismo y no había forma de endurecerlo ni de suavizarlo. Ahora las manda la dureza:
 * el disco opaco llega hasta `dureza` y de ahí al borde se desvanece. Se topa en 0.98 para que a dureza
 * máxima siga quedando un pelo de degradado — un círculo del todo duro deja el recorte a tijera, y lo que se
 * pidió es MEZCLAR dos fotos.
 */
export function maskStops(strength: number, hardness: number): MaskStop[] {
  const alpha = clampStrength(strength);
  const plateau = Math.min(0.98, clampHardness(hardness));
  return [{ at: 0, alpha }, { at: plateau, alpha }, { at: 1, alpha: 0 }];
}

/**
 * El pincel tiene DOS SENTIDOS, como el de la niebla tiene Revelar y Ocultar. Es lo que hace verdad la
 * promesa del spec: «la foto original no se toca, siempre se puede volver atrás subiendo la fuerza del
 * pincel en sentido contrario». `erase` quita la capa y asoma la de abajo; `restore` la devuelve.
 */
export type MaskDirection = 'erase' | 'restore';
export const MASK_DIRECTIONS: MaskDirection[] = ['erase', 'restore'];

/**
 * De píxeles de ESCENA a píxeles de la MÁSCARA, que se guarda reducida (ver `maskSize`). Sin esto, pintar en
 * una esquina del mapa dejaría el brochazo en otra parte de la máscara.
 */
export function toMaskPoint(p: { x: number; y: number }, scene: { width: number; height: number }, size: { width: number; height: number }): { x: number; y: number } {
  return { x: (p.x * size.width) / scene.width, y: (p.y * size.height) / scene.height };
}

/**
 * Los puntos donde se estampa el pincel a lo largo de un arrastre. A mano alzada el ratón salta, y estampar
 * sólo en los extremos dejaría el trazo a lunares; se rellena cada `step` píxeles.
 * Devuelve SIEMPRE al menos el punto de llegada, para que un clic suelto también pinte.
 */
export function strokeDots(from: { x: number; y: number }, to: { x: number; y: number }, step: number): { x: number; y: number }[] {
  const d = Math.hypot(to.x - from.x, to.y - from.y);
  const n = Math.floor(d / Math.max(0.5, step));
  const dots: { x: number; y: number }[] = [];
  for (let i = 1; i <= n; i++) dots.push({ x: from.x + ((to.x - from.x) * i) / n, y: from.y + ((to.y - from.y) * i) / n });
  if (dots.length === 0 || dots[dots.length - 1]!.x !== to.x || dots[dots.length - 1]!.y !== to.y) dots.push({ x: to.x, y: to.y });
  return dots;
}

/** El pincel se estampa cada cuarto de su radio: menos deja bandas, más cuesta sin verse. */
export const MASK_STEP_RATIO = 0.25;

/**
 * La máscara no se guarda al tamaño del mapa: con el lado largo a 1024 sobra para una mezcla suave y el PNG
 * pesa una fracción. Es una decisión de peso, no de calidad — el degradado del pincel es ancho de por sí.
 */
export const MASK_MAX_SIDE = 1024;
export function maskSize(scene: { width: number; height: number }): { width: number; height: number } {
  const k = Math.min(1, MASK_MAX_SIDE / Math.max(scene.width, scene.height));
  return { width: Math.max(1, Math.round(scene.width * k)), height: Math.max(1, Math.round(scene.height * k)) };
}

// ── Luces de ambiente ────────────────────────────────────────────────────────

export const LIGHT_SHAPES: LightShape[] = ['cone', 'radius', 'square'];
export const LIGHT_KINDS: LightKind[] = ['torch', 'bulb', 'fire', 'lantern', 'flashlight', 'moonlight', 'magic'];

/**
 * Lo que trae cada tipo al colocarlo. El director puede cambiarlo todo después.
 * Los colores salen SIEMPRE de `LIGHT_COLORS`: una sola paleta, y los tipos se distinguen por su forma y
 * por su RITMO de parpadeo, no por tonos casi idénticos que en el selector no se sabrían separar.
 */
export const LIGHT_PRESETS: Record<LightKind, { color: string; rangeM: number; flicker: boolean; shape: LightShape; coneAngle: number }> = {
  torch:      { color: '#e8a24e', rangeM: 6,  flicker: true,  shape: 'radius', coneAngle: 60 },
  bulb:       { color: '#f0e6c8', rangeM: 4,  flicker: false, shape: 'radius', coneAngle: 60 },
  fire:       { color: '#e07a3c', rangeM: 8,  flicker: true,  shape: 'radius', coneAngle: 60 },
  lantern:    { color: '#e8a24e', rangeM: 5,  flicker: true,  shape: 'radius', coneAngle: 60 },
  flashlight: { color: '#f0e6c8', rangeM: 9,  flicker: false, shape: 'cone',   coneAngle: 60 },
  moonlight:  { color: '#9fb6d4', rangeM: 12, flicker: false, shape: 'square', coneAngle: 90 },
  magic:      { color: '#a97fe0', rangeM: 5,  flicker: true,  shape: 'radius', coneAngle: 60 },
};

/**
 * La paleta de las luces. Son valores que se GUARDAN en la fila, como `STROKE_COLORS` o `BG_COLORS`: por eso
 * viven en el dominio y no como variables de CSS — una variable cambia con el tema y estos no pueden.
 */
export const LIGHT_COLORS = ['#e8a24e', '#f0e6c8', '#e07a3c', '#e0625c', '#a97fe0', '#9fb6d4'] as const;
/** El alcance se toca en pasos de medio metro: es como se habla en la mesa. */
export const RANGE_STEP_M = 0.5;
export const MIN_RANGE_M = 0.5;
export const MAX_RANGE_M = 60;
export const clampRangeM = (v: number): number => Math.min(MAX_RANGE_M, Math.max(MIN_RANGE_M, Math.round(v / RANGE_STEP_M) * RANGE_STEP_M));

export function newLightOf(kind: LightKind, at: { x: number; y: number }, scene: { id: string; campaignId: string }, layerId: string | null = null): NewLight {
  const p = LIGHT_PRESETS[kind];
  return {
    sceneId: scene.id, campaignId: scene.campaignId, layerId, shape: p.shape, kind,
    x: at.x, y: at.y, rotation: 0, coneAngle: p.coneAngle, color: p.color, flicker: p.flicker,
    // Una luz nace proyectando sombra: lo normal es que la piedra la pare (§ 7.2). El interruptor del
    // editor está para lo excepcional —un resplandor mágico que atraviesa el muro—, no para lo corriente.
    rangeM: p.rangeM, castsShadow: true,
  };
}

/**
 * El RITMO del parpadeo, por tipo (petición del dueño al aprobar el diseño, 2026-08-31: «que en algún
 * momento tengan cierta animación, como si fuera de una hoguera o una antorcha, o una luz que parpadea»).
 *
 * Va por TIPO y no por un control nuevo: una antorcha tiembla rápido y poco, una hoguera respira lento y
 * amplio, y una bombilla estropeada da golpes secos. Así el director sólo enciende o apaga «Parpadea» y no
 * se le pide que ajuste velocidades. `kind` y `flicker` ya estaban guardados, así que no hace falta migrar
 * nada ni repasar las luces ya colocadas.
 *
 * `depth` = cuánto baja el brillo respecto al máximo (0 = quieta, 1 = se apaga del todo).
 * `sharp` = el corte es a golpes (bombilla) en vez de una respiración (fuego).
 */
export interface FlickerRhythm { periodMs: number; depth: number; sharp: boolean }
export const FLICKER: Record<LightKind, FlickerRhythm> = {
  torch:      { periodMs: 220,  depth: 0.14, sharp: false },
  fire:       { periodMs: 1900, depth: 0.26, sharp: false },
  bulb:       { periodMs: 2600, depth: 0.55, sharp: true },
  lantern:    { periodMs: 950,  depth: 0.09, sharp: false },
  flashlight: { periodMs: 1400, depth: 0.10, sharp: false },
  moonlight:  { periodMs: 4000, depth: 0.05, sharp: false },
  magic:      { periodMs: 2400, depth: 0.30, sharp: false },
};
/** El ritmo de esta luz, o `null` si no parpadea (y entonces no se anima nada). */
export const flickerOf = (l: Pick<Light, 'kind' | 'flicker'>): FlickerRhythm | null => (l.flicker ? FLICKER[l.kind] : null);

/** Alcance de la luz en px de escena, por el mismo camino que la visión nocturna. */
export const lightRadiusPx = (l: Pick<Light, 'rangeM'>, grid: Pick<GridSettings, 'size'>): number =>
  sightRadiusPx('night', l.rangeM, grid.size) ?? 0;

/** El alcance rotulado en metros, como en el interruptor de la luz de la escena. */
export const rangeLabelM = (l: Pick<Light, 'rangeM'>): string => String(Math.round(l.rangeM * 10) / 10);

/**
 * El sector del cono como `path` de SVG: del centro al borde, un arco, y de vuelta. `rotation` es hacia
 * dónde apunta (0 = a la derecha, y crece en el sentido de las agujas, como el resto del lienzo).
 */
export function conePath(l: Pick<Light, 'x' | 'y' | 'rotation' | 'coneAngle'>, radius: number): string {
  const half = Math.min(180, Math.max(0.5, l.coneAngle / 2));
  const rad = (deg: number): number => (deg * Math.PI) / 180;
  const a0 = rad(l.rotation - half), a1 = rad(l.rotation + half);
  const p0 = { x: l.x + radius * Math.cos(a0), y: l.y + radius * Math.sin(a0) };
  const p1 = { x: l.x + radius * Math.cos(a1), y: l.y + radius * Math.sin(a1) };
  const large = l.coneAngle > 180 ? 1 : 0;
  const n = (v: number): string => String(Math.round(v * 100) / 100);
  return `M${n(l.x)} ${n(l.y)} L${n(p0.x)} ${n(p0.y)} A${n(radius)} ${n(radius)} 0 ${large} 1 ${n(p1.x)} ${n(p1.y)} Z`;
}

/** Las luces que se pintan en el lienzo, ya resueltas contra sus capas y en orden de pintado. */
export function paintedLights(lights: readonly Light[], layers: readonly Layer[], isDm: boolean): Light[] {
  return lights.filter(l => isPainted(resolveLayer(layers, l.layerId, 'light'), isDm));
}
