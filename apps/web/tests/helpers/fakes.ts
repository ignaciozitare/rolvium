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
import type { Campaign, CreateCampaignInput } from '@/modules/campaigns/domain/entities/Campaign';

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

/** In-memory CampaignsPort. `mine`/`open` seed the lists; create/join mutate them. */
export function fakeCampaignsRepo(seed: { mine?: Campaign[]; open?: Campaign[]; joinResult?: Awaited<ReturnType<CampaignsPort['joinByCode']>> } = {}): CampaignsPort & { created: CreateCampaignInput[] } {
  const mine = [...(seed.mine ?? [])];
  const open = [...(seed.open ?? [])];
  const created: CreateCampaignInput[] = [];
  return {
    created,
    listMine: async () => mine,
    listOpen: async () => open,
    getById: async (id) => mine.find(c => c.id === id) ?? open.find(c => c.id === id) ?? null,
    listMembers: async () => [],
    create: async (input) => {
      created.push(input);
      const c: Campaign = { ...CAMPAIGN_MINE, id: `new-${created.length}`, name: input.name, systemId: input.systemId, visibility: input.visibility, seats: input.seats, inviteCode: 'LUNA-4F7K', playersCount: 0, myRole: 'dm', dmName: 'Yo' };
      mine.unshift(c);
      return c;
    },
    joinByCode: async () => seed.joinResult ?? { campaignId: 'c1' },
    requestJoin: async () => {},
    leave: async () => {},
    update: async () => {},
    getInviteCode: async () => 'LUNA-4F7K',
    regenerateInviteCode: async () => 'NEW1-CODE',
    archive: async () => {},
  };
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
