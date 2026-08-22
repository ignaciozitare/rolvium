import { sightRadiusPx, slideCircle, type FogCell, type SceneVision, type VisionPolygon } from '@rolvium/core';
import type { IMapsRepository, SceneRecord, TokenRecord, WallRecord } from '../../domain/maps/IMapsRepository.js';
import { allCells, boundsSegments, cellsInDisc, cellsInPolygons, subtractCells, unionCells, visionPolygon, type Point, type Segment } from './vision.js';

export type VisionErrorCode = 'NOT_FOUND' | 'FORBIDDEN';
export type VisionOutcome = { ok: true; data: SceneVision } | { ok: false; code: VisionErrorCode };

interface Deps { maps: IMapsRepository }

/** Blocking geometry: the scene's own walls plus its four sides, so no ray escapes the map. */
export function sightSegments(walls: WallRecord[], scene: Pick<SceneRecord, 'width' | 'height'>): Segment[] {
  const blocking = walls
    .filter(w => w.blocksSight && !w.isOpen)
    .map(w => ({ a: { x: w.x1, y: w.y1 }, b: { x: w.x2, y: w.y2 } }));
  return [...blocking, ...boundsSegments(scene.width, scene.height)];
}

/** Centre of a token in scene px (`x`/`y` are the top-left cell). */
export const tokenOrigin = (t: Pick<TokenRecord, 'x' | 'y' | 'size'>, grid: number): Point =>
  ({ x: (t.x + t.size / 2) * grid, y: (t.y + t.size / 2) * grid });

/** The tokens whose eyes a viewer looks through: the ones they control. The DM does not need any — they see all. */
export const tokensOf = (tokens: TokenRecord[], userId: string): TokenRecord[] => tokens.filter(t => t.controlledBy === userId);

/**
 * Recomputes what `userId` can see in the scene and remembers it.
 *
 * A player gets one polygon per token they control plus their own explored cells, which grow with what they just saw.
 * The DM gets no polygon (they see the whole map) and the union of what every player has explored.
 * `manual` fog computes nothing — only the DM's brush reveals. `off` reveals the whole scene.
 */
export async function computeSceneVision(
  deps: Deps,
  /**
   * `at` es una posición PROVISIONAL de un token: la que tiene el dedo encima mientras se arrastra, antes de
   * soltarlo. Sirve para que la niebla siga al token mientras se mueve en vez de dar un salto al soltar
   * (dueño, 2026-08-22: «en el prototipo se va actualizando de acuerdo a cuando mueves el token»). El
   * prototipo lo recalculaba en el navegador; aquí la geometría es del servidor a propósito —los muros que un
   * jugador no debe conocer no salen de este proceso— así que la posición tiene que venir a preguntar.
   *
   * NO se guarda nada con ella: ni la posición del token ni lo explorado. Es una consulta, no un movimiento;
   * lo que se guarda se guarda al soltar, por el camino normal. Y sólo se aplica a un token que el que
   * pregunta CONTROLA — se cruza contra su propia lista, así que pedir la visión desde el token de otro no
   * enseña nada que no fuera suyo.
   */
  input: { sceneId: string; userId: string; at?: { tokenId: string; x: number; y: number } },
): Promise<VisionOutcome> {
  const scene = await deps.maps.getScene(input.sceneId);
  if (!scene) return { ok: false, code: 'NOT_FOUND' };
  const role = await deps.maps.roleOf(scene.campaignId, input.userId);
  if (!role) return { ok: false, code: 'FORBIDDEN' };

  const radiusPx = sightRadiusPx(scene.lighting, scene.nightRadiusM, scene.gridSize);

  if (role === 'dm') {
    const rows = await deps.maps.listExplored(scene.id);
    return { ok: true, data: { vision: [], explored: unionCells(...rows), radiusPx } };
  }

  const stored = await deps.maps.getExplored(scene.id, input.userId);
  const at = input.at;
  /**
   * PAREDES SÓLIDAS (rebanada 4). Aquí, y no en el navegador, porque a un jugador **no le llegan los muros
   * secretos** (RLS): si el choque se calculase en su pantalla, un muro oculto no le frenaría. El navegador
   * hace un freno provisional con lo que conoce y ésta es la palabra final.
   *
   * Se corrige sólo lo que se PREGUNTA (`at`) y sólo si la escena lo tiene encendido. Se devuelve en casillas,
   * que es la unidad en la que viven los tokens; la geometría se hace en px, que es donde viven los muros.
   *
   * Y se calcula ANTES de mirar el modo de niebla: nada en la spec ata la física a la niebla, y el modo de
   * niebla es un botón que el director tiene al lado del de paredes sólidas. La primera versión corregía sólo
   * en modo «vision» —los `return` de «off» y «manual» salían antes de cargar los muros— y un ajuste de
   * niebla apagaba las paredes en silencio. La geometría se carga sólo cuando hace falta: siempre en
   * «vision» (las líneas de vista la necesitan), y en los otros modos sólo si hay un `at` que corregir con
   * las paredes sólidas encendidas — apagadas, `corrected` sale `null` igual y sobran las dos lecturas.
   */
  const [walls, tokens] = (at && scene.solidWalls) || scene.fogMode === 'vision'
    ? await Promise.all([deps.maps.listWalls(scene.id), deps.maps.listTokens(scene.id)])
    : [[], []];
  const dragged = at ? tokensOf(tokens, input.userId).find(t => t.id === at.tokenId) ?? null : null;
  let corrected: SceneVision['corrected'] = null;
  if (at && dragged && scene.solidWalls) {
    const radius = (dragged.size * scene.gridSize) / 2;
    const blockers = walls.filter(w => w.blocksMove && !w.isOpen).map(w => [w.x1, w.y1, w.x2, w.y2] as const);
    const end = slideCircle(tokenOrigin(dragged, scene.gridSize), tokenOrigin({ ...dragged, x: at.x, y: at.y }, scene.gridSize), radius, blockers);
    const cx = end.x / scene.gridSize - dragged.size / 2, cy = end.y / scene.gridSize - dragged.size / 2;
    /**
     * Se contesta `corrected` SÓLO cuando de verdad se ha recortado algo. Si cabía, se calla — y así el
     * navegador sabe que puede aplicar sin preguntar todo lo que le llegue, en vez de tener que adivinar si
     * la respuesta es un recorte o el eco de lo que él mismo pidió.
     *
     * Importa más de lo que parece: a un jugador **no le llegan los muros secretos**, así que su pantalla no
     * puede frenar ni saber que había algo. Si esto contestara siempre, no habría forma de distinguir «te
     * paro» de «pasa», y una respuesta con retraso arrastraría al token hacia atrás sin motivo.
     */
    const tol = 1e-6;
    if (Math.abs(cx - at.x) > tol || Math.abs(cy - at.y) > tol) corrected = { tokenId: at.tokenId, x: cx, y: cy };
  }

  if (scene.fogMode === 'off') {
    return { ok: true, data: { vision: [], explored: allCells(scene.gridSize, scene.width, scene.height), radiusPx, corrected } };
  }
  if (scene.fogMode === 'manual') return { ok: true, data: { vision: [], explored: stored, radiusPx, corrected } };

  const segments = sightSegments(walls, scene);
  const applied = corrected ?? at;
  const mine = tokensOf(tokens, input.userId).map(t => (applied && t.id === applied.tokenId ? { ...t, x: applied.x, y: applied.y } : t));
  const vision: VisionPolygon[] = mine
    .map(t => visionPolygon(tokenOrigin(t, scene.gridSize), segments, radiusPx ?? Infinity))
    .filter(p => p.length >= 3);

  const seen = cellsInPolygons(vision, scene.gridSize, scene.width, scene.height);
  const explored = unionCells(stored, seen);
  // Con posición provisional NO se escribe: es una consulta de «qué vería si lo suelto aquí». Lo explorado se
  // devuelve igual, para que la pantalla ya lo pinte, y se guarda al soltar por el camino de siempre.
  if (!at && explored.length !== stored.length) await deps.maps.saveExplored(scene.id, scene.campaignId, input.userId, explored);
  return { ok: true, data: { vision, explored, radiusPx, corrected } };
}

export interface PaintInput {
  sceneId: string;
  userId: string;
  op: 'reveal' | 'hide';
  /** Brush centre in scene px + radius in scene px. Omitted when `all` is set. */
  at?: { x: number; y: number; radius: number };
  /** «Revelar todo» / «Ocultar todo» for the whole scene. */
  all?: boolean;
}

/**
 * The DM's brush. Writes on the explored cells of EVERY player of the campaign at once (spec: «pinta sobre lo
 * explorado de todos los jugadores»), and answers with the DM's union so their veil updates in the same round trip.
 */
export async function paintSceneFog(deps: Deps, input: PaintInput): Promise<VisionOutcome> {
  const scene = await deps.maps.getScene(input.sceneId);
  if (!scene) return { ok: false, code: 'NOT_FOUND' };
  const role = await deps.maps.roleOf(scene.campaignId, input.userId);
  if (role !== 'dm') return { ok: false, code: 'FORBIDDEN' };

  const painted: FogCell[] = input.all
    ? allCells(scene.gridSize, scene.width, scene.height)
    : input.at
      ? cellsInDisc(input.at, input.at.radius, scene.gridSize, scene.width, scene.height)
      : [];

  const players = await deps.maps.listPlayerIds(scene.campaignId);
  const next = await Promise.all(players.map(async playerId => {
    const current = await deps.maps.getExplored(scene.id, playerId);
    const cells = input.op === 'reveal' ? unionCells(current, painted) : subtractCells(current, painted);
    if (cells.length !== current.length) await deps.maps.saveExplored(scene.id, scene.campaignId, playerId, cells);
    return cells;
  }));

  return { ok: true, data: { vision: [], explored: unionCells(...next), radiusPx: sightRadiusPx(scene.lighting, scene.nightRadiusM, scene.gridSize) } };
}
