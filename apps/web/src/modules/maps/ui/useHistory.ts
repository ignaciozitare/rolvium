import { useCallback, useRef, useState } from 'react';

/**
 * DESHACER Y REHACER (specs/modules/maps/SPEC.md § «Rebanada 8»).
 *
 * Petición suya del **2026-08-19**, aparcada dos veces como «fuera de alcance» y reclamada el 2026-09-03:
 * «*el deshacer y el inverso no funciona, no sé si se construyó pero estaba en las cosas que hay que hacer*».
 * Tenía razón: nunca se construyó.
 *
 * 🔑 **Cada paso sabe deshacerse Y rehacerse a sí mismo.** No se guarda una foto de la escena entera —serían
 * cientos de muros por paso y encima pisaría lo que hayan hecho los demás—: se guarda la vuelta atrás de ESE
 * cambio y nada más. Quien mete el paso es quien sabe invertirlo.
 *
 * ⚠️ **Vive en esta pantalla y muere con ella.** Recargar borra el historial, y es lo correcto: un deshacer
 * que sobreviviera a la recarga tendría que guardarse en la base y podría desandar lo que otro hizo después.
 *
 * ⚠️ **Rehacer se pierde en cuanto se hace algo nuevo**, como en cualquier programa: la rama que se abandonó
 * ya no encaja con lo que hay.
 */
export interface HistoryStep {
  /** Para el aviso en pantalla y para leer los tests. No se traduce aquí: es una clave de i18n. */
  label: string;
  undo: () => Promise<void> | void;
  redo: () => Promise<void> | void;
}

export interface History {
  /** Mete un paso ya hecho. Rehacer se vacía: la rama abandonada ya no encaja con lo que hay. */
  push: (step: HistoryStep) => void;
  undo: () => Promise<string | null>;
  redo: () => Promise<string | null>;
  canUndo: boolean;
  canRedo: boolean;
  /** Tira el historial entero. Al cambiar de escena, deshacer en la nueva no puede tocar la anterior. */
  reset: () => void;
}

/**
 * Cuántos pasos se recuerdan. Cincuenta es mucho más de lo que nadie deshace de seguido, y el coste es una
 * lista de funciones, no de escenas.
 */
export const HISTORY_LIMIT = 50;

export function useHistory(limit: number = HISTORY_LIMIT): History {
  /**
   * En `ref` y no en estado: deshacer es asíncrono —escribe en la base— y con estado, dos Ctrl+Z seguidos
   * leerían la misma pila vieja y desharían el mismo paso dos veces. El contador de al lado es lo único que
   * existe para que los botones se enteren de que hay algo que deshacer.
   */
  const past = useRef<HistoryStep[]>([]);
  const future = useRef<HistoryStep[]>([]);
  const [, bump] = useState(0);
  const avisar = useCallback(() => bump(n => n + 1), []);

  const push = useCallback((step: HistoryStep) => {
    past.current = [...past.current, step].slice(-limit);
    future.current = [];
    avisar();
  }, [limit, avisar]);

  const undo = useCallback(async (): Promise<string | null> => {
    const step = past.current[past.current.length - 1];
    if (!step) return null;
    past.current = past.current.slice(0, -1);
    avisar();
    await step.undo();
    // Se apila para rehacer DESPUÉS de que salga bien: si la vuelta atrás falla, el paso no se ha deshecho.
    future.current = [...future.current, step];
    avisar();
    return step.label;
  }, [avisar]);

  const redo = useCallback(async (): Promise<string | null> => {
    const step = future.current[future.current.length - 1];
    if (!step) return null;
    future.current = future.current.slice(0, -1);
    avisar();
    await step.redo();
    past.current = [...past.current, step].slice(-limit);
    avisar();
    return step.label;
  }, [limit, avisar]);

  const reset = useCallback(() => { past.current = []; future.current = []; avisar(); }, [avisar]);

  return { push, undo, redo, reset, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}
