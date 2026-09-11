import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { LocalViewMemory } from './LocalViewMemory';

/** Aquí jsdom corre con origen opaco y no trae `localStorage`: se le pone uno de memoria, como en `useTheme`. */
const mem = new Map<string, string>();
const store = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, v); },
  removeItem: (k: string) => { mem.delete(k); },
  clear: () => mem.clear(),
};

describe('LocalViewMemory', () => {
  beforeEach(() => { mem.clear(); vi.stubGlobal('localStorage', store); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('apunta la escena que se mira y la devuelve, una clave por campaña', () => {
    const m = new LocalViewMemory();
    expect(m.lastScene('c1')).toBe(null);
    m.rememberScene('c1', 'sc-3');
    m.rememberScene('c2', 'sc-9');
    expect(m.lastScene('c1')).toBe('sc-3');
    expect(m.lastScene('c2')).toBe('sc-9');
    // y la última gana: es dónde tiene el ojo AHORA, no un historial
    m.rememberScene('c1', 'sc-1');
    expect(m.lastScene('c1')).toBe('sc-1');
  });

  /**
   * Con el almacenamiento capado (modo privado, cookies de terceros bloqueadas) `localStorage` LANZA, no
   * devuelve `null`. Sin el `try` la pantalla del mapa no abriría — por eso esto está pineado.
   */
  it('con el almacenamiento capado no revienta: devuelve null y guardar no hace nada', () => {
    const m = new LocalViewMemory();
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    });
    expect(m.lastScene('c1')).toBe(null);
    expect(() => m.rememberScene('c1', 'sc-1')).not.toThrow();
  });
});
