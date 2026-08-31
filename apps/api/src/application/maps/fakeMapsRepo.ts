import type { FogCell } from '@rolvium/core';
import type { IMapsRepository, LayerRecord, LightRecord, SceneRecord, ScenePropRecord, TableRole, TokenRecord, WallRecord } from '../../domain/maps/IMapsRepository.js';

export interface FakeMapsSeed {
  scene?: Partial<SceneRecord>;
  walls?: WallRecord[];
  tokens?: TokenRecord[];
  lights?: LightRecord[];
  layers?: LayerRecord[];
  props?: ScenePropRecord[];
  roles?: Record<string, TableRole>;
  fog?: Record<string, FogCell[]>;
}

/** In-memory `maps_*` for the API tests: a 270×270 scene on a 27 px grid, cut in two by a wall at x = 135. */
export function fakeMapsRepo(seed: FakeMapsSeed = {}): IMapsRepository & { fog: Record<string, FogCell[]>; scene: SceneRecord } {
  const scene: SceneRecord = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', campaignId: '77777777-7777-4777-8777-777777777777',
    width: 270, height: 270, gridSize: 27, fogMode: 'vision', lighting: 'day', nightRadiusM: 10, solidWalls: false, ...seed.scene,
  };
  const walls = seed.walls ?? [{ id: 'w-1', x1: 135, y1: 0, x2: 135, y2: 270, blocksSight: true, blocksMove: true, isOpen: false }];
  const tokens = seed.tokens ?? [];
  const lights = seed.lights ?? [];
  const layers = seed.layers ?? [];
  const props = seed.props ?? [];
  const roles = seed.roles ?? {};
  const fog: Record<string, FogCell[]> = { ...seed.fog };
  return {
    scene, fog,
    getScene: async id => (id === scene.id ? scene : null),
    listWalls: async () => walls,
    listTokens: async () => tokens,
    listLights: async () => lights,
    listLayers: async () => layers,
    listSightBlockingProps: async () => props.filter(p => p.blocksSight),
    roleOf: async (cid, uid) => (cid === scene.campaignId ? roles[uid] ?? null : null),
    listPlayerIds: async () => Object.entries(roles).filter(([, r]) => r === 'player').map(([id]) => id),
    getExplored: async (_s, uid) => fog[uid] ?? [],
    listExplored: async () => Object.values(fog),
    saveExplored: async (_s, _c, uid, cells) => { fog[uid] = cells; },
  };
}
