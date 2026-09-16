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

/**
 * LA SILUETA, EN EL SERVIDOR (specs/modules/maps/SPEC.md § 6.9).
 *
 * Su queja del 2026-09-16 era una SOMBRA: «la sombra que proyectaba un camión era un bloque negro rectangular».
 * Esa sombra la calcula el servidor, no el navegador, así que la silueta sólo arregla lo que él ve si llega
 * hasta aquí. Estos tests sujetan las dos mitades: que la silueta se usa, y que una pieza que dice estorbar
 * por silueta pero no trae ninguna NO deja de estorbar en silencio.
 */
describe('la silueta llega al servidor (§ 6.9)', () => {
  /**
   * Un camión apaisado plantado en (189, 148,5): su HUELLA es un cuadrado de 108 px —el rectángulo de hoy—,
   * pero su carrocería sólo ocupa 10,8 px de alto. Ahí está la sombra del bloque negro de su captura.
   */
  const ANILLO = [{ x: -0.5, y: -0.05 }, { x: 0.5, y: -0.05 }, { x: 0.5, y: 0.05 }, { x: -0.5, y: 0.05 }];
  const CAMION = { ...COLUMN, id: 'sp-cam', x: 189, blockW: 108, blockH: 108, blockShape: 'silhouette' as const, silhouette: ANILLO };

  it('la forma que estorba son los puntos de la silueta, no los cuatro del rectángulo de su huella', async () => {
    const g = await blockingGeometry(seed({ props: [CAMION] }), SCENE);
    expect(g.sight).toHaveLength(ANILLO.length);
    // Ancho entero de la huella (189 ± 54) y sólo una rebanada de alto (148,5 ± 5,4): ESA es la diferencia.
    expect(g.sight[0]).toEqual({ a: { x: 135, y: 143.1 }, b: { x: 243, y: 143.1 } });
  });

  it('🔑 lo que él pidió: por encima del camión ya se ve — el bloque negro rectangular se acabó', async () => {
    const conSilueta = await computeSceneVision({ maps: seed({ props: [CAMION] }) }, { sceneId: SCENE, userId: PIP });
    const conBloque = await computeSceneVision({ maps: seed({ props: [{ ...CAMION, blockShape: 'rect' as const }] }) }, { sceneId: SCENE, userId: PIP });
    expect(conSilueta.ok && conBloque.ok).toBe(true);
    if (!conSilueta.ok || !conBloque.ok) return;
    // Un punto detrás del camión pero POR ENCIMA de su carrocería: dentro del rectángulo, fuera de la silueta.
    const arriba = { x: 260, y: 100 };
    expect(pointInPolygon(arriba, conBloque.data.vision[0]!)).toBe(false);   // el bloque negro de su captura
    expect(pointInPolygon(arriba, conSilueta.data.vision[0]!)).toBe(true);   // con la silueta, despejado
    // Y detrás de la carrocería sigue tapando: la silueta recorta la sombra, no la apaga.
    expect(pointInPolygon({ x: 260, y: 148.5 }, conSilueta.data.vision[0]!)).toBe(false);
  });

  it('🔑 una pieza que dice «estorbo por mi silueta» sin traerla tapa como el RECTÁNGULO, nunca menos', async () => {
    const muda = { ...CAMION, silhouette: null };
    const g = await blockingGeometry(seed({ props: [muda] }), SCENE);
    const rect = await blockingGeometry(seed({ props: [{ ...CAMION, blockShape: 'rect' as const }] }), SCENE);
    expect(g.sight).toEqual(rect.sight);
    expect(g.move).toEqual(rect.move);
    // Y una fila de antes de la columna, que ni siquiera trae el campo, se comporta igual.
    const { silhouette: _s, ...vieja } = muda;
    expect((await blockingGeometry(seed({ props: [vieja] }), SCENE)).sight).toEqual(rect.sight);
  });

  it('con paredes sólidas, el camión frena por su carrocería y deja pasar por encima', async () => {
    const maps = seed({ props: [CAMION], scene: { solidWalls: true } });
    // Atravesarlo de lleno (misma fila que Pip, y 7 casillas: cruza la carrocería) → frenado.
    const through = await computeSceneVision({ maps }, { sceneId: SCENE, userId: PIP, at: { tokenId: 'tk-pip', x: 7, y: 5 } });
    if (through.ok) expect(through.data.corrected).not.toBeNull();
    // Pasar por encima de la carrocería (fila 2, muy por encima de sus 10,8 px de alto) → libre.
    const over = seed({ props: [CAMION], scene: { solidWalls: true }, tokens: [{ ...PIP_TOKEN, y: 2 }] });
    const r = await computeSceneVision({ maps: over }, { sceneId: SCENE, userId: PIP, at: { tokenId: 'tk-pip', x: 7, y: 2 } });
    if (r.ok) expect(r.data.corrected).toBeNull();
  });
});
