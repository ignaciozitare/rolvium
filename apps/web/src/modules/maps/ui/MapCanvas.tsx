import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { SceneVision } from '@rolvium/core';
import type { Drawing, DrawingKind, Layer, Light, Scene, Token, Wall, WallKind } from '../domain/entities/Scene';
import { brushRadius, canEraseDrawing, canMoveDrawing, canMoveToken, canvasToScene, distanceCells, distanceLabel, drawingsInRect, hitOpening, hitTest, hitWall, isBrush, midpoint, rectFrom, shapeData, slideToken, tokenCenter, tokenPointAt, tokenRadiusPx, moveBlockers, tokensInRect, translateDrawing, wallDragTo, zoomAt, type Point, type Tool, type View } from '../domain/useCases/mapRules';
import type { LiveDrag, LivePin } from './useScene';
import { freehandSides, isDragShape, isLineShape, lineSide, MIN_RING_POINTS, polygonSides, roomSides, type RoomShape, type RoomSide } from '../domain/useCases/roomRules';
import { anchorEnd, builderPoint, END_SNAP_PX, stepOf } from '../domain/useCases/snapRules';
import { chainWalls, groupInsideOf, groupOf, handleAt as handlePoint, HANDLE_KEYS, insideGroup, moveWalls, resizeRect, scaleWallsTo, wallBounds, wallsInRect, withWholeGroups, type HandleKey, type Rect, type WallAt } from '../domain/useCases/groupRules';
import { BackgroundLayer, DrawingShape, FogMasks, GridLayer, LightsLayer, TerrainLayers, TokenGlyph, WallShape } from './canvasLayers';
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
  /** DM: open or close the door/window that was clicked. */
  onToggleWall: (wall: Wall) => void;
  /** DM: paint the fog at a scene point with the current brush radius (scene px). */
  onPaintFog: (at: { x: number; y: number; radius: number }, op: 'reveal' | 'hide') => void;
  /** DM, herramienta Luz: coloca una luz de ambiente donde se pinchó (px de escena). */
  onPlaceLight?: (at: Point) => void;
  /**
   * DM, pincel de transparencia: pinta la máscara de la capa de terreno activa, de `from` a `to` en px de
   * escena. `null` en `maskLayerId` = no hay capa donde pintar y el pincel no hace nada.
   */
  maskLayerId?: string | null;
  onPaintMask?: (from: Point, to: Point) => void;
  onPaintMaskEnd?: () => void;
  /** La máscara EN VIVO mientras se pinta, antes de que suba. Se pinta en lugar de la guardada. */
  maskPreview?: string | null;
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
  const [polyPoints, setPolyPoints] = useState<Point[]>([]);
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
  /** El imán de las puntas se mide en píxeles de PANTALLA: con el mapa alejado no puede tirar de medio mapa. */
  const imán = END_SNAP_PX / p.view.zoom;
  const anclar = (q: Point, skipId?: string): Point => builderPoint(q, grid, candado, p.walls, imán, skipId);

  useEffect(() => {
    if (!p.pin) { setPinShown(null); return; }
    setPinShown(p.pin);
    const id = window.setTimeout(() => setPinShown(null), PIN_MS);
    return () => window.clearTimeout(id);
  }, [p.pin]);
  useEffect(() => { if (p.tool !== 'wall') { setWallStart(null); setPolyPoints([]); setRoomDraft([]); } if (p.tool !== 'measure') setMeasure(null); }, [p.tool]);
  /** Cambiar de forma a media sala la descarta: los vértices de un polígono no valen para un círculo. */
  useEffect(() => { setPolyPoints([]); setRoomDraft([]); setWallStart(null); }, [p.wallShape]);
  useEffect(() => { onDeleteRef.current = () => p.onDeleteSelection?.(); });
  useEffect(() => {
    cogerTodoRef.current = () => {
      if (!dmSight || !p.showWalls || !p.walls.length) return;
      // Se suelta el muro suelto: o se tiene UNO cogido y se editan sus puntas, o se tienen TODOS y se mueven.
      p.onSelectWall?.(null);
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
      if (e.key === 'Escape') { setWallStart(null); setPolyPoints([]); setRoomDraft([]); setGesture(null); setLightDraft(null); setMeasure(null); p.onSelectToken(null); p.onSelectWall?.(null); p.onSelectLight?.(null); p.onSelectDrawing?.(null); setDrawingDraft(null); setGroupDraft(null); p.onSelectWalls?.([]); return; }
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
      const light = dmSight ? lightsShown.find(l => Math.hypot(l.x - s.x, l.y - s.y) <= Math.max(12 / p.view.zoom, lightRadiusPx(l, p.scene.grid) * 0.25)) : null;
      if (light) {
        p.onSelectToken(null);
        p.onSelectWall?.(null);
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
        const near = (x: number, y: number) => Math.hypot(s.x - x, s.y - y) <= 12 / p.view.zoom;
        const grab = near(wall.x1, wall.y1) ? 'a' : near(wall.x2, wall.y2) ? 'b' : 'whole';
        setGesture({ kind: 'wallEdit', id: wall.id, grab, start: s, origin: { x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 }, dbl: doble });
        svgRef.current?.setPointerCapture?.(e.pointerId);
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
        // A pulso: se va guardando por dónde pasa la mano.
        if (shape === 'free') {
          setGesture({ kind: 'roomFree', points: [s] });
          svgRef.current?.setPointerCapture?.(e.pointerId);
          return;
        }
        // Polígono: un clic, un vértice. Se cierra pinchando otra vez encima del primero — el gesto que ya
        // conoce todo el mundo, y así no hace falta un botón aparte ni un doble clic que compita con nada.
        if (shape === 'poly') {
          const v = anclar(s);
          const first = polyPoints[0];
          // Menos de media casilla, no una entera: los vértices están pegados a la rejilla, así que el vecino
          // de al lado cae a exactamente `grid` del primero y con el tope en `grid` cerraba la sala en vez de
          // poner el vértice — imposible hacer una L cuya última esquina caiga junto a la primera.
          if (first && polyPoints.length >= MIN_RING_POINTS && Math.hypot(v.x - first.x, v.y - first.y) <= grid * 0.75) {
            p.onAddRoom?.(polygonSides(polyPoints, grid, paso));
            setPolyPoints([]);
            return;
          }
          setPolyPoints([...polyPoints, v]);
          return;
        }
        // Muro only BUILDS. Opening a door is the hover disc's job, which is what unblocks starting a wall next
        // to a door — that click used to open it instead (specs/modules/maps/SPEC.md § «Rebanada 3»).
        const q = anclar(s);
        if (wallStart) {
          p.onAddWall(wallStart, q);
          // A door or a window is ONE segment: chaining would drop a second one where you did not ask for it.
          setWallStart(p.wallKind && p.wallKind !== 'wall' ? null : q);
          return;
        }
        setWallStart(q);
        return;
      }
      case 'mask': {
        if (!dmSight || !p.maskLayerId) return;
        p.onPaintMask?.(s, s);
        setGesture({ kind: 'mask', last: s });
        svgRef.current?.setPointerCapture?.(e.pointerId);
        return;
      }
      case 'reveal':
      case 'hide': {
        if (!dmSight) return;
        const op = p.tool === 'reveal' ? 'reveal' : 'hide';
        p.onPaintFog({ ...s, radius: brushRadius(p.brush, grid) }, op);
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
      if (bound) {
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
      const side = lineSide(gesture.start, anclar(s), grid);
      setRoomDraft(side ? [side] : []);
    } else if (gesture.kind === 'room') {
      setRoomDraft(roomSides(gesture.shape, gesture.start, s, grid, paso));
    } else if (gesture.kind === 'roomFree') {
      const points = [...gesture.points, s];
      setGesture({ ...gesture, points });
      setRoomDraft(freehandSides(points, grid));
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
    if (wallStart || measure || gesture || polyPoints.length) { setWallStart(null); setPolyPoints([]); setRoomDraft([]); setMeasure(null); setGesture(null); setLightDraft(null); setDrawingDraft(null); return; }
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
    }
    if (!gesture) return;
    // La sonda no guarda nada al soltar: no es una ficha. Sólo se deja de arrastrar.
    if (gesture.kind === 'probe') { setGesture(null); return; }
    // El PNG de la máscara sube UNA vez, al soltar: un guardado por pincelada, no cien.
    if (gesture.kind === 'mask') { setGesture(null); p.onPaintMaskEnd?.(); return; }
    // La sala se escribe al soltar, no mientras se arrastra: si no, cada píxel del gesto sería una escritura.
    if (gesture.kind === 'room') {
      p.onAddRoom?.(roomSides(gesture.shape, gesture.start, hover ?? gesture.start, grid, paso));
      setRoomDraft([]); setGesture(null); return;
    }
    if (gesture.kind === 'roomFree') {
      p.onAddRoom?.(freehandSides(gesture.points, grid));
      setRoomDraft([]); setGesture(null); return;
    }
    if (gesture.kind === 'line') {
      const side = lineSide(gesture.start, hover ? anclar(hover) : gesture.start, grid);
      if (side) p.onAddWall({ x: side.x1, y: side.y1 }, { x: side.x2, y: side.y2 });
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
      if (!viajó && gesture.dbl) p.onSplitWall?.(gesture.id, gesture.start);
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
  const blockers = p.isDm ? [] : moveBlockers(p.walls, p.scene);
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
  const probeBlockers = moveBlockers(p.walls, p.scene);
  const tokensShown = dmSight ? p.tokens : p.tokens.filter(tk => tk.visible);

  /**
   * Capas de contenido (rebanada 7). `dmSight` es lo que decide si esto se mira con ojos de director: con
   * «ver como jugador» puesto, el director deja de ver la capa de notas — que es justo lo que la lente viene
   * a comprobar. Una capa APAGADA no se pinta para nadie, ni siquiera para él: el ojo es el de Photoshop.
   */
  const layers = p.layers ?? [];
  const hasTerrain = terrainLayers(layers).some(l => l.visible && l.imageUrl);
  const drawingsShown = layers.length === 0 ? p.drawings : p.drawings.filter(d => isPainted(resolveLayer(layers, d.layerId, 'drawing'), dmSight));
  /**
   * Mientras se arrastra una luz se pinta donde va el dedo, no donde está guardada: el resplandor, su aro y
   * su disco de clic salen todos de esta lista, así que con cambiarla aquí se mueve el conjunto de una pieza.
   */
  const lightsAll = paintedLights(p.lights ?? [], layers, dmSight);
  const lightsShown = lightDraft ? lightsAll.map(l => (l.id === lightDraft.id ? { ...l, x: lightDraft.x, y: lightDraft.y } : l)) : lightsAll;
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
  const fogIds = { seen: `mp-seen-${p.scene.id}`, lit: `mp-lit-${p.scene.id}`, dim: `mp-dim-${p.scene.id}`, unexplored: `mp-unex-${p.scene.id}` };
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
  const hoverOpening = dmSight && hover && !gesture && !wallStart && !p.placing && DISC_TOOLS.includes(p.tool)
    ? hitOpening(wallsShown, hover, 14 / p.view.zoom) : null;
  const handleAt = wallDraft ?? (selectedWall ? { x1: selectedWall.x1, y1: selectedWall.y1, x2: selectedWall.x2, y2: selectedWall.y2 } : { x1: 0, y1: 0, x2: 0, y2: 0 });
  /** Los trazos que se están arrastrando ahora mismo: uno, o el puñado entero que se cogió con el área. */
  const moviendo = new Set(gesture?.kind === 'drawingMove' ? gesture.ids : []);

  return (
    <svg ref={svgRef} className="mp-svg" data-tool={p.tool} style={{ cursor }} aria-label={t('maps.canvas.label')} role="application"
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={() => setHover(null)} onContextMenu={onRightClick}>
      <defs>
        <clipPath id={clipId}><rect x={0} y={0} width={p.scene.width} height={p.scene.height} /></clipPath>
        {fog && <FogMasks scene={p.scene} fog={fog} ids={fogIds} />}
      </defs>
      <g transform={`translate(${p.view.panX} ${p.view.panY}) scale(${p.view.zoom})`}>
        <g className="mp-layer-map" {...(playerSight ? { mask: url(fogIds.seen) } : {})} data-testid="mp-map">
          <BackgroundLayer scene={p.scene} clipId={clipId} imageHidden={hasTerrain} />
          {hasTerrain && <TerrainLayers scene={p.scene} layers={layers} clipId={clipId} preview={p.maskLayerId && p.maskPreview !== undefined ? { layerId: p.maskLayerId, href: p.maskPreview } : null} />}
          <GridLayer scene={p.scene} patternId={`mp-grid-${p.scene.id}`} />
          {dmSight && fog && p.fogVeil !== false && <rect {...sceneRect} className="mp-fog-veil" mask={url(fogIds.unexplored)} data-testid="mp-fog-veil" />}
          <g className="mp-layer-walls" data-testid="mp-walls">
            {wallsShown.map(w => (
              <WallShape key={w.id} wall={w}
                selected={w.id === p.selectedWallId || (p.selectedWallIds ?? []).includes(w.id)}
                draft={groupDraft?.get(w.id) ?? (wallDraft && w.id === p.selectedWallId ? wallDraft : null)} />
            ))}
            {wallStart && hover && p.tool === 'wall' && <line x1={wallStart.x} y1={wallStart.y} x2={anclar(hover).x} y2={anclar(hover).y} className="mp-wall draft" />}
            {roomDraft.map((r, i) => <line key={`room-${i}`} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} className="mp-wall draft" />)}
            {p.tool === 'wall' && polyPoints.map((v, i) => {
              const next = polyPoints[i + 1] ?? (hover ? anclar(hover) : v);
              return <line key={`poly-${i}`} x1={v.x} y1={v.y} x2={next.x} y2={next.y} className="mp-wall draft" />;
            })}
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
          {dmSight && isBrush(p.tool) && hover && (
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
