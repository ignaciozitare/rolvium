import type { ThemePref } from '@rolvium/shared-types';

/** What a visitor sees before signing up with an invite code — never the campaign id. */
export interface InvitePreview {
  code: string;
  campaignName: string;
  systemId: string;
  dmName: string;
  seatsFree: number;
}

/** `redirectTo`: where the confirmation link (if confirmations are on) should land — e.g. back on `/join/:code`. */
export interface SignUpInput { email: string; password: string; name: string; locale: string; redirectTo?: string; }
export type SignUpError = 'email_taken' | 'weak_password' | 'invalid_email' | 'unknown';
export type SignUpResult = { status: 'signed_in' | 'confirm_email' } | { error: SignUpError };

export interface ProfileUpdate { name?: string; alias?: string | null; locale?: string; themePref?: ThemePref; }

/** One open session of the current user (read from Supabase Auth). */
export interface DeviceSession {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
}
