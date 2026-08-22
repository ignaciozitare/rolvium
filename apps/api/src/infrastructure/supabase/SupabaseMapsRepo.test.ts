import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseMapsRepo } from './SupabaseMapsRepo.js';

const SCENE_ROW = { id: 'sc-1', campaign_id: 'c1', width: 1080, height: 675, grid: { size: 27, visible: true }, fog_mode: 'vision', lighting: 'night', night_radius_m: 12, solid_walls: true };
const WALL_ROWS = [
  { id: 'w-1', x1: 0, y1: 0, x2: 10, y2: 0, blocks_sight: true, blocks_move: true, is_open: false },
  { id: 'w-2', x1: 0, y1: 9, x2: 10, y2: 9, blocks_sight: false, blocks_move: true, is_open: true },
];

/** Minimal chainable stub: `from(table)` → select/eq/maybeSingle/upsert; every table answers with what it was seeded. */
function fakeDb(rows: Record<string, unknown>) {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn((table: string) => {
    const data = rows[table] ?? null;
    const q: Record<string, unknown> = {};
    q.select = () => q;
    q.eq = () => q;
    q.maybeSingle = async () => ({ data: Array.isArray(data) ? data[0] ?? null : data, error: null });
    q.upsert = upsert;
    q.then = (resolve: (v: unknown) => unknown) => resolve({ data, error: null });
    return q;
  });
  return { db: { from } as unknown as SupabaseClient, upsert, from };
}

describe('SupabaseMapsRepo (service role)', () => {
  it('reads the scene with its light and grid, falling back to the default grid size', async () => {
    expect(await new SupabaseMapsRepo(fakeDb({ maps_scenes: SCENE_ROW }).db).getScene('sc-1'))
      .toEqual({ id: 'sc-1', campaignId: 'c1', width: 1080, height: 675, gridSize: 27, fogMode: 'vision', lighting: 'night', nightRadiusM: 12, solidWalls: true });
    expect((await new SupabaseMapsRepo(fakeDb({ maps_scenes: { ...SCENE_ROW, grid: null } }).db).getScene('sc-1'))?.gridSize).toBe(27);
    expect(await new SupabaseMapsRepo(fakeDb({}).db).getScene('nope')).toBeNull();
  });

  it('reads EVERY wall with its opening flags — that is what makes server-side vision a boundary', async () => {
    const walls = await new SupabaseMapsRepo(fakeDb({ maps_walls: WALL_ROWS }).db).listWalls('sc-1');
    expect(walls).toEqual([
      { id: 'w-1', x1: 0, y1: 0, x2: 10, y2: 0, blocksSight: true, blocksMove: true, isOpen: false },
      { id: 'w-2', x1: 0, y1: 9, x2: 10, y2: 9, blocksSight: false, blocksMove: true, isOpen: true },
    ]);
  });

  it('reads the table role and the player list from campaigns_members', async () => {
    expect(await new SupabaseMapsRepo(fakeDb({ campaigns_members: { role: 'dm' } }).db).roleOf('c1', 'u-dm')).toBe('dm');
    expect(await new SupabaseMapsRepo(fakeDb({}).db).roleOf('c1', 'u-x')).toBeNull();
    expect(await new SupabaseMapsRepo(fakeDb({ campaigns_members: [{ user_id: 'u-pip' }, { user_id: 'u-nix' }] }).db).listPlayerIds('c1')).toEqual(['u-pip', 'u-nix']);
  });

  it('explored cells: keeps well-formed pairs only, and upserts on (scene, user)', async () => {
    const junk = { maps_fog: { explored: [[1, 2], 'nope', [3], [4, 5, 6], [7, 8]] } };
    expect(await new SupabaseMapsRepo(fakeDb(junk).db).getExplored('sc-1', 'u-pip')).toEqual([[1, 2], [7, 8]]);
    expect(await new SupabaseMapsRepo(fakeDb({ maps_fog: null }).db).getExplored('sc-1', 'u-pip')).toEqual([]);
    expect(await new SupabaseMapsRepo(fakeDb({ maps_fog: [{ explored: [[0, 0]] }, { explored: [[1, 1]] }] }).db).listExplored('sc-1')).toEqual([[[0, 0]], [[1, 1]]]);

    const { db, upsert } = fakeDb({});
    await new SupabaseMapsRepo(db).saveExplored('sc-1', 'c1', 'u-pip', [[0, 0]]);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ scene_id: 'sc-1', user_id: 'u-pip', campaign_id: 'c1', explored: [[0, 0]] }), { onConflict: 'scene_id,user_id' });
  });

  it('reads only what vision needs from a token', async () => {
    const tokens = await new SupabaseMapsRepo(fakeDb({ maps_tokens: [{ id: 'tk', x: 2, y: 5, size: 1, controlled_by: 'u-pip' }] }).db).listTokens('sc-1');
    expect(tokens).toEqual([{ id: 'tk', x: 2, y: 5, size: 1, controlledBy: 'u-pip' }]);
  });
});
