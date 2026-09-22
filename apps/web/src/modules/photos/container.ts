import { supabase } from '@/shared/lib/supabaseClient';
import { SupabasePhotosRepo } from './infra/SupabasePhotosRepo';
import type { PhotosPort } from './domain/ports/PhotosPort';

export const photosPort: PhotosPort = new SupabasePhotosRepo(supabase);
