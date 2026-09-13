/**
 * Reglas puras de UNA BIBLIOTECA DE LA HERRAMIENTA con catálogo a pantalla completa (`rolvium.pen` · `w7sTC0`):
 * estantes, secciones, orden, y la selección múltiple. Sin React, sin Supabase.
 *
 * Nacieron en `propRules` para las piezas (rebanada 6). El 2026-09-13 él pidió que el catálogo de texturas fuera
 * «*el mismo de los objetos, el mismo componente*» (§ 6.8, punto 1), así que lo que no sabe si tiene delante una
 * pieza o una textura vive aquí, y cada biblioteca sólo dice DÓNDE vive cada cosa (`placeOf`): en qué grupo
 * (paquete propio · categoría de textura) o en qué estante de serie.
 */

/** Lo que cualquier cosa de una biblioteca tiene: nombre, quién la subió (`null` = la trae la app) y cuándo. */
export interface LibraryItem { id: string; name: string; uploadedBy: string | null; createdAt: string }
/** Un grupo del rail: un paquete de piezas o una categoría de texturas. `order` decide en qué orden se pintan. */
export interface LibraryGroup { id: string; name: string; order: number }
/**
 * Dónde vive una cosa: en un grupo (`group`, `null` = «Sin clasificar») o, si es de serie, en una sección
 * `builtIn` (las seis categorías de piezas de la app). Una cosa no vive en los dos sitios a la vez.
 */
export interface LibraryPlace { group: string | null; builtIn: string | null }
export type PlaceOf<T> = (item: T) => LibraryPlace;

/**
 * Qué se está mirando en el rail: recientes, favoritos, un grupo (o «Sin clasificar», que es el grupo nulo) o
 * una sección de serie. «Todo» es el buscador con la lupa. Los nombres `pack` y `category` vienen de las piezas.
 */
export type Shelf =
  | { kind: 'all' }
  | { kind: 'recent' }
  | { kind: 'favorites' }
  | { kind: 'pack'; id: string | null }
  | { kind: 'category'; category: string };

export type ShelfSort = 'name' | 'recent';

export interface ShelfContext {
  favorites: readonly string[];
  /** Ids de lo último usado, el más reciente primero. */
  recents: readonly string[];
}

/** Coincide por nombre, sin distinguir mayúsculas ni acentos: se busca «arbol» y sale «Árbol». */
const fold = (v: string): string => v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
export const matchesQuery = (p: Pick<LibraryItem, 'name'>, query: string): boolean =>
  fold(query) === '' || fold(p.name).includes(fold(query));

/** ¿Cae en este estante? */
export function inShelf<T extends LibraryItem>(item: T, shelf: Shelf, ctx: ShelfContext, placeOf: PlaceOf<T>): boolean {
  switch (shelf.kind) {
    case 'all': return true;
    case 'recent': return ctx.recents.includes(item.id);
    case 'favorites': return ctx.favorites.includes(item.id);
    case 'pack': { const at = placeOf(item); return at.builtIn === null && at.group === shelf.id; }
    case 'category': return placeOf(item).builtIn === shelf.category;
  }
}

/** Lo que enseña la rejilla: el estante elegido y el buscador, en un solo paso. */
export const filterItems = <T extends LibraryItem>(items: readonly T[], shelf: Shelf, query: string, ctx: ShelfContext, placeOf: PlaceOf<T>): T[] =>
  items.filter(p => inShelf(p, shelf, ctx, placeOf) && matchesQuery(p, query));

export function sortItems<T extends LibraryItem>(items: readonly T[], sort: ShelfSort, ctx: ShelfContext, shelf: Shelf): T[] {
  const list = [...items];
  // Recientes van en el orden en que se usaron, que es lo que significa «recientes».
  if (shelf.kind === 'recent') return list.sort((a, b) => ctx.recents.indexOf(a.id) - ctx.recents.indexOf(b.id));
  if (sort === 'name') return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface LibrarySection<T> { key: string; group: LibraryGroup | null; builtIn: string | null; items: T[] }

/**
 * La rejilla del catálogo: UNA sección por grupo (y otra para lo sin clasificar, y una por sección de serie),
 * cada una con su cabecera. Con «Todo» y el buscador se ven todas las secciones que tengan algo; en un estante
 * concreto, sólo la suya. Con AGRUPAR apagado sale todo junto sin cabecera.
 */
export function sectionsOf<T extends LibraryItem>(
  items: readonly T[], groups: readonly LibraryGroup[], builtIns: readonly string[], shelf: Shelf, query: string,
  sort: ShelfSort, ctx: ShelfContext, grouped: boolean, placeOf: PlaceOf<T>,
): LibrarySection<T>[] {
  const shown = sortItems(filterItems(items, shelf, query, ctx, placeOf), sort, ctx, shelf);
  if (!grouped || shelf.kind === 'recent' || shelf.kind === 'favorites') {
    return shown.length ? [{ key: 'all', group: null, builtIn: null, items: shown }] : [];
  }
  const out: LibrarySection<T>[] = [];
  const ordered = [...groups].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  for (const group of ordered) {
    const mine = shown.filter(p => { const at = placeOf(p); return at.builtIn === null && at.group === group.id; });
    if (mine.length) out.push({ key: `pack:${group.id}`, group, builtIn: null, items: mine });
  }
  const loose = shown.filter(p => { const at = placeOf(p); return at.builtIn === null && (at.group === null || !groups.some(k => k.id === at.group)); });
  if (loose.length) out.push({ key: 'pack:none', group: null, builtIn: null, items: loose });
  for (const builtIn of builtIns) {
    const mine = shown.filter(p => placeOf(p).builtIn === builtIn);
    if (mine.length) out.push({ key: `cat:${builtIn}`, group: null, builtIn, items: mine });
  }
  return out;
}

/** Cuántas cosas hay en cada estante del rail, para las cuentas de al lado del nombre. */
export const countIn = <T extends LibraryItem>(items: readonly T[], shelf: Shelf, ctx: ShelfContext, placeOf: PlaceOf<T>): number =>
  items.filter(p => inShelf(p, shelf, ctx, placeOf)).length;

/** ¿Hay algo de serie? Sin nada, el rail no pinta la sección «DE SERIE». */
export const hasBuiltIn = <T extends LibraryItem>(items: readonly T[], placeOf: PlaceOf<T>): boolean =>
  items.some(p => placeOf(p).builtIn !== null);

// ── LA SELECCIÓN MÚLTIPLE (§ 6.8, punto 4) ───────────────────────────────────

/** Marcar o desmarcar una: el círculo de la baldosa, o Ctrl/Cmd+clic. */
export const toggleId = (selected: readonly string[], id: string): string[] =>
  selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];

/**
 * Mayús+clic coge UN TRAMO: desde la última que se marcó hasta ésta, en el orden en que se ven. Sin ancla, o con
 * el ancla fuera de lo que se ve, es como marcar una sola.
 */
export function rangeIds(visible: readonly string[], selected: readonly string[], anchor: string | null, id: string): string[] {
  const a = anchor === null ? -1 : visible.indexOf(anchor);
  const b = visible.indexOf(id);
  if (a < 0 || b < 0) return toggleId(selected, id);
  const [from, to] = a <= b ? [a, b] : [b, a];
  const tramo = visible.slice(from, to + 1);
  return [...selected, ...tramo.filter(x => !selected.includes(x))];
}

/** El tipo de dato del arrastre interno del catálogo: distingue «muevo baldosas» de «suelto imágenes». */
export const LIBRARY_DRAG_MIME = 'application/x-rolvium-library-items';
