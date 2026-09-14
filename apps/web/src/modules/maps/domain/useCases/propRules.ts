import type { NewSceneProp, Prop, PropCategory, PropPack, Scene, SceneProp, ScenePropPatch } from '../entities/Scene';
// El rectángulo recto es el MISMO que el de los grupos de muros: un marco es un marco, y duplicar el tipo
// sería tener dos verdades para lo mismo. Sólo el tipo, que se borra al compilar.
import type { Rect } from './groupRules';
import {
  countIn as countInLibrary, filterItems, hasBuiltIn, inShelf as inLibraryShelf, matchesQuery as matchesLibraryQuery,
  sectionsOf as librarySectionsOf, sortItems, type LibraryGroup, type LibraryPlace, type Shelf, type ShelfContext, type ShelfSort,
} from './libraryRules';

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
export const matchesQuery = (p: Pick<Prop, 'name'>, query: string): boolean => matchesLibraryQuery(p, query);

/** Las de la app y las tuyas se enseñan juntas, pero se distinguen: es lo que prepara el catálogo de serie. */
export const isAppProp = (p: Pick<Prop, 'uploadedBy'>): boolean => p.uploadedBy === null;

/**
 * Dónde vive la foto de una pieza dentro del bucket de fondos: en `props/`, sin campaña delante, porque la
 * biblioteca es de la herramienta. Su política de storage va detrás del mismo permiso que la tabla.
 */
export const propPath = (id: string): string => `props/${id}.webp`;

/**
 * El nombre a partir del fichero: sin la extensión, y recortado a lo que admite la columna. Un fichero que sea
 * SÓLO extensión («.png») no deja nombre, y ahí entra `fallback` — que lo pone quien llama, porque esta misma
 * función la usan los objetos Y las texturas, y una textura llamada «Objeto» sería un disparate. El valor de
 * aquí es sólo la red de seguridad: en la app las dos caras pasan el suyo, ya traducido.
 */
export const nameFromFile = (fileName: string, fallback = 'Objeto'): string =>
  fileName.replace(/\.[^.]+$/, '').trim().slice(0, 80) || fallback;

// ── EL CATÁLOGO: estantes, secciones, orden ─────────────────────────────────
// Lo que no sabe si tiene delante una pieza o una textura vive en `libraryRules` (desde el 2026-09-13 el
// catálogo de texturas es EL MISMO componente, § 6.8). Aquí sólo se dice DÓNDE vive una pieza.

/**
 * Qué se está mirando en el rail del catálogo (`w7sTC0`): recientes, favoritos, un paquete (o «Sin
 * clasificar», que es el paquete nulo) o una categoría de serie. «Todo» es el buscador con la lupa.
 */
export type PropShelf = Shelf;
export type PropSort = ShelfSort;
export type PropShelfContext = ShelfContext;

/** Dónde vive una pieza: las de serie en su categoría; las tuyas en su paquete (o en ninguno). */
export const propPlace = (p: Pick<Prop, 'packId' | 'category' | 'uploadedBy'>): LibraryPlace =>
  isAppProp(p) ? { group: null, builtIn: p.category } : { group: p.packId, builtIn: null };

/** Un paquete como grupo del rail: se ordenan por su orden y luego por antigüedad. */
export const packGroup = (k: PropPack, i = 0): LibraryGroup => ({ id: k.id, name: k.name, order: k.sortOrder * 1e6 + i });
export const packGroups = (packs: readonly PropPack[]): LibraryGroup[] =>
  [...packs].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)).map((k, i) => packGroup(k, i));

/** ¿Esta pieza cae en este estante? */
export const inShelf = (p: Prop, shelf: PropShelf, ctx: PropShelfContext): boolean => inLibraryShelf(p, shelf, ctx, propPlace);

/** Lo que enseña la galería: el estante elegido y el buscador, en un solo paso. */
export const filterProps = (props: readonly Prop[], shelf: PropShelf, query: string, ctx: PropShelfContext): Prop[] =>
  filterItems(props, shelf, query, ctx, propPlace);

export const sortProps = (props: readonly Prop[], sort: PropSort, ctx: PropShelfContext, shelf: PropShelf): Prop[] =>
  sortItems(props, sort, ctx, shelf);

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
  return librarySectionsOf(props, packGroups(packs), PROP_CATEGORIES, shelf, query, sort, ctx, grouped, propPlace).map(sec => ({
    key: sec.key,
    title: sec.group?.name ?? null,
    pack: sec.group ? packs.find(k => k.id === sec.group!.id) ?? null : null,
    category: (sec.builtIn as PropCategory | null),
    props: sec.items,
  }));
}

/** Cuántas piezas hay en cada estante del rail, para las cuentas de al lado del nombre. */
export const countIn = (props: readonly Prop[], shelf: PropShelf, ctx: PropShelfContext): number => countInLibrary(props, shelf, ctx, propPlace);

/** ¿Hay alguna pieza de serie? Sin ninguna, el rail no pinta «DE SERIE · ROLVIUM» (decisión mía, § 6.1). */
export const hasAppProps = (props: readonly Prop[]): boolean => hasBuiltIn(props, propPlace);

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

/**
 * ESTIRAR DESDE LA ESQUINA CONTRARIA (§ 6.8, punto 2 — él: «*cuando redimensiono no tiene que ser desde el
 * centro*»): la esquina de enfrente de la que se tira se queda clavada y la pieza crece hacia la mano,
 * manteniendo la proporción. Devuelve también el centro nuevo, porque al no crecer desde el centro, éste se
 * mueve. Se acota por `minPx` para que una pieza no pueda encogerse hasta desaparecer.
 */
export function scaleFromCornerAnchored(
  p: Pick<SceneProp, 'x' | 'y' | 'rotation' | 'width' | 'height'>, corner: PropCorner, pointer: Point2, minPx = 8,
): { x: number; y: number; width: number; height: number } {
  const sx = corner === 'ne' || corner === 'se' ? 1 : -1;
  const sy = corner === 'sw' || corner === 'se' ? 1 : -1;
  const anchor = { x: -sx * p.width / 2, y: -sy * p.height / 2 };
  const l = toPropFrame(p, pointer);
  // Lo que ha crecido la diagonal, proyectado sobre la diagonal original: así un arrastre torcido no deforma.
  const d = { x: l.x - anchor.x, y: l.y - anchor.y };
  const diag = { x: sx * p.width, y: sy * p.height };
  const len2 = diag.x * diag.x + diag.y * diag.y || 1;
  const k = Math.max((d.x * diag.x + d.y * diag.y) / len2, minPx / (p.width || 1));
  const width = Math.round(p.width * k * 100) / 100;
  const height = Math.round(p.height * k * 100) / 100;
  const centro = fromPropFrame(p, { x: anchor.x + sx * width / 2, y: anchor.y + sy * height / 2 });
  return { x: Math.round(centro.x * 100) / 100, y: Math.round(centro.y * 100) / 100, width, height };
}

/** Las piezas cuyo CENTRO cae dentro del recuadro de selección (§ 6.8, punto 5), como las fichas. */
export function propsInRect<T extends Pick<SceneProp, 'id' | 'x' | 'y'>>(props: readonly T[], a: Point2, b: Point2): string[] {
  const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x), y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y);
  return props.filter(p => p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2).map(p => p.id);
}

/** El giro que apunta la mano desde el centro, con el tirador «arriba» como 0°. En pasos de 1°. */
export function rotationToward(p: Pick<SceneProp, 'x' | 'y'>, pointer: Point2): number {
  const deg = (Math.atan2(pointer.y - p.y, pointer.x - p.x) * 180) / Math.PI + 90;
  return normDeg(deg);
}

// ── VARIAS COGIDAS: EL MARCO DEL GRUPO, ESTIRARLO Y GIRARLO ─────────────────
/*
 * Orden suya del 2026-09-14: «*si selecciono varios items sigo sin los putos nodos, ponlos, si no no los puedo
 * ni escalar ni girar … son los mismos nodos de cuando seleccionas un solo objeto*». Así que un grupo se
 * maneja EXACTAMENTE como una pieza sola: cuatro esquinas que estiran manteniendo la proporción con la de
 * enfrente clavada (§ 6.4 y § 6.8, punto 2), y el tirador de arriba que gira. Nada nuevo que aprender.
 *
 * Esto es geometría pura. Quién la pinta vive en `ui/`, quién la guarda en `infra/`.
 */

const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Lo más pequeño que puede quedar un grupo al estrujarlo: sin tope se aplasta a nada y no se recupera. */
export const MIN_GROUP_SIDE_PX = 8;

/** La esquina de enfrente, la que se queda clavada al estirar desde la otra. */
const OPPOSITE_CORNER: Record<PropCorner, PropCorner> = { nw: 'se', ne: 'sw', se: 'nw', sw: 'ne' };

/** El marco RECTO que envuelve a varias piezas ya giradas: se mide por sus esquinas, no por su caja sin girar. */
export function propsBounds(props: readonly Pick<SceneProp, 'x' | 'y' | 'width' | 'height' | 'rotation'>[]): Rect | null {
  if (!props.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of props) {
    for (const k of PROP_CORNERS) {
      const c = propCorners(p)[k];
      minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
      minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
    }
  }
  return { x: round2(minX), y: round2(minY), w: round2(maxX - minX), h: round2(maxY - minY) };
}

/** Las cuatro esquinas del marco del grupo, con los mismos nombres que las de una pieza. */
export function groupCorners(r: Rect): Record<PropCorner, Point2> {
  return {
    nw: { x: r.x, y: r.y }, ne: { x: r.x + r.w, y: r.y },
    se: { x: r.x + r.w, y: r.y + r.h }, sw: { x: r.x, y: r.y + r.h },
  };
}

/** El tirador de giro del grupo: sobre el lado de arriba, a `gapPx` del borde. Igual que el de una pieza. */
export const groupRotateHandleAt = (r: Rect, gapPx: number): Point2 => ({ x: r.x + r.w / 2, y: r.y - gapPx });

/**
 * Estirar el marco del grupo desde una esquina: la de enfrente se queda clavada y el marco crece hacia la
 * mano MANTENIENDO LA PROPORCIÓN. El factor sale de proyectar la mano sobre la diagonal original, así que un
 * arrastre torcido no deforma — el mismo truco que con una pieza sola.
 */
export function groupBoxFromCorner(r: Rect, corner: PropCorner, pointer: Point2, minPx = MIN_GROUP_SIDE_PX): Rect {
  const sx = corner === 'ne' || corner === 'se' ? 1 : -1;
  const sy = corner === 'sw' || corner === 'se' ? 1 : -1;
  const anchor = groupCorners(r)[OPPOSITE_CORNER[corner]];
  const diag = { x: sx * r.w, y: sy * r.h };
  const len2 = diag.x * diag.x + diag.y * diag.y || 1;
  const d = { x: pointer.x - anchor.x, y: pointer.y - anchor.y };
  const k = Math.max((d.x * diag.x + d.y * diag.y) / len2, minPx / (Math.max(r.w, r.h) || 1));
  return {
    x: round2(Math.min(anchor.x, anchor.x + diag.x * k)),
    y: round2(Math.min(anchor.y, anchor.y + diag.y * k)),
    w: round2(r.w * k), h: round2(r.h * k),
  };
}

/**
 * Llevar el grupo de un marco a otro: cada pieza se corre y crece EN LA MISMA PROPORCIÓN, así que las
 * distancias entre ellas se mantienen y ninguna se deforma. Un solo factor para los dos lados, como manda
 * la regla de la proporción; el giro de cada una no se toca.
 */
export function scalePropsTo<T extends Pick<SceneProp, 'id' | 'x' | 'y' | 'width' | 'height'>>(
  props: readonly T[], from: Rect, to: Rect,
): { id: string; patch: { x: number; y: number; width: number; height: number } }[] {
  const k = to.w / (from.w || 1);
  return props.map(p => ({
    id: p.id,
    patch: {
      x: round2(to.x + (p.x - from.x) * k),
      y: round2(to.y + (p.y - from.y) * k),
      width: round2(p.width * k),
      height: round2(p.height * k),
    },
  }));
}

/**
 * Girar el grupo alrededor de un punto: cada pieza gira sobre sí misma Y da la vuelta al centro del marco —
 * las dos cosas, que es lo que hace que el conjunto gire como una sola plancha y no como un montón de piezas
 * girando cada una en su sitio.
 */
export function rotatePropsBy<T extends Pick<SceneProp, 'id' | 'x' | 'y' | 'rotation'>>(
  props: readonly T[], center: Point2, deg: number,
): { id: string; patch: { x: number; y: number; rotation: number } }[] {
  const a = (deg * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  return props.map(p => {
    const dx = p.x - center.x, dy = p.y - center.y;
    return {
      id: p.id,
      patch: {
        x: round2(center.x + dx * cos - dy * sin),
        y: round2(center.y + dx * sin + dy * cos),
        rotation: normDeg(p.rotation + deg),
      },
    };
  });
}
