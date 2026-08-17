import { supabase } from '@/shared/lib/supabaseClient';
import { SupabaseIdentityRepo } from './infra/SupabaseIdentityRepo';
import { HttpInviteAdapter } from './infra/HttpInviteAdapter';
import type { IdentityPort } from './domain/ports/IdentityPort';
import type { InvitePort } from './domain/ports/InvitePort';
import { campaignsRepo } from '@/modules/campaigns/container';
import type { CampaignsPort } from '@/modules/campaigns/domain/ports/CampaignsPort';

export interface IdentityDeps {
  identity: IdentityPort;
  invites: InvitePort;
  /** Joining is the campaigns hexagon's job — reached through its port, never its infra. */
  joinByCode: CampaignsPort['joinByCode'];
}

export const identityDeps: IdentityDeps = {
  identity: new SupabaseIdentityRepo(supabase),
  invites: new HttpInviteAdapter(),
  joinByCode: (code) => campaignsRepo.joinByCode(code),
};
