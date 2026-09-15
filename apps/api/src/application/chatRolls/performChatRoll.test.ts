import { describe, it, expect } from 'vitest';
import { plenilunio } from '@rolvium/system-plenilunio';
import type { RollRequest, SheetData } from '@rolvium/core';
import type { ChatRollCommitInput, IChatRollRepository } from '../../domain/chatRoll/IChatRollRepository.js';
import { performChatRoll, type PerformChatRollDeps } from './performChatRoll.js';

const DM = '11111111-1111-4111-8111-111111111111';
const PLAYER = '22222222-2222-4222-8222-222222222222';
const STRANGER = '33333333-3333-4333-8333-333333333333';
const CAMP = '77777777-7777-4777-8777-777777777777';
const CHAR = '55555555-5555-4555-8555-555555555555';
const CONV = '66666666-6666-4666-8666-666666666666';

const karenSheet = (over: Record<string, unknown> = {}): SheetData => ({ ...plenilunio.newSheet(), combat: { value: 3, specialties: [] }, ...over });

const freeReq: RollRequest = { systemId: null, kind: 'free', title: '2D6', groups: [{ count: 2, sides: 6 }], visibility: 'table' };
const systemReq: RollRequest = { systemId: 'plenilunio', kind: 'system', title: 'Combate', groups: [{ count: 20, sides: 6, tag: 'own' }], options: { stat: 'combat' }, visibility: 'table', characterId: CHAR };

function fakeDeps(committed: ChatRollCommitInput[] = [], sheet: SheetData | null = karenSheet()): PerformChatRollDeps {
  const chatRolls: IChatRollRepository = {
    commit: async i => { committed.push(i); return { id: 'msg-1' }; },
    campaignOf: async (conv, actor) => (conv === CONV && (actor === PLAYER || actor === DM) ? CAMP : null),
  };
  return {
    chatRolls,
    characters: {
      findForActor: async (id, actor) => (id === CHAR && actor === PLAYER && sheet
        ? { id, campaignId: CAMP, systemId: 'plenilunio', ownerId: PLAYER, data: sheet, isOwner: true, isDm: false, isMember: true }
        : null),
      saveSheet: async () => undefined,
      isCampaignMember: async () => false,
      isCampaignDm: async () => false,
    },
    systemById: id => (id === 'plenilunio' ? plenilunio : null),
    rng: () => 1,
  };
}

describe('performChatRoll', () => {
  it('FORBIDDEN when the actor is not a participant of the conversation', async () => {
    const r = await performChatRoll(fakeDeps(), { actorId: STRANGER, conversationId: CONV, request: freeReq });
    expect(r).toEqual({ ok: false, code: 'FORBIDDEN' });
  });

  it('free roll: server dice, committed via chat_commit_roll with the resolved campaign, never dice_rolls', async () => {
    const committed: ChatRollCommitInput[] = [];
    const r = await performChatRoll(fakeDeps(committed), { actorId: PLAYER, conversationId: CONV, request: freeReq });
    expect(r.ok).toBe(true);
    expect(committed).toHaveLength(1);
    expect(committed[0]).toMatchObject({ actorId: PLAYER, conversationId: CONV, characterId: null, systemId: null, rollKind: 'free' });
    expect(committed[0]!.dice).toEqual([[1, 1]]);
  });

  it('system roll: rebuilds the pool from the sheet server-side, ignoring an inflated client group count', async () => {
    const committed: ChatRollCommitInput[] = [];
    const r = await performChatRoll(fakeDeps(committed), { actorId: PLAYER, conversationId: CONV, request: systemReq });
    expect(r.ok).toBe(true);
    // La ficha tiene Combate 3: el puñado de 20 del cliente se ignora, el servidor tira 3.
    expect(committed[0]!.dice[0]).toHaveLength(3);
    expect(committed[0]!.characterId).toBe(CHAR);
  });

  it('NOT_FOUND for an unknown character, FORBIDDEN for someone else\'s character', async () => {
    const missing = await performChatRoll(fakeDeps(), { actorId: PLAYER, conversationId: CONV, request: { ...systemReq, characterId: 'nope' } });
    expect(missing).toEqual({ ok: false, code: 'NOT_FOUND' });
    const strangerReq = { ...systemReq };
    const r = await performChatRoll(fakeDeps([], null), { actorId: PLAYER, conversationId: CONV, request: strangerReq });
    expect(r).toEqual({ ok: false, code: 'NOT_FOUND' });
  });

  it('SYSTEM_NOT_INSTALLED for an unknown systemId on a system roll', async () => {
    const r = await performChatRoll(fakeDeps(), { actorId: PLAYER, conversationId: CONV, request: { ...freeReq, kind: 'system', systemId: 'dnd5e' } });
    expect(r).toEqual({ ok: false, code: 'SYSTEM_NOT_INSTALLED' });
  });
});
