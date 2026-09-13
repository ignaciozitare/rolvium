import type { NewSceneProp, Prop, PropCategory, PropPack, Scene, SceneProp, ScenePropPatch } from '../entities/Scene';

/**
 * Reglas puras de la galería de piezas (specs/modules/maps/SPEC.md § Rebanada 6). Sin React, sin Supabase:
 * sólo números y decisiones. Lo que pinta vive en `ui/`, lo que guarda en `infra/`.
 *
 * Reescrito la noche del 2026-09-12→13 con la biblioteca DE LA HERRAMIENTA (paquetes propios, «lo que se sube
 * sirve para todos») y el panel aprobado el 2026-09-11 (`lWBaU`): UNA o MUCHAS, área, densidad, giro y tamaño al
 * azar, y el orden de apilado del botón derecho.
 */

/** Las seis DE SERIE, en el orden en que se enseñan. Sólo cuentan para las piezas que trae la app. */
export const PROP_CATEGORIES: readonly PropCategory[] = ['furniture', 'vegetation', 'floors', 'doors', 'markers', 'misc'] as const;

/** Igual que el alcance de una luz: se acota para que un dedo torpe no plante un roble de un kilómetro. */
export const MIN_SCALE = 0.05;
export const MAX_SCALE = 50;
export const clampScale = (v: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, v));
/** El deslizador de ESCALA del panel: de un vigésimo a ocho veces. Más que eso se hace con los tiradores. */
export const SCALE_SLIDER_MAX = 8;

/**
 * La huella de una pieza en px de escena. Un solo número de escala para los dos lados: por eso la pieza no
 * se puede deformar por accidente (§ 6.4, «mantiene la proporción»).
 */
export const footprintOf = (p: Pick<Prop, 'naturalWidth' | 'naturalHeight'>, scale: number): { width: number; height: number } => {
  const s = clampScale(scale);
  return { width: p.naturalWidth * s, height: p.naturalHeight * s };
};

/**
 * La escala que representa una huella: el camino de vuelta, para poder RECORDAR lo que el director acaba de
 * hacer con el ratón. Se mide por el ancho porque la proporción está garantizada por `footprintOf`.
 */
export const scaleOfWidth = (p: Pick<Prop, 'naturalWidth'>, width: number): number =>
  clampScale(width / (p.naturalWidth || 1));

/**
 * ¿Hay que reescribir la escala recordada de la biblioteca? Sólo cuando de verdad ha cambiado: si no, cada
 * arrastre que acabe donde empezó escribiría en la biblioteca sin motivo.
 */
export const scaleChanged = (a: number, b: number): boolean => Math.abs(a - b) > 1e-4;

/** Grados en vuelta entera: 0 y 360 son el mismo sitio, así el deslizador no tiene tope raro. */
export const normDeg = (deg: number): number => ((Math.round(deg) % 360) + 360) % 360;

/**
 * Plantar una pieza: la copia que se guarda en la escena. La foto y el nombre se COPIAN —es lo que hace que
 * sobreviva a que borren la pieza de la biblioteca— y el estorbo nace con lo que diga la biblioteca, con la
 * forma cubriendo su huella entera. El director la afina después si quiere.
 */
export function plantProp(
  prop: Prop,
  at: { x: number; y: number },
  scene: Pick<Scene, 'id' | 'campaignId'>,
  layerId: string | null = null,
  scale: number = prop.defaultScale,
  rotation = 0,
  z = 0,
): NewSceneProp {
  const { width, height } = footprintOf(prop, scale);
  return {
    sceneId: scene.id, campaignId: scene.campaignId, layerId, propId: prop.id,
    imageUrl: prop.imageUrl, name: prop.name,
    x: at.x, y: at.y, width, height, rotation: normDeg(rotation), z,
    blocksSight: prop.defaultBlocksSight, blocksMove: prop.defaultBlocksMove,
    blockShape: prop.defaultBlockShape,
    // La forma que estorba nace cubriendo la pieza entera; en círculo manda el lado mayor, que es lo que
    // rodea al dibujo en vez de dejarle las esquinas fuera.
    blockW: prop.defaultBlockShape === 'circle' ? Math.max(width, height) : width,
    blockH: prop.defaultBlockShape === 'circle' ? Math.max(width, height) : height,
    blockDx: 0, blockDy: 0,
  };
}

/**
 * Copiar y pegar una pieza ya plantada, CON su giro y su tamaño (§ 6.5). No es plantar otra vez: plantar
 * volvería a la escala de la biblioteca y perdería lo que se acaba de ajustar a mano.
 */
export const duplicateProp = (p: SceneProp, at: { x: number; y: number }, z = p.z + 1): NewSceneProp => {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = p;
  return { ...rest, x: at.x, y: at.y, z };
};

/** Cuánto se corre lo pegado para que se vea que es otra: media casilla, en px de escena. */
export const PASTE_OFFSET_PX = 14;

/** Coincide por nombre, sin distinguir mayúsculas ni acentos: se busca «arbol» y sale «Árbol». */
const fold = (v: string): string => v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
export const matchesQuery = (p: Pick<Prop, 'name'>, query: string): boolean =>
  fold(query) === '' || fold(p.name).includes(fold(query));

/** Las de la app y las tuyas se enseñan juntas, pero se distinguen: es lo que prepara el catálogo de serie. */
export const isAppProp = (p: Pick<Prop, 'uploadedBy'>): boolean => p.uploadedBy === null;

/**
 * Dónde vive la foto de una pieza dentro del bucket de fondos: en `props/`, sin campaña delante, porque la
 * biblioteca es de la herramienta. Su política de storage va detrás del mismo permiso que la tabla.
 */
export const propPath = (id: string): string => `props/${id}.webp`;

/** El nombre de la pieza a partir del fichero: sin la extensión, y recortado a lo que admite la columna. */
export const nameFromFile = (fileName: string): string => fileName.replace(/\.[^.]+$/, '').trim().slice(0, 80) || 'Pieza';

// ── EL CATÁLOGO: estantes, secciones, orden ─────────────────────────────────

/**
 * Qué se está mirando en el rail del catálogo (`w7sTC0`): recientes, favoritos, un paquete (o «Sin
 * clasificar», que es el paquete nulo) o una categoría de serie. «Todo» es el buscador con la lupa.
 */
export type PropShelf =
  | { kind: 'all' }
  | { kind: 'recent' }
  | { kind: 'favorites' }
  | { kind: 'pack'; id: string | null }
  | { kind: 'category'; category: PropCategory };

export type PropSort = 'name' | 'recent';

export interface PropShelfContext {
  favorites: readonly string[];
  /** Ids de lo último plantado, el más reciente primero. */
  recents: readonly string[];
}

/** ¿Esta pieza cae en este estante? */
export function inShelf(p: Prop, shelf: PropShelf, ctx: PropShelfContext): boolean {
  switch (shelf.kind) {
    case 'all': return true;
    case 'recent': return ctx.recents.includes(p.id);
    case 'favorites': return ctx.favorites.includes(p.id);
    case 'pack': return !isAppProp(p) && p.packId === shelf.id;
    case 'category': return isAppProp(p) && p.category === shelf.category;
  }
}

/** Lo que enseña la galería: el estante elegido y el buscador, en un solo paso. */
export const filterProps = (props: readonly Prop[], shelf: PropShelf, query: string, ctx: PropShelfContext): Prop[] =>
  props.filter(p => inShelf(p, shelf, ctx) && matchesQuery(p, query));

export function sortProps(props: readonly Prop[], sort: PropSort, ctx: PropShelfContext, shelf: PropShelf): Prop[] {
  const list = [...props];
  // Recientes van en el orden en que se plantaron, que es lo que significa «recientes».
  if (shelf.kind === 'recent') return list.sort((a, b) => ctx.recents.indexOf(a.id) - ctx.recents.indexOf(b.id));
  if (sort === 'name') return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface PropSection { key: string; title: string | null; pack: PropPack | null; category: PropCategory | null; props: Prop[] }

/**
 * La rejilla del catálogo: UNA sección por paquete (y otra para las sin clasificar y una por categoría de
 * serie), cada una con su cabecera «Nombre (n piezas)». Con «Todo» y el buscador se ven todas las secciones
 * que tengan algo; en un estante concreto, sólo la suya. Con AGRUPAR apagado sale todo junto sin cabecera.
 */
export function sectionsOf(
  props: readonly Prop[], packs: readonly PropPack[], shelf: PropShelf, query: string, sort: PropSort,
  ctx: PropShelfContext, grouped: boolean,
): PropSection[] {
  const shown = sortProps(filterProps(props, shelf, query, ctx), sort, ctx, shelf);
  if (!grouped || shelf.kind === 'recent' || shelf.kind === 'favorites') {
    return shown.length ? [{ key: 'all', title: null, pack: null, category: null, props: shown }] : [];
  }
  const out: PropSection[] = [];
  const orderedPacks = [...packs].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  for (const pack of orderedPacks) {
    const mine = shown.filter(p => !isAppProp(p) && p.packId === pack.id);
    if (mine.length) out.push({ key: `pack:${pack.id}`, title: pack.name, pack, category: null, props: mine });
  }
  const loose = shown.filter(p => !isAppProp(p) && (p.packId === null || !packs.some(k => k.id === p.packId)));
  if (loose.length) out.push({ key: 'pack:none', title: null, pack: null, category: null, props: loose });
  for (const category of PROP_CATEGORIES) {
    const mine = shown.filter(p => isAppProp(p) && p.category === category);
    if (mine.length) out.push({ key: `cat:${category}`, title: null, pack: null, category, props: mine });
  }
  return out;
}

/** Cuántas piezas hay en cada estante del rail, para las cuentas de al lado del nombre. */
export const countIn = (props: readonly Prop[], shelf: PropShelf, ctx: PropShelfContext): number =>
  props.filter(p => inShelf(p, shelf, ctx)).length;

/** ¿Hay alguna pieza de serie? Sin ninguna, el rail no pinta «DE SERIE · ROLVIUM» (decisión mía, § 6.1). */
export const hasAppProps = (props: readonly Prop[]): boolean => props.some(isAppProp);

// ── RECIENTES ────────────────────────────────────────────────────────────────

/** Cuántas se recuerdan: la rejilla del panel es 6 × 3. */
export const RECENTS_MAX = 18;
/** Meter una al principio, quitando la repetida, y recortar. */
export const pushRecent = (recents: readonly string[], id: string, max = RECENTS_MAX): string[] =>
  [id, ...recents.filter(x => x !== id)].slice(0, max);

// ── SEMBRAR MUCHAS (§ 6.4, S/5) ──────────────────────────────────────────────

export type SowDensity = 'low' | 'mid' | 'high';
export const SOW_DENSITIES: readonly SowDensity[] = ['low', 'mid', 'high'] as const;
/** El radio del área de siembra, en casillas: de media casilla a diez. */
export const SOW_AREA_MIN = 0.5;
export const SOW_AREA_MAX = 10;
export const DEFAULT_SOW_AREA = 3;
/** Cuánto varía el tamaño al azar sobre la escala del sello: ±35 %. */
export const RANDOM_SCALE_SPREAD = 0.35;

/**
 * Cada cuántos px de arrastre cae otra pieza, según la densidad. Se mide sobre el RADIO del área: con más
 * área caben más piezas por paso, y así «densidad» sigue significando lo mismo a cualquier tamaño.
 */
export function sowStepPx(radiusPx: number, density: SowDensity): number {
  const k = density === 'low' ? 2.4 : density === 'mid' ? 1.4 : 0.8;
  return Math.max(4, radiusPx * k);
}

/** Un punto al azar dentro del disco de siembra, repartido de forma uniforme (raíz del radio, no el radio). */
export function scatterIn(center: { x: number; y: number }, radiusPx: number, rng: () => number): { x: number; y: number } {
  const a = rng() * Math.PI * 2;
  const r = Math.sqrt(rng()) * radiusPx;
  return { x: Math.round((center.x + r * Math.cos(a)) * 100) / 100, y: Math.round((center.y + r * Math.sin(a)) * 100) / 100 };
}

/** Un giro al azar en pasos de 5°, como el deslizador. */
export const randomRotation = (rng: () => number): number => normDeg(Math.floor(rng() * 72) * 5);

/** La escala del sello con un ±35 % al azar, acotada. */
export const randomScale = (base: number, rng: () => number): number =>
  clampScale(base * (1 - RANDOM_SCALE_SPREAD + rng() * RANDOM_SCALE_SPREAD * 2));

/**
 * ¿Toca plantar otra? Sí si es la primera del gesto o si la mano ha recorrido el paso desde la última.
 * Devuelve dónde cayó la última para el siguiente turno.
 */
export const dueToSow = (last: { x: number; y: number } | null, at: { x: number; y: number }, stepPx: number): boolean =>
  last === null || Math.hypot(at.x - last.x, at.y - last.y) >= stepPx;

// ── LO PLANTADO: orden de dibujo, orden de apilado, coger y tocar ────────────

/** El orden en que se PINTAN: primero lo de más abajo (z menor), y a igual z lo más antiguo. */
export const paintOrderProps = (props: readonly SceneProp[]): SceneProp[] =>
  [...props].sort((a, b) => a.z - b.z || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

/** El z para plantar una pieza NUEVA: encima de todo lo que haya. */
export const topZ = (props: readonly SceneProp[]): number => (props.length ? Math.max(...props.map(p => p.z)) + 1 : 0);

export type StackMove = 'forward' | 'backward' | 'front' | 'back';

/**
 * Traer adelante · enviar atrás · traer al frente · enviar al fondo (§ 6.6). Devuelve SÓLO los cambios de z
 * que hacen falta, con los z normalizados a 0..n-1 en el orden de pintado. Se hace sobre la lista entera de la
 * escena y no por capa: la capa la decide `layerId` y el motor pinta capa a capa igual.
 */
export function restack(props: readonly SceneProp[], id: string, move: StackMove): { id: string; patch: ScenePropPatch }[] {
  const order = paintOrderProps(props).map(p => p.id);
  const i = order.indexOf(id);
  if (i < 0) return [];
  const next = order.filter(x => x !== id);
  const at = move === 'front' ? next.length : move === 'back' ? 0 : move === 'forward' ? Math.min(next.length, i + 1) : Math.max(0, i - 1);
  next.splice(at, 0, id);
  const byId = new Map(props.map(p => [p.id, p]));
  return next.flatMap((pid, z) => (byId.get(pid)!.z === z ? [] : [{ id: pid, patch: { z } }]));
}

export interface Point2 { x: number; y: number }

/** Del lienzo al marco de la pieza: se deshace el giro alrededor de su centro. */
export function toPropFrame(p: Pick<SceneProp, 'x' | 'y' | 'rotation'>, q: Point2): Point2 {
  const r = (-p.rotation * Math.PI) / 180;
  const dx = q.x - p.x, dy = q.y - p.y;
  return { x: dx * Math.cos(r) - dy * Math.sin(r), y: dx * Math.sin(r) + dy * Math.cos(r) };
}

/** Y del marco de la pieza al lienzo. */
export function fromPropFrame(p: Pick<SceneProp, 'x' | 'y' | 'rotation'>, local: Point2): Point2 {
  const r = (p.rotation * Math.PI) / 180;
  return { x: p.x + local.x * Math.cos(r) - local.y * Math.sin(r), y: p.y + local.x * Math.sin(r) + local.y * Math.cos(r) };
}

/** ¿Cae el punto dentro de la pieza (girada)? Con una holgura para las muy pequeñas. */
export function pointInProp(p: Pick<SceneProp, 'x' | 'y' | 'rotation' | 'width' | 'height'>, q: Point2, tol = 0): boolean {
  const l = toPropFrame(p, q);
  return Math.abs(l.x) <= p.width / 2 + tol && Math.abs(l.y) <= p.height / 2 + tol;
}

/** La pieza de MÁS ARRIBA bajo el punto, en el mismo orden en que se pinta. */
export function hitProp<T extends SceneProp>(props: readonly T[], q: Point2, tol = 0): T | null {
  const ordered = paintOrderProps(props) as T[];
  for (let i = ordered.length - 1; i >= 0; i--) if (pointInProp(ordered[i]!, q, tol)) return ordered[i]!;
  return null;
}

export type PropCorner = 'nw' | 'ne' | 'se' | 'sw';
export const PROP_CORNERS: readonly PropCorner[] = ['nw', 'ne', 'se', 'sw'] as const;

/** Las cuatro esquinas de la pieza en el lienzo, ya giradas, y el punto del tirador de giro (encima). */
export function propCorners(p: Pick<SceneProp, 'x' | 'y' | 'rotation' | 'width' | 'height'>): Record<PropCorner, Point2> {
  const hw = p.width / 2, hh = p.height / 2;
  return {
    nw: fromPropFrame(p, { x: -hw, y: -hh }), ne: fromPropFrame(p, { x: hw, y: -hh }),
    se: fromPropFrame(p, { x: hw, y: hh }), sw: fromPropFrame(p, { x: -hw, y: hh }),
  };
}
/** Dónde va el tirador de giro: sobre el lado de arriba, a `gapPx` del borde (en px de escena). */
export const rotateHandleAt = (p: Pick<SceneProp, 'x' | 'y' | 'rotation' | 'width' | 'height'>, gapPx: number): Point2 =>
  fromPropFrame(p, { x: 0, y: -p.height / 2 - gapPx });

/**
 * Escalar desde una esquina MANTENIENDO LA PROPORCIÓN (§ 6.4): la huella nueva sale de lo lejos que está la
 * mano del centro comparado con lo lejos que estaba la esquina. Se acota por la escala mínima para que una
 * pieza no pueda encogerse hasta desaparecer.
 */
export function scaleFromCorner(p: Pick<SceneProp, 'x' | 'y' | 'rotation' | 'width' | 'height'>, pointer: Point2, minPx = 8): { width: number; height: number } {
  const l = toPropFrame(p, pointer);
  const half = Math.hypot(p.width / 2, p.height / 2) || 1;
  const k = Math.hypot(l.x, l.y) / half;
  const width = Math.max(minPx, p.width * k);
  const height = width * (p.height / (p.width || 1));
  return { width: Math.round(width * 100) / 100, height: Math.round(height * 100) / 100 };
}

/** El giro que apunta la mano desde el centro, con el tirador «arriba» como 0°. En pasos de 1°. */
export function rotationToward(p: Pick<SceneProp, 'x' | 'y'>, pointer: Point2): number {
  const deg = (Math.atan2(pointer.y - p.y, pointer.x - p.x) * 180) / Math.PI + 90;
  return normDeg(deg);
}
