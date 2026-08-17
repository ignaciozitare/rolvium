import { describe, it, expect } from 'vitest';
import { plenilunio } from '@rolvium/system-plenilunio';
import { lookup, sysT, tSys } from './systemText';

describe('systemText', () => {
  it('lookup resolves dotted keys and returns null when missing', () => {
    expect(lookup({ a: { b: 'x' } }, 'a.b')).toBe('x');
    expect(lookup({ a: { b: 'x' } }, 'a.c')).toBeNull();
    expect(lookup(undefined, 'a')).toBeNull();
    expect(lookup({ a: 1 }, 'a')).toBeNull();
  });
  it('tSys picks the locale, falls back to es and then to the key', () => {
    expect(tSys(plenilunio, 'es', 'sheet.stats.combat')).toBe('Combate');
    expect(tSys(plenilunio, 'en', 'sheet.stats.combat')).toBe('Combat');
    expect(tSys({ locales: { es: { only: 'solo' } } }, 'en', 'only')).toBe('solo');
    expect(tSys(plenilunio, 'en', 'nope.key')).toBe('nope.key');
  });
  it('sysT curries', () => {
    expect(sysT(plenilunio, 'es')('system.name')).toBe('Plenilunio');
  });
});
