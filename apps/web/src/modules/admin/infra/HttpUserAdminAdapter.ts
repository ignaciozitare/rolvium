import type { User } from '@rolvium/shared-types';
import { apiFetch } from '@/shared/lib/api';
import type { UserAdminPort } from '../domain/ports/UserAdminPort';

/** Talks to the Rolvium API (`/admin/*`), never to Supabase admin directly. */
export class HttpUserAdminAdapter implements UserAdminPort {
  createUser(input: { name: string; email: string; password: string; roleId: string }): Promise<User> {
    return apiFetch<User>('/admin/users', { method: 'POST', body: JSON.stringify(input) });
  }
  setPassword(userId: string, password: string): Promise<void> {
    return apiFetch<void>(`/admin/users/${userId}/password`, { method: 'POST', body: JSON.stringify({ password }) });
  }
  deleteUser(userId: string): Promise<void> {
    return apiFetch<void>(`/admin/users/${userId}`, { method: 'DELETE' });
  }
}
