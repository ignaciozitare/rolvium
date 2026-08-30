import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { DRAWING_MINE, fakeMapsRepo, fakeVisionPort, LAYER_FLOOR, LAYER_MOSS, LAYER_OBJECTS, LIGHT_TORCH, PLAYER_USER, SCENE_WAREHOUSE, TOKEN_KAREN } from '../../../../tests/helpers/fakes';
import { newLightOf } from '../domain/useCases/layerRules';
import { useScene } from './useScene';

/**
 * El ciclo COMPLETO del arrastre con paredes sólidas, que ningún test ataba (fallo del 2026-08-22):
 * corrección del servidor → qué se pinta → QUÉ SE LE PREGUNTA al servidor en el tick siguiente. Sin ese
 * último eslabón, ningún doble podía fallar: el fallo estaba en preguntar por la posición ya corregida.
 *
 * El muro del doble está en x = 12 y contesta SÓLO cuando recorta, como el servidor real. A este navegador
 * no le llega ningún muro (en una escena real, 16 de 16 ocultos), así que su freno propio es `libre`: cada
 * `tick` reproduce el contrato de MapCanvas — pintar `corrección ?? libre`, preguntar por el deseo.
 */
const WALL_X = 12;
/** El dedo, al otro lado del muro. TOKEN_KAREN vive en (10, 11). */
const LIBRE = { x: 14, y: 11 };

const seed = () => ({
  repo: fakeMapsRepo({ tokens: [TOKEN_KAREN] }),
  vision: fakeVisionPort({}, at => (at.x > WALL_X ? { x: WALL_X, y: at.y } : null)),
});

let now = 1_000_000;
beforeEach(() => { now = 1_000_000; vi.spyOn(Date, 'now').mockImplementation(() => now); });
afterEach(() => { vi.restoreAllMocks(); });

type Hook = { current: ReturnType<typeof useScene> };

async function mount(repo: ReturnType<typeof fakeMapsRepo>, vision: ReturnType<typeof fakeVisionPort>) {
  const { result } = renderHook(() => useScene(repo, SCENE_WAREHOUSE, PLAYER_USER.id, vision));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  await waitFor(() => expect(result.current.fog).not.toBeNull());
  return result;
}

/** Un pointermove como los de MapCanvas: obedecer al servidor si ha hablado, y si no, el freno propio (= libre). */
async function tick(result: Hook, libre: { x: number; y: number }) {
  now += 150; // pasa el throttle de visión (140 ms) y el del broadcast (50 ms)
  const server = result.current.serverCorrection(TOKEN_KAREN.id);
  const pos = server ?? libre;
  await act(async () => { result.current.dragToken(TOKEN_KAREN.id, pos.x, pos.y, libre); });
  return pos;
}

describe('useScene · paredes sólidas, el ciclo entero', () => {
  it('la corrección no oscila: se pregunta por el deseo y el token se queda a este lado del muro', async () => {
    const { repo, vision } = seed();
    const result = await mount(repo, vision);

    const t1 = await tick(result, LIBRE);
    expect(t1).toEqual(LIBRE); // el servidor aún no ha hablado: se pinta libre
    const t2 = await tick(result, LIBRE);
    expect(t2).toEqual({ x: WALL_X, y: LIBRE.y }); // recortó: se obedece
    const t3 = await tick(result, LIBRE);
    expect(t3).toEqual({ x: WALL_X, y: LIBRE.y }); // y NO oscila: con el fallo, aquí volvía a `libre`

    // al servidor se le preguntó SIEMPRE por el deseo del dedo, nunca por su propia corrección
    expect(vision.calls.filter(c => c.at).map(c => c.at!.x)).toEqual([LIBRE.x, LIBRE.x, LIBRE.x]);
    // y a la mesa se le cuenta dónde está el token DE VERDAD, no el deseo
    expect(repo.broadcasts.flatMap(b => (b.event.type === 'token.moved' ? [b.event.x] : []))).toEqual([LIBRE.x, WALL_X, WALL_X]);
    // el ancla del barrido: primer tick SIN `from` (manda la posición guardada); después, la última CONTESTADA
    const froms = vision.calls.filter(c => c.at).map(c => (c.at as { from?: { x: number } }).from?.x);
    expect(froms).toEqual([undefined, WALL_X, WALL_X]);
    // y el disco libre queda expuesto para que el lienzo no pinte más allá: pegado al muro, holgura 0
    expect(result.current.dragBound(TOKEN_KAREN.id)).toEqual({ x: WALL_X, y: LIBRE.y, clearance: 0 });
  });

  it('soltar el token limpia la corrección: no clava el arrastre siguiente en el sitio viejo', async () => {
    const { repo, vision } = seed();
    const result = await mount(repo, vision);

    await tick(result, LIBRE);
    expect(result.current.serverCorrection(TOKEN_KAREN.id)).toEqual({ x: WALL_X, y: LIBRE.y });
    await act(async () => { await result.current.moveToken(TOKEN_KAREN.id, WALL_X, LIBRE.y); });
    expect(result.current.serverCorrection(TOKEN_KAREN.id)).toBeNull();
    expect(result.current.dragBound(TOKEN_KAREN.id)).toBeNull();
    // y la posición final se persiste donde se soltó
    expect(repo.tokenUpdates.at(-1)).toEqual({ id: TOKEN_KAREN.id, patch: { x: WALL_X, y: LIBRE.y } });
  });
});

/**
 * Capas y luces (rebanada 7). Lo que se prueba aquí, y no en el dominio, es la CONVIVENCIA con lo que ya
 * había: que cargarlas no rompe el resto, que el borrado espeja lo que hace la base de datos, y —lo más
 * importante— que NADA de esto pide visión de nuevo: una capa es composición y una luz es pintura.
 */
describe('useScene — capas y luces', () => {
  const seedLayers = () => fakeMapsRepo({ tokens: [TOKEN_KAREN], layers: [LAYER_OBJECTS, LAYER_FLOOR, LAYER_MOSS], lights: [LIGHT_TORCH], drawings: [{ ...DRAWING_MINE, layerId: LAYER_MOSS.id }] });

  it('carga capas y luces con el resto de la escena', async () => {
    const repo = seedLayers();
    const r = await mount(repo, fakeVisionPort());
    expect(r.current.layers.map(l => l.id)).toEqual(['ly-obj', 'ly-floor', 'ly-moss']);
    expect(r.current.lights.map(l => l.id)).toEqual(['li-torch']);
  });

  it('la capa nueva de terreno se coloca encima de las que ya hay', async () => {
    const repo = seedLayers();
    const r = await mount(repo, fakeVisionPort());
    await act(async () => { await r.current.addTerrainLayer({ name: 'Niebla baja' }); });
    const created = repo.layers.at(-1)!;
    expect(created).toMatchObject({ kind: 'terrain', name: 'Niebla baja', sortOrder: 2 });
    expect(r.current.layers.some(l => l.id === created.id)).toBe(true);
  });

  /**
   * Espeja el ON DELETE de la migración: los dibujos y las luces de esa capa se van con ella, pero las
   * FICHAS vuelven a su capa natural. Perder el personaje de un jugador por borrar una capa decorativa
   * sería un desastre silencioso.
   */
  it('borrar una capa se lleva sus dibujos y sus luces, pero no sus fichas', async () => {
    const repo = fakeMapsRepo({
      tokens: [{ ...TOKEN_KAREN, layerId: LAYER_MOSS.id }], layers: [LAYER_OBJECTS, LAYER_MOSS],
      lights: [{ ...LIGHT_TORCH, layerId: LAYER_MOSS.id }], drawings: [{ ...DRAWING_MINE, layerId: LAYER_MOSS.id }],
    });
    const r = await mount(repo, fakeVisionPort());
    await act(async () => { await r.current.removeLayer(LAYER_MOSS.id); });
    expect(r.current.layers.map(l => l.id)).toEqual(['ly-obj']);
    expect(r.current.drawings).toHaveLength(0);
    expect(r.current.lights).toHaveLength(0);
    expect(r.current.tokens[0]).toMatchObject({ id: TOKEN_KAREN.id, layerId: null });
  });

  it('reordenar escribe sólo las dos filas que cambian de sitio', async () => {
    const repo = seedLayers();
    const r = await mount(repo, fakeVisionPort());
    await act(async () => { await r.current.reorderLayer(LAYER_MOSS.id, 'down'); });
    expect(repo.layerUpdates).toEqual([{ id: 'ly-moss', patch: { sortOrder: 0 } }, { id: 'ly-floor', patch: { sortOrder: 1 } }]);
    // Tras el intercambio, «Musgo» es la de más abajo: bajarla otra vez no escribe nada — no se promete un
    // movimiento que no pasa.
    repo.layerUpdates.length = 0;
    await act(async () => { await r.current.reorderLayer(LAYER_MOSS.id, 'down'); });
    expect(repo.layerUpdates).toEqual([]);
  });

  it('guardar la máscara sube la versión, y quitarla deja la capa entera', async () => {
    const repo = seedLayers();
    const r = await mount(repo, fakeVisionPort());
    const moss = r.current.layers.find(l => l.id === LAYER_MOSS.id)!;
    const before = moss.maskVersion;
    await act(async () => { await r.current.saveMask(moss, new Blob(['x'])); });
    expect(repo.masksSaved).toEqual([{ layerId: 'ly-moss', bytes: 1 }]);
    expect(r.current.layers.find(l => l.id === LAYER_MOSS.id)!.maskVersion).toBe(before + 1);
    await act(async () => { await r.current.clearMask(moss); });
    expect(r.current.layers.find(l => l.id === LAYER_MOSS.id)!.maskUrl).toBeNull();
  });

  it('las luces se ponen, se retocan y se quitan', async () => {
    const repo = seedLayers();
    const r = await mount(repo, fakeVisionPort());
    await act(async () => { await r.current.addLight(newLightOf('fire', { x: 100, y: 200 }, SCENE_WAREHOUSE)); });
    const fire = repo.lights.at(-1)!;
    expect(fire).toMatchObject({ kind: 'fire', x: 100, y: 200, flicker: true, castsShadow: false });
    await act(async () => { await r.current.patchLight(fire.id, { flicker: false }); });
    expect(r.current.lights.find(l => l.id === fire.id)!.flicker).toBe(false);
    await act(async () => { await r.current.removeLight(fire.id); });
    expect(r.current.lights.some(l => l.id === fire.id)).toBe(false);
  });

  /**
   * La prueba que de verdad importa: nada de esto vuelve a pedir la visión al servidor. Si un día una luz
   * ilumina de verdad, eso será una decisión de reglas y este test tendrá que cambiar A PROPÓSITO.
   */
  it('ni las capas ni las luces piden la visión de nuevo: son composición y pintura', async () => {
    const repo = seedLayers();
    const vision = fakeVisionPort();
    const r = await mount(repo, vision);
    const before = vision.calls.length;
    await act(async () => {
      await r.current.patchLayer(LAYER_MOSS.id, { visible: false });
      await r.current.addTerrainLayer();
      await r.current.addLight(newLightOf('torch', { x: 1, y: 2 }, SCENE_WAREHOUSE));
      await r.current.patchLight(LIGHT_TORCH.id, { rangeM: 12 });
    });
    expect(vision.calls.length).toBe(before);
    expect(repo.broadcasts).toEqual([]);
  });

  /** Y llegan por realtime como todo lo demás, sin recargar la escena. */
  it('una capa que cambia en otro navegador llega por el canal de la escena', async () => {
    const repo = seedLayers();
    const r = await mount(repo, fakeVisionPort());
    act(() => { repo.emit('sc-1', { layer: { type: 'UPDATE', id: LAYER_MOSS.id, row: { ...LAYER_MOSS, visible: false } } }); });
    expect(r.current.layers.find(l => l.id === LAYER_MOSS.id)!.visible).toBe(false);
    act(() => { repo.emit('sc-1', { light: { type: 'DELETE', id: LIGHT_TORCH.id, row: null } }); });
    expect(r.current.lights).toHaveLength(0);
  });
});
