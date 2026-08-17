import { describe, it, expect } from 'vitest';
import { hasPermission, assertPermission, ForbiddenError } from './authorize.js';

const base = { active: true, role: 'player', permissions: { modules: [], admin: {} } };

describe('authorize', () => {
  it('admin bypasses every permission', () => {
    expect(hasPermission({ ...base, role: 'admin' }, 'manage_users')).toBe(true);
  });
  it('inactive users have no permissions, even admin', () => {
    expect(hasPermission({ ...base, role: 'admin', active: false }, 'manage_users')).toBe(false);
  });
  it('granular permission from role JSON', () => {
    const p = { ...base, permissions: { modules: [], admin: { manage_roles: true } } };
    expect(hasPermission(p, 'manage_roles')).toBe(true);
    expect(hasPermission(p, 'manage_users')).toBe(false);
  });
  it('assertPermission throws ForbiddenError', () => {
    expect(() => assertPermission(base, 'manage_users')).toThrow(ForbiddenError);
    expect(() => assertPermission({ ...base, role: 'admin' }, 'manage_users')).not.toThrow();
  });
});
