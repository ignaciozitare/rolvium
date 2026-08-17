import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { I18nProvider } from '@rolvium/i18n';
import { AuthProvider } from './useAuth';
import { ThemeProvider, useTheme } from './useTheme';
import { PreferencesSync } from './PreferencesSync';
import { fakeAuthRepo, PLAYER_USER } from '../../../tests/helpers/fakes';

function Probe(): JSX.Element { const { pref } = useTheme(); return <span data-testid="pref">{pref}</span>; }

describe('PreferencesSync', () => {
  it('applies the profile locale + theme once after sign-in', async () => {
    const setLocale = vi.fn();
    const repo = fakeAuthRepo({ ...PLAYER_USER, locale: 'en', themePref: 'light' });
    const { getByTestId } = render(
      <I18nProvider locale="es" setLocale={setLocale}><ThemeProvider><AuthProvider repo={repo}><PreferencesSync /><Probe /></AuthProvider></ThemeProvider></I18nProvider>,
    );
    await waitFor(() => expect(setLocale).toHaveBeenCalledWith('en'));
    await waitFor(() => expect(getByTestId('pref').textContent).toBe('light'));
    expect(setLocale).toHaveBeenCalledTimes(1);
  });
});
