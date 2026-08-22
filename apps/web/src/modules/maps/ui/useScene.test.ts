import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { fakeMapsRepo, fakeVisionPort, PLAYER_USER, SCENE_WAREHOUSE, TOKEN_KAREN } from '../../../../tests/helpers/fakes';
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
  });

  it('soltar el token limpia la corrección: no clava el arrastre siguiente en el sitio viejo', async () => {
    const { repo, vision } = seed();
    const result = await mount(repo, vision);

    await tick(result, LIBRE);
    expect(result.current.serverCorrection(TOKEN_KAREN.id)).toEqual({ x: WALL_X, y: LIBRE.y });
    await act(async () => { await result.current.moveToken(TOKEN_KAREN.id, WALL_X, LIBRE.y); });
    expect(result.current.serverCorrection(TOKEN_KAREN.id)).toBeNull();
    // y la posición final se persiste donde se soltó
    expect(repo.tokenUpdates.at(-1)).toEqual({ id: TOKEN_KAREN.id, patch: { x: WALL_X, y: LIBRE.y } });
  });
});
