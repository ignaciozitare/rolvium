import { describe, it, expect } from 'vitest';
import { isStaleRow, keepUnsent } from './liveRules';

const T1 = '2026-09-15T22:00:00.000Z';
const T2 = '2026-09-15T22:00:05.000Z';

describe('isStaleRow — el eco que llega tarde', () => {
  it('una fila con fecha ANTERIOR a la que ya hay es vieja: no se aplica', () => {
    expect(isStaleRow({ updatedAt: T2 }, { updatedAt: T1 })).toBe(true);
  });

  it('la misma fecha, o una posterior, se aplica', () => {
    expect(isStaleRow({ updatedAt: T1 }, { updatedAt: T1 })).toBe(false);
    expect(isStaleRow({ updatedAt: T1 }, { updatedAt: T2 })).toBe(false);
  });

  it('en una CAPA manda su número de versión, que es más fino que el reloj', () => {
    // El caso de verdad: dos guardados de pintura seguidos comparten segundo pero no versión.
    expect(isStaleRow({ updatedAt: T1, paintVersion: 7 }, { updatedAt: T1, paintVersion: 6 })).toBe(true);
    expect(isStaleRow({ updatedAt: T1, paintVersion: 6 }, { updatedAt: T1, paintVersion: 7 })).toBe(false);
    expect(isStaleRow({ maskVersion: 3 }, { maskVersion: 2 })).toBe(true);
  });

  it('ante la duda se aplica: perder un cambio bueno es peor que repetir uno', () => {
    expect(isStaleRow({}, {})).toBe(false);
    expect(isStaleRow({ updatedAt: T2 }, {})).toBe(false);
    expect(isStaleRow(null, undefined)).toBe(false);
    expect(isStaleRow({ updatedAt: 'ayer por la tarde' }, { updatedAt: T1 })).toBe(false);
  });

  it('una versión que sube con fecha que baja sigue siendo nueva: la versión manda', () => {
    expect(isStaleRow({ updatedAt: T2, paintVersion: 1 }, { updatedAt: T1, paintVersion: 2 })).toBe(false);
  });
});

describe('keepUnsent — lo que el eco no trae, no lo borra', () => {
  /* El caso de verdad: Postgres no repite en el aviso un valor grande que el UPDATE no ha tocado, así que el
     contorno de una sala a mano alzada llega AUSENTE y el mapeo lo vuelve `[]`. Ver la cabecera de la regla. */
  it('una lista que llega VACÍA no pisa a la que ya teníamos', () => {
    const antes = { id: 'rm-1', points: [[0, 0], [9, 9]], floorPaintUrl: 'v1' };
    const ahora = { id: 'rm-1', points: [] as number[][], floorPaintUrl: 'v2' };
    expect(keepUnsent(antes, ahora)).toEqual({ id: 'rm-1', points: [[0, 0], [9, 9]], floorPaintUrl: 'v2' });
  });

  it('una lista CON contenido manda, como siempre', () => {
    const antes = { points: [[0, 0]] };
    expect(keepUnsent(antes, { points: [[5, 5]] }).points).toEqual([[5, 5]]);
  });

  it('si la que había también estaba vacía, se queda vacía: no se inventa nada', () => {
    expect(keepUnsent({ points: [] }, { points: [] }).points).toEqual([]);
  });

  it('lo que no es una lista no se toca: un `null` o un texto nuevo se aplican', () => {
    const antes: { floorPaintUrl: string | null; floorMaskUrl: string | null } = { floorPaintUrl: 'v1', floorMaskUrl: 'm1' };
    expect(keepUnsent(antes, { floorPaintUrl: null, floorMaskUrl: 'm2' }))
      .toEqual({ floorPaintUrl: null, floorMaskUrl: 'm2' });
  });

  it('sin nada que conservar devuelve la MISMA fila, para no repintar el mapa de balde', () => {
    const ahora = { points: [[1, 1]] };
    expect(keepUnsent({ points: [[0, 0]] }, ahora)).toBe(ahora);
  });

  it('ante la duda no estorba: sin fila previa, o con cosas que no son filas, se aplica lo que viene', () => {
    const ahora = { points: [] as number[][] };
    expect(keepUnsent(null, ahora)).toBe(ahora);
    expect(keepUnsent({ points: [[0, 0]] }, null)).toBeNull();
  });
});

describe('keepUnsent — una columna que NO VIENE tampoco borra', () => {
  /* Medido el 2026-09-17 contra su base local: un trazo a pulso de 400 puntos pierde `data` en el eco de
     tiempo real; uno de 200 llega entero. Y `mapDrawingRow` pasa `data` sin red, así que sale `undefined`. */
  it('un eco sin `data` conserva el dibujo que ya teníamos, y aplica lo que sí trae', () => {
    const antes = { id: 'dw-1', data: { points: [[0, 0], [9, 9]] }, layerId: 'ly-1' };
    const eco = { id: 'dw-1', layerId: 'ly-2' } as typeof antes;
    expect(keepUnsent(antes, eco)).toEqual({ id: 'dw-1', data: { points: [[0, 0], [9, 9]] }, layerId: 'ly-2' });
  });

  it('un eco sin `silhouette` no devuelve la pieza al cuadrado', () => {
    const antes = { id: 'sp-1', silhouette: [{ x: 0, y: 0 }], blockShape: 'silhouette' };
    const eco = { id: 'sp-1', blockShape: 'silhouette' } as typeof antes;
    expect(keepUnsent(antes, eco).silhouette).toEqual([{ x: 0, y: 0 }]);
  });

  it('pero un `null` de verdad SÍ manda: quitar la silueta tiene que funcionar', () => {
    // `null` llega por la red como valor; `undefined` es sólo «no vino». Confundirlos dejaría siluetas zombis.
    const antes = { silhouette: [{ x: 0, y: 0 }] as unknown };
    expect(keepUnsent(antes, { silhouette: null }).silhouette).toBeNull();
  });

  it('si antes tampoco lo teníamos, no se inventa la clave', () => {
    expect(keepUnsent({ id: 'dw-1' }, { id: 'dw-1' })).toEqual({ id: 'dw-1' });
  });
});
