import type { DeviceSession, ProfileUpdate, SignUpInput, SignUpResult } from '../entities/Identity';

/** Everything the current user can do with their own identity. */
export interface IdentityPort {
  signUp(input: SignUpInput): Promise<SignUpResult>;
  /** Sends the recovery e-mail; resolves even if the address is unknown (no enumeration). */
  requestPasswordReset(email: string, redirectTo: string): Promise<void>;
  updatePassword(newPassword: string): Promise<{ error?: 'weak_password' | 'unknown' }>;
  updateProfile(userId: string, patch: ProfileUpdate): Promise<void>;
  /** Uploads the (already cropped) image and returns the public URL now stored in the profile. */
  uploadAvatar(userId: string, file: Blob): Promise<string>;
  removeAvatar(userId: string): Promise<void>;
  listSessions(): Promise<DeviceSession[]>;
  revokeSession(sessionId: string): Promise<void>;
}
