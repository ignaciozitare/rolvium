import { describe, it, expect } from 'vitest';
import { isValidEmail, initials, slugifyRoleName } from './utils';

describe('utils', () => {
  it('validates emails', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('nope')).toBe(false);
  });
  it('builds initials', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('  ')).toBe('?');
  });
  it('slugifies role names', () => {
    expect(slugifyRoleName('Máster de Juego')).toBe('master_de_juego');
    expect(slugifyRoleName('  Admin!! ')).toBe('admin');
  });
});
