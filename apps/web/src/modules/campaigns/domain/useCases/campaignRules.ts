import type { Campaign } from '../entities/Campaign';

/** Invite codes are XXXX-XXXX from an unambiguous alphabet; users type them loosely. */
export function normalizeInviteCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4, 8)}` : clean;
}
export const isValidInviteCode = (raw: string): boolean => /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalizeInviteCode(raw));

export const freeSeats = (c: Campaign): number => Math.max(0, c.seats - c.playersCount);
export const isFull = (c: Campaign): boolean => freeSeats(c) === 0;
export const isDm = (c: Campaign, userId: string | undefined): boolean => !!userId && c.dmId === userId;

/** Wizard validation, step by step. Returns an i18n error key or null. */
export function validateCreateStep(step: 'name' | 'system' | 'seats', draft: { name: string; systemId: string | null; seats: number }): string | null {
  if (step === 'name' && draft.name.trim().length < 1) return 'campaigns.errors.nameRequired';
  if (step === 'system' && !draft.systemId) return 'campaigns.errors.systemRequired';
  if (step === 'seats' && (draft.seats < 1 || draft.seats > 12)) return 'campaigns.errors.seatsRange';
  return null;
}

/** Public join link for an invite code (the `/join/:code` route). */
export const inviteUrl = (origin: string, code: string | null): string => `${origin}/join/${code ?? ''}`;

/** ISO (UTC) → value for `<input type="datetime-local">` in the browser's zone; '' when unset. */
export function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** datetime-local value → ISO (UTC); null when empty/invalid. */
export function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
