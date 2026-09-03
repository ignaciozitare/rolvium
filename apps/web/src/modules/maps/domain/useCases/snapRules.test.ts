import { describe, it, expect } from 'vitest';
import { WALL_1, WALL_VISIBLE } from '../../../../../tests/helpers/fakes';
import { anchorEnd, builderPoint, END_SNAP_PX, nearestEnd, stepOf } from './snapRules';

/**
 * EL CANDADO DE PEGAR A LA REJILLA, aprobado el 2026-09-03 con tres condiciones. Cada una tiene aquí su test,
 * porque las tres son la diferencia entre un candado útil y un mapa lleno de rendijas.
 */

const G = 27;
/** `WALL_1` va de (270,216) a (270,540); `WALL_VISIBLE`, de (270,540) a (540,540). */
const MUROS = [WALL_1, WALL_VISIBLE];

describe('stepOf — el paso al que se pega Builder', () => {
  it('cerrado es la rejilla; abierto no es ningún paso', () => {
    expect(stepOf(G, true)).toBe(G);
    expect(stepOf(G, false)).toBe(0);
  });
});

describe('nearestEnd — el imán de las puntas', () => {
  it('coge la punta de muro más cercana dentro del radio', () => {
    expect(nearestEnd(MUROS, { x: 274, y: 219 })).toEqual({ x: 270, y: 216 });
  });

  it('no coge nada si no hay ninguna a tiro', () => {
    expect(nearestEnd(MUROS, { x: 274 + END_SNAP_PX * 3, y: 219 })).toBeNull();
  });

  it('entre dos puntas a distinta distancia se queda con la más cerca', () => {
    // (270,540) es punta de los DOS muros; (270,216) está lejísimos de ahí.
    expect(nearestEnd(MUROS, { x: 268, y: 538 })).toEqual({ x: 270, y: 540 });
  });

  it('`skipId` deja fuera al muro que se está editando: una punta no se pega a la suya', () => {
    expect(nearestEnd(MUROS, { x: 272, y: 214 }, END_SNAP_PX, WALL_1.id)).toBeNull();
  });
});

describe('builderPoint — dónde cae de verdad el gesto', () => {
  /** 1ª condición: con el candado cerrado, Builder se comporta EXACTAMENTE como antes de que existiera. */
  it('cerrado se pega a la rejilla, y punto: ni mira los muros', () => {
    expect(builderPoint({ x: 274, y: 219 }, G, true, MUROS)).toEqual({ x: 270, y: 216 });
    expect(builderPoint({ x: 100, y: 100 }, G, true, MUROS)).toEqual({ x: 108, y: 108 });
  });

  /** 3ª condición: abierto no vale «libre a secas» — sin el imán quedan rendijas y por ahí se cuela la vista. */
  it('abierto va libre, pero la punta de otro muro tira de él', () => {
    expect(builderPoint({ x: 100, y: 100 }, G, false, MUROS)).toEqual({ x: 100, y: 100 });
    expect(builderPoint({ x: 274, y: 219 }, G, false, MUROS)).toEqual({ x: 270, y: 216 });
  });

  it('abierto y sin muros cerca, el punto se queda tal cual — con decimales incluidos', () => {
    expect(builderPoint({ x: 100.4, y: 33.7 }, G, false, [])).toEqual({ x: 100.4, y: 33.7 });
  });
});

describe('anchorEnd — la punta que se arrastra', () => {
  const suelto = { x1: 0, y1: 0, x2: 273, y2: 219 };

  it('pega la punta B a la punta de otro muro', () => {
    expect(anchorEnd(suelto, 'b', MUROS)).toEqual({ x1: 0, y1: 0, x2: 270, y2: 216 });
  });

  it('pega la punta A, y no toca la otra', () => {
    expect(anchorEnd({ x1: 273, y1: 219, x2: 800, y2: 800 }, 'a', MUROS))
      .toEqual({ x1: 270, y1: 216, x2: 800, y2: 800 });
  });

  it('moviendo el muro ENTERO no se pega nada: pegar una sola punta lo torcería', () => {
    expect(anchorEnd(suelto, 'whole', MUROS)).toEqual(suelto);
  });

  it('sin ninguna punta a tiro, el segmento se queda como estaba', () => {
    expect(anchorEnd({ x1: 0, y1: 0, x2: 40, y2: 40 }, 'b', MUROS)).toEqual({ x1: 0, y1: 0, x2: 40, y2: 40 });
  });
});
