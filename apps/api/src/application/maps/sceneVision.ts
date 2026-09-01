import { circleClearance, sightRadiusPx, slideCircle, type FogCell, type LitLight, type SceneVision, type VisionPolygon } from '@rolvium/core';
import type { IMapsRepository, LayerRecord, LightRecord, SceneRecord, TokenRecord, WallRecord } from '../../domain/maps/IMapsRepository.js';
import { allCells, boundsSegments, cellsInDisc, cellsInPolygons, clipToStar, lightPolygon, subtractCells, unionCells, visionPolygon, type Point, type Segment } from './vision.js';

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
 * ¿Se pinta lo que vive en esta capa? Misma verdad que el helper SQL `public.maps_layer_sends_to_players` y
 * que `isPainted` del navegador. Hace falta otra vez AQUÍ porque el servidor lee con `service_role` y ve
 * todas las filas, también las de una capa apagada o de notas del director: filtrar es cosa suya.
 */
const layerPaints = (layers: LayerRecord[], layerId: string | null, isDm: boolean): boolean => {
  if (!layerId) return true;                    // NULL = la capa natural de su tipo; ésa siempre se pinta
  const layer = layers.find(l => l.id === layerId);
  if (!layer) return true;                      // capa borrada: la luz cae en su capa natural
  if (!layer.visible) return false;             // el ojo de Photoshop apaga para TODOS, director incluido
  return layer.kind !== 'dm_notes' || isDm;
};

/**
 * Lo que ALUMBRA cada luz, recortado contra los muros y contra lo que quien pregunta alcanza a ver
 * (specs/modules/maps/SPEC.md § 7.2 «Las luces iluminan de verdad»).
 *
 * `eyes === null` es «sin límite de vista»: el director, que conoce todos los muros, y la niebla apagada,
 * donde el director quitó el secreto a propósito. Con ojos, cada charco se corta contra la línea de vista de
 * cada uno — y ese corte es la razón de que esto viva en el servidor: a un jugador no le llegan los muros
 * secretos, así que la silueta de la sombra los delataría por dónde corta.
 */
function litLights(
  lights: LightRecord[], layers: LayerRecord[], segments: Segment[],
  scene: Pick<SceneRecord, 'gridSize'>, isDm: boolean, eyes: Point[] | null,
): LitLight[] {
  if (lights.length === 0) return [];
  // La línea de vista SIN límite de alcance, una vez por ojo: es contra ella contra la que se corta la luz.
  const stars = eyes?.map(eye => ({ eye, star: visionPolygon(eye, segments) })) ?? null;
  const out: LitLight[] = [];
  for (const l of lights) {
    if (!layerPaints(layers, l.layerId, isDm)) continue;
    const radius = sightRadiusPx('night', l.rangeM, scene.gridSize) ?? 0;
    /**
     * 🚨 UN CONO QUE GIRA MANDA EL CÍRCULO ENTERO, y el navegador rota encima la ventana con forma de cono
     * (§ 7.2 «la luz que gira»). No es un atajo: el recorte contra los muros es RADIAL —cada rayo se corta en
     * la primera pared— así que «cono girado a θ, recortado» es exactamente «círculo recortado ∩ sector de θ».
     * Descomponerlo así cuesta lo mismo que una luz quieta; calcular aquí las 24 rotaciones costaría 24 veces
     * más en CADA petición de visión, y el dueño ya se quejó de que «está todo lentísimo».
     */
    const spinning = (l.spinMs ?? 0) > 0 && l.shape === 'cone';
    const poly = lightPolygon({
      origin: { x: l.x, y: l.y }, radius, shape: spinning ? 'radius' : l.shape,
      rotation: l.rotation, coneAngle: l.coneAngle, castsShadow: l.castsShadow,
    }, segments);
    if (poly.length < 3) continue;
    if (!stars) { out.push({ id: l.id, parts: [poly] }); continue; }
    const parts = stars.flatMap(({ eye, star }) => clipToStar(poly, eye, star));
    if (parts.length > 0) out.push({ id: l.id, parts });
  }
  return out;
}

/**
 * `lit` viaja SIEMPRE que la escena tenga alguna luz, aunque a quien pregunta no le alumbre ninguna. Los dos
 * casos dicen cosas distintas y el navegador actúa distinto en cada uno:
 *
 *  - lista VACÍA = «se calculó, y no te alcanza ni una» → se apagan todos los resplandores.
 *  - campo AUSENTE = «esta escena no tiene luces / todavía no hay respuesta» → se pintan enteros.
 *
 * Colapsar el primero en el segundo dejaba el resplandor de una antorcha lejana flotando sobre la niebla de
 * un jugador que no alcanza a ver ni un tramo de ella — justo el chivatazo que § 7.2 viene a evitar.
 */
const litField = (lit: LitLight[], lights: LightRecord[]): { lit?: LitLight[] } => (lights.length > 0 ? { lit } : {});

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
  input: {
    sceneId: string; userId: string;
    at?: { tokenId: string; x: number; y: number; from?: { x: number; y: number } | undefined };
    /**
     * LA SONDA DE PRUEBA (§ 7.3). Un punto en px de escena, SÓLO del director: «qué vería un jugador desde
     * aquí». Sustituye a la lente por personaje que llegó a producción y dejaba el mapa en negro —aquella
     * pedía la memoria del DUEÑO de una ficha, y un director no acumula memoria nunca—. Una sonda **no tiene
     * dueño**, así que no hay memoria que pedir: se contesta lo que se ve DESDE AHÍ y la acumula el navegador.
     *
     * Se calcula aquí y no en su navegador por lo de siempre: a él le llegan muros que un jugador no conoce,
     * y comprobar que lo que ve él y lo que ve el jugador coinciden es justo para lo que sirve la sonda.
     *
     * **No escribe una sola fila.**
     */
    probe?: { x: number; y: number };
  },
): Promise<VisionOutcome> {
  const scene = await deps.maps.getScene(input.sceneId);
  if (!scene) return { ok: false, code: 'NOT_FOUND' };
  const role = await deps.maps.roleOf(scene.campaignId, input.userId);
  if (!role) return { ok: false, code: 'FORBIDDEN' };

  const radiusPx = sightRadiusPx(scene.lighting, scene.nightRadiusM, scene.gridSize);

  /**
   * Las luces se leen en CUALQUIER modo de niebla: que una antorcha no atraviese una pared es geometría y no
   * niebla, y el director puede apagar la niebla sin querer de paso que la antorcha ilumine la habitación de
   * al lado. Las capas sólo hacen falta si hay alguna luz en ellas, así que una escena sin luces no paga por
   * esto más que una lectura.
   */
  const lights = await deps.maps.listLights(scene.id);
  const layers = lights.length > 0 ? await deps.maps.listLayers(scene.id) : [];
  const wallSegments = async (): Promise<Segment[]> => sightSegments(await deps.maps.listWalls(scene.id), scene);

  if (role === 'dm') {
    if (input.probe) {
      const eye = { x: input.probe.x, y: input.probe.y };
      const segments = lights.length > 0 || scene.fogMode === 'vision' ? await wallSegments() : [];
      /**
       * La sonda mira SIN los privilegios del director (`isDm` en falso) también para las luces: si el charco
       * se calculase como el suyo, la herramienta enseñaría de más justo en lo que viene a comprobar.
       */
      const lit = litLights(lights, layers, segments, scene, false, scene.fogMode === 'off' ? null : [eye]);
      if (scene.fogMode === 'off') return { ok: true, data: { vision: [], explored: allCells(scene.gridSize, scene.width, scene.height), radiusPx, ...litField(lit, lights) } };
      // Con niebla MANUAL no hay visión que calcular para nadie: lo que un jugador ve es lo que el pincel del
      // director reveló, y eso es la unión que él ya tiene. Devolverle negro sería mentir, no simular.
      if (scene.fogMode === 'manual') return { ok: true, data: { vision: [], explored: unionCells(...await deps.maps.listExplored(scene.id)), radiusPx, ...litField(lit, lights) } };
      const poly = visionPolygon(eye, segments, radiusPx ?? Infinity);
      const vision = poly.length >= 3 ? [poly] : [];
      /**
       * `explored` es lo que se ve DESDE ESTE PUNTO, no una memoria: el navegador va uniendo lo de cada
       * respuesta mientras la sonda esté puesta y lo tira al quitarla (§ 7.3, decisión del dueño). Aquí no se
       * guarda nada — ni con `saveExplored` ni de ninguna otra forma.
       */
      const seen = cellsInPolygons([...vision, ...lit.flatMap(l => l.parts)], scene.gridSize, scene.width, scene.height);
      return { ok: true, data: { vision, explored: seen, radiusPx, ...litField(lit, lights) } };
    }
    const rows = await deps.maps.listExplored(scene.id);
    // El director conoce TODOS los muros: su luz se recorta contra ellos, pero no hay vista contra la que cortarla.
    const lit = litLights(lights, layers, lights.length > 0 ? await wallSegments() : [], scene, true, null);
    return { ok: true, data: { vision: [], explored: unionCells(...rows), radiusPx, ...litField(lit, lights) } };
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
   * «vision» (las líneas de vista la necesitan), siempre que la escena tenga luces (una luz se recorta
   * contra los muros en cualquier modo, § 7.2), y en los otros casos sólo si hay un `at` que corregir con
   * las paredes sólidas encendidas — apagadas, `corrected` sale `null` igual y sobran las dos lecturas.
   */
  const [walls, tokens] = (at && scene.solidWalls) || scene.fogMode === 'vision' || lights.length > 0
    ? await Promise.all([deps.maps.listWalls(scene.id), deps.maps.listTokens(scene.id)])
    : [[], []];
  const dragged = at ? tokensOf(tokens, input.userId).find(t => t.id === at.tokenId) ?? null : null;
  let corrected: SceneVision['corrected'] = null;
  let clearance: SceneVision['clearance'] = null;
  if (at && dragged && scene.solidWalls) {
    const radius = (dragged.size * scene.gridSize) / 2;
    const blockers = walls.filter(w => w.blocksMove && !w.isOpen).map(w => [w.x1, w.y1, w.x2, w.y2] as const);
    /**
     * El barrido sale de `from` — la última posición que ESTE MISMO cálculo contestó en el tick anterior del
     * arrastre, que el navegador devuelve tal cual — y no de la posición guardada al empezar. Anclarlo al
     * origen era el fallo del vértice (dueño, 2026-08-22): tras resbalar hasta el final de un muro, la recta
     * origen→dedo seguía cruzándolo y la corrección mantenía al token clavado al vector del muro, sin
     * dejarle doblar la esquina hasta soltar. El primer tick llega sin `from` y ancla en la guardada, así
     * que la cadena entera nace de una verdad del servidor y cada eslabón se validó barriendo desde el
     * anterior — una posición pintada a ciegas por el navegador nunca entra en la cadena.
     *
     * Aun así `from` es palabra del cliente, como hoy lo es la escritura directa de `x`/`y` en `maps_tokens`
     * (la corrección es un consejo, no una barrera — está anotado en la spec). Cuando el movimiento pase por
     * la API como endpoint propio, el servidor recordará la posición él mismo y este campo sobrará.
     */
    const start = at.from ? { ...dragged, x: at.from.x, y: at.from.y } : dragged;
    const end = slideCircle(tokenOrigin(start, scene.gridSize), tokenOrigin({ ...dragged, x: at.x, y: at.y }, scene.gridSize), radius, blockers);
    const cx = end.x / scene.gridSize - dragged.size / 2, cy = end.y / scene.gridSize - dragged.size / 2;
    // La holgura libre alrededor de la respuesta, en casillas: el navegador no pinta más allá de ese disco.
    const free = circleClearance(end, radius, blockers);
    clearance = Number.isFinite(free) ? free / scene.gridSize : null;
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

  const segments = sightSegments(walls, scene);
  const applied = corrected ?? at;
  const mine = tokensOf(tokens, input.userId).map(t => (applied && t.id === applied.tokenId ? { ...t, x: applied.x, y: applied.y } : t));
  /**
   * Las luces se calculan ANTES del modo de niebla, y desde la posición PROVISIONAL si se está arrastrando:
   * el charco tiene que seguir al token igual que la niebla, o al mover se quedaría un fotograma atrás.
   *
   * Con la niebla apagada la luz va entera —el director quitó el secreto a propósito—; en «visión» y en
   * «manual» va recortada por la línea de vista de quien pregunta, que es lo que impide que la silueta de un
   * muro secreto viaje dibujada en el borde de una sombra.
   */
  const lit = litLights(
    lights, layers, segments, scene, false,
    scene.fogMode === 'off' ? null : mine.map(t => tokenOrigin(t, scene.gridSize)),
  );

  if (scene.fogMode === 'off') {
    return { ok: true, data: { vision: [], explored: allCells(scene.gridSize, scene.width, scene.height), radiusPx, corrected, clearance, ...litField(lit, lights) } };
  }
  if (scene.fogMode === 'manual') return { ok: true, data: { vision: [], explored: stored, radiusPx, corrected, clearance, ...litField(lit, lights) } };

  const vision: VisionPolygon[] = mine
    .map(t => visionPolygon(tokenOrigin(t, scene.gridSize), segments, radiusPx ?? Infinity))
    .filter(p => p.length >= 3);

  /**
   * § 7.2, regla del dueño, literal: **LA LUZ NO ALARGA TU LÍNEA DE VISIÓN**. Lo alumbrado ya viene cortado
   * contra tu línea de vista, así que sumarlo aquí es exactamente «ves un punto si tienes línea de vista
   * hasta él Y (te queda dentro de tu alcance O lo alcanza una luz)». Lo de en medio del pasillo —fuera de
   * tu alcance y sin luz encima— sigue negro, porque no entra ni por una vía ni por la otra.
   */
  const seen = cellsInPolygons([...vision, ...lit.flatMap(l => l.parts)], scene.gridSize, scene.width, scene.height);
  const explored = unionCells(stored, seen);
  // Con posición provisional NO se escribe: es una consulta de «qué vería si lo suelto aquí». Lo explorado se
  // devuelve igual, para que la pantalla ya lo pinte, y se guarda al soltar por el camino de siempre.
  if (!at && explored.length !== stored.length) await deps.maps.saveExplored(scene.id, scene.campaignId, input.userId, explored);
  return { ok: true, data: { vision, explored, radiusPx, corrected, clearance, ...litField(lit, lights) } };
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

  /**
   * El pincel contesta TAMBIÉN las luces, aunque no las toque: la respuesta reemplaza entera la niebla que
   * tiene el navegador del director, así que omitirlas le apagaría el recorte de los charcos hasta la
   * siguiente consulta. Es del director: van completas, recortadas sólo contra los muros.
   */
  const lights = await deps.maps.listLights(scene.id);
  const lit = lights.length > 0
    ? litLights(lights, await deps.maps.listLayers(scene.id), sightSegments(await deps.maps.listWalls(scene.id), scene), scene, true, null)
    : [];
  return { ok: true, data: { vision: [], explored: unionCells(...next), radiusPx: sightRadiusPx(scene.lighting, scene.nightRadiusM, scene.gridSize), ...litField(lit, lights) } };
}
