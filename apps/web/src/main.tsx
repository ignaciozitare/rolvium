import { StrictMode, useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider, getStoredLocale, storeLocale, type Locale } from '@rolvium/i18n';
import { DialogProvider } from '@rolvium/ui';
import '@rolvium/ui/tokens';
import { AuthProvider } from '@/shared/hooks/useAuth';
import { ThemeProvider } from '@/shared/hooks/useTheme';
import { PreferencesSync } from '@/shared/hooks/PreferencesSync';
import { AppRouter } from './AppRouter';
import './RolviumApp.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });
const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

function App(): JSX.Element {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale);
  const setLocale = useCallback((l: Locale) => { storeLocale(l); setLocaleState(l); }, []);
  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <I18nProvider locale={locale} setLocale={setLocale}>
          <ThemeProvider>
            <AuthProvider>
              <PreferencesSync />
              <DialogProvider>
                <AppRouter />
              </DialogProvider>
            </AuthProvider>
          </ThemeProvider>
        </I18nProvider>
      </QueryClientProvider>
    </StrictMode>
  );
}

createRoot(root).render(<App />);
