import { type ReactNode } from 'react';
import { I18nProvider, preloadLocale, type Locale } from '@rolvium/i18n';
import en from '../../../../packages/i18n/locales/en.json';

// 'en' is code-split at runtime; in tests inject it synchronously.
preloadLocale('en', en);

interface Props { locale?: Locale; children: ReactNode }

/** I18nProvider for tests. Default 'es' (primary locale). setLocale is a noop. */
export function I18nTestProvider({ locale = 'es', children }: Props) {
  return <I18nProvider locale={locale} setLocale={() => undefined}>{children}</I18nProvider>;
}
