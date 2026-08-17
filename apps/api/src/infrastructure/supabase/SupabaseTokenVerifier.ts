import type { SupabaseClient } from '@supabase/supabase-js';
import type { ITokenVerifier, VerifiedIdentity } from '../../domain/auth/ITokenVerifier.js';

/**
 * Verifies a Supabase access token by asking Supabase Auth itself
 * (`auth.getUser(jwt)`): signature, expiry and revocation are all checked
 * server-side. Never decode-and-trust.
 */
export class SupabaseTokenVerifier implements ITokenVerifier {
  constructor(private readonly db: SupabaseClient) {}

  async verify(accessToken: string): Promise<VerifiedIdentity | null> {
    if (!accessToken) return null;
    const { data, error } = await this.db.auth.getUser(accessToken);
    if (error || !data.user) return null;
    return { userId: data.user.id, email: data.user.email ?? '' };
  }
}
