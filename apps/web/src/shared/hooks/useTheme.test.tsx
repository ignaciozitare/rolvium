import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { ThemeProvider, useTheme } from './useTheme';

// jsdom here has no localStorage (opaque origin) — stub a memory Storage so persistence is observable.
const mem = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }, removeItem: (k: string) => { mem.delete(k); }, clear: () => mem.clear() });

describe('useTheme', () => {
  beforeEach(() => { mem.clear(); document.documentElement.removeAttribute('data-theme'); });
  it('defaults to dark, persists explicit prefs and applies data-theme', () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    expect(result.current.theme).toBe('dark');
    act(() => result.current.setPref('light'));
    expect(result.current.theme).toBe('light');
    expect(mem.get('rolvium_theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    act(() => result.current.toggle());
    expect(result.current.pref).toBe('dark');
  });
  it('"system" follows the OS (jsdom → dark) and reads back from storage', () => {
    mem.set('rolvium_theme', 'system');
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    expect(result.current.pref).toBe('system');
    expect(result.current.theme).toBe('dark');
  });
});
