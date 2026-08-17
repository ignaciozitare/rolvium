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
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
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
