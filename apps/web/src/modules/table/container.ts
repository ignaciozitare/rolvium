import { supabase } from '@/shared/lib/supabaseClient';
import { campaignsRepo } from '@/modules/campaigns/container';
import { SupabaseTableRepo } from './infra/SupabaseTableRepo';
import type { TablePort } from './domain/ports/TablePort';

export const tableRepo: TablePort = new SupabaseTableRepo(supabase, campaignsRepo);
