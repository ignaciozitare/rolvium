import type { FogCell } from '@rolvium/core';

/** The scene as the server needs it: light, grid and size. Mirrors `maps_scenes`. */
export interface SceneRecord {
  id: string;
  campaignId: string;
  width: number;
  height: number;
  gridSize: number;
  fogMode: 'vision' | 'manual' | 'off';
  lighting: 'day' | 'night';
  /** Paredes sólidas: si un token puede atravesar un muro en esta escena (rebanada 4). */
  solidWalls: boolean;
  nightRadiusM: number;
  /**
   * La barrita del tamaño de las fichas de la escena (0,5 a 1,25; 1 = como siempre).
   *
   * ⚠️ El servidor la NECESITA, y no es cosmética: es él quien frena de verdad al arrastrar
   * (`sceneVision`, `slideCircle`). Sin esto frenaría con el cuerpo sin encoger y la ficha seguiría sin
   * pasar por el pasillo estrecho por mucho que en pantalla se vea pequeña — justo lo que la barrita existe
   * para resolver.
   */
  tokenScale: number;
}

/**
 * A wall segment as stored. The three types of the spec collapse into one condition:
 * it blocks sight ⇔ `blocksSight && !isOpen`. `blocksMove` is stored but unused until slice 3.
 */
export interface WallRecord { id: string; x1: number; y1: number; x2: number; y2: number; blocksSight: boolean; blocksMove: boolean; isOpen: boolean }

/**
 * Only what vision needs from a token: where it stands and who controls it.
 * Deliberately NOT `visible`: sight follows control, not visibility. A token the DM hid is hidden from the
 * others, not from its own player, and a hidden bestiary token has no `controlledBy` so it never sees anything.
 */
export interface TokenRecord { id: string; x: number; y: number; size: number; controlledBy: string | null }

/**
 * Una luz de la escena, con lo justo para saber qué alumbra: forma, alcance y si se corta contra los muros.
 * Ni color ni parpadeo — eso es pintura y no cambia la geometría.
 */
export interface LightRecord {
  id: string;
  /** `null` = la capa natural de su tipo, igual que en la base de datos. */
  layerId: string | null;
  x: number; y: number; rotation: number;
  shape: 'cone' | 'radius' | 'square';
  coneAngle: number;
  /** Alcance en METROS, como se guarda; a px lo pasa `sightRadiusPx` con la rejilla de la escena. */
  rangeM: number;
  castsShadow: boolean;
  /** § 7.2 «la luz que gira»: ms de una vuelta entera, `0` = quieta. Sólo cuenta con `shape: 'cone'`. */
  spinMs: number;
}

/**
 * Una capa, con lo justo para saber si lo que vive en ella se pinta. El ojo de Photoshop (`visible`) apaga
 * la capa para TODOS; `dm_notes` sólo se le pinta al director.
 */
export interface LayerRecord { id: string; kind: 'terrain' | 'objects' | 'creatures' | 'dm_notes'; visible: boolean }

/**
 * Una pieza PLANTADA, con lo justo para saber si estorba y dónde. Ni foto ni nombre: eso es pintura y vive
 * en el navegador. La forma que estorba es simple —rectángulo o círculo— a propósito (§ 6.5).
 */
export interface ScenePropRecord {
  id: string;
  layerId: string | null;
  /** Centro de la pieza, en px de escena. */
  x: number; y: number;
  rotation: number;
  blocksSight: boolean;
  blocksMove: boolean;
  blockShape: 'rect' | 'circle';
  /** La forma que estorba, en px y relativa al centro. En `circle`, `blockW` es el DIÁMETRO. */
  blockW: number; blockH: number; blockDx: number; blockDy: number;
}

/**
 * UNA SALA, tal cual se guarda (rebanada 8): UNA FORMA, no la unión. El servidor la funde con las demás al
 * calcular (`roomOutline`, en `@rolvium/core`) — el mismo motor que usa el navegador para pintarla, o la sala
 * taparía de una forma y se vería de otra.
 *
 * `kind` dice si EXCAVA o si RELLENA, y llegan **en orden de llegada**: la última que él dibujó manda sobre
 * lo que hubiera debajo, igual que al pintar.
 *
 * 🔴 Su contorno NO es una fila de `maps_walls` y no hay que buscarlo ahí. Son dos entidades distintas que se
 * comportan igual: el `WallRecord` es una marca invisible sobre una foto traída de fuera; esto ES el mapa.
 */
export interface RoomRecord { id: string; kind: 'room' | 'fill'; points: [number, number][] }

/** Un vano anotado SOBRE el contorno de la unión. No parte ninguna fila, porque no hay fila. */
export interface RoomOpeningRecord { x1: number; y1: number; x2: number; y2: number; kind: 'door' | 'window'; isOpen: boolean }

export type TableRole = 'dm' | 'player';

/** Read side of `maps_*` with the service role: the server sees every wall, which is the whole point. */
export interface IMapsRepository {
  getScene(sceneId: string): Promise<SceneRecord | null>;
  /** Every wall of the scene, hidden ones included. */
  listWalls(sceneId: string): Promise<WallRecord[]>;
  /**
   * LAS SALAS de la escena, y sus vanos (rebanada 8). Van aparte de `listWalls` porque son OTRA ENTIDAD, no
   * una variante: aquí no hay `visible_players` que filtrar ni `blocksSight` que mirar — el contorno de una
   * sala corta la vista siempre, porque es roca.
   */
  listRooms(sceneId: string): Promise<RoomRecord[]>;
  listRoomOpenings(sceneId: string): Promise<RoomOpeningRecord[]>;
  listTokens(sceneId: string): Promise<TokenRecord[]>;
  /** Toda luz de la escena, también las de una capa apagada o de notas del director: filtrar es del caso de uso. */
  listLights(sceneId: string): Promise<LightRecord[]>;
  /** Las capas de la escena, para saber qué se pinta y qué no. */
  listLayers(sceneId: string): Promise<LayerRecord[]>;
  /**
   * Las piezas plantadas que ESTORBAN LA VISTA. Sólo ésas: una escena puede tener cien macetas y ninguna
   * cambia lo que se ve, así que traerlas todas sería barrerla entera en cada movimiento.
   */
  listSightBlockingProps(sceneId: string): Promise<ScenePropRecord[]>;
  /** The caller's table role, or `null` when they are not a member of the campaign. */
  roleOf(campaignId: string, userId: string): Promise<TableRole | null>;
  /** Members with the `player` table role — who the DM's brush paints on. */
  listPlayerIds(campaignId: string): Promise<string[]>;
  getExplored(sceneId: string, userId: string): Promise<FogCell[]>;
  /** Every player's explored cells in the scene, for the DM's union. */
  listExplored(sceneId: string): Promise<FogCell[][]>;
  saveExplored(sceneId: string, campaignId: string, userId: string, cells: FogCell[]): Promise<void>;
}
