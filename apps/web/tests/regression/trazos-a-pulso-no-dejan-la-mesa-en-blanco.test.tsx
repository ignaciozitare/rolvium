import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Drawing } from '@/modules/maps/domain/entities/Scene';
import { DrawingShape } from '@/modules/maps/ui/canvasLayers';
import { useScene } from '@/modules/maps/ui/useScene';
import { fakeMapsRepo, fakeVisionPort, PLAYER_USER, SCENE_WAREHOUSE } from '../helpers/fakes';

/**
 * 🐞 MISMA CAUSA QUE «DESAPARECEN HABITACIONES», PERO MUCHO PEOR: aquí no se pierde un trazo, **se queda la
 * mesa en blanco** (2026-09-17, encontrado por la review del arreglo de las salas y MEDIDO antes de tocar nada).
 *
 * Postgres no repite en el aviso de replicación un valor grande que el `UPDATE` no ha tocado (TOAST). Medido
 * contra su base local: **un trazo a pulso de 400 puntos pierde `data` en el eco; uno de 200 llega entero.**
 * El camino existe hoy y es suyo: arrastrar un trazo a otra capa hace
 * `update({ layer_id }).eq('id', id)`, que no toca `data`.
 *
 * Y `mapDrawingRow` pasa `data` SIN valor por defecto (a propósito), así que el trazo se quedaba con
 * `data: undefined`, `DrawingShape` leía `data.points` y reventaba AL PINTAR. Como no hay ni un ErrorBoundary
 * en toda la app, React tira el árbol entero: la mesa entera desaparece. Recargar lo arregla, porque la fila
 * está intacta — la misma firma desesperante que el fallo de las salas.
 *
 * Dos redes, y este test ata las dos: `keepUnsent` no deja que el eco borre el dibujo, y `DrawingShape`
 * aguanta sin reventar aunque le llegue un trazo sin dibujo.
 */
const TRAZO: Drawing = {
  id: 'dw-pulso', sceneId: SCENE_WAREHOUSE.id, campaignId: SCENE_WAREHOUSE.campaignId,
  authorId: PLAYER_USER.id, kind: 'stroke',
  // 400 puntos: el tamaño con el que se comprobó que la columna deja de viajar.
  data: { points: Array.from({ length: 400 }, (_, i) => [i * 1.5, (i % 17) * 2.25]) },
  color: '#8b1a1a', width: 3, createdAt: '2026-09-17T10:00:00.000Z', layerId: 'ly-1',
};

/** El eco de arrastrarlo a otra capa, tal y como llega de verdad: la fila entera MENOS `data`. */
const ecoSinDibujo = (): Drawing => {
  const { data: _omitida, ...resto } = TRAZO;
  return { ...resto, layerId: 'ly-2' } as Drawing;
};

afterEach(() => { vi.restoreAllMocks(); });

describe('🐞 un trazo a pulso no deja la mesa en blanco', () => {
  it('el eco sin dibujo NO borra el trazo, y el cambio de capa sí se aplica', async () => {
    const repo = fakeMapsRepo({ drawings: [TRAZO] });
    const { result } = renderHook(() => useScene(repo, SCENE_WAREHOUSE, PLAYER_USER.id, fakeVisionPort()));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await waitFor(() => expect(result.current.drawings).toHaveLength(1));

    await act(async () => { repo.emit(SCENE_WAREHOUSE.id, { drawing: { type: 'UPDATE', id: TRAZO.id, row: ecoSinDibujo() } }); });

    const trazo = result.current.drawings[0]!;
    expect((trazo.data as { points: unknown[] }).points).toHaveLength(400);
    expect(trazo.layerId).toBe('ly-2');
  });

  it('y aunque llegara uno sin dibujo, pintarlo NO revienta (la red del final)', () => {
    const sinDibujo = { kind: 'stroke', color: '#8b1a1a', width: 3 } as unknown as Drawing;
    expect(() => render(<svg><DrawingShape d={sinDibujo} /></svg>)).not.toThrow();
  });

  it('un trazo normal se sigue pintando igual: la red no cambia nada de lo que ya iba', () => {
    const { container } = render(<svg><DrawingShape d={TRAZO} /></svg>);
    expect(container.querySelector('polyline')).not.toBeNull();
  });
});
