import { describe, it, expect } from 'vitest';
import { computeSceneVision, paintSceneFog, sightSegments, tokenOrigin, tokensOf } from './sceneVision.js';
import { pointInPolygon } from './vision.js';
import { fakeMapsRepo } from './fakeMapsRepo.js';

const SCENE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DM = 'u-dm', PIP = 'u-pip', NIX = 'u-nix';
const ROLES = { [DM]: 'dm' as const, [PIP]: 'player' as const, [NIX]: 'player' as const };
/** Pip's token stands on the left of the dividing wall, at cell (2, 5). */
const PIP_TOKEN = { id: 'tk-pip', x: 2, y: 5, size: 1, controlledBy: PIP };
const seed = (over = {}) => fakeMapsRepo({ roles: ROLES, tokens: [PIP_TOKEN], ...over });

describe('sightSegments', () => {
  it('keeps only what blocks sight and always adds the scene bounds', () => {
    const walls = [
      { id: 'wall', x1: 0, y1: 0, x2: 10, y2: 0, blocksSight: true, blocksMove: true, isOpen: false },
      { id: 'open-door', x1: 0, y1: 10, x2: 10, y2: 10, blocksSight: true, blocksMove: true, isOpen: true },
      { id: 'window', x1: 0, y1: 20, x2: 10, y2: 20, blocksSight: false, blocksMove: true, isOpen: false },
    ];
    expect(sightSegments(walls, { width: 100, height: 100 })).toHaveLength(1 + 4);
  });
});

describe('tokenOrigin / tokensOf', () => {
  it('centres the token on its cells and only keeps the ones the viewer controls', () => {
    expect(tokenOrigin({ x: 2, y: 5, size: 1 }, 27)).toEqual({ x: 67.5, y: 148.5 });
    expect(tokenOrigin({ x: 2, y: 5, size: 2 }, 27)).toEqual({ x: 81, y: 162 });
    expect(tokensOf([PIP_TOKEN, { ...PIP_TOKEN, id: 'x', controlledBy: NIX }], PIP)).toEqual([PIP_TOKEN]);
  });
});

describe('computeSceneVision', () => {
  it('rejects a scene that does not exist and a caller who is not a member', async () => {
    expect(await computeSceneVision({ maps: seed() }, { sceneId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', userId: PIP })).toEqual({ ok: false, code: 'NOT_FOUND' });
    expect(await computeSceneVision({ maps: seed() }, { sceneId: SCENE, userId: 'stranger' })).toEqual({ ok: false, code: 'FORBIDDEN' });
  });

  it('player: one polygon per own token, the wall keeps the far side dark, and what was seen is remembered', async () => {
    const maps = seed();
    const r = await computeSceneVision({ maps }, { sceneId: SCENE, userId: PIP });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.vision).toHaveLength(1);
    expect(pointInPolygon({ x: 60, y: 148 }, r.data.vision[0]!)).toBe(true);
    expect(pointInPolygon({ x: 220, y: 148 }, r.data.vision[0]!)).toBe(false);
    expect(r.data.explored.length).toBeGreaterThan(0);
    // every remembered cell is on the near side of the wall
    expect(r.data.explored.every(([cx]) => cx < 5)).toBe(true);
    expect(maps.fog[PIP]).toEqual(r.data.explored);
  });

  /**
   * La posición PROVISIONAL, para que la niebla siga al token mientras se arrastra en vez de saltar al
   * soltarlo (dueño, 2026-08-22). Es una CONSULTA: contesta qué vería ahí y no guarda nada — ni la posición
   * del token ni lo explorado. Y sólo vale sobre un token que el que pregunta controla.
   */
  it('`at`: contesta la visión desde la posición provisional y NO guarda nada', async () => {
    const maps = seed();
    const quieto = await computeSceneVision({ maps }, { sceneId: SCENE, userId: PIP });
    if (!quieto.ok) throw new Error('expected ok');
    const guardadoAntes = maps.fog[PIP];

    // al otro lado del muro (x = 135): desde ahí se ve lo que desde su sitio no se veía
    const movido = await computeSceneVision({ maps }, { sceneId: SCENE, userId: PIP, at: { tokenId: 'tk-pip', x: 7, y: 5 } });
    if (!movido.ok) throw new Error('expected ok');
    expect(pointInPolygon({ x: 220, y: 148 }, movido.data.vision[0]!)).toBe(true);
    expect(pointInPolygon({ x: 220, y: 148 }, quieto.data.vision[0]!)).toBe(false);
    // lo explorado se DEVUELVE ya crecido, para poder pintarlo, pero no se ESCRIBE
    expect(movido.data.explored.length).toBeGreaterThan(guardadoAntes!.length);
    expect(maps.fog[PIP]).toEqual(guardadoAntes);
  });

  /**
   * PAREDES SÓLIDAS (rebanada 4). La corrección se hace AQUÍ y no en el navegador porque a un jugador no le
   * llegan los muros secretos (RLS): si el choque se calculase en su pantalla, un muro oculto no le frenaría.
   * El muro de la escena de prueba es vertical en x = 135 y el token de Pip está a su izquierda.
   */
  it('con las paredes sólidas, `at` vuelve CORREGIDO contra el muro', async () => {
    const solida = seed({ scene: { solidWalls: true } });
    const r = await computeSceneVision({ maps: solida }, { sceneId: SCENE, userId: PIP, at: { tokenId: 'tk-pip', x: 7, y: 5 } });
    if (!r.ok) throw new Error('expected ok');
    // pidió cruzar al otro lado (casilla 7) y se queda a este: no atraviesa el muro
    expect(r.data.corrected).not.toBeNull();
    expect(r.data.corrected!.x).toBeLessThan(7);
    // y la visión que devuelve es la del sitio CORREGIDO, no la del que pidió
    expect(pointInPolygon({ x: 220, y: 148 }, r.data.vision[0]!)).toBe(false);
  });

  it('sin paredes sólidas no corrige nada: la escena se comporta como siempre', async () => {
    const maps = seed();
    const r = await computeSceneVision({ maps }, { sceneId: SCENE, userId: PIP, at: { tokenId: 'tk-pip', x: 7, y: 5 } });
    if (!r.ok) throw new Error('expected ok');
    expect(r.data.corrected).toBeNull();
    expect(pointInPolygon({ x: 220, y: 148 }, r.data.vision[0]!)).toBe(true);
  });

  /**
   * Se contesta `corrected` SÓLO cuando de verdad se ha recortado. Es lo que le dice al navegador «hay muro»
   * cuando él no puede saberlo — los muros secretos no le llegan. Cazado en la app: con la respuesta puesta
   * siempre, el navegador no podía distinguir un recorte del eco de lo que él mismo pidió.
   */
  it('si el movimiento CABÍA, no se contesta corrección ninguna', async () => {
    const solida = seed({ scene: { solidWalls: true } });
    // un paso corto a este lado del muro (x = 135): cabe de sobra
    const r = await computeSceneVision({ maps: solida }, { sceneId: SCENE, userId: PIP, at: { tokenId: 'tk-pip', x: 2, y: 6 } });
    if (!r.ok) throw new Error('expected ok');
    expect(r.data.corrected).toBeNull();
  });

  it('una puerta ABIERTA deja pasar aunque las paredes sean sólidas', async () => {
    const abierta = seed({
      scene: { solidWalls: true },
      walls: [{ id: 'w-1', x1: 135, y1: 0, x2: 135, y2: 270, blocksSight: true, blocksMove: true, isOpen: true }],
    });
    const r = await computeSceneVision({ maps: abierta }, { sceneId: SCENE, userId: PIP, at: { tokenId: 'tk-pip', x: 7, y: 5 } });
    if (!r.ok) throw new Error('expected ok');
    // cabe entera, así que no hay nada que corregir
    expect(r.data.corrected).toBeNull();
    expect(pointInPolygon({ x: 220, y: 148 }, r.data.vision[0]!)).toBe(true);
  });

  /**
   * LA NIEBLA NO APAGA LA FÍSICA (fallo 2 del 2026-08-22). Los `return` de «off» y «manual» salían ANTES del
   * bloque de paredes sólidas: no devolvían `corrected`, el navegador recibía `null` y —sin muros visibles—
   * nada frenaba. Un ajuste de niebla apagaba las paredes en silencio, y es un botón que el director tiene al
   * lado del de paredes sólidas. Nada en la spec dice que dependan una de otra.
   */
  it('con niebla «manual» o «off», las paredes sólidas siguen corrigiendo', async () => {
    for (const fogMode of ['manual', 'off'] as const) {
      const maps = seed({ scene: { solidWalls: true, fogMode } });
      const r = await computeSceneVision({ maps }, { sceneId: SCENE, userId: PIP, at: { tokenId: 'tk-pip', x: 7, y: 5 } });
      if (!r.ok) throw new Error('expected ok');
      expect(r.data.corrected, `fogMode=${fogMode}`).not.toBeNull();
      expect(r.data.corrected!.x).toBeLessThan(7);
    }
  });

  /**
   * EL FALLO DEL VÉRTICE (dueño, 2026-08-22): con el barrido anclado a la posición GUARDADA, tras resbalar
   * hasta el final de un muro la recta origen→dedo seguía cruzándolo y el token no podía doblar la esquina
   * hasta soltar. `from` — la última posición que este cálculo contestó — mueve el ancla con el token.
   */
  it('`from` ancla el barrido donde el token está, no donde empezó el arrastre', async () => {
    // muro sólo en la mitad de abajo (y 135–270): Pip, guardado en (2,5), queda DETRÁS de él
    const medio = seed({
      scene: { solidWalls: true },
      walls: [{ id: 'w-1', x1: 135, y1: 135, x2: 135, y2: 270, blocksSight: true, blocksMove: true, isOpen: false }],
    });
    // sin `from`, la recta guardada→(7,5) cruza el muro: corrige
    const anclado = await computeSceneVision({ maps: medio }, { sceneId: SCENE, userId: PIP, at: { tokenId: 'tk-pip', x: 7, y: 5 } });
    if (!anclado.ok) throw new Error('expected ok');
    expect(anclado.data.corrected).not.toBeNull();
    // con `from` en (2,0) —ya doblada la esquina por arriba— el camino (2,0)→(7,0) es libre: no corrige
    const doblado = await computeSceneVision({ maps: medio }, { sceneId: SCENE, userId: PIP, at: { tokenId: 'tk-pip', x: 7, y: 0, from: { x: 2, y: 0 } } });
    if (!doblado.ok) throw new Error('expected ok');
    expect(doblado.data.corrected).toBeNull();
  });

  /**
   * La HOLGURA LIBRE que acompaña cada respuesta: hasta esa distancia (en casillas) el centro puede moverse
   * en cualquier dirección sin tocar muro. El navegador no pinta más allá — sin ella, entre respuesta y
   * respuesta el token seguía al dedo a ciegas dentro del muro y al llegar la corrección rebotaba atrás.
   */
  it('con paredes sólidas, cada respuesta trae la holgura libre alrededor de lo contestado', async () => {
    const solida = seed({ scene: { solidWalls: true } });
    // quieto en su casilla (paso legal corto): cabe, y sobra hueco hasta el muro de x = 135
    const libre = await computeSceneVision({ maps: solida }, { sceneId: SCENE, userId: PIP, at: { tokenId: 'tk-pip', x: 2, y: 6 } });
    if (!libre.ok) throw new Error('expected ok');
    expect(libre.data.corrected).toBeNull();
    // centro en (67.5, 175.5), muro a 67.5 px: 67.5 − radio 13.5 − holgura 0.5 = 53.5 px → en casillas
    expect(libre.data.clearance).toBeCloseTo(53.5 / 27, 3);
    // recortado contra el muro: pegado, holgura cero
    const pegado = await computeSceneVision({ maps: solida }, { sceneId: SCENE, userId: PIP, at: { tokenId: 'tk-pip', x: 7, y: 5 } });
    if (!pegado.ok) throw new Error('expected ok');
    expect(pegado.data.corrected).not.toBeNull();
    expect(pegado.data.clearance).toBeCloseTo(0, 6);
    // sin física no hay holgura que contar
    const apagada = await computeSceneVision({ maps: seed() }, { sceneId: SCENE, userId: PIP, at: { tokenId: 'tk-pip', x: 2, y: 6 } });
    if (!apagada.ok) throw new Error('expected ok');
    expect(apagada.data.clearance).toBeNull();
  });

  it('sin `at` no hay nada que corregir', async () => {
    const r = await computeSceneVision({ maps: seed({ scene: { solidWalls: true } }) }, { sceneId: SCENE, userId: PIP });
    if (!r.ok) throw new Error('expected ok');
    expect(r.data.corrected).toBeNull();
  });

  it('`at` sobre un token que NO controlas se ignora: contesta tu visión de siempre', async () => {
    const maps = seed({ tokens: [PIP_TOKEN, { id: 'tk-nix', x: 7, y: 5, size: 1, controlledBy: NIX }] });
    const normal = await computeSceneVision({ maps }, { sceneId: SCENE, userId: PIP });
    const colado = await computeSceneVision({ maps }, { sceneId: SCENE, userId: PIP, at: { tokenId: 'tk-nix', x: 7, y: 5 } });
    if (!normal.ok || !colado.ok) throw new Error('expected ok');
    expect(colado.data.vision).toEqual(normal.data.vision);
  });

  it('opening the door widens the same token’s vision past the wall', async () => {
    const open = seed({ walls: [{ id: 'w-1', x1: 135, y1: 0, x2: 135, y2: 270, blocksSight: true, blocksMove: true, isOpen: true }] });
    const r = await computeSceneVision({ maps: open }, { sceneId: SCENE, userId: PIP });
    if (!r.ok) throw new Error('expected ok');
    expect(pointInPolygon({ x: 220, y: 148 }, r.data.vision[0]!)).toBe(true);
  });

  it('a window never cuts sight even while closed', async () => {
    const win = seed({ walls: [{ id: 'w-1', x1: 135, y1: 0, x2: 135, y2: 270, blocksSight: false, blocksMove: true, isOpen: false }] });
    const r = await computeSceneVision({ maps: win }, { sceneId: SCENE, userId: PIP });
    if (!r.ok) throw new Error('expected ok');
    expect(pointInPolygon({ x: 220, y: 148 }, r.data.vision[0]!)).toBe(true);
  });

  it('night clips sight to night_radius_m and reports the radius in px', async () => {
    const night = seed({ scene: { lighting: 'night', nightRadiusM: 3 } });
    const r = await computeSceneVision({ maps: night }, { sceneId: SCENE, userId: PIP });
    if (!r.ok) throw new Error('expected ok');
    expect(r.data.radiusPx).toBeCloseTo((3 / 1.5) * 27);
    // the token sits at (67.5, 148.5) and 3 m ≈ 54 px: 100 px is still lit, 130 px is not (and no wall is in between)
    expect(pointInPolygon({ x: 100, y: 148 }, r.data.vision[0]!)).toBe(true);
    expect(pointInPolygon({ x: 130, y: 148 }, r.data.vision[0]!)).toBe(false);
  });

  it('a player with no token keeps what they had explored and sees nothing new', async () => {
    const maps = seed({ fog: { [NIX]: [[9, 9]] as [number, number][] } });
    const r = await computeSceneVision({ maps }, { sceneId: SCENE, userId: NIX });
    if (!r.ok) throw new Error('expected ok');
    expect(r.data.vision).toEqual([]);
    expect(r.data.explored).toEqual([[9, 9]]);
  });

  it('the DM gets no polygon and the union of what every player explored', async () => {
    const maps = seed({ fog: { [PIP]: [[1, 1]] as [number, number][], [NIX]: [[1, 1], [2, 2]] as [number, number][] } });
    const r = await computeSceneVision({ maps }, { sceneId: SCENE, userId: DM });
    if (!r.ok) throw new Error('expected ok');
    expect(r.data.vision).toEqual([]);
    expect(r.data.explored).toEqual([[1, 1], [2, 2]]);
  });

  it('manual fog computes nothing; off reveals the whole scene', async () => {
    const manual = seed({ scene: { fogMode: 'manual' }, fog: { [PIP]: [[0, 0]] as [number, number][] } });
    const m = await computeSceneVision({ maps: manual }, { sceneId: SCENE, userId: PIP });
    if (!m.ok) throw new Error('expected ok');
    expect(m.data).toMatchObject({ vision: [], explored: [[0, 0]] });

    const off = await computeSceneVision({ maps: seed({ scene: { fogMode: 'off' } }) }, { sceneId: SCENE, userId: PIP });
    if (!off.ok) throw new Error('expected ok');
    expect(off.data.explored).toHaveLength(100);
  });
});

describe('paintSceneFog', () => {
  it('only the DM may paint', async () => {
    expect(await paintSceneFog({ maps: seed() }, { sceneId: SCENE, userId: PIP, op: 'reveal', all: true })).toEqual({ ok: false, code: 'FORBIDDEN' });
  });

  it('«revelar todo» writes on EVERY player and answers with the DM union', async () => {
    const maps = seed();
    const r = await paintSceneFog({ maps }, { sceneId: SCENE, userId: DM, op: 'reveal', all: true });
    if (!r.ok) throw new Error('expected ok');
    expect(r.data.explored).toHaveLength(100);
    expect(maps.fog[PIP]).toHaveLength(100);
    expect(maps.fog[NIX]).toHaveLength(100);
  });

  it('the brush hides only the cells under it', async () => {
    const maps = seed();
    await paintSceneFog({ maps }, { sceneId: SCENE, userId: DM, op: 'reveal', all: true });
    const r = await paintSceneFog({ maps }, { sceneId: SCENE, userId: DM, op: 'hide', at: { x: 13.5, y: 13.5, radius: 20 } });
    if (!r.ok) throw new Error('expected ok');
    expect(maps.fog[PIP]!.some(([x, y]) => x === 0 && y === 0)).toBe(false);
    expect(maps.fog[PIP]!.some(([x, y]) => x === 9 && y === 9)).toBe(true);
  });
});

/**
 * LA SONDA DE PRUEBA (§ 7.3). Sustituye a la lente por personaje que llegó a producción y dejaba el mapa en
 * negro. La diferencia de fondo: la lente pedía la memoria del DUEÑO de una ficha y un director no acumula
 * memoria nunca, así que llegaba vacía; una sonda **no tiene dueño** y contesta lo que se ve DESDE EL PUNTO.
 */
describe('computeSceneVision — la sonda de prueba', () => {
  const probe = (at: { x: number; y: number }, over = {}) =>
    computeSceneVision({ maps: seed(over) }, { sceneId: SCENE, userId: DM, probe: at });

  it('contesta lo mismo que vería un jugador plantado en ese punto', async () => {
    // El token de Pip está en la casilla (2,5) → su centro cae en (67.5, 148.5).
    const mine = await computeSceneVision({ maps: seed() }, { sceneId: SCENE, userId: PIP });
    const r = await probe({ x: 67.5, y: 148.5 });
    expect(r.ok && mine.ok).toBe(true);
    if (!r.ok || !mine.ok) return;
    expect(r.data.vision).toEqual(mine.data.vision);
    // Y no es el «todo» del director: al otro lado del muro no se ve.
    expect(r.data.vision).toHaveLength(1);
    expect(pointInPolygon({ x: 200, y: 135 }, r.data.vision[0]!)).toBe(false);
  });

  /** 🔴 EL FALLO QUE TIRÓ LA LENTE: sin dueño no hay memoria que pedir, así que esto NO puede salir vacío. */
  it('NO devuelve el mapa en negro: contesta lo que se ve desde ahí, no la memoria de nadie', async () => {
    const r = await probe({ x: 67.5, y: 148.5 }, { fog: {} });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.explored.length).toBeGreaterThan(0);
    expect(r.data.vision.length).toBeGreaterThan(0);
  });

  /** La memoria la acumula el NAVEGADOR: aquí se contesta sólo lo de ESTE punto, y moverse cambia la respuesta. */
  it('lo explorado que contesta es lo de ESE punto, no una memoria que crece sola', async () => {
    // A este lado del muro y al otro: la respuesta tiene que cambiar, o no estaría mirando desde el punto.
    const a = await probe({ x: 67.5, y: 148.5 });
    const b = await probe({ x: 200, y: 148.5 });
    if (!a.ok || !b.ok) return;
    expect(a.data.explored.every(([cx]) => cx < 5)).toBe(true);
    expect(b.data.explored.every(([cx]) => cx >= 5)).toBe(true);
  });

  it('no guarda NADA: mirar desde un punto no le explora el mapa a nadie', async () => {
    const maps = seed({ fog: { [PIP]: [] } });
    await computeSceneVision({ maps }, { sceneId: SCENE, userId: DM, probe: { x: 67.5, y: 148.5 } });
    expect(maps.fog[PIP]).toEqual([]);
    // El jugador pidiendo lo suyo SÍ guarda: se comprueba que el doble no está roto.
    await computeSceneVision({ maps }, { sceneId: SCENE, userId: PIP });
    expect(maps.fog[PIP]!.length).toBeGreaterThan(0);
  });

  it('respeta el modo de niebla: apagada lo enseña todo, y en manual enseña lo que el pincel reveló', async () => {
    const off = await probe({ x: 67.5, y: 148.5 }, { scene: { fogMode: 'off' } });
    expect(off.ok && off.data.explored.length).toBe(100); // 270/27 = 10 × 10 casillas
    // En manual no hay visión para nadie: lo que un jugador ve es lo que el director reveló. Negro sería mentir.
    const manual = await probe({ x: 67.5, y: 148.5 }, { scene: { fogMode: 'manual' }, fog: { [PIP]: [[1, 1]], [NIX]: [[2, 2]] } });
    expect(manual.ok && manual.data.vision).toEqual([]);
    expect(manual.ok && manual.data.explored).toHaveLength(2);
  });

  /** La sonda es SÓLO del director: a un jugador el parámetro no le enseña nada de más. */
  it('un jugador que la pide no ve más de lo suyo', async () => {
    const r = await computeSceneVision({ maps: seed() }, { sceneId: SCENE, userId: PIP, probe: { x: 800, y: 40 } });
    const mine = await computeSceneVision({ maps: seed() }, { sceneId: SCENE, userId: PIP });
    if (!r.ok || !mine.ok) return;
    expect(r.data.vision).toEqual(mine.data.vision);
  });
});

/** El director, sin lente ninguna: lo suyo de siempre — la unión de lo explorado y ningún polígono. */
describe('computeSceneVision — la vista del director', () => {
  it('el director ve la unión de lo explorado y sin polígono', async () => {
    const r = await computeSceneVision({ maps: seed({ fog: { [PIP]: [[0, 0]], [NIX]: [[9, 9]] } }) }, { sceneId: SCENE, userId: DM });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.vision).toEqual([]);
    expect(r.data.explored).toHaveLength(2);
  });
});

// ── Rebanada 7 · § 7.2 «Las luces iluminan de verdad» ───────────────────────

const LIGHT = {
  id: 'li-1', layerId: null, x: 100, y: 135, rotation: 0,
  shape: 'radius' as const, coneAngle: 60, rangeM: 6.75, castsShadow: true,   // 6,75 m ÷ 1,5 × 27 px = 121,5 px
};
const inLit = (p: { x: number; y: number }, lit: { parts: [number, number][][] }[] | undefined): boolean =>
  (lit ?? []).some(l => l.parts.some(poly => pointInPolygon(p, poly)));

describe('luces que iluminan de verdad (§ 7.2)', () => {
  it('la luz se para en el muro: no alumbra al otro lado', async () => {
    const maps = seed({ lights: [LIGHT] });
    const r = await computeSceneVision({ maps }, { sceneId: SCENE, userId: DM });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(inLit({ x: 120, y: 135 }, r.data.lit)).toBe(true);
    expect(inLit({ x: 200, y: 135 }, r.data.lit)).toBe(false);
  });

  it('con la sombra apagada sí la atraviesa: es el resplandor mágico, y sigue siendo elección del director', async () => {
    const maps = seed({ lights: [{ ...LIGHT, castsShadow: false }] });
    const r = await computeSceneVision({ maps }, { sceneId: SCENE, userId: DM });
    if (!r.ok) return;
    expect(inLit({ x: 200, y: 135 }, r.data.lit)).toBe(true);
  });

  it('una escena sin luces no contesta el campo: vacío y «no hay luces» no son lo mismo', async () => {
    const r = await computeSceneVision({ maps: seed() }, { sceneId: SCENE, userId: PIP });
    if (!r.ok) return;
    expect(r.data.lit).toBeUndefined();
  });

  /**
   * LA REGLA DEL DUEÑO, literal: «si un personaje entra en un pasillo y mira al fondo donde su línea no
   * llega pero hay una luz, sólo ve lo que está iluminado. Lo que hay en medio no se ve».
   *
   * Pasillo de 600 px entre dos muros. El personaje está en la boca con 3 m de alcance (40 px) y hay una
   * antorcha al fondo, a 500 px. Los tres puntos que importan: lo de cerca se ve por alcance, lo del fondo
   * por la luz, y LO DE EN MEDIO SIGUE NEGRO aunque tenga línea de vista limpia hasta él.
   */
  it('la luz NO alarga tu línea de visión: se ve el fondo iluminado y lo de en medio sigue a oscuras', async () => {
    const maps = fakeMapsRepo({
      roles: ROLES,
      scene: { width: 600, height: 200, gridSize: 20, fogMode: 'vision', lighting: 'night', nightRadiusM: 3 },
      walls: [
        { id: 'w-top', x1: 0, y1: 80, x2: 600, y2: 80, blocksSight: true, blocksMove: true, isOpen: false },
        { id: 'w-bottom', x1: 0, y1: 120, x2: 600, y2: 120, blocksSight: true, blocksMove: true, isOpen: false },
      ],
      tokens: [{ id: 'tk-pip', x: 1, y: 4, size: 1, controlledBy: PIP }],   // centro (30, 90), dentro del pasillo
      lights: [{ ...LIGHT, x: 500, y: 100, rangeM: 3 }],                    // 3 m ÷ 1,5 × 20 px = 40 px
    });
    const r = await computeSceneVision({ maps }, { sceneId: SCENE, userId: PIP });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const seenAt = (p: { x: number; y: number }): boolean =>
      r.data.vision.some(poly => pointInPolygon(p, poly)) || inLit(p, r.data.lit);

    expect(seenAt({ x: 45, y: 100 })).toBe(true);     // cerca: entra por su alcance
    expect(seenAt({ x: 250, y: 100 })).toBe(false);   // EN MEDIO: línea de vista limpia, pero ni alcance ni luz
    expect(seenAt({ x: 500, y: 100 })).toBe(true);    // al fondo: no llega su vista, pero llega la antorcha

    // Y lo alumbrado se recuerda como todo lo demás (§ 7.2, punto 4).
    const key = (c: [number, number]): string => `${c[0]},${c[1]}`;
    const explored = new Set(r.data.explored.map(key));
    expect(explored.has(key([25, 5]))).toBe(true);    // la casilla del fondo iluminado, ya explorada
    expect(explored.has(key([12, 5]))).toBe(false);   // la de en medio, no
  });

  /**
   * El motivo de que esto viva en el servidor. Al jugador no le llegan los muros secretos, así que un charco
   * de luz recortado en su navegador —o mandado entero— le dibujaría por dónde corta la sombra.
   */
  it('al jugador la luz le llega cortada por lo que ve; al director, entera', async () => {
    const common = {
      roles: ROLES,
      scene: { width: 270, height: 270, gridSize: 27, fogMode: 'vision' as const },
      // Medio muro: deja pasar la vista por debajo de y = 120, y esconde lo de arriba.
      walls: [{ id: 'w-half', x1: 135, y1: 0, x2: 135, y2: 120, blocksSight: true, blocksMove: true, isOpen: false }],
      tokens: [{ id: 'tk-pip', x: 1, y: 6, size: 1, controlledBy: PIP }],   // centro (40,5, 175,5)
      lights: [{ ...LIGHT, x: 200, y: 60, rangeM: 4.5 }],                   // 4,5 m ÷ 1,5 × 27 px = 81 px
    };
    const asPlayer = await computeSceneVision({ maps: fakeMapsRepo(common) }, { sceneId: SCENE, userId: PIP });
    const asDm = await computeSceneVision({ maps: fakeMapsRepo(common) }, { sceneId: SCENE, userId: DM });
    if (!asPlayer.ok || !asDm.ok) return;

    // El director conoce todos los muros: recibe el charco entero, con su sombra.
    expect(inLit({ x: 200, y: 60 }, asDm.data.lit)).toBe(true);
    // El jugador tiene el medio muro delante: eso no le llega ni siquiera dibujado en el borde de la luz.
    expect(inLit({ x: 200, y: 60 }, asPlayer.data.lit)).toBe(false);
    // Lo que sí alcanza a ver por debajo del muro, sí.
    expect(inLit({ x: 200, y: 130 }, asPlayer.data.lit)).toBe(true);
  });

  /**
   * Sin ojos no hay nada que enseñarle — pero el campo VIAJA, vacío. Un `undefined` aquí significaría «esta
   * escena no tiene luces» y el navegador pintaría los resplandores enteros: el de una antorcha que este
   * jugador no alcanza a ver quedaría flotando sobre su niebla, delatando dónde está.
   */
  it('un jugador sin ninguna ficha recibe la lista VACÍA, no el campo ausente', async () => {
    const maps = seed({ lights: [LIGHT] });
    const r = await computeSceneVision({ maps }, { sceneId: SCENE, userId: NIX });
    if (!r.ok) return;
    expect(r.data.lit).toEqual([]);
  });

  /** Lo mismo con ficha: si ninguna luz le alcanza, la lista llega vacía y le apaga TODOS los resplandores. */
  it('una luz que no alumbra nada de lo que el jugador ve llega como lista vacía, no como campo ausente', async () => {
    const maps = fakeMapsRepo({
      roles: ROLES,
      scene: { width: 600, height: 200, gridSize: 20, fogMode: 'vision', lighting: 'night', nightRadiusM: 3 },
      // Muro macizo entre la ficha y la antorcha: no ve ni un tramo del charco.
      walls: [{ id: 'w-solid', x1: 300, y1: 0, x2: 300, y2: 200, blocksSight: true, blocksMove: true, isOpen: false }],
      tokens: [{ id: 'tk-pip', x: 1, y: 4, size: 1, controlledBy: PIP }],
      lights: [{ ...LIGHT, x: 500, y: 100, rangeM: 3 }],
    });
    const r = await computeSceneVision({ maps }, { sceneId: SCENE, userId: PIP });
    if (!r.ok) return;
    expect(r.data.lit).toEqual([]);
  });

  it('una capa apagada apaga su luz para todos; la de notas del director sólo alumbra para él', async () => {
    const layers = [
      { id: 'ly-off', kind: 'objects' as const, visible: false },
      { id: 'ly-dm', kind: 'dm_notes' as const, visible: true },
    ];
    const lights = [
      { ...LIGHT, id: 'li-off', layerId: 'ly-off' },
      { ...LIGHT, id: 'li-dm', layerId: 'ly-dm' },
      { ...LIGHT, id: 'li-open', layerId: null },
    ];
    const dm = await computeSceneVision({ maps: seed({ lights, layers }) }, { sceneId: SCENE, userId: DM });
    const pip = await computeSceneVision({ maps: seed({ lights, layers }) }, { sceneId: SCENE, userId: PIP });
    if (!dm.ok || !pip.ok) return;
    expect((dm.data.lit ?? []).map(l => l.id).sort()).toEqual(['li-dm', 'li-open']);
    expect((pip.data.lit ?? []).map(l => l.id)).toEqual(['li-open']);
  });

  it('con la niebla en manual la luz llega —para recortarse contra los muros— pero no explora nada', async () => {
    const maps = seed({ scene: { fogMode: 'manual' }, lights: [LIGHT], fog: { [PIP]: [[0, 0]] } });
    const r = await computeSceneVision({ maps }, { sceneId: SCENE, userId: PIP });
    if (!r.ok) return;
    expect(inLit({ x: 120, y: 135 }, r.data.lit)).toBe(true);
    expect(r.data.explored).toEqual([[0, 0]]);   // sólo lo que pintó el director
  });

  it('con la niebla apagada la luz va entera: el director quitó el secreto a propósito', async () => {
    const maps = seed({ scene: { fogMode: 'off' }, lights: [{ ...LIGHT, x: 200, y: 60, rangeM: 4.5 }] });
    const r = await computeSceneVision({ maps }, { sceneId: SCENE, userId: PIP });
    if (!r.ok) return;
    expect(inLit({ x: 200, y: 60 }, r.data.lit)).toBe(true);
  });

  /**
   * 🚨 LA LUZ QUE GIRA (§ 7.2). Un cono que gira manda el CÍRCULO ENTERO recortado y el barrido lo hace el
   * navegador rotando encima una ventana. No es un atajo: el recorte contra los muros es RADIAL, así que
   * «cono girado a θ, recortado» es «círculo recortado ∩ sector de θ». Calcular aquí las 24 rotaciones
   * costaría 24 veces más en CADA petición de visión, y el dueño ya se quejó de que va lentísimo.
   */
  it('un cono que gira manda el círculo entero, no el cono de este instante', async () => {
    const cone = { ...LIGHT, x: 100, y: 135, shape: 'cone' as const, coneAngle: 40, rotation: 0, rangeM: 4.5 };
    const detras = { x: 100, y: 60 };   // a 75 px por encima de la luz: fuera de un cono que apunta a la derecha
    const quieto = await computeSceneVision({ maps: seed({ scene: { fogMode: 'off' }, lights: [cone] }) }, { sceneId: SCENE, userId: PIP });
    const girando = await computeSceneVision({ maps: seed({ scene: { fogMode: 'off' }, lights: [{ ...cone, spinMs: 4000 }] }) }, { sceneId: SCENE, userId: PIP });
    if (!quieto.ok || !girando.ok) return;
    expect(inLit(detras, quieto.data.lit)).toBe(false);    // quieto: el cono no mira ahí
    expect(inLit(detras, girando.data.lit)).toBe(true);     // girando: el barrido acaba pasando por ahí
  });

  it('girar NO le da permiso para atravesar la piedra: el círculo va recortado igual', async () => {
    const maps = fakeMapsRepo({
      roles: ROLES,
      scene: { width: 270, height: 270, gridSize: 27, fogMode: 'off' },
      walls: [{ id: 'w-half', x1: 135, y1: 0, x2: 135, y2: 270, blocksSight: true, blocksMove: true, isOpen: false }],
      tokens: [{ id: 'tk-pip', x: 1, y: 5, size: 1, controlledBy: PIP }],
      lights: [{ ...LIGHT, x: 100, y: 135, shape: 'cone', coneAngle: 40, rangeM: 9, spinMs: 4000 }],
    });
    const r = await computeSceneVision({ maps }, { sceneId: SCENE, userId: PIP });
    if (!r.ok) return;
    expect(inLit({ x: 100, y: 135 }, r.data.lit)).toBe(true);    // a este lado del muro, alumbra
    expect(inLit({ x: 200, y: 135 }, r.data.lit)).toBe(false);   // al otro, no
  });

  it('sólo gira un CONO: un radio con periodo puesto sigue siendo un radio', async () => {
    const radio = { ...LIGHT, x: 100, y: 135, shape: 'radius' as const, rangeM: 4.5 };
    const a = await computeSceneVision({ maps: seed({ scene: { fogMode: 'off' }, lights: [radio] }) }, { sceneId: SCENE, userId: PIP });
    const b = await computeSceneVision({ maps: seed({ scene: { fogMode: 'off' }, lights: [{ ...radio, spinMs: 4000 }] }) }, { sceneId: SCENE, userId: PIP });
    if (!a.ok || !b.ok) return;
    expect(b.data.lit).toEqual(a.data.lit);
  });

  it('el pincel del director contesta también las luces: su respuesta reemplaza la niebla entera', async () => {
    const maps = seed({ lights: [LIGHT] });
    const r = await paintSceneFog({ maps }, { sceneId: SCENE, userId: DM, op: 'reveal', at: { x: 30, y: 30, radius: 20 } });
    if (!r.ok) return;
    expect(inLit({ x: 120, y: 135 }, r.data.lit)).toBe(true);
    expect(inLit({ x: 200, y: 135 }, r.data.lit)).toBe(false);
  });
});
