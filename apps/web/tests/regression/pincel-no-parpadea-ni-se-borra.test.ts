import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { SCENE_WAREHOUSE } from '../helpers/fakes';
import { DEFAULT_MASK_HARDNESS } from '@/modules/maps/domain/useCases/layerRules';
import { isStaleRow } from '@/modules/maps/domain/useCases/liveRules';
import { usePaintBrush, type PaintTarget } from '@/modules/maps/ui/usePaintBrush';

/**
 * 🐞 «*Cada tanto las texturas parpadean y se borran solas, si toco Ctrl+Z vuelven*» (suyo, 2026-09-15; en
 * producción mucho más que en local, porque allí la red tarda).
 *
 * Eran dos caminos hacia el mismo sitio, y los dos se pinan aquí:
 *   1. El pincel se rehacía con la pintura que ACABABA de subir: guardar sube la versión del destino, o sea
 *      que su `src` cambia, y el lienzo se vaciaba para volver a bajarla por red. Mientras bajaba, parpadeo;
 *      y si empezabas la pincelada siguiente antes de que llegara, la nueva partía de un lienzo vacío y se
 *      subía así — lo anterior desaparecía. Ctrl+Z lo devolvía porque el historial guarda su propia copia.
 *   2. El eco de tiempo real podía llegar DESORDENADO y devolver la fila a su versión anterior, con lo que el
 *      mapa volvía a apuntar al PNG viejo.
 */

const BLOB = new Blob(['png'], { type: 'image/png' });
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
    clearRect: () => {}, drawImage: () => {}, save: () => {}, restore: () => {}, scale: () => {}, setTransform: () => {},
    beginPath: () => {}, arc: () => {}, fill: () => {}, fillRect: () => {}, moveTo: () => {}, lineTo: () => {}, closePath: () => {},
    createRadialGradient: () => ({ addColorStop: () => {} }), createPattern: () => null, clip: () => {},
    globalCompositeOperation: '', globalAlpha: 1, fillStyle: '',
  }) as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,LO-QUE-LLEVO-PINTADO');
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(cb => { cb(BLOB); });
});
afterEach(() => { vi.restoreAllMocks(); });

const destino = (src: string | null, id = 'suelo'): PaintTarget =>
  ({ id, src, clip: null, save: vi.fn().mockResolvedValue(undefined), clear: vi.fn().mockResolvedValue(undefined) });
const TINTA = { textureUrl: null, tilePx: 54, color: '#5f8f6a' };
const TRAZO = { strength: 1, hardness: DEFAULT_MASK_HARDNESS, tip: 'soft' as const, roughness: 0, mode: 'paint' as const };

/**
 * 🐞 Y SU CONTRAPARTIDA, del día siguiente: «*desaparecen habitaciones cuando quiero pintar*» (2026-09-16).
 *
 * El arreglo de arriba se pasó de frenada. Al dejar de mirar `src`, un destino elegido ANTES de que su pintura
 * estuviera cargada se quedaba con el lienzo vacío PARA SIEMPRE. Y en el suelo de las salas eso no es «se ve
 * sin pintar»: mientras el pincel está puesto, el mapa dibuja SÓLO esta vista previa, así que con ella vacía
 * la sala entera se esfuma. En sus mazmorras es literal — 56 salas, 53 con pintura y NINGUNA con textura: la
 * pintura ES el suelo.
 *
 * Los dos casos se distinguen por si ÉL ha pintado algo en este destino, no por `dirty` (que se pone a falso
 * en cada guardado).
 */
describe('🐞 las habitaciones desaparecían al ponerse a pintar (2026-09-16)', () => {
  it('la pintura que llega TARDE se coge, aunque el destino no haya cambiado de id', async () => {
    const { result, rerender } = renderHook(({ t }) => usePaintBrush(SCENE_WAREHOUSE, t), { initialProps: { t: destino(null) } });
    // Eligió el pincel antes de que llegara la pintura guardada: de momento no hay nada que enseñar.
    expect(result.current.preview).toBe(null);
    // …y llega. Mismo destino, mismo id, pero ahora CON su pintura.
    rerender({ t: destino('https://x/suelo.png?v=7') });
    expect(result.current.preview).toBe('https://x/suelo.png?v=7');
  });

  it('pero en cuanto ÉL ha pintado algo, lo que llegue por la red NO le pisa los píxeles', async () => {
    const { result, rerender } = renderHook(({ t }) => usePaintBrush(SCENE_WAREHOUSE, t), { initialProps: { t: destino(null) } });
    act(() => { result.current.paint({ x: 0, y: 0 }, { x: 40, y: 0 }, 20, TINTA, TRAZO, true); });
    await act(async () => { await result.current.flush(); });
    expect(result.current.preview).toBe('data:image/png;base64,LO-QUE-LLEVO-PINTADO');
    // Su propio guardado vuelve como versión nueva: no se baja otra vez, que era el parpadeo del 15-09.
    rerender({ t: destino('https://x/suelo.png?v=8') });
    expect(result.current.preview).toBe('data:image/png;base64,LO-QUE-LLEVO-PINTADO');
  });

  it('y al CAMBIAR de destino sí se empieza de la pintura del nuevo', () => {
    const { result, rerender } = renderHook(({ t }) => usePaintBrush(SCENE_WAREHOUSE, t), { initialProps: { t: destino(null) } });
    act(() => { result.current.paint({ x: 0, y: 0 }, { x: 40, y: 0 }, 20, TINTA, TRAZO, true); });
    rerender({ t: destino('https://x/roca.png?v=2', 'roca') });
    expect(result.current.preview).toBe('https://x/roca.png?v=2');
  });
});

describe('🐞 el pincel parpadeaba y se borraba solo (2026-09-15)', () => {
  it('DOS pinceladas seguidas: la segunda parte de lo que ya había, no de un lienzo en blanco', async () => {
    const { result, rerender } = renderHook(({ t }) => usePaintBrush(SCENE_WAREHOUSE, t), { initialProps: { t: destino(null) } });
    act(() => { result.current.paint({ x: 0, y: 0 }, { x: 40, y: 0 }, 20, TINTA, TRAZO, true); });
    await act(async () => { await result.current.flush(); });

    // El servidor contesta con la pintura guardada: MISMO destino, versión nueva. Antes, esto vaciaba el lienzo.
    rerender({ t: destino('https://x/paint/room-suelo.png?v=1') });
    expect(result.current.preview).toBe('data:image/png;base64,LO-QUE-LLEVO-PINTADO');

    // Segunda pincelada sin esperar a que baje nada: lo que se sube sigue siendo el lienzo con las dos.
    const d2 = destino('https://x/paint/room-suelo.png?v=1');
    rerender({ t: d2 });
    act(() => { result.current.paint({ x: 60, y: 0 }, { x: 90, y: 0 }, 20, TINTA, TRAZO, true); });
    await act(async () => { await result.current.flush(); });
    expect(d2.save).toHaveBeenCalledWith(BLOB);
    expect(result.current.preview).toBe('data:image/png;base64,LO-QUE-LLEVO-PINTADO');
  });

  it('un eco de tiempo real más viejo no devuelve la capa a su pintura anterior', () => {
    const antes = { id: 'l1', paintUrl: 'https://x/paint/layer-l1.png', paintVersion: 8, updatedAt: '2026-09-15T22:00:05.000Z' };
    const ecoViejo = { id: 'l1', paintUrl: 'https://x/paint/layer-l1.png', paintVersion: 7, updatedAt: '2026-09-15T22:00:00.000Z' };
    const ecoNuevo = { id: 'l1', paintUrl: 'https://x/paint/layer-l1.png', paintVersion: 9, updatedAt: '2026-09-15T22:00:09.000Z' };
    expect(isStaleRow(antes, ecoViejo)).toBe(true);
    expect(isStaleRow(antes, ecoNuevo)).toBe(false);
  });
});
