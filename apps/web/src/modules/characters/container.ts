import { supabase } from '@/shared/lib/supabaseClient';
import { SupabaseCharactersRepo } from './infra/SupabaseCharactersRepo';
import type { CharactersPort } from './domain/ports/CharactersPort';

export const charactersRepo: CharactersPort = new SupabaseCharactersRepo(supabase);
/** Rolls belong to the `dice` hexagon; the sheet only needs its port. */
export { rollsPort } from '@/modules/dice/container';
