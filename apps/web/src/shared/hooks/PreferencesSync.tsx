import { useEffect, useRef } from 'react';
import { useTranslation, type Locale } from '@rolvium/i18n';
import { useAuth } from './useAuth';
import { useTheme } from './useTheme';

const isLocale = (v: string): v is Locale => v === 'es' || v === 'en';

/**
 * Applies the profile's saved locale + theme once per sign-in (not on every
 * refresh, so a change made from /account is never fought by the sync).
 */
export function PreferencesSync(): null {
  const { user } = useAuth();
  const { setLocale } = useTranslation();
  const { setPref } = useTheme();
  const synced = useRef<string | null>(null);

  useEffect(() => {
    if (!user) { synced.current = null; return; }
    if (synced.current === user.id) return;
    synced.current = user.id;
    if (isLocale(user.locale)) setLocale(user.locale);
    setPref(user.themePref);
  }, [user, setLocale, setPref]);

  return null;
}
