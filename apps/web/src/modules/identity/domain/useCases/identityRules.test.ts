import { describe, it, expect } from 'vitest';
import { describeUserAgent, normalizeAlias, sortSessions, tableName, validatePasswordPair, validateSignUp } from './identityRules';

describe('identityRules', () => {
  it('validateSignUp returns the first failing field', () => {
    expect(validateSignUp({ name: ' ', email: 'a@b.co', password: '12345678' })).toBe('name');
    expect(validateSignUp({ name: 'Marta', email: 'nope', password: '12345678' })).toBe('email');
    expect(validateSignUp({ name: 'Marta', email: 'a@b.co', password: '1234567' })).toBe('password');
    expect(validateSignUp({ name: 'Marta', email: 'a@b.co', password: '12345678' })).toBeNull();
  });
  it('validatePasswordPair', () => {
    expect(validatePasswordPair('short', 'short')).toBe('too_short');
    expect(validatePasswordPair('longenough', 'different1')).toBe('mismatch');
    expect(validatePasswordPair('longenough', 'longenough')).toBeNull();
  });
  it('tableName prefers alias, normalizeAlias trims/empties', () => {
    expect(tableName({ name: 'Ignacio Zitare', alias: 'Ignacio' })).toBe('Ignacio');
    expect(tableName({ name: 'Ignacio Zitare', alias: '  ' })).toBe('Ignacio Zitare');
    expect(normalizeAlias('  ')).toBeNull();
    expect(normalizeAlias(' Pip ')).toBe('Pip');
    expect(normalizeAlias('x'.repeat(60))).toHaveLength(40);
  });
  it('describeUserAgent recognises common devices and browsers', () => {
    expect(describeUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605 Version/17 Safari/605.1')).toEqual({ device: 'Mac', browser: 'Safari', icon: 'laptop_mac' });
    expect(describeUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0) AppleWebKit/605 Safari/605.1')).toMatchObject({ device: 'iPad', icon: 'tablet_mac' });
    expect(describeUserAgent('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/126 Safari/537.36')).toEqual({ device: 'PC', browser: 'Chrome', icon: 'desktop_windows' });
    expect(describeUserAgent('Mozilla/5.0 (Windows NT 10.0) Chrome/126 Safari/537.36 Edg/126')).toMatchObject({ browser: 'Edge' });
    expect(describeUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel) Chrome/126 Mobile Safari/537.36')).toMatchObject({ device: 'Android', icon: 'smartphone' });
    expect(describeUserAgent(null)).toMatchObject({ device: '—', browser: '—', icon: 'devices' });
  });
  it('sortSessions puts the current one first then most recent', () => {
    const s = sortSessions([
      { id: 'a', userAgent: null, ip: null, createdAt: '', lastSeenAt: '2026-01-02', isCurrent: false },
      { id: 'b', userAgent: null, ip: null, createdAt: '', lastSeenAt: '2026-01-01', isCurrent: true },
      { id: 'c', userAgent: null, ip: null, createdAt: '', lastSeenAt: '2026-01-03', isCurrent: false },
    ]);
    expect(s.map(x => x.id)).toEqual(['b', 'c', 'a']);
  });
});
