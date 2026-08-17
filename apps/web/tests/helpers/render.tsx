import { type ReactElement, type ReactNode } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DialogProvider } from '@rolvium/ui';
import type { Locale } from '@rolvium/i18n';
import { I18nTestProvider } from './i18nWrapper';
import { ThemeProvider } from '@/shared/hooks/useTheme';

interface ProviderOptions {
  locale?: Locale;
  routerProps?: MemoryRouterProps;
  withQueryClient?: boolean;
  withDialog?: boolean;
  withRouter?: boolean;
}

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> { providers?: ProviderOptions }

function makeWrapper(opts: ProviderOptions = {}) {
  const { locale, routerProps, withQueryClient = true, withDialog = true, withRouter = true } = opts;
  const queryClient = withQueryClient ? new QueryClient({ defaultOptions: { queries: { retry: false } } }) : null;
  return function Wrapper({ children }: { children: ReactNode }) {
    let tree: ReactNode = children;
    if (withDialog) tree = <DialogProvider>{tree}</DialogProvider>;
    tree = <ThemeProvider>{tree}</ThemeProvider>;
    tree = <I18nTestProvider locale={locale}>{tree}</I18nTestProvider>;
    if (queryClient) tree = <QueryClientProvider client={queryClient}>{tree}</QueryClientProvider>;
    if (withRouter) tree = <MemoryRouter {...routerProps}>{tree}</MemoryRouter>;
    return <>{tree}</>;
  };
}

/** Render with the real app providers: router, react-query, i18n, dialog. */
export function renderWithProviders(ui: ReactElement, { providers, ...rtl }: RenderWithProvidersOptions = {}): RenderResult {
  return render(ui, { wrapper: makeWrapper(providers), ...rtl });
}

export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
