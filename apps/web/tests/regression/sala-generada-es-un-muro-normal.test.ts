import { describe, it, expect } from 'vitest';
import { newWallOf } from '@/modules/maps/domain/useCases/mapRules';
import { freehandSides, isClosed, polygonSides, roomSides } from '@/modules/maps/domain/useCases/roomRules';

/**
 * 🔒 REQUISITO CON NOMBRE DEL DUEÑO (2026-09-03):
 *
 * «Los muros, puertas y ventanas de ahora quedan como están a nivel funcional; los utilizo en el caso de que
 * diseñe un mapa con otra herramienta, lo importe y marque los muros. El constructor que estamos haciendo
 * ahora es para hacer mapas relativamente sencillos en Rolvium, **y la niebla de batalla debe funcionar con
 * estas construcciones también**.»
 *
 * Sale gratis por la decisión de que una habitación NO es una entidad nueva: produce muros de los de siempre.
 * Pero «sale gratis» es exactamente el tipo de cosa que se rompe sin que nadie se entere, así que se ata aquí:
 * lo que Builder levanta tiene que ser **indistinguible** de lo que él marca a mano sobre una foto.
 */
const G = 27;
/** Lo que hace el Builder de siempre al marcar un muro sobre una foto importada. */
const marcadoAMano = newWallOf('wall');

const salas = {
  rectángulo: roomSides('rect', { x: 0, y: 0 }, { x: 270, y: 189 }, G),
  círculo: roomSides('circle', { x: 300, y: 300 }, { x: 400, y: 300 }, G),
  polígono: polygonSides([{ x: 0, y: 0 }, { x: 270, y: 135 }, { x: 0, y: 270 }], G),
  'a pulso': freehandSides([{ x: 0, y: 0 }, { x: 150, y: 4 }, { x: 152, y: 150 }, { x: 3, y: 148 }], G),
};

describe('lo que levanta Builder es un muro de los de siempre', () => {
  for (const [forma, sides] of Object.entries(salas)) {
    it(`${forma}: cada lado nace opaco, macizo y cerrado, igual que uno marcado a mano`, () => {
      expect(sides.length).toBeGreaterThanOrEqual(3);
      expect(isClosed(sides)).toBe(true);
      for (const side of sides) {
        // Así es exactamente como SceneTab compone la fila que se guarda en `maps_walls`.
        const wall = { ...side, ...newWallOf('wall') };
        expect(wall.kind).toBe(marcadoAMano.kind);
        expect(wall.blocksSight).toBe(true);
        expect(wall.blocksMove).toBe(true);
        expect(wall.isOpen).toBe(false);
      }
    });
  }

  /**
   * La niebla y la visión se calculan en el servidor contra TODOS los muros, sin mirar quién los puso. Si un
   * día una sala generada llevase una marca propia, este test es el que avisaría.
   */
  it('no hay ninguna marca que distinga una sala generada de un muro marcado a mano', () => {
    const generado = { ...salas.rectángulo[0]!, ...newWallOf('wall') };
    expect(Object.keys(generado).sort()).toEqual(['blocksMove', 'blocksSight', 'isOpen', 'kind', 'x1', 'x2', 'y1', 'y2']);
  });
});
