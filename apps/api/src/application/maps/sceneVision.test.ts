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
