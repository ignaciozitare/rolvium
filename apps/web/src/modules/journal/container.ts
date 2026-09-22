import { supabase } from '@/shared/lib/supabaseClient';
import { SupabaseJournalRepo } from './infra/SupabaseJournalRepo';
import type { JournalPort } from './domain/ports/JournalPort';

export const journalPort: JournalPort = new SupabaseJournalRepo(supabase);
