import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FogCell, SceneVision } from '@rolvium/core';
import type { Drawing, Layer, LayerPatch, Light, LightPatch, NewDrawing, NewLight, NewToken, NewWall, RowChange, Scene, Token, Wall, WallPatch } from '../domain/entities/Scene';
import type { MapsLiveEvent, MapsPort } from '../domain/ports/MapsPort';
import type { VisionPort } from '../domain/ports/VisionPort';
import { unionCells, wallPiece, type Point, type WallSplit } from '../domain/useCases/mapRules';
import { nextTerrainSortOrder, reorderTerrain, reorderTerrainTo } from '../domain/useCases/layerRules';
import { newGroupId } from '../domain/useCases/groupRules';

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
export function useScene(repo: MapsPort, scene: Scene | null, me: string, vision?: VisionPort,
  /**
   * LA SONDA DE PRUEBA (§ 7.3): dónde está puesta, en px de escena, o `null` si no lo está. Sólo del director.
   * Mientras esté puesta, la visión que se pide es la de ESE PUNTO y **la memoria la lleva este navegador**:
   * el servidor contesta lo que se ve desde ahí y aquí se va uniendo. Al quitarla, se tira.
   */
  probe: { x: number; y: number } | null = null) {
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
  /** Lo que la sonda lleva visto. Vive aquí y NO en la base: se tira al quitarla o al cambiar de escena. */
  const probeSeen = useRef<FogCell[]>([]);
  const probeKey = probe ? `${probe.x}:${probe.y}` : '';
  const probeOn = probe !== null;
  /** En un ref: mover la sonda no puede rehacer la suscripción de tiempo real ni la petición en vuelo. */
  const probeRef = useRef(probe);
  useEffect(() => { probeRef.current = probe; }, [probe]);
  const withProbeMemory = useCallback((next: SceneVision): SceneVision => {
    if (!probeRef.current) return next;
    probeSeen.current = unionCells(probeSeen.current, next.explored);
    return { ...next, explored: probeSeen.current };
  }, []);
  /**
   * 🔒 CON LA SONDA PUESTA, SÓLO UNA RESPUESTA DE LA SONDA PINTA LA NIEBLA.
   *
   * Sin esta regla, cualquier otra pregunta de visión —arrastrar un token, pintar con el pincel— le borraba
   * la vista de la sonda al director, porque a él el servidor le contesta «todo lo explorado por TODOS», y eso
   * no es lo que la sonda viene a enseñar. Se veía tal cual (dueño, 2026-09-02): la sonda puesta enseñaba el
   * mapa a oscuras, bien, y al tocar un token «ya activa todo como si hubiera pasado».
   *
   * El fallo llevaba ahí desde que existe la sonda; lo que lo destapó fue arreglar el pincel de niebla. Antes,
   * su campaña no tenía jugadores, así que «lo explorado por todos» venía VACÍO y pisar la niebla con eso no
   * se notaba. En cuanto el director pasó a tener su propia fila, esa respuesta traía el mapa entero.
   *
   * Lo que NO se toca: la corrección de posición del servidor sigue leyéndose igual, porque de eso depende que
   * un token no atraviese un muro. Aquí sólo se decide quién puede pintar la niebla.
   */
  const applyFog = useCallback((next: SceneVision, fromProbe = false): void => {
    if (probeRef.current && !fromProbe) return;
    setFog(withProbeMemory(next));
  }, [withProbeMemory]);

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
       * Capas y luces (rebanada 7). Desde § 7.2 una luz SÍ entra en el cálculo de visión —alumbra, y se
       * recorta contra los muros—, así que un cambio suyo tiene que volver a preguntar. No se pide aquí sino
       * a través de `lightKey`/`layerKey` más abajo, para que valga igual cuando el cambio lo hace este
       * mismo navegador y no llega por el canal en vivo.
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
      void vision.refresh(sceneId, undefined, probeRef.current ? { probe: probeRef.current } : undefined)
        .then(next => { if (seq === visionSeq.current) applyFog(next, true); }).catch(() => undefined);
    }, 0);
  }, [vision, sceneId, applyFog]);
  useEffect(() => () => { if (visionTimer.current !== null) window.clearTimeout(visionTimer.current); }, []);
  useEffect(() => { refreshVisionRef.current = refreshVision; }, [refreshVision]);

  /** Tell the rest of the table that what they can see may have changed, then refresh mine. */
  const announceVision = useCallback(() => {
    if (sceneId && live) repo.broadcast(sceneId, { type: 'fog.updated', campaignId: live.campaignId, sceneId, userId: me });
  }, [repo, sceneId, live, me]);

  useEffect(() => { setFog(null); }, [sceneId]);
  /**
   * La memoria de la sonda se acumula AQUÍ y se tira entera al quitarla o al cambiar de escena (§ 7.3,
   * decisión cerrada del dueño: «que quede en memoria, si es sólo para probar»). Nada de esto se escribe.
   */
  useEffect(() => { probeSeen.current = []; }, [sceneId, probeOn]);
  /** Light, fog mode and walls all change what is visible; so does any of MY tokens moving. */
  const myTokenKey = tokens.filter(t => t.controlledBy === me).map(t => `${t.id}:${t.x}:${t.y}:${t.size}`).join('|');
  const wallKey = walls.map(w => `${w.id}:${w.isOpen ? 1 : 0}:${w.blocksSight ? 1 : 0}`).join('|');
  /**
   * Y desde § 7.2, las luces: mover una, cambiarle el alcance o la forma, o apagarle la sombra, cambia lo
   * que se ve. Sólo lo que altera la GEOMETRÍA del charco — el color y el parpadeo son pintura y no valen
   * una ida y vuelta. La capa entra porque apagarla apaga la luz que vive en ella.
   */
  const lightKey = lights.map(l => `${l.id}:${l.x}:${l.y}:${l.rotation}:${l.shape}:${l.coneAngle}:${l.rangeM}:${l.castsShadow ? 1 : 0}:${l.layerId ?? ''}`).join('|');
  const layerKey = layers.map(l => `${l.id}:${l.visible ? 1 : 0}:${l.kind}`).join('|');
  /** One effect, so entering the scene costs ONE round trip and every later cause costs one more. */
  useEffect(() => { refreshVision(); }, [refreshVision, myTokenKey, wallKey, lightKey, layerKey, probeOn, live?.lighting, live?.nightRadiusM, live?.fogMode]);
  /**
   * ARRASTRAR LA SONDA VA CON EL MISMO FRENO QUE ARRASTRAR UNA FICHA, y esto no es un adorno.
   *
   * Mover la sonda cambia lo que se ve, así que hay que volver a preguntar; pero un `pointermove` dispara
   * ~60 veces por segundo y cada pregunta es una ida y vuelta al servidor que además calcula geometría.
   * Sin freno se le mandaban 60 peticiones por segundo: llegaban tarde y desordenadas, `visionSeq` tiraba
   * casi todas, y en pantalla la niebla parecía NO seguir a la sonda (dueño, 2026-09-01: «las sombras no se
   * comportan como en el modo jugador, que se van ajustando de manera dinámica»). Ese era el fallo, no el
   * motor: el de la ficha del jugador ya iba frenado a ~7 Hz desde la rebanada 2 y aquí faltaba copiarlo.
   *
   * Con cola en el borde de salida: la ÚLTIMA posición se pregunta siempre, aunque caiga dentro de la
   * ventana del freno. Si no, soltar la sonda podía dejar la niebla en la penúltima posición.
   */
  const probeTick = useRef(0);
  const probeTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!probeKey) return;
    const ask = (): void => { probeTick.current = Date.now(); refreshVisionRef.current(); };
    const desde = Date.now() - probeTick.current;
    if (desde >= VISION_DRAG_HZ_MS) { ask(); return; }
    if (probeTimer.current !== null) window.clearTimeout(probeTimer.current);
    probeTimer.current = window.setTimeout(ask, VISION_DRAG_HZ_MS - desde);
    return () => { if (probeTimer.current !== null) window.clearTimeout(probeTimer.current); };
  }, [probeKey]);

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
        applyFog(next);
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
  }, [repo, sceneId, live, vision, tokens, me, applyFog]);

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
   * DM: a new segment. When it is an opening drawn over walls (`splits`, planned by `mapRules.planOpening`) each
   * of those walls is REPLACED: the leftovers go in first and the hosts come out last, so a failure halfway
   * leaves the masonry whole and overlapping — never a hole in the plan nobody asked for.
   *
   * Son VARIOS y no uno: una puerta dibujada de un tirón sobre dos muros seguidos tiene que partirlos los dos,
   * o el que sobrevive se queda macizo tapando el vano (dueño, 2026-09-01).
   */
  const addWall = useCallback(async (w: NewWall, splits: WallSplit[] = []) => {
    const pieces = await Promise.all(splits.flatMap(s => s.pieces.map(pc => repo.addWall(wallPiece(s.host, pc)))));
    const created = await repo.addWall(w);
    for (const s of splits) await repo.removeWall(s.host.id);
    setWalls(l => {
      const fresh = [...pieces, created];
      const hosts = new Set(splits.map(s => s.host.id));
      // Realtime may have brought any of these back already; the hosts are gone either way.
      return [...l.filter(x => !hosts.has(x.id) && !fresh.some(f => f.id === x.id)), ...fresh];
    });
    announceVision();
    return created;
  }, [repo, announceVision]);
  /**
   * UNA HABITACIÓN DE GOLPE (§ «Rebanada 8»): N muros normales escritos de una vez.
   *
   * No hay entidad «habitación», a propósito — lo levantado se edita, se abre en puerta, se parte y se borra
   * muro a muro con todo lo que ya existe, y la niebla lo tiene en cuenta sin enterarse de que salió de aquí.
   *
   * Y no pasa por `planOpening`: una sala se LEVANTA, no abre huecos. Las puertas las abre él después, con el
   * mismo disco de siempre.
   */
  const addRoom = useCallback(async (sides: NewWall[]) => {
    if (!sides.length) return [];
    // 🧩 Los muros de UN gesto nacen ATADOS (§ «EL GRUPO»): once muros en círculo son una cosa, y de ahí sale
    // que un clic los coja todos y que se muevan y se estiren juntos. Un muro suelto sigue naciendo suelto —
    // el Builder de siempre, clic a clic, no pasa por aquí y no se ha tocado.
    const groupId = newGroupId();
    // De una sola vez, y a propósito: uno a uno, si falla el enésimo lado la sala se queda ABIERTA y por ahí
    // se cuela la visión, avisando sólo con el banner genérico. `addWalls` los mete todos o ninguno.
    const created = await repo.addWalls(sides.map(w => ({ ...w, groupId })));
    // Realtime may have brought any of them back already while the batch was in flight.
    setWalls(l => [...l.filter(x => !created.some(c => c.id === x.id)), ...created]);
    announceVision();
    return created;
  }, [repo, announceVision]);
  /**
   * ATAR A MANO lo que ya estaba marcado (§ «EL GRUPO»). Su elección del 2026-09-03: sin esto, todos los muros
   * que lleva meses marcando sobre fotos se quedaban fuera del invento para siempre.
   */
  const groupWalls = useCallback(async (ids: string[]) => {
    if (ids.length < 2) return null;
    const groupId = newGroupId();
    setWalls(l => l.map(w => (ids.includes(w.id) ? { ...w, groupId } : w)));
    await repo.setWallsGroup(ids, groupId);
    return groupId;
  }, [repo]);
  /** SOLTAR: deshace el grupo y deja los muros sueltos, cada uno por su cuenta. La geometría no se toca. */
  const ungroupWalls = useCallback(async (groupId: string) => {
    const ids = walls.filter(w => w.groupId === groupId).map(w => w.id);
    if (!ids.length) return;
    setWalls(l => l.map(w => (w.groupId === groupId ? { ...w, groupId: null } : w)));
    await repo.setWallsGroup(ids, null);
  }, [repo, walls]);
  /**
   * MOVER O ESTIRAR un grupo entero (§ «EL GRUPO»). Una sola escritura: un grupo a medio mover deja la forma
   * rota y el hueco por el que se cuela la visión — el mismo fallo que ya nos mordió con `addRoom`.
   */
  const transformWalls = useCallback(async (batch: Wall[]) => {
    if (!batch.length) return;
    const byId = new Map(batch.map(w => [w.id, w]));
    setWalls(l => l.map(w => byId.get(w.id) ?? w));
    await repo.updateWallsGeometry(batch);
    announceVision();
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
    if (seq === visionSeq.current) applyFog(next);
    announceVision();
  }, [vision, sceneId, announceVision, applyFog]);
  const paintAllFog = useCallback(async (op: 'reveal' | 'hide') => {
    if (!sceneId || !vision) return;
    const seq = ++visionSeq.current;
    const next = await vision.paintAll(sceneId, op);
    if (seq === visionSeq.current) applyFog(next);
    announceVision();
  }, [vision, sceneId, announceVision, applyFog]);
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

  /**
   * Mover un trazo: se pinta ya en su sitio nuevo y se guarda. Optimista como todo lo de aquí — el arrastre
   * ya enseñó dónde iba a caer, así que esperar a la respuesta sólo produciría un parpadeo hacia atrás.
   */
  const moveDrawing = useCallback(async (id: string, data: Drawing['data']) => {
    setDrawings(l => l.map(d => (d.id === id ? { ...d, data } : d)));
    await repo.updateDrawingData(id, data);
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
  /**
   * Soltar una capa encima de otra. Comparte camino con subir/bajar a propósito: las dos calculan qué filas
   * cambian de sitio y escriben SÓLO ésas, así que arrastrar tres posiciones cuesta lo mismo que darle tres
   * veces al botón, y ni un viaje más.
   */
  const reorderLayerTo = useCallback(async (id: string, targetId: string) => {
    const moves = reorderTerrainTo(layers, id, targetId);
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
    dragToken, dragBound, moveToken, addToken, removeToken, patchToken, addDrawing, eraseDrawing, clearMine, clearAll, addWall, addRoom, groupWalls, ungroupWalls, transformWalls, removeWall, patchWall, patchWallGeometry, focusPin,
    refreshVision, paintFog, paintAllFog, serverCorrection, moveDrawing,
    addTerrainLayer, patchLayer, removeLayer, reorderLayer, reorderLayerTo, saveMask, clearMask, addLight, patchLight, removeLight, patchDrawingLayer,
  }), [live, tokens, walls, drawings, layers, lights, drags, pin, status, fog, dragToken, dragBound, moveToken, addToken, removeToken, patchToken, addDrawing, eraseDrawing, clearMine, clearAll, addWall, addRoom, groupWalls, ungroupWalls, transformWalls, removeWall, patchWall, patchWallGeometry, focusPin, refreshVision, paintFog, paintAllFog, serverCorrection, addTerrainLayer, patchLayer, removeLayer, reorderLayer, reorderLayerTo, saveMask, clearMask, addLight, patchLight, removeLight, patchDrawingLayer, moveDrawing]);
}
