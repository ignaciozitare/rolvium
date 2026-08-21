import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./supabaseClient', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } },
}));

import { apiFetch, ApiError } from './api';

const ok = (data: unknown) => ({ status: 200, ok: true, json: async () => ({ ok: true, data }) }) as unknown as Response;

describe('apiFetch — la cabecera del cuerpo', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { fetchMock.mockReset().mockResolvedValue(ok({ hi: 1 })); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => vi.unstubAllGlobals());

  const headersOf = () => (fetchMock.mock.calls.at(-1)![1] as RequestInit).headers as Record<string, string>;

  /**
   * Regresión, cazada MIRANDO la app el 2026-08-22: la niebla de guerra llevaba rota desde `a25d380`.
   * `apiFetch` anunciaba `Content-Type: application/json` SIEMPRE, también en los escritos sin cuerpo, y
   * Fastify los rechaza con un 400 `FST_ERR_CTP_EMPTY_JSON_BODY`. La escena pedía la visión al servidor sin
   * cuerpo, se la rechazaban, y la niebla no se recalculaba nunca. El director no lo nota; el jugador sí.
   */
  it('sin cuerpo NO anuncia `Content-Type: application/json` (si no, Fastify devuelve 400)', async () => {
    await apiFetch('/scenes/s1/vision', { method: 'POST' });
    expect(headersOf()['Content-Type']).toBeUndefined();
    // el otro escrito sin cuerpo de la app: borrar un usuario desde Administración
    await apiFetch('/admin/users/u1', { method: 'DELETE' });
    expect(headersOf()['Content-Type']).toBeUndefined();
  });

  it('con cuerpo sí lo anuncia, que es cuando es verdad', async () => {
    await apiFetch('/scenes/s1/fog', { method: 'POST', body: JSON.stringify({ op: 'reveal', all: true }) });
    expect(headersOf()['Content-Type']).toBe('application/json');
  });

  it('siempre lleva el token de la sesión, y una cabecera propia manda sobre las de serie', async () => {
    await apiFetch('/x', { method: 'POST', body: '{}', headers: { 'Content-Type': 'text/plain' } });
    expect(headersOf()['Authorization']).toBe('Bearer tok');
    expect(headersOf()['Content-Type']).toBe('text/plain');
  });

  it('un 204 no intenta leer cuerpo, y un error del API sale como `ApiError` con su código', async () => {
    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: async () => { throw new Error('no body'); } } as unknown as Response);
    await expect(apiFetch('/x', { method: 'DELETE' })).resolves.toBeUndefined();
    fetchMock.mockResolvedValueOnce({ status: 403, ok: false, json: async () => ({ ok: false, error: { code: 'FORBIDDEN', message: 'no' } }) } as unknown as Response);
    await expect(apiFetch('/x')).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    fetchMock.mockResolvedValueOnce({ status: 403, ok: false, json: async () => ({ ok: false, error: { code: 'FORBIDDEN', message: 'no' } }) } as unknown as Response);
    await expect(apiFetch('/x')).rejects.toBeInstanceOf(ApiError);
  });
});
