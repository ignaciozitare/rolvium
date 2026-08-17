import type { DeviceSession } from '../entities/Identity';

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_ALIAS_LENGTH = 40;

export type SignUpFieldError = 'name' | 'email' | 'password';

/** Client-side validation of the sign-up form. Returns the first failing field or null. */
export function validateSignUp(i: { name: string; email: string; password: string }): SignUpFieldError | null {
  if (!i.name.trim()) return 'name';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.email.trim())) return 'email';
  if (i.password.length < MIN_PASSWORD_LENGTH) return 'password';
  return null;
}

export type PasswordPairError = 'too_short' | 'mismatch';
export function validatePasswordPair(a: string, b: string): PasswordPairError | null {
  if (a.length < MIN_PASSWORD_LENGTH) return 'too_short';
  if (a !== b) return 'mismatch';
  return null;
}

/** Alias shown at the tables: alias when set, otherwise the account name. */
export function tableName(u: { name: string; alias?: string | null }): string {
  const a = u.alias?.trim();
  return a ? a : u.name;
}

export function normalizeAlias(alias: string): string | null {
  const a = alias.trim().slice(0, MAX_ALIAS_LENGTH);
  return a.length ? a : null;
}

export interface DeviceInfo { device: string; browser: string; icon: string; }

/** Human-readable device/browser from a user-agent string. Pure and forgiving. */
export function describeUserAgent(ua: string | null | undefined): DeviceInfo {
  const s = ua ?? '';
  let device = 'PC'; let icon = 'desktop_windows';
  if (/iPad/i.test(s)) { device = 'iPad'; icon = 'tablet_mac'; }
  else if (/iPhone/i.test(s)) { device = 'iPhone'; icon = 'smartphone'; }
  else if (/Android/i.test(s)) { device = /Mobile/i.test(s) ? 'Android' : 'Android tablet'; icon = /Mobile/i.test(s) ? 'smartphone' : 'tablet'; }
  else if (/Macintosh|Mac OS X/i.test(s)) { device = 'Mac'; icon = 'laptop_mac'; }
  else if (/Windows/i.test(s)) { device = 'PC'; icon = 'desktop_windows'; }
  else if (/Linux|X11/i.test(s)) { device = 'Linux'; icon = 'computer'; }
  else if (!s) { device = '—'; icon = 'devices'; }

  let browser = '—';
  if (/Edg\//i.test(s)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(s)) browser = 'Opera';
  else if (/Firefox\//i.test(s)) browser = 'Firefox';
  else if (/Chrome\/|CriOS/i.test(s)) browser = 'Chrome';
  else if (/Safari\//i.test(s)) browser = 'Safari';
  else if (s) browser = s.split(' ')[0]?.slice(0, 24) ?? '—';
  return { device, browser, icon };
}

/** Sort: current session first, then most recently seen. */
export function sortSessions(list: DeviceSession[]): DeviceSession[] {
  return [...list].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || b.lastSeenAt.localeCompare(a.lastSeenAt));
}
