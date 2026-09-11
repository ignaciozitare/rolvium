import { describe, expect, it } from 'vitest';
import { computeSceneVision, paintSceneFog, RECUERDO_MAX, roomGeometry, sightSegments } from './sceneVision.js';
import { pointInPolygon } from './vision.js';
import { fakeMapsRepo } from './fakeMapsRepo.js';

/**
 * EL TRABAJO DE FONDO DE LA REBANADA 8, y el que no se ve en pantalla:
 * **el cálculo de visión, colisión y luz tiene que mirar LAS DOS FUENTES** — las filas marcadas de
 * `maps_walls` (modo A, sobre una foto) y los CONTORNOS DE LAS SALAS (modo B, dibujando aquí).
 *
 * Es un requisito con nombre suyo, del 2026-09-03: «*la niebla de batalla debe funcionar con estas
 * construcciones también*», y el 2026-09-04 le añadió las colisiones y las luces con todas las letras:
 * «*los muros de las habitaciones son los que se ven y tienen física, con las colisiones, luces, etc*».
 *
 * Lo que estos tests sujetan es justo lo que se rompería en silencio: hasta esta tanda `sceneVision` sólo
 * conocía `maps_walls`, así que una sala levantada en Rolvium NO habría tapado nada — se vería la pared en
 * pantalla y la vista pasaría por encima como si no existiera.
 */

const SCENE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DM = 'u-dm', PIP = 'u-pip';
const ROLES = { [DM]: 'dm' as const, [PIP]: 'player' as const };

/**
 * Una sala en la mitad IZQUIERDA de la escena de 270×270, de (27,27) a (135,243). El token de Pip vive
 * dentro, en la casilla (2,5) → centro (67,5 · 148,5). La pared derecha de la sala cae en x = 135.
 */
const ROOM = { id: 'rm-1', kind: 'room' as const, points: [[27, 27], [135, 27], [135, 243], [27, 243]] as [number, number][] };
const PIP_TOKEN = { id: 'tk-pip', x: 2, y: 5, size: 1, controlledBy: PIP };

/** Sin NINGÚN muro marcado: aquí lo único que puede tapar es el contorno de la sala. */
const seed = (over = {}) => fakeMapsRepo({ roles: ROLES, tokens: [PIP_TOKEN], walls: [], rooms: [ROOM], ...over });

describe('roomGeometry — el contorno, ya fundido y ya troceado por sus vanos', () => {
  it('una escena sin salas no cuesta geometría ni devuelve nada', async () => {
    expect(await roomGeometry(fakeMapsRepo({ rooms: [] }), SCENE)).toEqual({ sight: [], move: [] });
  });

  it('devuelve el contorno de la sala, para la vista y para el paso', async () => {
    const g = await roomGeometry(seed(), SCENE);
    expect(g.sight).toHaveLength(4);
    expect(g.move).toHaveLength(4);
  });

  it('DOS SALAS PEGADAS se funden: el tabique compartido no cuenta como pared para nada', async () => {
    const vecina = { id: 'rm-2', kind: 'room' as const, points: [[135, 27], [243, 27], [243, 243], [135, 243]] as [number, number][] };
    const g = await roomGeometry(seed({ rooms: [ROOM, vecina] }), SCENE);
    // Ocho lados menos los dos del tabique compartido: la unión tiene seis.
    expect(g.sight).toHaveLength(6);
    expect(g.sight.some(s => s.a.x === 135 && s.b.x === 135)).toBe(false);
  });

  it('un vano ABIERTO abre el contorno; cerrado, no', async () => {
    const vano = { x1: 135, y1: 108, x2: 135, y2: 162, kind: 'door' as const, isOpen: true };
    const abierto = await roomGeometry(seed({ roomOpenings: [vano] }), SCENE);
    const cerrado = await roomGeometry(seed({ roomOpenings: [{ ...vano, isOpen: false }] }), SCENE);
    const largo = (segs: { a: { x: number; y: number }; b: { x: number; y: number } }[]): number =>
      segs.reduce((n, s) => n + Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y), 0);
    expect(largo(abierto.sight)).toBeCloseTo(largo(cerrado.sight) - 54, 6);
  });
});

describe('sightSegments — las dos fuentes', () => {
  it('suma los contornos de sala a los muros marcados, y el borde de la escena sigue estando', () => {
    const walls = [{ id: 'w', x1: 0, y1: 0, x2: 10, y2: 0, blocksSight: true, blocksMove: true, isOpen: false }];
    const room = [{ a: { x: 0, y: 50 }, b: { x: 10, y: 50 } }];
    expect(sightSegments(walls, { width: 100, height: 100 }, room)).toHaveLength(1 + 1 + 4);
  });
});

describe('computeSceneVision — una sala tapa EXACTAMENTE igual que un muro marcado', () => {
  it('desde dentro se ve la sala y NO se ve lo de fuera', async () => {
    const r = await computeSceneVision({ maps: seed() }, { sceneId: SCENE, userId: PIP });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const poly = r.data.vision[0]!;
    expect(poly.length).toBeGreaterThanOrEqual(3);
    // Un punto DENTRO de la sala, al lado del token.
    expect(pointInPolygon({ x: 100, y: 148 }, poly)).toBe(true);
    // Y otro justo AL OTRO LADO de la pared de la sala: la vista se corta ahí.
    expect(pointInPolygon({ x: 200, y: 148 }, poly)).toBe(false);
  });

  it('POR UN VANO ABIERTO sí se ve al otro lado — la puerta es una puerta', async () => {
    const maps = seed({ roomOpenings: [{ x1: 135, y1: 108, x2: 135, y2: 189, kind: 'door', isOpen: true }] });
    const r = await computeSceneVision({ maps }, { sceneId: SCENE, userId: PIP });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(pointInPolygon({ x: 200, y: 148 }, r.data.vision[0]!)).toBe(true);
  });

  it('cerrada, la misma puerta vuelve a tapar', async () => {
    const maps = seed({ roomOpenings: [{ x1: 135, y1: 108, x2: 135, y2: 189, kind: 'door', isOpen: false }] });
    const r = await computeSceneVision({ maps }, { sceneId: SCENE, userId: PIP });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(pointInPolygon({ x: 200, y: 148 }, r.data.vision[0]!)).toBe(false);
  });

  /**
   * 🐞 LA PUERTA QUE CIERRA UN PASILLO de pared a pared (suyo, 2026-09-11: «*dejan pasar la visión y no
   * colisionas con ellas*»). No cae sobre ningún lado del contorno, y hasta hoy se dibujaba sin tapar nada.
   * Un pasillo sale de la pared derecha de la sala, y la puerta lo cruza en x = 189, a 0,3 y 3 px de sus paredes.
   */
  describe('una puerta que cierra un pasillo de pared a pared', () => {
    const PASILLO = { id: 'rm-2', kind: 'room' as const, points: [[135, 121.5], [243, 121.5], [243, 175.5], [135, 175.5]] as [number, number][] };
    const PUERTA = { x1: 189, y1: 121.8, x2: 189, y2: 172.5, kind: 'door' as const, isOpen: false };
    const conPuerta = (isOpen: boolean) => seed({ rooms: [ROOM, PASILLO], roomOpenings: [{ ...PUERTA, isOpen }] });
    const vista = async (isOpen: boolean) => {
      const r = await computeSceneVision({ maps: conPuerta(isOpen) }, { sceneId: SCENE, userId: PIP });
      if (!r.ok) throw new Error('sin visión');
      return r.data.vision[0]!;
    };

    it('cerrada, tapa lo que hay detrás; el trozo de pasillo de este lado se sigue viendo', async () => {
      const poly = await vista(false);
      expect(pointInPolygon({ x: 160, y: 148.5 }, poly)).toBe(true);
      expect(pointInPolygon({ x: 220, y: 148.5 }, poly)).toBe(false);
    });

    it('abierta, se ve al otro lado', async () => {
      expect(pointInPolygon({ x: 220, y: 148.5 }, await vista(true))).toBe(true);
    });

    it('cerrada frena a las fichas; abierta, no', async () => {
      const cruza = (move: readonly (readonly number[])[]) => move.some(([x1, , x2]) => Math.abs(x1! - 189) < 1e-6 && Math.abs(x2! - 189) < 1e-6);
      expect(cruza((await roomGeometry(conPuerta(false), SCENE)).move)).toBe(true);
      expect(cruza((await roomGeometry(conPuerta(true), SCENE)).move)).toBe(false);
    });
  });

  it('una VENTANA de sala deja ver, como la de siempre', async () => {
    const maps = seed({ roomOpenings: [{ x1: 135, y1: 108, x2: 135, y2: 189, kind: 'window', isOpen: false }] });
    const r = await computeSceneVision({ maps }, { sceneId: SCENE, userId: PIP });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(pointInPolygon({ x: 200, y: 148 }, r.data.vision[0]!)).toBe(true);
  });
});

/**
 * LAS DOS RAMAS QUE QUEDABAN SIN ATAR, y las dos son del DIRECTOR: LA SONDA y EL PINCEL DE NIEBLA.
 *
 * Importan porque son justo donde un olvido no se nota. La sonda («qué vería un jugador desde aquí») es la
 * herramienta con la que él COMPRUEBA la niebla: si mirase sólo `maps_walls` le enseñaría que se ve a través
 * de una sala, y creería el fallo. Y el pincel contesta con las luces recortadas contra los muros: sin las
 * salas, cada brochada le devolvería los charcos atravesando la roca hasta la consulta siguiente.
 */
describe('computeSceneVision — LA SONDA del director mira también las salas', () => {
  /** La sonda se pone DENTRO de la sala, en el mismo sitio donde vive el token de Pip. */
  const sondar = (maps: ReturnType<typeof seed>) =>
    computeSceneVision({ maps }, { sceneId: SCENE, userId: DM, probe: { x: 67.5, y: 148.5 } });

  it('desde dentro de una sala, la sonda se corta en su contorno', async () => {
    const r = await sondar(seed());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const poly = r.data.vision[0]!;
    expect(pointInPolygon({ x: 100, y: 148 }, poly)).toBe(true);
    expect(pointInPolygon({ x: 200, y: 148 }, poly)).toBe(false);
  });

  it('y por un vano ABIERTO enseña lo mismo que vería el jugador: el otro lado', async () => {
    const vano = [{ x1: 135, y1: 108, x2: 135, y2: 189, kind: 'door' as const, isOpen: true }];
    const r = await sondar(seed({ roomOpenings: vano }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(pointInPolygon({ x: 200, y: 148 }, r.data.vision[0]!)).toBe(true);
    // Y sigue sin escribir una sola fila: la sonda es una consulta, no un movimiento.
    expect(seed({ roomOpenings: vano }).fog).toEqual({});
  });
});

describe('paintSceneFog — el pincel contesta las luces recortadas también contra las salas', () => {
  /** Una antorcha DENTRO de la sala. Su charco no puede atravesar el contorno. */
  const LUZ = { id: 'li-1', layerId: null, x: 67.5, y: 148.5, rotation: 0, shape: 'radius' as const, coneAngle: 60, rangeM: 30, castsShadow: true, spinMs: 0 };

  it('la luz de dentro de una sala no se derrama por fuera al dar una brochada', async () => {
    const conSala = await paintSceneFog({ maps: seed({ lights: [LUZ] }) }, { sceneId: SCENE, userId: DM, op: 'reveal', all: true });
    const sinSala = await paintSceneFog({ maps: seed({ lights: [LUZ], rooms: [] }) }, { sceneId: SCENE, userId: DM, op: 'reveal', all: true });
    expect(conSala.ok && sinSala.ok).toBe(true);
    if (!conSala.ok || !sinSala.ok) return;
    const charco = (r: typeof conSala) => r.data.lit![0]!.parts[0]!;
    // Con la sala, el charco se para en su pared derecha (x = 135); sin ella, llega mucho más lejos.
    const alcance = (poly: [number, number][]): number => Math.max(...poly.map(p => p[0]));
    expect(alcance(charco(conSala))).toBeLessThanOrEqual(136);
    expect(alcance(charco(sinSala))).toBeGreaterThan(200);
  });

  it('por un vano ABIERTO la luz sí se cuela, como por una puerta de verdad', async () => {
    const maps = seed({ lights: [LUZ], roomOpenings: [{ x1: 135, y1: 108, x2: 135, y2: 189, kind: 'door', isOpen: true }] });
    const r = await paintSceneFog({ maps }, { sceneId: SCENE, userId: DM, op: 'reveal', all: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Math.max(...r.data.lit![0]!.parts[0]!.map(p => p[0]))).toBeGreaterThan(200);
  });
});

describe('computeSceneVision — PAREDES SÓLIDAS: la sala también FRENA', () => {
  /** Se empuja el token contra la pared derecha de la sala (x = 135), desde dentro. */
  const empujar = (maps: ReturnType<typeof seed>) =>
    computeSceneVision({ maps }, { sceneId: SCENE, userId: PIP, at: { tokenId: 'tk-pip', x: 7, y: 5 } });

  it('con las paredes sólidas puestas, el contorno de la sala corrige el movimiento', async () => {
    const r = await empujar(seed({ scene: { solidWalls: true } }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.corrected).not.toBeNull();
    // Se queda en el lado de dentro: no atraviesa la pared de la sala.
    expect(r.data.corrected!.x).toBeLessThan(7);
  });

  it('por un vano ABIERTO se pasa: la corrección se calla', async () => {
    const r = await empujar(seed({ scene: { solidWalls: true }, roomOpenings: [{ x1: 135, y1: 108, x2: 135, y2: 189, kind: 'door', isOpen: true }] }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.corrected).toBeNull();
  });

  it('una VENTANA deja ver pero NO deja pasar', async () => {
    const r = await empujar(seed({ scene: { solidWalls: true }, roomOpenings: [{ x1: 135, y1: 108, x2: 135, y2: 189, kind: 'window', isOpen: false }] }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.corrected).not.toBeNull();
  });

  it('con las paredes NO sólidas, una sala no frena a nadie — como cualquier muro', async () => {
    const r = await empujar(seed({ scene: { solidWalls: false } }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.corrected).toBeNull();
  });
});

describe('lo que NO cambia: `maps_walls` sigue intacto', () => {
  /**
   * Regresión con nombre. El 2026-09-04 él corrigió el spec: «*ojo que estos muros no son los otros… no estoy
   * hablando de los muros con los que venimos trabajando*». Levantar una sala NO escribe filas derivadas, y el
   * modo A —marcar sobre una foto— sigue funcionando exactamente igual con salas en la misma escena.
   */
  it('una escena con salas Y muros marcados usa las dos cosas, sin que ninguna pise a la otra', async () => {
    const marcado = { id: 'w-1', x1: 189, y1: 0, x2: 189, y2: 270, blocksSight: true, blocksMove: true, isOpen: false };
    const maps = seed({ walls: [marcado], roomOpenings: [{ x1: 135, y1: 108, x2: 135, y2: 189, kind: 'door', isOpen: true }] });
    const r = await computeSceneVision({ maps }, { sceneId: SCENE, userId: PIP });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const poly = r.data.vision[0]!;
    // Por el vano de la sala se cuela la vista…
    expect(pointInPolygon({ x: 160, y: 148 }, poly)).toBe(true);
    // …y la corta el MURO MARCADO de más allá, que sigue haciendo su trabajo de siempre.
    expect(pointInPolygon({ x: 240, y: 148 }, poly)).toBe(false);
  });
});

/**
 * ⏱ LAS PAREDES SE RECUERDAN POR ESCENA (specs/modules/maps/SPEC.md § «Las paredes no se recalculan en cada
 * movimiento», 2026-09-11). Suyo: «*esta recontra super lento*». `roomGeometry` se llama en cada petición de
 * visión —cada tirón de una ficha— y con su «Dungeon» fundir las formas costaba segundos cada vez.
 *
 * Lo que se sujeta es la parte peligrosa de recordar: que NUNCA se sirvan paredes viejas. Cada test usa su propia
 * escena para no heredar lo recordado por otro.
 */
describe('roomGeometry — recuerda las paredes de la escena mientras nada cambie', () => {
  /** Lo que devuelve la base en cada lectura: listas y objetos NUEVOS, aunque dentro esté lo mismo. */
  const copia = (r: typeof ROOM) => ({ ...r, points: r.points.map(([x, y]) => [x, y] as [number, number]) });

  it('mismas formas y mismos vanos en una lectura nueva: devuelve lo recordado, sin recalcular', async () => {
    const a = await roomGeometry(seed({ rooms: [copia(ROOM)] }), 'recuerdo-1');
    const b = await roomGeometry(seed({ rooms: [copia(ROOM)] }), 'recuerdo-1');
    expect(b).toBe(a);
  });

  it('mover una esquina recalcula, y la pared sale donde está ahora', async () => {
    const a = await roomGeometry(seed(), 'recuerdo-2');
    const movida = { ...ROOM, points: [[27, 27], [162, 27], [162, 243], [27, 243]] as [number, number][] };
    const b = await roomGeometry(seed({ rooms: [movida] }), 'recuerdo-2');
    expect(b).not.toBe(a);
    expect(b.sight.some(s => s.a.x === 162 && s.b.x === 162)).toBe(true);
    expect(b.sight.some(s => s.a.x === 135 && s.b.x === 135)).toBe(false);
  });

  it('abrir y volver a cerrar una puerta: nunca se sirve la puerta como estaba', async () => {
    const vano = { x1: 135, y1: 108, x2: 135, y2: 162, kind: 'door' as const, isOpen: false };
    const cerrada = await roomGeometry(seed({ roomOpenings: [vano] }), 'recuerdo-3');
    const abierta = await roomGeometry(seed({ roomOpenings: [{ ...vano, isOpen: true }] }), 'recuerdo-3');
    // Cerrada, la hoja frena; abierta, no: un tramo menos en lo que frena.
    expect(abierta.move).toHaveLength(cerrada.move.length - 1);
    const otraVez = await roomGeometry(seed({ roomOpenings: [vano] }), 'recuerdo-3');
    expect(otraVez.move).toHaveLength(cerrada.move.length);
  });

  it('cada escena recuerda lo suyo: dos escenas con formas distintas no se pisan', async () => {
    const vecina = { id: 'rm-2', kind: 'room' as const, points: [[135, 27], [243, 27], [243, 243], [135, 243]] as [number, number][] };
    const una = await roomGeometry(seed(), 'recuerdo-4a');
    const dos = await roomGeometry(seed({ rooms: [ROOM, vecina] }), 'recuerdo-4b');
    expect(una.sight).toHaveLength(4);
    expect(dos.sight).toHaveLength(6);
    expect(await roomGeometry(seed(), 'recuerdo-4a')).toBe(una);
  });

  it(`pasadas ${RECUERDO_MAX} escenas olvida la usada hace más tiempo, y al volver la calcula igual de bien`, async () => {
    const primera = await roomGeometry(seed(), 'recuerdo-5-0');
    for (let i = 1; i <= RECUERDO_MAX; i++) await roomGeometry(seed(), `recuerdo-5-${i}`);
    const otraVez = await roomGeometry(seed(), 'recuerdo-5-0');
    expect(otraVez).not.toBe(primera);
    expect(otraVez).toEqual(primera);
  });
});
