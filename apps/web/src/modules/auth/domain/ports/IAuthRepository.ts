import type { User } from '@rolvium/shared-types';

export interface SignInResult {
  user: User | null;
  error?: 'invalid_credentials' | 'account_disabled' | 'unknown';
}

/**
 * Port for authentication + the current user's profile. Implemented by
 * `SupabaseAuthRepository`; consumed by the AuthProvider through container.ts.
 */
export interface IAuthRepository {
  signInWithPassword(email: string, password: string): Promise<SignInResult>;
  signOut(): Promise<void>;
  /** Resolves the current session's profile (with role + permissions) or null. */
  getCurrentUser(): Promise<User | null>;
  /** Fires on session changes (token refresh, sign out in another tab). Returns unsubscribe. */
  onAuthStateChange(cb: (signedIn: boolean) => void): () => void;
}
