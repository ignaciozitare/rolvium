import { describe, it, expect } from 'vitest';
import { plenilunio } from '@rolvium/system-plenilunio';
import { sysT } from '@/modules/characters/domain/useCases/systemText';
import { ROLL_COMBAT, ROLL_FREE, ROLL_SETBACK } from '../../../../../tests/helpers/fakes';
import { DIE_KINDS, describeRoll, dieFace, dieTone, freeRollRequest, notationOf } from './rollRules';

const t = (k: string, p?: Record<string, string>) => (k === 'dice.log.freeTitle' ? `${p?.['notation']} · ${p?.['who']}` : k);
const ts = sysT(plenilunio, 'es');

describe('rollRules', () => {
  it('freeRollRequest builds a free intention (system null) with clamped count/modifier and Fudge tag', () => {
    const d10 = DIE_KINDS.find(d => d.id === 'd10')!;
    expect(freeRollRequest(d10, 2, 3, 'dm')).toEqual({ systemId: null, kind: 'free', title: '2D10+3', groups: [{ count: 2, sides: 10 }], visibility: 'dm', modifier: 3 });
    expect(freeRollRequest(d10, 99, 0, 'table')).toMatchObject({ title: '6D10', groups: [{ count: 6, sides: 10 }] });
    expect(freeRollRequest(d10, 1, -50, 'table').modifier).toBe(-20);
    const fudge = DIE_KINDS.find(d => d.id === 'fudge')!;
    expect(freeRollRequest(fudge, 4, 0, 'secret')).toMatchObject({ title: '4DF', groups: [{ count: 4, sides: 3, tag: 'fudge' }], visibility: 'secret' });
    expect(notationOf([{ count: 2, sides: 10 }], -1)).toBe('2D10−1');
  });
  it('dieTone is system-agnostic: top face = triumph, 1 = fumble; Fudge shows + / 0 / −', () => {
    expect(dieTone(6, 6)).toBe('triumph'); expect(dieTone(1, 6)).toBe('fumble'); expect(dieTone(4, 6)).toBe('plain');
    expect(dieTone(20, 20)).toBe('triumph'); expect(dieTone(100, 100)).toBe('triumph');
    expect(dieTone(3, 3, 'fudge')).toBe('triumph'); expect(dieTone(1, 3, 'fudge')).toBe('fumble'); expect(dieTone(2, 3, 'fudge')).toBe('plain');
    expect(dieFace(3, 'fudge')).toBe('+'); expect(dieFace(1, 'fudge')).toBe('−'); expect(dieFace(2, 'fudge')).toBe('0'); expect(dieFace(5)).toBe('5');
  });
  it('describeRoll: system roll → title/score/degree in the system locale, own (shared = gold) vs opposition dice, notices from effects', () => {
    const d = describeRoll(ROLL_COMBAT, t, ts);
    expect(d.title).toBe('Combate');
    expect(d.score).toBe('7—1');
    expect(d.degree).toBe('Lo consigue de forma absoluta y queda en posición ventajosa.');
    expect(d.own.map(x => x.face)).toEqual(['5', '6', '2', '4', '6', '3']);
    expect(d.own.map(x => x.shared)).toEqual([false, false, false, false, true, true]);
    expect(d.own[1]!.tone).toBe('triumph');
    expect(d.opposition.map(x => `${x.face}:${x.tone}`)).toEqual(['4:plain', '1:fumble']);
    expect(d.notices).toEqual([{ text: '+1 Destino · Fortuna al máximo', tone: 'gold' }]);
    const s = describeRoll(ROLL_SETBACK, t, ts);
    expect(s.score).toBe('0—2');
    expect(s.degree).toBe('Revés: falla y además ocurre algo malo.');
    expect(s.notices).toEqual([{ text: 'Revés', tone: 'blood' }]);
  });
  it('describeRoll: free roll → notation · author, the total as score, no degree/notices', () => {
    const d = describeRoll(ROLL_FREE, t, ts);
    expect(d).toMatchObject({ title: '2D10 · Nix', score: '13', degree: null, notices: [], opposition: [] });
    expect(d.own.map(x => x.face)).toEqual(['6', '7']);
    expect(describeRoll({ ...ROLL_FREE, authorName: null, request: { ...ROLL_FREE.request, modifier: 2 } }, t, ts).title).toBe('2D10+2');
  });
  /**
   * `who` es el PERSONAJE. El nombre de la cuenta no sirve para el Registro: el director tira por
   * media mesa y su usuario no dice nada de quién actuó.
   */
  it('who sale del personaje, nunca del autor, y es null en una tirada libre', () => {
    const d = describeRoll(ROLL_COMBAT, t, ts);
    expect(d.who).toBe('Karen Sinclair');
    expect(describeRoll({ ...ROLL_COMBAT, characterName: null }, t, ts).who).toBeNull();
    expect(describeRoll({ ...ROLL_COMBAT, characterName: '   ' }, t, ts).who).toBeNull();
    expect(describeRoll(ROLL_FREE, t, ts).who).toBeNull();
  });
});
