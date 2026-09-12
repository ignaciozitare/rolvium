/** Maps (H7) — domain entities. Mirrors `maps_*` (supabase/migrations/20260818130000_maps.sql). */

export type FogMode = 'vision' | 'manual' | 'off';
/** Scene light: `day` = only geometry limits sight; `night` = up to `nightRadiusM` metres from each token. */
export type Lighting = 'day' | 'night';
/** Background fit: Cubrir / Encajar / Reposicionar. */
export type BgFit = 'cover' | 'contain' | 'custom';
export interface BgTransform { mode: BgFit; x: number; y: number; scale: number }
export interface GridSettings { size: number; visible: boolean }

/**
 * LA PUNTA DEL PINCEL (rebanada 9). Espejo del CHECK de `maps_scenes.brush_tip`.
 * `disc` corta a canto limpio · `soft` se difumina · `rough` sale con el borde roto.
 */
export type BrushTip = 'disc' | 'soft' | 'rough';
export const BRUSH_TIPS: BrushTip[] = ['disc', 'soft', 'rough'];

/**
 * LA PUNTA DE «A PULSO» EN EL BUILDER (§ 10B.4). Espejo del CHECK de `maps_scenes.band_tip`.
 * `clean` es el canto limpio de siempre · `rough` sale con el borde roto. Sin difuminado: un suelo se pisa o no.
 */
export type BandTip = 'clean' | 'rough';
export const BAND_TIPS: BandTip[] = ['clean', 'rough'];

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
  /**
   * LAS DOS TEXTURAS BASE Y EL GROSOR SON DE LA ESCENA (rebanada 8), no de la sala ni de la campaña. Suyo,
   * 2026-09-03: «*una cripta y un bosque no se parecen en nada*» → de cada MAPA.
   *
   * `roomPreset` elige las dos de golpe; las dos URL, si las hay, mandan sobre él.
   *
   * ⚠️ **El PREAJUSTE se congela en cada sala al dibujarla** (orden suya del 2026-09-03: «*como que repinta
   * las salas, nooooo*»), pero **las TEXTURAS son del mapa y se aplican a todas**. No es una incoherencia:
   * son dos cosas distintas y él las pidió distintas — corrección suya del 2026-09-04 probándolo, «*si no
   * selecciono la textura del piso en el momento cero no la carga*». Una sala sólo tendrá suelo PROPIO
   * cuando llegue el pincel de repintarla, que es la tanda siguiente.
   */
  roomPreset: RoomPreset;
  wallTextureUrl: string | null;
  floorTextureUrl: string | null;
  /** EN CASILLAS, no en px: el muro se ve igual de grueso con la rejilla en 15 que en 60. */
  wallThickness: number;
  /**
   * CUÁNTO MIDE UN AZULEJO de cada textura, EN CASILLAS (petición suya del 2026-09-04 probando el
   * constructor: «*tengo una textura de mosaicos que quedan muy grandes, necesito escalar la textura*»).
   *
   * 🔑 Una textura NO es una foto de fondo: **se repite**, no se estira. Estirada de borde a borde del mapa
   * —que es lo que hacía antes— un mosaico de 40 px sale del tamaño del mapa entero. Y va en casillas por lo
   * mismo que el grosor: «dos casillas por azulejo» se ve igual con cualquier rejilla y a cualquier zoom.
   */
  wallTextureScale: number;
  floorTextureScale: number;
  /**
   * 🔄 EL GIRO DEL MOSAICO de cada textura, EN GRADOS (0 ≤ x < 360). Petición suya del 2026-09-11: «*en la base del
   * suelo y las paredes tengo que poder rotar sus texturas*». Hermanas de las escalas —una por textura— y gira el
   * mosaico entero, como el «Giro» de la textura del Pincel (`tileMatrix`). De serie 0: ninguna escena cambia.
   */
  wallTextureRotation: number;
  floorTextureRotation: number;
  /**
   * EL COLOR DE TODAS LAS PUERTAS DE ESTA ESCENA (§ «Las puertas, de verdad»). `null` = el trazo del muro,
   * que es de donde salen hoy — y por eso es nulo y no un hex: clavar un color aquí obligaría a que la base
   * y el diseño dijeran lo mismo en dos sitios, y el día que cambie la tinta habría que migrar cada escena.
   *
   * Una puerta suelta puede desmentirlo con su `doorColor` (la de hierro del jefe). Elegido por él: por
   * defecto todas iguales, con excepción por puerta.
   */
  doorColor: string | null;
  /** La textura por defecto de TODAS las puertas de la escena. `null` = sin textura: manda el color. */
  doorTextureUrl: string | null;
  /**
   * CUÁNTO SE ENCOGEN O CRECEN TODAS LAS FICHAS DE ESTA ESCENA. `1` = como siempre.
   *
   * Encargo suyo del 2026-09-07, de un problema real de mesa: «*si dibujan pasillos pequeños los tokens no
   * pasarán… no quiero eliminar la colisión, quiero reducir el tamaño*». Una ficha NORMAL ocupa 1,5 casillas
   * y no cabe por un pasillo de una; a 2/3 ocupa 1 justa y pasa. Un GRANDE sigue sin pasar, y así debe ser.
   *
   * 🔑 ES UN SOLO MULTIPLICADOR PARA LOS CINCO TAMAÑOS, y ésa es la condición que él puso: «*esto hay que
   * respetarlo en tamaños… que se mantenga la relación de diminuto pequeño normal grande y enorme*». El
   * manual (p.25) fija PROPORCIONES, no huellas en casillas —el paso a casillas es interpretación nuestra,
   * RULES.md §1.6—, así que escalar a todos por igual no lo contradice; cambiar la relación sí lo haría.
   *
   * ⚠️ NO reescribe el tamaño de ninguna ficha: es una LENTE. Se aplica en `tokenSizeIn` (`mapRules`), que
   * es el único sitio donde se toca — y por el que pasan el dibujo Y la colisión, para que no se descuadren.
   */
  tokenScale: number;
  /**
   * EL PINCEL SE GUARDA EN LA ESCENA (rebanada 9). Decisión suya del 2026-09-09, contra la recomendación
   * contraria: «*el trazo es de la escena*». Un mapa tiene un estilo y el pincel es parte de él, así que se
   * abre ese mapa y el pincel está como lo dejó; otro mapa trae el suyo.
   *
   * Los valores por defecto son los que la app ya usaba antes de existir estas columnas, así que una escena
   * de antes se abre exactamente igual.
   */
  brushTip: BrushTip;
  /** En CASILLAS y continuo, para los tres sitios donde se pinta. */
  brushSize: number;
  /** Cuánto tapa o destapa cada pasada, 0..1. Ahora también en la niebla, que iba a saco. */
  brushStrength: number;
  /** El BORDE: 0 se difumina, 1 corta a filo. Es la dureza de siempre. */
  brushHardness: number;
  /** Cuánto de roto, 0..1. **Sólo se aplica con `brushTip === 'rough'`.** */
  brushRoughness: number;
  /**
   * LA PUNTA DE «A PULSO» TAMBIÉN SE GUARDA EN LA ESCENA (§ 10B.4), como el pincel y APARTE de él: uno pinta
   * encima y el otro levanta paredes, y cambiar uno no puede cambiar el otro. De serie, canto limpio: una escena
   * de antes dibuja exactamente como dibujaba.
   */
  bandTip: BandTip;
  /** Cuánto de roto sale el borde de «A pulso», 0..1. **Sólo se aplica con `bandTip === 'rough'`.** */
  bandRoughness: number;
  /**
   * LA PINTURA DE LA ROCA (rebanada 10): un PNG que se dibuja ENCIMA del muro, recortado contra la roca.
   * `null` = sin pintar.
   *
   * 🔑 Va por ESCENA y no por forma a propósito: la roca no es una fila, es el negativo de lo excavado —«todo
   * lo que no es habitación»—. No hay ninguna fila de muro a la que colgarle un PNG, y tampoco hace falta:
   * la roca no se mueve.
   */
  rockPaintUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface CreateSceneInput { campaignId: string; name: string; width?: number; height?: number; bgColor?: string; sortOrder?: number }
export type ScenePatch = Partial<Pick<Scene, 'name' | 'width' | 'height' | 'bgColor' | 'bgImageUrl' | 'bgTransform' | 'grid' | 'fogMode' | 'lighting' | 'nightRadiusM' | 'solidWalls' | 'sortOrder' | 'visiblePlayers' | 'roomPreset' | 'wallTextureUrl' | 'floorTextureUrl' | 'wallThickness' | 'wallTextureScale' | 'floorTextureScale' | 'wallTextureRotation' | 'floorTextureRotation' | 'doorColor' | 'doorTextureUrl' | 'tokenScale' | 'brushTip' | 'brushSize' | 'brushStrength' | 'brushHardness' | 'brushRoughness' | 'bandTip' | 'bandRoughness'>>;

// ── LAS PUERTAS, DE VERDAD (§ specs/modules/maps) ───────────────────────────
// Espejo de `supabase/migrations/20260907120000_maps_doors.sql`.
//
// 🔑 EL MISMO JUEGO EN LAS DOS TABLAS, a propósito: una puerta de muro suelto vive en `maps_walls` y una de
// sala en `maps_room_openings`. Repetirlo es lo que deja que el panel de la puerta y el disco de abrir sean
// UNA sola pieza para las dos — que es justo lo que estaba roto: el disco sólo miraba en los muros.

/** Una hoja, o dos que se parten por la mitad y giran a la vez, cada una desde su extremo. */
export type DoorLeaves = 1 | 2;
/** De qué extremo cuelga: `start` = `(x1,y1)`, por donde se empezó a dibujar. Sólo se lee con UNA hoja. */
export type DoorHinge = 'start' | 'end';
/**
 * Hacia qué lado gira la hoja, medido sobre la normal del segmento (`right` = +n con n = (-dy, dx), que es
 * el lado de siempre). Se nombra por la GEOMETRÍA y no «adentro/afuera» a propósito: en un muro suelto sobre
 * una foto no hay dentro ni fuera, y el lado por defecto es FIJO, no calculado.
 */
export type DoorSwing = 'left' | 'right';

/** Cómo es una puerta. Configurarla NUNCA es obligatorio: estos valores son los que trae de fábrica. */
export interface DoorSettings {
  leaves: DoorLeaves;
  hinge: DoorHinge;
  swing: DoorSwing;
  /** `null` = el de la escena (`Scene.doorColor`), que es el caso normal y el de todas las que ya existen. */
  doorColor: string | null;
  /**
   * Textura propia de ESTA puerta — una url del catálogo (`maps_textures`), no un fichero nuevo: las
   * texturas son de la herramienta y ya se suben y se ordenan en un sitio. `null` = la de la escena.
   *
   * ⚠️ MANDA SOBRE EL COLOR: si hay textura, el color no se ve. Pedido suyo del 2026-09-07 probándolo.
   */
  doorTextureUrl: string | null;
}
export const DEFAULT_DOOR: DoorSettings = { leaves: 1, hinge: 'start', swing: 'right', doorColor: null, doorTextureUrl: null };
export const DOOR_LEAVES: DoorLeaves[] = [1, 2];
export const DOOR_HINGES: DoorHinge[] = ['start', 'end'];
/** `right` primero: es el de fábrica, y en pantalla se lee «Un lado · El otro», no al revés. */
export const DOOR_SWINGS: DoorSwing[] = ['right', 'left'];

/** What a segment is. The three types collapse into two flags — see `blocksSightNow` / `blocksMoveNow` in mapRules. */
export type WallKind = 'wall' | 'door' | 'window';
/**
 * Wall segment in scene px; players only receive `visiblePlayers` ones (RLS).
 * Semantics (supabase/migrations/20260818140000_maps_vision.sql): cuts sight ⇔ `blocksSight && !isOpen`;
 * cuts movement ⇔ `blocksMove && !isOpen` (no effect until slice 3).
 */
export interface Wall extends DoorSettings {
  id: string; sceneId: string; campaignId: string;
  x1: number; y1: number; x2: number; y2: number;
  visiblePlayers: boolean;
  kind: WallKind;
  blocksSight: boolean;
  blocksMove: boolean;
  isOpen: boolean;
  /**
   * EL GRUPO (§ «Rebanada 8»): ata entre sí los muros que salieron de UN gesto, o que el director juntó a mano.
   * `null` = muro suelto, que es lo que son todos los de antes de que esto existiera.
   *
   * 🔑 NO es una habitación. Marcando sobre una foto no hay suelo ni textura: hay muros. Un círculo son once
   * muros que para él son UNA cosa, y puede acabar siendo una sala, un pilar o un estanque — al grupo le da igual.
   */
  groupId: string | null;
}
/**
 * Al crear, el grupo es opcional: un muro suelto no lo lleva, y el camino de siempre no tuvo que enterarse.
 * Y los ajustes de puerta también, por lo mismo: se dibuja y ya funciona (orden suya), así que quien no los
 * pase se queda con `DEFAULT_DOOR` — que es lo que la base pone por omisión.
 */
export type NewWall = Omit<Wall, 'id' | 'groupId' | keyof DoorSettings> & { groupId?: string | null } & Partial<DoorSettings>;
export type WallPatch = Partial<Pick<Wall, 'visiblePlayers' | 'kind' | 'blocksSight' | 'blocksMove' | 'isOpen' | 'leaves' | 'hinge' | 'swing' | 'doorColor' | 'doorTextureUrl'>>;

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
  /**
   * Sólo terreno: LA PINTURA de esta capa (rebanada 10), un PNG en
   * `backgrounds/{campaignId}/paint/layer-{layerId}.png` que se dibuja ENCIMA de su foto. `null` = sin pintar.
   * La foto original no se toca nunca, igual que con la máscara — lo contrario de la máscara es lo único que
   * cambia: aquélla QUITA, ésta PONE.
   */
  paintUrl: string | null;
  /** Su propio rompe-caché, aparte del de la máscara: se pintan y se borran por separado. */
  paintVersion: number;
  createdAt: string;
  updatedAt: string;
}
export interface NewLayer { sceneId: string; campaignId: string; kind: LayerKind; name?: string; sortOrder?: number; imageUrl?: string | null; transform?: BgTransform }
export type LayerPatch = Partial<Pick<Layer, 'name' | 'sortOrder' | 'visible' | 'locked' | 'imageUrl' | 'transform' | 'maskUrl' | 'maskVersion' | 'paintUrl' | 'paintVersion'>>;

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
  /**
   * CUÁNTO CANTA, en porcentaje (§ 7.2, «intensidad por luz», petición del dueño 2026-09-01). `100` es
   * exactamente como se pintaban las luces antes de que esto existiera.
   *
   * No confundir con `rangeM`, que es cuánto ILUMINA. Son cosas distintas a propósito: una vela tenue sigue
   * alumbrando su rincón entero. Esto es SÓLO pintura — decisión suya del 2026-09-01: una luz al 10 % revela
   * el mismo terreno que al 100 %, así que la api ni la pide ni la necesita.
   */
  intensity: number;
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

// ── Rebanada 8 · LAS SALAS ──────────────────────────────────────────────────
// Espejo de `supabase/migrations/20260904120000_maps_rooms.sql`.
//
// 🔑 El suelo NO se pone encima: SE VE POR EL AGUJERO. La textura de pared rellena la escena entera y cada
// sala abre un hueco. Dibujar una sala no añade suelo, quita pared.
//
// 🔴 Y el muro de una sala NO es un `Wall`. Mismo comportamiento (corta la vista, frena a las fichas, recorta
// las luces) y entidad distinta: el `Wall` es una marca invisible sobre una foto traída de fuera; el de la
// sala es un objeto que SE VE y que ES el mapa. Su contorno se CALCULA (`roomOutline`, en `@rolvium/core`):
// no hay filas derivadas que reescribir cuando él mueva una forma.

/** Los nueve preajustes del diseño (`rolvium.pen` · `ePNCc` § PREAJUSTES). Nuestros y en castellano. */
export type RoomPreset = 'hatch' | 'module' | 'ancient' | 'hatch_gray' | 'fill' | 'cavern' | 'simple' | 'ink' | 'hand';
export const ROOM_PRESETS: RoomPreset[] = ['hatch', 'module', 'ancient', 'hatch_gray', 'fill', 'cavern', 'hand', 'simple', 'ink'];

/**
 * Con qué gesto se levantó la sala. No cambia cómo se funde: todas las formas siguen las mismas reglas.
 *
 * `brush` es un BROCHAZO del pincel (rebanada 10). Hoy se pinta y se funde como cualquier otra, y la marca
 * existe para el día que una forma se pueda coger y editar: un rectángulo y un brochazo no se editan igual.
 */
export type RoomShapeKind = 'rect' | 'circle' | 'poly' | 'free' | 'brush';

/**
 * QUÉ HACE UNA FORMA CON LA ROCA — y son las dos únicas cosas que se pueden hacer (suyo, 2026-09-04: «*los
 * muros serán relleno de esos huecos*»):
 *  · `room` — EXCAVA: abre un hueco y por él se ve el suelo. Es una habitación.
 *  · `fill` — RELLENA: devuelve roca al hueco. Es un tabique, un pilar, o corregir un borde que quedó torcido.
 *
 * No hay una entidad «muro de sala» aparte: es la misma forma con el signo cambiado, y por eso comparte
 * tabla, formas, rejilla, deshacer y el motor que calcula el contorno.
 */
export type RoomKind = 'room' | 'fill';

/**
 * UNA FORMA, no la unión. Él eligió que cada rectángulo/círculo/polígono se recuerde por separado para poder
 * cogerlo, moverlo o borrarlo después; lo que se ve fundido se calcula al pintar.
 */
export interface Room {
  id: string;
  sceneId: string;
  campaignId: string;
  /** Si excava o si rellena. Todo lo demás de la fila significa lo mismo en los dos casos. */
  kind: RoomKind;
  shape: RoomShapeKind;
  /** El anillo, en px de escena. Cerrado implícitamente: el último punto vuelve al primero. */
  points: [number, number][];
  /**
   * SU SUELO, heredado del momento de dibujar y quieto desde entonces. Cambiar el preajuste de la escena NO
   * lo repinta — orden suya del 2026-09-03, en redondo: «*como que repinta las salas, nooooo*».
   */
  floorPreset: RoomPreset;
  floorUrl: string | null;
  /**
   * CON QUÉ COLOR ESTÁ PINTADA ESTA FORMA (rebanada 10). `null` = manda su preajuste.
   *
   * 🔑 **En una que EXCAVA es su suelo; en una que RELLENA es su roca.** Es la misma columna porque es la
   * misma idea —«con qué está pintada esta forma»— y por eso un brochazo de MURO puede llevar su propia
   * piedra sin inventar una segunda columna que dijera lo mismo.
   *
   * Qué manda sobre qué, y es el mismo orden que ya rige en las puertas: **la foto (`floorUrl`) gana al
   * color, y el color gana al preajuste**. La consecuencia es buena y buscada: quitarle la textura a un
   * brochazo no lo deja en blanco, descubre el color que había debajo.
   */
  floorColor: string | null;
  /**
   * DÓNDE SE HA PINTADO ENCIMA DE SU SUELO (rebanada 9). Un PNG, igual que la máscara de una capa de terreno
   * y por el mismo motivo: la textura original **no se toca nunca** y siempre se puede volver atrás.
   * `null` = sala sin pintar = el suelo se ve entero, que es como están todas las salas de antes.
   *
   * 🔑 **Y es lo que hace verdad «no me manches la pared»** (regla suya, 2026-09-09): la máscara pertenece a
   * LA SALA, así que un brochazo no puede salirse de ella aunque el pincel pase por encima del muro. El
   * recorte sale del sitio donde se guarda, no de una comprobación que alguien pueda olvidarse de escribir.
   */
  floorMaskUrl: string | null;
  /**
   * LA PINTURA DE ESTA FORMA (rebanada 10): un PNG que se dibuja ENCIMA de su suelo. `null` = sin pintar.
   *
   * ⚠️ **No es lo mismo que `floorMaskUrl`, y por eso son dos columnas.** Aquélla QUITA para que asome lo de
   * debajo; ésta PONE encima, y se suma capa sobre capa (suyo, 2026-09-10: «*pinto musgo arriba y pongo otro
   * color arriba de éste, se van sumando*»). Mezclarlas dejaría el borrador de una borrando la otra.
   *
   * 🔑 Cuelga de la fila porque **la pintura es de lo que pintaste**: hoy no se puede mover una habitación,
   * pero el día que se pueda la pintura se va con ella sin escribir una línea más.
   */
  floorPaintUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
export type NewRoom = Omit<Room, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * UN VANO ANOTADO SOBRE EL CONTORNO. No es un `planOpening` sobre una fila de muro, porque no hay fila: es el
 * tramo (de dónde a dónde) donde el contorno se abre. Va por ESCENA y no colgado de una sala porque el
 * contorno es el de la UNIÓN, y un vano puede caer justo donde dos salas se funden.
 */
export interface RoomOpening extends DoorSettings {
  id: string;
  sceneId: string;
  campaignId: string;
  x1: number; y1: number; x2: number; y2: number;
  kind: 'door' | 'window';
  isOpen: boolean;
}
export type NewRoomOpening = Omit<RoomOpening, 'id' | keyof DoorSettings> & Partial<DoorSettings>;

/**
 * UN COLOR QUE ÉL SE INVENTÓ, guardado (rebanada 10 · `supabase/migrations/20260910140000_maps_colors.sql`).
 *
 * Espejo de la tabla. Lo que sale del cuentagotas o del campo de texto se queda en «tus colores», **por
 * CAMPAÑA**: una campaña es un mundo con un aspecto, y el verde que mezclas para el bosque lo quieres en los
 * demás mapas de ese bosque. Mismo alcance que la biblioteca de fondos, y por lo mismo.
 *
 * ⚠️ La PALETA BASE de la casa no vive aquí: ésa es código (`BRUSH_COLORS`), no dato.
 */
export interface MapColor {
  id: string;
  campaignId: string;
  color: string;
  createdAt: string;
}

// ── Rebanada 8 · EL CATÁLOGO DE TEXTURAS ────────────────────────────────────
// Espejo de `supabase/migrations/20260904180000_maps_textures.sql`.
//
// 🔑 SON DE LA HERRAMIENTA, NO DE UNA CAMPAÑA (suyo, 2026-09-04: «*ten en cuenta que las texturas sirven para
// toda la herramienta, no son por usuario*»). Se sube una vez y sirve en todos los mapas de todas las
// campañas — al revés que `ImageAsset`, que es la biblioteca de fondos DE la campaña.

/** Cerradas, como las de las piezas: las etiquetas libres obligan a etiquetar bien o no se encuentra nada. */
export type TextureCategory = 'stone' | 'wood' | 'tile' | 'earth' | 'grass' | 'water' | 'misc';
export const TEXTURE_CATEGORIES: TextureCategory[] = ['stone', 'wood', 'tile', 'earth', 'grass', 'water', 'misc'];

export interface Texture {
  id: string;
  name: string;
  category: TextureCategory;
  url: string;
  /**
   * Cuánto mide un azulejo de ESTA textura, en casillas. Es una SUGERENCIA que se copia a la escena al
   * elegirla: un mosaico fino y unas losas grandes no quieren el mismo tamaño, y hacerle ajustar el
   * deslizador cada vez sería repetir un trabajo que ya hizo una vez.
   */
  tileCells: number;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
}
export type NewTexture = Omit<Texture, 'id' | 'createdAt' | 'updatedAt'>;
/** Lo único que se puede cambiar de una textura ya subida: cómo se llama y dónde está clasificada. */
export type TexturePatch = Partial<Pick<Texture, 'name' | 'category'>>;
