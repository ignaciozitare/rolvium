import { describe, it, expect } from 'vitest';
import { DbError, dbError, reasonOf } from './errors';

describe('dbError / reasonOf', () => {
  it('deja pasar un Error de verdad tal cual', () => {
    const e = new Error('boom');
    expect(dbError(e)).toBe(e);
    expect(reasonOf(e)).toBe('boom');
  });
  /** El caso que costó un personaje: supabase-js lanza un objeto plano, y `instanceof Error` es false. */
  it('envuelve el objeto plano de supabase y conserva motivo, hint, detalle y código', () => {
    const pg = { message: 'permission denied for table characters', details: 'fila 1', hint: 'GRANT SELECT ON public.characters TO authenticated;', code: '42501' };
    expect(pg instanceof Error).toBe(false);
    const e = dbError(pg);
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(DbError);
    expect((e as DbError).code).toBe('42501');
    expect(e.message).toBe('permission denied for table characters · GRANT SELECT ON public.characters TO authenticated; · fila 1 [42501]');
  });
  it('un error sin hint ni detalle sale limpio', () => {
    expect(dbError({ message: 'JWT expired', code: 'PGRST301' }).message).toBe('JWT expired [PGRST301]');
  });
  it('una cadena suelta también es un motivo', () => {
    expect(reasonOf('nope')).toBe('nope');
  });
  /** «Falló y no sé por qué» no es lo mismo que un motivo: `reasonOf` devuelve null y la pantalla avisa sin inventar. */
  it('sin nada legible devuelve null, no la palabra unknown_error', () => {
    expect(reasonOf(undefined)).toBeNull();
    expect(reasonOf({})).toBeNull();
    expect(dbError({}).message).toBe('unknown_error');
  });
});
