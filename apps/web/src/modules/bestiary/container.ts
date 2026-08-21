import { supabase } from '@/shared/lib/supabaseClient';
import { SupabaseBestiaryRepo } from './infra/SupabaseBestiaryRepo';
import type { BestiaryPort } from './domain/ports/BestiaryPort';

/** Entradas propias del director — `bestiary_entries` bajo RLS (sólo él las ve, ni siquiera las de un aliado). */
export const bestiaryRepo: BestiaryPort = new SupabaseBestiaryRepo(supabase);
