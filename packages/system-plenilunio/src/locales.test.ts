import { describe, expect, it } from 'vitest';
import { messages } from './locales';

const leaves = (tree: unknown, prefix = ''): string[] => {
  if (!tree || typeof tree !== 'object') return [prefix];
  return Object.entries(tree as Record<string, unknown>).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
};

describe('locales', () => {
  it('es and en have exactly the same leaf keys', () => {
    const es = leaves(messages.es).sort();
    const en = leaves(messages.en).sort();
    expect(en).toEqual(es);
    expect(es.length).toBeGreaterThan(300);
  });
  it('every leaf is a non-empty string', () => {
    for (const loc of ['es', 'en'] as const) {
      const check = (t: unknown, p: string) => {
        if (t && typeof t === 'object') { for (const [k, v] of Object.entries(t as Record<string, unknown>)) check(v, `${p}.${k}`); return; }
        expect(typeof t, p).toBe('string'); expect((t as string).trim().length, p).toBeGreaterThan(0);
      };
      check(messages[loc], loc);
    }
  });
  it('covers the seven namespaces', () => {
    for (const ns of ['system', 'sheet', 'catalog', 'ref', 'roll', 'generator', 'progression']) expect(messages.es).toHaveProperty(ns);
  });
});
