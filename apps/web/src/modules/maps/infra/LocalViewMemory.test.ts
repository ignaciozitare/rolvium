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

  it('apunta el modo del Builder —una sola elección, sin campaña— y no se cree cualquier cosa guardada', () => {
    const m = new LocalViewMemory();
    expect(m.lastBuilderMode()).toBe(null);
    m.rememberBuilderMode('draw');
    expect(m.lastBuilderMode()).toBe('draw');
    m.rememberBuilderMode('photo');
    expect(m.lastBuilderMode()).toBe('photo');
    // una clave escrita a mano con otra cosa no rompe nada: es como si no hubiera nada
    mem.set('rolvium_maps_builder_mode', 'cueva');
    expect(m.lastBuilderMode()).toBe(null);
  });

  /** ⭐ Favoritos y 🕒 recientes de la galería (rebanada 6): de cada uno, en su navegador, sin campaña. */
  it('marca y desmarca favoritos, y los devuelve en el orden en que se marcaron', () => {
    const m = new LocalViewMemory();
    expect(m.favoriteProps()).toEqual([]);
    expect(m.toggleFavoriteProp('pr-oak')).toEqual(['pr-oak']);
    expect(m.toggleFavoriteProp('pr-col')).toEqual(['pr-oak', 'pr-col']);
    expect(m.toggleFavoriteProp('pr-oak')).toEqual(['pr-col']);
    expect(m.favoriteProps()).toEqual(['pr-col']);
  });

  it('apunta lo último plantado, lo más reciente primero, sin repetidos y con tope', () => {
    const m = new LocalViewMemory();
    m.rememberRecentProp('a'); m.rememberRecentProp('b'); m.rememberRecentProp('a');
    expect(m.recentProps()).toEqual(['a', 'b']);
    for (let i = 0; i < 30; i++) m.rememberRecentProp(`x${i}`);
    expect(m.recentProps()).toHaveLength(18);
    expect(m.recentProps()[0]).toBe('x29');
    // una clave escrita a mano con basura vale como vacía
    mem.set('rolvium_maps_prop_favorites', '{"no":1}');
    expect(m.favoriteProps()).toEqual([]);
    mem.set('rolvium_maps_prop_recents', 'no es json');
    expect(m.recentProps()).toEqual([]);
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
    expect(m.lastBuilderMode()).toBe(null);
    expect(() => m.rememberBuilderMode('draw')).not.toThrow();
    expect(m.favoriteProps()).toEqual([]);
    expect(() => m.toggleFavoriteProp('x')).not.toThrow();
    expect(() => m.rememberRecentProp('x')).not.toThrow();
  });
});
