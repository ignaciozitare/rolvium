import { vi } from 'vitest';
import type { Role, User } from '@rolvium/shared-types';
import type { IAuthRepository } from '@/modules/auth/domain/ports/IAuthRepository';
import type { AdminDeps } from '@/modules/admin/container';

export const ROLE_ADMIN: Role = { id: 'r-admin', name: 'admin', description: 'Full access', isSystem: true, permissions: { modules: [], admin: { manage_users: true, manage_roles: true, manage_settings: true } }, createdAt: '' };
export const ROLE_GM: Role = { id: 'r-gm', name: 'game_master', description: 'Runs games', isSystem: true, permissions: { modules: [], admin: {} }, createdAt: '' };
export const ROLE_PLAYER: Role = { id: 'r-player', name: 'player', description: 'Default', isSystem: true, permissions: { modules: [], admin: {} }, createdAt: '' };

export const ADMIN_USER: User = { id: 'u-admin', name: 'Root', email: 'root@rolvium.test', avatarUrl: null, alias: null, locale: 'es', themePref: 'system', roleId: ROLE_ADMIN.id, role: 'admin', permissions: ROLE_ADMIN.permissions, active: true, createdAt: '' };
export const PLAYER_USER: User = { id: 'u-pip', name: 'Pip', email: 'pip@rolvium.test', avatarUrl: null, alias: null, locale: 'es', themePref: 'system', roleId: ROLE_PLAYER.id, role: 'player', permissions: ROLE_PLAYER.permissions, active: true, createdAt: '' };

export function fakeAuthRepo(user: User | null = null, over: Partial<IAuthRepository> = {}): IAuthRepository {
  return {
    signInWithPassword: vi.fn().mockResolvedValue({ user }),
    signOut: vi.fn().mockResolvedValue(undefined),
    getCurrentUser: vi.fn().mockResolvedValue(user),
    onAuthStateChange: vi.fn().mockReturnValue(() => undefined),
    ...over,
  };
}

export function fakeAdminDeps(over: Partial<AdminDeps> = {}): AdminDeps {
  const roles = [ROLE_ADMIN, ROLE_GM, ROLE_PLAYER];
  const users = [ADMIN_USER, PLAYER_USER];
  return {
    roleRepo: {
      findAll: vi.fn().mockResolvedValue(roles),
      create: vi.fn().mockImplementation(async (i: { name: string; description: string }) => ({ id: `r-${i.name}`, ...i, isSystem: false, permissions: { modules: [], admin: {} }, createdAt: '' })),
      remove: vi.fn().mockResolvedValue(undefined),
      updatePermissions: vi.fn().mockResolvedValue(undefined),
      updateDescription: vi.fn().mockResolvedValue(undefined),
    },
    userRepo: {
      findAll: vi.fn().mockResolvedValue(users),
      updateRole: vi.fn().mockResolvedValue(undefined),
      updateActive: vi.fn().mockResolvedValue(undefined),
    },
    userAdmin: {
      createUser: vi.fn().mockImplementation(async (i: { name: string; email: string; roleId: string }) => ({ ...PLAYER_USER, id: 'u-new', name: i.name, email: i.email, roleId: i.roleId })),
      setPassword: vi.fn().mockResolvedValue(undefined),
      deleteUser: vi.fn().mockResolvedValue(undefined),
    },
    ...over,
  };
}

// ── campaigns ────────────────────────────────────────────────────────────────
import type { CampaignsPort } from '@/modules/campaigns/domain/ports/CampaignsPort';
import type { Campaign, CampaignMember, CreateCampaignInput, JoinRequest } from '@/modules/campaigns/domain/entities/Campaign';

export const CAMPAIGN_MINE: Campaign = {
  id: 'c1', name: 'Las noches de Queens', description: 'Nueva York tras el Colapso.', systemId: 'plenilunio', systemVersion: '0.1.0',
  dmId: 'dm-1', dmName: 'Laura', visibility: 'invite', seats: 5, inviteCode: null, progressionEnabled: false, playersCount: 3,
  nextSessionAt: null, lastSessionAt: null, archivedAt: null, createdAt: '2026-08-17T00:00:00Z', myRole: 'player', myCharacterId: null,
};
export const CAMPAIGN_OPEN: Campaign = {
  ...CAMPAIGN_MINE, id: 'c3', name: 'Sangre en el asfalto', dmId: 'dm-2', dmName: 'Rubén', visibility: 'open', playersCount: 2,
  myRole: undefined as unknown as Campaign['myRole'],
};
delete (CAMPAIGN_OPEN as { myRole?: unknown }).myRole;
/** The same campaign seen by its DM (Laura). */
export const CAMPAIGN_DM: Campaign = { ...CAMPAIGN_MINE, id: 'c2', name: 'El sótano de la catedral', dmId: 'u-gm', dmName: 'Laura', myRole: 'dm', playersCount: 2 };
export const MEMBER_DM: CampaignMember = { campaignId: 'c2', userId: 'u-gm', name: 'Laura', avatarUrl: null, role: 'dm', characterId: null, joinedAt: '2026-08-17T00:00:00Z' };
export const MEMBER_PIP: CampaignMember = { campaignId: 'c2', userId: 'u-pip', name: 'Pip', avatarUrl: null, role: 'player', characterId: 'ch-karen', joinedAt: '2026-08-17T01:00:00Z' };
export const MEMBER_DANI: CampaignMember = { campaignId: 'c2', userId: 'u-nix', name: 'Dani', avatarUrl: null, role: 'player', characterId: null, joinedAt: '2026-08-17T02:00:00Z' };
export const REQUEST_MARTA: JoinRequest = { id: 'rq-1', campaignId: 'c2', userId: 'u-marta', name: 'Marta', avatarUrl: null, message: 'Juego los martes', status: 'pending', createdAt: '2026-08-17T03:00:00Z' };

/** In-memory CampaignsPort. `mine`/`open` seed the lists; create/join mutate them; DM actions are recorded. */
export function fakeCampaignsRepo(seed: { mine?: Campaign[]; open?: Campaign[]; members?: CampaignMember[]; requests?: JoinRequest[]; joinResult?: Awaited<ReturnType<CampaignsPort['joinByCode']>> } = {}): CampaignsPort & { created: CreateCampaignInput[]; updates: { id: string; patch: Parameters<CampaignsPort['update']>[1] }[]; resolved: { id: string; accept: boolean }[]; removed: string[]; left: string[]; archived: string[]; regenerated: number } {
  const mine = [...(seed.mine ?? [])];
  const open = [...(seed.open ?? [])];
  const members = (seed.members ?? []).map(m => ({ ...m }));
  const requests = (seed.requests ?? []).map(r => ({ ...r }));
  const created: CreateCampaignInput[] = [];
  const updates: { id: string; patch: Parameters<CampaignsPort['update']>[1] }[] = [];
  const resolved: { id: string; accept: boolean }[] = [];
  const removed: string[] = [];
  const left: string[] = [];
  const archived: string[] = [];
  const api = {
    created, updates, resolved, removed, left, archived, regenerated: 0,
    listMine: async () => [...mine],
    listOpen: async () => [...open],
    getById: async (id: string) => mine.find(c => c.id === id) ?? open.find(c => c.id === id) ?? null,
    listMembers: async (cid: string) => members.filter(m => m.campaignId === cid),
    create: async (input: CreateCampaignInput) => {
      created.push(input);
      const c: Campaign = { ...CAMPAIGN_MINE, id: `new-${created.length}`, name: input.name, systemId: input.systemId, visibility: input.visibility, seats: input.seats, inviteCode: 'LUNA-4F7K', playersCount: 0, myRole: 'dm', dmName: 'Yo' };
      mine.unshift(c);
      return c;
    },
    joinByCode: async () => seed.joinResult ?? { campaignId: 'c1' },
    requestJoin: async () => {},
    leave: async (cid: string) => { left.push(cid); const i = mine.findIndex(c => c.id === cid); if (i >= 0) mine.splice(i, 1); },
    update: async (id: string, patch: Parameters<CampaignsPort['update']>[1]) => { updates.push({ id, patch }); const c = mine.find(x => x.id === id); if (c) Object.assign(c, patch); },
    getInviteCode: async () => 'LUNA-4F7K',
    regenerateInviteCode: async () => { api.regenerated += 1; return 'NEW1-CODE'; },
    archive: async (id: string) => { archived.push(id); const i = mine.findIndex(c => c.id === id); if (i >= 0) mine.splice(i, 1); },
    listRequests: async (cid: string) => requests.filter(r => r.campaignId === cid && r.status === 'pending'),
    resolveRequest: async (id: string, accept: boolean) => {
      resolved.push({ id, accept });
      const r = requests.find(x => x.id === id);
      if (!r) return;
      r.status = accept ? 'accepted' : 'rejected';
      if (accept) members.push({ campaignId: r.campaignId, userId: r.userId, name: r.name, avatarUrl: r.avatarUrl, role: 'player', characterId: null, joinedAt: new Date().toISOString() });
    },
    removeMember: async (cid: string, uid: string) => { removed.push(uid); const i = members.findIndex(m => m.campaignId === cid && m.userId === uid); if (i >= 0) members.splice(i, 1); },
  };
  return api;
}

// ── identity ─────────────────────────────────────────────────────────────────
import type { IdentityDeps } from '@/modules/identity/container';
import type { DeviceSession, InvitePreview } from '@/modules/identity/domain/entities/Identity';

export const INVITE_PREVIEW: InvitePreview = { code: 'LUNA-4F7K', campaignName: 'Las ruinas de Manhattan', systemId: 'plenilunio', dmName: 'Ignacio', seatsFree: 4 };
export const SESSION_CURRENT: DeviceSession = { id: 's-cur', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605 Version/17 Safari/605.1', ip: '10.0.0.1', createdAt: '2026-08-17T10:00:00Z', lastSeenAt: new Date().toISOString(), isCurrent: true };
export const SESSION_OTHER: DeviceSession = { id: 's-ipad', userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0) AppleWebKit/605 Version/17 Safari/605.1', ip: '10.0.0.2', createdAt: '2026-08-16T10:00:00Z', lastSeenAt: new Date(Date.now() - 3 * 60_000).toISOString(), isCurrent: false };

/** In-memory IdentityDeps. Every method is a vi.fn so tests can assert calls. */
export function fakeIdentityDeps(over: { identity?: Partial<IdentityDeps['identity']>; invites?: Partial<IdentityDeps['invites']>; joinByCode?: IdentityDeps['joinByCode'] } = {}): IdentityDeps {
  return {
    identity: {
      signUp: vi.fn().mockResolvedValue({ status: 'signed_in' }),
      requestPasswordReset: vi.fn().mockResolvedValue(undefined),
      updatePassword: vi.fn().mockResolvedValue({}),
      updateProfile: vi.fn().mockResolvedValue(undefined),
      uploadAvatar: vi.fn().mockResolvedValue('https://x/avatars/u/avatar.png?v=1'),
      removeAvatar: vi.fn().mockResolvedValue(undefined),
      listSessions: vi.fn().mockResolvedValue([SESSION_OTHER, SESSION_CURRENT]),
      revokeSession: vi.fn().mockResolvedValue(undefined),
      ...over.identity,
    },
    invites: { preview: vi.fn().mockResolvedValue(INVITE_PREVIEW), ...over.invites },
    joinByCode: over.joinByCode ?? vi.fn().mockResolvedValue({ campaignId: 'c1' }),
  };
}

// ── characters ───────────────────────────────────────────────────────────────
import type { CharactersPort } from '@/modules/characters/domain/ports/CharactersPort';
import type { RollInput, RollsPort } from '@/modules/dice/domain/ports/RollsPort';
import type { RollLogPort } from '@/modules/dice/domain/ports/RollLogPort';
import type { Roll, RollOutcome } from '@/modules/dice/domain/entities/Roll';
import type { Character, CharacterAuditEntry, CharacterPatch, CreateCharacterInput, WriteOrigin } from '@/modules/characters/domain/entities/Character';
import type { RollResult, SheetData } from '@rolvium/core';
import { plenilunio } from '@rolvium/system-plenilunio';

/** A finished Plenilunio sheet (Karen «K», the design's sample character). */
export const KAREN_DATA: SheetData = {
  ...plenilunio.newSheet(), name: 'Karen «K»', player: 'Pip', concept: 'Líder de banda', size: 'medium', preset: 'standard',
  fortitude: { value: 4, specialties: ['fortitude.vigour'] }, combat: { value: 4, specialties: ['combat.improvisedWeapons'] }, will: { value: 3, specialties: ['will.courage'] },
  cunning: { value: 3, specialties: ['cunning.streetwise'] }, subtlety: { value: 2, specialties: ['subtlety.ambush'] }, presence: { value: 5, specialties: ['presence.leadership'] }, culture: { value: 1, specialties: ['culture.legends'] },
  destiny: 2, fortune: 2, resistance: 21, health: 'healthy', xp: 24, armour: 'leatherJacket',
  weapons: [{ id: 'bat', ammo: null }, { id: 'magnum44', ammo: 6 }], gifts: [{ id: 'titanFury', level: 1 }], equipment: [{ id: 'dynamoTorch' }, { id: 'ductTape' }],
  story: 'Creció entre los escombros del Bronx.',
};
export const CHARACTER_KAREN: Character = {
  id: 'ch-karen', campaignId: 'c1', campaignName: 'Las noches de Queens', systemId: 'plenilunio', ownerId: PLAYER_USER.id, ownerName: 'Pip', kind: 'pc',
  name: 'Karen «K»', concept: 'Líder de banda', avatarUrl: null, tokenUrl: null, color: null, data: KAREN_DATA, derived: plenilunio.engine.derived(KAREN_DATA),
  health: 'healthy', xp: 24, archivedAt: null, createdAt: '2026-08-17T00:00:00Z', updatedAt: '2026-08-17T00:00:00Z',
};
export const CHARACTER_UNASSIGNED: Character = {
  ...CHARACTER_KAREN, id: 'ch-nix', ownerId: null, ownerName: null, name: 'Nix', concept: 'Chatarrera', xp: 0,
  data: { ...KAREN_DATA, name: 'Nix', concept: 'Chatarrera', xp: 0 },
};
export const CHARACTER_OTHER: Character = {
  ...CHARACTER_KAREN, id: 'ch-elias', ownerId: 'u-nix', ownerName: 'Dani', name: 'Elías Vance', concept: 'Predicador armado', health: 'wounded',
  data: { ...KAREN_DATA, name: 'Elías Vance', concept: 'Predicador armado', health: 'wounded', resistance: 13 },
};

/** In-memory CharactersPort. Mutations are recorded so tests can assert persistence + audit origin. */
export function fakeCharactersRepo(seed: Character[] = [CHARACTER_KAREN]): CharactersPort & { list: Character[]; updates: { id: string; patch: CharacterPatch; origin: WriteOrigin | undefined }[]; created: CreateCharacterInput[]; claimed: string[] } {
  const list = seed.map(c => ({ ...c }));
  const updates: { id: string; patch: CharacterPatch; origin: WriteOrigin | undefined }[] = [];
  const created: CreateCharacterInput[] = [];
  const claimed: string[] = [];
  return {
    list, updates, created, claimed,
    listMine: async () => list.filter(c => c.ownerId === PLAYER_USER.id),
    listByCampaign: async (cid) => list.filter(c => c.campaignId === cid),
    getById: async (id) => list.find(c => c.id === id) ?? null,
    create: async (input) => {
      created.push(input);
      const c: Character = { ...CHARACTER_KAREN, id: `new-${created.length}`, campaignId: input.campaignId, name: input.name, concept: input.concept ?? null, kind: input.kind ?? 'pc',
        ownerId: input.ownerId === undefined ? PLAYER_USER.id : input.ownerId, data: input.data, derived: input.derived ?? {}, health: input.health ?? null, xp: 0 };
      list.push(c); return c;
    },
    saveSheet: async (id, patch, origin) => { updates.push({ id, patch, origin }); return { derived: patch.derived ?? {}, health: patch.health ?? null }; },
    update: async (id, patch, origin) => {
      updates.push({ id, patch, origin });
      const i = list.findIndex(c => c.id === id);
      if (i >= 0) list[i] = { ...list[i]!, ...patch, data: patch.data ?? list[i]!.data } as Character;
    },
    claim: async (id) => { claimed.push(id); const c = list.find(x => x.id === id); if (c) c.ownerId = PLAYER_USER.id; },
    remove: async (id) => { const i = list.findIndex(c => c.id === id); if (i >= 0) list.splice(i, 1); },
    listAudit: async () => [] as CharacterAuditEntry[],
    uploadImage: async () => 'https://x/tokens/u/avatar.png',
  };
}

/**
 * RollsPort that echoes a fixed result and records requests. `outcome` overrides the API extras
 * (`effectsApplied`, `sheet`) so views can be tested against the server-applied path.
 */
export function fakeRollsPort(result: RollResult | null = { summary: 'roll.degree.success.2', total: 2 }, outcome: Partial<RollOutcome> = {}): RollsPort & { requests: RollInput[] } {
  const requests: RollInput[] = [];
  return {
    requests,
    roll: async (req) => {
      requests.push(req);
      if (!result) return null;
      const dice = req.groups.map(g => Array.from({ length: g.count }, (_, i) => 1 + ((i * 3) % g.sides)));
      return { id: `roll-${requests.length}`, request: req, dice, result, rolledAt: '2026-08-18T00:00:00Z', ...outcome };
    },
  };
}

// ── dice ─────────────────────────────────────────────────────────────────────
/** Karen's opposed Combat roll from the design (7—1, a Destiny die triumph → +1 Destino). */
export const ROLL_COMBAT: Roll = {
  id: 'roll-combat', campaignId: 'c1', characterId: 'ch-karen', characterName: 'Karen Sinclair', authorId: PLAYER_USER.id, authorName: 'Karen «K»', authorAvatarUrl: null, systemId: 'plenilunio', kind: 'system',
  title: 'sheet.stats.combat',
  request: { systemId: 'plenilunio', kind: 'system', title: 'sheet.stats.combat', groups: [{ count: 4, sides: 6, tag: 'own' }, { count: 2, sides: 6, tag: 'destiny' }, { count: 2, sides: 6, tag: 'opposition' }], options: { stat: 'combat', specialty: true }, sharedResources: { destiny: 2 }, visibility: 'table' },
  dice: [[5, 6, 2, 4], [6, 3], [4, 1]],
  result: { summary: 'roll.degree.success.absolute', total: 6, detail: { ownHits: 4, destinyHits: 3, oppositionHits: 1, difference: 6, degree: 'roll.degree.success.absolute' }, effects: { destinyUp: true, fortuneRefill: true, patch: { destiny: 3, fortune: 3 } } },
  visibility: 'table', correctsId: null, createdAt: '2026-08-18T21:03:00Z',
};
/** Elías' failed Cunning roll with a setback (0—2, «Revés»). */
export const ROLL_SETBACK: Roll = {
  ...ROLL_COMBAT, id: 'roll-setback', characterId: 'ch-elias', characterName: 'Elías Vance', authorId: 'u-nix', authorName: 'Nix', title: 'sheet.stats.cunning',
  request: { systemId: 'plenilunio', kind: 'system', title: 'sheet.stats.cunning', groups: [{ count: 2, sides: 6, tag: 'own' }, { count: 2, sides: 6, tag: 'opposition' }], options: { stat: 'cunning' }, visibility: 'dm' },
  dice: [[1, 3], [5, 4]],
  result: { summary: 'roll.summary.setback', total: -2, detail: { ownHits: 0, destinyHits: 0, oppositionHits: 2, difference: -2, setback: true }, effects: { setback: true } },
  visibility: 'dm', createdAt: '2026-08-18T21:04:00Z',
};
/** Nix's free 2D10 = 13. */
export const ROLL_FREE: Roll = {
  ...ROLL_COMBAT, id: 'roll-free', characterId: null, characterName: null, authorId: 'u-nix2', authorName: 'Nix', systemId: null, kind: 'free', title: '2D10',
  request: { systemId: null, kind: 'free', title: '2D10', groups: [{ count: 2, sides: 10 }], visibility: 'table' },
  dice: [[6, 7]], result: { summary: 'roll.free', total: 13, detail: {} }, visibility: 'table', createdAt: '2026-08-18T21:05:00Z',
};

/** In-memory RollLogPort; `push(roll)` simulates a live insert to every subscriber. */
export function fakeRollLog(seed: Roll[] = [ROLL_COMBAT, ROLL_SETBACK, ROLL_FREE]): RollLogPort & { rolls: Roll[]; push: (r: Roll) => void; subscribers: number } {
  const rolls = [...seed];
  const listeners = new Set<(r: Roll) => void>();
  const api = {
    rolls,
    get subscribers() { return listeners.size; },
    push: (r: Roll) => { rolls.unshift(r); listeners.forEach(l => l(r)); },
    listRecent: async (cid: string, limit = 50) => rolls.filter(r => r.campaignId === cid).slice(0, limit),
    subscribe: (_cid: string, on: (r: Roll) => void) => { listeners.add(on); return () => { listeners.delete(on); }; },
  };
  return api;
}

// ── maps ─────────────────────────────────────────────────────────────────────
import type { MapsPort, MapsLiveEvent, MapsLiveHandlers } from '@/modules/maps/domain/ports/MapsPort';
import type { SceneVision, VisionPort } from '@/modules/maps/domain/ports/VisionPort';
import type { Drawing, ImageAsset, NewDrawing, NewToken, NewWall, RowChange, Scene, ScenePatch, Token, TokenPatch, Wall, WallPatch } from '@/modules/maps/domain/entities/Scene';

export const SCENE_WAREHOUSE: Scene = {
  id: 'sc-1', campaignId: 'c1', name: 'Almacén de Queens', width: 1080, height: 675, bgColor: '#4a4a3e', bgImageUrl: null,
  bgTransform: { mode: 'cover', x: 0, y: 0, scale: 1 }, grid: { size: 27, visible: true }, fogMode: 'vision', lighting: 'day', nightRadiusM: 10, sortOrder: 0, visiblePlayers: false,
  createdAt: '2026-08-18T00:00:00Z', updatedAt: '2026-08-18T00:00:00Z',
};
export const SCENE_CHAPEL: Scene = { ...SCENE_WAREHOUSE, id: 'sc-2', name: 'Capilla sin techo', sortOrder: 1, bgImageUrl: 'https://x/backgrounds/c1/chapel.png', bgColor: '#1a1a1a' };
export const SCENE_TUNNELS: Scene = { ...SCENE_WAREHOUSE, id: 'sc-3', name: 'Túneles de servicio', sortOrder: 2, visiblePlayers: true };
/** Karen's token: Pip controls it. */
export const TOKEN_KAREN: Token = { id: 'tk-karen', sceneId: 'sc-1', campaignId: 'c1', characterId: 'ch-karen', bestiaryRef: null, bestiaryEntryId: null, name: 'Karen «K»', imageUrl: null, x: 10, y: 11, size: 1, color: '#6e2418', visible: true, controlledBy: PLAYER_USER.id, visionRadius: null, state: {} };
export const TOKEN_ELIAS: Token = { ...TOKEN_KAREN, id: 'tk-elias', characterId: 'ch-elias', name: 'Elías Vance', x: 8, y: 12, color: '#3a3a26', controlledBy: 'u-nix' };
/** A hidden mutant placed by the DM (players never receive it). */
export const TOKEN_MUTANT: Token = { ...TOKEN_KAREN, id: 'tk-mut', characterId: null, bestiaryRef: 'mutant', name: 'Mutante', x: 20, y: 9, color: null, visible: false, controlledBy: null, state: { resistance: 12 } };
export const WALL_1: Wall = { id: 'w-1', sceneId: 'sc-1', campaignId: 'c1', x1: 270, y1: 216, x2: 270, y2: 540, visiblePlayers: false, kind: 'wall', blocksSight: true, blocksMove: true, isOpen: false };
export const WALL_VISIBLE: Wall = { ...WALL_1, id: 'w-2', x1: 270, y1: 540, x2: 540, y2: 540, visiblePlayers: true };
/** A closed door across the corridor: cuts sight and movement until the DM opens it. */
export const WALL_DOOR: Wall = { ...WALL_1, id: 'w-door', x1: 540, y1: 216, x2: 540, y2: 324, kind: 'door' };
/** A window: never cuts sight, only movement (spec § «Puertas y ventanas»). */
export const WALL_WINDOW: Wall = { ...WALL_1, id: 'w-win', x1: 600, y1: 216, x2: 700, y2: 216, kind: 'window', blocksSight: false };
export const DRAWING_MINE: Drawing = { id: 'd-1', sceneId: 'sc-1', campaignId: 'c1', authorId: PLAYER_USER.id, kind: 'stroke', data: { points: [[300, 300], [340, 280], [380, 300]] }, color: '#c9a84c', width: 2, createdAt: '2026-08-18T00:00:00Z' };
export const DRAWING_OTHER: Drawing = { ...DRAWING_MINE, id: 'd-2', authorId: 'u-nix', kind: 'rect', data: { x1: 450, y1: 500, x2: 510, y2: 540 }, color: '#b8452c' };
export const IMAGE_CHAPEL: ImageAsset = { id: 'img-1', campaignId: 'c1', name: 'Capilla', url: 'https://x/backgrounds/c1/chapel.png', createdAt: '2026-08-18T00:00:00Z' };
export const IMAGE_MARKET: ImageAsset = { id: 'img-2', campaignId: 'c1', name: 'Mercado', url: 'https://x/backgrounds/c1/market.png', createdAt: '2026-08-18T00:00:00Z' };

/**
 * In-memory MapsPort. Mutations are recorded; `emit(sceneId, …)` simulates realtime rows/events to subscribers;
 * `broadcasts` collects what I sent on the scene channel.
 */
export function fakeMapsRepo(seed: { scenes?: Scene[]; tokens?: Token[]; walls?: Wall[]; drawings?: Drawing[]; images?: ImageAsset[] } = {}) {
  const scenes = (seed.scenes ?? [SCENE_WAREHOUSE]).map(s => ({ ...s }));
  const tokens = (seed.tokens ?? []).map(t => ({ ...t }));
  const walls = (seed.walls ?? []).map(w => ({ ...w }));
  const drawings = (seed.drawings ?? []).map(d => ({ ...d }));
  const images = (seed.images ?? []).map(i => ({ ...i }));
  const subs = new Map<string, Set<MapsLiveHandlers>>();
  const broadcasts: { sceneId: string; event: MapsLiveEvent }[] = [];
  const tokenUpdates: { id: string; patch: TokenPatch }[] = [];
  const sceneUpdates: { id: string; patch: ScenePatch }[] = [];
  const wallUpdates: { id: string; patch: WallPatch }[] = [];
  const wallMoves: { id: string; at: { x1: number; y1: number; x2: number; y2: number } }[] = [];
  const activated: (string | null)[] = [];
  const removedDrawings: string[] = [];
  const clearedMine: string[] = [];
  const clearedAll: string[] = [];
  const uploads: { campaignId: string; name: string }[] = [];
  let n = 0;
  const api = {
    scenes, tokens, walls, drawings, images, broadcasts, tokenUpdates, sceneUpdates, wallUpdates, wallMoves, activated, removedDrawings, clearedMine, clearedAll, uploads,
    get subscribers() { return [...subs.values()].reduce((a, s) => a + s.size, 0); },
    emit: (sceneId: string, what: { token?: RowChange<Token>; wall?: RowChange<Wall>; drawing?: RowChange<Drawing>; scene?: RowChange<Scene>; event?: MapsLiveEvent }) => {
      subs.get(sceneId)?.forEach(h => { if (what.token) h.onToken?.(what.token); if (what.wall) h.onWall?.(what.wall); if (what.drawing) h.onDrawing?.(what.drawing); if (what.scene) h.onScene?.(what.scene); if (what.event) h.onEvent?.(what.event); });
    },
    listScenes: async (cid: string) => scenes.filter(s => s.campaignId === cid),
    getScene: async (id: string) => scenes.find(s => s.id === id) ?? null,
    createScene: async (input: { campaignId: string; name: string; sortOrder?: number }) => { const s: Scene = { ...SCENE_WAREHOUSE, id: `sc-new-${++n}`, campaignId: input.campaignId, name: input.name, sortOrder: input.sortOrder ?? scenes.length, bgImageUrl: null }; scenes.push(s); return s; },
    updateScene: async (id: string, patch: ScenePatch) => { sceneUpdates.push({ id, patch }); const s = scenes.find(x => x.id === id); if (s) Object.assign(s, patch); },
    removeScene: async (id: string) => { const i = scenes.findIndex(s => s.id === id); if (i >= 0) scenes.splice(i, 1); },
    setActiveScene: async (_cid: string, sceneId: string | null) => { activated.push(sceneId); },
    listImages: async (cid: string) => images.filter(i => i.campaignId === cid),
    uploadImage: async (campaignId: string, _file: Blob, name: string) => { uploads.push({ campaignId, name }); const img: ImageAsset = { id: `img-new-${++n}`, campaignId, name, url: `https://x/backgrounds/${campaignId}/${name}.png`, createdAt: '' }; images.unshift(img); return img; },
    removeImage: async (id: string) => { const i = images.findIndex(x => x.id === id); if (i >= 0) images.splice(i, 1); },
    listWalls: async (sid: string) => walls.filter(w => w.sceneId === sid),
    addWall: async (w: NewWall) => { const created: Wall = { ...w, id: `w-new-${++n}` }; walls.push(created); return created; },
    updateWall: async (id: string, patch: WallPatch) => { wallUpdates.push({ id, patch }); const w = walls.find(x => x.id === id); if (w) Object.assign(w, patch); },
    updateWallGeometry: async (id: string, at: { x1: number; y1: number; x2: number; y2: number }) => { wallMoves.push({ id, at }); const w = walls.find(x => x.id === id); if (w) Object.assign(w, at); },
    removeWall: async (id: string) => { const i = walls.findIndex(w => w.id === id); if (i >= 0) walls.splice(i, 1); },
    listTokens: async (sid: string) => tokens.filter(t => t.sceneId === sid),
    addToken: async (t: NewToken) => { const created: Token = { ...t, id: `tk-new-${++n}` }; tokens.push(created); return created; },
    updateToken: async (id: string, patch: TokenPatch) => { tokenUpdates.push({ id, patch }); const t = tokens.find(x => x.id === id); if (t) Object.assign(t, patch); },
    removeToken: async (id: string) => { const i = tokens.findIndex(t => t.id === id); if (i >= 0) tokens.splice(i, 1); },
    listDrawings: async (sid: string) => drawings.filter(d => d.sceneId === sid),
    addDrawing: async (d: NewDrawing) => { const created: Drawing = { ...d, id: `d-new-${++n}`, authorId: PLAYER_USER.id, createdAt: '' }; drawings.push(created); return created; },
    removeDrawing: async (id: string) => { removedDrawings.push(id); const i = drawings.findIndex(d => d.id === id); if (i >= 0) drawings.splice(i, 1); },
    removeMyDrawings: async (sid: string) => { clearedMine.push(sid); for (let i = drawings.length - 1; i >= 0; i--) if (drawings[i]!.sceneId === sid && drawings[i]!.authorId === PLAYER_USER.id) drawings.splice(i, 1); },
    removeAllDrawings: async (sid: string) => { clearedAll.push(sid); for (let i = drawings.length - 1; i >= 0; i--) if (drawings[i]!.sceneId === sid) drawings.splice(i, 1); },
    subscribe: (sid: string, h: MapsLiveHandlers) => { const set = subs.get(sid) ?? new Set<MapsLiveHandlers>(); set.add(h); subs.set(sid, set); return () => { set.delete(h); }; },
    broadcast: (sceneId: string, event: MapsLiveEvent) => { broadcasts.push({ sceneId, event }); },
  } satisfies MapsPort & Record<string, unknown>;
  return api;
}

/** A polygon covering the left half of `SCENE_WAREHOUSE`, as if a wall at x = 540 cut the sight. */
export const VISION_LEFT: SceneVision['vision'] = [[[0, 0], [540, 0], [540, 675], [0, 675]]];
export const EXPLORED_2x2: SceneVision['explored'] = [[0, 0], [0, 1], [1, 0], [1, 1]];

/**
 * In-memory VisionPort. Vision is computed by the API in production, so the fake just hands back what it was
 * seeded with and records every call — the browser must never derive it.
 */
export function fakeVisionPort(seed: Partial<SceneVision> = {}) {
  const state: SceneVision = { vision: VISION_LEFT, explored: EXPLORED_2x2, radiusPx: null, ...seed };
  const calls: { op: string; sceneId: string; at?: unknown }[] = [];
  return {
    state, calls,
    refresh: async (sceneId: string) => { calls.push({ op: 'refresh', sceneId }); return { ...state }; },
    paint: async (sceneId: string, op: 'reveal' | 'hide', at: { x: number; y: number; radius: number }) => { calls.push({ op, sceneId, at }); return { ...state }; },
    paintAll: async (sceneId: string, op: 'reveal' | 'hide') => { calls.push({ op: `${op}All`, sceneId }); return { ...state }; },
  } satisfies VisionPort & Record<string, unknown>;
}
