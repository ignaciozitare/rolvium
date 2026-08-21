import type { ApiResponse } from '@rolvium/shared-types';
import { supabase } from './supabaseClient';

export const API_BASE = ((import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:3001').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Calls the Rolvium API with the current Supabase access token. Only infra
 * adapters may use this — UI never calls fetch directly.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  /**
   * `Content-Type: application/json` SÓLO cuando de verdad viaja un cuerpo. Anunciarlo con el sobre vacío es
   * mentir sobre lo que se manda, y Fastify —con razón— lo rechaza con un 400
   * `FST_ERR_CTP_EMPTY_JSON_BODY: «Body cannot be empty when content-type is set to application/json»`.
   *
   * Se cazó MIRANDO la app el 2026-08-22, no con un test: **la niebla de guerra llevaba rota desde el día que
   * se construyó** (`a25d380`). Cada vez que la escena pedía la visión al servidor —al entrar, al mover un
   * token, al abrir una puerta— la petición salía sin cuerpo y volvía un 400, así que la niebla no se
   * recalculaba nunca. El director no lo nota, porque lo ve todo igual; quien se queda sin ver es el jugador.
   * Los dos únicos escritos sin cuerpo de la app son ése y borrar un usuario desde Administración.
   *
   * No lo cazó ningún test porque el fallo vive en la COSTURA: los del navegador simulan `fetch` y los del
   * servidor entran por `app.inject`, y ninguno de los dos manda una petición de verdad al otro.
   */
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body !== undefined && init.body !== null ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!res.ok || !body || !body.ok) {
    const err = body && !body.ok ? body.error : { code: 'HTTP_ERROR', message: `HTTP ${res.status}` };
    throw new ApiError(err.code, err.message, res.status);
  }
  return body.data;
}
