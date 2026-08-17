import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import es from '../locales/es.json';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Locale = 'es' | 'en';

// PERF: solo el locale por defecto (es) viaja en el bundle inicial; 'en' se
// code-splitea y se descarga on-demand la primera vez que se necesita (~136KB
// menos en el chunk principal). Mientras baja, translate() cae al español y el
// I18nProvider re-renderiza al llegar (swap breve solo en el primer paint EN).
const locales: { es: typeof es; en: typeof es | null } = { es, en: null };
let enLoading: Promise<void> | null = null;

/** Inyecta un locale ya resuelto (tests: evita el fetch async y mantiene t() síncrono). */
export function preloadLocale(locale: Locale, data: unknown): void {
  if (locale === 'en') locales.en = data as typeof es;
}

/** Garantiza que el locale esté en memoria; 'en' se descarga en su propio chunk. */
export function ensureLocale(locale: Locale): Promise<void> {
  if (locale !== 'en' || locales.en) return Promise.resolve();
  enLoading ??= import('../locales/en.json').then(m => { locales.en = m.default as typeof es; enLoading = null; });
  return enLoading;
}

/**
 * Nested key path, e.g. 'common.save' | 'admin.perm.manage_users'
 * Typed via recursive template literal — autocomplete en IDE.
 */
type NestedKeys<T, Prefix extends string = ''> = {
  [K in keyof T]: T[K] extends string
    ? Prefix extends '' ? `${string & K}` : `${Prefix}.${string & K}`
    : T[K] extends object
    ? NestedKeys<T[K], Prefix extends '' ? `${string & K}` : `${Prefix}.${string & K}`>
    : never;
}[keyof T];

export type TranslationKey = NestedKeys<typeof es>;

// ─── Core t() function ────────────────────────────────────────────────────────

/**
 * Resolves a dot-notation key against a locale object.
 * Falls back to the key itself so the UI never breaks.
 */
export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string>,
): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dict: any = locales[locale] ?? locales.es;
  const value: unknown = key
    .split('.')
    .reduce((obj, k) => (obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[k] : undefined), dict as unknown);

  if (typeof value !== 'string') {
    // Key not found — return key as-is so nothing breaks in prod
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[i18n] Missing key: "${key}" for locale "${locale}"`);
    }
    return key;
  }

  if (!params) return value;

  return value.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k] ?? `{{${k}}}`);
}

// ─── React context ────────────────────────────────────────────────────────────

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale:    'es',
  setLocale: () => undefined,
  t:         (key) => key,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

interface I18nProviderProps {
  locale:    Locale;
  setLocale: (l: Locale) => void;
  children:  ReactNode;
}

export function I18nProvider({ locale, setLocale, children }: I18nProviderProps) {
  // Si el locale activo aún no está en memoria (en on-demand), dispararlo y
  // re-renderizar el árbol cuando llegue. Para 'es' (bundled) es un no-op.
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    let live = true;
    ensureLocale(locale).then(() => { if (live) bump(); });
    return () => { live = false; };
  }, [locale]);

  const t = (key: string, params?: Record<string, string>) =>
    translate(locale, key, params);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useTranslation() — acceso al sistema i18n desde cualquier componente.
 *
 * @example
 * const { t, locale, setLocale } = useTranslation();
 * <button>{t('common.save')}</button>
 * <button onClick={() => setLocale('en')}>EN</button>
 */
export function useTranslation() {
  return useContext(I18nContext);
}

/**
 * Versión standalone sin contexto React — útil en utilidades fuera del árbol.
 *
 * @example
 * const t = createTranslator('es');
 * const label = t('common.save'); // 'Guardar'
 */
export function createTranslator(locale: Locale) {
  return (key: string, params?: Record<string, string>) =>
    translate(locale, key, params);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Lista de locales disponibles con su etiqueta nativa */
export const AVAILABLE_LOCALES: { id: Locale; label: string }[] = [
  { id: 'es', label: 'Español' },
  { id: 'en', label: 'English' },
];

/** Lee la preferencia de locale del localStorage (o devuelve 'es') */
export function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'es';
  const stored = localStorage.getItem('rolvium_locale');
  return (stored === 'en' || stored === 'es') ? stored : 'es';
}

/** Persiste la preferencia de locale */
export function storeLocale(locale: Locale): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('rolvium_locale', locale);
  }
}
