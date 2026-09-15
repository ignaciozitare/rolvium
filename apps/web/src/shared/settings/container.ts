import { supabase } from '@/shared/lib/supabaseClient';
import { SupabaseCompressionLevels } from './SupabaseCompressionLevels';
import type { CompressionLevelsPort } from './CompressionLevelsPort';

/**
 * 🧲 El nivel de compresión de imágenes por tipo, que pone un admin en Ajustes PARA TODOS: una fila de
 * `app_settings`. Leen todos; escribe sólo quien tiene `admin.manage_settings` (RLS).
 */
export const compressionLevelsRepo: CompressionLevelsPort = new SupabaseCompressionLevels(supabase);
