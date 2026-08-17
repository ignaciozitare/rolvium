// ─── @rolvium/system-plenilunio ───────────────────────────────────────────────
// Game-system package for Malefic Time: Plenilunio (NoSoloRol). Implements the
// GameSystem port from @rolvium/core. Spec: specs/modules/system-plenilunio/SPEC.md
// Rules ported from the validated prototype; every rule points to its manual page.
import type { GameSystem } from '@rolvium/core';
import { theme } from './theme';
import { messages } from './locales';
import { sheetSchema, newSheet } from './schema';
import { catalogs } from './catalogs';
import { references } from './references';
import { engine, SYSTEM_ID } from './engine';
import { generator } from './generator';

export const PLENILUNIO_ID = SYSTEM_ID;
export const PLENILUNIO_VERSION = '0.2.0';

export const plenilunio: GameSystem = {
  id: PLENILUNIO_ID,
  version: PLENILUNIO_VERSION,
  name: 'system.name',
  publisher: 'NoSoloRol',
  locales: messages,
  sheetSchema,
  catalogs,
  references,
  theme,
  engine,
  generator,
  newSheet,
};

export default plenilunio;

export * from './schema';
export * from './catalogs';
export * from './references';
export * from './engine';
export * from './generator';
export { messages, lookup } from './locales';
export { theme } from './theme';
