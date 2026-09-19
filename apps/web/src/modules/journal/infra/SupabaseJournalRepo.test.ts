import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LogbookConflictError } from '../domain/entities/Journal';
import { SupabaseJournalRepo, mapLogbookRow, mapNotesRow } from './SupabaseJournalRepo';

type Response = { data: unknown; error: unknown };

/**
 * Un cliente falso que devuelve UNA respuesta por consulta, en orden: `openNotes` hace dos (buscar y crear) y
 * `saveLogbook` puede hacer dos (guardar y, si no entró, releer). El de `tests/helpers` sólo sabe dar la misma
 * respuesta a todas las llamadas de una tabla, y aquí lo que se prueba es justo la secuencia.
 */
function fakeDb(responses: Response[]) {
  const calls: { table: string; op: string; payload?: unknown; filters: [string, unknown][] }[] = [];
  let i = 0;
  const client = {
    from: vi.fn((table: string) => {
      const call: { table: string; op: string; payload?: unknown; filters: [string, unknown][] } = { table, op: 'select', filters: [] };
      calls.push(call);
      const chain: Record<string, unknown> = {
        then: (resolve: (r: Response) => unknown) => Promise.resolve(responses[i++] ?? { data: null, error: null }).then(resolve),
      };
      for (const op of ['select', 'single', 'maybeSingle', 'order', 'limit']) chain[op] = vi.fn(() => chain);
      for (const op of ['insert', 'update', 'delete', 'upsert']) {
        chain[op] = vi.fn((payload: unknown) => { call.op = op; call.payload = payload; return chain; });
      }
      chain.eq = vi.fn((col: string, value: unknown) => { call.filters.push([col, value]); return chain; });
      return chain;
    }),
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const NOTES_ROW = { id: 'n1', campaign_id: 'c1', user_id: 'u1', doc: { v: 1, blocks: [{ id: 'a', type: 'paragraph', text: 'hola' }] }, updated_at: '2026-09-19T21:00:00Z' };
const LOGBOOK_ROW = { id: 'l1', campaign_id: 'c1', doc: { v: 1, blocks: [] }, updated_by: 'u2', updated_at: '2026-09-19T21:00:00Z' };
const DOC = { v: 1 as const, blocks: [] };

describe('mapeo de filas', () => {
  it('convierte el jsonb de la base en un documento que el pintor entiende', () => {
    expect(mapNotesRow(NOTES_ROW)).toEqual({
      id: 'n1', campaignId: 'c1', userId: 'u1', updatedAt: '2026-09-19T21:00:00Z',
      doc: { v: 1, blocks: [{ id: 'a', type: 'paragraph', text: [{ t: 'hola' }] }] },
    });
    expect(mapLogbookRow({ ...LOGBOOK_ROW, doc: null })).toMatchObject({ id: 'l1', updatedBy: 'u2', doc: { v: 1, blocks: [] } });
  });
});

describe('abrir Notas', () => {
  it('devuelve las mías si ya existen, buscándolas por campaña Y por persona', async () => {
    const { client, calls } = fakeDb([{ data: NOTES_ROW, error: null }]);
    const notes = await new SupabaseJournalRepo(client).openNotes('c1', 'u1');
    expect(notes.id).toBe('n1');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.filters).toEqual([['campaign_id', 'c1'], ['user_id', 'u1']]);
  });

  it('las crea vacías la primera vez, en vez de dejar la pestaña sin poder guardar', async () => {
    const { client, calls } = fakeDb([{ data: null, error: null }, { data: { ...NOTES_ROW, doc: null }, error: null }]);
    const notes = await new SupabaseJournalRepo(client).openNotes('c1', 'u1');
    expect(notes.doc).toEqual({ v: 1, blocks: [] });
    expect(calls[1]).toMatchObject({ table: 'journal_notes', op: 'insert', payload: { campaign_id: 'c1', user_id: 'u1' } });
  });

  it('un error de la base sube tal cual (la RLS no se disfraza de documento vacío)', async () => {
    const { client } = fakeDb([{ data: null, error: new Error('permission denied') }]);
    await expect(new SupabaseJournalRepo(client).openNotes('c1', 'u1')).rejects.toThrow('permission denied');
  });
});

describe('abrir la Bitácora', () => {
  it('es una sola por campaña, y se crea vacía la primera vez', async () => {
    const { client, calls } = fakeDb([{ data: null, error: null }, { data: LOGBOOK_ROW, error: null }]);
    const logbook = await new SupabaseJournalRepo(client).openLogbook('c1');
    expect(logbook.campaignId).toBe('c1');
    expect(calls[0]?.filters).toEqual([['campaign_id', 'c1']]);
    expect(calls[1]).toMatchObject({ op: 'insert', payload: { campaign_id: 'c1' } });
  });
});

describe('guardar', () => {
  it('las Notas se guardan por su id y devuelven la nueva marca de tiempo', async () => {
    const { client, calls } = fakeDb([{ data: { updated_at: '2026-09-19T21:06:00Z' }, error: null }]);
    await expect(new SupabaseJournalRepo(client).saveNotes('n1', DOC)).resolves.toBe('2026-09-19T21:06:00Z');
    expect(calls[0]).toMatchObject({ op: 'update', payload: { doc: DOC }, filters: [['id', 'n1']] });
  });

  it('la Bitácora sólo se guarda si nadie la tocó: filtra por la marca con la que se abrió', async () => {
    const { client, calls } = fakeDb([{ data: { updated_at: '2026-09-19T21:10:00Z' }, error: null }]);
    const at = await new SupabaseJournalRepo(client).saveLogbook('l1', DOC, '2026-09-19T21:00:00Z', 'u1');
    expect(at).toBe('2026-09-19T21:10:00Z');
    expect(calls[0]).toMatchObject({ op: 'update', payload: { doc: DOC, updated_by: 'u1' } });
    expect(calls[0]?.filters).toEqual([['id', 'l1'], ['updated_at', '2026-09-19T21:00:00Z']]);
  });

  it('si otro guardó antes, avisa con la marca de lo que hay — y NO pisa su texto', async () => {
    const { client } = fakeDb([{ data: null, error: null }, { data: { updated_at: '2026-09-19T21:08:00Z' }, error: null }]);
    const error = await new SupabaseJournalRepo(client).saveLogbook('l1', DOC, '2026-09-19T21:00:00Z', 'u1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LogbookConflictError);
    expect((error as LogbookConflictError).serverUpdatedAt).toBe('2026-09-19T21:08:00Z');
  });
});
