// ─── @rolvium/core ────────────────────────────────────────────────────────────
// Ports and shared contracts between the platform hexagons and the game-system
// packages. No framework imports, no runtime beyond tiny helpers.
// Spec: specs/core/game-system/SPEC.md · specs/core/realtime/SPEC.md
export * from './gameSystem';
export * from './rolls';
export * from './events';
export * from './maps';
export * from './systemRegistry';
export * from './sheetValidation';
