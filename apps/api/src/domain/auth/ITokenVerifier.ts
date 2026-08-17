/** Identity extracted from a verified access token. */
export interface VerifiedIdentity {
  userId: string;
  email: string;
}

/**
 * Port: verifies an access token issued by the identity provider (Supabase
 * Auth). MUST cryptographically verify — never just decode the payload.
 */
export interface ITokenVerifier {
  verify(accessToken: string): Promise<VerifiedIdentity | null>;
}
