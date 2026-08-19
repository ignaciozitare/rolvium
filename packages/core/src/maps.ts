// ─── Maps (H7) — shared contract between the API (which computes vision) and the
// web client (which only draws what it is given). No geometry lives here: the
// algorithm is server-only on purpose, because the client never receives the
// walls it is not allowed to see (specs/modules/maps/SPEC.md § «Rules & limits»).

/** A point of a vision polygon, in scene px. */
export type VisionPoint = [number, number];
/** Closed polygon of what a viewer can see right now, in scene px. */
export type VisionPolygon = VisionPoint[];
/** An explored grid cell `[x, y]` (cell coordinates, not px). */
export type FogCell = [number, number];

/** What `POST /scenes/:id/vision` and `POST /scenes/:id/fog` answer, for whoever asked. */
export interface SceneVision {
  /** Current line of sight, one polygon per token the caller controls. Empty for the DM and for `manual`/`off` fog. */
  vision: VisionPolygon[];
  /** Remembered cells: the caller's own for a player, the union of everyone's for the DM. */
  explored: FogCell[];
  /** Sight radius applied, in scene px; `null` when unlimited (day). */
  radiusPx: number | null;
}

/**
 * Metres per grid cell, used to turn a scene's `night_radius_m` into px and to label the measure tool.
 *
 * ⚠ DEUDA CONOCIDA: 1 casilla ≈ 1,5 m es una regla de **Plenilunio**, no de la plataforma. Vivía suelta en
 * `mapRules` de `apps/web`; se sube aquí porque con la luz nocturna el servidor necesita el mismo número y
 * duplicarlo sería peor. La rebanada 3 la mueve al puerto `GameSystem` y este export desaparece.
 */
export const METRES_PER_CELL = 1.5;

/** Sight radius in scene px for a scene's lighting, or `null` when the geometry is the only limit. */
export function sightRadiusPx(
  lighting: 'day' | 'night',
  nightRadiusM: number,
  gridSize: number,
  metresPerCell = METRES_PER_CELL,
): number | null {
  if (lighting !== 'night') return null;
  return (nightRadiusM / metresPerCell) * gridSize;
}
