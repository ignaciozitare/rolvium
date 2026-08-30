import type { SharedResourceDef, SharedResourceState } from '@rolvium/core';
import type { TableRole } from '@/modules/campaigns/domain/entities/Campaign';
import type { TableTab } from '../entities/Table';

/**
 * Tabs per role (player: Ficha·Escena·Crear; DM: El grupo·Escena·Bestiario·Crear).
 *
 * «Mejorar» YA NO es una pestaña: es un botón dentro de la ficha, al lado de «Editar» y «Abrir ficha
 * aparte» (dueño, decidido hace varias sesiones y pendiente desde entonces). Mejorar es algo que le
 * haces a la ficha que estás mirando, no un sitio aparte al que ir — y de pestaña te sacaba de la
 * ficha para volver a cargarla entera al lado.
 *
 * **«Ficha» TAMPOCO es pestaña del director** (dueño, 2026-08-21: «el director de juego no tiene
 * personaje propio, por eso te pedí que quites el botón»). Le enseñaba o un vacío o —peor— la ficha del
 * jugador que hubiera abierto antes desde «El grupo», sin decir de quién era. El director sigue llegando
 * a las fichas por su camino: «El grupo» → «Ver ficha», y de ahí vuelve con «← Volver al grupo».
 *
 * La vista de una ficha (`tab === 'sheet'`) SIGUE EXISTIENDO para el director; lo que desaparece es el
 * botón que llevaba a ella sin haber elegido a nadie.
 */
export function tabsFor(role: TableRole): TableTab[] {
  return role === 'dm' ? ['group', 'scene', 'bestiary', 'create'] : ['sheet', 'scene', 'create'];
}

/** Dónde aterriza cada uno al abrir la mesa. El director no tiene ficha propia, así que empieza en la escena. */
export const initialTabFor = (role: TableRole): TableTab => (role === 'dm' ? 'scene' : 'sheet');

export const handOf = (state: SharedResourceState | undefined, userId: string): number => state?.hands?.[userId] ?? 0;

/** Can this viewer take one more die from the pool right now? */
export function canTake(def: SharedResourceDef, state: SharedResourceState | undefined, role: TableRole, userId: string): boolean {
  if (!state || state.value <= 0) return false;
  if (def.whoCanTake === 'player' && role !== 'player') return false;
  if (def.whoCanTake === 'dm' && role !== 'dm') return false;
  return handOf(state, userId) < (state.perTakeMax ?? def.perTakeMax);
}
export const canReset = (def: SharedResourceDef, role: TableRole): boolean => def.whoCanReset === 'dm' && role === 'dm';

/** Presence halo: connected members are shown with a green glow. */
export const isConnected = (presence: { userId: string }[], userId: string): boolean => presence.some(p => p.userId === userId);

/**
 * A quién puede pedirle una tirada el director: los PERSONAJES DE LOS JUGADORES — PJ con dueño que no sea
 * él. Sus propios personajes y los PNJ quedan fuera (dueño, 2026-08-23: «me aparece a mí como DM que tire
 * dados, eso está mal»): pedirse una tirada a sí mismo no tiene sentido — para eso ya tiene el lanzador.
 */
export function askTargetsFrom(characters: readonly { id: string; name: string; kind: string; ownerId: string | null }[], dmId: string): { characterId: string; name: string }[] {
  return characters
    .filter(c => c.kind === 'pc' && c.ownerId && c.ownerId !== dmId)
    .map(c => ({ characterId: c.id, name: c.name }));
}
