import { describe, it, expect } from 'vitest';
import { errorText } from './errorText';

/**
 * El fallo que motivó esto salió MIRANDO la app: un aviso rojo que decía «[object Object]». Los errores de
 * Supabase no son `Error`, son objetos planos, y `String(e)` los convierte en eso. Un aviso que no dice nada
 * es peor que ninguno.
 */
describe('errorText', () => {
  it('un error de Supabase enseña su mensaje, no «[object Object]»', () => {
    expect(errorText({ message: 'permission denied for table bestiary_entries', code: '42501' }))
      .toBe('permission denied for table bestiary_entries');
  });

  it('un Error normal enseña su mensaje', () => {
    expect(errorText(new Error('sin permiso'))).toBe('sin permiso');
  });

  it('una cadena se devuelve tal cual', () => {
    expect(errorText('boom')).toBe('boom');
  });

  /** Sin `message` se tira de lo siguiente legible antes de rendirse: un código es feo pero es buscable. */
  it('sin mensaje, cae a details, luego a hint, luego al código', () => {
    expect(errorText({ details: 'la fila viola la política' })).toBe('la fila viola la política');
    expect(errorText({ hint: 'revisa el GRANT' })).toBe('revisa el GRANT');
    expect(errorText({ code: '42501' })).toBe('42501');
  });

  it('un mensaje vacío no gana: se sigue buscando algo que decir', () => {
    expect(errorText({ message: '   ', code: '42501' })).toBe('42501');
  });

  it('lo que no se pueda leer nunca sale como «[object Object]»', () => {
    for (const v of [null, undefined, {}, 42, [], new Error('')]) expect(errorText(v)).toBe('Error');
  });
});
