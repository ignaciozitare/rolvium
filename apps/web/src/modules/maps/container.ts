import { supabase } from '@/shared/lib/supabaseClient';
import { SupabaseMapsRepo } from './infra/SupabaseMapsRepo';
import { HttpVisionAdapter } from './infra/HttpVisionAdapter';
import { LocalViewMemory } from './infra/LocalViewMemory';
import { SupabaseToolbarOrder } from './infra/SupabaseToolbarOrder';
import type { MapsPort } from './domain/ports/MapsPort';
import type { VisionPort } from './domain/ports/VisionPort';
import type { ViewMemoryPort } from './domain/ports/ViewMemoryPort';
import type { ToolbarOrderPort } from './domain/ports/ToolbarOrderPort';

/** Scenes, tokens, walls, drawings and the background library — `maps_*` under RLS + channel `scene:{id}`. */
export const mapsRepo: MapsPort = new SupabaseMapsRepo(supabase);
/** Vision and fog — computed by the API with every wall, because the browser only gets the ones it may see. */
export const visionPort: VisionPort = new HttpVisionAdapter();
/**
 * Dónde tenía puesto el ojo el director. Vive en SU navegador y no la ve nadie: no es la escena activa de la
 * mesa, es sólo para que una recarga le devuelva a la misma escena.
 */
export const viewMemory: ViewMemoryPort = new LocalViewMemory();
/**
 * 🧲 El orden de la barra de herramientas, que pone el admin PARA TODOS: una fila de `app_settings`. Leen todos;
 * escribe sólo quien tiene `admin.manage_settings` (RLS).
 */
export const toolbarOrder: ToolbarOrderPort = new SupabaseToolbarOrder(supabase);
