import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './useAuth';
import type { IAuthRepository } from '@/modules/auth/domain/ports/IAuthRepository';
import type { User } from '@rolvium/shared-types';

const USER: User = { id: 'u1', name: 'Ada', email: 'ada@x.co', avatarUrl: null, alias: null, locale: 'es', themePref: 'system', roleId: 'r', role: 'player', permissions: { modules: [], admin: {} }, active: true, createdAt: '' };

function repo(over: Partial<IAuthRepository> = {}): IAuthRepository {
  return {
    signInWithPassword: vi.fn().mockResolvedValue({ user: USER }),
    signOut: vi.fn().mockResolvedValue(undefined),
    getCurrentUser: vi.fn().mockResolvedValue(null),
    onAuthStateChange: vi.fn().mockReturnValue(() => undefined),
    ...over,
  };
}

describe('useAuth', () => {
  it('resolves loading with no session', async () => {
    const r = repo();
    const { result } = renderHook(() => useAuth(), { wrapper: ({ children }) => <AuthProvider repo={r}>{children}</AuthProvider> });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('restores an existing session', async () => {
    const r = repo({ getCurrentUser: vi.fn().mockResolvedValue(USER) });
    const { result } = renderHook(() => useAuth(), { wrapper: ({ children }) => <AuthProvider repo={r}>{children}</AuthProvider> });
    await waitFor(() => expect(result.current.user?.id).toBe('u1'));
  });

  it('login sets the user and logout clears it', async () => {
    const r = repo();
    const { result } = renderHook(() => useAuth(), { wrapper: ({ children }) => <AuthProvider repo={r}>{children}</AuthProvider> });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.login('ada@x.co', 'pw'); });
    expect(result.current.user?.name).toBe('Ada');
    await act(async () => { await result.current.logout(); });
    expect(result.current.user).toBeNull();
    expect(r.signOut).toHaveBeenCalled();
  });

  it('drops the user when the session ends elsewhere', async () => {
    let cb: ((s: boolean) => void) | undefined;
    const r = repo({ getCurrentUser: vi.fn().mockResolvedValue(USER), onAuthStateChange: vi.fn((f) => { cb = f; return () => undefined; }) });
    const { result } = renderHook(() => useAuth(), { wrapper: ({ children }) => <AuthProvider repo={r}>{children}</AuthProvider> });
    await waitFor(() => expect(result.current.user).not.toBeNull());
    act(() => cb?.(false));
    expect(result.current.user).toBeNull();
  });
});
