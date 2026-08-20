import type { SharedResourceDef, SharedResourceState } from '@rolvium/core';
import type { TableRole } from '@/modules/campaigns/domain/entities/Campaign';
import type { TableTab } from '../entities/Table';

/**
 * Tabs per role (player: Ficha·Escena·Crear; DM adds El grupo·Bestiario).
 *
 * «Mejorar» YA NO es una pestaña: es un botón dentro de la ficha, al lado de «Editar» y «Abrir ficha
 * aparte» (dueño, decidido hace varias sesiones y pendiente desde entonces). Mejorar es algo que le
 * haces a la ficha que estás mirando, no un sitio aparte al que ir — y de pestaña te sacaba de la
 * ficha para volver a cargarla entera al lado.
 */
export function tabsFor(role: TableRole): TableTab[] {
  return role === 'dm' ? ['sheet', 'group', 'scene', 'bestiary', 'create'] : ['sheet', 'scene', 'create'];
}

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
