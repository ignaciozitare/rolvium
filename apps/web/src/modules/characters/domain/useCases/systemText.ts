import type { GameSystem, Locale, Messages } from '@rolvium/core';

/** Resolves a dotted key inside a Messages tree; null when missing. */
export function lookup(tree: Messages | undefined, key: string): string | null {
  let cur: unknown = tree;
  for (const part of key.split('.')) {
    if (!cur || typeof cur !== 'object') return null;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'string' ? cur : null;
}

/**
 * Text of a game system in the user's locale, falling back to Spanish (the
 * system's primary locale) and finally to the key itself — so `<Sheet>` never
 * hardcodes game text and never shows an empty label.
 */
export function tSys(system: Pick<GameSystem, 'locales'>, locale: Locale, key: string): string {
  return lookup(system.locales[locale], key) ?? lookup(system.locales.es, key) ?? key;
}

/** Curried form for components: `const ts = sysT(system, locale); ts('sheet.stats.combat')`. */
export const sysT = (system: Pick<GameSystem, 'locales'>, locale: Locale) => (key: string): string => tSys(system, locale, key);
