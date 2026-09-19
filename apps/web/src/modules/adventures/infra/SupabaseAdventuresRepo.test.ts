import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AdventureConflictError } from '../domain/entities/Adventure';
import { SupabaseAdventuresRepo, adventurePatchRow, mapAdventureRow } from './SupabaseAdventuresRepo';

type Response = { data: unknown; error: unknown };

function fakeDb(responses: Response[]) {
  const calls: { table: string; op: string; payload?: unknown; filters: [string, string, unknown][] }[] = [];
  let i = 0;
  const client = {
    from: vi.fn((table: string) => {
      const call: { table: string; op: string; payload?: unknown; filters: [string, string, unknown][] } = { table, op: 'select', filters: [] };
      calls.push(call);
      const chain: Record<string, unknown> = {
        then: (resolve: (r: Response) => unknown) => Promise.resolve(responses[i++] ?? { data: null, error: null }).then(resolve),
      };
      for (const op of ['select', 'single', 'maybeSingle', 'order', 'limit']) chain[op] = vi.fn(() => chain);
      for (const op of ['insert', 'update', 'delete', 'upsert']) {
        chain[op] = vi.fn((payload: unknown) => { call.op = op; call.payload = payload; return chain; });
      }
      for (const op of ['eq', 'neq']) {
        chain[op] = vi.fn((col: string, value: unknown) => { call.filters.push([op, col, value]); return chain; });
      }
      return chain;
    }),
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const ROW = {
  id: 'a1', campaign_id: 'c1', title: 'El almacén de los muelles', summary: null,
  doc: { v: 1, blocks: [{ id: 'h', type: 'heading', level: 1, text: 'El almacén' }] },
  status: 'running' as const, sort_order: 1, updated_at: '2026-09-19T21:00:00Z',
};
const DOC = { v: 1 as const, blocks: [] };

describe('mapeo', () => {
  it('convierte la fila en una aventura con su documento ya entendible', () => {
    expect(mapAdventureRow(ROW)).toEqual({
      id: 'a1', campaignId: 'c1', title: 'El almacén de los muelles', summary: null, status: 'running',
      sortOrder: 1, updatedAt: '2026-09-19T21:00:00Z',
      doc: { v: 1, blocks: [{ id: 'h', type: 'heading', level: 1, text: [{ t: 'El almacén' }] }] },
    });
  });

  it('el parche sólo lleva lo que cambia, con los nombres de columna de la base', () => {
    expect(adventurePatchRow({ title: 'Nueva', sortOrder: 3 })).toEqual({ title: 'Nueva', sort_order: 3 });
    expect(adventurePatchRow({ summary: null, status: 'done' })).toEqual({ summary: null, status: 'done' });
    expect(adventurePatchRow({})).toEqual({});
  });
});

describe('listar y crear', () => {
  it('lista las de la campaña por el orden del carril y deja fuera las archivadas', async () => {
    const { client, calls } = fakeDb([{ data: [ROW], error: null }]);
    const list = await new SupabaseAdventuresRepo(client).list('c1');
    expect(list.map(a => a.id)).toEqual(['a1']);
    expect(calls[0]?.filters).toEqual([['eq', 'campaign_id', 'c1'], ['neq', 'status', 'archived']]);
  });

  it('con `includeArchived` no filtra por estado', async () => {
    const { client, calls } = fakeDb([{ data: [], error: null }]);
    await new SupabaseAdventuresRepo(client).list('c1', { includeArchived: true });
    expect(calls[0]?.filters).toEqual([['eq', 'campaign_id', 'c1']]);
  });

  it('crea con el título que le dan; el resto lo pone la base', async () => {
    const { client, calls } = fakeDb([{ data: ROW, error: null }]);
    const created = await new SupabaseAdventuresRepo(client).create('c1', 'El almacén de los muelles');
    expect(created.status).toBe('running');
    expect(calls[0]).toMatchObject({ op: 'insert', payload: { campaign_id: 'c1', title: 'El almacén de los muelles' } });
  });

  it('una aventura que la base no te da (jugador) se lee como «no hay»', async () => {
    const { client } = fakeDb([{ data: null, error: null }]);
    await expect(new SupabaseAdventuresRepo(client).getById('a1')).resolves.toBeNull();
  });
});

describe('guardar y borrar', () => {
  it('no manda un update vacío a la base', async () => {
    const { client, calls } = fakeDb([]);
    await new SupabaseAdventuresRepo(client).update('a1', {});
    expect(calls).toHaveLength(0);
  });

  it('guarda el documento contra la marca con la que se abrió', async () => {
    const { client, calls } = fakeDb([{ data: { updated_at: '2026-09-19T21:30:00Z' }, error: null }]);
    const at = await new SupabaseAdventuresRepo(client).saveDoc('a1', DOC, '2026-09-19T21:00:00Z');
    expect(at).toBe('2026-09-19T21:30:00Z');
    expect(calls[0]?.filters).toEqual([['eq', 'id', 'a1'], ['eq', 'updated_at', '2026-09-19T21:00:00Z']]);
  });

  it('si la pestaña y la ventana aparte guardan a la vez, la segunda avisa en vez de pisar', async () => {
    const { client } = fakeDb([{ data: null, error: null }, { data: { updated_at: '2026-09-19T21:20:00Z' }, error: null }]);
    const error = await new SupabaseAdventuresRepo(client).saveDoc('a1', DOC, '2026-09-19T21:00:00Z').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AdventureConflictError);
    expect((error as AdventureConflictError).serverUpdatedAt).toBe('2026-09-19T21:20:00Z');
  });

  it('borrar sube el error de la base tal cual: si aún le cuelga una escena, no se borra', async () => {
    const { client } = fakeDb([{ data: null, error: new Error('violates foreign key constraint') }]);
    await expect(new SupabaseAdventuresRepo(client).remove('a1')).rejects.toThrow('violates foreign key constraint');
  });
});
