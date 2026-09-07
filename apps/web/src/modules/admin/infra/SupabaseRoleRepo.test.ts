import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseMock } from '../../../../tests/helpers/supabaseMock';
import { SupabaseRoleRepo, mapRoleRow } from './SupabaseRoleRepo';

const ROLE_ROW = {
  id: 'r-gm', name: 'game_master', description: 'Runs games', is_system: true,
  permissions: { modules: [], admin: {}, tools: { manage_textures: true } },
  created_at: 't',
};

/**
 * 🔒 EL CAJÓN `tools` TIENE QUE VIAJAR ENTERO DESDE LA BASE.
 *
 * Es la parte silenciosa del motor de permisos: si el mapeador se olvida de `tools`, el rol llega a la
 * pantalla SIN sus permisos de herramienta, la casilla sale apagada, y al primer clic en cualquier otro
 * interruptor se persiste el objeto sin `tools` — borrándole el permiso al rol sin que nadie lo pida.
 */
describe('SupabaseRoleRepo — el mapeador de filas', () => {
  it('trae los tres cajones: `modules`, `admin` y `tools`', () => {
    expect(mapRoleRow(ROLE_ROW)).toMatchObject({
      id: 'r-gm', name: 'game_master', isSystem: true,
      permissions: { modules: [], admin: {}, tools: { manage_textures: true } },
    });
  });

  it('una fila de ANTES del cajón se lee sin permisos de herramienta, no reventada', () => {
    // Ninguna fila de hoy tiene `tools`: la migración no lo rellena a propósito (el trigger
    // `roles_guard_system` prohíbe tocar los permisos del rol admin, y un relleno general la reventaría).
    const vieja = { ...ROLE_ROW, permissions: { modules: ['campaigns'], admin: { manage_users: true } } };
    expect(mapRoleRow(vieja as never).permissions).toEqual({ modules: ['campaigns'], admin: { manage_users: true }, tools: {} });
  });

  it('una fila con `permissions` a nulo no deja el rol a medias', () => {
    expect(mapRoleRow({ ...ROLE_ROW, permissions: null }).permissions).toEqual({ modules: [], admin: {}, tools: {} });
  });
});

describe('SupabaseRoleRepo — escrituras', () => {
  it('guardar los permisos manda el JSON entero, con `tools` dentro', async () => {
    const m = createSupabaseMock({ tables: { roles: { data: null, error: null } } });
    const repo = new SupabaseRoleRepo(m.client as unknown as SupabaseClient);
    await repo.updatePermissions('r-gm', { modules: [], admin: {}, tools: { manage_textures: true } });
    expect(m.fromSpy).toHaveBeenCalledWith('roles');
    expect(m.updateSpy).toHaveBeenCalledWith({ permissions: { modules: [], admin: {}, tools: { manage_textures: true } } });
  });

  it('un rol nuevo nace con los tres cajones vacíos — sin herramientas ni administración', async () => {
    const m = createSupabaseMock({ tables: { roles: { data: { ...ROLE_ROW, id: 'r-new', name: 'invitado', permissions: { modules: [], admin: {}, tools: {} } }, error: null } } });
    const repo = new SupabaseRoleRepo(m.client as unknown as SupabaseClient);
    const creado = await repo.create({ name: 'invitado', description: 'Invitado' });
    expect(m.insertSpy).toHaveBeenCalledWith({ name: 'invitado', description: 'Invitado', permissions: { modules: [], admin: {}, tools: {} } });
    expect(creado.permissions.tools).toEqual({});
  });

  it('un error de RLS sube, no se traga', async () => {
    const m = createSupabaseMock({ tables: { roles: { data: null, error: new Error('rls') } } });
    const repo = new SupabaseRoleRepo(m.client as unknown as SupabaseClient);
    await expect(repo.findAll()).rejects.toThrow('rls');
  });
});
