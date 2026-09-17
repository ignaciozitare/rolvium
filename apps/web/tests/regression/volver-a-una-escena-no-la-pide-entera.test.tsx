import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Room, Scene } from '@/modules/maps/domain/entities/Scene';
import { useScene } from '@/modules/maps/ui/useScene';
import { fakeMapsRepo, fakeVisionPort, PLAYER_USER, SCENE_WAREHOUSE, TOKEN_KAREN } from '../helpers/fakes';

/**
 * 🔑 VOLVER A UNA ESCENA NO LA PIDE ENTERA (suyo, 2026-09-17: «*¿por qué no haces una precarga y lo dejas en
 * memoria?*», después de quejarse de que el mapa se construía delante al cambiar de piso).
 *
 * Se guarda lo que SÓLO cambia el director —muros, dibujos, capas, luces, habitaciones, vanos y objetos— y
 * **nunca las fichas**, que son lo único que se mueve sin él: sus jugadores, en la escena que tenga activada.
 * Abrir una escena y activarla son dos acciones distintas, así que puede estar preparando el piso 2 mientras
 * ellos juegan en el 1 — y al volver al 1 las fichas tienen que estar donde están, no donde las dejó.
 */
const PISO_2: Scene = { ...SCENE_WAREHOUSE, id: 'sc-piso2', name: 'Piso 2' };
const sala = (id: string, sceneId: string): Room => ({
  id, sceneId, campaignId: SCENE_WAREHOUSE.campaignId, kind: 'room', shape: 'rect',
  points: [[0, 0], [10, 0], [10, 10], [0, 10]], floorPreset: 'simple', floorUrl: null,
  floorColor: null, floorMaskUrl: null, floorPaintUrl: null, createdAt: '', updatedAt: '',
});
const SALA_1 = sala('rm-1', SCENE_WAREHOUSE.id);
const SALA_2 = sala('rm-2', PISO_2.id);

afterEach(() => { vi.restoreAllMocks(); });

const montar = (repo: ReturnType<typeof fakeMapsRepo>, scene: Scene) =>
  renderHook(({ sc }: { sc: Scene }) => useScene(repo, sc, PLAYER_USER.id, fakeVisionPort()), { initialProps: { sc: scene } });

describe('🔑 volver a una escena no la pide entera', () => {
  it('al volver, el mapa se pinta de memoria SIN esperar — y se vuelve a pedir igualmente', async () => {
    const repo = fakeMapsRepo({ rooms: [SALA_1, SALA_2], tokens: [TOKEN_KAREN] });
    const { result, rerender } = montar(repo, SCENE_WAREHOUSE);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    rerender({ sc: PISO_2 });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    const salas = vi.spyOn(repo, 'listRooms');
    rerender({ sc: SCENE_WAREHOUSE });           // vuelve al piso 1
    // Se pinta de memoria ANTES de que llegue nada: eso es lo que quita la espera.
    expect(result.current.rooms.map(r => r.id)).toEqual([SALA_1.id]);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    // Y aun así se vuelve a pedir: lo guardado sirve para no esperar, nunca como verdad.
    expect(salas).toHaveBeenCalledTimes(1);
  });

  it('🔒 lo guardado NUNCA manda: si la escena cambió mientras no estaba, se corrige sola', async () => {
    /*
     * Esto es lo que paró el QA. La primera versión se fiaba de lo guardado con la excusa de que «esto sólo lo
     * cambia el director», y era FALSO por dos sitios: los dibujos los hacen los JUGADORES, y este hook corre
     * también en la pantalla de ellos, donde el que cambia las cosas mientras están en otra escena es él.
     * Un muro que el director ocultara volvería a verse — el agujero que se cerró el 2026-09-03.
     */
    const repo = fakeMapsRepo({ rooms: [SALA_1, SALA_2] });
    const { result, rerender } = montar(repo, SCENE_WAREHOUSE);
    await waitFor(() => expect(result.current.rooms.map(r => r.id)).toEqual([SALA_1.id]));

    rerender({ sc: PISO_2 });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    // Mientras está en el piso 2, alguien cambia el piso 1 por detrás (otro cliente, sin eco para éste).
    repo.rooms.push(sala('rm-mientras-no-estaba', SCENE_WAREHOUSE.id));

    rerender({ sc: SCENE_WAREHOUSE });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await waitFor(() => expect(result.current.rooms).toHaveLength(2));
    expect(result.current.rooms.map(r => r.id)).toContain('rm-mientras-no-estaba');
  });

  it('🐞 cambiar de piso SIN ESPERAR no guarda el mapa de uno en el hueco del otro', async () => {
    /*
     * El fallo bobo y grave, y sólo salta si se va antes de que termine de cargar — o sea, pinchando rápido
     * entre pisos, que es justo lo que él hace. Al cambiar de escena, el efecto que guarda corre con el id
     * NUEVO y las listas VIEJAS; si termina la carga, se corrige solo, pero si te vas antes, el mapa
     * equivocado se queda guardado y la próxima vez sale ÉSE. `cargadoPara` es lo que lo impide.
     */
    const repo = fakeMapsRepo({ rooms: [SALA_1, SALA_2] });
    const original = repo.listRooms;
    let soltar: (() => void) | null = null;
    repo.listRooms = async (sid: string) => {
      if (sid === PISO_2.id && !soltar) { await new Promise<void>(res => { soltar = res; }); }
      return original(sid);
    };

    const { result, rerender } = montar(repo, SCENE_WAREHOUSE);
    await waitFor(() => expect(result.current.rooms.map(r => r.id)).toEqual([SALA_1.id]));

    rerender({ sc: PISO_2 });                    // la carga del piso 2 se queda a medias…
    await waitFor(() => expect(soltar).not.toBeNull());
    rerender({ sc: SCENE_WAREHOUSE });           // …y él ya se ha ido al 1 otra vez
    await waitFor(() => expect(result.current.status).toBe('ready'));
    soltar!();

    rerender({ sc: PISO_2 });                    // ahora sí abre el 2
    await waitFor(() => expect(result.current.status).toBe('ready'));
    // Sin la guarda, aquí saldría la sala del PISO 1 guardada en el hueco del 2.
    expect(result.current.rooms.map(r => r.id)).toEqual([SALA_2.id]);
  });

  it('lo que él dibuja antes de irse está al volver: el guardado se mantiene solo', async () => {
    const repo = fakeMapsRepo({ rooms: [SALA_1, SALA_2] });
    const { result, rerender } = montar(repo, SCENE_WAREHOUSE);
    await waitFor(() => expect(result.current.status).toBe('ready'));

    const nueva = { ...sala('rm-nueva', SCENE_WAREHOUSE.id) };
    await waitFor(async () => { await result.current.addRoomShape('rect', nueva.points); });
    await waitFor(() => expect(result.current.rooms).toHaveLength(2));

    rerender({ sc: PISO_2 });
    await waitFor(() => expect(result.current.rooms.map(r => r.id)).toEqual([SALA_2.id]));
    rerender({ sc: SCENE_WAREHOUSE });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.rooms).toHaveLength(2);
  });
});
