import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Room } from '@/modules/maps/domain/entities/Scene';
import { useScene } from '@/modules/maps/ui/useScene';
import { fakeMapsRepo, fakeVisionPort, PLAYER_USER, SCENE_WAREHOUSE } from '../helpers/fakes';

/**
 * 🐞 «DESAPARECEN HABITACIONES CUANDO QUIERO PINTAR» (suyo, 2026-09-16; dos arreglos anteriores fallaron
 * porque los dos miraban la PINTURA y el fallo era el CONTORNO).
 *
 * Lo que pasa de verdad, medido contra su escena «test dungeon2»: guardar una pincelada actualiza las 53
 * salas de una vez —todas apuntan al mismo PNG— y Postgres manda 53 ecos de tiempo real. **Nueve llegan sin
 * la columna `points`**: son las de mano alzada más gordas (1.796–3.800 bytes), y Postgres no repite en el
 * aviso de replicación un valor grande que el UPDATE no ha tocado (TOAST). Una rectangular ocupa 200 bytes y
 * no cruza el umbral jamás, de ahí su «*sólo pasa con las de freehand*».
 *
 * El mapeo convierte esa ausencia en `[]`, la sala se queda sin contorno y se esfuma de la pantalla. En la
 * base está intacta: por eso «*si recargo vuelven*».
 *
 * Este test reproduce el eco tal y como llega —la fila entera, con su fecha nueva, y el contorno vacío— y
 * exige que la sala siga dibujándose.
 */
const sala = (id: string, points: [number, number][]): Room => ({
  id, sceneId: SCENE_WAREHOUSE.id, campaignId: SCENE_WAREHOUSE.campaignId,
  kind: 'room', shape: points.length > 8 ? 'brush' : 'rect', points,
  floorPreset: 'simple', floorUrl: null, floorColor: null, floorMaskUrl: null, floorPaintUrl: null,
  createdAt: '2026-09-11T21:57:22.000Z', updatedAt: '2026-09-16T20:00:00.000Z',
});

/** El pasillo largo que él dibujó a mano: muchos puntos, que es justo lo que lo manda al almacén de fuera. */
const PASILLO = sala('rm-pasillo', Array.from({ length: 40 }, (_, i) => [i, (i % 3) + 1] as [number, number]));
const CUARTO = sala('rm-cuarto', [[0, 0], [10, 0], [10, 10], [0, 10]]);

/** El eco de guardar la pincelada: la pintura nueva, la fecha nueva… y el contorno AUSENTE, o sea `[]`. */
const ecoDelPincel = (r: Room): Room => ({
  ...r, points: [], floorPaintUrl: 'https://x/paint/floor.png?v=2', updatedAt: '2026-09-16T20:00:05.000Z',
});

afterEach(() => { vi.restoreAllMocks(); });

async function mount(rooms: Room[]) {
  const repo = fakeMapsRepo({ rooms });
  const { result } = renderHook(() => useScene(repo, SCENE_WAREHOUSE, PLAYER_USER.id, fakeVisionPort()));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  await waitFor(() => expect(result.current.rooms).toHaveLength(rooms.length));
  return { repo, result };
}

describe('🐞 las salas a mano alzada no se borran al pintar', () => {
  it('un eco SIN el contorno no deja la sala sin puntos: se conservan los que ya había', async () => {
    const { repo, result } = await mount([PASILLO, CUARTO]);

    await act(async () => { repo.emit(SCENE_WAREHOUSE.id, { room: { type: 'UPDATE', id: PASILLO.id, row: ecoDelPincel(PASILLO) } }); });

    const pasillo = result.current.rooms.find(r => r.id === PASILLO.id)!;
    expect(pasillo.points).toEqual(PASILLO.points);
    // Y lo que el eco SÍ traía se aplica: el arreglo no puede dejar el mapa apuntando a la pintura vieja.
    expect(pasillo.floorPaintUrl).toBe('https://x/paint/floor.png?v=2');
  });

  it('las 53 de golpe: ninguna se queda sin contorno, vengan como vengan los ecos', async () => {
    const todas = Array.from({ length: 53 }, (_, i) =>
      sala(`rm-${i}`, Array.from({ length: i % 2 ? 40 : 4 }, (_, k) => [k, i] as [number, number])));
    const { repo, result } = await mount(todas);

    // Como en su escena: sólo las gordas pierden el contorno; las pequeñas llegan enteras.
    await act(async () => {
      for (const r of todas) {
        const row = r.points.length > 8 ? ecoDelPincel(r) : { ...r, floorPaintUrl: 'https://x/paint/floor.png?v=2', updatedAt: '2026-09-16T20:00:05.000Z' };
        repo.emit(SCENE_WAREHOUSE.id, { room: { type: 'UPDATE', id: r.id, row } });
      }
    });

    expect(result.current.rooms.filter(r => r.points.length === 0)).toHaveLength(0);
    expect(result.current.rooms.every(r => r.floorPaintUrl === 'https://x/paint/floor.png?v=2')).toBe(true);
  });

  it('un contorno NUEVO sí manda: mover una sala tiene que seguir viéndose', async () => {
    const { repo, result } = await mount([PASILLO]);
    const movido: [number, number][] = [[5, 5], [15, 5], [15, 15], [5, 15]];

    await act(async () => { repo.emit(SCENE_WAREHOUSE.id, { room: { type: 'UPDATE', id: PASILLO.id, row: { ...PASILLO, points: movido, updatedAt: '2026-09-16T20:00:05.000Z' } } }); });

    expect(result.current.rooms[0]!.points).toEqual(movido);
  });

  it('borrar una sala sigue borrándola: el arreglo no la resucita', async () => {
    const { repo, result } = await mount([PASILLO, CUARTO]);

    await act(async () => { repo.emit(SCENE_WAREHOUSE.id, { room: { type: 'DELETE', id: PASILLO.id, row: null } }); });

    expect(result.current.rooms.map(r => r.id)).toEqual([CUARTO.id]);
  });
});
