import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SceneVision } from '@rolvium/core';
import type { Drawing, Layer, LayerPatch, Light, LightPatch, NewDrawing, NewLight, NewToken, NewWall, RowChange, Scene, Token, Wall, WallPatch } from '../domain/entities/Scene';
import type { MapsLiveEvent, MapsPort } from '../domain/ports/MapsPort';
import type { VisionPort } from '../domain/ports/VisionPort';
import { wallPiece, type Point, type WallSplit } from '../domain/useCases/mapRules';
import { nextTerrainSortOrder, reorderTerrain } from '../domain/useCases/layerRules';

export interface LiveDrag { tokenId: string; x: number; y: number }
export interface LivePin { x: number; y: number; by: string; at: number }

function applyChange<T extends { id: string }>(list: T[], c: RowChange<T>): T[] {
  if (c.type === 'DELETE') return list.filter(i => i.id !== c.id);
  if (!c.row) return list;
  const i = list.findIndex(x => x.id === c.id);
  if (i < 0) return [...list, c.row];
  const next = [...list]; next[i] = c.row; return next;
}

const DRAG_HZ_MS = 50; // ~20 Hz (specs/core/realtime: broadcast 20–30 Hz)
/** La niebla se repregunta al servidor mucho más despacio que el broadcast: cada una es una ida y vuelta. */
const VISION_DRAG_HZ_MS = 140; // ~7 Hz
/**
 * PEGADO a un muro (hay corrección en pie) se pregunta al ritmo del broadcast: despegarse espera a que el
 * servidor diga «ya cabes», y a 7 Hz ese despegue daba un tirón visible de hasta 140 ms. A 20 Hz no se nota,
 * y sólo se paga mientras se está en contacto — que es poco tiempo y pocos jugadores a la vez.
 */
const VISION_CONTACT_HZ_MS = 50; // ~20 Hz

/**
 * Loads a scene's tokens/walls/drawings, follows the scene channel and exposes the actions the
 * canvas needs. Optimistic updates for what I change; realtime brings everyone else's.
 *
 * Vision is the exception: it is never computed here. `vision.refresh` asks the API, which is the only side that
 * holds every wall. It also cannot arrive by `postgres_changes`, because that applies each subscriber's RLS and a
 * player is not allowed to see the row of a hidden door — so a `fog.updated` broadcast (no RLS) says «ask again»
 * and every client refetches its own (specs/modules/maps/SPEC.md § «Rebanada 2 — luz y aberturas»).
 */
export function useScene(repo: MapsPort, scene: Scene | null, me: string, vision?: VisionPort) {
  const sceneId = scene?.id ?? null;
  const [tokens, setTokens] = useState<Token[]>([]);
  const [walls, setWalls] = useState<Wall[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [lights, setLights] = useState<Light[]>([]);
  const [live, setLive] = useState<Scene | null>(scene);
  const [drags, setDrags] = useState<Record<string, LiveDrag>>({});
  const [pin, setPin] = useState<LivePin | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [fog, setFog] = useState<SceneVision | null>(null);
  const lastSent = useRef(0);
  /** Set below; kept in a ref so the realtime subscription never has to be torn down when the callback changes. */
  const refreshVisionRef = useRef<() => void>(() => {});
  /** Answers can overtake each other; only the newest request may write. */
  const visionSeq = useRef(0);
  const visionTimer = useRef<number | null>(null);

  useEffect(() => { setLive(scene); }, [scene]);

  useEffect(() => {
    if (!sceneId) { setTokens([]); setWalls([]); setDrawings([]); setLayers([]); setLights([]); setStatus('ready'); return; }
    let alive = true;
    setStatus('loading');
    void Promise.all([repo.listTokens(sceneId), repo.listWalls(sceneId), repo.listDrawings(sceneId), repo.listLayers(sceneId), repo.listLights(sceneId)])
      .then(([t, w, d, ly, li]) => { if (!alive) return; setTokens(t); setWalls(w); setDrawings(d); setLayers(ly); setLights(li); setStatus('ready'); })
      .catch(() => { if (alive) setStatus('error'); });
    const off = repo.subscribe(sceneId, {
      onScene: c => { if (c.type === 'DELETE') setLive(null); else if (c.row) setLive(c.row); },
      onToken: c => { setTokens(l => applyChange(l, c)); if (c.type !== 'INSERT') setDrags(d => { if (!d[c.id]) return d; const n = { ...d }; delete n[c.id]; return n; }); },
      onWall: c => setWalls(l => applyChange(l, c)),
      onDrawing: c => setDrawings(l => applyChange(l, c)),
      /**
       * Capas y luces (rebanada 7). NO tocan `refreshVision`: una capa es composición y una luz es pintura —
       * no revelan niebla ni entran en el cálculo de visión. El día que las luces iluminen, eso sí será una
       * decisión de reglas y volverá a pasar por el spec.
       */
      onLayer: c => setLayers(l => applyChange(l, c)),
      onLight: c => setLights(l => applyChange(l, c)),
      onEvent: (e: MapsLiveEvent) => {
        if (e.type === 'token.moved') {
          if (e.final) setDrags(d => { const n = { ...d }; delete n[e.tokenId]; return n; });
          else setDrags(d => ({ ...d, [e.tokenId]: { tokenId: e.tokenId, x: e.x, y: e.y } }));
        } else if (e.type === 'pin.focused' && e.by !== me) setPin({ x: e.x, y: e.y, by: e.by, at: Date.now() });
        // Someone opened a door, moved a token or painted the fog: refetch mine. Never re-broadcast — that would loop.
        else if (e.type === 'fog.updated' && e.userId !== me) refreshVisionRef.current();
      },
    });
    return () => { alive = false; off(); setDrags({}); setPin(null); };
  }, [repo, sceneId, me]);

  // ── vision ──
  /**
   * Ask the server what I can see and remember it. Never announces anything by itself: the caller decides.
   *
   * Coalesced on a trailing tick: entering a scene settles the scene, then its tokens and its walls, and each of
   * those is a reason to recompute. Without this they would be three round trips for one answer.
   */
  const refreshVision = useCallback((): void => {
    if (!sceneId || !vision) return;
    if (visionTimer.current !== null) window.clearTimeout(visionTimer.current);
    visionTimer.current = window.setTimeout(() => {
      visionTimer.current = null;
      const seq = ++visionSeq.current;
      void vision.refresh(sceneId).then(next => { if (seq === visionSeq.current) setFog(next); }).catch(() => undefined);
    }, 0);
  }, [vision, sceneId]);
  useEffect(() => () => { if (visionTimer.current !== null) window.clearTimeout(visionTimer.current); }, []);
  useEffect(() => { refreshVisionRef.current = refreshVision; }, [refreshVision]);

  /** Tell the rest of the table that what they can see may have changed, then refresh mine. */
  const announceVision = useCallback(() => {
    if (sceneId && live) repo.broadcast(sceneId, { type: 'fog.updated', campaignId: live.campaignId, sceneId, userId: me });
  }, [repo, sceneId, live, me]);

  useEffect(() => { setFog(null); }, [sceneId]);
  /** Light, fog mode and walls all change what is visible; so does any of MY tokens moving. */
  const myTokenKey = tokens.filter(t => t.controlledBy === me).map(t => `${t.id}:${t.x}:${t.y}:${t.size}`).join('|');
  const wallKey = walls.map(w => `${w.id}:${w.isOpen ? 1 : 0}:${w.blocksSight ? 1 : 0}`).join('|');
  /** One effect, so entering the scene costs ONE round trip and every later cause costs one more. */
  useEffect(() => { refreshVision(); }, [refreshVision, myTokenKey, wallKey, live?.lighting, live?.nightRadiusM, live?.fogMode]);

  /**
   * La niebla SIGUE al token mientras se arrastra, en vez de dar un salto al soltarlo (dueño, 2026-08-22).
   *
   * Va a su propio ritmo, mucho más lento que el del broadcast: el aviso a la mesa es un mensaje suelto por un
   * canal ya abierto, y esto es una ida y vuelta al servidor que además calcula geometría. A 20 Hz serían 20
   * peticiones por segundo por jugador. A ~7 Hz el ojo ya lo lee como continuo.
   *
   * Sólo para MIS tokens: la visión que se pide es la mía, y mover el token de otro no cambia lo que yo veo.
   */
  const visionDrag = useRef(0);
  /** Lo último que el servidor dijo sobre dónde puede estar el token que se arrastra. `null` = no ha dicho nada. */
  const correctedRef = useRef<{ tokenId: string; x: number; y: number } | null>(null);
  /** Lo consulta `MapCanvas` mientras arrastra, para obedecer al servidor sin esperar al final. */
  const serverCorrection = useCallback((tokenId: string) => {
    const c = correctedRef.current;
    return c && c.tokenId === tokenId ? { x: c.x, y: c.y } : null;
  }, []);
  /**
   * El DISCO LIBRE que el servidor confirmó con su última respuesta: alrededor de esa posición hay
   * `clearance` casillas sin ningún muro, también secretos. `MapCanvas` no pinta más allá de él — sin esto,
   * entre pregunta y pregunta (~7/s) el token seguía al dedo a ciegas, se metía en el muro que no ve y al
   * llegar la corrección REBOTABA hacia atrás (dueño, 2026-08-22). `null` = sin física o sin dato: pintado
   * libre, como siempre.
   */
  const motionRef = useRef<{ tokenId: string; x: number; y: number; clearance: number } | null>(null);
  const dragBound = useCallback((tokenId: string) => {
    const m = motionRef.current;
    return m && m.tokenId === tokenId ? { x: m.x, y: m.y, clearance: m.clearance } : null;
  }, []);
  /**
   * `x`/`y` es donde el token está (ya frenado/corregido) y va al broadcast de la mesa; `desired` es a dónde
   * quería ir el dedo y es lo que se le pregunta al servidor. Preguntar por `x`/`y` era el fallo de la
   * oscilación: el servidor veía caber su propia corrección, contestaba `null` («sólo contesto si recorto»),
   * `correctedRef` se borraba y el token saltaba al otro lado del muro en el tick siguiente.
   */
  const dragToken = useCallback((tokenId: string, x: number, y: number, desired?: Point) => {
    if (!sceneId || !live) return;
    const now = Date.now();
    const throttle = correctedRef.current?.tokenId === tokenId ? VISION_CONTACT_HZ_MS : VISION_DRAG_HZ_MS;
    if (now - visionDrag.current >= throttle && vision && tokens.some(t => t.id === tokenId && t.controlledBy === me)) {
      visionDrag.current = now;
      const seq = ++visionSeq.current;
      const asked = desired ?? { x, y };
      /**
       * El barrido del servidor sale de la última posición QUE ÉL MISMO CONTESTÓ (`from`) hacia el deseo del
       * dedo. Anclarlo a la posición guardada al empezar el arrastre era el fallo del vértice: pasado el
       * final del muro, la recta origen→dedo seguía cruzándolo y el token no podía doblar la esquina.
       *
       * Y `from` NO es la posición pintada: antes de la primera respuesta el pintado puede haber seguido al
       * dedo hasta el otro lado de un muro que no ve, y ese `from` legalizaría el cruce («desde aquí no
       * cruzo nada»). La cadena contestada sale siempre de la posición guardada (primer tick, sin `from`) y
       * cada eslabón lo validó el servidor barriendo desde el anterior.
       */
      const m = motionRef.current;
      const from = m && m.tokenId === tokenId ? { from: { x: m.x, y: m.y } } : {};
      void vision.refresh(sceneId, { tokenId, x: asked.x, y: asked.y, ...from }).then(next => {
        if (seq !== visionSeq.current) return;
        setFog(next);
        /**
         * La palabra final sobre DÓNDE puede estar el token es del servidor: es el único que tiene todos los
         * muros, incluidos los secretos, que a este navegador no le llegan. Si nos corrige, se obedece —
         * `correctedRef` lo lee el arrastre y lo aplica sin esperar a soltar.
         */
        correctedRef.current = next.corrected ?? null;
        const answered = next.corrected ?? asked;
        motionRef.current = typeof next.clearance === 'number'
          ? { tokenId, x: answered.x, y: answered.y, clearance: next.clearance }
          : null;
      }).catch(() => undefined);
    }
    if (now - lastSent.current < DRAG_HZ_MS) return;
    lastSent.current = now;
    repo.broadcast(sceneId, { type: 'token.moved', campaignId: live.campaignId, sceneId, tokenId, x, y, final: false });
  }, [repo, sceneId, live, vision, tokens, me]);

  const moveToken = useCallback(async (tokenId: string, x: number, y: number) => {
    if (!sceneId || !live) return;
    // La corrección y el disco valen para ESTE arrastre: si se quedaran, clavarían el siguiente en el sitio viejo.
    correctedRef.current = null;
    motionRef.current = null;
    // Y se invalida cualquier respuesta EN VUELO: si aterrizara después de este limpiado re-sembraría la
    // cadena con el ancla del arrastre que acaba de terminar (review, 3.ª ronda). La niebla no pierde nada:
    // el refresco de después de soltar (efecto de `myTokenKey`) trae la suya con un número más alto.
    ++visionSeq.current;
    setTokens(l => l.map(t => (t.id === tokenId ? { ...t, x, y } : t)));
    repo.broadcast(sceneId, { type: 'token.moved', campaignId: live.campaignId, sceneId, tokenId, x, y, final: true });
    await repo.updateToken(tokenId, { x, y });
    // My own vision follows the token through the effect below; the DM's union of explored does not, so announce it.
    announceVision();
  }, [repo, sceneId, live, announceVision]);

  const addToken = useCallback(async (t: NewToken) => { const created = await repo.addToken(t); setTokens(l => (l.some(x => x.id === created.id) ? l : [...l, created])); return created; }, [repo]);
  const removeToken = useCallback(async (id: string) => { setTokens(l => l.filter(t => t.id !== id)); await repo.removeToken(id); }, [repo]);
  const patchToken = useCallback(async (id: string, patch: Partial<Token>) => { setTokens(l => l.map(t => (t.id === id ? { ...t, ...patch } : t))); await repo.updateToken(id, patch); }, [repo]);
  const addDrawing = useCallback(async (d: NewDrawing) => { const created = await repo.addDrawing(d); setDrawings(l => (l.some(x => x.id === created.id) ? l : [...l, created])); return created; }, [repo]);
  const eraseDrawing = useCallback(async (id: string) => { setDrawings(l => l.filter(d => d.id !== id)); await repo.removeDrawing(id); }, [repo]);
  const clearMine = useCallback(async () => { if (!sceneId) return; setDrawings(l => l.filter(d => d.authorId !== me)); await repo.removeMyDrawings(sceneId); }, [repo, sceneId, me]);
  const clearAll = useCallback(async () => { if (!sceneId) return; setDrawings([]); await repo.removeAllDrawings(sceneId); }, [repo, sceneId]);
  /**
   * DM: a new segment. When it is an opening drawn over a wall (`split`, planned by `mapRules.planOpening`) the
   * wall is REPLACED: its leftovers go in first and the host comes out last, so a failure halfway leaves the wall
   * whole and overlapping — never a hole in the plan nobody asked for.
   */
  const addWall = useCallback(async (w: NewWall, split?: WallSplit | null) => {
    const pieces = split ? await Promise.all(split.pieces.map(pc => repo.addWall(wallPiece(split.host, pc)))) : [];
    const created = await repo.addWall(w);
    if (split) await repo.removeWall(split.host.id);
    setWalls(l => {
      const fresh = [...pieces, created];
      // Realtime may have brought any of these back already; the host is gone either way.
      return [...l.filter(x => x.id !== split?.host.id && !fresh.some(f => f.id === x.id)), ...fresh];
    });
    announceVision();
    return created;
  }, [repo, announceVision]);
  const removeWall = useCallback(async (id: string) => { setWalls(l => l.filter(w => w.id !== id)); await repo.removeWall(id); announceVision(); }, [repo, announceVision]);
  /** DM: open/close a door or window. The players cannot learn it from `postgres_changes`, so this announces it. */
  const patchWall = useCallback(async (id: string, patch: WallPatch) => {
    setWalls(l => l.map(w => (w.id === id ? { ...w, ...patch } : w)));
    await repo.updateWall(id, patch);
    announceVision();
  }, [repo, announceVision]);
  /** DM, Seleccionar: the segment moved or a vertex was stretched — geometry only, but it changes every sightline. */
  const patchWallGeometry = useCallback(async (id: string, at: { x1: number; y1: number; x2: number; y2: number }) => {
    setWalls(l => l.map(w => (w.id === id ? { ...w, ...at } : w)));
    await repo.updateWallGeometry(id, at);
    announceVision();
  }, [repo, announceVision]);
  /** DM brush: paints on every player's explored cells; the answer is the DM's own union. */
  const paintFog = useCallback(async (at: { x: number; y: number; radius: number }, op: 'reveal' | 'hide') => {
    if (!sceneId || !vision) return;
    const seq = ++visionSeq.current;
    const next = await vision.paint(sceneId, op, at);
    if (seq === visionSeq.current) setFog(next);
    announceVision();
  }, [vision, sceneId, announceVision]);
  const paintAllFog = useCallback(async (op: 'reveal' | 'hide') => {
    if (!sceneId || !vision) return;
    const seq = ++visionSeq.current;
    const next = await vision.paintAll(sceneId, op);
    if (seq === visionSeq.current) setFog(next);
    announceVision();
  }, [vision, sceneId, announceVision]);
  // ── capas y luces (rebanada 7) ──
  /** Sólo el director. Las tres fijas las crea un disparador al nacer la escena: por aquí sólo pasa TERRENO. */
  /**
   * Mandar un TRAZO a otra capa. Los dibujos no tenían actualización hasta ahora —se ponían y se borraban—,
   * y la RLS ya la permite al director (`maps_drawings_dm_update`, de la rebanada 1).
   */
  const patchDrawingLayer = useCallback(async (id: string, layerId: string | null) => {
    setDrawings(l => l.map(d => (d.id === id ? { ...d, layerId } : d)));
    await repo.updateDrawingLayer(id, layerId);
  }, [repo]);

  const addTerrainLayer = useCallback(async (over: Partial<Pick<Layer, 'name' | 'imageUrl'>> = {}) => {
    if (!sceneId || !live) return null;
    const created = await repo.addLayer({ sceneId, campaignId: live.campaignId, kind: 'terrain', sortOrder: nextTerrainSortOrder(layers), ...over });
    setLayers(l => (l.some(x => x.id === created.id) ? l : [...l, created]));
    return created;
  }, [repo, sceneId, live, layers]);
  const patchLayer = useCallback(async (id: string, patch: LayerPatch) => {
    setLayers(l => l.map(x => (x.id === id ? { ...x, ...patch } : x)));
    await repo.updateLayer(id, patch);
  }, [repo]);
  /**
   * Borrar una capa se lleva sus dibujos y sus luces —lo hace la base de datos con ON DELETE CASCADE— pero
   * las FICHAS vuelven a su capa natural en vez de desaparecer: perder el personaje de un jugador por borrar
   * una capa decorativa sería un desastre silencioso. Aquí se espeja para que la pantalla no mienta hasta que
   * llegue el realtime.
   */
  const removeLayer = useCallback(async (id: string) => {
    setLayers(l => l.filter(x => x.id !== id));
    setDrawings(l => l.filter(d => d.layerId !== id));
    setLights(l => l.filter(x => x.layerId !== id));
    setTokens(l => l.map(t => (t.layerId === id ? { ...t, layerId: null } : t)));
    await repo.removeLayer(id);
  }, [repo]);
  /** Subir o bajar una capa de terreno: sólo se escriben las dos filas que cambian de sitio. */
  const reorderLayer = useCallback(async (id: string, dir: 'up' | 'down') => {
    const moves = reorderTerrain(layers, id, dir);
    if (moves.length === 0) return;
    setLayers(l => l.map(x => { const m = moves.find(v => v.id === x.id); return m ? { ...x, sortOrder: m.sortOrder } : x; }));
    await Promise.all(moves.map(m => repo.updateLayer(m.id, { sortOrder: m.sortOrder })));
  }, [repo, layers]);
  /** El pincel de transparencia: sube el PNG y sube la versión. La foto de la capa no se toca nunca. */
  const saveMask = useCallback(async (layer: Layer, png: Blob) => {
    const next = await repo.saveMask(layer, png);
    setLayers(l => l.map(x => (x.id === next.id ? next : x)));
    return next;
  }, [repo]);
  const clearMask = useCallback(async (layer: Layer) => {
    setLayers(l => l.map(x => (x.id === layer.id ? { ...x, maskUrl: null } : x)));
    await repo.clearMask(layer);
  }, [repo]);

  const addLight = useCallback(async (l: NewLight) => {
    const created = await repo.addLight(l);
    setLights(list => (list.some(x => x.id === created.id) ? list : [...list, created]));
    return created;
  }, [repo]);
  const patchLight = useCallback(async (id: string, patch: LightPatch) => {
    setLights(list => list.map(x => (x.id === id ? { ...x, ...patch } : x)));
    await repo.updateLight(id, patch);
  }, [repo]);
  const removeLight = useCallback(async (id: string) => { setLights(list => list.filter(x => x.id !== id)); await repo.removeLight(id); }, [repo]);

  const focusPin = useCallback((p: Point) => {
    if (!sceneId || !live) return;
    repo.broadcast(sceneId, { type: 'pin.focused', campaignId: live.campaignId, sceneId, x: p.x, y: p.y, by: me });
    setPin({ x: p.x, y: p.y, by: me, at: Date.now() });
  }, [repo, sceneId, live, me]);

  return useMemo(() => ({
    scene: live, tokens, walls, drawings, layers, lights, drags, pin, status, fog,
    dragToken, dragBound, moveToken, addToken, removeToken, patchToken, addDrawing, eraseDrawing, clearMine, clearAll, addWall, removeWall, patchWall, patchWallGeometry, focusPin,
    refreshVision, paintFog, paintAllFog, serverCorrection,
    addTerrainLayer, patchLayer, removeLayer, reorderLayer, saveMask, clearMask, addLight, patchLight, removeLight, patchDrawingLayer,
  }), [live, tokens, walls, drawings, layers, lights, drags, pin, status, fog, dragToken, dragBound, moveToken, addToken, removeToken, patchToken, addDrawing, eraseDrawing, clearMine, clearAll, addWall, removeWall, patchWall, patchWallGeometry, focusPin, refreshVision, paintFog, paintAllFog, serverCorrection, addTerrainLayer, patchLayer, removeLayer, reorderLayer, saveMask, clearMask, addLight, patchLight, removeLight, patchDrawingLayer]);
}
export type SceneState = ReturnType<typeof useScene>;
