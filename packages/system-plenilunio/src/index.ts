// ─── @rolvium/system-plenilunio ───────────────────────────────────────────────
// Game-system package for Malefic Time: Plenilunio (NoSoloRol). Implements the
// GameSystem port from @rolvium/core. Spec: specs/modules/system-plenilunio/SPEC.md
// Status: skeleton — engine/schema/catalogs land with the `characters` hexagon.
import type { GameSystem } from '@rolvium/core';
import { theme } from './theme';
import { messages } from './locales';

export const PLENILUNIO_ID = 'plenilunio';
export const PLENILUNIO_VERSION = '0.1.0';

export const plenilunio: GameSystem = {
  id: PLENILUNIO_ID,
  version: PLENILUNIO_VERSION,
  name: 'system.name',
  publisher: 'NoSoloRol',
  locales: messages,
  sheetSchema: { version: '0', sections: [] },
  catalogs: {},
  references: {},
  theme,
  engine: {
    derived: () => ({}),
    poolFor: (_sheet, action) => ({ systemId: PLENILUNIO_ID, kind: 'system', title: action.stat, groups: [{ count: 1, sides: 6 }], visibility: 'table' }),
    resolve: (_req, dice) => ({ summary: '', total: dice.flat().reduce((a, b) => a + b, 0) }),
    applyDamage: () => ({}),
    progression: { cost: () => null, apply: () => ({}) },
    sharedResources: [{
      id: 'destiny', label: 'system.destinyPool', ref: 'destinyPool', max: 10, initial: 10, perTakeMax: 5,
      whoCanTake: 'player', whoCanReset: 'dm',
    }],
  },
  generator: [],
  newSheet: () => ({}),
};

export default plenilunio;
