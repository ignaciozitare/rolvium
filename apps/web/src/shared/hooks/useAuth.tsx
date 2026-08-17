import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '@rolvium/shared-types';
import type { IAuthRepository, SignInResult } from '@/modules/auth/domain/ports/IAuthRepository';
import { authRepository as defaultRepo } from '@/modules/auth/container';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<SignInResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthCtx = createContext<AuthContextValue | null>(null);

interface Props {
  children: ReactNode;
  /** Injectable for tests. */
  repo?: IAuthRepository;
}

export function AuthProvider({ children, repo = defaultRepo }: Props): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const u = await repo.getCurrentUser();
      setUser(u && u.active ? u : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    void refresh();
    const off = repo.onAuthStateChange((signedIn) => {
      if (!signedIn) { setUser(null); setLoading(false); }
      else void refresh();
    });
    return off;
  }, [repo, refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await repo.signInWithPassword(email, password);
    if (result.user) setUser(result.user);
    setLoading(false);
    return result;
  }, [repo]);

  const logout = useCallback(async () => {
    await repo.signOut();
    setUser(null);
  }, [repo]);

  const value = useMemo(() => ({ user, isLoading, login, logout, refresh }), [user, isLoading, login, logout, refresh]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
