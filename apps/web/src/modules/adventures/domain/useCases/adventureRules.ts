import type { Adventure, AdventureStatus } from '../entities/Adventure';

/**
 * Reglas del carril de AVENTURAS (H12): el orden, cuál está EN CURSO y a dónde van las escenas de una aventura
 * que se borra. Puras y sin pantalla, para que la pestaña sólo tenga que aplicarlas.
 * Diseño: `rolvium.pen` § 4 · «Aventuras/Carril · MENÚ DE UNA AVENTURA y el ESTADO» y sus dos hermanas.
 */

/** Lo que cambia de sitio al subir o bajar: sólo los que de verdad se mueven. */
export interface OrderMove { id: string; sortOrder: number }

interface Ordered { id: string; sortOrder: number }

/**
 * SUBIR o BAJAR uno de una lista que ya está en el orden en que se ve (aventuras del carril, o escenas de una
 * aventura).
 *
 * Los sitios no se recalculan desde cero: se reparten los `sortOrder` que ya había, en orden. Y si había
 * EMPATES —que los hay de verdad: toda aventura nueva nacía con `sort_order = 0`, y la mesa numera sus escenas
 * con `scenes.length`— se deshacen hacia arriba, porque con dos números iguales cambiarlos entre sí no mueve
 * nada. Es lo mismo que hacen las capas (`maps/domain/useCases/layerRules.ts`).
 */
export function moveInOrder(list: readonly Ordered[], id: string, dir: 'up' | 'down'): OrderMove[] {
  const i = list.findIndex(x => x.id === id);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return [];
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  const slots = list.map(x => x.sortOrder).sort((a, b) => a - b);
  for (let k = 1; k < slots.length; k++) if (slots[k]! <= slots[k - 1]!) slots[k] = slots[k - 1]! + 1;
  return next
    .map((x, k) => ({ id: x.id, sortOrder: slots[k]! }))
    .filter(m => list.find(x => x.id === m.id)!.sortOrder !== m.sortOrder);
}

/** El sitio de lo que se crea o se saca del archivo: detrás de todo, para que no empate con nadie. */
export const nextSortOrder = (list: readonly Ordered[]): number =>
  list.reduce((max, x) => Math.max(max, x.sortOrder), -1) + 1;

/**
 * MARCAR UNA EN CURSO. Sólo hay UNA: es la que se abre al entrar en la pestaña y adonde van las escenas que se
 * crean desde la mesa. Al marcar otra, la que estaba pasa a TERMINADA (decidido el 2026-09-21 y avisado al
 * aprobar el diseño: lo normal es que se empiece la siguiente cuando se acaba la anterior).
 */
export function runningPatches(all: readonly Adventure[], id: string): { id: string; status: AdventureStatus }[] {
  const patches: { id: string; status: AdventureStatus }[] = [];
  const target = all.find(a => a.id === id);
  if (target && target.status !== 'running') patches.push({ id, status: 'running' });
  for (const a of all) if (a.id !== id && a.status === 'running') patches.push({ id: a.id, status: 'done' });
  return patches;
}

/**
 * La última aventura que le queda a la campaña no se borra: «toda campaña tiene aventuras» (spec § Rules), y
 * además sus escenas no tendrían a dónde ir. Archivarla sí se puede.
 */
export const canRemoveAdventure = (all: readonly Adventure[]): boolean => all.length > 1;

/**
 * A DÓNDE PUEDEN IR las escenas de la que se borra: todas las demás, primero las del carril y al final las
 * archivadas. Sale marcada la EN CURSO, que es adonde irían solas si se crearan desde la mesa.
 */
export function sceneDestinations(all: readonly Adventure[], removingId: string): { options: Adventure[]; preferred: string | null } {
  const others = all.filter(a => a.id !== removingId);
  const options = [...others.filter(a => a.status !== 'archived'), ...others.filter(a => a.status === 'archived')];
  const preferred = options.find(a => a.status === 'running') ?? options[0] ?? null;
  return { options, preferred: preferred?.id ?? null };
}
