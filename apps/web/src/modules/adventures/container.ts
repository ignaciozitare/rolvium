import { supabase } from '@/shared/lib/supabaseClient';
import { SupabaseAdventuresRepo } from './infra/SupabaseAdventuresRepo';
import type { AdventuresPort } from './domain/ports/AdventuresPort';

export const adventuresPort: AdventuresPort = new SupabaseAdventuresRepo(supabase);
