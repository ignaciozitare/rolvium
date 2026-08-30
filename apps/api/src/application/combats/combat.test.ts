import { describe, it, expect } from 'vitest';
import { plenilunio } from '@rolvium/system-plenilunio';
import type { CombatSlot, ICombatRepository, OpenCombatInput } from '../../domain/combat/ICombatRepository.js';
import { advanceTurn, applyTiebreak, closeCombat, nextTurn, openCombat } from './combat.js';

const DM = '11111111-1111-4111-8111-111111111111';
const PLAYER = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const CAMP = '77777777-7777-4777-8777-777777777777';
const SCENE = '88888888-8888-4888-8888-888888888888';
const KAREN = '55555555-5555-4555-8555-555555555555';
const MARTA = '66666666-6666-4666-8666-666666666666';
const COMBAT = '99999999-9999-4999-8999-999999999999';
const SLOT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const sheetOf = (over: Record<string, unknown> = {}) =>
  ({ ...plenilunio.newSheet(), combat: { value: 4, specialties: [] }, destiny: 3, fortune: 2, ...over });

/** Las fichas de la mesa, con su dueño: de ahí sale quién es «personaje jugador» para el desempate. */
const CHARS: Record<string, { ownerId: string; data: Record<string, unknown> }> = {
  [KAREN]: { ownerId: PLAYER, data: sheetOf({ destiny: 5, combat: { value: 3, specialties: [] } }) },
  [MARTA]: { ownerId: OTHER, data: sheetOf({ destiny: 5, combat: { value: 6, specialties: [] } }) },
};

const fakeCombats = (over: Partial<ICombatRepository> = {}, slot: Partial<CombatSlot> = {}) => {
  const opened: OpenCombatInput[] = [];
  const repo: ICombatRepository = {
    open: async i => { opened.push(i); return { id: COMBAT }; },
    next: async () => ({ position: 1, round: 1 }),
    close: async () => undefined,
    advance: async () => 2,
    findSlot: async id => ({ id, combatId: COMBAT, campaignId: CAMP, position: 3, characterId: KAREN, ...slot }),
    ...over,
  };
  return { repo, opened };
};

const deps = (combats: ICombatRepository, saved: Record<string, unknown>[] = []) => ({
  combats,
  characters: {
    findForActor: async (id: string, actor: string) => {
      const c = CHARS[id];
      if (!c) return null;
      return { id, campaignId: CAMP, systemId: 'plenilunio', ownerId: c.ownerId, data: c.data, isOwner: c.ownerId === actor, isDm: actor === DM, isMember: true };
    },
    saveSheet: async (_id: string, _actor: string, patch: { data: Record<string, unknown> }) => { saved.push(patch.data); },
    isCampaignMember: async () => false,
    isCampaignDm: async (cid: string, actor: string) => cid === CAMP && actor === DM,
  },
  systemById: (id: string) => (id === 'plenilunio' ? plenilunio : null),
});

const creature = (key: string, destiny: number, combat: number) =>
  ({ key, tokenId: null, characterId: null, name: key, stats: { destiny, combat } });

describe('applyTiebreak', () => {
  it('reordena SÓLO dentro del grupo empatado, sin tocar el resto', () => {
    const r = applyTiebreak(['a', 'b', 'c', 'd'], [['b', 'c']], ['c', 'b']);
    expect(r.order).toEqual(['a', 'c', 'b', 'd']);
    expect(r.pending).toEqual([]);
  });

  /**
   * Con dos de tres, el tercero seguiría colocado por el orden de llegada — y eso no lo ha decidido nadie.
   * El grupo sigue pendiente entero: es lo que hace que el servidor no acabe colando un orden inventado.
   */
  it('un grupo que el desempate no cubre ENTERO sigue pendiente', () => {
    const r = applyTiebreak(['a', 'b', 'c'], [['a', 'b', 'c']], ['c', 'a']);
    expect(r.pending).toEqual([['a', 'b', 'c']]);
    expect(r.order).toEqual(['a', 'b', 'c']);
  });

  it('con varios grupos, resuelve los que puede y deja pendientes los que no', () => {
    const r = applyTiebreak(['a', 'b', 'c', 'd'], [['a', 'b'], ['c', 'd']], ['b', 'a']);
    expect(r.order).toEqual(['b', 'a', 'c', 'd']);
    expect(r.pending).toEqual([['c', 'd']]);
  });
});

describe('openCombat', () => {
  it('sólo el director abre el combate', async () => {
    const { repo } = fakeCombats();
    const r = await openCombat(deps(repo), { actorId: PLAYER, campaignId: CAMP, sceneId: SCENE, systemId: 'plenilunio', candidates: [creature('ogro', 4, 4)] });
    expect(r).toEqual({ ok: false, code: 'FORBIDDEN' });
  });

  it('el SERVIDOR pone el orden con la regla del sistema, no quien llama', async () => {
    const { repo, opened } = fakeCombats();
    const r = await openCombat(deps(repo), {
      actorId: DM, campaignId: CAMP, sceneId: SCENE, systemId: 'plenilunio',
      // Llegan a propósito en el orden contrario al que manda el Destino.
      candidates: [creature('hambriento', 1, 3), creature('ogro', 4, 4), { key: 'karen', tokenId: null, characterId: KAREN, name: 'Karen' }],
    });
    expect(r).toEqual({ ok: true, data: { id: COMBAT, order: ['karen', 'ogro', 'hambriento'] } });
    // Y lo que se guarda es ESE orden, no el de llegada.
    expect(opened[0]!.slots.map(s => s.name)).toEqual(['Karen', 'ogro', 'hambriento']);
  });

  /**
   * La ficha de un personaje la lee el servidor de la base: lo que venga en `stats` para un puesto CON
   * personaje se ignora. Si no, quien llama se colocaría el primero diciendo que tiene Destino 99.
   */
  it('los valores que manda el cliente NO cuentan para un personaje: manda su ficha', async () => {
    const { repo } = fakeCombats();
    const r = await openCombat(deps(repo), {
      actorId: DM, campaignId: CAMP, sceneId: SCENE, systemId: 'plenilunio',
      candidates: [{ key: 'karen', tokenId: null, characterId: KAREN, name: 'Karen', stats: { destiny: 99 } }, creature('ogro', 7, 4)],
    });
    // Karen tiene Destino 5 en su ficha: el ogro (7) va antes, pese al 99 que mandaron.
    expect(r.ok && r.data.order).toEqual(['ogro', 'karen']);
  });

  /**
   * El final de la regla (p.92): el sistema no desempata dos criaturas con el mismo Destino y ahí decide el
   * director. El servidor NO abre el combate a medias — devuelve el empate para que se lo pregunten.
   */
  it('se NIEGA a abrir mientras haya empates que el manual deja al director', async () => {
    const { repo, opened } = fakeCombats();
    const r = await openCombat(deps(repo), {
      actorId: DM, campaignId: CAMP, sceneId: SCENE, systemId: 'plenilunio',
      candidates: [creature('ogro', 4, 9), creature('harpia', 4, 3)],
    });
    expect(r).toEqual({ ok: false, code: 'UNDECIDED', undecided: [['ogro', 'harpia']] });
    expect(opened).toHaveLength(0);
  });

  it('con el desempate del director, el combate se abre en el orden que él eligió', async () => {
    const { repo, opened } = fakeCombats();
    const r = await openCombat(deps(repo), {
      actorId: DM, campaignId: CAMP, sceneId: SCENE, systemId: 'plenilunio',
      candidates: [creature('ogro', 4, 9), creature('harpia', 4, 3)],
      tiebreak: ['harpia', 'ogro'],
    });
    expect(r.ok && r.data.order).toEqual(['harpia', 'ogro']);
    expect(opened[0]!.slots.map(s => s.name)).toEqual(['harpia', 'ogro']);
  });

  /** Quién es «personaje jugador» se deduce de quién lo lleva: el que abre es el director. */
  it('dos PJ empatados a Destino los desempata su Combate (p.92)', async () => {
    const { repo } = fakeCombats();
    const r = await openCombat(deps(repo), {
      actorId: DM, campaignId: CAMP, sceneId: SCENE, systemId: 'plenilunio',
      candidates: [{ key: 'karen', tokenId: null, characterId: KAREN, name: 'Karen' }, { key: 'marta', tokenId: null, characterId: MARTA, name: 'Marta' }],
    });
    // Los dos con Destino 5; Marta tiene Combate 6 y Karen 3.
    expect(r.ok && r.data.order).toEqual(['marta', 'karen']);
  });

  it('un sistema que no está instalado no abre nada', async () => {
    const { repo } = fakeCombats();
    const r = await openCombat(deps(repo), { actorId: DM, campaignId: CAMP, sceneId: SCENE, systemId: 'otro', candidates: [creature('x', 1, 1)] });
    expect(r).toEqual({ ok: false, code: 'SYSTEM_NOT_INSTALLED' });
  });

  it('un combate ya activo en esa escena sube tal cual', async () => {
    const { repo } = fakeCombats({ open: async () => { throw Object.assign(new Error('combat_active'), { code: 'COMBAT_ACTIVE' }); } });
    const r = await openCombat(deps(repo), { actorId: DM, campaignId: CAMP, sceneId: SCENE, systemId: 'plenilunio', candidates: [creature('x', 1, 1)] });
    expect(r).toEqual({ ok: false, code: 'COMBAT_ACTIVE' });
  });
});

describe('nextTurn · closeCombat', () => {
  it('pasar turno devuelve la posición y la ronda', async () => {
    const { repo } = fakeCombats({ next: async () => ({ position: 0, round: 2 }) });
    expect(await nextTurn(deps(repo), { actorId: DM, combatId: COMBAT })).toEqual({ ok: true, data: { position: 0, round: 2 } });
  });

  it('quien no dirige no pasa turno ni cierra', async () => {
    const boom = () => { throw Object.assign(new Error('not_active'), { code: 'FORBIDDEN' }); };
    const { repo } = fakeCombats({ next: async () => boom(), close: async () => boom() });
    expect(await nextTurn(deps(repo), { actorId: PLAYER, combatId: COMBAT })).toEqual({ ok: false, code: 'FORBIDDEN' });
    expect(await closeCombat(deps(repo), { actorId: PLAYER, combatId: COMBAT })).toEqual({ ok: false, code: 'FORBIDDEN' });
  });
});

describe('advanceTurn — adelantarse cuesta 1 Fortuna (p.89 · p.92)', () => {
  it('gana un puesto y paga un punto de su Fortuna', async () => {
    const saved: Record<string, unknown>[] = [];
    const { repo } = fakeCombats({ advance: async () => 2 });
    const r = await advanceTurn(deps(repo, saved), { actorId: PLAYER, combatId: COMBAT, slotId: SLOT });
    expect(r).toEqual({ ok: true, data: { position: 2, fortune: 1 } });
    expect(saved[0]!['fortune']).toBe(1);
  });

  /** Sin Fortuna no se adelanta, y —lo que importa— tampoco se mueve el puesto. */
  it('sin Fortuna no se adelanta NI se toca el orden', async () => {
    let moved = false;
    const { repo } = fakeCombats({ advance: async () => { moved = true; return 2; } });
    const sinFortuna = { ...CHARS[KAREN]!, data: sheetOf({ destiny: 5, fortune: 0 }) };
    const d = deps(repo);
    d.characters.findForActor = async (id: string, actor: string) => (id === KAREN
      ? { id, campaignId: CAMP, systemId: 'plenilunio', ownerId: sinFortuna.ownerId, data: sinFortuna.data, isOwner: sinFortuna.ownerId === actor, isDm: false, isMember: true }
      : null);
    expect(await advanceTurn(d, { actorId: PLAYER, combatId: COMBAT, slotId: SLOT })).toEqual({ ok: false, code: 'NO_FORTUNE' });
    expect(moved).toBe(false);
  });

  it('sólo el DUEÑO del personaje del puesto se adelanta', async () => {
    const { repo } = fakeCombats();
    expect(await advanceTurn(deps(repo), { actorId: OTHER, combatId: COMBAT, slotId: SLOT })).toEqual({ ok: false, code: 'FORBIDDEN' });
  });

  /** Un puesto de criatura no se adelanta: las criaturas no llevan Fortuna en su bloque. */
  it('un puesto sin personaje no se adelanta', async () => {
    const { repo } = fakeCombats({}, { characterId: null });
    expect(await advanceTurn(deps(repo), { actorId: PLAYER, combatId: COMBAT, slotId: SLOT })).toEqual({ ok: false, code: 'FORBIDDEN' });
  });

  it('un puesto de OTRO combate no vale', async () => {
    const { repo } = fakeCombats({}, { combatId: 'otro' });
    expect(await advanceTurn(deps(repo), { actorId: PLAYER, combatId: COMBAT, slotId: SLOT })).toEqual({ ok: false, code: 'NOT_FOUND' });
  });

  /** El que ya actuó o está actuando no se puede saltar: lo dice SQL y aquí sólo se traduce. */
  it('no se puede saltar por encima de quien está actuando', async () => {
    const { repo } = fakeCombats({ advance: async () => { throw Object.assign(new Error('cannot_advance'), { code: 'CANNOT_ADVANCE' }); } });
    const saved: Record<string, unknown>[] = [];
    expect(await advanceTurn(deps(repo, saved), { actorId: PLAYER, combatId: COMBAT, slotId: SLOT })).toEqual({ ok: false, code: 'CANNOT_ADVANCE' });
    // Y no se le ha cobrado nada por un adelanto que no ocurrió.
    expect(saved).toHaveLength(0);
  });
});
