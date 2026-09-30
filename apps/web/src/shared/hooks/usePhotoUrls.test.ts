import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePhotoUrls } from './usePhotoUrls';

/**
 * LOS ENLACES DE LAS FOTOS PUESTAS (H13, rebanada 4). El fichero vive en un bucket privado y la fila no lleva
 * enlace, así que lo que se pinta sale de firmar aparte. Lo que se fija aquí es que se firme **una sola vez** y
 * sólo lo que hace falta —esto corre dentro del lienzo, que se repinta en cada fotograma de un arrastre— y que
 * **sólo se devuelva lo que se puede enseñar AHORA**, que es lo que impide que un enlace ya firmado siga
 * enseñando una foto retirada del área de juego.
 *
 * Quién puede ver qué NO se decide aquí: llega ya decidido en la lista de ids (`photoIdsVisibleTo`).
 */
const firmante = (urls: Record<string, string> = { 'ph-1': 'https://x/ph-1.webp' }) =>
  ({ urlsFor: vi.fn().mockResolvedValue(urls) });
const porId = () => ({ urlsFor: vi.fn(async (_c: string, ids: readonly string[]) => Object.fromEntries(ids.map(id => [id, `https://x/${id}.webp`]))) });

describe('usePhotoUrls', () => {
  it('firma las fotos puestas y devuelve su enlace', async () => {
    const s = firmante();
    const { result } = renderHook(() => usePhotoUrls('c1', ['ph-1'], s));
    await waitFor(() => expect(result.current['ph-1']).toBe('https://x/ph-1.webp'));
    expect(s.urlsFor).toHaveBeenCalledWith('c1', ['ph-1']);
  });

  it('no firma nada cuando no hay ninguna foto que enseñar', () => {
    const s = firmante();
    renderHook(() => usePhotoUrls('c1', [], s));
    expect(s.urlsFor).not.toHaveBeenCalled();
  });

  it('🔑 no vuelve a pedir lo ya firmado aunque la escena se repinte', async () => {
    const s = firmante();
    const { result, rerender } = renderHook(({ ids }) => usePhotoUrls('c1', ids, s), {
      initialProps: { ids: ['ph-1'] as string[] },
    });
    await waitFor(() => expect(result.current['ph-1']).toBeDefined());
    // Lo que se repinte cien veces durante un arrastre no puede ser cien peticiones a la base.
    rerender({ ids: ['ph-1'] });
    rerender({ ids: ['ph-1'] });
    expect(s.urlsFor).toHaveBeenCalledTimes(1);
  });

  /**
   * 🔴 POR QUÉ ESTE EFECTO NO LLEVA LIMPIEZA, y no puede llevarla.
   *
   * Lo natural en un efecto que pide algo es cancelar en la limpieza. Aquí sería un fallo: poner una SEGUNDA
   * foto cambia la lista de ids, relanza el efecto y la cancelación mataría la firma de la PRIMERA, que venía
   * en camino. Y como su id ya consta como «pedido», nadie volvería a pedirla: esa foto no se pintaría jamás.
   * Lo que impide que una firma tardía aterrice fuera de sitio es `vivo`, que sólo mira el desmontaje.
   *
   * Esta prueba existe para que añadir esa limpieza «de libro» sea imposible sin que algo se ponga rojo.
   * (Medido el 2026-09-28: con la limpieza puesta, esta prueba —y sólo ésta— se pone roja.)
   */
  it('🔴 poner una segunda foto NO mata la firma de la primera', async () => {
    const pendientes: (() => void)[] = [];
    const s = { urlsFor: vi.fn((_c: string, ids: readonly string[]) => new Promise<Record<string, string>>(res => {
      pendientes.push(() => res(Object.fromEntries(ids.map(id => [id, `https://x/${id}.webp`]))));
    })) };
    const { result, rerender } = renderHook(({ ids }) => usePhotoUrls('c1', ids, s), {
      initialProps: { ids: ['ph-1'] as string[] },
    });
    await waitFor(() => expect(s.urlsFor).toHaveBeenCalledTimes(1));
    // Llega la segunda ANTES de que la base conteste por la primera.
    rerender({ ids: ['ph-1', 'ph-2'] });
    await waitFor(() => expect(s.urlsFor).toHaveBeenCalledTimes(2));
    for (const contesta of pendientes) contesta();
    // Las DOS tienen que acabar pintadas. Con limpieza, la primera se perdería para siempre.
    await waitFor(() => expect(result.current['ph-1']).toBe('https://x/ph-1.webp'));
    expect(result.current['ph-2']).toBe('https://x/ph-2.webp');
  });

  it('una foto nueva se firma sola, y sólo ella', async () => {
    const s = porId();
    const { result, rerender } = renderHook(({ ids }) => usePhotoUrls('c1', ids, s), {
      initialProps: { ids: ['ph-1'] as string[] },
    });
    await waitFor(() => expect(result.current['ph-1']).toBeDefined());
    rerender({ ids: ['ph-1', 'ph-2'] });
    await waitFor(() => expect(result.current['ph-2']).toBe('https://x/ph-2.webp'));
    // La segunda petición pide SÓLO la nueva: la primera ya está firmada.
    expect(s.urlsFor).toHaveBeenNthCalledWith(2, 'c1', ['ph-2']);
    expect(result.current['ph-1']).toBeDefined();
  });

  /**
   * 🔑 EL ENLACE FIRMADO VALE UNA HORA PASE LO QUE PASE. Si esto devolviera todo lo firmado alguna vez, una
   * foto que el director retira del área de juego se le seguiría viendo al jugador hasta una hora — justo lo
   * contrario de «*si las pongo al costado los jugadores no las ven*».
   */
  it('🔑 una foto que deja de poderse enseñar DEJA de salir, aunque ya estuviera firmada', async () => {
    const s = porId();
    const { result, rerender } = renderHook(({ ids }) => usePhotoUrls('c1', ids, s), {
      initialProps: { ids: ['ph-1', 'ph-2'] as string[] },
    });
    await waitFor(() => expect(result.current['ph-1']).toBeDefined());
    expect(result.current['ph-2']).toBeDefined();
    // El director la saca del área de juego: para el jugador ya no está en la lista.
    rerender({ ids: ['ph-2'] });
    expect(result.current['ph-1']).toBeUndefined();
    expect(result.current['ph-2']).toBe('https://x/ph-2.webp');
  });

  it('y si vuelve a entrar se ve otra vez, sin volver a pedir la firma', async () => {
    const s = porId();
    const { result, rerender } = renderHook(({ ids }) => usePhotoUrls('c1', ids, s), {
      initialProps: { ids: ['ph-1'] as string[] },
    });
    await waitFor(() => expect(result.current['ph-1']).toBeDefined());
    rerender({ ids: [] });
    expect(result.current['ph-1']).toBeUndefined();
    rerender({ ids: ['ph-1'] });
    expect(result.current['ph-1']).toBe('https://x/ph-1.webp');
    expect(s.urlsFor).toHaveBeenCalledTimes(1);
  });

  it('una firma que falla no tumba la escena ni se pide en bucle', async () => {
    const s = { urlsFor: vi.fn().mockRejectedValue(new Error('red')) };
    const { result, rerender } = renderHook(({ ids }) => usePhotoUrls('c1', ids, s), {
      initialProps: { ids: ['ph-1'] as string[] },
    });
    await waitFor(() => expect(s.urlsFor).toHaveBeenCalled());
    rerender({ ids: ['ph-1'] });
    expect(s.urlsFor).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({});
  });

  it('sin firmante no se rompe: simplemente no hay nada que pintar', () => {
    const { result } = renderHook(() => usePhotoUrls('c1', ['ph-1'], undefined));
    expect(result.current).toEqual({});
  });

  it('cambiar de campaña vacía lo firmado: un enlace de otra campaña no sirve aquí', async () => {
    const s = { urlsFor: vi.fn(async (c: string, ids: readonly string[]) => Object.fromEntries(ids.map(id => [id, `https://x/${c}/${id}.webp`]))) };
    const { result, rerender } = renderHook(({ c }) => usePhotoUrls(c, ['ph-1'], s), {
      initialProps: { c: 'c1' },
    });
    await waitFor(() => expect(result.current['ph-1']).toBe('https://x/c1/ph-1.webp'));
    rerender({ c: 'c2' });
    await waitFor(() => expect(result.current['ph-1']).toBe('https://x/c2/ph-1.webp'));
  });
});
