import { supabase } from '@/shared/lib/supabaseClient';
import { SupabaseRoleRepo } from './infra/SupabaseRoleRepo';
import { SupabaseUserRepo } from './infra/SupabaseUserRepo';
import { HttpUserAdminAdapter } from './infra/HttpUserAdminAdapter';
import type { RolePort } from './domain/ports/RolePort';
import type { UserPort } from './domain/ports/UserPort';
import type { UserAdminPort } from './domain/ports/UserAdminPort';

export interface AdminDeps {
  roleRepo: RolePort;
  userRepo: UserPort;
  userAdmin: UserAdminPort;
}

export const adminDeps: AdminDeps = {
  roleRepo: new SupabaseRoleRepo(supabase),
  userRepo: new SupabaseUserRepo(supabase),
  userAdmin: new HttpUserAdminAdapter(),
};
