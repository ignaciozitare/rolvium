import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseCombatRepo } from './SupabaseCombatRepo.js';
import type { OpenCombatInput } from '../../domain/combat/ICombatRepository.js';

const INPUT: OpenCombatInput = {
  actorId: 'dm1', campaignId: 'c1', sceneId: 'sc1',
  slots: [
    { tokenId: 'tk-karen', characterId: 'ch1', name: 'Karen' },
    { tokenId: 'tk-ogro', characterId: null, name: 'Ogro' },
  ],
};

const rpcDb = (result: { data?: unknown; error?: { message: string } | null }) => {
  const rpc = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  return { db: { rpc } as unknown as SupabaseClient, rpc };
};
const selectDb = (result: { data?: unknown; error?: { message: string } | null }) => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  return { db: { from: vi.fn().mockReturnValue({ select }) } as unknown as SupabaseClient, select, eq };
};

describe('SupabaseCombatRepo', () => {
  it('abre por `dice_open_combat` pasando los puestos EN ORDEN, y devuelve el id', async () => {
    const { db, rpc } = rpcDb({ data: 'kmb-1' });
    expect(await new SupabaseCombatRepo(db).open(INPUT)).toEqual({ id: 'kmb-1' });
    expect(rpc).toHaveBeenCalledWith('dice_open_combat', {
      actor: 'dm1', cid: 'c1', sid: 'sc1',
      slots: [
        { tokenId: 'tk-karen', characterId: 'ch1', name: 'Karen' },
        { tokenId: 'tk-ogro', characterId: null, name: 'Ogro' },
      ],
    });
  });

  it('pasa turno por `dice_next_turn` y lee la posición y la ronda que devuelve SQL', async () => {
    const { db, rpc } = rpcDb({ data: { position: 0, round: 3 } });
    expect(await new SupabaseCombatRepo(db).next('kmb-1', 'dm1')).toEqual({ position: 0, round: 3 });
    expect(rpc).toHaveBeenCalledWith('dice_next_turn', { kid: 'kmb-1', actor: 'dm1' });
  });

  /** Posición 0 es la primera, no «vacío»: leerla como falsy pondría a todo el mundo a empezar de nuevo. */
  it('la posición 0 se lee como 0', async () => {
    const { db } = rpcDb({ data: { position: 0, round: 1 } });
    expect((await new SupabaseCombatRepo(db).next('kmb-1', 'dm1')).position).toBe(0);
  });

  it('cierra por `dice_close_combat`', async () => {
    const { db, rpc } = rpcDb({});
    await new SupabaseCombatRepo(db).close('kmb-1', 'dm1');
    expect(rpc).toHaveBeenCalledWith('dice_close_combat', { kid: 'kmb-1', actor: 'dm1' });
  });

  it('adelanta por `dice_advance_turn` y devuelve la posición nueva', async () => {
    const { db, rpc } = rpcDb({ data: 2 });
    expect(await new SupabaseCombatRepo(db).advance('kmb-1', 'u1', 'slot-1')).toBe(2);
    expect(rpc).toHaveBeenCalledWith('dice_advance_turn', { kid: 'kmb-1', actor: 'u1', slot: 'slot-1' });
  });

  it('lee un puesto y traduce los nombres de columna', async () => {
    const { db } = selectDb({ data: { id: 's1', combat_id: 'kmb-1', campaign_id: 'c1', position: 3, character_id: 'ch1' } });
    expect(await new SupabaseCombatRepo(db).findSlot('s1')).toEqual({ id: 's1', combatId: 'kmb-1', campaignId: 'c1', position: 3, characterId: 'ch1' });
  });

  it('un puesto que no existe es null, no un error', async () => {
    const { db } = selectDb({ data: null });
    expect(await new SupabaseCombatRepo(db).findSlot('nope')).toBeNull();
  });

  /**
   * Los errores de las funciones SQL llegan como texto y hay que traducirlos: sin esto, «uno activo por
   * escena» o «no puedes saltarte a quien actúa» saldrían como un 500 en vez de decir qué pasó.
   */
  it('traduce los errores de SQL a códigos que el caso de uso entiende', async () => {
    const cases: [string, string][] = [
      ['combat_active', 'COMBAT_ACTIVE'],
      ['cannot_advance', 'CANNOT_ADVANCE'],
      ['not_active', 'NOT_ACTIVE'],
      ['not_dm', 'FORBIDDEN'],
      ['not_owner', 'FORBIDDEN'],
      ['not_scene', 'FORBIDDEN'],
      ['algo raro', 'DB_ERROR'],
    ];
    for (const [message, code] of cases) {
      const { db } = rpcDb({ error: { message } });
      await expect(new SupabaseCombatRepo(db).open(INPUT)).rejects.toMatchObject({ code });
    }
  });
});
