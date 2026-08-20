import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseMock } from '../../../../tests/helpers/supabaseMock';
import { SupabaseBestiaryRepo, TOKENS_BUCKET, mapEntryRow } from './SupabaseBestiaryRepo';

const ROW = {
  id: 'be-1', campaign_id: 'c1', owner_id: 'u-dm', system_id: 'plenilunio', origin: 'custom' as const,
  source_ref: 'ogre', name: 'Ogro con antorcha', token_url: null, notes: 'Lleva fuego',
  data: { stats: { fortitude: 8 }, endurance: 10, destiny: 0, protection: 3, abilities: ['Piel gruesa 3'], specialties: { combat: ['creature.garrote'] }, page: 152 },
};

const withUser = (client: Record<string, unknown>, uid: string | null = 'u-dm') =>
  ({ ...client, auth: { getUser: vi.fn().mockResolvedValue({ data: { user: uid ? { id: uid } : null } }) } });
const q = (m: ReturnType<typeof createSupabaseMock>, i = 0) => (m.client.from as ReturnType<typeof vi.fn>).mock.results[i]!.value as Record<string, ReturnType<typeof vi.fn>>;

describe('SupabaseBestiaryRepo — mapper', () => {
  it('pasa la fila a entidad y marca la entrada como editable', () => {
    expect(mapEntryRow(ROW)).toMatchObject({ id: 'be-1', origin: 'custom', name: 'Ogro con antorcha', sourceRef: 'ogre', campaignId: 'c1', editable: true });
  });

  /** Una fila guardada antes de que `data` tuviera especialidades no puede reventar el listado. */
  it('rellena los huecos de una fila vieja sin inventar características', () => {
    const e = mapEntryRow({ ...ROW, data: {}, notes: null as never });
    expect(e.data).toMatchObject({ stats: {}, endurance: 0, destiny: 0, protection: 0, abilities: [], specialties: {} });
    expect(e.data.page).toBeUndefined();
    expect(e.notes).toBe('');
  });

  it('una entrada global se reconoce por no tener campaña', () => {
    expect(mapEntryRow({ ...ROW, campaign_id: null }).campaignId).toBeNull();
  });
});

describe('SupabaseBestiaryRepo — listar', () => {
  /**
   * Lo que el director espera al abrir el bestiario dentro de una partida: las de ESA campaña y las que
   * guardó «para todas mis campañas». Si el `or` se perdiera, sus entradas globales desaparecerían de la
   * lista sin ningún error — se vería como «se me han borrado».
   */
  it('trae las de la campaña y las guardadas para todas', async () => {
    const m = createSupabaseMock({ tables: { bestiary_entries: { data: [ROW], error: null } } });
    const repo = new SupabaseBestiaryRepo(m.client as unknown as SupabaseClient);
    const list = await repo.listForCampaign('c1', 'plenilunio');
    expect(list).toHaveLength(1);
    expect(m.fromSpy).toHaveBeenCalledWith('bestiary_entries');
    expect(q(m).eq).toHaveBeenCalledWith('system_id', 'plenilunio');
    expect(q(m).or).toHaveBeenCalledWith('campaign_id.eq.c1,campaign_id.is.null');
  });

  /**
   * El id de campaña viene de la URL. `or()` lo pega tal cual dentro del lenguaje de filtros de PostgREST,
   * así que una coma dentro del valor añade condiciones a la consulta. Se corta antes de componer el filtro.
   */
  it('un id de campaña con sintaxis de filtro dentro no llega a la consulta', async () => {
    const m = createSupabaseMock({ tables: { bestiary_entries: { data: [ROW], error: null } } });
    const repo = new SupabaseBestiaryRepo(m.client as unknown as SupabaseClient);
    await expect(repo.listForCampaign('c1,owner_id.neq.null', 'plenilunio')).rejects.toThrow(/bad campaign id/);
    expect(m.fromSpy).not.toHaveBeenCalled();
  });

  it('un error de la base sube, no devuelve lista vacía', async () => {
    const m = createSupabaseMock({ tables: { bestiary_entries: { data: null, error: new Error('boom') } } });
    const repo = new SupabaseBestiaryRepo(m.client as unknown as SupabaseClient);
    await expect(repo.listForCampaign('c1', 'plenilunio')).rejects.toThrow('boom');
  });
});

describe('SupabaseBestiaryRepo — crear, editar, borrar', () => {
  /** La política exige `owner_id`: sin él el insert lo rechaza la base, no el navegador. */
  it('crear sella al director como dueño', async () => {
    const m = createSupabaseMock({ tables: { bestiary_entries: { data: ROW, error: null } } });
    const repo = new SupabaseBestiaryRepo(withUser(m.client) as unknown as SupabaseClient);
    await repo.create({ campaignId: 'c1', systemId: 'plenilunio', origin: 'custom', name: 'Ogro con antorcha', data: ROW.data, sourceRef: 'ogre' });
    expect(q(m).insert).toHaveBeenCalledWith(expect.objectContaining({ owner_id: 'u-dm', campaign_id: 'c1', system_id: 'plenilunio', origin: 'custom', source_ref: 'ogre' }));
  });

  it('sin sesión no se crea nada', async () => {
    const m = createSupabaseMock({ tables: { bestiary_entries: { data: ROW, error: null } } });
    const repo = new SupabaseBestiaryRepo(withUser(m.client, null) as unknown as SupabaseClient);
    await expect(repo.create({ campaignId: null, systemId: 'plenilunio', origin: 'custom', name: 'X', data: ROW.data })).rejects.toThrow(/no session/);
  });

  it('editar manda sólo lo que cambia', async () => {
    const m = createSupabaseMock({ tables: { bestiary_entries: { data: ROW, error: null } } });
    const repo = new SupabaseBestiaryRepo(m.client as unknown as SupabaseClient);
    await repo.update('be-1', { name: 'Otro nombre' });
    expect(q(m).update).toHaveBeenCalledWith({ name: 'Otro nombre' });
    expect(q(m).eq).toHaveBeenCalledWith('id', 'be-1');
  });

  /**
   * `null` en la campaña SIGNIFICA «todas mis campañas», así que tiene que viajar. Si se filtrara como
   * un campo vacío, mover una entrada a global se quedaría sin efecto y en silencio.
   */
  it('mover una entrada a «todas mis campañas» manda la campaña en blanco', async () => {
    const m = createSupabaseMock({ tables: { bestiary_entries: { data: { ...ROW, campaign_id: null }, error: null } } });
    const repo = new SupabaseBestiaryRepo(m.client as unknown as SupabaseClient);
    await repo.update('be-1', { campaignId: null });
    expect(q(m).update).toHaveBeenCalledWith({ campaign_id: null });
  });

  it('borrar va por id', async () => {
    const m = createSupabaseMock({ tables: { bestiary_entries: { data: null, error: null } } });
    const repo = new SupabaseBestiaryRepo(m.client as unknown as SupabaseClient);
    await repo.remove('be-1');
    expect(q(m).delete).toHaveBeenCalled();
    expect(q(m).eq).toHaveBeenCalledWith('id', 'be-1');
  });
});

describe('SupabaseBestiaryRepo — imagen del token', () => {
  /**
   * El nombre del fichero lo pone el cliente a partir del id de la entrada y un uuid, NUNCA el nombre que
   * traía el fichero del usuario: un nombre de fichero es entrada no fiable (specs/core/images).
   */
  it('sube al bucket de tokens con nombre propio y devuelve la URL pública', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://x/u-dm/bestiary/be-1/uuid.webp' } });
    const fromBucket = vi.fn().mockReturnValue({ upload, getPublicUrl });
    const m = createSupabaseMock();
    const repo = new SupabaseBestiaryRepo(withUser({ ...m.client, storage: { from: fromBucket } }) as unknown as SupabaseClient);

    const url = await repo.uploadToken('be-1', new Blob(['x'], { type: 'image/webp' }));

    expect(fromBucket).toHaveBeenCalledWith(TOKENS_BUCKET);
    const [path, , opts] = upload.mock.calls[0]!;
    expect(path).toMatch(/^u-dm\/bestiary\/be-1\/[0-9a-f-]{36}\.webp$/);
    expect(opts).toMatchObject({ contentType: 'image/webp', upsert: false });
    expect(url).toBe('https://x/u-dm/bestiary/be-1/uuid.webp');
  });

  /**
   * El respaldo de `compressImage` (navegador sin WebP) devuelve el ORIGINAL, así que no siempre sube un
   * WebP. Etiquetarlo a ciegas como WebP guardaría el fichero con un tipo que no es el suyo y el navegador
   * se lo comería mal al pintarlo.
   */
  it('respeta el tipo real del fichero en vez de decir siempre WebP', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const fromBucket = vi.fn().mockReturnValue({ upload, getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://x/a.png' } }) });
    const m = createSupabaseMock();
    const repo = new SupabaseBestiaryRepo(withUser({ ...m.client, storage: { from: fromBucket } }) as unknown as SupabaseClient);

    await repo.uploadToken('be-1', new Blob(['x'], { type: 'image/png' }));

    const [path, , opts] = upload.mock.calls[0]!;
    expect(path).toMatch(/\.png$/);
    expect(opts).toMatchObject({ contentType: 'image/png' });
  });

  /**
   * La política del bucket (`tokens_insert_own`) exige que la PRIMERA carpeta sea el id del usuario. Con la
   * entrada delante, Storage devuelve 403 y ninguna criatura puede tener foto. Es la misma forma que ya usa
   * `SupabaseCharactersRepo`, y se fija aquí porque el fallo no se ve hasta subir contra la base de verdad.
   */
  it('la ruta empieza por el id del usuario, que es lo que exige la política del bucket', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const fromBucket = vi.fn().mockReturnValue({ upload, getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://x/t.webp' } }) });
    const m = createSupabaseMock();
    const repo = new SupabaseBestiaryRepo(withUser({ ...m.client, storage: { from: fromBucket } }, 'u-otro') as unknown as SupabaseClient);

    await repo.uploadToken('be-1', new Blob(['x'], { type: 'image/webp' }));

    expect((upload.mock.calls[0]![0] as string).split('/')[0]).toBe('u-otro');
  });

  it('sin sesión no se sube nada', async () => {
    const fromBucket = vi.fn();
    const m = createSupabaseMock();
    const repo = new SupabaseBestiaryRepo(withUser({ ...m.client, storage: { from: fromBucket } }, null) as unknown as SupabaseClient);
    await expect(repo.uploadToken('be-1', new Blob(['x'], { type: 'image/webp' }))).rejects.toThrow(/no session/);
    expect(fromBucket).not.toHaveBeenCalled();
  });

  it('si la subida falla, el error sube', async () => {
    const fromBucket = vi.fn().mockReturnValue({ upload: vi.fn().mockResolvedValue({ error: new Error('too big') }), getPublicUrl: vi.fn() });
    const m = createSupabaseMock();
    const repo = new SupabaseBestiaryRepo(withUser({ ...m.client, storage: { from: fromBucket } }) as unknown as SupabaseClient);
    await expect(repo.uploadToken('be-1', new Blob(['x']))).rejects.toThrow('too big');
  });
});
