import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { SceneVision } from '@rolvium/core';
import type { Drawing, DrawingKind, Scene, Token, Wall, WallKind } from '../domain/entities/Scene';
import { brushRadius, canEraseDrawing, canMoveToken, canvasToScene, distanceCells, distanceLabel, hitOpening, hitTest, hitWall, isBrush, midpoint, rectFrom, shapeData, slideToken, snap, tokenCenter, tokenPointAt, tokenRadiusPx, moveBlockers, tokensInRect, wallDragTo, zoomAt, type Point, type Tool, type View } from '../domain/useCases/mapRules';
import type { LiveDrag, LivePin } from './useScene';
import { BackgroundLayer, DrawingShape, FogMasks, GridLayer, TokenGlyph, WallShape } from './canvasLayers';

export interface StrokeStyle { color: string; width: number }

interface Props {
  scene: Scene;
  tokens: Token[];
  walls: Wall[];
  drawings: Drawing[];
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
  view: View;
  onViewChange: (v: View) => void;
  nameOf: (userId: string) => string;
  /** `x`/`y` es donde el token ESTÁ (ya frenado/corregido); `desired`, a dónde quería ir el dedo. */
  onDragToken: (id: string, x: number, y: number, desired: { x: number; y: number }) => void;
  onMoveToken: (id: string, x: number, y: number) => void;
  /** Dónde dice el SERVIDOR que puede estar el token que se arrastra, o `null` si no ha dicho nada. */
  onServerCorrection?: (tokenId: string) => { x: number; y: number } | null;
  onAddDrawing: (kind: DrawingKind, data: Drawing['data']) => void;
  onErase: (id: string) => void;
  onAddWall: (a: Point, b: Point) => void;
  /** DM: open or close the door/window that was clicked. */
  onToggleWall: (wall: Wall) => void;
  /** DM: paint the fog at a scene point with the current brush radius (scene px). */
  onPaintFog: (at: { x: number; y: number; radius: number }, op: 'reveal' | 'hide') => void;
  onPin: (p: Point) => void;
  /** Suprimir / Del over the selection (DM). */
  onDeleteSelection?: () => void;
  /** Right-click on empty ground with nothing pending: where to open the quick menu (canvas px + scene point). */
  onContextMenu?: (at: { x: number; y: number }, scene: Point) => void;
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
  onSelectToken: (id: string | null) => void;
  /** DM, Seleccionar: the segment being edited and its handles. */
  selectedWallId?: string | null;
  onSelectWall?: (id: string | null) => void;
  /** New endpoints after dragging the segment or one of its vertices (already grid-snapped). */
  onMoveWall?: (id: string, at: { x1: number; y1: number; x2: number; y2: number }) => void;
}

type Gesture =
  | { kind: 'pan'; start: Point; origin: View }
  | { kind: 'token'; id: string; start: Point; origin: Point; moved: boolean }
  | { kind: 'draw'; tool: DrawTool; start: Point; points: [number, number][]; last: Point }
  | { kind: 'brush'; op: 'reveal' | 'hide' }
  | { kind: 'wallEdit'; id: string; grab: 'a' | 'b' | 'whole'; start: Point; origin: { x1: number; y1: number; x2: number; y2: number } }
  | { kind: 'marquee'; start: Point; last: Point }
  | { kind: 'measure' };

type DrawTool = 'stroke' | 'line' | 'rect' | 'circle';
/** Tools whose press opens a gesture, so the open/close disc can wait for the release instead of stealing it. */
const DISC_TOOLS: Tool[] = ['select', 'measure', 'pencil', 'line', 'rect', 'circle'];
const DRAW_TOOLS: Record<string, DrawTool> = { pencil: 'stroke', line: 'line', rect: 'rect', circle: 'circle' };
const PIN_MS = 2500;
/** Centésima de casilla: suficiente para que el movimiento se vea libre y no manda 14 decimales por la red. */
const round2 = (v: number): number => Math.round(v * 100) / 100;
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
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [localDrag, setLocalDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [measure, setMeasure] = useState<{ a: Point; b: Point } | null>(null);
  const [wallStart, setWallStart] = useState<Point | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [pinShown, setPinShown] = useState<LivePin | null>(null);
  /** Space held = pan, from ANY tool (the middle button already did this). Panning is a modifier, not a tool. */
  const [spacePan, setSpacePan] = useState(false);
  const [wallDraft, setWallDraft] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  /** In a ref so the key listener never has to be re-bound as the selection changes. */
  const onDeleteRef = useRef<() => void>(() => {});
  /** A press that started on the open/close disc, until the pointer moves far enough to make it a drag. */
  const discPress = useRef<{ id: string; at: Point } | null>(null);
  const lastPaint = useRef(0);
  const grid = p.scene.grid.size;
  const dmSight = p.isDm && !p.playerView;

  useEffect(() => {
    if (!p.pin) { setPinShown(null); return; }
    setPinShown(p.pin);
    const id = window.setTimeout(() => setPinShown(null), PIN_MS);
    return () => window.clearTimeout(id);
  }, [p.pin]);
  useEffect(() => { if (p.tool !== 'wall') setWallStart(null); if (p.tool !== 'measure') setMeasure(null); }, [p.tool]);
  useEffect(() => { onDeleteRef.current = () => p.onDeleteSelection?.(); });
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
      if (e.key === 'Escape') { setWallStart(null); setGesture(null); setMeasure(null); p.onSelectToken(null); p.onSelectWall?.(null); return; }
      if (e.key === ' ' && !typing(e.target) && !onControl(e.target)) { e.preventDefault(); setSpacePan(true); return; } // preventDefault: space scrolls the table otherwise
      if ((e.key === 'Delete' || e.key === 'Backspace') && !typing(e.target)) { e.preventDefault(); onDeleteRef.current(); }
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
      // Seleccionar: pick a segment (DM only) and grab it, or clear everything.
      const wall = dmSight ? hitWall(p.walls, s, 10 / p.view.zoom) : null;
      if (wall) {
        p.onSelectToken(null);
        p.onSelectWall?.(wall.id);
        const near = (x: number, y: number) => Math.hypot(s.x - x, s.y - y) <= 12 / p.view.zoom;
        const grab = near(wall.x1, wall.y1) ? 'a' : near(wall.x2, wall.y2) ? 'b' : 'whole';
        setGesture({ kind: 'wallEdit', id: wall.id, grab, start: s, origin: { x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 } });
        svgRef.current?.setPointerCapture?.(e.pointerId);
        return;
      }
      p.onSelectToken(null);
      p.onSelectWall?.(null);
      setGesture({ kind: 'marquee', start: s, last: s });
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
      case 'erase': { const hit = hitTest(p.drawings, s, 6 / p.view.zoom); if (hit && canEraseDrawing(hit, p.me, p.isDm)) p.onErase(hit.id); return; }
      case 'wall': {
        if (!dmSight) return;
        // Muro only BUILDS. Opening a door is the hover disc's job, which is what unblocks starting a wall next
        // to a door — that click used to open it instead (specs/modules/maps/SPEC.md § «Rebanada 3»).
        const q = { x: snap(s.x, grid), y: snap(s.y, grid) };
        if (wallStart) {
          p.onAddWall(wallStart, q);
          // A door or a window is ONE segment: chaining would drop a second one where you did not ask for it.
          setWallStart(p.wallKind && p.wallKind !== 'wall' ? null : q);
          return;
        }
        setWallStart(q);
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
      const frenado = blockers.length > 0 && dragged
        ? tokenPointAt(
            slideToken(tokenCenter({ ...gesture.origin, size: dragged.size }, grid), tokenCenter({ ...libre, size: dragged.size }, grid), tokenRadiusPx(dragged, grid), blockers),
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
      const { x, y } = server ?? frenado;
      setLocalDrag({ id: gesture.id, x, y });
      if (!gesture.moved) setGesture({ ...gesture, moved: true });
      p.onDragToken(gesture.id, x, y, libre);
    } else if (gesture.kind === 'draw') {
      setGesture(gesture.tool === 'stroke' ? { ...gesture, points: [...gesture.points, [s.x, s.y]], last: s } : { ...gesture, last: s });
    } else if (gesture.kind === 'marquee') {
      setGesture({ ...gesture, last: s });
    } else if (gesture.kind === 'wallEdit') {
      setWallDraft(wallDragTo(gesture.origin, gesture.grab, gesture.start, s, grid));
    } else if (gesture.kind === 'brush') {
      // Same rate limit as the token drag: every call is a round trip that rewrites the fog row of EVERY player
      // and wakes the whole table through `fog.updated`. One per pointermove would be ~60 a second.
      const now = Date.now();
      if (now - lastPaint.current >= PAINT_HZ_MS) { lastPaint.current = now; p.onPaintFog({ ...s, radius: brushRadius(p.brush, grid) }, gesture.op); }
    } else if (gesture.kind === 'measure' && measure) {
      setMeasure({ a: measure.a, b: s });
    }
  };

  /**
   * Right button: first it ends whatever is half-drawn (a chained wall, a measure) — same job as Escape, but
   * without moving your hand. On empty ground with nothing pending it opens the quick menu instead.
   */
  const onRightClick = (e: ReactPointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (wallStart || measure || gesture) { setWallStart(null); setMeasure(null); setGesture(null); return; }
    p.onContextMenu?.(local(e), toScene(e));
  };

  const onUp = () => {
    const press = discPress.current;
    discPress.current = null;
    if (press) {
      const w = p.walls.find(x => x.id === press.id);
      if (w) p.onToggleWall(w);
    }
    if (!gesture) return;
    if (gesture.kind === 'wallEdit') {
      const at = wallDragTo(gesture.origin, gesture.grab, gesture.start, hover ?? gesture.start, grid);
      const moved = at.x1 !== gesture.origin.x1 || at.y1 !== gesture.origin.y1 || at.x2 !== gesture.origin.x2 || at.y2 !== gesture.origin.y2;
      if (moved) p.onMoveWall?.(gesture.id, at);
      setWallDraft(null);
      setGesture(null);
      return;
    }
    if (gesture.kind === 'marquee') {
      const ids = tokensInRect(tokensShown, gesture.start, gesture.last, grid);
      // A click without a drag is not a marquee — it already cleared the selection on the way down.
      if (Math.hypot(gesture.last.x - gesture.start.x, gesture.last.y - gesture.start.y) > 4) p.onMarquee?.(ids);
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
      if (gesture.moved && localDrag) p.onMoveToken(gesture.id, round2(localDrag.x), round2(localDrag.y));
      setLocalDrag(null);
    } else if (gesture.kind === 'draw') {
      if (gesture.tool === 'stroke') { if (gesture.points.length > 1) p.onAddDrawing('stroke', { points: gesture.points }); }
      else if (Math.hypot(gesture.last.x - gesture.start.x, gesture.last.y - gesture.start.y) > 2) p.onAddDrawing(gesture.tool, shapeData(gesture.tool, gesture.start, gesture.last));
    }
    setGesture(null);
  };

  const wallsShown = dmSight ? (p.showWalls ? p.walls : []) : p.walls.filter(w => w.visiblePlayers);
  /**
   * Los muros que hoy cortan el paso en esta escena. Vacío cuando el interruptor está apagado — y **vacío
   * siempre para el director**, que no choca nunca (decisión del dueño, 2026-08-22). Su contrapartida, dicha
   * en la spec: el director no puede probar en su pantalla lo que siente un jugador; se mira entrando con una
   * cuenta de jugador.
   */
  const blockers = p.isDm ? [] : moveBlockers(p.walls, p.scene);
  const tokensShown = dmSight ? p.tokens : p.tokens.filter(tk => tk.visible);
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

  return (
    <svg ref={svgRef} className="mp-svg" data-tool={p.tool} style={{ cursor }} aria-label={t('maps.canvas.label')} role="application"
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={() => setHover(null)} onContextMenu={onRightClick}>
      <defs>
        <clipPath id={clipId}><rect x={0} y={0} width={p.scene.width} height={p.scene.height} /></clipPath>
        {fog && <FogMasks scene={p.scene} fog={fog} ids={fogIds} />}
      </defs>
      <g transform={`translate(${p.view.panX} ${p.view.panY}) scale(${p.view.zoom})`}>
        <g className="mp-layer-map" {...(playerSight ? { mask: url(fogIds.seen) } : {})} data-testid="mp-map">
          <BackgroundLayer scene={p.scene} clipId={clipId} />
          <GridLayer scene={p.scene} patternId={`mp-grid-${p.scene.id}`} />
          {dmSight && fog && <rect {...sceneRect} className="mp-fog-veil" mask={url(fogIds.unexplored)} data-testid="mp-fog-veil" />}
          <g className="mp-layer-walls" data-testid="mp-walls">
            {wallsShown.map(w => <WallShape key={w.id} wall={w} selected={w.id === p.selectedWallId} draft={wallDraft && w.id === p.selectedWallId ? wallDraft : null} />)}
            {wallStart && hover && p.tool === 'wall' && <line x1={wallStart.x} y1={wallStart.y} x2={snap(hover.x, grid)} y2={snap(hover.y, grid)} className="mp-wall draft" />}
          </g>
          <g className="mp-layer-drawings" data-testid="mp-drawings">
            {p.drawings.map(d => <DrawingShape key={d.id} d={d} />)}
            {draft && <DrawingShape d={draft} draft />}
          </g>
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
        </g>
      </g>
    </svg>
  );
}
