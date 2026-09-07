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

/**
 * 🐞 EL IMÁN NO PUEDE ANULAR EL GESTO QUE ESTÁ AYUDANDO A COLOCAR.
 *
 * Su fallo del 2026-09-04: «*si hago click para crear un muro muy cerca de otro muro no me deja ponerlo, es
 * como que hay un límite que has puesto*». No era un límite de tamaño: era este imán. Dibujando pegado a una
 * punta ajena se tragaba las DOS puntas del gesto y las dejaba encima de la misma, así que el muro salía de
 * largo cero y se caía sin decir nada. Reproducido antes de tocar nada, sobre el lienzo y aquí.
 */
describe('el imán y el gesto de largo cero', () => {
  it('la segunda punta NO puede pegarse a donde ya se pegó la primera', () => {
    // Las dos caen a menos de 12 px de (270,216), que es donde arranca WALL_1.
    const a = builderPoint({ x: 274, y: 219 }, G, false, MUROS);
    const b = builderPoint({ x: 276, y: 222 }, G, false, MUROS, END_SNAP_PX, undefined, a);
    expect(a).toEqual({ x: 270, y: 216 });
    // Sin `avoid`, `b` valdría lo mismo que `a` y el muro mediría cero.
    expect(builderPoint({ x: 276, y: 222 }, G, false, MUROS)).toEqual(a);
    expect(b).toEqual({ x: 276, y: 222 });
  });

  it('el imán sigue funcionando con OTRAS puntas: sólo se descarta la ya usada', () => {
    // WALL_1 acaba en (270,540), que es donde empieza WALL_VISIBLE: pegarse ahí sigue estando bien.
    const a = { x: 270, y: 216 };
    expect(builderPoint({ x: 272, y: 537 }, G, false, MUROS, END_SNAP_PX, undefined, a)).toEqual({ x: 270, y: 540 });
  });

  it('sin `avoid` no cambia nada de lo de antes', () => {
    expect(nearestEnd(MUROS, { x: 274, y: 219 })).toEqual({ x: 270, y: 216 });
    expect(nearestEnd(MUROS, { x: 274, y: 219 }, END_SNAP_PX, undefined, null)).toEqual({ x: 270, y: 216 });
  });

  it('con el candado ECHADO el imán no pinta nada, y `avoid` tampoco', () => {
    expect(builderPoint({ x: 274, y: 219 }, G, true, MUROS, END_SNAP_PX, undefined, { x: 270, y: 216 }))
      .toEqual({ x: 270, y: 216 });
  });
});
