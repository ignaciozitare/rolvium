import type { SharedResourceDef, SharedResourceState } from '@rolvium/core';
import type { TableRole } from '@/modules/campaigns/domain/entities/Campaign';
import type { TableTab } from '../entities/Table';

/** Tabs per role — matches rolvium.pen (player: Ficha·Escena·Mejorar·Crear; DM adds El grupo·Bestiario). */
export function tabsFor(role: TableRole): TableTab[] {
  return role === 'dm' ? ['sheet', 'group', 'scene', 'bestiary', 'improve', 'create'] : ['sheet', 'scene', 'improve', 'create'];
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
