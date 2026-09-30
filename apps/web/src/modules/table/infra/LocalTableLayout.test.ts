import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { localTableLayout } from './LocalTableLayout';
import { SIDE_WIDTH_MAX, SIDE_WIDTH_MIN } from '../domain/useCases/layoutRules';

const KEY = 'rolvium_table_side_width';

/** Aquí jsdom corre con origen opaco y no trae `localStorage`: se le pone uno de memoria, como en `LocalViewMemory`. */
const mem = new Map<string, string>();
const store = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, v); },
  removeItem: (k: string) => { mem.delete(k); },
  clear: () => mem.clear(),
};

/**
 * El ancho del carril vive EN EL NAVEGADOR: es una preferencia de su pantalla, no un dato de la partida.
 * Lo que se fija aquí es sobre todo que **nada de lo que haya guardado ahí pueda tumbar la mesa**.
 */
describe('localTableLayout', () => {
  beforeEach(() => { mem.clear(); vi.stubGlobal('localStorage', store); });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('sin nada guardado no inventa un ancho: manda el de serie', () => {
    expect(localTableLayout.sideWidth()).toBeNull();
  });

  it('lo guardado vuelve', () => {
    localTableLayout.rememberSideWidth(320);
    expect(localTableLayout.sideWidth()).toBe(320);
  });

  it('🔑 lo guardado también se recorta al leerlo: pudo escribirlo otra versión o una pantalla más grande', () => {
    localStorage.setItem(KEY, '5000');
    expect(localTableLayout.sideWidth()).toBe(SIDE_WIDTH_MAX);
    localStorage.setItem(KEY, '10');
    expect(localTableLayout.sideWidth()).toBe(SIDE_WIDTH_MIN);
  });

  it('una basura guardada a mano vale como «nada», no como NaN', () => {
    localStorage.setItem(KEY, 'ancho');
    expect(localTableLayout.sideWidth()).toBeNull();
  });

  it('y no se guarda fuera de los topes', () => {
    localTableLayout.rememberSideWidth(9999);
    expect(localStorage.getItem(KEY)).toBe(String(SIDE_WIDTH_MAX));
  });

  it('🔑 sin almacenamiento (ventana privada) no se rompe nada, ni leyendo ni escribiendo', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('bloqueado'); },
      setItem: () => { throw new Error('bloqueado'); },
    });
    expect(localTableLayout.sideWidth()).toBeNull();
    expect(() => localTableLayout.rememberSideWidth(300)).not.toThrow();
  });
});
