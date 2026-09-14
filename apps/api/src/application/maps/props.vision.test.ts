import { describe, expect, it } from 'vitest';
import { blockingGeometry, computeSceneVision } from './sceneVision.js';
import { pointInPolygon } from './vision.js';
import { fakeMapsRepo } from './fakeMapsRepo.js';

/**
 * LAS PIEZAS QUE ESTORBAN CUENTAN EN EL SERVIDOR (specs/modules/maps/SPEC.md § «Rebanada 6 · 6.7»).
 *
 * Desde agosto la fila de una pieza plantada guardaba «corta la vista» y «corta el paso» con su forma simple,
 * y el servidor la LEÍA (`listSightBlockingProps`) pero nunca la sumaba a la geometría: una columna marcada
 * como opaca tapaba en la pantalla y la vista pasaba por encima. Estos tests sujetan que ya no.
 */

const SCENE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DM = 'u-dm', PIP = 'u-pip';
const ROLES = { [DM]: 'dm' as const, [PIP]: 'player' as const };
/** El token de Pip, en la casilla (2, 5) → centro (67,5 · 148,5). Sin muros: la escena entera despejada. */
const PIP_TOKEN = { id: 'tk-pip', x: 2, y: 5, size: 1, controlledBy: PIP };
/** Una COLUMNA cuadrada de 54 px plantada en (162, 148,5): entre Pip y el lado derecho de la escena. */
const COLUMN = { id: 'sp-col', layerId: null, x: 162, y: 148.5, rotation: 0, blocksSight: true, blocksMove: true, blockShape: 'rect' as const, blockW: 54, blockH: 54, blockDx: 0, blockDy: 0 };
const seed = (over = {}) => fakeMapsRepo({ roles: ROLES, tokens: [PIP_TOKEN], walls: [], ...over });

describe('blockingGeometry — salas MÁS piezas', () => {
  it('sin piezas devuelve tal cual lo de las salas (la misma referencia recordada)', async () => {
    const maps = seed({ rooms: [] });
    expect(await blockingGeometry(maps, SCENE)).toEqual({ sight: [], move: [] });
  });

  it('una columna que tapa y frena mete sus cuatro lados en las dos listas', async () => {
    const g = await blockingGeometry(seed({ props: [COLUMN] }), SCENE);
    expect(g.sight).toHaveLength(4);
    expect(g.move).toHaveLength(4);
    expect(g.sight[0]).toEqual({ a: { x: 135, y: 121.5 }, b: { x: 189, y: 121.5 } });
  });

  it('una cortina sólo tapa y un banco sólo frena; una alfombra ni una cosa ni la otra', async () => {
    const cortina = { ...COLUMN, id: 'sp-cor', x: 60, blocksMove: false };
    const banco = { ...COLUMN, id: 'sp-ban', x: 220, blocksSight: false };
    const alfombra = { ...COLUMN, id: 'sp-alf', y: 40, blocksSight: false, blocksMove: false };
    const g = await blockingGeometry(seed({ props: [cortina, banco, alfombra] }), SCENE);
    expect(g.sight).toHaveLength(4);
    expect(g.move).toHaveLength(4);
    expect(g.sight[0]!.a.x).toBe(33);   // la cortina
    expect(g.move[0]![0]).toBe(193);    // el banco
  });
});

describe('computeSceneVision — la pieza que estorba', () => {
  it('jugador: la columna deja a oscuras lo que queda detrás de ella, y despejado lo que no', async () => {
    const r = await computeSceneVision({ maps: seed({ props: [COLUMN] }) }, { sceneId: SCENE, userId: PIP });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const poly = r.data.vision[0]!;
    // Justo detrás de la columna, en su misma línea: tapado.
    expect(pointInPolygon({ x: 240, y: 148.5 }, poly)).toBe(false);
    // Por encima de la columna, donde no hay nada: despejado hasta el borde.
    expect(pointInPolygon({ x: 240, y: 30 }, poly)).toBe(true);
    // Sin la columna, esa misma sombra no existe.
    const sin = await computeSceneVision({ maps: seed() }, { sceneId: SCENE, userId: PIP });
    if (sin.ok) expect(pointInPolygon({ x: 240, y: 148.5 }, sin.data.vision[0]!)).toBe(true);
  });

  it('una pieza que NO corta la vista no cambia nada de lo que se ve', async () => {
    const alfombra = { ...COLUMN, blocksSight: false, blocksMove: false };
    const r = await computeSceneVision({ maps: seed({ props: [alfombra] }) }, { sceneId: SCENE, userId: PIP });
    if (r.ok) expect(pointInPolygon({ x: 240, y: 148.5 }, r.data.vision[0]!)).toBe(true);
  });

  it('con paredes sólidas, la columna FRENA a la ficha que quiere atravesarla', async () => {
    const maps = seed({ props: [COLUMN], scene: { solidWalls: true } });
    // Pip arrastra su ficha desde (2, 5) hacia (7, 5): el camino cruza la columna, que va de x 135 a 189.
    const r = await computeSceneVision({ maps }, { sceneId: SCENE, userId: PIP, at: { tokenId: 'tk-pip', x: 7, y: 5 } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.corrected).not.toBeNull();
    // Se queda a este lado: el centro corregido (en px) no pasa del borde izquierdo de la columna.
    const centreX = (r.data.corrected!.x + 0.5) * 27;
    expect(centreX).toBeLessThan(135);
  });

  it('la misma columna marcada «deja pasar» no frena a nadie', async () => {
    const maps = seed({ props: [{ ...COLUMN, blocksMove: false }], scene: { solidWalls: true } });
    const r = await computeSceneVision({ maps }, { sceneId: SCENE, userId: PIP, at: { tokenId: 'tk-pip', x: 7, y: 5 } });
    if (r.ok) expect(r.data.corrected).toBeNull();
  });
});
