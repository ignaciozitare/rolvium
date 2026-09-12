import { describe, it, expect } from 'vitest';
import {
  fogOpOf, layerPaintPath, layerPaintSrc, PAINT_ON, paintActionsFor, paintsWithStuff, rockPaintPath,
  rockPaintSrc, roomPaintPath, roomPaintSrc,
} from './paintRules';

/**
 * 🖌 EL PINCEL QUE PINTA ENCIMA (§ «Rebanada 10 · A»). Lo que sujetan estos tests es lo que él dijo con la
 * pantalla delante — no detalles de implementación.
 */
describe('paintRules', () => {
  /** Los cuatro del diseño aprobado (`TlJot` § S/1) y EN SU ORDEN: habitación, muro, foto, niebla. */
  it('ofrece los cuatro destinos en el orden de la lámina', () => {
    expect(PAINT_ON).toEqual(['room', 'rock', 'layer', 'fog']);
  });

  /**
   * 🔒 LO QUE NO SE PUEDE HACER NO SALE. Destapar sólo tiene sentido donde hay algo debajo que enseñar: una
   * sala y una foto. La roca no guarda máscara y la niebla es sí o no.
   */
  it('sólo ofrece destapar donde hay algo debajo', () => {
    expect(paintActionsFor('room')).toEqual(['paint', 'erase', 'uncover']);
    expect(paintActionsFor('layer')).toEqual(['paint', 'erase', 'uncover']);
    expect(paintActionsFor('rock')).toEqual(['paint', 'erase']);
    expect(paintActionsFor('fog')).toEqual(['paint', 'erase']);
  });

  /** En la niebla no se elige textura ni color: no es pintura, es sí o no. */
  it('la niebla no se pinta con nada; los otros tres sí', () => {
    expect(paintsWithStuff('fog')).toBe(false);
    for (const on of ['room', 'rock', 'layer'] as const) expect(paintsWithStuff(on)).toBe(true);
  });

  /** Pintar niebla es OCULTAR y borrarla es REVELAR: la herramienta de la rebanada 2, sin tocar. */
  it('traduce la niebla a ocultar y revelar', () => {
    expect(fogOpOf('paint')).toBe('hide');
    expect(fogOpOf('erase')).toBe('reveal');
    expect(fogOpOf('uncover')).toBe('reveal');
  });

  /**
   * 🔑 EL RECORTE SALE DE DÓNDE SE GUARDA. Cada cosa pintada tiene su propio fichero, y la campaña es el
   * primer tramo — que es lo único que miran las políticas del bucket, así que no hace falta ninguna nueva.
   */
  it('guarda un PNG por cosa pintada, con la campaña por delante', () => {
    expect(roomPaintPath('c1', 'r9')).toBe('c1/paint/room-r9.png');
    expect(rockPaintPath('c1', 's3')).toBe('c1/paint/rock-s3.png');
    expect(layerPaintPath('c1', 'l7')).toBe('c1/paint/layer-l7.png');
  });

  /** Sin pintar, no hay nada que dibujar: `null` y no una cadena vacía, que en un `href` pintaría un roto. */
  it('sin pintura devuelve nulo', () => {
    expect(roomPaintSrc({ floorPaintUrl: null, updatedAt: 't' })).toBeNull();
    expect(rockPaintSrc({ rockPaintUrl: null, updatedAt: 't' })).toBeNull();
    expect(layerPaintSrc({ paintUrl: null, paintVersion: 3 })).toBeNull();
  });

  /**
   * 🐞 EL ROMPE-CACHÉ, que es lo que hace que el pincel PAREZCA que pinta: el navegador cachea el PNG por su
   * dirección. Cada tabla usa la convención que ya tenía — fecha en sala y escena, versión en capa.
   */
  it('pega el rompe-caché que le toca a cada uno', () => {
    expect(roomPaintSrc({ floorPaintUrl: 'https://x/p.png', updatedAt: '2026-09-10T10:00:00Z' }))
      .toBe('https://x/p.png?v=2026-09-10T10%3A00%3A00Z');
    expect(rockPaintSrc({ rockPaintUrl: 'https://x/p.png', updatedAt: '2026-09-10T10:00:00Z' }))
      .toBe('https://x/p.png?v=2026-09-10T10%3A00%3A00Z');
    expect(layerPaintSrc({ paintUrl: 'https://x/p.png', paintVersion: 4 })).toBe('https://x/p.png?v=4');
  });

  /** Una URL que ya trae interrogante no se rompe: el segundo parámetro va con `&`. */
  it('respeta una url que ya lleva parámetros', () => {
    expect(layerPaintSrc({ paintUrl: 'https://x/p.png?token=1', paintVersion: 2 })).toBe('https://x/p.png?token=1&v=2');
  });
});
