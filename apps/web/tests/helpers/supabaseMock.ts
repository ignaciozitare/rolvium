import { vi, type Mock } from 'vitest';

type SupabaseResponse<T = unknown> = { data: T | null; error: Error | null };

interface SupabaseMockOverrides {
  /** Map de tabla → respuesta. Ej: { users: { data: [], error: null } } */
  tables?: Record<string, SupabaseResponse>;
  /** Override genérico — si está, todas las llamadas devuelven esto. */
  defaultResponse?: SupabaseResponse;
}

interface SupabaseMockHandle {
  client: Record<string, Mock | unknown>;
  fromSpy: Mock;
  selectSpy: Mock;
  insertSpy: Mock;
  updateSpy: Mock;
  deleteSpy: Mock;
  upsertSpy: Mock;
}

/**
 * Factory de mocks para `supabase-js` en tests.
 *
 * Uso típico:
 *   vi.mock('@/shared/lib/supabaseClient', () => ({
 *     supabase: createSupabaseMock({
 *       tables: { users: { data: [{ id: '1', title: 'x' }], error: null } },
 *     }).client,
 *   }));
 *
 * El builder soporta el chain habitual: from().select().eq().single() etc.
 * Cada método del chain devuelve el mismo objeto thenable, y al await-earlo
 * resuelve con la respuesta configurada.
 */
export function createSupabaseMock(overrides: SupabaseMockOverrides = {}): SupabaseMockHandle {
  const fromSpy = vi.fn();
  const selectSpy = vi.fn();
  const insertSpy = vi.fn();
  const updateSpy = vi.fn();
  const deleteSpy = vi.fn();
  const upsertSpy = vi.fn();

  function buildChain(table: string) {
    const response: SupabaseResponse =
      overrides.tables?.[table] ??
      overrides.defaultResponse ??
      { data: null, error: null };

    const chain: Record<string, unknown> = {
      then: (onFulfilled: (r: SupabaseResponse) => unknown) =>
        Promise.resolve(response).then(onFulfilled),
      // El query builder real soporta async iteration via .then — esto es suficiente
      // para que `await supabase.from('x').select().eq('id', 1)` resuelva.
    };

    const passthroughMethods = [
      'select', 'insert', 'update', 'delete', 'upsert',
      'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in',
      'contains', 'containedBy', 'order', 'limit', 'range', 'single',
      'maybeSingle', 'returns', 'match', 'or', 'filter', 'not', 'csv',
    ];

    for (const method of passthroughMethods) {
      chain[method] = vi.fn(() => chain);
    }

    // Wire the spies that callers may want to assert on
    chain.select = selectSpy.mockImplementation(() => chain);
    chain.insert = insertSpy.mockImplementation(() => chain);
    chain.update = updateSpy.mockImplementation(() => chain);
    chain.delete = deleteSpy.mockImplementation(() => chain);
    chain.upsert = upsertSpy.mockImplementation(() => chain);

    return chain;
  }

  fromSpy.mockImplementation((table: string) => buildChain(table));

  const client = {
    from: fromSpy,
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: null, user: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: null, error: null }),
        download: vi.fn().mockResolvedValue({ data: null, error: null }),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } })),
      })),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  return { client, fromSpy, selectSpy, insertSpy, updateSpy, deleteSpy, upsertSpy };
}
