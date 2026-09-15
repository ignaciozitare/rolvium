import { supabase } from '@/shared/lib/supabaseClient';
import { compressionLevelsRepo } from '@/shared/settings/container';
import { SupabaseRoleRepo } from './infra/SupabaseRoleRepo';
import { SupabaseUserRepo } from './infra/SupabaseUserRepo';
import { HttpUserAdminAdapter } from './infra/HttpUserAdminAdapter';
import type { RolePort } from './domain/ports/RolePort';
import type { UserPort } from './domain/ports/UserPort';
import type { UserAdminPort } from './domain/ports/UserAdminPort';
import type { CompressionLevelsPort } from '@/shared/settings/CompressionLevelsPort';

export interface AdminDeps {
  roleRepo: RolePort;
  userRepo: UserPort;
  userAdmin: UserAdminPort;
  /** El nivel de compresión de imágenes por tipo — misma fila de `app_settings` que usa `maps/container.ts`. */
  compressionLevels: CompressionLevelsPort;
}

export const adminDeps: AdminDeps = {
  roleRepo: new SupabaseRoleRepo(supabase),
  userRepo: new SupabaseUserRepo(supabase),
  userAdmin: new HttpUserAdminAdapter(),
  compressionLevels: compressionLevelsRepo,
};
