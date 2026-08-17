import type { GameSystem } from '@rolvium/core';
import { plenilunio } from '@rolvium/system-plenilunio';

/** Systems the API can validate/resolve for. Mirror of apps/web/src/systems/registry.ts (installed ones only). */
export const SYSTEMS: Record<string, GameSystem> = { [plenilunio.id]: plenilunio };
export const systemById = (id: string): GameSystem | null => SYSTEMS[id] ?? null;
