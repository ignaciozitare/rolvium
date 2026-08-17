import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// The anon key is public by design (like an OAuth client_id) — RLS protects the data.
const url = import.meta.env['VITE_SUPABASE_URL'] as string | undefined;
const key = import.meta.env['VITE_SUPABASE_ANON_KEY'] as string | undefined;

export const supabase: SupabaseClient = createClient(url ?? 'http://localhost:54321', key ?? 'anon');
