/**
 * Normaliza a `Error` cualquier cosa que se lance en el borde de infra.
 *
 * Por qué existe (dueño, 2026-08-19): un personaje entero se perdió en silencio. El generador ya
 * guardaba el motivo del fallo (`catch { setFailed(e instanceof Error ? e.message : true) }`), pero
 * **supabase-js no lanza `Error`**: cuando no se pide `throwOnError`, el campo `error` de la respuesta
 * es un OBJETO PLANO `{ message, details, hint, code }` (`@supabase/postgrest-js` sólo construye su
 * clase `PostgrestError` en la rama `shouldThrowOnError`). Los repos hacen `throw error`, así que
 * `e instanceof Error` era **false** para todos los fallos reales de base y el motivo se seguía
 * tirando a la basura. Comprobado contra el stack local: un nombre vacío devuelve
 * `{ code: '23514', message: 'new row for relation "characters" violates check constraint …' }`
 * con `instanceof Error === false`.
 *
 * El `hint` es el campo más útil de PostgREST —para un 42501 trae el GRANT literal que lo arregla— y
 * el `code` es lo estable para diagnosticar, así que los tres viajan dentro del `message`: lo que se
 * pinta en pantalla es `message`, y nadie más lo desempaqueta.
 */
export class DbError extends Error {
  constructor(
    readonly code: string,
    readonly reason: string,
    readonly hint: string | null,
    readonly details: string | null,
  ) {
    super([reason, hint, details].filter(Boolean).join(' · ') + (code ? ` [${code}]` : ''));
    this.name = 'DbError';
  }
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Envuelve el error de un cliente de base (supabase-js y compañía) en un `Error` de verdad. */
export function dbError(e: unknown): Error {
  if (e instanceof Error) return e;
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>;
    const reason = text(o['message']);
    if (reason) return new DbError(text(o['code']) ?? '', reason, text(o['hint']), text(o['details']));
  }
  return new DbError('', text(e) ?? 'unknown_error', null, null);
}

/**
 * El motivo legible de un fallo, para enseñarlo, o `null` si no hay ninguno. Se separa de `dbError`
 * porque la pantalla distingue «falló y éste es el motivo» de «falló y no sé por qué»: enseñar
 * `unknown_error` como si fuera una explicación es la misma mentira que no enseñar nada.
 */
export function reasonOf(e: unknown): string | null {
  const err = dbError(e);
  return err instanceof DbError && err.reason === 'unknown_error' ? null : err.message || null;
}
