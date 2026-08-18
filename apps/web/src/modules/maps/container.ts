import { supabase } from '@/shared/lib/supabaseClient';
import { SupabaseMapsRepo } from './infra/SupabaseMapsRepo';
import type { MapsPort } from './domain/ports/MapsPort';

/** Scenes, tokens, walls, drawings and the background library — `maps_*` under RLS + channel `scene:{id}`. */
export const mapsRepo: MapsPort = new SupabaseMapsRepo(supabase);
