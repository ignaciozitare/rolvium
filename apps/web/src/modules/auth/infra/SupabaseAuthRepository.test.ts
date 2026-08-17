import { describe, it, expect } from 'vitest';
import { mapProfileRow, PROFILE_SELECT } from './SupabaseAuthRepository';

const BASE = { id: 'u1', name: 'Ada', email: 'ada@x.co', avatar_url: null, role_id: 'r1', active: true, created_at: '2026-01-01', roles: { name: 'player', permissions: { modules: ['x'], admin: {} } } };

describe('mapProfileRow (identity fields)', () => {
  it('selects the identity columns', () => {
    for (const col of ['alias', 'locale', 'theme_pref']) expect(PROFILE_SELECT).toContain(col);
  });
  it('maps alias / locale / theme_pref', () => {
    const u = mapProfileRow({ ...BASE, alias: 'Pipito', locale: 'en', theme_pref: 'light' });
    expect(u).toMatchObject({ alias: 'Pipito', locale: 'en', themePref: 'light', role: 'player' });
  });
  it('falls back when the columns are missing or theme_pref is unknown', () => {
    const u = mapProfileRow({ ...BASE, theme_pref: 'neon' });
    expect(u).toMatchObject({ alias: null, locale: 'es', themePref: 'system' });
    expect(mapProfileRow({ ...BASE, roles: [{ name: 'admin', permissions: { modules: [], admin: {} } }] }).role).toBe('admin');
  });
});
