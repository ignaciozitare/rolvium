import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { LAYER_FLOOR, LAYER_MOSS, SCENE_WAREHOUSE } from '../../../../tests/helpers/fakes';
import { DEFAULT_MASK_HARDNESS, maskSize } from '../domain/useCases/layerRules';
import { useMaskPainter } from './useMaskPainter';

/**
 * jsdom no trae lienzo de verdad (`getContext` devuelve null), así que se le pone uno de mentira que apunta
 * lo que se le pide. Es exactamente lo que hay que probar aquí: QUÉ se le manda dibujar y CUÁNDO se sube —
 * el dibujo en sí es del navegador.
 */
interface FakeCtx { calls: string[]; ops: string[]; stops: [number, string][]; arcs: { x: number; y: number; r: number }[] }
let ctx: FakeCtx;

function fakeContext(): FakeCtx & Record<string, unknown> {
  const c: FakeCtx = { calls: [], ops: [], stops: [], arcs: [] };
  const api = {
    ...c,
    save: () => c.calls.push('save'),
    restore: () => c.calls.push('restore'),
    clearRect: () => c.calls.push('clearRect'),
    drawImage: () => c.calls.push('drawImage'),
    beginPath: () => {},
    fill: () => c.calls.push('fill'),
    arc: (x: number, y: number, r: number) => c.arcs.push({ x, y, r }),
    createRadialGradient: () => ({ addColorStop: (o: number, col: string) => c.stops.push([o, col]) }),
    set globalCompositeOperation(v: string) { c.ops.push(v); },
    get globalCompositeOperation() { return c.ops.at(-1) ?? ''; },
    fillStyle: null as unknown,
  };
  ctx = c;
  return api as FakeCtx & Record<string, unknown>;
}

const BLOB = new Blob(['png'], { type: 'image/png' });

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fakeContext() as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,PINTADO');
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(cb => { cb(BLOB); });
});
afterEach(() => { vi.restoreAllMocks(); });

const deps = () => ({ saveMask: vi.fn().mockResolvedValue(undefined), clearMask: vi.fn().mockResolvedValue(undefined) });
const mount = (layer = LAYER_MOSS, d = deps(), scene = SCENE_WAREHOUSE) => ({ d, ...renderHook(() => useMaskPainter(scene, layer, d)) });

describe('useMaskPainter', () => {
  it('arranca con la máscara YA GUARDADA de la capa, no en blanco', () => {
    const { result } = mount();
    // Si empezase vacío, la primera pincelada borraría todo lo pintado en sesiones anteriores.
    expect(result.current.preview).toBe('https://x/backgrounds/c1/masks/ly-moss.png?v=3');
  });

  it('sin máscara guardada la capa se ve entera', () => {
    const { result } = mount(LAYER_FLOOR);
    expect(result.current.preview).toBeNull();
  });

  /** Los dos sentidos son los dos modos de composición: es lo que hace verdad «volver atrás». */
  it('borrar pinta encima y devolver borra lo pintado', () => {
    const { result } = mount();
    act(() => { result.current.paint({ x: 100, y: 100 }, { x: 100, y: 100 }, 27, 1, 'erase', DEFAULT_MASK_HARDNESS); });
    expect(ctx.ops.at(-1)).toBe('source-over');
    act(() => { result.current.paint({ x: 100, y: 100 }, { x: 100, y: 100 }, 27, 1, 'restore', DEFAULT_MASK_HARDNESS); });
    expect(ctx.ops.at(-1)).toBe('destination-out');
  });

  it('la fuerza es la opacidad del brochazo, y el borde va suave', () => {
    const { result } = mount();
    act(() => { result.current.paint({ x: 100, y: 100 }, { x: 100, y: 100 }, 27, 0.5, 'erase', DEFAULT_MASK_HARDNESS); });
    expect(ctx.stops[0]).toEqual([0, 'rgba(0,0,0,0.5)']);
    // Y muere en transparente: un círculo duro dejaría el recorte a tijera, y lo que se pidió es MEZCLAR.
    expect(ctx.stops.at(-1)).toEqual([1, 'rgba(0,0,0,0)']);
  });

  /**
   * La DUREZA es el BORDE, y hasta hoy estaba escrita a fuego aquí mismo: el degradado iba siempre
   * `0 → a`, `0.6 → 0.75a`, `1 → 0`. El dueño pidió elegirla, así que este test fija que de verdad la manda
   * el mando y no una constante.
   */
  it('la dureza mueve el borde del brochazo, y la fuerza se queda igual', () => {
    const { result } = mount();
    act(() => { result.current.paint({ x: 100, y: 100 }, { x: 100, y: 100 }, 27, 0.5, 'erase', 0); });
    const suave = ctx.stops[1]![0];
    act(() => { result.current.paint({ x: 100, y: 100 }, { x: 100, y: 100 }, 27, 0.5, 'erase', 1); });
    const duro = ctx.stops[1]![0];
    expect(suave).toBeLessThan(duro);
    expect(duro).toBeLessThan(1);
    // La opacidad del centro es cosa de la FUERZA: la dureza no la toca.
    expect(ctx.stops[0]).toEqual([0, 'rgba(0,0,0,0.5)']);
  });

  it('la fuerza no se sale de 0..1 aunque le llegue basura', () => {
    const { result } = mount();
    act(() => { result.current.paint({ x: 10, y: 10 }, { x: 10, y: 10 }, 27, 5, 'erase', DEFAULT_MASK_HARDNESS); });
    expect(ctx.stops[0]).toEqual([0, 'rgba(0,0,0,1)']);
  });

  /** La máscara se guarda reducida: sin convertir, pintar en una esquina dejaría el brochazo en otra parte. */
  it('pinta en las coordenadas de la MÁSCARA, no en las de la escena', () => {
    const size = maskSize(SCENE_WAREHOUSE);
    const { result } = mount();
    act(() => { result.current.paint({ x: SCENE_WAREHOUSE.width, y: SCENE_WAREHOUSE.height }, { x: SCENE_WAREHOUSE.width, y: SCENE_WAREHOUSE.height }, 27, 1, 'erase', DEFAULT_MASK_HARDNESS); });
    expect(ctx.arcs.at(-1)!.x).toBeCloseTo(size.width, 5);
    expect(ctx.arcs.at(-1)!.y).toBeCloseTo(size.height, 5);
  });

  it('un arrastre largo se rellena para no salir a lunares', () => {
    const { result } = mount();
    act(() => { result.current.paint({ x: 0, y: 0 }, { x: 400, y: 0 }, 27, 1, 'erase', DEFAULT_MASK_HARDNESS); });
    expect(ctx.arcs.length).toBeGreaterThan(10);
  });

  /** Un guardado por pincelada, no cien: subir el PNG en cada `pointermove` sería insostenible. */
  it('pintar NO sube nada; sólo lo hace el soltar', async () => {
    const { result, d } = mount();
    act(() => { result.current.paint({ x: 10, y: 10 }, { x: 40, y: 40 }, 27, 1, 'erase', DEFAULT_MASK_HARDNESS); });
    expect(d.saveMask).not.toHaveBeenCalled();
    await act(async () => { await result.current.flush(); });
    expect(d.saveMask).toHaveBeenCalledWith(LAYER_MOSS, BLOB);
  });

  it('soltar sin haber pintado no gasta una subida', async () => {
    const { result, d } = mount();
    await act(async () => { await result.current.flush(); });
    expect(d.saveMask).not.toHaveBeenCalled();
  });

  it('la vista previa se actualiza al pintar, sin esperar a que suba', async () => {
    const { result } = mount();
    act(() => { result.current.paint({ x: 10, y: 10 }, { x: 40, y: 40 }, 27, 1, 'erase', DEFAULT_MASK_HARDNESS); });
    await waitFor(() => expect(result.current.preview).toBe('data:image/png;base64,PINTADO'));
  });

  it('restaurar deja la capa entera y borra la máscara guardada', async () => {
    const { result, d } = mount();
    await act(async () => { await result.current.reset(); });
    expect(result.current.preview).toBeNull();
    expect(d.clearMask).toHaveBeenCalledWith(LAYER_MOSS);
    expect(ctx.calls).toContain('clearRect');
  });

  it('sin capa activa el pincel no hace nada, en vez de reventar', () => {
    const { result, d } = mount(null as never);
    act(() => { result.current.paint({ x: 1, y: 1 }, { x: 2, y: 2 }, 27, 1, 'erase', DEFAULT_MASK_HARDNESS); });
    expect(ctx?.arcs ?? []).toHaveLength(0);
    expect(d.saveMask).not.toHaveBeenCalled();
  });

  it('sin escena activa tampoco: el director aún no ha activado ninguna', () => {
    const { result } = mount(LAYER_MOSS, deps(), null as never);
    act(() => { result.current.paint({ x: 1, y: 1 }, { x: 2, y: 2 }, 27, 1, 'erase', DEFAULT_MASK_HARDNESS); });
    expect(result.current.preview).toBe('https://x/backgrounds/c1/masks/ly-moss.png?v=3');
  });
});
