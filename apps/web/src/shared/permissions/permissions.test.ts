import { describe, it, expect } from 'vitest';
import { hasPermission, hasModule, isAdmin, hasAnyAdminPermission } from './permissions';

const u = (over: Partial<{ role: string; active: boolean; modules: string[]; admin: Record<string, boolean> }> = {}) => ({
  role: over.role ?? 'player',
  active: over.active ?? true,
  permissions: { modules: over.modules ?? [], admin: over.admin ?? {} },
});

describe('permissions', () => {
  it('admin bypasses everything', () => {
    expect(isAdmin(u({ role: 'admin' }))).toBe(true);
    expect(hasPermission(u({ role: 'admin' }), 'manage_roles')).toBe(true);
    expect(hasModule(u({ role: 'admin' }), 'campaigns')).toBe(true);
  });
  it('inactive gets nothing', () => {
    expect(hasPermission(u({ role: 'admin', active: false }), 'manage_users')).toBe(false);
    expect(hasModule(u({ modules: ['x'], active: false }), 'x')).toBe(false);
  });
  it('granular checks read the role JSON', () => {
    expect(hasPermission(u({ admin: { manage_users: true } }), 'manage_users')).toBe(true);
    expect(hasPermission(u({ admin: { manage_users: true } }), 'manage_roles')).toBe(false);
    expect(hasModule(u({ modules: ['campaigns'] }), 'campaigns')).toBe(true);
    expect(hasAnyAdminPermission(u())).toBe(false);
    expect(hasAnyAdminPermission(u({ admin: { manage_settings: true } }))).toBe(true);
  });
  it('null user is denied', () => {
    expect(hasPermission(null, 'manage_users')).toBe(false);
  });
});
