import type { TableEvent } from '@rolvium/core';
import type { CreateSceneInput, Drawing, ImageAsset, Layer, LayerPatch, Light, LightPatch, NewDrawing, NewLayer, NewLight, NewProp, NewSceneProp, NewToken, NewWall, Prop, PropPatch, RowChange, Scene, ScenePatch, SceneProp, ScenePropPatch, Token, TokenPatch, Wall, WallPatch } from '../entities/Scene';

export type Unsubscribe = () => void;

/** Ephemeral events that travel by broadcast on the scene channel (never persisted). */
export type MapsLiveEvent = Extract<TableEvent, { type: 'token.moved' | 'pin.focused' | 'fog.updated' }>;

export interface MapsLiveHandlers {
  onScene?: (change: RowChange<Scene>) => void;
  onToken?: (change: RowChange<Token>) => void;
  onWall?: (change: RowChange<Wall>) => void;
  onDrawing?: (change: RowChange<Drawing>) => void;
  /** Capas de contenido y luces de ambiente (rebanada 7). Un jugador nunca recibe las de «Notas del director». */
  onLayer?: (change: RowChange<Layer>) => void;
  onLight?: (change: RowChange<Light>) => void;
  /** La BIBLIOTECA de piezas: cambia por campaña, no por escena, pero llega por el mismo canal. */
  onProp?: (change: RowChange<Prop>) => void;
  /** Lo PLANTADO en esta escena. */
  onSceneProp?: (change: RowChange<SceneProp>) => void;
  /**
   * Token drag in progress · focus pin from another device · `fog.updated` = «what you can see may have changed,
   * ask the server again». That last one MUST travel by broadcast: `postgres_changes` applies each subscriber's
   * RLS, so a player never receives the row of a door they are not allowed to see.
   */
  onEvent?: (event: MapsLiveEvent) => void;
}

/**
 * Maps port. RLS decides what each role gets: the DM everything; players the visible/active scenes,
 * visible tokens, `visible_players` walls, and may only move (x/y) tokens they control.
 */
export interface MapsPort {
  // scenes
  listScenes(campaignId: string): Promise<Scene[]>;
  getScene(id: string): Promise<Scene | null>;
  createScene(input: CreateSceneInput): Promise<Scene>;
  updateScene(id: string, patch: ScenePatch): Promise<void>;
  removeScene(id: string): Promise<void>;
  /** DM only: what the players see (`campaigns.active_scene_id`). */
  setActiveScene(campaignId: string, sceneId: string | null): Promise<void>;
  // background library
  listImages(campaignId: string): Promise<ImageAsset[]>;
  /** DM only: uploads to `backgrounds/{campaignId}/{uuid}.png` and registers the row. */
  uploadImage(campaignId: string, file: Blob, name: string): Promise<ImageAsset>;
  removeImage(id: string): Promise<void>;
  // walls
  listWalls(sceneId: string): Promise<Wall[]>;
  addWall(input: NewWall): Promise<Wall>;
  /**
   * DM: UNA SALA ENTERA de una vez (§ «Rebanada 8»). Existe aparte de `addWall` porque una sala a la que le
   * falta un lado NO es una sala: por el hueco se cuela la visión. Entran todos sus muros o no entra ninguno.
   */
  addWalls(inputs: NewWall[]): Promise<Wall[]>;
  /** DM only: open/close a door or window, or change what a segment is. */
  updateWall(id: string, patch: WallPatch): Promise<void>;
  /** DM only: the segment was moved or a vertex stretched with Seleccionar. */
  updateWallGeometry(id: string, at: { x1: number; y1: number; x2: number; y2: number }): Promise<void>;
  removeWall(id: string): Promise<void>;
  /**
   * DM: ata o desata un puñado de muros (§ «EL GRUPO»). `groupId` a `null` los deja sueltos otra vez.
   * Es UNA sentencia: agrupar media selección y dejar la otra media suelta no es un estado que exista.
   */
  setWallsGroup(ids: string[], groupId: string | null): Promise<void>;
  /** DM: borra varios muros de una vez — el grupo entero con Suprimir (§ «EL GRUPO»). */
  removeWalls(ids: string[]): Promise<void>;
  /**
   * DM: enseña —o esconde— TODOS los muros de una escena a los jugadores de golpe (petición suya,
   * 2026-09-03: «agrega un botón para que los jugadores puedan ver las líneas de los muros»).
   *
   * Existe aparte de `updateWall` porque marcarlos uno a uno era justo lo que él quería dejar de hacer, y
   * porque va por ESCENA y no por lista de ids: lo que pide el botón es «todos los de este mapa», incluidos
   * los que este navegador no tenga cargados todavía. Una sola sentencia; a medio camino la mesa vería unas
   * paredes sí y otras no.
   */
  setAllWallsVisible(sceneId: string, visible: boolean): Promise<void>;
  /**
   * DM: la geometría de varios muros a la vez — mover o estirar un grupo entero (§ «EL GRUPO»).
   * Va aparte de `updateWallGeometry` porque un grupo a medio mover deja la forma rota en la base.
   */
  updateWallsGeometry(walls: Wall[]): Promise<void>;
  // tokens
  listTokens(sceneId: string): Promise<Token[]>;
  addToken(input: NewToken): Promise<Token>;
  /** Players: only `x`/`y` of tokens they control (trigger); DM: anything. */
  updateToken(id: string, patch: TokenPatch): Promise<void>;
  removeToken(id: string): Promise<void>;
  // drawings
  listDrawings(sceneId: string): Promise<Drawing[]>;
  addDrawing(input: NewDrawing): Promise<Drawing>;
  removeDrawing(id: string): Promise<void>;
  /** My strokes in the scene. */
  removeMyDrawings(sceneId: string): Promise<void>;
  /** DM: every stroke in the scene. */
  removeAllDrawings(sceneId: string): Promise<void>;
  /** DM: manda un trazo a otra capa (rebanada 7). Lo único que se edita de un dibujo. */
  updateDrawingLayer(id: string, layerId: string | null): Promise<void>;
  /** Mover un trazo: sus coordenadas ya desplazadas. Sólo el director, como manda su RLS. */
  updateDrawingData(id: string, data: Drawing['data']): Promise<void>;
  // layers (rebanada 7) — las escribe SÓLO el director
  listLayers(sceneId: string): Promise<Layer[]>;
  /**
   * DM only. Las tres capas fijas las crea un disparador al nacer la escena, así que por aquí sólo pasan
   * las de TERRENO, que son las únicas sin límite.
   */
  addLayer(input: NewLayer): Promise<Layer>;
  updateLayer(id: string, patch: LayerPatch): Promise<void>;
  /** DM only. Se lleva los dibujos y las luces de esa capa; las FICHAS vuelven a su capa natural. */
  removeLayer(id: string): Promise<void>;
  /**
   * DM only. Sube el PNG de la máscara del pincel a `backgrounds/{campaignId}/masks/{layerId}.png` y deja
   * el puntero + la versión nueva en la fila. La foto original de la capa no se toca nunca.
   */
  saveMask(layer: Pick<Layer, 'id' | 'campaignId' | 'maskVersion'>, png: Blob): Promise<Layer>;
  /** DM only. Quita la máscara: la capa vuelve a ser opaca entera. */
  clearMask(layer: Pick<Layer, 'id' | 'campaignId'>): Promise<void>;

  // lights (rebanada 7) — desde § 7.2 alumbran de verdad y entran en el cálculo de visión (del servidor)
  listLights(sceneId: string): Promise<Light[]>;
  addLight(input: NewLight): Promise<Light>;
  updateLight(id: string, patch: LightPatch): Promise<void>;
  removeLight(id: string): Promise<void>;

  // ── piezas (rebanada 6) ───────────────────────────────────────────────────
  // Dos familias, y la separación ES la regla: la BIBLIOTECA es de la campaña y existe para usarse; lo
  // PLANTADO vive en una escena. Borrar de la biblioteca no toca lo plantado.

  /** La biblioteca de la campaña MÁS el catálogo de la app (las piezas sin campaña). DM only. */
  listProps(campaignId: string): Promise<Prop[]>;
  /**
   * DM only. Sube la foto y crea la pieza. Recibe el fichero ya elegido: comprimir es del camino único de
   * imágenes (`specs/core/images/SPEC.md`), no de este adaptador.
   */
  addProp(input: NewProp, image: Blob): Promise<Prop>;
  /** DM only. También es por donde se guarda la escala que la pieza RECUERDA (§ 6.4). */
  updateProp(id: string, patch: PropPatch): Promise<void>;
  /** DM only. NO borra lo ya plantado en los mapas: ésos se quedan con su copia de la foto. */
  removeProp(id: string): Promise<void>;

  listSceneProps(sceneId: string): Promise<SceneProp[]>;
  addSceneProp(input: NewSceneProp): Promise<SceneProp>;
  updateSceneProp(id: string, patch: ScenePropPatch): Promise<void>;
  removeSceneProp(id: string): Promise<void>;

  // realtime (channel `scene:{sceneId}` — separate from the table's `campaign:{id}` channel)
  subscribe(sceneId: string, handlers: MapsLiveHandlers): Unsubscribe;
  /** Sends an ephemeral event on the scene channel opened by `subscribe` (no-op if not subscribed). */
  broadcast(sceneId: string, event: MapsLiveEvent): void;
}
