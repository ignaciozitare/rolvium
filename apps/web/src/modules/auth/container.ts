import { supabase } from '@/shared/lib/supabaseClient';
import { SupabaseAuthRepository } from './infra/SupabaseAuthRepository';
import type { IAuthRepository } from './domain/ports/IAuthRepository';

export const authRepository: IAuthRepository = new SupabaseAuthRepository(supabase);
