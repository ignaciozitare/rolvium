import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { LAYER_FLOOR, LAYER_MOSS, SCENE_WAREHOUSE } from '../../../../tests/helpers/fakes';
import { DEFAULT_MASK_HARDNESS, maskSize, maskSrc } from '../domain/useCases/layerRules';
import { useMaskPainter, type BrushStroke, type MaskTarget } from './useMaskPainter';

/**
 * jsdom no trae lienzo de verdad (`getContext` devuelve null), así que se le pone uno de mentira que apunta
 * lo que se le pide. Es exactamente lo que hay que probar aquí: QUÉ se le manda dibujar y CUÁNDO se sube —
 * el dibujo en sí es del navegador.
 */
interface FakeCtx {
  calls: string[]; ops: string[]; stops: [number, string][]; arcs: { x: number; y: number; r: number }[];
  /** Los vértices del contorno roto: es lo único que distingue un brochazo desgarrado de un disco. */
  lines: { x: number; y: number }[]; clips: number;
}
let ctx: FakeCtx;

function fakeContext(): FakeCtx & Record<string, unknown> {
  const c: FakeCtx = { calls: [], ops: [], stops: [], arcs: [], lines: [], clips: 0 };
  const api = {
    ...c,
    save: () => c.calls.push('save'),
    restore: () => c.calls.push('restore'),
    clearRect: () => c.calls.push('clearRect'),
    drawImage: () => c.calls.push('drawImage'),
    beginPath: () => {},
    fill: () => c.calls.push('fill'),
    arc: (x: number, y: number, r: number) => c.arcs.push({ x, y, r }),
    scale: () => c.calls.push('scale'),
    setTransform: () => c.calls.push('setTransform'),
    clip: () => { c.clips += 1; c.calls.push('clip'); },
    moveTo: (x: number, y: number) => c.lines.push({ x, y }),
    lineTo: (x: number, y: number) => c.lines.push({ x, y }),
    closePath: () => c.calls.push('closePath'),
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
  /*
   * jsdom tampoco trae `Path2D`, y el hook lo pide antes de recortar —con razón: sin él no hay forma de
   * encerrar el brochazo—. Se le pone uno de mentira para poder comprobar QUE recorta; el recorte en sí lo
   * hace el navegador.
   */
  vi.stubGlobal('Path2D', class { constructor(public d?: string) {} });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fakeContext() as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,PINTADO');
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(cb => { cb(BLOB); });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

/** Un destino de mentira: una capa, el suelo de una sala o nada. Lo que el hook necesita saber, y nada más. */
const targetOf = (over: Partial<MaskTarget> = {}) => ({
  id: 'ly-moss', src: maskSrc(LAYER_MOSS), clip: null,
  save: vi.fn().mockResolvedValue(undefined), clear: vi.fn().mockResolvedValue(undefined),
  ...over,
});
const mount = (target: ReturnType<typeof targetOf> | null = targetOf(), scene = SCENE_WAREHOUSE) =>
  ({ d: target, ...renderHook(() => useMaskPainter(scene, target)) });

/** El brochazo de siempre: disco difuminado, sin nada roto. Cada test cambia sólo lo suyo. */
const stroke = (over: Partial<BrushStroke> = {}): BrushStroke =>
  ({ strength: 1, hardness: DEFAULT_MASK_HARDNESS, tip: 'soft', roughness: 0, dir: 'erase', ...over });

describe('useMaskPainter', () => {
  it('arranca con la máscara YA GUARDADA del destino, no en blanco', () => {
    const { result } = mount();
    // Si empezase vacío, la primera pincelada borraría todo lo pintado en sesiones anteriores.
    expect(result.current.preview).toBe('https://x/backgrounds/c1/masks/ly-moss.png?v=3');
  });

  it('sin máscara guardada se ve entero', () => {
    const { result } = mount(targetOf({ id: LAYER_FLOOR.id, src: null }));
    expect(result.current.preview).toBeNull();
  });

  /**
   * CAMBIAR DE DESTINO SE TRAE SU MÁSCARA. Es lo que hace posible saltar de una capa al suelo de una sala sin
   * llevarse pintado lo de la otra — y sin esto la primera pincelada en la sala habría borrado lo de la capa.
   */
  it('al cambiar de destino se empieza de la máscara del destino nuevo', () => {
    const { result, rerender } = renderHook(({ tg }: { tg: MaskTarget }) => useMaskPainter(SCENE_WAREHOUSE, tg),
      { initialProps: { tg: targetOf() as MaskTarget } });
    expect(result.current.preview).toBe('https://x/backgrounds/c1/masks/ly-moss.png?v=3');
    rerender({ tg: targetOf({ id: 'rm-1', src: 'https://x/backgrounds/c1/masks/room-rm-1.png?v=t2' }) });
    expect(result.current.preview).toBe('https://x/backgrounds/c1/masks/room-rm-1.png?v=t2');
  });

  /** Los dos sentidos son los dos modos de composición: es lo que hace verdad «volver atrás». */
  it('borrar pinta encima y devolver borra lo pintado', () => {
    const { result } = mount();
    act(() => { result.current.paint({ x: 100, y: 100 }, { x: 100, y: 100 }, 27, stroke({ dir: 'erase' })); });
    expect(ctx.ops.at(-1)).toBe('source-over');
    act(() => { result.current.paint({ x: 100, y: 100 }, { x: 100, y: 100 }, 27, stroke({ dir: 'restore' })); });
    expect(ctx.ops.at(-1)).toBe('destination-out');
  });

  it('la fuerza es la opacidad del brochazo, y el borde va suave', () => {
    const { result } = mount();
    act(() => { result.current.paint({ x: 100, y: 100 }, { x: 100, y: 100 }, 27, stroke({ strength: 0.5 })); });
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
    act(() => { result.current.paint({ x: 100, y: 100 }, { x: 100, y: 100 }, 27, stroke({ strength: 0.5, hardness: 0 })); });
    const suave = ctx.stops[1]![0];
    act(() => { result.current.paint({ x: 100, y: 100 }, { x: 100, y: 100 }, 27, stroke({ strength: 0.5, hardness: 1 })); });
    const duro = ctx.stops[1]![0];
    expect(suave).toBeLessThan(duro);
    expect(duro).toBeLessThan(1);
    // La opacidad del centro es cosa de la FUERZA: la dureza no la toca.
    expect(ctx.stops[0]).toEqual([0, 'rgba(0,0,0,0.5)']);
  });

  it('la fuerza no se sale de 0..1 aunque le llegue basura', () => {
    const { result } = mount();
    act(() => { result.current.paint({ x: 10, y: 10 }, { x: 10, y: 10 }, 27, stroke({ strength: 5 })); });
    expect(ctx.stops[0]).toEqual([0, 'rgba(0,0,0,1)']);
  });

  /** La máscara se guarda reducida: sin convertir, pintar en una esquina dejaría el brochazo en otra parte. */
  it('pinta en las coordenadas de la MÁSCARA, no en las de la escena', () => {
    const size = maskSize(SCENE_WAREHOUSE);
    const { result } = mount();
    act(() => { result.current.paint({ x: SCENE_WAREHOUSE.width, y: SCENE_WAREHOUSE.height }, { x: SCENE_WAREHOUSE.width, y: SCENE_WAREHOUSE.height }, 27, stroke()); });
    expect(ctx.arcs.at(-1)!.x).toBeCloseTo(size.width, 5);
    expect(ctx.arcs.at(-1)!.y).toBeCloseTo(size.height, 5);
  });

  it('un arrastre largo se rellena para no salir a lunares', () => {
    const { result } = mount();
    act(() => { result.current.paint({ x: 0, y: 0 }, { x: 400, y: 0 }, 27, stroke()); });
    expect(ctx.arcs.length).toBeGreaterThan(10);
  });

  /** Un guardado por pincelada, no cien: subir el PNG en cada `pointermove` sería insostenible. */
  it('pintar NO sube nada; sólo lo hace el soltar', async () => {
    const { result, d } = mount();
    act(() => { result.current.paint({ x: 10, y: 10 }, { x: 40, y: 40 }, 27, stroke()); });
    expect(d!.save).not.toHaveBeenCalled();
    await act(async () => { await result.current.flush(); });
    expect(d!.save).toHaveBeenCalledWith(BLOB);
  });

  it('soltar sin haber pintado no gasta una subida', async () => {
    const { result, d } = mount();
    await act(async () => { await result.current.flush(); });
    expect(d!.save).not.toHaveBeenCalled();
  });

  it('la vista previa se actualiza al pintar, sin esperar a que suba', async () => {
    const { result } = mount();
    act(() => { result.current.paint({ x: 10, y: 10 }, { x: 40, y: 40 }, 27, stroke()); });
    await waitFor(() => expect(result.current.preview).toBe('data:image/png;base64,PINTADO'));
  });

  it('restaurar lo deja entero y borra la máscara guardada', async () => {
    const { result, d } = mount();
    await act(async () => { await result.current.reset(); });
    expect(result.current.preview).toBeNull();
    expect(d!.clear).toHaveBeenCalled();
    expect(ctx.calls).toContain('clearRect');
  });

  it('sin destino el pincel no hace nada, en vez de reventar', () => {
    const { result } = mount(null);
    act(() => { result.current.paint({ x: 1, y: 1 }, { x: 2, y: 2 }, 27, stroke()); });
    expect(ctx?.arcs ?? []).toHaveLength(0);
  });

  it('sin escena activa tampoco: el director aún no ha activado ninguna', () => {
    const { result } = mount(targetOf(), null as never);
    act(() => { result.current.paint({ x: 1, y: 1 }, { x: 2, y: 2 }, 27, stroke()); });
    expect(result.current.preview).toBe('https://x/backgrounds/c1/masks/ly-moss.png?v=3');
  });

  // ── EL BORDE ROTO (rebanada 9) ──────────────────────────────────────────
  /**
   * `rough` deja de ser un círculo: se rellena un POLÍGONO. Es la diferencia con la dureza, que difumina
   * hacia fuera pero siempre en círculo — por eso son dos mandos y no uno.
   */
  it('el borde roto rellena un contorno, no un círculo', () => {
    const { result } = mount();
    act(() => { result.current.paint({ x: 100, y: 100 }, { x: 100, y: 100 }, 27, stroke({ tip: 'rough', roughness: 0.8 }), true); });
    expect(ctx.arcs).toHaveLength(0);
    expect(ctx.lines.length).toBeGreaterThan(10);
  });

  /** Y el degradado sigue siendo el mismo: un brochazo puede ser de canto duro Y roto a la vez. */
  it('roto y duro conviven: el borde roto no toca el degradado', () => {
    const { result } = mount();
    act(() => { result.current.paint({ x: 100, y: 100 }, { x: 100, y: 100 }, 27, stroke({ tip: 'rough', roughness: 0.8, strength: 0.5, hardness: 1 }), true); });
    expect(ctx.stops[0]).toEqual([0, 'rgba(0,0,0,0.5)']);
    expect(ctx.stops[1]![0]).toBeGreaterThan(0.9);
  });

  /**
   * UNA PINCELADA, UNA FORMA. Sortearla en cada punto intermedio —y un arrastre son decenas— dejaría el
   * trazo de ruido en vez de desgarrado. «Distinto cada vez» es por brochazo, no por punto.
   */
  it('la forma del borde roto se sortea una vez por pincelada y dura todo el arrastre', () => {
    const { result } = mount();
    act(() => { result.current.paint({ x: 0, y: 0 }, { x: 0, y: 0 }, 27, stroke({ tip: 'rough', roughness: 0.9 }), true); });
    const primera = ctx.lines.slice(0, 28).map(pt => Math.round((pt.x - ctx.lines[0]!.x) * 1000));
    ctx.lines.length = 0;
    act(() => { result.current.paint({ x: 0, y: 0 }, { x: 0, y: 0 }, 27, stroke({ tip: 'rough', roughness: 0.9 })); });
    const sigue = ctx.lines.slice(0, 28).map(pt => Math.round((pt.x - ctx.lines[0]!.x) * 1000));
    expect(sigue).toEqual(primera);
  });

  it('la pincelada siguiente sale con OTRA forma — «distinto cada vez»', async () => {
    const { result } = mount();
    act(() => { result.current.paint({ x: 0, y: 0 }, { x: 0, y: 0 }, 27, stroke({ tip: 'rough', roughness: 0.9 }), true); });
    const primera = ctx.lines.slice(0, 28).map(pt => pt.x);
    await act(async () => { await result.current.flush(); });
    ctx.lines.length = 0;
    act(() => { result.current.paint({ x: 0, y: 0 }, { x: 0, y: 0 }, 27, stroke({ tip: 'rough', roughness: 0.9 }), true); });
    expect(ctx.lines.slice(0, 28).map(pt => pt.x)).not.toEqual(primera);
  });

  /** El disco corta a canto limpio pase lo que pase con la dureza: es lo que se pide al elegir un disco. */
  it('el disco no se difumina aunque el borde esté a cero', () => {
    const { result } = mount();
    act(() => { result.current.paint({ x: 100, y: 100 }, { x: 100, y: 100 }, 27, stroke({ tip: 'disc', strength: 0.7, hardness: 0 })); });
    expect(ctx.stops).toEqual([[0, 'rgba(0,0,0,0.7)'], [1, 'rgba(0,0,0,0.7)']]);
  });

  // ── EL RECORTE DE LA SALA (§ 9.3) ───────────────────────────────────────
  /**
   * «*Si voy a pintar una sala no tiene que manchar una pared*». No se arregla eligiendo capa: el brochazo se
   * RECORTA contra el contorno de la sala, y por eso se puede pasar el pincel por encima del muro sin miedo.
   */
  it('con recorte, el brochazo se encierra en el contorno antes de pintar', () => {
    const { result } = mount(targetOf({ id: 'rm-1', src: null, clip: 'M0 0 L100 0 L100 100 L0 100 Z' }));
    act(() => { result.current.paint({ x: 10, y: 10 }, { x: 10, y: 10 }, 27, stroke()); });
    expect(ctx.clips).toBe(1);
    /*
     * 🔑 Y EN ESTE ORDEN EXACTO, que es de lo que depende que el recorte caiga donde debe. El contorno viene
     * en px de ESCENA y la máscara se guarda reducida, así que se recorta CON la escala puesta; el lienzo
     * congela el recorte en el sitio donde estaba al pedirlo, y por eso volver a la identidad después no lo
     * mueve — pero pintar sí tiene que ir sin escala, porque los brochazos ya llegan en px de máscara.
     * Recortar antes de escalar dejaría el agujero a otro tamaño que la sala.
     */
    const orden = ctx.calls.filter(c => ['save', 'scale', 'clip', 'setTransform', 'fill', 'restore'].includes(c));
    expect(orden.slice(0, 4)).toEqual(['save', 'scale', 'clip', 'setTransform']);
    // Y el recorte va DENTRO del save/restore: no se queda puesto para el siguiente brochazo.
    expect(orden.indexOf('fill')).toBeGreaterThan(orden.indexOf('setTransform'));
    expect(orden.at(-1)).toBe('restore');
  });

  it('sin recorte no se encierra nada: una capa se pinta de borde a borde del mapa', () => {
    const { result } = mount();
    act(() => { result.current.paint({ x: 10, y: 10 }, { x: 10, y: 10 }, 27, stroke()); });
    expect(ctx.clips).toBe(0);
  });
});

/**
 * ── 🐞 REHACER EL HOOK NO PUEDE PERDER LO PINTADO ──
 *
 * Desde la rebanada 9 el pincel se guarda EN LA ESCENA («*el trazo es de la escena*»), así que soltar
 * cualquier deslizador de la barra reescribe la fila de la escena y le llega aquí una escena NUEVA. El lienzo
 * de fuera de pantalla sólo depende de su TAMAÑO, y ése no ha cambiado: rehacerlo por eso borraba lo pintado
 * y volvía a descargar el PNG guardado — un parpadeo en cada roce del deslizador y, si le daba tiempo a
 * pintar antes de que llegara la imagen, la máscara vieja caía encima de lo nuevo.
 */
describe('useMaskPainter — la escena cambia, el lienzo no se rehace', () => {
  it('guardar el pincel en la escena no borra lo pintado', async () => {
    const tg = targetOf();
    const { result, rerender } = renderHook(({ sc }: { sc: typeof SCENE_WAREHOUSE }) => useMaskPainter(sc, tg),
      { initialProps: { sc: SCENE_WAREHOUSE } });
    act(() => { result.current.paint({ x: 10, y: 10 }, { x: 10, y: 10 }, 27, stroke(), true); });
    await waitFor(() => expect(result.current.preview).toBe('data:image/png;base64,PINTADO'));
    // Lo que hace `patchScene` al soltar el deslizador: la misma escena, otro objeto.
    rerender({ sc: { ...SCENE_WAREHOUSE } });
    expect(result.current.preview).toBe('data:image/png;base64,PINTADO');
    // Y lo pintado sigue estando pendiente de subir: si el lienzo se hubiera rehecho, esto no subiría nada.
    await act(async () => { await result.current.flush(); });
    expect(tg.save).toHaveBeenCalled();
  });

  /** Cambiar de mapa SÍ rehace el lienzo: otro tamaño es otra máscara. */
  it('otra escena de otro tamaño sí rehace el lienzo', async () => {
    const tg = targetOf({ src: null });
    const { result, rerender } = renderHook(({ sc }: { sc: typeof SCENE_WAREHOUSE }) => useMaskPainter(sc, tg),
      { initialProps: { sc: SCENE_WAREHOUSE } });
    act(() => { result.current.paint({ x: 10, y: 10 }, { x: 10, y: 10 }, 27, stroke(), true); });
    await waitFor(() => expect(result.current.preview).toBe('data:image/png;base64,PINTADO'));
    rerender({ sc: { ...SCENE_WAREHOUSE, width: SCENE_WAREHOUSE.width + 320 } });
    expect(result.current.preview).toBeNull();
  });
});
