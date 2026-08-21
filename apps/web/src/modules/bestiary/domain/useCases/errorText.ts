/**
 * Texto legible de un error.
 *
 * Existe porque en la app corriendo salió un aviso rojo que decía literalmente «[object Object]»: los errores
 * de Supabase NO son `Error`, son objetos planos con `message`, `code`, `details` y `hint`, así que el
 * `String(e)` de toda la vida los convierte en eso. Un aviso que no dice nada es peor que ninguno — el
 * director ve que algo falló y no puede ni contarlo.
 */
export function errorText(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e instanceof Error && e.message) return e.message;
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>;
    // Orden a propósito: `message` es lo legible; `details` y `hint` amplían; `code` es el último recurso
    // pero al menos es buscable («42501» = permiso denegado).
    for (const k of ['message', 'details', 'hint', 'code'] as const) {
      const v = o[k];
      if (typeof v === 'string' && v.trim()) return v;
    }
  }
  return 'Error';
}
