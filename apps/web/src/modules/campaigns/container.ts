import { supabase } from '@/shared/lib/supabaseClient';
import { SupabaseCampaignsRepo } from './infra/SupabaseCampaignsRepo';
import type { CampaignsPort } from './domain/ports/CampaignsPort';

export const campaignsRepo: CampaignsPort = new SupabaseCampaignsRepo(supabase);
