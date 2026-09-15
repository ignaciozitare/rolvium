import { describe, it, expect } from 'vitest';
import { isStaleRow } from './liveRules';

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
