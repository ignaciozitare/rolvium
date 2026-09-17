import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { useScene } from '@/modules/maps/ui/useScene';
import { fakeMapsRepo, fakeVisionPort, PLAYER_USER, SCENE_WAREHOUSE } from '../helpers/fakes';

/**
 * 🐞 «*SE VE COMO SE CONSTRUYE EL MAPA*» (suyo, 2026-09-17, cambiando de escena).
 *
 * La escena nueva entra AL INSTANTE (`setLive`) pero sus ocho listas se piden después. Entre medias se
 * dibujaban las piezas de la escena ANTERIOR encima del mapa nuevo. Existía desde antes de la red de errores
 * —se comprobó contra `main`—, y él lo vio al probar la rama.
 *
 * Este test ata la pareja que lo hace posible: mientras las piezas no han llegado, `status` dice `loading`, y
 * la pantalla tapa SÓLO el hueco del mapa con eso (ver el comentario en `SceneTab`).
 */
afterEach(() => { vi.restoreAllMocks(); });

describe('🐞 el mapa aparece hecho al cambiar de escena', () => {
  it('mientras no han llegado las piezas, `status` es «loading» — y no «ready» con lo viejo', async () => {
    const repo = fakeMapsRepo({ rooms: [], walls: [] });
    /* Se retiene la respuesta para poder mirar el instante intermedio, que es donde vivía el fallo. */
    let soltar: (() => void) | null = null;
    const original = repo.listRooms;
    repo.listRooms = async (sid: string) => {
      await new Promise<void>(res => { soltar = res; });
      return original(sid);
    };

    const { result } = renderHook(() => useScene(repo, SCENE_WAREHOUSE, PLAYER_USER.id, fakeVisionPort()));

    // El instante que él veía: la escena ya es la nueva, pero sus piezas no han llegado.
    await waitFor(() => expect(result.current.status).toBe('loading'));
    expect(soltar).not.toBeNull();

    await act(async () => { soltar!(); await Promise.resolve(); });
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('cuando llegan, entran TODAS de una vez: nunca media escena', async () => {
    const repo = fakeMapsRepo({});
    const { result } = renderHook(() => useScene(repo, SCENE_WAREHOUSE, PLAYER_USER.id, fakeVisionPort()));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    // Las ocho listas son del mismo momento: si una estuviera a medias, esto sería el sitio donde se vería.
    expect(Array.isArray(result.current.rooms)).toBe(true);
    expect(Array.isArray(result.current.walls)).toBe(true);
    expect(Array.isArray(result.current.sceneProps)).toBe(true);
  });
});
