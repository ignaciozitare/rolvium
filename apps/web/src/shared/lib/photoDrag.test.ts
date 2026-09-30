import { describe, it, expect } from 'vitest';
import { decodePhotoDrag, encodePhotoDrag, isPhotoDrag, PHOTO_DRAG_MIME } from './photoDrag';

/**
 * EL CONTRATO DEL ARRASTRE de una foto a la escena (H13, rebanada 4). Es lo único que se dicen la galería y el
 * mapa, y lo que llega de un arrastre puede venir de cualquier parte: aquí se fija que lo que no sea
 * exactamente la forma esperada NO planta nada.
 */
describe('photoDrag — lo que viaja de la galería al mapa', () => {
  it('va y vuelve entero: el id y el tamaño natural', () => {
    const foto = { id: 'ph-1', width: 1024, height: 1280 };
    expect(decodePhotoDrag(encodePhotoDrag(foto))).toEqual(foto);
  });

  it('no arrastra de propina nada que no sea el id y las medidas', () => {
    const raw = encodePhotoDrag({ id: 'ph-1', width: 10, height: 20, name: 'El puente' } as never);
    // El NOMBRE no viaja: esta foto acaba en una fila que lee el jugador, y un nombre puede destripar.
    expect(JSON.parse(raw)).toEqual({ id: 'ph-1', width: 10, height: 20 });
  });

  it.each([
    ['vacío', ''],
    ['nada', null],
    ['no es JSON', 'esto no es json'],
    ['no es un objeto', '"ph-1"'],
    ['sin id', JSON.stringify({ width: 10, height: 20 })],
    ['id vacío', JSON.stringify({ id: '', width: 10, height: 20 })],
    ['sin medidas', JSON.stringify({ id: 'ph-1' })],
    ['medidas de texto', JSON.stringify({ id: 'ph-1', width: '10', height: '20' })],
    ['medidas negativas', JSON.stringify({ id: 'ph-1', width: -1, height: 20 })],
    ['medidas infinitas', JSON.stringify({ id: 'ph-1', width: Infinity, height: 20 })],
  ])('%s no planta nada', (_caso, raw) => {
    expect(decodePhotoDrag(raw)).toBeNull();
  });

  it('el mapa reconoce el arrastre por su TIPO, que es lo único que se puede mirar mientras vuela', () => {
    expect(isPhotoDrag([PHOTO_DRAG_MIME])).toBe(true);
    expect(isPhotoDrag(['text/plain', PHOTO_DRAG_MIME])).toBe(true);
    expect(isPhotoDrag(['text/plain'])).toBe(false);
    expect(isPhotoDrag([])).toBe(false);
    expect(isPhotoDrag(undefined)).toBe(false);
  });
});
