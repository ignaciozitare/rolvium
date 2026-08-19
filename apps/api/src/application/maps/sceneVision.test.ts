import { describe, it, expect } from 'vitest';
import { computeSceneVision, paintSceneFog, sightSegments, tokenOrigin, tokensOf } from './sceneVision.js';
import { pointInPolygon } from './vision.js';
import { fakeMapsRepo } from './fakeMapsRepo.js';

const SCENE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DM = 'u-dm', PIP = 'u-pip', NIX = 'u-nix';
const ROLES = { [DM]: 'dm' as const, [PIP]: 'player' as const, [NIX]: 'player' as const };
/** Pip's token stands on the left of the dividing wall, at cell (2, 5). */
const PIP_TOKEN = { id: 'tk-pip', x: 2, y: 5, size: 1, controlledBy: PIP };
const seed = (over = {}) => fakeMapsRepo({ roles: ROLES, tokens: [PIP_TOKEN], ...over });

describe('sightSegments', () => {
  it('keeps only what blocks sight and always adds the scene bounds', () => {
    const walls = [
      { id: 'wall', x1: 0, y1: 0, x2: 10, y2: 0, blocksSight: true, blocksMove: true, isOpen: false },
      { id: 'open-door', x1: 0, y1: 10, x2: 10, y2: 10, blocksSight: true, blocksMove: true, isOpen: true },
      { id: 'window', x1: 0, y1: 20, x2: 10, y2: 20, blocksSight: false, blocksMove: true, isOpen: false },
    ];
    expect(sightSegments(walls, { width: 100, height: 100 })).toHaveLength(1 + 4);
  });
});

describe('tokenOrigin / tokensOf', () => {
  it('centres the token on its cells and only keeps the ones the viewer controls', () => {
    expect(tokenOrigin({ x: 2, y: 5, size: 1 }, 27)).toEqual({ x: 67.5, y: 148.5 });
    expect(tokenOrigin({ x: 2, y: 5, size: 2 }, 27)).toEqual({ x: 81, y: 162 });
    expect(tokensOf([PIP_TOKEN, { ...PIP_TOKEN, id: 'x', controlledBy: NIX }], PIP)).toEqual([PIP_TOKEN]);
  });
});

describe('computeSceneVision', () => {
  it('rejects a scene that does not exist and a caller who is not a member', async () => {
    expect(await computeSceneVision({ maps: seed() }, { sceneId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', userId: PIP })).toEqual({ ok: false, code: 'NOT_FOUND' });
    expect(await computeSceneVision({ maps: seed() }, { sceneId: SCENE, userId: 'stranger' })).toEqual({ ok: false, code: 'FORBIDDEN' });
  });

  it('player: one polygon per own token, the wall keeps the far side dark, and what was seen is remembered', async () => {
    const maps = seed();
    const r = await computeSceneVision({ maps }, { sceneId: SCENE, userId: PIP });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.vision).toHaveLength(1);
    expect(pointInPolygon({ x: 60, y: 148 }, r.data.vision[0]!)).toBe(true);
    expect(pointInPolygon({ x: 220, y: 148 }, r.data.vision[0]!)).toBe(false);
    expect(r.data.explored.length).toBeGreaterThan(0);
    // every remembered cell is on the near side of the wall
    expect(r.data.explored.every(([cx]) => cx < 5)).toBe(true);
    expect(maps.fog[PIP]).toEqual(r.data.explored);
  });

  it('opening the door widens the same token’s vision past the wall', async () => {
    const open = seed({ walls: [{ id: 'w-1', x1: 135, y1: 0, x2: 135, y2: 270, blocksSight: true, blocksMove: true, isOpen: true }] });
    const r = await computeSceneVision({ maps: open }, { sceneId: SCENE, userId: PIP });
    if (!r.ok) throw new Error('expected ok');
    expect(pointInPolygon({ x: 220, y: 148 }, r.data.vision[0]!)).toBe(true);
  });

  it('a window never cuts sight even while closed', async () => {
    const win = seed({ walls: [{ id: 'w-1', x1: 135, y1: 0, x2: 135, y2: 270, blocksSight: false, blocksMove: true, isOpen: false }] });
    const r = await computeSceneVision({ maps: win }, { sceneId: SCENE, userId: PIP });
    if (!r.ok) throw new Error('expected ok');
    expect(pointInPolygon({ x: 220, y: 148 }, r.data.vision[0]!)).toBe(true);
  });

  it('night clips sight to night_radius_m and reports the radius in px', async () => {
    const night = seed({ scene: { lighting: 'night', nightRadiusM: 3 } });
    const r = await computeSceneVision({ maps: night }, { sceneId: SCENE, userId: PIP });
    if (!r.ok) throw new Error('expected ok');
    expect(r.data.radiusPx).toBeCloseTo((3 / 1.5) * 27);
    // the token sits at (67.5, 148.5) and 3 m ≈ 54 px: 100 px is still lit, 130 px is not (and no wall is in between)
    expect(pointInPolygon({ x: 100, y: 148 }, r.data.vision[0]!)).toBe(true);
    expect(pointInPolygon({ x: 130, y: 148 }, r.data.vision[0]!)).toBe(false);
  });

  it('a player with no token keeps what they had explored and sees nothing new', async () => {
    const maps = seed({ fog: { [NIX]: [[9, 9]] as [number, number][] } });
    const r = await computeSceneVision({ maps }, { sceneId: SCENE, userId: NIX });
    if (!r.ok) throw new Error('expected ok');
    expect(r.data.vision).toEqual([]);
    expect(r.data.explored).toEqual([[9, 9]]);
  });

  it('the DM gets no polygon and the union of what every player explored', async () => {
    const maps = seed({ fog: { [PIP]: [[1, 1]] as [number, number][], [NIX]: [[1, 1], [2, 2]] as [number, number][] } });
    const r = await computeSceneVision({ maps }, { sceneId: SCENE, userId: DM });
    if (!r.ok) throw new Error('expected ok');
    expect(r.data.vision).toEqual([]);
    expect(r.data.explored).toEqual([[1, 1], [2, 2]]);
  });

  it('manual fog computes nothing; off reveals the whole scene', async () => {
    const manual = seed({ scene: { fogMode: 'manual' }, fog: { [PIP]: [[0, 0]] as [number, number][] } });
    const m = await computeSceneVision({ maps: manual }, { sceneId: SCENE, userId: PIP });
    if (!m.ok) throw new Error('expected ok');
    expect(m.data).toMatchObject({ vision: [], explored: [[0, 0]] });

    const off = await computeSceneVision({ maps: seed({ scene: { fogMode: 'off' } }) }, { sceneId: SCENE, userId: PIP });
    if (!off.ok) throw new Error('expected ok');
    expect(off.data.explored).toHaveLength(100);
  });
});

describe('paintSceneFog', () => {
  it('only the DM may paint', async () => {
    expect(await paintSceneFog({ maps: seed() }, { sceneId: SCENE, userId: PIP, op: 'reveal', all: true })).toEqual({ ok: false, code: 'FORBIDDEN' });
  });

  it('«revelar todo» writes on EVERY player and answers with the DM union', async () => {
    const maps = seed();
    const r = await paintSceneFog({ maps }, { sceneId: SCENE, userId: DM, op: 'reveal', all: true });
    if (!r.ok) throw new Error('expected ok');
    expect(r.data.explored).toHaveLength(100);
    expect(maps.fog[PIP]).toHaveLength(100);
    expect(maps.fog[NIX]).toHaveLength(100);
  });

  it('the brush hides only the cells under it', async () => {
    const maps = seed();
    await paintSceneFog({ maps }, { sceneId: SCENE, userId: DM, op: 'reveal', all: true });
    const r = await paintSceneFog({ maps }, { sceneId: SCENE, userId: DM, op: 'hide', at: { x: 13.5, y: 13.5, radius: 20 } });
    if (!r.ok) throw new Error('expected ok');
    expect(maps.fog[PIP]!.some(([x, y]) => x === 0 && y === 0)).toBe(false);
    expect(maps.fog[PIP]!.some(([x, y]) => x === 9 && y === 9)).toBe(true);
  });
});
