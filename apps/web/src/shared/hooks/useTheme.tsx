import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ThemePref } from '@rolvium/shared-types';

export type ResolvedTheme = 'dark' | 'light';
const THEME_KEY = 'rolvium_theme';

const readPref = (): ThemePref => {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'dark';
  } catch { return 'dark'; }
};
const storePref = (p: ThemePref): void => { try { localStorage.setItem(THEME_KEY, p); } catch { /* storage unavailable */ } };
const systemTheme = (): ResolvedTheme => {
  try { return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; } catch { return 'dark'; }
};

interface ThemeContextValue {
  /** What the user chose (dark / light / follow the OS). */
  pref: ThemePref;
  /** What is actually applied right now. */
  theme: ResolvedTheme;
  setPref: (p: ThemePref) => void;
  /** Quick toggle used by the top bar: flips the resolved theme (and stores it as explicit). */
  toggle: () => void;
}

const ThemeCtx = createContext<ThemeContextValue | null>(null);

/** Owns the platform theme: persists the preference and applies `data-theme` on <html>. */
export function ThemeProvider({ children, initialPref }: { children: ReactNode; initialPref?: ThemePref }): JSX.Element {
  const [pref, setPrefState] = useState<ThemePref>(initialPref ?? readPref);
  const [os, setOs] = useState<ResolvedTheme>(systemTheme);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const on = () => setOs(mq.matches ? 'light' : 'dark');
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  const theme: ResolvedTheme = pref === 'system' ? os : pref;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setPref = useCallback((p: ThemePref) => { storePref(p); setPrefState(p); }, []);
  const toggle = useCallback(() => setPref(theme === 'dark' ? 'light' : 'dark'), [setPref, theme]);

  const value = useMemo(() => ({ pref, theme, setPref, toggle }), [pref, theme, setPref, toggle]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
