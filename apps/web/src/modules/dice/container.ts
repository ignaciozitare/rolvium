import { supabase } from '@/shared/lib/supabaseClient';
import { HttpRollsAdapter } from './infra/HttpRollsAdapter';
import { SupabaseRollLogRepo } from './infra/SupabaseRollLogRepo';
import type { RollsPort } from './domain/ports/RollsPort';
import type { RollLogPort } from './domain/ports/RollLogPort';

/** Rolls go through the API (`POST /rolls`: server dice, immutable log, sheet effects). */
export const rollsPort: RollsPort = new HttpRollsAdapter();
/** The Registro reads `dice_rolls` under RLS and follows inserts live. */
export const rollLog: RollLogPort = new SupabaseRollLogRepo(supabase);
