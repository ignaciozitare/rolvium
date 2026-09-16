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
  it('las texturas tienen sus propias listas de favoritas y recientes, aparte de las de piezas', () => {
    const m = new LocalViewMemory();
    expect(m.favoriteTextures()).toEqual([]);
    expect(m.toggleFavoriteTexture('tx-a')).toEqual(['tx-a']);
    expect(m.toggleFavoriteProp('pr-a')).toEqual(['pr-a']);
    expect(m.favoriteTextures()).toEqual(['tx-a']);          // la de piezas no se mezcla
    expect(m.toggleFavoriteTexture('tx-a')).toEqual([]);
    expect(m.rememberRecentTexture('tx-a')).toEqual(['tx-a']);
    expect(m.rememberRecentTexture('tx-b')).toEqual(['tx-b', 'tx-a']);
    expect(m.recentTextures()).toEqual(['tx-b', 'tx-a']);
    expect(m.recentProps()).toEqual([]);
  });

  /**
   * 📏 La escala por CATEGORÍA (2026-09-16): «*si pongo un árbol y luego elijo otro árbol tiene que mantener la
   * misma escala del anterior, lo mismo con cada categoría de objeto*».
   */
  describe('la escala que recuerda cada categoría', () => {
    it('empieza sin nada, guarda por categoría y cada una va por su lado', () => {
      const m = new LocalViewMemory();
      expect(m.propScale('vegetation')).toBe(null);
      m.rememberPropScale('vegetation', 2.5);
      expect(m.propScale('vegetation')).toBe(2.5);
      expect(m.propScale('furniture')).toBe(null);   // lo del bosque no le cambia el tamaño a las mesas
      m.rememberPropScale('furniture', 0.8);
      expect(m.propScale('vegetation')).toBe(2.5);
      expect(m.propScale('furniture')).toBe(0.8);
      m.rememberPropScale('vegetation', 4);          // la última manda
      expect(m.propScale('vegetation')).toBe(4);
    });

    it('sobrevive a una recarga: lo lee una instancia nueva', () => {
      new LocalViewMemory().rememberPropScale('doors', 1.25);
      expect(new LocalViewMemory().propScale('doors')).toBe(1.25);
    });

    it('una escala imposible no se guarda, y una guardada a mano no se lee', () => {
      const m = new LocalViewMemory();
      m.rememberPropScale('vegetation', 0);                 // por debajo del mínimo
      m.rememberPropScale('markers', 9999);                 // por encima del máximo
      m.rememberPropScale('floors', Number.NaN);
      expect([m.propScale('vegetation'), m.propScale('markers'), m.propScale('floors')]).toEqual([null, null, null]);
      // y lo que ya estuviera guardado a mano con basura se ignora al leer, sin tirar lo que sí vale
      localStorage.setItem('rolvium_maps_prop_scales', '{"vegetation":"grande","misc":2}');
      expect(m.propScale('vegetation')).toBe(null);
      expect(m.propScale('misc')).toBe(2);
      localStorage.setItem('rolvium_maps_prop_scales', 'no soy json');
      expect(m.propScale('misc')).toBe(null);
    });
  });

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
    expect(m.propScale('vegetation')).toBe(null);
    expect(() => m.rememberPropScale('vegetation', 2)).not.toThrow();
  });
});
