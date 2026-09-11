import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { SceneVision } from '@rolvium/core';
import type { BandTip, Drawing, DrawingKind, Layer, Light, Room, RoomOpening, RoomShapeKind, Scene, Token, Wall, WallKind } from '../domain/entities/Scene';
import { brushRadius, canEraseDrawing, canMoveDrawing, canMoveToken, canvasToScene, distanceCells, distanceLabel, drawingsInRect, hitOpening, hitTest, hitWall, isBrush, midpoint, rectFrom, shapeData, slideToken, tokenCenter, tokenPointAt, tokenRadiusPx, moveBlockers, tokensInRect, translateDrawing, wallDragTo, zoomAt, doorTexturesUsed, type Point, type Segment, type Tool, type View } from '../domain/useCases/mapRules';
import type { LiveDrag, LivePin } from './useScene';
import { brushRings, DEFAULT_BAND_ROUGHNESS, type BandEdge, freehandSides, isDragShape, isLineShape, lineSide, MIN_FILL_CELLS, MIN_LINE_CELLS, MIN_ROOM_CELLS, roomSides, type BuildKind, type BuilderMode, type RoomShape, type RoomSide } from '../domain/useCases/roomRules';
import { anchorEnd, builderPoint, END_SNAP_PX, stepOf } from '../domain/useCases/snapRules';
import { chainWalls, groupInsideOf, groupOf, handleAt as handlePoint, HANDLE_KEYS, insideGroup, moveWalls, resizeRect, scaleWallsTo, wallBounds, wallsInRect, withWholeGroups, type HandleKey, type Rect, type WallAt } from '../domain/useCases/groupRules';
import { BackgroundLayer, DoorTextureDefs, DrawingShape, FogMasks, GridLayer, LightsLayer, TerrainLayers, TokenGlyph, WallShape } from './canvasLayers';
import { RoomsLayer, roomMaskIds } from './roomsLayer';
import { ringFromSides, ringPath, roomAt, roomWallsOf } from '../domain/useCases/roomStyles';
import { roomMoveSegments } from '@rolvium/core';
import { isPainted, lightRadiusPx, paintedLights, resolveLayer, terrainLayers, type ElementKind } from '../domain/useCases/layerRules';

export interface StrokeStyle { color: string; width: number }

interface Props {
  scene: Scene;
  tokens: Token[];
  walls: Wall[];
  drawings: Drawing[];
  /** Capas de contenido de la escena (rebanada 7). Vacío = como antes de que existieran. */
  layers?: Layer[];
  /** Luces de ambiente. Son PINTURA: no revelan niebla ni entran en el cálculo de visión. */
  lights?: Light[];
  drags: Record<string, LiveDrag>;
  pin: LivePin | null;
  tool: Tool;
  stroke: StrokeStyle;
  me: string;
  isDm: boolean;
  /** DM «ver como jugador»: hides walls / hidden tokens / DM chrome. */
  playerView: boolean;
  showWalls: boolean;
  /** What the server says this viewer can see. `null` while it is still loading — the canvas then draws unfogged. */
  fog: SceneVision | null;
  /** Reveal/hide brush radius in cells (DM). */
  brush: number;
  /** What the Muro tool draws next. Only a plain wall chains click-to-click; an opening is one segment and stop. */
  wallKind?: WallKind;
  /** Con qué forma levanta Builder. `segment` es el de siempre —clic a clic— y no cambia (§ «Rebanada 8»). */
  wallShape?: RoomShape;
  view: View;
  onViewChange: (v: View) => void;
  nameOf: (userId: string) => string;
  /** `x`/`y` es donde el token ESTÁ (ya frenado/corregido); `desired`, a dónde quería ir el dedo. */
  onDragToken: (id: string, x: number, y: number, desired: { x: number; y: number }) => void;
  onMoveToken: (id: string, x: number, y: number) => void;
  /** Dónde dice el SERVIDOR que puede estar el token que se arrastra, o `null` si no ha dicho nada. */
  onServerCorrection?: (tokenId: string) => { x: number; y: number } | null;
  /** El disco LIBRE que el servidor confirmó: centro + holgura en casillas. No se pinta más allá de él. */
  onDragBound?: (tokenId: string) => { x: number; y: number; clearance: number } | null;
  onAddDrawing: (kind: DrawingKind, data: Drawing['data']) => void;
  onErase: (id: string) => void;
  onAddWall: (a: Point, b: Point) => void;
  /** Una sala entera de una vez: sus lados, ya en px de escena y listos para ser muros. */
  onAddRoom?: (sides: RoomSide[]) => void;
  /**
   * LAS SALAS (rebanada 8). Existen aparte de `onAddRoom` porque son otra cosa: aquél escribe MUROS de los de
   * siempre —marcas invisibles sobre una foto, el modo A— y esto guarda una FORMA, cuyo contorno ES el mapa.
   * Con el interruptor en «Dibujar aquí» manda éste; sobre una foto, el otro. Los dos conviven.
   */
  rooms?: Room[];
  roomOpenings?: RoomOpening[];
  /** En qué modo está Builder. Sin él, todo sigue funcionando como el modo «sobre una foto» de siempre. */
  builderMode?: BuilderMode;
  /**
   * QUÉ SE ESTÁ LEVANTANDO en el constructor de salas. Es OTRA cosa que `wallKind`, que es la clase del modo
   * «sobre una foto»: en el constructor la clase vive aquí. Sin este dato el lienzo creía que siempre estaba
   * poniendo un MURO y encadenaba —suyo, 2026-09-07: «*si pongo una puerta me haces poner otra puerta al
   * lado como si fuera un muro del modo fotos*».
   */
  buildKind?: BuildKind;
  onAddRoomShape?: (shape: RoomShapeKind, points: [number, number][]) => void;
  /**
   * EL GESTO NO LEVANTÓ NADA, y hay que decirlo. Sin esto el fallo era mudo: se arrastraba corto, no aparecía
   * nada y no había manera de saber por qué (dueño, 2026-09-04). `locked` distingue los dos porqués — el
   * gesto se quedó corto, o el candado de la rejilla no deja nada más pequeño que una casilla.
   */
  onTooSmall?: (locked: boolean) => void;
  /** DM: open or close the door/window that was clicked. */
  onToggleWall: (wall: Wall) => void;
  /**
   * Abrir y cerrar una puerta DE SALA. Va aparte de `onToggleWall` porque vive en otra tabla
   * (`maps_room_openings`), y su ausencia era el fallo: el disco sólo miraba en los muros, así que una
   * puerta dibujada en una sala nacía cerrada y no había forma de abrirla.
   */
  onToggleRoomOpening?: (opening: RoomOpening) => void;
  /**
   * EL VANO DE SALA COGIDO. Va aparte de `selectedWallId` porque es otra tabla, y existe para que el panel
   * pueda enseñar cómo es esa puerta y —lo que faltaba— su papelera: hoy un vano de sala no se puede borrar.
   */
  selectedRoomOpeningId?: string | null;
  onSelectRoomOpening?: (id: string | null) => void;
  /** DM: paint the fog at a scene point with the current brush radius (scene px). */
  /**
   * `start` marca el primer brochazo de un arrastre, igual que en el pincel de la máscara: quien escucha
   * sortea ahí la forma del borde roto, y sortearla en cada punto dejaría el trazo de ruido en vez de
   * desgarrado.
   */
  onPaintFog: (at: { x: number; y: number; radius: number }, op: 'reveal' | 'hide', start?: boolean) => void;
  /** DM, herramienta Luz: coloca una luz de ambiente donde se pinchó (px de escena). */
  onPlaceLight?: (at: Point) => void;
  /**
   * DM, pincel de transparencia: pinta la máscara de la capa de terreno activa, de `from` a `to` en px de
   * escena. `null` en `maskLayerId` = no hay capa donde pintar y el pincel no hace nada.
   */
  maskLayerId?: string | null;
  /**
   * LA SALA cuyo suelo se está repintando (rebanada 9). Manda sobre `maskLayerId` cuando está puesta: el
   * pincel apunta a un sitio o a otro, nunca a los dos.
   */
  maskRoomId?: string | null;
  /**
   * Avisa de sobre QUÉ SALA está el ratón, para que el pincel del suelo sepa a cuál apunta. Sólo se llama
   * cuando la sala CAMBIA —no en cada movimiento— porque despierta a la pantalla entera de la escena.
   *
   * Se manda con el pincel puesto AUNQUE se esté pintando una capa, y no sólo con el suelo elegido: si se
   * callara a ratos, lo que sabe el lienzo y lo que sabe la pantalla se quedarían desparejados y al volver al
   * suelo apuntaría a la sala de antes.
   */
  onHoverRoom?: (roomId: string | null) => void;
  /** `start` marca el primer brochazo de un arrastre: es donde se sortea la forma del borde roto. */
  onPaintMask?: (from: Point, to: Point, start?: boolean) => void;
  onPaintMaskEnd?: () => void;
  /**
   * EL ANCHO DE LA BANDA de «A pulso», en casillas (§ «Rebanada 10 · B»). Arrastrar saca una banda de este
   * ancho SIGUIENDO LA MANO — el gesto que él mandó mudar aquí desde el pincel. Sin él manda el grosor de
   * muro de la escena, así que una escena existente no cambia hasta que él lo toque.
   */
  bandCells?: number;
  /**
   * EL BORDE DE «A PULSO» (§ 10B.4): limpio, como siempre, o roto y cuánto. Cada trazo sortea su semilla al
   * empezar, así que el previo y lo que se guarda al soltar son el mismo canto.
   */
  bandTip?: BandTip;
  bandRoughness?: number;
  /**
   * EL PREVIO DEL AZULEJO DEL PINCEL (rebanada 10). Mientras él arrastra el tamaño de la textura, el mapa
   * ENTERO se cubre con ella en transparencia: «*se debería ver en el mapa cubriendo todo el lienzo para ver
   * el tamaño en previo*» (2026-09-10). Es lo único que deja saber si una losa va a salir del tamaño de una
   * sala antes de dar el primer brochazo. `null` = no se está tocando el tamaño.
   */
  tilePreview?: { url: string; sidePx: number; /** Grados de giro del patrón, como el pincel. */ deg?: number } | null;
  /**
   * ¿HAY DÓNDE PINTAR AHORA MISMO? (rebanada 10). Lo decide la pantalla, que es quien sabe si hay una capa de
   * terreno, si el ratón está sobre una habitación o si el mapa tiene roca. El lienzo sólo necesita saber si
   * el gesto va a servir de algo: sin esto, arrastrar dejaría un rastro que no se guarda en ninguna parte.
   */
  paintReady?: boolean;
  /** La máscara EN VIVO mientras se pinta, antes de que suba. Se pinta en lugar de la guardada. */
  maskPreview?: string | null;
  /**
   * LA PINTURA EN VIVO (rebanada 10), la que se pone ENCIMA. Va aparte de `maskPreview` porque son dos
   * lienzos que hacen lo contrario: aquélla quita para que asome lo de debajo, ésta pone encima.
   */
  paintPreview?: { on: 'room' | 'rock' | 'layer'; id: string; href: string | null } | null;
  /** DM: la luz que se está editando. Es pintura, así que seleccionarla no cambia nada para nadie. */
  selectedLightId?: string | null;
  onSelectLight?: (id: string | null) => void;
  onPin: (p: Point) => void;
  /** Suprimir / Del over the selection (DM). */
  onDeleteSelection?: () => void;
  /** Right-click on empty ground with nothing pending: where to open the quick menu (canvas px + scene point). */
  onContextMenu?: (at: { x: number; y: number }, scene: Point) => void;
  /**
   * DM, botón derecho SOBRE algo: «mándalo a otra capa» (petición literal del dueño). Si el clic cae en el
   * suelo vacío no se llama y sigue mandando `onContextMenu`, que es el menú de la vista.
   */
  onElementMenu?: (at: { x: number; y: number }, element: { kind: ElementKind; id: string; name: string; layerId: string | null }) => void;
  /** Any press on the canvas dismisses whatever popover is open. */
  onCloseMenus?: () => void;
  /** Tokens caught by dragging a box with Seleccionar. */
  onMarquee?: (tokenIds: string[]) => void;
  /** Text tool: the canvas says where, the caller asks what and writes it. */
  onAddText?: (at: Point) => void;
  /** Something is waiting to be dropped on the map (a bestiary entry, a PC): the next click places it. */
  placing?: boolean;
  /** Lo ancho que va a ser el token que se está colocando, para centrarlo bien donde se pulsa. */
  placingSize?: number;
  /** Encounter / PC placement (cell coordinates); only wired while something is pending. */
  onPlace?: (cell: Point) => void;
  selectedTokenIds: string[];
  /**
   * LA SONDA DE PRUEBA (§ 7.3): dónde está, o `null` si no está puesta. Va atada a «ver como jugador». No es
   * una ficha —no se guarda, no la ve nadie, no sale en ninguna lista— y se arrastra con Seleccionar.
   */
  probe?: Point | null;
  onProbeMove?: (at: Point) => void;
  onSelectToken: (id: string | null) => void;
  /**
   * EL CANDADO DE LA REJILLA (§ «Rebanada 8»). Cerrado —lo de siempre, y con lo que arranca— Builder se pega
   * a la rejilla exactamente igual que hasta hoy. Abierto, el gesto va libre y sólo las PUNTAS se pegan a las
   * puntas de otros muros que tengan cerca, para no dejar rendijas por las que se cuele la visión.
   */
  snapGrid?: boolean;
  /**
   * LOS NODOS SON UNA CADENA. Arrastrar una punta se lleva las puntas de los muros que estaban en ese mismo
   * sitio, así que mover un nodo de una sala no la abre. Por omisión SÍ, que es lo que él pidió: «los nodos
   * deberían ser como una cadena a menos que yo elija que no».
   */
  chainNodes?: boolean;
  /**
   * AÑADIR UN NODO por doble clic sobre la línea de un muro. `at` es el punto donde pinchó, en px de escena;
   * quién es el muro y por dónde se parte lo decide el dominio (`mapRules.splitWallAt`).
   */
  onSplitWall?: (id: string, at: Point) => void;
  /** DM, Seleccionar: the segment being edited and its handles. */
  selectedWallId?: string | null;
  onSelectWall?: (id: string | null) => void;
  /** New endpoints after dragging the segment or one of its vertices (already grid-snapped). */
  onMoveWall?: (id: string, at: { x1: number; y1: number; x2: number; y2: number }) => void;
  /**
   * EL GRUPO (§ «EL GRUPO»): los muros cogidos como UNA pieza. Vacío = no hay ninguno cogido.
   *
   * Va aparte de `selectedWallId` a propósito: ese es el muro suelto que se edita por sus puntas, y esto es la
   * pieza entera que se mueve y se estira. Son dos cosas y se ven distinto.
   */
  selectedWallIds?: string[];
  onSelectWalls?: (ids: string[]) => void;
  /** El grupo movido o estirado: los muros con su geometría nueva, para guardarlos de una sola vez. */
  onTransformWalls?: (batch: WallAt[]) => void;
  /** Mover una luz ya puesta. Sin esto una luz se coloca y ya no se despega (dueño, 2026-09-01). */
  onMoveLight?: (id: string, at: Point) => void;
  /**
   * Si se le pinta al DIRECTOR el velo gris de lo no explorado. `false` se lo quita — sólo a él y sólo en su
   * pantalla: no toca la escena, no viaja y un jugador no se entera. Por omisión va puesto, como siempre.
   */
  fogVeil?: boolean;
  /**
   * EL TRAZO ELEGIDO (dueño, 2026-09-02: «los textos líneas formas etc deberían poder seleccionarse y mover
   * y borrarse como cualquier cosa»). Hasta hoy un trazo se ponía y se borraba con la goma, nada más.
   */
  selectedDrawingId?: string | null;
  onSelectDrawing?: (id: string | null) => void;
  /**
   * VARIOS TRAZOS COGIDOS con el área — «*el arrastrar y seleccionar no funciona con las formas simples de
   * líneas, texto, círculo y cuadrado*» (dueño, 2026-09-03). Se mueven juntos y se borran juntos.
   */
  selectedDrawingIds?: string[];
  onSelectDrawings?: (ids: string[]) => void;
  /** Mover VARIOS trazos de una vez: cada uno con sus coordenadas ya desplazadas. */
  onMoveDrawings?: (batch: { id: string; data: Drawing['data'] }[]) => void;
  /** Mover un trazo: sus coordenadas ya desplazadas. Sólo el director (lo manda la RLS, no la pantalla). */
  onMoveDrawing?: (id: string, data: Drawing['data']) => void;
}

type Gesture =
  | { kind: 'pan'; start: Point; origin: View }
  | { kind: 'token'; id: string; start: Point; origin: Point; moved: boolean }
  | { kind: 'draw'; tool: DrawTool; start: Point; points: [number, number][]; last: Point }
  | { kind: 'brush'; op: 'reveal' | 'hide' }
  /** Pincel de transparencia: pinta la máscara de una capa de terreno. `last` encadena el trazo sin lunares. */
  | { kind: 'mask'; last: Point }
  | { kind: 'wallEdit'; id: string; grab: 'a' | 'b' | 'whole'; start: Point; origin: { x1: number; y1: number; x2: number; y2: number }; dbl: boolean }
  /** Arrastrando una luz ya colocada. Se mueve entera: una luz no tiene extremos que agarrar. */
  | { kind: 'lightMove'; id: string; start: Point; origin: Point; moved: boolean }
  /** Arrastrando un trazo. Lleva el desplazamiento, no un origen: cada forma guarda sus puntos a su manera. */
  /** `ids` son TODOS los que se mueven: el que se agarró, y los demás si venía de una selección por área. */
  | { kind: 'drawingMove'; id: string; ids: string[]; start: Point; moved: boolean }
  /** Levantando una sala a rastras: rectángulo y círculo. `start` es la primera esquina, o el centro. */
  | { kind: 'room'; shape: 'rect' | 'circle'; start: Point }
  /** LA RECTA SUELTA: se arrastra y sale UN muro. No es una sala, así que va por el camino de siempre. */
  | { kind: 'line'; start: Point }
  /** Levantando una sala a pulso: los puntos por donde va pasando la mano. */
  | { kind: 'roomFree'; points: Point[] }
  /** A PULSO: se arrastra y sale una BANDA siguiendo la mano, del ancho elegido (§ «Rebanada 10 · B»). */
  | { kind: 'roomBand'; points: Point[]; /** La semilla del borde roto: el previo y lo que se guarda salen iguales (§ 10B.4). */ seed: number }
  /**
   * Moviendo o estirando un GRUPO. Con `handle` a null se mueve entero; con tirador se estira por ese lado.
   * Guarda el marco de partida porque escalar es llevar los muros de un marco a otro, no ir sumando tirones.
   */
  | { kind: 'groupXf'; handle: HandleKey | null; origin: Rect; ids: string[]; start: Point; moved: boolean; wallId: string | null; dbl: boolean }
  /**
   * El área. `porDentro` es el grupo en el que se estaba trabajando al empezar el gesto: dentro de un grupo el
   * área coge de él lo que pilla y no infla al grupo entero, que era lo que te echaba fuera.
   */
  | { kind: 'marquee'; start: Point; last: Point; porDentro: string | null }
  | { kind: 'measure' }
  /** Arrastrando la sonda de prueba. No lleva id: sólo hay una y no es de nadie. */
  | { kind: 'probe' };

type DrawTool = 'stroke' | 'line' | 'rect' | 'circle';
/** Tools whose press opens a gesture, so the open/close disc can wait for the release instead of stealing it. */
const DISC_TOOLS: Tool[] = ['select', 'measure', 'pencil', 'line', 'rect', 'circle'];
/**
 * ZONA MUERTA antes de que arrastrar cuente como arrastrar, en px de pantalla. Un clic normal mueve el ratón
 * uno o dos píxeles, así que sin esto CADA clic sobre un grupo lo empujaba de lado — y encima lo escribía en
 * la base (dueño, 2026-09-03: «*cuando hago click en un segmento de un círculo se mueve hacia un lado*»).
 */
const DEAD_ZONE_PX = 4;
/**
 * Dónde se ve el aro de una luz y su disco de clic. Son las dos herramientas desde las que se puede elegir
 * una: con Luz, desde siempre; con Seleccionar, desde el arreglo del 2026-08-31. Antes el aro sólo se pintaba
 * con Luz, así que con Seleccionar la elegías A CIEGAS —se abría su editor sin que nada en el mapa dijera
 * cuál— y él lo dijo tal cual (2026-09-01): «me debería mostrar algo que la seleccione a cuál seleccione».
 */
const LIGHT_PICK_TOOLS: Tool[] = ['light', 'select'];
/** El radio, EN PÍXELES DE PANTALLA, del disco que se pinta sobre una luz y por el que se la agarra. */
const LIGHT_HANDLE_R = 14;
const DRAW_TOOLS: Record<string, DrawTool> = { pencil: 'stroke', line: 'line', rect: 'rect', circle: 'circle' };
const PIN_MS = 2500;
/** Centésima de casilla: suficiente para que el movimiento se vea libre y no manda 14 decimales por la red. */
const round2 = (v: number): number => Math.round(v * 100) / 100;
/**
 * Cuánto puede acercarse el PINTADO al objetivo por encima de lo que se movió el dedo, en casillas por
 * evento. Es lo que convierte el reenganche tras un borde en un deslizamiento en vez de un salto: a ~60
 * eventos/s son ~20 casillas/s de cierre — invisible en el arrastre normal, suave cuando hay hueco.
 */
const CATCH_UP_CELLS = 0.35;
/** Lo grande que es la sonda de prueba en px de escena. Una ficha normal mide una casilla y media. */
const PROBE_R = 17;
/** Brush paints per second, matching the token drag's `DRAG_HZ_MS` (useScene.ts). */
const PAINT_HZ_MS = 50;
/**
 * Lo mínimo que tiene que moverse la mano para que la BANDA apunte otro punto, en px de PANTALLA (se divide
 * por el zoom). Sin este filtro un arrastre lento deja cientos de puntos en el mismo sitio.
 */
const BAND_STEP_PX = 4;

/** El borde con el que sale la banda de «A pulso» (§ 10B.4): sólo con borde roto; con limpio, el de siempre. */
const bordeDe = (tip: BandTip | undefined, roughness: number | undefined, seed: number): BandEdge | undefined =>
  (tip === 'rough' ? { roughness: roughness ?? DEFAULT_BAND_ROUGHNESS, seed } : undefined);

/**
 * SVG scene canvas: background → grid → (DM veil) → walls → drawings → tokens → UI (measure · pin · brush · selection).
 *
 * Fog is drawn, never decided: `fog` comes from the API, which is the only side that knows every wall
 * (specs/modules/maps/SPEC.md § «Rules & limits»). A player sees black outside their sight, the remembered part
 * dimmed; the DM sees the whole map under a blue veil where nobody has been.
 */
export function MapCanvas(p: Props): JSX.Element {
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement>(null);
  /** La posición LEGAL del arrastre (freno + corrección + disco): lo que se persiste al soltar. */
  const idealDrag = useRef<{ id: string; x: number; y: number } | null>(null);
  /** El `libre` del evento anterior, para medir cuánto se movió el dedo en éste. */
  const lastLibre = useRef<{ x: number; y: number } | null>(null);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [localDrag, setLocalDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [measure, setMeasure] = useState<{ a: Point; b: Point } | null>(null);
  const [wallStart, setWallStart] = useState<Point | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  /** La última sala avisada al padre. En una `ref` porque sólo sirve para no repetir el aviso. */
  const hoverRoom = useRef<string | null>(null);
  const [pinShown, setPinShown] = useState<LivePin | null>(null);
  /** Space held = pan, from ANY tool (the middle button already did this). Panning is a modifier, not a tool. */
  const [spacePan, setSpacePan] = useState(false);
  const [wallDraft, setWallDraft] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  /** Dónde se está viendo el GRUPO mientras se arrastra. Como `wallDraft`: se pinta ya, se guarda al soltar. */
  const [groupDraft, setGroupDraft] = useState<Map<string, WallAt> | null>(null);
  /**
   * EL DOBLE CLIC, detectado a mano. **`e.detail` vale 0 en `pointerdown`** —el contador de clics lo llevan
   * `mousedown`/`click`, no los eventos de puntero—, así que fiarse de él dejaba el doble clic muerto en el
   * navegador aunque el test pasara (dueño, 2026-09-03: «*no funciona EL DOBLE CLICK*»). Se mira que sea el
   * MISMO muro, poco después y sin haber movido la mano.
   */
  const ultimoToque = useRef<{ id: string; t: number; x: number; y: number } | null>(null);
  /** La sala que se está levantando, ya en lados. Se pinta mientras se arrastra y se guarda al soltar. */
  const [roomDraft, setRoomDraft] = useState<RoomSide[]>([]);
  /** Los vértices que lleva puestos el polígono. Se cierra pinchando otra vez sobre el primero. */
  /** Los anillos de la banda mientras se arrastra: el previo de lo que va a quedar (§ «Rebanada 10 · B»). */
  const [bandDraft, setBandDraft] = useState<[number, number][][]>([]);
  /** Dónde se está viendo la luz mientras se arrastra. Igual que `wallDraft`: se pinta ya, se guarda al soltar. */
  const [lightDraft, setLightDraft] = useState<{ id: string; x: number; y: number } | null>(null);
  /** Cuánto se lleva movido el trazo que se arrastra. Se pinta ya; se guarda al soltar. */
  const [drawingDraft, setDrawingDraft] = useState<{ id: string; dx: number; dy: number } | null>(null);
  /** In a ref so the key listener never has to be re-bound as the selection changes. */
  const onDeleteRef = useRef<() => void>(() => {});
  /** COGERLO TODO con Ctrl/Cmd + A. Por referencia, como el borrar: el oyente del teclado se monta una vez. */
  const cogerTodoRef = useRef<() => void>(() => {});
  /** A press that started on the open/close disc, until the pointer moves far enough to make it a drag. */
  const discPress = useRef<{ id: string; at: Point } | null>(null);
  const lastPaint = useRef(0);
  const grid = p.scene.grid.size;
  const dmSight = p.isDm && !p.playerView;
  /**
   * EL CANDADO, resuelto en un sitio y usado por los tres caminos de Builder: el muro que se dibuja, el
   * vértice del polígono y el nodo que se arrastra.
   *
   * Va ABIERTO si nadie dice lo contrario, igual que arranca la escena (dueño, 2026-09-03: «*el pegado a la
   * rejilla debería estar desactivado por defecto*»). Hoy `SceneTab` es el único que lo monta y siempre pasa
   * la prop, así que esto sólo decide en los tests — pero decidir al revés que la app es cómo se cuelan los
   * fallos que nadie ve venir.
   */
  const candado = p.snapGrid ?? false;
  const paso = stepOf(grid, candado);
  /**
   * EL MÍNIMO DE UNA FORMA CERRADA, y ya sólo hay UNO: desde su decisión del 2026-09-04 una sala puede ser tan
   * estrecha como un muro, así que sobra el `minShapeCells` que `SceneTab` pasaba para bajárselo sólo al
   * relleno. Dos mínimos distintos para la misma regla es cómo volvió el fallo la primera vez.
   */
  const minForma = MIN_ROOM_CELLS;
  /** El imán de las puntas se mide en píxeles de PANTALLA: con el mapa alejado no puede tirar de medio mapa. */
  const imán = END_SNAP_PX / p.view.zoom;
  /**
   * `evitar` es la punta que YA está puesta: el imán no puede volver a elegirla, o las dos puntas del gesto
   * acabarían encima de la misma y el muro saldría de largo cero (§ `snapRules.SAME_POINT_PX`).
   */
  const anclar = (q: Point, skipId?: string, evitar?: Point | null): Point => builderPoint(q, grid, candado, p.walls, imán, skipId, evitar);
  /**
   * EL MÍNIMO DE UNA RAYA, y no vale lo mismo en los dos modos: marcando sobre una foto sale un muro de los
   * de siempre (media casilla), y dibujando aquí sale un tabique de relleno, que mide una fracción de casilla.
   * Con el de la foto puesto en los dos, un tabique corto se caía sin decir nada (fallo suyo del 2026-09-04).
   */
  const minRaya = p.builderMode === 'draw' ? MIN_FILL_CELLS : MIN_LINE_CELLS;
  /**
   * La punta con la que sale «A pulso» (§ 10B.4): la de la escena, pero SÓLO dibujando aquí. Sobre una foto cada lado
   * del trazo es un muro suelto y un canto roto dejaría cientos, así que ahí sale siempre limpio. Una sola cuenta
   * para el previo y para lo que se guarda: si no, se vería roto y se guardaría limpio.
   */
  const puntaBanda = p.builderMode === 'draw' ? p.bandTip : undefined;

  /**
   * ADÓNDE VA LO QUE SE ACABA DE DIBUJAR — y aquí es donde conviven las dos maneras de trabajar.
   *
   * · «Sobre una foto» (modo A) → MUROS de los de siempre. No se toca nada: es lo que hace hoy.
   * · «Dibujar aquí» (modo B)   → UNA SALA: se guarda la FORMA, y su contorno es el muro. No se escribe ni
   *   una fila en `maps_walls`, porque el muro de una sala no es un muro marcado (§ «Los muros de una sala
   *   NO son los muros de siempre»).
   *
   * Los lados llegan ya en orden dando la vuelta, así que el anillo es la primera punta de cada uno.
   */
  const commitRoom = (sides: RoomSide[], shape: RoomShapeKind): void => {
    if (!sides.length) { p.onTooSmall?.(candado); return; }
    if (p.builderMode === 'draw' && p.onAddRoomShape) p.onAddRoomShape(shape, ringFromSides(sides));
    else p.onAddRoom?.(sides);
  };
  /**
   * UNA BANDA, ya en anillo. Dibujando aquí es una forma más de las de siempre —así fundirse, cortar la vista
   * y frenar a las fichas vienen ya hechos—; marcando sobre una foto se convierte en los muros de su
   * contorno, que es lo que significa marcar una pared ahí.
   */
  const commitBand = (ring: [number, number][]): void => {
    if (p.builderMode === 'draw' && p.onAddRoomShape) { p.onAddRoomShape('brush', ring); return; }
    p.onAddRoom?.(ring.map(([x, y], i) => {
      const [nx, ny] = ring[(i + 1) % ring.length]!;
      return { x1: x, y1: y, x2: nx, y2: ny };
    }));
  };

  useEffect(() => {
    if (!p.pin) { setPinShown(null); return; }
    setPinShown(p.pin);
    const id = window.setTimeout(() => setPinShown(null), PIN_MS);
    return () => window.clearTimeout(id);
  }, [p.pin]);
  useEffect(() => { if (p.tool !== 'wall') { setWallStart(null); setBandDraft([]); setRoomDraft([]); } if (p.tool !== 'measure') setMeasure(null); }, [p.tool]);
  /** Cambiar de forma a media sala la descarta: los vértices de un polígono no valen para un círculo. */
  useEffect(() => { setBandDraft([]); setRoomDraft([]); setWallStart(null); }, [p.wallShape]);
  useEffect(() => { onDeleteRef.current = () => p.onDeleteSelection?.(); });
  useEffect(() => {
    cogerTodoRef.current = () => {
      if (!dmSight || !p.showWalls || !p.walls.length) return;
      // Se suelta el muro suelto: o se tiene UNO cogido y se editan sus puntas, o se tienen TODOS y se mueven.
      p.onSelectWall?.(null);
      p.onSelectRoomOpening?.(null);
      p.onSelectToken(null);
      p.onSelectLight?.(null);
      p.onSelectDrawing?.(null);
      p.onSelectWalls?.(p.walls.map(w => w.id));
    };
  });
  useEffect(() => {
    /** Never steal the space bar from someone typing a scene name or a text drawing. */
    const typing = (t: EventTarget | null): boolean => {
      const el = t as HTMLElement | null;
      const tag = el?.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable === true;
    };
    /**
     * Nor from a focused control: the space bar is how a keyboard user presses a button, so swallowing it
     * globally would break the whole toolbar, the rail and the dice roller for anyone not using a mouse.
     */
    const onControl = (t: EventTarget | null): boolean =>
      !!(t as HTMLElement | null)?.closest?.('button, a[href], input, select, textarea, summary, [role="button"], [role="menuitem"], [role="menuitemcheckbox"], [role="radio"], [role="tab"], [contenteditable="true"]');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setWallStart(null); setBandDraft([]); setRoomDraft([]); setGesture(null); setLightDraft(null); setMeasure(null); p.onSelectToken(null); p.onSelectWall?.(null); p.onSelectLight?.(null); p.onSelectDrawing?.(null); setDrawingDraft(null); setGroupDraft(null); p.onSelectWalls?.([]); return; }
      if (e.key === ' ' && !typing(e.target) && !onControl(e.target)) { e.preventDefault(); setSpacePan(true); return; } // preventDefault: space scrolls the table otherwise
      if ((e.key === 'Delete' || e.key === 'Backspace') && !typing(e.target)) { e.preventDefault(); onDeleteRef.current(); }
      /**
       * COGERLO TODO — «*no me deja seleccionar todos los nodos*» (dueño, 2026-09-03). Ctrl/Cmd + A coge todos
       * los muros de la escena; desde ahí se mueven y se estiran como un grupo, y Suprimir los borra.
       */
      if ((e.key === 'a' || e.key === 'A') && (e.metaKey || e.ctrlKey) && !typing(e.target)) { e.preventDefault(); cogerTodoRef.current(); }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === ' ') setSpacePan(false); };
    /** Alt-tabbing away with space down would leave the canvas stuck in pan mode. */
    const onBlur = () => setSpacePan(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur); };
  }, [p.onSelectToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const local = useCallback((e: { clientX: number; clientY: number }): Point => {
    const r = svgRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  }, []);
  const toScene = useCallback((e: { clientX: number; clientY: number }): Point => canvasToScene(local(e), p.view), [local, p.view]);
  /**
   * ¿Esta pulsación cae dentro del disco que se PINTA sobre una luz? Es el radio del propio disco
   * (`LIGHT_HANDLE_R`), así que se agarra exactamente lo que se ve — ni más ni menos.
   */
  const grabsLight = (l: { x: number; y: number }, at: Point): boolean =>
    Math.hypot(l.x - at.x, l.y - at.y) <= LIGHT_HANDLE_R / p.view.zoom;

  /**
   * Zoom must be a NATIVE listener with `{ passive: false }`: React registers `wheel` passively, so
   * `preventDefault()` inside `onWheel` is a no-op and the wheel would also scroll the table (`.tb-root`).
   */
  const onViewChange = p.onViewChange;
  const view = p.view;
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handler = (e: globalThis.WheelEvent) => {
      e.preventDefault();
      onViewChange(zoomAt(view, e.deltaY < 0 ? 1.1 : 1 / 1.1, local(e)));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [local, view, onViewChange]);

  const onTokenDown = (tok: Token) => (e: ReactPointerEvent<SVGGElement>) => {
    if (p.tool !== 'select' || e.button !== 0) return;
    e.stopPropagation();
    p.onSelectToken(tok.id);
    // One selection at a time: leaving a segment selected would stack «Segmento» and the token bar on the same
    // spot over the canvas, and Suprimir would delete the segment instead of the token you just picked.
    p.onSelectWall?.(null);
    p.onSelectRoomOpening?.(null);
    p.onSelectLight?.(null);
    p.onSelectDrawing?.(null);
    if (!canMoveToken(tok, p.me, p.isDm)) return;
    svgRef.current?.setPointerCapture?.(e.pointerId);
    setGesture({ kind: 'token', id: tok.id, start: toScene(e), origin: { x: tok.x, y: tok.y }, moved: false });
  };

  const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    p.onCloseMenus?.();
    const s = toScene(e);
    // Panning is a modifier, never a tool: middle button or space bar, from whatever tool is active.
    if (e.button === 1 || (e.button === 0 && spacePan)) {
      setGesture({ kind: 'pan', start: local(e), origin: p.view });
      svgRef.current?.setPointerCapture?.(e.pointerId);
      return;
    }
    // Placing wins over every tool: you already said what goes down, this click only says where.
    // Se coloca CENTRADO donde se pulsa y sin pegarse a la rejilla, igual que se mueve.
    if (e.button === 0 && p.placing && p.onPlace) { p.onPlace(tokenPointAt(s, grid, p.placingSize)); return; }
    if (e.button === 0 && p.tool === 'select') {
      /**
       * La SONDA se agarra antes que nada: es mobiliario del director, se pinta encima de todo y es lo único
       * que hay que poder mover mientras se mira la escena con los ojos de un jugador.
       */
      if (p.probe && Math.hypot(p.probe.x - s.x, p.probe.y - s.y) <= PROBE_R + 4 / p.view.zoom) {
        setGesture({ kind: 'probe' });
        svgRef.current?.setPointerCapture?.(e.pointerId);
        return;
      }
      /**
       * Y SE PONE DONDE ÉL PINCHE (dueño, 2026-09-02: «déjame poner el token donde quiera, no lo pongas
       * automáticamente en el centro, si no la prueba es una mierda»).
       *
       * Antes «ver como jugador» la soltaba en mitad de lo que estuviera mirando, y desde ahí había que
       * arrastrarla — que con el mapa alejado es un viaje. Ahora encender el modo NO la coloca: el primer
       * clic la pone, y cualquier clic posterior en el suelo la muda. Arrastrarla sigue igual: el disco de
       * arriba se queda con la pulsación antes de llegar aquí, así que pinchar SOBRE ella la agarra en vez
       * de moverla a donde ya está.
       *
       * Va después del disco de la sonda y antes de todo lo demás porque en este modo el director no tiene
       * privilegios: no hay muros ni luces que elegir, así que nada más se disputa este clic. Las fichas sí,
       * pero ésas se llevan la pulsación en su propio elemento, antes de llegar al lienzo.
       */
      if (p.playerView && p.onProbeMove) { p.onProbeMove(s); return; }
      /**
       * Una LUZ también se selecciona con Seleccionar (dueño, 2026-08-31: «una vez puesta una luz no me deja
       * seleccionarla nuevamente para editarla»). Antes sólo se podía con la herramienta Luz, y ahí un clic
       * un pelo fuera de su disco COLOCA otra luz en vez de abrir la que querías — así que en la práctica no
       * había forma fiable de volver a una. Va antes que el muro porque es un blanco pequeño y encima de él.
       */
      /**
       * 🐞 …PERO NO SI DEBAJO HAY UN MURO O UN VANO (dueño, 2026-09-07: «*cuando hago click en una puerta me
       * abre el modal de las luces*»).
       *
       * La generosidad de arriba es un CUARTO DEL RADIO de la luz, y el radio de una luz de ambiente grande
       * son cientos de píxeles: dentro de ese círculo la luz se comía el clic de todo lo que hubiera debajo,
       * y una puerta bajo una antorcha no se podía ni elegir ni configurar. Con algo debajo, la luz vuelve a
       * exigir su disco de verdad (12 px), que es lo que se ve; en el vacío sigue perdonando como antes.
       */
      const debajo = dmSight ? (hitWall(p.walls, s, 10 / p.view.zoom) ?? hitWall(p.roomOpenings ?? [], s, 10 / p.view.zoom)) : null;
      const holguraLuz = (l: Light): number =>
        (debajo ? 12 / p.view.zoom : Math.max(12 / p.view.zoom, lightRadiusPx(l, p.scene.grid) * 0.25));
      const light = dmSight ? lightsShown.find(l => Math.hypot(l.x - s.x, l.y - s.y) <= holguraLuz(l)) : null;
      if (light) {
        p.onSelectToken(null);
        p.onSelectWall?.(null);
        p.onSelectRoomOpening?.(null);
        p.onSelectDrawing?.(null);
        p.onSelectLight?.(light.id);
        /**
         * ELEGIR es generoso; AGARRAR exige acertar el disco que se ve.
         *
         * Elegir una luz perdona un clic un poco fuera —una luz es un blanco pequeño y con la herramienta Luz
         * fallar significa COLOCAR otra encima—, y ese margen crece con el tamaño de la luz. Pero arrastrar no
         * puede perdonar tanto: con una luz de nueve metros, ese margen llega lejísimos, y una pulsación en lo
         * que parece suelo vacío la movería sin que nadie entienda por qué. Así que sólo se agarra dentro del
         * disco que de verdad está pintado.
         */
        if (grabsLight(light, s)) {
          setGesture({ kind: 'lightMove', id: light.id, start: s, origin: { x: light.x, y: light.y }, moved: false });
          svgRef.current?.setPointerCapture?.(e.pointerId);
        }
        return;
      }
      /**
       * EL GRUPO, primero de todo: los tiradores se pintan ENCIMA de los muros y tienen que robarles el clic.
       * Si no, agarrar una esquina que cae justo sobre un muro entraría a editar ese muro en vez de estirar.
       */
      const cogidos = p.walls.filter(w => (p.selectedWallIds ?? []).includes(w.id));
      const marco = cogidos.length > 1 ? wallBounds(cogidos) : null;
      if (marco) {
        const k = HANDLE_KEYS.find(h => { const q = handlePoint(marco, h); return Math.hypot(s.x - q.x, s.y - q.y) <= 9 / p.view.zoom; });
        if (k) {
          setGesture({ kind: 'groupXf', handle: k, origin: marco, ids: cogidos.map(w => w.id), start: s, moved: false, wallId: null, dbl: false });
          svgRef.current?.setPointerCapture?.(e.pointerId);
          return;
        }
      }
      // Seleccionar: pick a segment (DM only) and grab it, or clear everything.
      const wall = dmSight ? hitWall(p.walls, s, 10 / p.view.zoom) : null;
      if (wall) {
        /**
         * UN CLIC COGE EL GRUPO ENTERO; el DOBLE CLIC entra dentro y ya coge el muro suelto. Es literalmente lo
         * que pidió el 2026-09-03: «*debería poder seleccionarlo entero y luego con doble clic por pedacitos,
         * si no, cuando esté en medio de otras cosas no se podrá mover*».
         */
        const grupo = groupOf(p.walls, wall);
        /**
         * OJO: YA ESTOY DENTRO. Si se entró con doble clic, el clic es para EDITAR: agarrar una punta y moverla.
         * Sin esto, `groupOf` volvía a devolver el grupo entero y cada clic te sacaba fuera otra vez, así que
         * las puntas no había forma de cogerlas (dueño, 2026-09-03: «*no puedo seleccionar los nodos*»).
         *
         * CLAVE: DENTRO ES DEL GRUPO, NO DEL MURO (dueño, 2026-09-03: «*si selecciono un nodo y quiero seleccionar
         * otro tengo que volver a hacer doble click, eso está mal*»). Mirando sólo si el muro elegido era ESTE
         * muro, pasar al de al lado —del mismo grupo— te echaba fuera y había que volver a entrar. Basta con
         * que el muro elegido pertenezca a este grupo: se sale pinchando algo de FUERA del grupo, o el vacío.
         */
        const dentro = insideGroup(grupo, p.selectedWallId ?? null, p.selectedWallIds ?? []);
        /**
         * ¿DOBLE CLIC? Se decide aquí arriba y vale para los dos caminos, porque el doble clic hace dos cosas
         * distintas según dónde estés — y así lo eligió el dueño (2026-09-03, «primero entra, luego el nodo»):
         *
         * · sobre un muro de un GRUPO en el que aún no has entrado → ENTRA al muro suelto, como hasta ahora;
         * · sobre un muro suelto, o sobre el que ya tienes cogido dentro del grupo → AÑADE UN NODO ahí.
         *
         * Se mira el reloj además de `e.detail` porque el navegador no cuenta como doble un clic que cambia de
         * elemento por medio, y aquí el primero de los dos suele cambiar la selección.
         */
        const ahora = Date.now();
        const previo = ultimoToque.current;
        const doble = e.detail >= 2 || (!!previo && previo.id === wall.id && ahora - previo.t < 400
          && Math.hypot(s.x - previo.x, s.y - previo.y) <= 8 / p.view.zoom);
        ultimoToque.current = { id: wall.id, t: ahora, x: s.x, y: s.y };
        if (grupo.length > 1 && !dentro) {
          /**
           * OJO: ARRASTRAR SIEMPRE MUEVE; el doble clic sólo entra SI NO SE ARRASTRA — se decide al soltar, no
           * aquí (dueño, 2026-09-03: «*puedo seleccionar el círculo, puedo escalarlo y modificarlo pero no
           * moverlo*»). Antes se miraba `e.detail` en la pulsación, y como el segundo clic de un arrastre
           * cuenta como doble, ir a mover el grupo entraba al muro suelto en vez de moverlo.
           */
          if (!grupo.every(g => (p.selectedWallIds ?? []).includes(g.id))) {
            p.onSelectToken(null);
            p.onSelectLight?.(null);
            p.onSelectDrawing?.(null);
            p.onSelectWall?.(null);
            p.onSelectRoomOpening?.(null);
            p.onSelectWalls?.(grupo.map(g => g.id));
          }
          // Los ids van DENTRO del gesto: si dependiera de la prop, el primer arrastre tras elegir movería
          // la selección vieja, que en ese instante todavía está vacía.
          setGesture({ kind: 'groupXf', handle: null, origin: wallBounds(grupo)!, ids: grupo.map(g => g.id), start: s, moved: false, wallId: wall.id, dbl: doble });
          svgRef.current?.setPointerCapture?.(e.pointerId);
          return;
        }
        p.onSelectWalls?.([]);
        p.onSelectToken(null);
        // Suelta la luz y el trazo: si no, quedaría algo elegido sin verse y Suprimir se confundiría de víctima.
        p.onSelectLight?.(null);
        p.onSelectDrawing?.(null);
        p.onSelectWall?.(wall.id);
        p.onSelectRoomOpening?.(null);
        const near = (x: number, y: number) => Math.hypot(s.x - x, s.y - y) <= 12 / p.view.zoom;
        const grab = near(wall.x1, wall.y1) ? 'a' : near(wall.x2, wall.y2) ? 'b' : 'whole';
        setGesture({ kind: 'wallEdit', id: wall.id, grab, start: s, origin: { x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 }, dbl: doble });
        svgRef.current?.setPointerCapture?.(e.pointerId);
        return;
      }
      /**
       * UN VANO DE SALA. Después del muro y antes del trazo: es igual de fino y se coge con la misma
       * tolerancia, pero NO se arrastra — su sitio es el tramo anotado sobre el contorno, y se mueve
       * moviendo la forma. Cogerlo es lo que abre su panel, y con él la papelera que hasta hoy no existía.
       */
      const opening = dmSight ? hitWall(p.roomOpenings ?? [], s, 10 / p.view.zoom) : null;
      if (opening) {
        p.onSelectToken(null);
        p.onSelectWall?.(null);
        p.onSelectWalls?.([]);
        p.onSelectLight?.(null);
        p.onSelectDrawing?.(null);
        p.onSelectRoomOpening?.(opening.id);
        return;
      }
      /**
       * Y por último el TRAZO (dueño, 2026-09-02: «los textos líneas formas etc deberían poder seleccionarse
       * y mover y borrarse como cualquier cosa»). Va el ÚLTIMO de todos a propósito, que es el mismo orden en
       * el que se pinta: un trazo grande debajo de una ficha, de una luz o de un muro no puede robarles el
       * clic. Se elige con la tolerancia de la goma, que ya estaba afinada para acertarle a una línea fina.
       */
      const drawing = hitTest(drawingsShown, s, 6 / p.view.zoom);
      if (drawing) {
        p.onSelectToken(null);
        p.onSelectWall?.(null);
        p.onSelectRoomOpening?.(null);
        p.onSelectLight?.(null);
        /**
         * Si el trazo es UNO DE LOS COGIDOS por el área, la selección no se toca y se mueven TODOS: agarrar
         * uno de un puñado para moverlo es lo que uno espera, y soltar los demás por tocar uno sería perder
         * el trabajo de haberlos cogido. Pinchando cualquier otro, se coge ése y sólo ése, como siempre.
         */
        const cogidos = p.selectedDrawingIds ?? [];
        const enGrupo = cogidos.length > 1 && cogidos.includes(drawing.id);
        if (!enGrupo) { p.onSelectDrawings?.([]); p.onSelectDrawing?.(drawing.id); }
        // Arrastrar es del director, como manda la RLS de `maps_drawings`. Un jugador lo elige y lo ve, nada más.
        if (canMoveDrawing(drawing, p.me, p.isDm)) {
          const ids = enGrupo ? cogidos.filter(id => drawingsShown.some(x => x.id === id)) : [drawing.id];
          setGesture({ kind: 'drawingMove', id: drawing.id, ids, start: s, moved: false });
          svgRef.current?.setPointerCapture?.(e.pointerId);
        }
        return;
      }
      p.onSelectToken(null);
      p.onSelectWall?.(null);
      p.onSelectRoomOpening?.(null);
      // Pinchar en vacío suelta TODO, la luz, el trazo y el grupo: es la forma de soltar sin buscar una X.
      p.onSelectLight?.(null);
      p.onSelectDrawing?.(null);
      p.onSelectDrawings?.([]);
      p.onSelectWalls?.([]);
      // Se apunta ANTES de soltar la selección: al levantar el dedo ya no habría de dónde saberlo.
      setGesture({ kind: 'marquee', start: s, last: s, porDentro: groupInsideOf(p.walls, p.selectedWallId ?? null, p.selectedWallIds ?? []) });
      svgRef.current?.setPointerCapture?.(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const draw = DRAW_TOOLS[p.tool];
    if (draw) { setGesture({ kind: 'draw', tool: draw, start: s, points: [[s.x, s.y]], last: s }); svgRef.current?.setPointerCapture?.(e.pointerId); return; }
    switch (p.tool) {
      case 'text': p.onAddText?.(s); return;
      case 'measure': setMeasure({ a: s, b: s }); setGesture({ kind: 'measure' }); svgRef.current?.setPointerCapture?.(e.pointerId); return;
      case 'pin': p.onPin(s); return;
      /**
       * Colocar una luz es un clic y ya: no arrastra, no encadena y no toca la niebla — es pintura. Si el
       * clic cae sobre una luz que ya existe, la SELECCIONA en vez de apilar otra encima, que es lo que
       * pasaría si no se mirase antes.
       */
      case 'light': {
        if (!dmSight) return;
        const hit = lightsShown.find(l => Math.hypot(l.x - s.x, l.y - s.y) <= Math.max(12 / p.view.zoom, lightRadiusPx(l, p.scene.grid) * 0.25));
        if (hit) {
          p.onSelectLight?.(hit.id);
          if (grabsLight(hit, s)) {
            setGesture({ kind: 'lightMove', id: hit.id, start: s, origin: { x: hit.x, y: hit.y }, moved: false });
            svgRef.current?.setPointerCapture?.(e.pointerId);
          }
          return;
        }
        p.onPlaceLight?.(s);
        return;
      }
      case 'erase': { const hit = hitTest(p.drawings, s, 6 / p.view.zoom); if (hit && canEraseDrawing(hit, p.me, p.isDm)) p.onErase(hit.id); return; }
      case 'wall': {
        if (!dmSight) return;
        const shape = p.wallShape ?? 'segment';
        // Rectángulo y círculo se arrastran: la sala se ve crecer y se guarda al soltar.
        if (isDragShape(shape)) {
          setGesture({ kind: 'room', shape, start: s });
          svgRef.current?.setPointerCapture?.(e.pointerId);
          return;
        }
        /**
         * LA RECTA SUELTA: se arrastra de un punto a otro y sale UN muro. Va por `onAddWall`, el camino de
         * siempre, y no por el de las salas: así una puerta o una ventana dibujada de un tirón sobre un muro
         * lo sigue partiendo con `planOpening`, exactamente igual que con el Builder clic a clic.
         */
        if (isLineShape(shape)) {
          setGesture({ kind: 'line', start: anclar(s) });
          svgRef.current?.setPointerCapture?.(e.pointerId);
          return;
        }
        /*
         * ── A PULSO: LA BANDA (§ «Rebanada 10 · B») ──
         * Se arrastra y sale una banda del ancho elegido SIGUIENDO LA MANO. Es exactamente el gesto del
         * pincel que se construyó por error y que él mandó mudar aquí, con la pantalla delante: «*lo que
         * habías hecho en el otro chat para el pincel estaba mal, pero en el builder me servía*».
         */
        if (shape === 'free') {
          // La semilla del borde roto se sortea aquí, al empezar: cada trazo sale distinto (§ 10B.4).
          const seed = Math.floor(Math.random() * 2 ** 31);
          setGesture({ kind: 'roomBand', points: [s], seed });
          setBandDraft(brushRings([s], p.bandCells ?? p.scene.wallThickness, grid, bordeDe(puntaBanda, p.bandRoughness, seed)));
          svgRef.current?.setPointerCapture?.(e.pointerId);
          return;
        }
        /*
         * ── POLÍGONO: EL TRAZO LIBRE CERRADO ──
         * Es lo que hasta hoy hacía «a pulso», movido aquí por orden suya del 2026-09-10: «*quiero que lo que
         * hoy es a pulso lo pongas en polígono, y a pulso sea lo que te indico*». Se arrastra y la forma sale
         * con el contorno de la mano.
         */
        if (shape === 'poly') {
          setGesture({ kind: 'roomFree', points: [s] });
          svgRef.current?.setPointerCapture?.(e.pointerId);
          return;
        }
        // Muro only BUILDS. Opening a door is the hover disc's job, which is what unblocks starting a wall next
        // to a door — that click used to open it instead (specs/modules/maps/SPEC.md § «Rebanada 3»).
        const q = anclar(s, undefined, wallStart);
        if (wallStart) {
          p.onAddWall(wallStart, q);
          /**
           * UNA PUERTA O UNA VENTANA ES UN SOLO TRAMO: encadenar dejaría caer otra donde nadie la pidió.
           *
           * Y hay que mirar la clase QUE SE ESTÁ COLOCANDO, no siempre `wallKind`. En el constructor de salas
           * la clase es `buildKind`; mirando sólo `wallKind` —que allí sigue valiendo «muro»— la puerta de
           * sala SÍ encadenaba, y salía una segunda pegada a la primera (suyo, 2026-09-07).
           */
          const colocando = p.builderMode === 'draw' ? p.buildKind : p.wallKind;
          setWallStart(colocando && colocando !== 'wall' ? null : q);
          return;
        }
        setWallStart(q);
        return;
      }
      case 'mask': {
        if (!dmSight) return;
        /*
         * 🔴 AQUÍ YA NO SE LEVANTA MAPA. Hasta el 2026-09-10 este gesto excavaba y rellenaba, y él lo paró en
         * pantalla: «*eso es cavar con construir, que no es lo que te pedí*». Aquello se mudó al Builder, y
         * este pincel hace lo único que hace: PINTAR ENCIMA. Ni toca una fila de sala, ni de muro, ni de luz.
         */
        if (!p.paintReady) return;
        p.onPaintMask?.(s, s, true);
        setGesture({ kind: 'mask', last: s });
        svgRef.current?.setPointerCapture?.(e.pointerId);
        return;
      }
      case 'reveal':
      case 'hide': {
        if (!dmSight) return;
        const op = p.tool === 'reveal' ? 'reveal' : 'hide';
        p.onPaintFog({ ...s, radius: brushRadius(p.brush, grid) }, op, true);
        setGesture({ kind: 'brush', op });
        svgRef.current?.setPointerCapture?.(e.pointerId);
        return;
      }

      default: return;
    }
  };

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const s = toScene(e);
    setHover(s);
    /*
     * SOBRE QUÉ SALA ESTÁ EL PINCEL DEL SUELO (rebanada 9). Se avisa al MOVERSE y no al pulsar porque quien
     * escucha guarda la sala en estado de React: decidirla en el `pointerdown` llegaría un render tarde y el
     * primer brochazo caería en la sala anterior. Al pulsar, el ratón ya ha pasado por aquí.
     *
     * Y sólo cuando CAMBIA de sala: esto despierta a la pantalla entera de la escena, y hacerlo en cada
     * píxel del movimiento sería la clase de goteo que él nota como «va lentísimo».
     *
     * 🐞 Y NO MIENTRAS SE PINTA. Una pincelada, una sala: la que había al apoyar. El spec invita a barrer el
     * pincel «*por encima del muro sin mancharlo*» (§ 9.3), y el muro se dibuja SOBRE el contorno, así que
     * media franja cae fuera de la sala. Sin este freno, ese mismo gesto sacaba el ratón del contorno, se
     * avisaba de otra sala —o de ninguna—, el destino del pincel cambiaba a media pincelada y quien escucha
     * rehacía su lienzo: la pincelada entera se perdía sin decir nada, y si al otro lado había otra sala, el
     * resto del trazo caía en ella. El recorte protege los píxeles; esto protege el destino.
     */
    // 🐞 …y tampoco mientras se construye o se borra (rebanada 10): son gestos del mismo pincel y avisar a
    // media pincelada despierta a la pantalla entera de la escena por nada.
    if (p.tool === 'mask' && dmSight && p.onHoverRoom && gesture?.kind !== 'mask') {
      const id = roomAt(rooms, s)?.id ?? null;
      if (id !== hoverRoom.current) { hoverRoom.current = id; p.onHoverRoom(id); }
    }
    // Past a few px the press is a DRAG, and a drag belongs to the tool (moving the segment, drawing a stroke),
    // never to the disc. This is what keeps Seleccionar able to grab a one-cell door the disc sits right on top of.
    if (discPress.current && Math.hypot(s.x - discPress.current.at.x, s.y - discPress.current.at.y) > 4 / p.view.zoom) discPress.current = null;
    if (!gesture) return;
    if (gesture.kind === 'probe') { p.onProbeMove?.(p.probe ? slideToken(p.probe, s, PROBE_R, probeBlockers) : s); return; }
    if (gesture.kind === 'pan') {
      const l = local(e);
      p.onViewChange({ ...gesture.origin, panX: gesture.origin.panX + l.x - gesture.start.x, panY: gesture.origin.panY + l.y - gesture.start.y });
    } else if (gesture.kind === 'token') {
      const libre = { x: gesture.origin.x + (s.x - gesture.start.x) / grid, y: gesture.origin.y + (s.y - gesture.start.y) / grid };
      /**
       * Paredes sólidas (rebanada 4): el token no atraviesa un muro, y al topar RESBALA pegado a él.
       *
       * Se calcula sobre CENTROS y en px de escena, que es donde viven los muros; `localDrag` va en casillas,
       * así que se entra y se sale por `tokenCenter` / `tokenPointAt`. El director NUNCA choca, esté el
       * interruptor como esté (decisión del dueño), y con el interruptor apagado `blockers` está vacío y esto
       * no cambia ni un píxel de lo de antes.
       *
       * Esto es el freno PROVISIONAL, con los muros que este navegador conoce: a un jugador no le llegan los
       * muros secretos, así que la palabra final es del servidor al soltar (spec § «Rebanada 4»).
       */
      const dragged = p.tokens.find(tk => tk.id === gesture.id);
      /**
       * El freno local barre desde DONDE ESTÁ el token, no desde donde empezó el arrastre: anclado al
       * origen, pasada la esquina de un muro la recta origen→dedo seguía cruzándolo y el token no podía
       * doblarla. Barrer paso a paso desde la posición actual es lo que hace que el resbalón pivote solo.
       *
       * Y «donde está» es lo LEGAL del evento anterior (`idealDrag`), NUNCA el pintado suavizado: la
       * persecución del pintado corta esquinas, y si entra a menos del radio de un muro visible, barrer
       * desde ahí dispara la válvula «ya estabas dentro» de `slideCircle` y apaga el freno local. La física
       * no lee la pintura — la separación va en un solo sentido.
       */
      const ideal = idealDrag.current && idealDrag.current.id === gesture.id ? idealDrag.current : null;
      const current = ideal ?? (localDrag && localDrag.id === gesture.id ? { x: localDrag.x, y: localDrag.y } : gesture.origin);
      const frenado = blockers.length > 0 && dragged
        ? tokenPointAt(
            slideToken(tokenCenter({ ...current, size: dragged.size }, grid), tokenCenter({ ...libre, size: dragged.size }, grid), tokenRadiusPx(dragged, grid), blockers),
            grid, dragged.size)
        : libre;
      /**
       * Y por encima de todo manda el SERVIDOR: si contesta una corrección, se obedece, sin condiciones.
       *
       * SIN CONDICIONES es la parte importante, y me costó un fallo verlo: a un jugador **no le llegan los
       * muros secretos** (RLS), y en una escena normal NINGÚN muro es visible — probado en la app, 16 de 16
       * ocultos. O sea que su `blockers` está vacío y su freno propio no salta nunca. Yo había puesto que la
       * corrección sólo se aplicara si el navegador ya había frenado por su cuenta: justo al revés de lo que
       * hace falta, y el token atravesaba las paredes en la app aunque los tests pasaran.
       *
       * El servidor sólo contesta cuando de verdad ha recortado algo, así que si hay respuesta, hay muro.
       *
       * Y al servidor se le pregunta SIEMPRE por `libre` —el deseo del dedo—, nunca por la posición ya
       * corregida: por eso `onDragToken` lleva `libre` aparte de `x`/`y`. Si se le preguntara por la posición
       * corregida, la vería caber —la recortó él—, callaría por la regla de arriba, la corrección se borraría
       * y el tick siguiente volvería a `frenado`, que sin muros visibles es `libre`: el token oscilaba a
       * través del muro ~7 veces por segundo, y soltando en el tick malo se quedaba al otro lado.
       */
      const server = p.onServerCorrection?.(gesture.id) ?? null;
      let { x, y } = server ?? frenado;
      /**
       * Y NUNCA más allá del disco libre que el servidor confirmó: a este navegador no le llegan los muros
       * secretos, así que entre respuesta y respuesta el token seguía al dedo a ciegas, se metía en el muro y
       * al llegar la corrección rebotaba hacia atrás. El disco es convexo: todo lo que se pinte dentro es
       * legal entero. Sin dato (sin física, director, primer instante) no se recorta nada.
       */
      const bound = p.onDragBound?.(gesture.id) ?? null;
      /**
       * 🐞 PERO UN DISCO DE RADIO CERO NO ENCIERRA A NADIE (suyo, 2026-09-07: «*cuando un token está en una
       * esquina se queda pegado, hay que soltarlo y cogerlo de nuevo*»).
       *
       * `circleClearance` deja el disco en CERO en cuanto el cuerpo queda pegado a un muro — y `slideCircle`
       * aparca justo ahí a propósito, a `SLIDE_GAP` de la pared. O sea que **cualquier frenazo** dejaba el
       * disco a cero. Contra una pared aún se avanzaba a tirones (cada respuesta del servidor concedía un
       * resbalón), pero en una ESQUINA `slideCircle` devolvía entonces el mismo punto, y el disco se quedaba
       * en cero para siempre: el token no se movía ni tirando hacia el hueco abierto. Sólo soltar y volver a
       * cogerlo lo desatascaba, porque eso borra el disco.
       *
       * (Aquello de que en una esquina `slideCircle` no supiera resbalar era a su vez un fallo suyo, el del
       * desempate entre los dos muros del vértice, arreglado el 2026-09-08 en `@rolvium/core`. Esta salida
       * SIGUE HACIENDO FALTA igual: el disco se pone a cero con cualquier frenazo, resbale o no.)
       *
       * ⚖️ PERO SÓLO SE SUELTA SI ESTE NAVEGADOR TIENE FÍSICA PROPIA A LA QUE CAER. Con el disco a cero se
       * pinta `server ?? frenado`, y `frenado` sólo frena contra los muros que este navegador VE. Un JUGADOR
       * en una escena normal no ve NINGUNO —son secretos por RLS: 16 de 16 ocultos, comprobado en la app—,
       * así que para él `frenado` es el dedo a pelo, y soltar ahí le dejaría cruzar una pared que no ve:
       * exactamente el fallo del 2026-08-22 que motivó el disco. Y no haría falta ni mala fe, porque
       * «pegado a una pared moviéndose en paralelo» deja el disco a cero en CADA tick, no sólo en la esquina.
       *
       * Con `blockers.length > 0` la excepción vale sólo donde hay a qué caer. La esquina suya —el contorno
       * de una sala, que se dibuja en el navegador— entra de lleno; el jugador ciego se queda como estaba, y
       * ahí no se cambia nada.
       */
      if (bound && (bound.clearance > 1e-6 || blockers.length === 0)) {
        const dx = x - bound.x, dy = y - bound.y, d = Math.hypot(dx, dy);
        if (d > bound.clearance) {
          const k = bound.clearance / d;
          x = bound.x + dx * k; y = bound.y + dy * k;
        }
      }
      // Hasta aquí, lo LEGAL. Lo que sigue es sólo pintura: al soltar se persiste esto, no lo suavizado.
      idealDrag.current = { id: gesture.id, x, y };
      /**
       * Y el pintado se ACERCA en vez de teletransportarse. Al rozar el borde de una puerta o ventana el
       * token se engancha un instante mientras el dedo sigue; al liberarse el camino, el hueco entre ambos
       * se cerraba de golpe — «un salto hacia adelante» (dueño, 2026-08-22). Ahora cada evento cierra el
       * hueco lo que se movió el dedo más `CATCH_UP_CELLS`: sin hueco el arrastre sigue 1:1 exacto, y el
       * reenganche es un deslizamiento proporcional al ratón. El primer movimiento del gesto no se capa
       * (no hay hueco que cerrar, y una corrección tardía del arrastre anterior no debe alargarse).
       */
      const prev = localDrag && localDrag.id === gesture.id ? localDrag : gesture.origin;
      const fingerMove = gesture.moved && lastLibre.current ? Math.hypot(libre.x - lastLibre.current.x, libre.y - lastLibre.current.y) : Infinity;
      lastLibre.current = libre;
      const gap = Math.hypot(x - prev.x, y - prev.y);
      const maxStep = fingerMove + CATCH_UP_CELLS;
      if (gap > maxStep) {
        const k = maxStep / gap;
        x = prev.x + (x - prev.x) * k; y = prev.y + (y - prev.y) * k;
      }
      setLocalDrag({ id: gesture.id, x, y });
      if (!gesture.moved) setGesture({ ...gesture, moved: true });
      p.onDragToken(gesture.id, x, y, libre);
    } else if (gesture.kind === 'draw') {
      setGesture(gesture.tool === 'stroke' ? { ...gesture, points: [...gesture.points, [s.x, s.y]], last: s } : { ...gesture, last: s });
    } else if (gesture.kind === 'marquee') {
      setGesture({ ...gesture, last: s });
    } else if (gesture.kind === 'line') {
      // Se pinta con el mismo borrador que las salas: es un lado, y un lado ya sabe dibujarse.
      const side = lineSide(gesture.start, anclar(s, undefined, gesture.start), grid, minRaya);
      setRoomDraft(side ? [side] : []);
    } else if (gesture.kind === 'room') {
      setRoomDraft(roomSides(gesture.shape, gesture.start, s, grid, paso, minForma));
    } else if (gesture.kind === 'roomFree') {
      const points = [...gesture.points, s];
      setGesture({ ...gesture, points });
      setRoomDraft(freehandSides(points, grid, minForma));
    } else if (gesture.kind === 'roomBand') {
      /*
       * Se guarda un punto sólo cuando la mano se ha MOVIDO de verdad. Sin este filtro un arrastre lento deja
       * cientos de puntos pegados en el mismo sitio y el anillo se recalcula en cada uno; el motor los
       * volvería a quitar igual (`brushRings` limpia el trazo antes de engordarlo).
       */
      const ultimo = gesture.points[gesture.points.length - 1]!;
      if (Math.hypot(s.x - ultimo.x, s.y - ultimo.y) < BAND_STEP_PX / p.view.zoom) return;
      const points = [...gesture.points, s];
      setGesture({ ...gesture, points });
      setBandDraft(brushRings(points, p.bandCells ?? p.scene.wallThickness, grid, bordeDe(puntaBanda, p.bandRoughness, gesture.seed)));
    } else if (gesture.kind === 'groupXf') {
      // Hasta salir de la zona muerta esto es un CLIC, no un arrastre: ni se pinta ni se guarda nada.
      if (gesture.moved || Math.hypot(s.x - gesture.start.x, s.y - gesture.start.y) > DEAD_ZONE_PX / p.view.zoom) {
        const sel = p.walls.filter(w => gesture.ids.includes(w.id));
        const batch = gesture.handle
          ? scaleWallsTo(sel, gesture.origin, resizeRect(gesture.origin, gesture.handle, s))
          : moveWalls(sel, s.x - gesture.start.x, s.y - gesture.start.y);
        setGroupDraft(new Map(batch.map(b => [b.id, b])));
        if (!gesture.moved) setGesture({ ...gesture, moved: true });
      }
    } else if (gesture.kind === 'wallEdit') {
      // El candado manda también aquí: cerrado, a la rejilla como siempre; abierto, libre y con la punta
      // pegándose a la de otro muro cercano. El propio muro queda fuera del imán o se pegaría a sí mismo.
      const suelto = wallDragTo(gesture.origin, gesture.grab, gesture.start, s, grid, paso);
      const at = candado ? suelto : anchorEnd(suelto, gesture.grab, p.walls, imán, gesture.id);
      setWallDraft(at);
      // LA CADENA: las puntas que estaban en el mismo sitio se van con ésta, así que la figura no se abre.
      const cadena = p.chainNodes === false ? [] : chainWalls(p.walls, gesture.id, gesture.origin, at, gesture.grab);
      setGroupDraft(cadena.length ? new Map(cadena.map(c => [c.id, c])) : null);
    } else if (gesture.kind === 'drawingMove') {
      setDrawingDraft({ id: gesture.id, dx: s.x - gesture.start.x, dy: s.y - gesture.start.y });
      if (!gesture.moved) setGesture({ ...gesture, moved: true });
    } else if (gesture.kind === 'lightMove') {
      // Libre, sin pegarse a la rejilla: una luz no ocupa casilla, y él ya pidió que arrastrar no dependa de
      // la grilla (2026-08-21, sobre las fichas). Se pinta al momento; el guardado espera a que suelte.
      setLightDraft({ id: gesture.id, x: gesture.origin.x + (s.x - gesture.start.x), y: gesture.origin.y + (s.y - gesture.start.y) });
      if (!gesture.moved) setGesture({ ...gesture, moved: true });
    } else if (gesture.kind === 'brush') {
      // Same rate limit as the token drag: every call is a round trip that rewrites the fog row of EVERY player
      // and wakes the whole table through `fog.updated`. One per pointermove would be ~60 a second.
      const now = Date.now();
      if (now - lastPaint.current >= PAINT_HZ_MS) { lastPaint.current = now; p.onPaintFog({ ...s, radius: brushRadius(p.brush, grid) }, gesture.op); }
    } else if (gesture.kind === 'mask') {
      // Sin límite de ritmo: esto pinta en un lienzo del propio navegador. Lo que cuesta —subir el PNG— pasa
      // UNA vez al soltar, no en cada movimiento.
      p.onPaintMask?.(gesture.last, s);
      setGesture({ kind: 'mask', last: s });
    } else if (gesture.kind === 'measure' && measure) {
      setMeasure({ a: measure.a, b: s });
    }
  };

  /**
   * Qué hay bajo el puntero, mirando de arriba abajo igual que se pinta: primero las fichas, luego las luces
   * y por último los trazos. Sin este orden, un trazo grande debajo de una ficha se llevaría el clic.
   */
  const elementAt = (s: Point): { kind: ElementKind; id: string; name: string; layerId: string | null } | null => {
    const tk = [...tokensShown].reverse().find(t => {
      const c = tokenCenter(t, grid);
      return Math.hypot(c.x - s.x, c.y - s.y) <= tokenRadiusPx(t, grid);
    });
    if (tk) return { kind: 'token', id: tk.id, name: tk.name, layerId: tk.layerId };
    const li = [...lightsShown].reverse().find(l => Math.hypot(l.x - s.x, l.y - s.y) <= Math.max(12 / p.view.zoom, lightRadiusPx(l, p.scene.grid) * 0.25));
    if (li) return { kind: 'light', id: li.id, name: '', layerId: li.layerId };
    const d = hitTest(drawingsShown, s, 6 / p.view.zoom);
    if (d) return { kind: 'drawing', id: d.id, name: '', layerId: d.layerId };
    return null;
  };

  /**
   * Right button: first it ends whatever is half-drawn (a chained wall, a measure) — same job as Escape, but
   * without moving your hand. On empty ground with nothing pending it opens the quick menu instead.
   */
  const onRightClick = (e: ReactPointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (wallStart || measure || gesture || bandDraft.length) { setWallStart(null); setBandDraft([]); setRoomDraft([]); setMeasure(null); setGesture(null); setLightDraft(null); setDrawingDraft(null); return; }
    // Sobre algo, el menú es de ESE algo; en el suelo vacío, el de la vista. Sólo el director mueve capas.
    const s = toScene(e);
    const el = dmSight ? elementAt(s) : null;
    if (el) { p.onElementMenu?.(local(e), el); return; }
    p.onContextMenu?.(local(e), s);
  };

  const onUp = () => {
    const press = discPress.current;
    discPress.current = null;
    if (press) {
      const w = p.walls.find(x => x.id === press.id);
      if (w) p.onToggleWall(w);
      else {
        const o = (p.roomOpenings ?? []).find(x => x.id === press.id);
        if (o) p.onToggleRoomOpening?.(o);
      }
    }
    if (!gesture) return;
    // La sonda no guarda nada al soltar: no es una ficha. Sólo se deja de arrastrar.
    if (gesture.kind === 'probe') { setGesture(null); return; }
    // El PNG de la máscara sube UNA vez, al soltar: un guardado por pincelada, no cien.
    if (gesture.kind === 'mask') { setGesture(null); p.onPaintMaskEnd?.(); return; }
    // La sala se escribe al soltar, no mientras se arrastra: si no, cada píxel del gesto sería una escritura.
    if (gesture.kind === 'room') {
      commitRoom(roomSides(gesture.shape, gesture.start, hover ?? gesture.start, grid, paso, minForma), gesture.shape);
      setRoomDraft([]); setGesture(null); return;
    }
    if (gesture.kind === 'roomFree') {
      commitRoom(freehandSides(gesture.points, grid, minForma), 'free');
      setRoomDraft([]); setGesture(null); return;
    }
    if (gesture.kind === 'roomBand') {
      /*
       * Un brochazo puede salir PARTIDO en varias piezas —cuando el trazo dobla más cerrado que su propio
       * ancho— y se guardan todas: se solapan en el codo y el motor de salas las funde, que es lo que evita
       * un agujero de roca en medio de la banda. Un toque sin arrastre es un disco, como en cualquier
       * programa de dibujo: `brushRings` ya lo resuelve con un solo punto.
       */
      const anillos = brushRings(gesture.points, p.bandCells ?? p.scene.wallThickness, grid, bordeDe(puntaBanda, p.bandRoughness, gesture.seed));
      setBandDraft([]); setGesture(null);
      if (!anillos.length) { p.onTooSmall?.(candado); return; }
      for (const anillo of anillos) commitBand(anillo);
      return;
    }
    if (gesture.kind === 'line') {
      const side = lineSide(gesture.start, hover ? anclar(hover, undefined, gesture.start) : gesture.start, grid, minRaya);
      if (side) p.onAddWall({ x: side.x1, y: side.y1 }, { x: side.x2, y: side.y2 });
      else p.onTooSmall?.(candado);
      setRoomDraft([]); setGesture(null); return;
    }
    if (gesture.kind === 'wallEdit') {
      const suelto = wallDragTo(gesture.origin, gesture.grab, gesture.start, hover ?? gesture.start, grid, paso);
      const at = candado ? suelto : anchorEnd(suelto, gesture.grab, p.walls, imán, gesture.id);
      const moved = at.x1 !== gesture.origin.x1 || at.y1 !== gesture.origin.y1 || at.x2 !== gesture.origin.x2 || at.y2 !== gesture.origin.y2;
      /**
       * AÑADIR UN NODO. Doble clic QUIETO sobre la línea: si hubo arrastre era un movimiento, y el segundo
       * clic de un arrastre cuenta como doble — mirarlo al soltar es lo único que distingue las dos cosas.
       * Dónde cae el nodo (y si cabe) lo decide `splitWallAt`; aquí sólo se le pasa dónde pinchó.
       *
       * OJO: QUIETO se mide por lo que VIAJÓ EL DEDO, no por si la geometría cambió. Un muro que no cae en la
       * rejilla —los de un círculo y los de un trazo a pulso no caen— se recuadra con el candado cerrado en
       * cuanto se pulsa, y eso hacía que un doble clic contase como movimiento: en vez del nodo, el muro daba
       * un tirón a la casilla. El umbral es el mismo del grupo y del marco de selección.
       */
      const viajó = !!hover && Math.hypot(hover.x - gesture.start.x, hover.y - gesture.start.y) > DEAD_ZONE_PX / p.view.zoom;
      /**
       * LA CADENA se guarda CON el muro y de una sola escritura (`onTransformWalls`): media figura movida y
       * media quieta es un hueco, y es el mismo agujero por el que se colaba la visión con `addRoom`.
       */
      const cadena = p.chainNodes === false ? [] : chainWalls(p.walls, gesture.id, gesture.origin, at, gesture.grab);
      /**
       * EL NODO POR DOBLE CLIC ES SÓLO DE UN MURO (dueño, 2026-09-07: «*por qué si le doy doble click a una
       * puerta me crea un nodo al medio, eso es solo para los muros*»). Partir una puerta por la mitad deja
       * dos medias puertas, que no es nada: un vano es UNA cosa de A a B. Los muros no se tocan.
       */
      const partible = p.walls.find(w => w.id === gesture.id)?.kind === 'wall';
      if (!viajó && gesture.dbl && partible) p.onSplitWall?.(gesture.id, gesture.start);
      else if (moved && cadena.length) p.onTransformWalls?.([{ id: gesture.id, ...at }, ...cadena]);
      else if (moved) p.onMoveWall?.(gesture.id, at);
      setGroupDraft(null);
      setWallDraft(null);
      setGesture(null);
      return;
    }
    if (gesture.kind === 'drawingMove') {
      // Un clic sin arrastre sólo lo ELIGE. Escribir en la base por cada clic sobraría, igual que con la luz.
      if (gesture.moved && drawingDraft && Math.hypot(drawingDraft.dx, drawingDraft.dy) > 1) {
        const movidos = drawingsShown.filter(x => gesture.ids.includes(x.id));
        // Varios de una vez cuando venían de una selección por área; uno solo sigue por su camino de siempre.
        if (gesture.ids.length > 1) p.onMoveDrawings?.(movidos.map(x => ({ id: x.id, data: translateDrawing(x, drawingDraft.dx, drawingDraft.dy) })));
        else if (movidos[0]) p.onMoveDrawing?.(gesture.id, translateDrawing(movidos[0], drawingDraft.dx, drawingDraft.dy));
      }
      setDrawingDraft(null);
      setGesture(null);
      return;
    }
    if (gesture.kind === 'lightMove') {
      /**
       * Un clic sin arrastre NO guarda nada: seleccionar una luz para abrir su editor es lo más normal del
       * mundo, y escribir en la base de datos por cada clic sobraría. El umbral es el mismo que usa el
       * marco de selección.
       */
      if (gesture.moved && lightDraft && Math.hypot(lightDraft.x - gesture.origin.x, lightDraft.y - gesture.origin.y) > 1) {
        p.onMoveLight?.(gesture.id, { x: round2(lightDraft.x), y: round2(lightDraft.y) });
      }
      setLightDraft(null);
      setGesture(null);
      return;
    }
    if (gesture.kind === 'groupXf') {
      // Un clic sin arrastre sólo elige: no hay nada que guardar, y guardarlo escribiría en balde en cada clic.
      if (gesture.moved && groupDraft?.size) p.onTransformWalls?.([...groupDraft.values()]);
      else if (gesture.dbl && gesture.wallId) {
        // Doble clic QUIETO: entra dentro y coge el muro suelto. Si hubo arrastre, era un movimiento.
        p.onSelectWalls?.([]);
        p.onSelectWall?.(gesture.wallId);
      }
      setGroupDraft(null);
      setGesture(null);
      return;
    }
    if (gesture.kind === 'marquee') {
      const ids = tokensInRect(tokensShown, gesture.start, gesture.last, grid);
      // A click without a drag is not a marquee — it already cleared the selection on the way down.
      if (Math.hypot(gesture.last.x - gesture.start.x, gesture.last.y - gesture.start.y) > 4) {
        p.onMarquee?.(ids);
        /**
         * EL ÁREA COGE TAMBIÉN MUROS, no sólo fichas — «*no puedo arrastrar y seleccionar por grupo*». Y un
         * grupo se coge entero: pillar tres muros de un círculo se trae los once, porque media cosa cogida no
         * es nada que se pueda mover con sentido.
         *
         * DENTRO de un grupo, la excepción: de ÉL se coge lo que se pilló y nada más (`porDentro`). Inflarlo
         * al grupo entero era lo que te echaba fuera en cuanto arrastrabas (dueño, 2026-09-03: «*una vez
         * dentro del grupo debería poder no sólo seleccionar un vector sino arrastrar y seleccionar en grupo
         * cosas*»).
         */
        if (dmSight && p.showWalls) p.onSelectWalls?.(withWholeGroups(p.walls, wallsInRect(p.walls, gesture.start, gesture.last), gesture.porDentro).map(w => w.id));
        /**
         * Y LOS TRAZOS — «*el arrastrar y seleccionar no funciona con las formas simples de líneas, texto,
         * círculo y cuadrado*». Sólo los que se pueden mover: a un jugador no le sirve de nada cogerlos.
         */
        p.onSelectDrawings?.(drawingsInRect(drawingsShown, gesture.start, gesture.last)
          .filter(d => canMoveDrawing(d, p.me, p.isDm)).map(d => d.id));
      }
      setGesture(null);
      return;
    }
    if (gesture.kind === 'token') {
      /**
       * Se guarda DONDE SE SOLTÓ, sin redondear a casilla: el dueño pidió que «el movimiento no dependa de la
       * grilla» (2026-08-21). Arrastrar ya era libre —`localDrag` lleva fracciones—; era este `Math.round` del
       * final el que daba el tirón a la rejilla al soltar. La columna es `real`, así que la fracción se guarda.
       * Se redondea a la centésima de casilla para no mandar 14 decimales en cada movimiento.
       */
      // Se suelta en lo LEGAL (freno + corrección + disco), no en el pintado suavizado: si el dedo iba por
      // delante del deslizamiento, el token acaba donde de verdad podía estar — como siempre hizo.
      const final = (idealDrag.current && idealDrag.current.id === gesture.id ? idealDrag.current : null) ?? localDrag;
      if (gesture.moved && localDrag && final) p.onMoveToken(gesture.id, round2(final.x), round2(final.y));
      idealDrag.current = null;
      lastLibre.current = null;
      setLocalDrag(null);
    } else if (gesture.kind === 'draw') {
      if (gesture.tool === 'stroke') { if (gesture.points.length > 1) p.onAddDrawing('stroke', { points: gesture.points }); }
      else if (Math.hypot(gesture.last.x - gesture.start.x, gesture.last.y - gesture.start.y) > 2) p.onAddDrawing(gesture.tool, shapeData(gesture.tool, gesture.start, gesture.last));
    }
    setGesture(null);
  };

  const wallsShown = dmSight ? (p.showWalls ? p.walls : []) : p.walls.filter(w => w.visiblePlayers);
  /**
   * EL MARCO DEL GRUPO. Sale de dónde están los muros AHORA MISMO —el borrador mientras se arrastra, la
   * posición guardada si no—, así que el marco y los tiradores siguen a la mano en vez de quedarse atrás.
   */
  const grupoCogido = (p.selectedWallIds ?? []).length > 1
    ? wallsShown.filter(w => p.selectedWallIds!.includes(w.id)).map(w => ({ ...w, ...(groupDraft?.get(w.id) ?? {}) }))
    : [];
  const grupoMarco = dmSight ? wallBounds(grupoCogido) : null;
  /**
   * Los muros que hoy cortan el paso en esta escena. Vacío cuando el interruptor está apagado — y **vacío
   * siempre para el director**, que no choca nunca (decisión del dueño, 2026-08-22). Su contrapartida, dicha
   * en la spec: el director no puede probar en su pantalla lo que siente un jugador; se mira entrando con una
   * cuenta de jugador.
   */
  /**
   * ⚡ ESTABLES A PROPÓSITO, y la mitad que de verdad importaba es `roomIds` (abajo): `roomMaskIds(...)`
   * devuelve un objeto NUEVO en cada llamada, así que el `memo` de `RoomsLayer` no habría servido de nada
   * —props distintas, cuerpo ejecutado igual— y en cada fotograma del arrastre se volvía a recorrer el
   * contorno entero de la mazmorra para reconstruir un SVG idéntico al que ya estaba pintado.
   *
   * `p.rooms ?? []` ya conservaba la referencia cuando había salas (`??` no copia, devuelve el mismo
   * array); se memoriza igual para que el caso SIN salas no meta un `[]` nuevo en cada pintada, pero el
   * fallo que él notaba vivía en `roomIds`. Lo sujeta un test en `MapCanvas.test.tsx`.
   */
  const rooms = useMemo(() => p.rooms ?? [], [p.rooms]);
  /**
   * ⚡ MEMORIZADA POR LO MISMO QUE `roomIds`: un objeto nuevo en cada pintada dejaría el `memo` de
   * `RoomsLayer` sin efecto y volvería a recorrerse el contorno entero de la mazmorra en cada fotograma del
   * arrastre — que es exactamente el «va lentísimo» que él notó.
   */
  const floorPreview = useMemo(
    () => (p.maskRoomId && p.maskPreview !== undefined ? { roomId: p.maskRoomId, href: p.maskPreview } : null),
    [p.maskRoomId, p.maskPreview]);
  /**
   * ⚡ Y LA PINTURA, memorizada por lo mismo. Se parte en dos: lo que va a `RoomsLayer` —una habitación o la
   * roca— y lo que va a las capas de terreno, que es otra pieza del lienzo.
   */
  const pv = p.paintPreview ?? null;
  const paintPreviewRooms = useMemo(
    () => (pv && pv.on !== 'layer' ? { on: pv.on, id: pv.id, href: pv.href } : null),
    [pv]);
  const paintPreviewLayer = useMemo(
    () => (pv && pv.on === 'layer' ? { layerId: pv.id, href: pv.href } : null),
    [pv]);
  const roomOpenings = useMemo(() => p.roomOpenings ?? [], [p.roomOpenings]);
  /**
   * 🧱 Y LAS SALAS FRENAN IGUAL (su aviso del 2026-09-04: «*le falta la física a los muros*»).
   *
   * El contorno de una sala NO es una fila de `maps_walls`, así que `moveBlockers` —que sólo mira muros
   * marcados— no lo veía y una ficha lo atravesaba como si no existiera. Mismo comportamiento, entidad
   * distinta: se suman aquí, y lo que decide el choque sigue siendo `slideToken` → `slideCircle`, la única
   * física de la app. Un vano abierto ya viene descontado del contorno, así que por la puerta se pasa.
   *
   * Respeta el interruptor de la escena igual que los muros: con las paredes sólidas apagadas, nada frena.
   */
  const roomBlockers = useMemo(() => (p.scene.solidWalls ? roomMoveSegments(roomWallsOf(rooms, roomOpenings)) : []), [p.scene.solidWalls, rooms, roomOpenings]);
  const blockers = useMemo(() => (p.isDm ? [] : [...moveBlockers(p.walls, p.scene), ...roomBlockers]), [p.isDm, p.walls, p.scene, roomBlockers]);
  /**
   * …salvo LA SONDA DE PRUEBA, que sí choca (dueño, 2026-09-01: «no funciona bien el user dummy, traspasa las
   * paredes»). Y es la misma función, `moveBlockers` + `slideToken` → `slideCircle` de `@rolvium/core`, la
   * única que decide un choque en toda la app: no hay una segunda física ni aquí ni en el servidor.
   *
   * La sonda simula a un JUGADOR, así que tiene que sentir lo que siente él. Esto cierra justamente la
   * contrapartida que el comentario de arriba daba por inevitable desde el 2026-08-22 —«el director no puede
   * probar en su pantalla lo que siente un jugador»—: ahora sí puede, y para eso está la sonda.
   *
   * Si el interruptor de paredes sólidas está APAGADO, `moveBlockers` devuelve vacío y la sonda atraviesa —
   * como atravesaría el jugador. Simular es copiar lo que pasa, no ser más estricto que la escena.
   */
  const probeBlockers = useMemo(() => [...moveBlockers(p.walls, p.scene), ...roomBlockers], [p.walls, p.scene, roomBlockers]);
  const tokensShown = dmSight ? p.tokens : p.tokens.filter(tk => tk.visible);

  /**
   * Capas de contenido (rebanada 7). `dmSight` es lo que decide si esto se mira con ojos de director: con
   * «ver como jugador» puesto, el director deja de ver la capa de notas — que es justo lo que la lente viene
   * a comprobar. Una capa APAGADA no se pinta para nadie, ni siquiera para él: el ojo es el de Photoshop.
   */
  const layers = p.layers ?? [];
  const hasTerrain = terrainLayers(layers).some(l => l.visible && l.imageUrl);
  const roomIds = useMemo(() => roomMaskIds(p.scene.id), [p.scene.id]);
  const drawingsShown = layers.length === 0 ? p.drawings : p.drawings.filter(d => isPainted(resolveLayer(layers, d.layerId, 'drawing'), dmSight));
  /**
   * Mientras se arrastra una luz se pinta donde va el dedo, no donde está guardada: el resplandor, su aro y
   * su disco de clic salen todos de esta lista, así que con cambiarla aquí se mueve el conjunto de una pieza.
   */
  const lightsAll = useMemo(() => paintedLights(p.lights ?? [], layers, dmSight), [p.lights, layers, dmSight]);
  /** ⚡ Estable salvo mientras se arrastra una luz: sin esto el `memo` de `LightsLayer` no serviría de nada. */
  const lightsShown = useMemo(
    () => (lightDraft ? lightsAll.map(l => (l.id === lightDraft.id ? { ...l, x: lightDraft.x, y: lightDraft.y } : l)) : lightsAll),
    [lightDraft, lightsAll],
  );
  /** Un PJ es un token con ficha de personaje detrás. Los PNJ del bestiario no la tienen. */
  const isPc = (tk: Token): boolean => tk.characterId !== null;
  const renderToken = (tk: Token): JSX.Element => {
    const ov = localDrag?.id === tk.id ? localDrag : p.drags[tk.id] ?? null;
    return <TokenGlyph key={tk.id} token={tk} grid={grid} override={ov} selected={p.selectedTokenIds.includes(tk.id)} movable={p.tool === 'select' && canMoveToken(tk, p.me, p.isDm)}
      label={t('maps.canvas.token', { name: tk.name })} hiddenLabel={t('maps.canvas.hidden')} onPointerDown={onTokenDown(tk)} />;
  };
  const draft = gesture?.kind === 'draw' ? { kind: gesture.tool, data: gesture.tool === 'stroke' ? { points: gesture.points } : shapeData(gesture.tool, gesture.start, gesture.last), color: p.stroke.color, width: p.stroke.width } : null;
  const clipId = `mp-clip-${p.scene.id}`;
  const cursor = spacePan ? (gesture?.kind === 'pan' ? 'grabbing' : 'grab') : p.tool === 'select' ? 'default' : 'crosshair';
  const measured = measure ? distanceLabel(distanceCells(measure.a, measure.b, grid)) : null;

  // ── fog ──
  // `null` = the API has not answered yet: draw the scene unfogged rather than flash a black canvas.
  const fog = p.fog;
  /**
   * ⚡ ESTABLE, por lo MISMO que `roomIds`: era un objeto nuevo en cada repintado, así que `FogMasks` —que
   * arma el camino de TODAS las casillas exploradas y los polígonos de visión, y encima los mete en cuatro
   * máscaras con desenfoque— se rehacía en cada fotograma del arrastre. En un mapa muy explorado cuesta más
   * que la capa de salas. Ni la escena ni la niebla cambian mientras se arrastra una ficha.
   */
  const fogIds = useMemo(() => ({ seen: `mp-seen-${p.scene.id}`, lit: `mp-lit-${p.scene.id}`, dim: `mp-dim-${p.scene.id}`, unexplored: `mp-unex-${p.scene.id}` }), [p.scene.id]);
  const url = (id: string) => `url(#${id})`;
  /** A player (and the DM «viendo como jugador») only gets what the server drew for them. */
  const playerSight = !!fog && !dmSight;
  const hasVision = !!fog && fog.vision.length > 0;
  /**
   * Tokens live inside the CURRENT sight, never inside memory: a monster standing where you have been but are not
   * looking must not show. With `vision` fog that is the `lit` mask even when it is empty — a player with no token
   * «no ve nada más que lo que ya tenga explorado», creatures included. Manual/off fog has no sight to speak of, so
   * tokens follow whatever is revealed.
   */
  const tokenMask = playerSight ? (p.scene.fogMode === 'vision' ? fogIds.lit : fogIds.seen) : null;
  const sceneRect = { x: 0, y: 0, width: p.scene.width, height: p.scene.height };
  const brushPx = brushRadius(p.brush, grid);
  const selectedWall = p.selectedWallId ? p.walls.find(w => w.id === p.selectedWallId) ?? null : null;
  /**
   * Hovering a door or a window offers the disc that opens it, and it is the disc — not the Muro tool — that
   * works a door now. It only shows under the tools whose press STARTS something (Seleccionar, medir, dibujar):
   * there the disc can afford to wait for the release and tell a click from a drag. Under a tool that acts on the
   * press itself (Muro, Pin, Texto, Borrar, los pinceles) it would have to swallow that press, and swallowing is
   * how the rebanada 2 clash worked — so there it simply does not appear. Nor with something half-done.
   */
  /**
   * EL DISCO MIRA EN LOS DOS SITIOS: los muros sueltos y los vanos de sala. Los de sala no llevan
   * `visible_players` —una sala ES el dibujo del mapa y se ve siempre— así que entran enteros.
   */
  const abribles: (Segment & Pick<Wall, 'id' | 'kind' | 'isOpen'>)[] = [...wallsShown, ...roomOpenings];
  const hoverOpening = dmSight && hover && !gesture && !wallStart && !p.placing && DISC_TOOLS.includes(p.tool)
    ? hitOpening(abribles, hover, 14 / p.view.zoom) : null;
  const handleAt = wallDraft ?? (selectedWall ? { x1: selectedWall.x1, y1: selectedWall.y1, x2: selectedWall.x2, y2: selectedWall.y2 } : { x1: 0, y1: 0, x2: 0, y2: 0 });
  /** Los trazos que se están arrastrando ahora mismo: uno, o el puñado entero que se cogió con el área. */
  const moviendo = new Set(gesture?.kind === 'drawingMove' ? gesture.ids : []);

  return (
    <svg ref={svgRef} className="mp-svg" data-tool={p.tool} style={{ cursor }} aria-label={t('maps.canvas.label')} role="application"
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={() => setHover(null)} onContextMenu={onRightClick}>
      <defs>
        <clipPath id={clipId}><rect x={0} y={0} width={p.scene.width} height={p.scene.height} /></clipPath>
        {fog && <FogMasks scene={p.scene} fog={fog} ids={fogIds} />}
        {/*
          * Los mosaicos de las puertas, uno por textura distinta de la escena — de los muros Y de las salas,
          * porque las dos clases de puerta se pintan con el mismo trazo y piden el mismo `<pattern>`.
          */}
        <DoorTextureDefs urls={doorTexturesUsed([...wallsShown, ...roomOpenings], p.scene)} grid={p.scene.grid.size} />
      </defs>
      <g transform={`translate(${p.view.panX} ${p.view.panY}) scale(${p.view.zoom})`}>
        <g className="mp-layer-map" {...(playerSight ? { mask: url(fogIds.seen) } : {})} data-testid="mp-map">
          <BackgroundLayer scene={p.scene} clipId={clipId} imageHidden={hasTerrain} />
          {/*
            * LAS SALAS, por DEBAJO de las capas de terreno (decisión mía, revisable, § «Decisiones que tomo
            * yo aquí»): la roca y el suelo son el cimiento del mapa, y una capa con transparencia sigue
            * mandando encima de todo esto.
            */}
          <RoomsLayer scene={p.scene} rooms={rooms} openings={roomOpenings} ids={roomIds} selectedOpeningId={p.selectedRoomOpeningId ?? null} floorPreview={floorPreview} paintPreview={paintPreviewRooms} />
          {hasTerrain && <TerrainLayers scene={p.scene} layers={layers} clipId={clipId} preview={p.maskLayerId && p.maskPreview !== undefined ? { layerId: p.maskLayerId, href: p.maskPreview } : null} paintPreview={paintPreviewLayer} />}
          {/*
            * Con salas levantadas la rejilla se recorta al AGUJERO: fuera no hay suelo que cuadricular, hay
            * roca maciza. Sin salas no hay máscara y la rejilla se pinta entera, exactamente como hasta hoy.
            */}
          <GridLayer scene={p.scene} patternId={`mp-grid-${p.scene.id}`} {...(rooms.length > 0 ? { maskId: roomIds.hole } : {})} />
          {dmSight && fog && p.fogVeil !== false && <rect {...sceneRect} className="mp-fog-veil" mask={url(fogIds.unexplored)} data-testid="mp-fog-veil" />}
          <g className="mp-layer-walls" data-testid="mp-walls">
            {wallsShown.map(w => (
              <WallShape key={w.id} wall={w} sceneDoorColor={p.scene.doorColor} sceneDoorTexture={p.scene.doorTextureUrl}
                selected={w.id === p.selectedWallId || (p.selectedWallIds ?? []).includes(w.id)}
                draft={groupDraft?.get(w.id) ?? (wallDraft && w.id === p.selectedWallId ? wallDraft : null)} />
            ))}
            {wallStart && hover && p.tool === 'wall' && <line x1={wallStart.x} y1={wallStart.y} x2={anclar(hover, undefined, wallStart).x} y2={anclar(hover, undefined, wallStart).y} className="mp-wall draft" />}
            {roomDraft.map((r, i) => <line key={`room-${i}`} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} className="mp-wall draft" />)}
            {/* El brochazo mientras se arrastra: el contorno de lo que va a quedar, sin rellenar. */}
            {/* La banda mientras se arrastra: el contorno de lo que va a quedar, sin rellenar. */}
            {bandDraft.map((ring, i) => <path key={`band-${i}`} d={ringPath(ring.map(([x, y]) => ({ x, y })))} className="mp-wall draft" fill="none" data-testid="mp-band-draft" />)}
          </g>
          <g className="mp-layer-drawings" data-testid="mp-drawings">
            {drawingsShown.map(d => (
              <DrawingShape key={d.id}
                d={moviendo.has(d.id) && drawingDraft ? { ...d, data: translateDrawing(d, drawingDraft.dx, drawingDraft.dy) } : d}
                selected={d.id === p.selectedDrawingId || (p.selectedDrawingIds ?? []).includes(d.id)}
                movable={p.tool === 'select' && canMoveDrawing(d, p.me, p.isDm)} />
            ))}
            {draft && <DrawingShape d={draft} draft />}
          </g>
          {/* Encima del mapa y de los trazos, debajo de las fichas: la luz baña el suelo, no a la gente. */}
          {lightsShown.length > 0 && <LightsLayer scene={p.scene} lights={lightsShown} {...(fog?.lit ? { lit: fog.lit } : {})} />}
          {/* El aro de la luz seleccionada y su zona de clic. Sólo para el director: es mobiliario de edición. */}
          {dmSight && LIGHT_PICK_TOOLS.includes(p.tool) && lightsShown.map(l => (
            <g key={`hit-${l.id}`}>
              <circle cx={l.x} cy={l.y} r={LIGHT_HANDLE_R / p.view.zoom} className="mp-light-hit" data-light-hit={l.id} />
              {p.selectedLightId === l.id && <circle cx={l.x} cy={l.y} r={18 / p.view.zoom} className="mp-light-sel" data-testid="mp-light-sel" />}
            </g>
          ))}
          {/* What was explored but is out of sight right now stays visible, only dimmed — «sigue ahí, apagado». */}
          {playerSight && hasVision && <rect {...sceneRect} className="mp-fog-dim" mask={url(fogIds.dim)} data-testid="mp-fog-dim" />}
        </g>
        {/*
          * Dos capas de tokens, no una. **Los PJ se pintan SIEMPRE, encima de la niebla y sin máscara**: sabes
          * dónde está tu grupo aunque esté en otra sala, que es como funcionaba el prototipo
          * (`plenilunio-vtt-prototipo.jsx`, «tokensEscena.filter(t => t.tipo === "pj").forEach(pintarToken)»).
          * Antes se ocultaban con todo lo demás y el jugador se quedaba solo en el mapa (dueño, 2026-08-22).
          * Lo que NO es un PJ —criaturas y PNJ— sí lo tapa la niebla: es justo lo que no debes ver.
          */}
        <g className="mp-layer-tokens" data-testid="mp-tokens" {...(tokenMask ? { mask: url(tokenMask) } : {})}>
          {tokensShown.filter(tk => !isPc(tk)).map(renderToken)}
        </g>
        <g className="mp-layer-tokens-pc" data-testid="mp-tokens-pc">
          {tokensShown.filter(isPc).map(renderToken)}
        </g>
        <g className="mp-layer-ui">
          {gesture?.kind === 'marquee' && (
            <rect className="mp-marquee" data-testid="mp-marquee"
              {...(({ x, y, w, h }) => ({ x, y, width: w, height: h }))(rectFrom(gesture.start, gesture.last))} />
          )}
          {grupoMarco && (
            <g className="mp-group-sel" data-testid="mp-group-sel">
              <rect className="mp-group-box" x={grupoMarco.x} y={grupoMarco.y} width={grupoMarco.w} height={grupoMarco.h} />
              {HANDLE_KEYS.map(k => {
                const q = handlePoint(grupoMarco, k);
                const lado = 8 / p.view.zoom;
                return <rect key={k} className="mp-group-handle" data-testid={`mp-group-handle-${k}`}
                  x={q.x - lado / 2} y={q.y - lado / 2} width={lado} height={lado} />;
              })}
            </g>
          )}
          {/*
            * LA SILUETA DEL PINCEL BAJO EL PUNTERO. En la niebla la lleva desde siempre; pintando y borrando
            * faltaba, y él lo pidió con esas palabras (2026-09-10): «*al poner el puntero en el lienzo tendría
            * que tener una silueta del área que ocupa el pincel, si no lo hago a ciegas*».
            *
            * Pintando va MÁS FLOJA que la de la niebla —«*una silueta ligera, pero algo se tiene que ver*»—:
            * ahí debajo está el mapa que se está retocando, y un disco dorado opaco taparía justo lo que hay
            * que mirar. Y sólo sale cuando hay dónde pintar: sin destino sería prometer un brochazo que no va
            * a caer en ninguna parte.
            */}
          {/*
            * EL PREVIO DEL AZULEJO: la textura repetida sobre TODO el lienzo, translúcida, mientras él mueve
            * el tamaño. Va aquí arriba —sobre el mapa y bajo los controles— porque lo que se quiere comparar
            * es la losa contra las salas que ya están.
            */}
          {dmSight && p.tilePreview && (<>
            <defs>
              <pattern id="mp-tile-preview" patternUnits="userSpaceOnUse" width={p.tilePreview.sidePx} height={p.tilePreview.sidePx}
                patternTransform={p.tilePreview.deg ? `rotate(${p.tilePreview.deg})` : undefined}>
                <image href={p.tilePreview.url} x={0} y={0} width={p.tilePreview.sidePx} height={p.tilePreview.sidePx} preserveAspectRatio="xMidYMid slice" />
              </pattern>
            </defs>
            <rect {...sceneRect} fill="url(#mp-tile-preview)" className="mp-tile-preview" data-testid="mp-tile-preview" />
          </>)}
          {dmSight && hover && (isBrush(p.tool) || (p.tool === 'mask' && p.paintReady)) && (
            <circle cx={hover.x} cy={hover.y} r={brushPx} className={`mp-brush ${p.tool}`} data-testid="mp-brush" />
          )}
          {dmSight && selectedWall && (
            <g className="mp-wall-handles" data-testid="mp-wall-handles">
              {([['a', handleAt.x1, handleAt.y1], ['b', handleAt.x2, handleAt.y2]] as const).map(([id, hx, hy]) => (
                <rect key={id} data-vertex={id} x={hx - 6} y={hy - 6} width={12} height={12} className="mp-vertex" />
              ))}
            </g>
          )}
          {/* scale(1/zoom): the disc is a control, so it keeps ONE size on screen — and that is the same budget its
              hover tolerance spends, or the disc you see and the part that answers drift apart as you zoom. */}
          {hoverOpening && (
            <g className={`mp-door-toggle ${hoverOpening.isOpen ? 'open' : ''}`} data-testid="mp-door-toggle" data-wall-id={hoverOpening.id}
              transform={`translate(${midpoint(hoverOpening).x} ${midpoint(hoverOpening).y}) scale(${1 / p.view.zoom})`}
              role="img" tabIndex={-1} aria-label={t(hoverOpening.isOpen ? 'maps.wall.close' : 'maps.wall.open')}
              onPointerDown={e => { if (e.button === 0) discPress.current = { id: hoverOpening.id, at: toScene(e) }; }}>
              <circle r={13} className="mp-door-disc" />
              <text className="material-symbols-outlined mp-door-icon" textAnchor="middle" dominantBaseline="central">{hoverOpening.isOpen ? 'door_open' : 'door_front'}</text>
            </g>
          )}
          {measure && measured && (
            <g className="mp-measure" data-testid="mp-measure">
              <line x1={measure.a.x} y1={measure.a.y} x2={measure.b.x} y2={measure.b.y} />
              <circle cx={measure.a.x} cy={measure.a.y} r={3} /><circle cx={measure.b.x} cy={measure.b.y} r={3} />
              <text x={(measure.a.x + measure.b.x) / 2} y={(measure.a.y + measure.b.y) / 2 - 8} textAnchor="middle">{t('maps.canvas.measure', { cells: measured.cells, m: measured.metres })}</text>
            </g>
          )}
          {pinShown && (
            <g className="mp-pin" transform={`translate(${pinShown.x} ${pinShown.y})`} data-testid="mp-pin" aria-label={t('maps.canvas.pin', { name: p.nameOf(pinShown.by) })}>
              <circle r={14} className="mp-pin-ring" /><circle r={4} className="mp-pin-dot" />
            </g>
          )}
          {/*
            * LA SONDA DE PRUEBA (§ 7.3). Va en la capa de UI y NO entre las fichas a propósito: no es una
            * ficha —no está en `maps_tokens`, no la ve ningún jugador y no sale en ninguna lista—, es
            * mobiliario de la pantalla del director. Por eso tampoco la tapa la niebla: se pinta encima.
            */}
          {p.probe && (
            <g className="mp-probe" data-testid="mp-probe" transform={`translate(${p.probe.x} ${p.probe.y})`}
              role="img" aria-label={t('maps.probe.label')}>
              <circle r={PROBE_R} className="mp-probe-body" />
              <circle r={PROBE_R} className="mp-probe-ring" />
              <text className="material-symbols-outlined mp-probe-icon" textAnchor="middle" dominantBaseline="central">theater_comedy</text>
              <text className="mp-probe-hint" y={PROBE_R + 13} textAnchor="middle">{t('maps.probe.hint')}</text>
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}
