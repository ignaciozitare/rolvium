import { describe, it, expect } from 'vitest';
import { canEditCharacter, characterAvatar, groupByCampaign, isUnassigned } from './characterRules';
import type { Character } from '../entities/Character';

const base = (o: Partial<Character>): Character => ({ id: 'x', campaignId: 'c1', campaignName: 'C1', systemId: 'plenilunio', ownerId: 'u1', ownerName: 'Pip', kind: 'pc', name: 'N', concept: null, avatarUrl: null, tokenUrl: null, color: null, data: {}, derived: {}, health: null, xp: 0, archivedAt: null, createdAt: '', updatedAt: '', ...o });

describe('characterRules', () => {
  it('avatar precedence: own → owner account → null (initials)', () => {
    expect(characterAvatar({ avatarUrl: 'own.png' }, 'acc.png')).toBe('own.png');
    expect(characterAvatar({ avatarUrl: null }, 'acc.png')).toBe('acc.png');
    expect(characterAvatar({ avatarUrl: null }, null)).toBeNull();
  });
  it('edit rights: owner or DM', () => {
    expect(canEditCharacter({ ownerId: 'u1' }, 'u1', false)).toBe(true);
    expect(canEditCharacter({ ownerId: 'u1' }, 'u2', false)).toBe(false);
    expect(canEditCharacter({ ownerId: 'u1' }, 'u2', true)).toBe(true);
    expect(canEditCharacter({ ownerId: null }, null, false)).toBe(false);
  });
  it('unassigned = pc without owner', () => {
    expect(isUnassigned({ ownerId: null, kind: 'pc' })).toBe(true);
    expect(isUnassigned({ ownerId: null, kind: 'npc' })).toBe(false);
  });
  it('groups by campaign preserving first-seen order', () => {
    const g = groupByCampaign([base({ id: 'a', campaignId: 'c2', campaignName: 'C2' }), base({ id: 'b' }), base({ id: 'c', campaignId: 'c2', campaignName: 'C2' })]);
    expect(g.map(x => [x.campaignId, x.characters.length])).toEqual([['c2', 2], ['c1', 1]]);
  });
});
