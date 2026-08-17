import { supabase } from '@/shared/lib/supabaseClient';
import { SupabaseCharactersRepo } from './infra/SupabaseCharactersRepo';
import { HttpRollsAdapter } from './infra/HttpRollsAdapter';
import type { CharactersPort } from './domain/ports/CharactersPort';
import type { RollsPort } from './domain/ports/RollsPort';

export const charactersRepo: CharactersPort = new SupabaseCharactersRepo(supabase);
/** Rolls go through the API (`POST /rolls`, dice H6). */
export const rollsPort: RollsPort = new HttpRollsAdapter();
