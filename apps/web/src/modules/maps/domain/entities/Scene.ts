/** Maps (H7) — domain entities. Mirrors `maps_*` (supabase/migrations/20260818130000_maps.sql). */

export type FogMode = 'vision' | 'manual' | 'off';
/** Scene light: `day` = only geometry limits sight; `night` = up to `nightRadiusM` metres from each token. */
export type Lighting = 'day' | 'night';
/** Background fit: Cubrir / Encajar / Reposicionar. */
export type BgFit = 'cover' | 'contain' | 'custom';
export interface BgTransform { mode: BgFit; x: number; y: number; scale: number }
export interface GridSettings { size: number; visible: boolean }

export interface Scene {
  id: string;
  campaignId: string;
  name: string;
  /** Scene size in px (scene coordinates). */
  width: number;
  height: number;
  bgColor: string;
  bgImageUrl: string | null;
  bgTransform: BgTransform;
  grid: GridSettings;
  fogMode: FogMode;
  lighting: Lighting;
  /** How far one sees at night, in METRES (the unit the table reasons in); px conversion uses the system's metres per cell. */
  nightRadiusM: number;
  /**
   * Paredes sólidas: si en esta escena un token puede o no atravesar un muro (rebanada 4).
   * `false` = como siempre, los tokens pasan como fantasmas. Va por escena y no por campaña porque una
   * mazmorra y un descampado no piden lo mismo (dueño, 2026-08-22).
   */
  solidWalls: boolean;
  sortOrder: number;
  visiblePlayers: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface CreateSceneInput { campaignId: string; name: string; width?: number; height?: number; bgColor?: string; sortOrder?: number }
export type ScenePatch = Partial<Pick<Scene, 'name' | 'width' | 'height' | 'bgColor' | 'bgImageUrl' | 'bgTransform' | 'grid' | 'fogMode' | 'lighting' | 'nightRadiusM' | 'solidWalls' | 'sortOrder' | 'visiblePlayers'>>;

/** What a segment is. The three types collapse into two flags — see `blocksSightNow` / `blocksMoveNow` in mapRules. */
export type WallKind = 'wall' | 'door' | 'window';
/**
 * Wall segment in scene px; players only receive `visiblePlayers` ones (RLS).
 * Semantics (supabase/migrations/20260818140000_maps_vision.sql): cuts sight ⇔ `blocksSight && !isOpen`;
 * cuts movement ⇔ `blocksMove && !isOpen` (no effect until slice 3).
 */
export interface Wall {
  id: string; sceneId: string; campaignId: string;
  x1: number; y1: number; x2: number; y2: number;
  visiblePlayers: boolean;
  kind: WallKind;
  blocksSight: boolean;
  blocksMove: boolean;
  isOpen: boolean;
}
export type NewWall = Omit<Wall, 'id'>;
export type WallPatch = Partial<Pick<Wall, 'visiblePlayers' | 'kind' | 'blocksSight' | 'blocksMove' | 'isOpen'>>;

/** A PC or a bestiary instance. `x`/`y`/`size` are in grid cells (top-left cell). */
export interface Token {
  id: string;
  sceneId: string;
  campaignId: string;
  characterId: string | null;
  bestiaryRef: string | null;
  /**
   * Fila de `bestiary_entries` de la que salió esta instancia, cuando viene de un encuentro PROPIO del
   * director (H5). Las criaturas del manual no tienen fila y siguen viajando en `bestiaryRef`.
   * Se rompe con ON DELETE SET NULL: borrar la plantilla no puede vaciar la escena a mitad de partida.
   */
  bestiaryEntryId: string | null;
  name: string;
  imageUrl: string | null;
  x: number;
  y: number;
  size: number;
  color: string | null;
  visible: boolean;
  /** Player who may move it (besides the DM). */
  controlledBy: string | null;
  visionRadius: number | null;
  state: Record<string, unknown>;
  /**
   * Capa donde está (rebanada 7). `null` = su capa natural, «Criaturas y personajes» — que es donde vive
   * todo lo colocado antes, así que no hubo que rellenar nada al migrar. Un jugador NO puede cambiarla: el
   * disparador `maps_tokens_guard_update` la tiene en la lista de columnas prohibidas.
   */
  layerId: string | null;
}
export type NewToken = Omit<Token, 'id' | 'layerId'> & { layerId?: string | null };
export type TokenPatch = Partial<Omit<Token, 'id' | 'sceneId' | 'campaignId'>>;

export type DrawingKind = 'stroke' | 'line' | 'rect' | 'circle' | 'text';
export type DrawingData =
  | { points: [number, number][] }                       // stroke
  | { x1: number; y1: number; x2: number; y2: number }   // line / rect (bbox)
  | { cx: number; cy: number; r: number }                // circle
  | { x: number; y: number; text: string };              // text
export interface Drawing { id: string; sceneId: string; campaignId: string; authorId: string; kind: DrawingKind; data: DrawingData; color: string; width: number; createdAt: string;
  /** Capa donde está (rebanada 7). `null` = su capa natural, «Objetos». Borrar una capa se lleva sus dibujos. */
  layerId: string | null }
export type NewDrawing = Omit<Drawing, 'id' | 'authorId' | 'createdAt' | 'layerId'> & { layerId?: string | null };

/** Campaign background library entry (bucket `backgrounds/{campaignId}/…`). */
export interface ImageAsset { id: string; campaignId: string; name: string; url: string; createdAt: string }

/** Row-level change coming from realtime. `row` is null on DELETE (only the id travels). */
export interface RowChange<T> { type: 'INSERT' | 'UPDATE' | 'DELETE'; id: string; row: T | null }

// ── Rebanada 7 — capas de contenido, terreno con máscara y luces de ambiente ──
// Espejo de `supabase/migrations/20260831120000_maps_layers_lights.sql`.

/**
 * Los cuatro tipos de capa. Ojo: NO es el orden de pintado del motor (fondo → muros → dibujos → tokens →
 * niebla), que no se toca. Estas son las capas que el DIRECTOR maneja.
 * `terrain` es el único sin límite; de los otros tres hay exactamente uno por escena (índice único + disparador).
 */
export type LayerKind = 'terrain' | 'objects' | 'creatures' | 'dm_notes';

export interface Layer {
  id: string;
  sceneId: string;
  campaignId: string;
  kind: LayerKind;
  /** Vacío en las tres fijas: la pantalla las rotula desde `kind` con i18n, para no meter idioma en la BD. */
  name: string;
  /** Ordena entre capas DEL MISMO tipo — hoy sólo el terreno tiene más de una. */
  sortOrder: number;
  /**
   * El ojo de Photoshop: apagada NO SE PINTA PARA NADIE, tampoco para el director. Es composición, no
   * privacidad — por eso «Notas del director» es un tipo aparte (dueño, 2026-08-31).
   */
  visible: boolean;
  /** Se ve pero no se selecciona ni se mueve. Sólo afecta al director: un jugador no selecciona nada. */
  locked: boolean;
  /** Sólo terreno: la foto de esta capa y su encaje (misma forma que `Scene.bgTransform`). */
  imageUrl: string | null;
  transform: BgTransform;
  /**
   * Sólo terreno: PNG de la máscara del pincel de transparencia en `backgrounds/{campaignId}/masks/{layerId}.png`.
   * `null` = sin máscara = capa opaca entera. La foto original nunca se toca.
   */
  maskUrl: string | null;
  /** Sube en cada guardado: rompe la caché (`?v=N`) y delata al navegador que se quedó viejo. */
  maskVersion: number;
  createdAt: string;
  updatedAt: string;
}
export interface NewLayer { sceneId: string; campaignId: string; kind: LayerKind; name?: string; sortOrder?: number; imageUrl?: string | null; transform?: BgTransform }
export type LayerPatch = Partial<Pick<Layer, 'name' | 'sortOrder' | 'visible' | 'locked' | 'imageUrl' | 'transform' | 'maskUrl' | 'maskVersion'>>;

/** Forma de la luz. `cone` usa además `coneAngle`; en las otras dos se ignora. */
export type LightShape = 'cone' | 'radius' | 'square';
/** Qué clase de luz es. Manda el color, el alcance por defecto y —lo que pidió el dueño— el RITMO del parpadeo. */
export type LightKind = 'torch' | 'bulb' | 'fire' | 'lantern' | 'flashlight' | 'moonlight' | 'magic';

/**
 * Una luz de ambiente. Desde § 7.2 ALUMBRA DE VERDAD: se recorta contra los muros, entra en el cálculo de
 * visión (que hace el servidor) y lo que alumbra se recuerda como explorado. Y se ANIMA cuando `flicker`
 * está puesto — animar es pintar (dueño, 2026-08-31).
 */
export interface Light {
  id: string;
  sceneId: string;
  campaignId: string;
  /** Vive en una capa como cualquier objeto. `null` = la capa natural (objetos). */
  layerId: string | null;
  shape: LightShape;
  kind: LightKind;
  /** Centro de la luz, en px de escena. */
  x: number;
  y: number;
  /** Grados, para orientar el cono. */
  rotation: number;
  /** Apertura del cono en grados. Sin ella un cono no está definido. */
  coneAngle: number;
  color: string;
  flicker: boolean;
  /**
   * Alcance en METROS (la unidad de la mesa), como `Scene.nightRadiusM`. Se guarda desde el primer día
   * aunque todavía no se lea: añadirlo después obligaría a repasar todas las luces ya colocadas.
   */
  rangeM: number;
  /** Ídem: si el día que ilumine proyectará sombra contra los muros. */
  castsShadow: boolean;
  /**
   * LA LUZ QUE GIRA (§ 7.2, «como una sirena»): milisegundos que tarda una VUELTA ENTERA. `0` = no gira.
   *
   * Uno y no dos campos —un «gira sí/no» aparte del periodo— porque serían dos formas de decir lo mismo y
   * tarde o temprano una mentiría. Sólo significa algo con `shape: 'cone'`: un radio ya alumbra en redondo.
   */
  spinMs: number;
  createdAt: string;
  updatedAt: string;
}
export type NewLight = Omit<Light, 'id' | 'createdAt' | 'updatedAt'>;
export type LightPatch = Partial<Omit<Light, 'id' | 'sceneId' | 'campaignId' | 'createdAt' | 'updatedAt'>>;

// ── Rebanada 6 · galería de piezas ──────────────────────────────────────────

/** Las seis categorías las trae la app: cerradas, no etiquetas libres (elección del dueño, 2026-08-31). */
export type PropCategory = 'furniture' | 'vegetation' | 'floors' | 'doors' | 'markers' | 'misc';
/** La forma que ESTORBA de una pieza. Simple a propósito: la silueta real de un PNG es cara y da errores raros. */
export type BlockShape = 'rect' | 'circle';

/**
 * Una pieza de la BIBLIOTECA: existe para usarse, y no está en ningún mapa. Guarda además lo que la pieza
 * RECUERDA — la última escala con la que se usó (§ 6.4) y con qué estorbo nace una copia suya (§ 6.5).
 */
export interface Prop {
  id: string;
  /** `null` = pieza DEL CATÁLOGO DE LA APP; con valor = pieza de esa campaña (§ 6.1). */
  campaignId: string | null;
  name: string;
  category: PropCategory;
  imageUrl: string;
  /** Tamaño del fichero ya subido, en px: con él y la escala sale la huella sin esperar a que cargue. */
  naturalWidth: number;
  naturalHeight: number;
  /**
   * LA ESCALA QUE SE RECUERDA. Un solo número y no un ancho y un alto: la escala mantiene la proporción, así
   * que redimensionar no puede deformar la pieza. Se reescribe tanto al plantar con otro tamaño como al
   * redimensionar una ya plantada — los dos caminos por los que se «pone» una escala.
   */
  defaultScale: number;
  /** Con qué estorbo NACE una copia. Se copian al plantar; a partir de ahí manda la plantada. */
  defaultBlocksSight: boolean;
  defaultBlocksMove: boolean;
  defaultBlockShape: BlockShape;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
}
export type NewProp = Omit<Prop, 'id' | 'createdAt' | 'updatedAt'>;
export type PropPatch = Partial<Omit<Prop, 'id' | 'campaignId' | 'createdAt' | 'updatedAt'>>;

/**
 * Una pieza YA PLANTADA en un mapa. Se lleva su propia copia de la foto y del nombre a propósito: es lo que
 * hace cumplir la regla «borrar una pieza de la biblioteca no borra las ya puestas en los mapas», porque
 * `propId` puede quedarse en `null` sin que esto se rompa.
 */
export interface SceneProp {
  id: string;
  sceneId: string;
  campaignId: string;
  /** Vive en una capa como cualquier objeto. `null` = la capa natural (objetos). */
  layerId: string | null;
  /** De qué pieza de la biblioteca salió. `null` = ya no está en la biblioteca; esto sigue entero. */
  propId: string | null;
  imageUrl: string;
  name: string;
  /** Centro de la pieza, en px de escena. */
  x: number;
  y: number;
  /** Huella en px de escena: sale del tamaño natural por la escala. */
  width: number;
  height: number;
  /** Grados, como el resto del lienzo. */
  rotation: number;
  blocksSight: boolean;
  blocksMove: boolean;
  blockShape: BlockShape;
  /** La forma que estorba, en px de escena y relativa al CENTRO. En `circle`, `blockW` es el DIÁMETRO. */
  blockW: number;
  blockH: number;
  blockDx: number;
  blockDy: number;
  createdAt: string;
  updatedAt: string;
}
export type NewSceneProp = Omit<SceneProp, 'id' | 'createdAt' | 'updatedAt'>;
export type ScenePropPatch = Partial<Omit<SceneProp, 'id' | 'sceneId' | 'campaignId' | 'createdAt' | 'updatedAt'>>;
