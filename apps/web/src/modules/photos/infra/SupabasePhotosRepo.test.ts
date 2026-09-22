import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PHOTOS_BUCKET, SIGNED_URL_SECONDS, SupabasePhotosRepo, mapPhotoRow } from './SupabasePhotosRepo';

type Response = { data: unknown; error: unknown; count?: number | null };
interface Call { table: string; op: string; payload?: unknown; filters: [string, string, unknown][] }

/**
 * Un cliente falso que devuelve UNA respuesta por consulta, en orden (como el de `journal`), y que además
 * apunta lo que se hace con el almacén. El de `tests/helpers` no sabe de secuencias ni de ficheros.
 */
function fakeDb(responses: Response[], storage: { upload?: Response; remove?: Response; signed?: Response } = {}) {
  const calls: Call[] = [];
  let i = 0;
  const bucket = {
    upload: vi.fn(async () => storage.upload ?? { data: {}, error: null }),
    remove: vi.fn(async () => storage.remove ?? { data: [], error: null }),
    createSignedUrls: vi.fn(async () => storage.signed ?? { data: [], error: null }),
  };
  const client = {
    from: vi.fn((table: string) => {
      const call: Call = { table, op: 'select', filters: [] };
      calls.push(call);
      const chain: Record<string, unknown> = {
        then: (resolve: (r: Response) => unknown) => Promise.resolve(responses[i++] ?? { data: null, error: null }).then(resolve),
      };
      for (const op of ['single', 'maybeSingle', 'limit']) chain[op] = vi.fn(() => chain);
      chain.select = vi.fn(() => chain);
      chain.order = vi.fn((col: string, opts: unknown) => { call.filters.push(['order', col, opts]); return chain; });
      for (const op of ['insert', 'update', 'delete']) {
        chain[op] = vi.fn((payload?: unknown) => { call.op = op; call.payload = payload; return chain; });
      }
      chain.eq = vi.fn((col: string, value: unknown) => { call.filters.push(['eq', col, value]); return chain; });
      chain.contains = vi.fn((col: string, value: unknown) => { call.filters.push(['contains', col, value]); return chain; });
      return chain;
    }),
    storage: { from: vi.fn(() => bucket) },
  };
  return { client: client as unknown as SupabaseClient, calls, bucket, storageFrom: client.storage.from };
}

const ROW = { id: 'p1', campaign_id: 'c1', name: 'La cripta', width: 800, height: 600, created_at: '2026-09-22T10:00:00Z' };
const FILE = new Blob(['x'], { type: 'image/webp' });

describe('mapPhotoRow', () => {
  it('pasa la fila de la base a la foto de la pantalla', () => {
    expect(mapPhotoRow(ROW)).toEqual({ id: 'p1', campaignId: 'c1', name: 'La cripta', width: 800, height: 600, createdAt: '2026-09-22T10:00:00Z' });
  });
});

describe('list', () => {
  it('las de ESA campaña, de la más nueva a la más vieja', async () => {
    const { client, calls } = fakeDb([{ data: [ROW], error: null }]);
    expect(await new SupabasePhotosRepo(client).list('c1')).toEqual([mapPhotoRow(ROW)]);
    expect(calls[0]).toMatchObject({ table: 'photos_photos', filters: [['eq', 'campaign_id', 'c1'], ['order', 'created_at', { ascending: false }]] });
  });

  it('un fallo de la base se cuenta, no se disfraza de biblioteca vacía', async () => {
    const { client } = fakeDb([{ data: null, error: new Error('rls') }]);
    await expect(new SupabasePhotosRepo(client).list('c1')).rejects.toThrow('rls');
  });
});

describe('create — primero la fila, luego el fichero', () => {
  it('sube el fichero a campaña/foto en el bucket PRIVADO, con su tipo y sin pisar nada', async () => {
    const { client, calls, bucket, storageFrom } = fakeDb([{ data: ROW, error: null }]);
    const photo = await new SupabasePhotosRepo(client).create('c1', { name: 'La cripta', width: 800, height: 600, file: FILE });
    expect(photo.id).toBe('p1');
    expect(calls[0]).toMatchObject({ table: 'photos_photos', op: 'insert', payload: { campaign_id: 'c1', name: 'La cripta', width: 800, height: 600 } });
    expect(storageFrom).toHaveBeenCalledWith(PHOTOS_BUCKET);
    expect(bucket.upload).toHaveBeenCalledWith('c1/p1', FILE, { contentType: 'image/webp', upsert: false });
  });

  it('si el fichero no sube, la fila se deshace y el fallo se cuenta', async () => {
    const { client, calls } = fakeDb([{ data: ROW, error: null }, { data: null, error: null }], { upload: { data: null, error: new Error('too big') } });
    await expect(new SupabasePhotosRepo(client).create('c1', { name: 'x', width: 1, height: 1, file: FILE })).rejects.toThrow('too big');
    expect(calls[1]).toMatchObject({ table: 'photos_photos', op: 'delete', filters: [['eq', 'id', 'p1']] });
  });

  it('si la fila no entra, ni se intenta subir el fichero', async () => {
    const { client, bucket } = fakeDb([{ data: null, error: new Error('rls') }]);
    await expect(new SupabasePhotosRepo(client).create('c1', { name: 'x', width: 1, height: 1, file: FILE })).rejects.toThrow('rls');
    expect(bucket.upload).not.toHaveBeenCalled();
  });
});

describe('rename y remove', () => {
  it('renombrar cambia sólo el nombre de ESA foto', async () => {
    const { client, calls } = fakeDb([{ data: { ...ROW, name: 'El sótano' }, error: null }]);
    expect((await new SupabasePhotosRepo(client).rename('p1', 'El sótano')).name).toBe('El sótano');
    expect(calls[0]).toMatchObject({ op: 'update', payload: { name: 'El sótano' }, filters: [['eq', 'id', 'p1']] });
  });

  it('borrar quita la fila y después su fichero', async () => {
    const { client, calls, bucket } = fakeDb([{ data: null, error: null }]);
    await new SupabasePhotosRepo(client).remove({ id: 'p1', campaignId: 'c1' });
    expect(calls[0]).toMatchObject({ table: 'photos_photos', op: 'delete', filters: [['eq', 'id', 'p1']] });
    expect(bucket.remove).toHaveBeenCalledWith(['c1/p1']);
  });

  it('si la base no la deja borrar, el fichero no se toca', async () => {
    const { client, bucket } = fakeDb([{ data: null, error: new Error('rls') }]);
    await expect(new SupabasePhotosRepo(client).remove({ id: 'p1', campaignId: 'c1' })).rejects.toThrow('rls');
    expect(bucket.remove).not.toHaveBeenCalled();
  });
});

describe('usage — dónde se usa, para el aviso de borrar', () => {
  it('aventuras que la llevan en el documento, escenas (una vez cada una) y cuántos mensajes', async () => {
    const { client, calls } = fakeDb([
      { data: [{ id: 'a1', title: 'Aventura 1' }], error: null },
      { data: [{ scene_id: 's1', maps_scenes: { name: 'La capilla' } }, { scene_id: 's1', maps_scenes: { name: 'La capilla' } }], error: null },
      { data: null, error: null, count: 2 },
    ]);
    expect(await new SupabasePhotosRepo(client).usage({ id: 'p1', campaignId: 'c1' })).toEqual({
      adventures: [{ id: 'a1', title: 'Aventura 1' }],
      scenes: [{ id: 's1', name: 'La capilla' }],
      messages: 2,
    });
    // En el documento no hay clave ajena: se busca el bloque que la apunta.
    expect(calls[0]).toMatchObject({ table: 'adventures_adventures', filters: [['eq', 'campaign_id', 'c1'], ['contains', 'doc', { blocks: [{ type: 'image', photoId: 'p1' }] }]] });
    expect(calls[1]).toMatchObject({ table: 'maps_scene_props', filters: [['eq', 'photo_id', 'p1']] });
    expect(calls[2]).toMatchObject({ table: 'chat_messages', filters: [['eq', 'photo_id', 'p1']] });
  });
});

describe('urlsFor — los enlaces firmados', () => {
  it('firma cada foto una vez, por una hora, y devuelve el enlace por id', async () => {
    const { client, bucket } = fakeDb([], { signed: { data: [{ signedUrl: 'https://x/c1/p1?t', error: null }, { signedUrl: 'https://x/c1/p2?t', error: null }], error: null } });
    expect(await new SupabasePhotosRepo(client).urlsFor('c1', ['p1', 'p2', 'p1'])).toEqual({ p1: 'https://x/c1/p1?t', p2: 'https://x/c1/p2?t' });
    expect(bucket.createSignedUrls).toHaveBeenCalledWith(['c1/p1', 'c1/p2'], SIGNED_URL_SECONDS);
  });

  it('lo que la base no deja leer (una foto fuera del área de juego) se queda sin enlace', async () => {
    const { client } = fakeDb([], { signed: { data: [{ signedUrl: 'https://x/c1/p1?t', error: null }, { signedUrl: null, error: 'Object not found' }], error: null } });
    expect(await new SupabasePhotosRepo(client).urlsFor('c1', ['p1', 'p2'])).toEqual({ p1: 'https://x/c1/p1?t' });
  });

  it('sin fotos no se pregunta nada', async () => {
    const { client, bucket } = fakeDb([]);
    expect(await new SupabasePhotosRepo(client).urlsFor('c1', [])).toEqual({});
    expect(bucket.createSignedUrls).not.toHaveBeenCalled();
  });
});
