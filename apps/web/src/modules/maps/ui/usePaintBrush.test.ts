import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { SCENE_WAREHOUSE } from '../../../../tests/helpers/fakes';
import { DEFAULT_MASK_HARDNESS } from '../domain/useCases/layerRules';
import { usePaintBrush, type PaintInk, type PaintStroke, type PaintTarget } from './usePaintBrush';

/**
 * jsdom no trae lienzo de verdad (`getContext` devuelve null), así que se le pone uno de mentira que apunta
 * lo que se le pide. Es exactamente lo que hay que probar aquí: CON QUÉ se pinta, DÓNDE se recorta y CUÁNDO
 * se sube — el dibujo en sí es del navegador.
 */
interface FakeCtx {
  calls: string[]; ops: string[]; stops: [number, string][]; arcs: { x: number; y: number; r: number }[];
  lines: { x: number; y: number }[]; clips: number; fills: unknown[]; alphas: number[];
}
let ctxs: FakeCtx[];

function fakeContext(): Record<string, unknown> {
  const c: FakeCtx = { calls: [], ops: [], stops: [], arcs: [], lines: [], clips: 0, fills: [], alphas: [] };
  const api = {
    save: () => c.calls.push('save'),
    restore: () => c.calls.push('restore'),
    clearRect: () => c.calls.push('clearRect'),
    drawImage: () => c.calls.push('drawImage'),
    beginPath: () => {},
    fill: () => c.calls.push('fill'),
    fillRect: () => c.calls.push('fillRect'),
    arc: (x: number, y: number, r: number) => c.arcs.push({ x, y, r }),
    scale: () => c.calls.push('scale'),
    setTransform: () => c.calls.push('setTransform'),
    clip: () => { c.clips += 1; c.calls.push('clip'); },
    moveTo: (x: number, y: number) => c.lines.push({ x, y }),
    lineTo: (x: number, y: number) => c.lines.push({ x, y }),
    closePath: () => c.calls.push('closePath'),
    createRadialGradient: () => ({ addColorStop: (o: number, col: string) => c.stops.push([o, col]) }),
    createPattern: () => null,
    set globalCompositeOperation(v: string) { c.ops.push(v); },
    get globalCompositeOperation() { return c.ops.at(-1) ?? ''; },
    set globalAlpha(v: number) { c.alphas.push(v); },
    get globalAlpha() { return c.alphas.at(-1) ?? 1; },
    set fillStyle(v: unknown) { c.fills.push(v); },
    get fillStyle() { return c.fills.at(-1); },
  };
  ctxs.push(c);
  return api;
}
/**
 * Cada `getContext` devuelve un espía nuevo, así que se mira LO QUE SE PIDIÓ EN TOTAL. Da igual en cuál de
 * los dos lienzos —el de la pintura o el de estampar la textura— cayó cada orden: lo que se prueba es qué se
 * mandó dibujar.
 */
const todo = (): FakeCtx => ctxs.reduce<FakeCtx>((a, c) => ({
  calls: [...a.calls, ...c.calls], ops: [...a.ops, ...c.ops], stops: [...a.stops, ...c.stops],
  arcs: [...a.arcs, ...c.arcs], lines: [...a.lines, ...c.lines], clips: a.clips + c.clips,
  fills: [...a.fills, ...c.fills], alphas: [...a.alphas, ...c.alphas],
}), { calls: [], ops: [], stops: [], arcs: [], lines: [], clips: 0, fills: [], alphas: [] });

const BLOB = new Blob(['png'], { type: 'image/png' });

beforeEach(() => {
  ctxs = [];
  vi.stubGlobal('Path2D', class { constructor(public d?: string) {} });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fakeContext() as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,PINTADO');
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(cb => { cb(BLOB); });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const targetOf = (over: Partial<PaintTarget> = {}): PaintTarget & { save: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn> } => ({
  id: 'rm-1', src: null, clip: null,
  save: vi.fn().mockResolvedValue(undefined), clear: vi.fn().mockResolvedValue(undefined),
  ...over,
} as PaintTarget & { save: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn> });
const mount = (target: ReturnType<typeof targetOf> | null = targetOf(), scene = SCENE_WAREHOUSE) =>
  ({ d: target!, ...renderHook(() => usePaintBrush(scene, target)) });

/** Pintando con el musgo de la paleta, a canto difuminado. Cada test cambia sólo lo suyo. */
const ink = (over: Partial<PaintInk> = {}): PaintInk => ({ textureUrl: null, tilePx: 54, color: '#5f8f6a', ...over });
const stroke = (over: Partial<PaintStroke> = {}): PaintStroke =>
  ({ strength: 1, hardness: DEFAULT_MASK_HARDNESS, tip: 'soft', roughness: 0, mode: 'paint', ...over });

/**
 * 🖌 EL PINCEL QUE PINTA ENCIMA (§ «Rebanada 10 · A»).
 *
 * Es el hermano de `useMaskPainter` con el signo cambiado: aquél pinta NEGRO para QUITAR y que asome lo de
 * abajo, éste pinta COLOR o TEXTURA para PONER encima. Lo que sujetan estos tests es justamente ese signo.
 */
describe('usePaintBrush', () => {
  it('arranca con la pintura YA GUARDADA del destino, no en blanco', async () => {
    const { result } = mount(targetOf({ src: 'https://x/paint/room-rm-1.png?v=1' }));
    // Si empezase vacío, la primera pincelada borraría todo lo pintado en sesiones anteriores.
    expect(result.current.preview).toBe('https://x/paint/room-rm-1.png?v=1');
  });

  it('sin pintura guardada no hay nada que dibujar encima', () => {
    const { result } = mount();
    expect(result.current.preview).toBeNull();
  });

  /** 🔑 PINTAR PONE, y con el color puesto: la silueta del trazo se tiñe con él, no con negro. */
  it('pinta con el color puesto, y ENCIMA de lo que hubiera', () => {
    const { result } = mount();
    act(() => result.current.paint({ x: 100, y: 100 }, { x: 140, y: 100 }, 30, ink(), stroke(), true));
    expect(todo().arcs.length).toBeGreaterThan(0);
    // El rastro se tiñe con `source-in`, y el color que se cuela por él es el elegido.
    expect(todo().ops).toContain('source-in');
    expect(todo().fills).toContain('#5f8f6a');
    // Y no se borra nada: eso es lo contrario de pintar.
    expect(todo().ops).not.toContain('destination-out');
  });

  /**
   * 🐞 LA TRANSPARENCIA SE APLICA UNA VEZ, A LA PINCELADA ENTERA. Su queja del 2026-09-10: «*la barra de
   * transparencia casi que es on/off, no hay una progresión*». No era la barra: una pincelada son decenas de
   * gotas solapadas, y aplicándosela a cada gota se sumaban entre ellas hasta saturar al tercer roce.
   *
   * Lo que sujeta este test: las gotas se estampan A PLENA OPACIDAD en el rastro, y la transparencia entra
   * después, una sola vez, al pegar ese rastro sobre lo que había.
   */
  it('aplica la transparencia UNA VEZ por pincelada, no gota a gota', () => {
    const { result } = mount();
    act(() => result.current.paint({ x: 100, y: 100 }, { x: 300, y: 100 }, 30, ink(), stroke({ strength: 0.2 }), true));
    // El rastro va opaco: ninguna parada del degradado lleva la transparencia metida dentro.
    expect(todo().stops.every(([, c]) => !c.includes('0.2'))).toBe(true);
    // …y el 0,2 aparece UNA sola vez, componiendo la pincelada entera.
    expect(todo().alphas.filter(a => a === 0.2)).toHaveLength(1);
  });

  /**
   * 🔑 BORRAR QUITA LA PINTURA y deja ver lo que había debajo — **no derriba nada**: se compone
   * `destination-out` sobre el lienzo de la pintura, y lo de debajo nunca se ha tocado (§ 10A.6).
   */
  it('borrar quita del propio lienzo de pintura', () => {
    const { result } = mount();
    act(() => result.current.paint({ x: 100, y: 100 }, { x: 140, y: 100 }, 30, ink(), stroke({ mode: 'erase' }), true));
    expect(todo().ops).toContain('destination-out');
    // Borrando no se tiñe nada: no se pinta con un color, se quita.
    expect(todo().fills).not.toContain('#5f8f6a');
  });

  /**
   * 🔑 EL RECORTE SALE DEL DESTINO: pintando una habitación el brochazo se recorta contra su contorno, así
   * que pasar el pincel por encima del muro no lo mancha. Es «*si se me va la mano al muro, el muro no se
   * tiene que pintar*» sin ninguna comprobación que alguien pueda olvidarse de escribir.
   */
  it('recorta contra el contorno cuando el destino lo trae', () => {
    const { result } = mount(targetOf({ clip: 'M0 0 L100 0 L100 100 Z' }));
    act(() => result.current.paint({ x: 10, y: 10 }, { x: 20, y: 20 }, 20, ink(), stroke(), true));
    expect(todo().clips).toBe(1);
  });

  /** La ROCA no recorta aquí: se lo pone el mapa al dibujarla, con la misma máscara que ya la talla. */
  it('sin contorno no recorta', () => {
    const { result } = mount();
    act(() => result.current.paint({ x: 10, y: 10 }, { x: 20, y: 20 }, 20, ink(), stroke(), true));
    expect(todo().clips).toBe(0);
  });

  /** `disc` corta a canto limpio pase lo que pase con el borde: las dos paradas van a la misma opacidad. */
  it('el disco corta a canto limpio', () => {
    const { result } = mount();
    act(() => result.current.paint({ x: 50, y: 50 }, { x: 50, y: 50 }, 20, ink(), stroke({ tip: 'disc' }), true));
    const [primera, ultima] = [todo().stops[0]!, todo().stops[1]!];
    expect(primera[1]).toBe(ultima[1]);
  });

  /** El borde ROTO cambia el CONTORNO, no el degradado: se rellena un polígono en vez de un círculo. */
  it('el borde roto dibuja un contorno mellado en vez de un círculo', () => {
    const { result } = mount();
    act(() => result.current.paint({ x: 50, y: 50 }, { x: 50, y: 50 }, 20, ink(), stroke({ tip: 'rough', roughness: 0.8 }), true));
    expect(todo().lines.length).toBeGreaterThan(3);
    expect(todo().arcs).toHaveLength(0);
  });

  /** Un guardado POR PINCELADA, no cien: mientras se arrastra no sube nada. */
  it('sube el PNG sólo al soltar, y a donde diga el destino', async () => {
    const { result, d } = mount();
    act(() => result.current.paint({ x: 100, y: 100 }, { x: 140, y: 100 }, 30, ink(), stroke(), true));
    expect(d.save).not.toHaveBeenCalled();
    await act(async () => { await result.current.flush(); });
    expect(d.save).toHaveBeenCalledWith(BLOB);
  });

  /**
   * ↩️ CADA PINCELADA DEVUELVE SU VUELTA ATRÁS (2026-09-10: «*el Ctrl+Z sigue dando por culo, depende con qué
   * te deja deshacer o no*»). El hook es el único que tiene las dos fotos del lienzo, así que la construye él
   * y quien llama sólo la apila.
   */
  it('al soltar devuelve la vuelta atrás de esa pincelada', async () => {
    const { result, d } = mount();
    act(() => result.current.paint({ x: 100, y: 100 }, { x: 140, y: 100 }, 30, ink(), stroke(), true));
    let paso: { undo: () => Promise<void>; redo: () => Promise<void> } | null = null;
    await act(async () => { paso = await result.current.flush(); });
    expect(paso).not.toBeNull();
    d.save.mockClear();
    // Deshacer vuelve a subir la foto de ANTES; rehacer, la de después. Invertir un lienzo de píxeles es eso.
    await act(async () => { await paso!.undo(); });
    expect(d.save).toHaveBeenCalledTimes(1);
    await act(async () => { await paso!.redo(); });
    expect(d.save).toHaveBeenCalledTimes(2);
  });

  /** Soltar sin haber pintado no deja paso que deshacer: no ha pasado nada. */
  it('soltar sin pintar no devuelve paso', async () => {
    const { result } = mount();
    let paso: unknown = 'x';
    await act(async () => { paso = await result.current.flush(); });
    expect(paso).toBeNull();
  });

  /** Sin haber pintado nada no se sube nada: soltar el ratón en el vacío no escribe en la base. */
  it('soltar sin haber pintado no sube nada', async () => {
    const { result, d } = mount();
    await act(async () => { await result.current.flush(); });
    expect(d.save).not.toHaveBeenCalled();
  });

  /** «Quitar del todo» limpia el lienzo y avisa al destino. Lo de debajo sigue intacto: nunca se tocó. */
  it('quitar del todo limpia el lienzo y avisa al destino', async () => {
    const { result, d } = mount(targetOf({ src: 'https://x/p.png' }));
    await act(async () => { await result.current.reset(); });
    expect(d.clear).toHaveBeenCalled();
    await waitFor(() => expect(result.current.preview).toBeNull());
  });

  /** Sin escena no hay dónde pintar: el director todavía no ha activado ninguna, y el hook no revienta. */
  it('sin escena no pinta ni revienta', () => {
    const { result } = renderHook(() => usePaintBrush(null, targetOf()));
    act(() => result.current.paint({ x: 1, y: 1 }, { x: 2, y: 2 }, 10, ink(), stroke(), true));
    expect(result.current.preview).toBeNull();
  });

  /** Sin destino tampoco: se ha quitado el ratón de encima de la habitación y no hay dónde caer. */
  it('sin destino no pinta', () => {
    const { result } = mount(null);
    act(() => result.current.paint({ x: 1, y: 1 }, { x: 2, y: 2 }, 10, ink(), stroke(), true));
    expect(ctxs.every(c => c.arcs.length === 0)).toBe(true);
  });
});

/**
 * ── LA TEXTURA DEL PINCEL SE GIRA (suyo, 2026-09-10: «*además de escalarse, que se pueda girar*») ──
 * `tileMatrix` ya se prueba sola en `roomStyles.test.ts`. Lo que se sujeta aquí es que el giro de la tinta
 * LLEGUE al patrón con el que se tiñe la pincelada: sin eso el panel y el previo girarían, y lo pintado
 * caería derecho — que es justo lo que no se ve hasta soltar el brochazo.
 */
describe('usePaintBrush — el giro de la textura', () => {
  /** jsdom no trae `DOMMatrix` ni fotos que carguen: se ponen de mentira y se mira qué matriz llega. */
  type Matriz = [number, number, number, number, number, number];
  class FakeMatrix { constructor(public init: Matriz) {} }
  /** Una foto APAISADA a propósito: con una cuadrada no se notaría si se escala antes o después de girar. */
  class FakeImage { complete = true; naturalWidth = 120; naturalHeight = 60; crossOrigin = ''; src = ''; onload: (() => void) | null = null; }

  const pintaCon = (tinta: PaintInk): Matriz => {
    const setTransform = vi.fn();
    vi.stubGlobal('DOMMatrix', FakeMatrix);
    vi.stubGlobal('Image', FakeImage);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      const api = fakeContext();
      api.createPattern = () => ({ setTransform });
      return api as unknown as CanvasRenderingContext2D;
    });
    const { result } = mount();
    // La primera pasada pide la foto (todavía no ha llegado: sale con el color); la segunda ya tiñe con ella.
    act(() => result.current.paint({ x: 100, y: 100 }, { x: 140, y: 100 }, 30, tinta, stroke(), true));
    act(() => result.current.paint({ x: 140, y: 100 }, { x: 180, y: 100 }, 30, tinta, stroke()));
    expect(setTransform).toHaveBeenCalled();
    return (setTransform.mock.calls.at(-1)![0] as FakeMatrix).init;
  };
  const losa = 'https://x/losa.png';

  it('sin giro el patrón sólo se escala: va derecho', () => {
    const [a, b, c, d] = pintaCon(ink({ textureUrl: losa }));
    expect(a).toBeGreaterThan(0); expect(d).toBeGreaterThan(0);
    expect(b).toBeCloseTo(0, 9); expect(c).toBeCloseTo(0, 9);
  });

  it('con giro el patrón gira, y girar no cambia el tamaño del azulejo', () => {
    const [a0, , , d0] = pintaCon(ink({ textureUrl: losa }));
    const [a, b, c, d] = pintaCon(ink({ textureUrl: losa, tileDeg: 90 }));
    // Un cuarto de vuelta cruza los ejes y conserva la escala de cada uno: primero escala, luego gira.
    expect(a).toBeCloseTo(0, 9); expect(d).toBeCloseTo(0, 9);
    expect(b).toBeCloseTo(a0, 9); expect(c).toBeCloseTo(-d0, 9);
  });
});
