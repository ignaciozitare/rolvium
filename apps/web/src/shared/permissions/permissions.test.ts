import { describe, it, expect } from 'vitest';
import { hasPermission, hasModule, hasTool, isAdmin, hasAnyAdminPermission } from './permissions';

const u = (over: Partial<{ role: string; active: boolean; modules: string[]; admin: Record<string, boolean>; tools: Record<string, boolean> }> = {}) => ({
  role: over.role ?? 'player',
  active: over.active ?? true,
  permissions: { modules: over.modules ?? [], admin: over.admin ?? {}, tools: over.tools ?? {} },
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

/**
 * 🔒 LOS PERMISOS DE HERRAMIENTA, Y LA TRAMPA QUE NO PUEDE VOLVER.
 *
 * Aviso suyo del 2026-09-04: «*cuidado con el tema roles, que tenemos un motor de roles y permisos en la
 * herramienta, ojo con cagarla aquí*». La trampa era real y estaba comprobada antes de tocar nada: quién ve
 * «Administración» se decide con `hasAnyAdminPermission`, que mira TODO lo que haya dentro de `admin`. Si un
 * permiso de herramienta hubiera vivido ahí, dárselo a los directores les habría puesto «Administración» en
 * el menú a todos — y al entrar, una pantalla vacía.
 *
 * Estos tests son el cepo de eso. Si alguien mueve un permiso de herramienta al cajón de administración, o
 * hace que `hasAnyAdminPermission` mire `tools`, aquí se entera.
 */
describe('permisos de herramienta — el cajón aparte', () => {
  it('un permiso de herramienta NO abre «Administración»', () => {
    const dm = u({ role: 'game_master', tools: { manage_textures: true } });
    expect(hasTool(dm, 'manage_textures')).toBe(true);
    expect(hasAnyAdminPermission(dm)).toBe(false);          // ← el cepo
  });

  it('y no se cuela por la puerta de los de administración', () => {
    const dm = u({ role: 'game_master', tools: { manage_textures: true } });
    expect(hasPermission(dm, 'manage_users')).toBe(false);
    expect(hasPermission(dm, 'manage_roles')).toBe(false);
    expect(hasPermission(dm, 'manage_settings')).toBe(false);
  });

  it('al revés tampoco: tener permisos de administración no da los de herramienta', () => {
    expect(hasTool(u({ admin: { manage_users: true } }), 'manage_textures')).toBe(false);
  });

  it('el admin lo tiene por definición, sin que se le escriba nada', () => {
    // Y es importante que sea así: el trigger de la base PROHÍBE tocar los permisos del rol admin.
    expect(hasTool(u({ role: 'admin' }), 'manage_textures')).toBe(true);
    expect(hasTool(u({ role: 'admin', tools: {} }), 'manage_textures')).toBe(true);
  });

  it('sin el permiso, no; y un usuario bloqueado no tiene nada', () => {
    expect(hasTool(u(), 'manage_textures')).toBe(false);
    expect(hasTool(u({ tools: { manage_textures: false } }), 'manage_textures')).toBe(false);
    expect(hasTool(u({ role: 'admin', active: false }), 'manage_textures')).toBe(false);
    expect(hasTool(u({ active: false, tools: { manage_textures: true } }), 'manage_textures')).toBe(false);
  });

  /** Las filas de antes del cajón no lo tienen, y eso no puede reventar: la ausencia es «ninguno». */
  it('un rol SIN el cajón `tools` no revienta: simplemente no tiene ninguno', () => {
    const viejo = { role: 'player', active: true, permissions: { modules: [], admin: {} } };
    expect(hasTool(viejo, 'manage_textures')).toBe(false);
    expect(hasAnyAdminPermission(viejo)).toBe(false);
  });
});
