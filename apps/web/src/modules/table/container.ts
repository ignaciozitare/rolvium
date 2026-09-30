import { supabase } from '@/shared/lib/supabaseClient';
import { campaignsRepo } from '@/modules/campaigns/container';
import { SupabaseTableRepo } from './infra/SupabaseTableRepo';
import type { TablePort } from './domain/ports/TablePort';
import { localTableLayout } from './infra/LocalTableLayout';
import type { LayoutMemoryPort } from './domain/ports/LayoutMemoryPort';

export const tableRepo: TablePort = new SupabaseTableRepo(supabase, campaignsRepo);
/** Lo que recuerda la pantalla de la mesa entre visitas: hoy, el ancho del carril. */
export const tableLayout: LayoutMemoryPort = localTableLayout;
