import { supabase } from '@/shared/lib/supabaseClient';
import { SupabaseCharactersRepo } from './infra/SupabaseCharactersRepo';
import type { CharactersPort } from './domain/ports/CharactersPort';

export const charactersRepo: CharactersPort = new SupabaseCharactersRepo(supabase);
