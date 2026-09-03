import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { HISTORY_LIMIT, useHistory, type HistoryStep } from './useHistory';

/**
 * ↩️ DESHACER Y REHACER (§ «Rebanada 8»). Petición suya del 2026-08-19, aparcada dos veces y reclamada el
 * 2026-09-03: «*el deshacer y el inverso no funciona*».
 */
const paso = (nombre: string, diario: string[]): HistoryStep => ({
  label: nombre,
  undo: () => { diario.push(`-${nombre}`); },
  redo: () => { diario.push(`+${nombre}`); },
});

describe('useHistory', () => {
  it('sin nada hecho no hay nada que deshacer ni que rehacer', async () => {
    const { result } = renderHook(() => useHistory());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    await act(async () => { expect(await result.current.undo()).toBeNull(); });
    await act(async () => { expect(await result.current.redo()).toBeNull(); });
  });

  it('deshace el último paso, y rehacerlo lo vuelve a poner', async () => {
    const diario: string[] = [];
    const { result } = renderHook(() => useHistory());
    act(() => { result.current.push(paso('a', diario)); result.current.push(paso('b', diario)); });
    expect(result.current.canUndo).toBe(true);

    await act(async () => { expect(await result.current.undo()).toBe('b'); });
    expect(diario).toEqual(['-b']);
    expect(result.current.canRedo).toBe(true);

    await act(async () => { expect(await result.current.redo()).toBe('b'); });
    expect(diario).toEqual(['-b', '+b']);
    expect(result.current.canRedo).toBe(false);
  });

  it('deshace hacia atrás en orden, uno detrás de otro', async () => {
    const diario: string[] = [];
    const { result } = renderHook(() => useHistory());
    act(() => { for (const n of ['a', 'b', 'c']) result.current.push(paso(n, diario)); });
    await act(async () => { await result.current.undo(); await result.current.undo(); });
    expect(diario).toEqual(['-c', '-b']);
    expect(result.current.canUndo).toBe(true);
    await act(async () => { await result.current.undo(); });
    expect(diario).toEqual(['-c', '-b', '-a']);
    expect(result.current.canUndo).toBe(false);
  });

  /**
   * 🔒 Dos Ctrl+Z seguidos NO pueden deshacer el mismo paso dos veces. Con la pila en estado de React en vez
   * de en un `ref`, la segunda llamada leía la pila vieja — y deshacer escribe en la base, así que el estropicio
   * era real, no cosmético.
   */
  it('dos deshacer seguidos en el mismo instante deshacen dos pasos distintos', async () => {
    const diario: string[] = [];
    const { result } = renderHook(() => useHistory());
    act(() => { result.current.push(paso('a', diario)); result.current.push(paso('b', diario)); });
    await act(async () => { await Promise.all([result.current.undo(), result.current.undo()]); });
    expect(diario.sort()).toEqual(['-a', '-b']);
  });

  /** 🔒 Como en cualquier programa: si haces algo nuevo, la rama que abandonaste ya no encaja. */
  it('hacer algo nuevo tira lo que había para rehacer', async () => {
    const diario: string[] = [];
    const { result } = renderHook(() => useHistory());
    act(() => { result.current.push(paso('a', diario)); });
    await act(async () => { await result.current.undo(); });
    expect(result.current.canRedo).toBe(true);
    act(() => { result.current.push(paso('b', diario)); });
    expect(result.current.canRedo).toBe(false);
  });

  /** 🔒 Si la vuelta atrás falla, el paso NO se ha deshecho: no puede quedar como rehacible. */
  it('un deshacer que revienta no deja el paso en la pila de rehacer', async () => {
    const { result } = renderHook(() => useHistory());
    act(() => { result.current.push({ label: 'x', undo: () => { throw new Error('sin conexión'); }, redo: vi.fn() }); });
    await act(async () => { await expect(result.current.undo()).rejects.toThrow('sin conexión'); });
    expect(result.current.canRedo).toBe(false);
  });

  it('no crece sin fin: se queda con los últimos', async () => {
    const diario: string[] = [];
    const { result } = renderHook(() => useHistory(3));
    act(() => { for (const n of ['a', 'b', 'c', 'd']) result.current.push(paso(n, diario)); });
    await act(async () => { for (let i = 0; i < 4; i++) await result.current.undo(); });
    expect(diario).toEqual(['-d', '-c', '-b']);
    expect(HISTORY_LIMIT).toBeGreaterThan(3);
  });

  /** Cambiar de escena tira el historial: deshacer en la nueva no puede tocar la anterior. */
  it('reset lo deja todo a cero', async () => {
    const diario: string[] = [];
    const { result } = renderHook(() => useHistory());
    act(() => { result.current.push(paso('a', diario)); });
    act(() => { result.current.reset(); });
    expect(result.current.canUndo).toBe(false);
    await act(async () => { expect(await result.current.undo()).toBeNull(); });
    expect(diario).toEqual([]);
  });
});
