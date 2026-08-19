import { supabase } from '@/shared/lib/supabaseClient';
import { SupabaseMapsRepo } from './infra/SupabaseMapsRepo';
import { HttpVisionAdapter } from './infra/HttpVisionAdapter';
import type { MapsPort } from './domain/ports/MapsPort';
import type { VisionPort } from './domain/ports/VisionPort';

/** Scenes, tokens, walls, drawings and the background library — `maps_*` under RLS + channel `scene:{id}`. */
export const mapsRepo: MapsPort = new SupabaseMapsRepo(supabase);
/** Vision and fog — computed by the API with every wall, because the browser only gets the ones it may see. */
export const visionPort: VisionPort = new HttpVisionAdapter();
