import { describe, it, expect } from 'vitest';
import { circleClearance, METRES_PER_CELL, segSegDist, sightRadiusPx, slideCircle, type ScenePoint } from './maps';

describe('sightRadiusPx', () => {
  it('by day the geometry is the only limit: there is no radius', () => {
    expect(sightRadiusPx('day', 9, 27)).toBeNull();
    expect(sightRadiusPx('day', 0, 27)).toBeNull();
  });

  it('by night it turns metres into scene px through the grid', () => {
    // 9 m / 1,5 m per cell = 6 cells · 27 px = 162 px
    expect(sightRadiusPx('night', 9, 27)).toBe(162);
    expect(sightRadiusPx('night', 3, 40)).toBe(80);
  });

  it('a system with another scale passes its own metres per cell', () => {
    expect(sightRadiusPx('night', 9, 27, 3)).toBe(81);
    expect(sightRadiusPx('night', 9, 27, METRES_PER_CELL)).toBe(sightRadiusPx('night', 9, 27));
  });

  it('a night with no radius is total darkness, not unlimited sight', () => {
    expect(sightRadiusPx('night', 0, 27)).toBe(0);
  });
});

/**
 * La física de los tokens vive en `core` y no en una de las dos orillas porque la usan LAS DOS: el navegador
 * para que el arrastre se sienta al instante, y el servidor —el único que tiene los muros secretos— para
 * tener la última palabra. Si viviera en una sola, un día dirían cosas distintas.
 */
describe('slideCircle / segSegDist — paredes sólidas (rebanada 4)', () => {
  const MURO = [100, 0, 100, 200] as const;   // vertical en x = 100

  it('segSegDist da 0 cuando se cruzan, y la separación real cuando no', () => {
    expect(segSegDist({ x: 0, y: 100 }, { x: 200, y: 100 }, { x: 100, y: 0 }, { x: 100, y: 200 })).toBe(0);
    expect(segSegDist({ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 200 })).toBe(50);
    // paralelos, que es donde el cálculo por intersección no sirve
    expect(segSegDist({ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 30, y: 0 }, { x: 30, y: 100 })).toBe(30);
  });

  /**
   * EL FALLO QUE VIO EL DUEÑO EN LA APP (2026-08-22): empujar de FRENTE devolvía el punto de salida — el
   * token saltaba a su posición inicial en vez de quedarse pegado a la pared. Este test lo fijaba como
   * comportamiento correcto (`toEqual({x: 50})`). Ahora se avanza hasta el contacto: el muro está en x = 100
   * y el cuerpo mide 10, así que se queda en ~89,5 (muro − radio − holgura), y sin cruzar jamás.
   */
  it('mira el CAMINO y AVANZA: empujar de frente deja el cuerpo pegado al muro, ni lo cruza ni vuelve atrás', () => {
    const r = slideCircle({ x: 50, y: 100 }, { x: 150, y: 100 }, 10, [MURO]);
    expect(r.x).toBeCloseTo(89.5, 3);
    expect(r.y).toBeCloseTo(100, 6);
  });

  it('resbala pegado a la pared: avanza hasta tocarla y el resto del movimiento baja a lo largo', () => {
    const r = slideCircle({ x: 50, y: 100 }, { x: 150, y: 160 }, 10, [MURO]);
    expect(r.x).toBeCloseTo(89.5, 3);
    expect(r.y).toBeCloseTo(160, 3);
  });

  it('quien ya está pegado no se queda clavado: más adentro no, pero resbala a lo largo y se aleja libre', () => {
    const pegado = { x: 89.5, y: 100 };
    const empuje = slideCircle(pegado, { x: 150, y: 100 }, 10, [MURO]);
    expect(empuje.x).toBeCloseTo(89.5, 3);
    const diagonal = slideCircle(pegado, { x: 150, y: 160 }, 10, [MURO]);
    expect(diagonal.x).toBeCloseTo(89.5, 3);
    expect(diagonal.y).toBeCloseTo(160, 3);
    expect(slideCircle(pegado, { x: 30, y: 100 }, 10, [MURO])).toEqual({ x: 30, y: 100 });
  });

  it('un muro en DIAGONAL también frena y también deja resbalar (los ejes no bastaban)', () => {
    const diag = [0, 0, 200, 200] as const; // la recta y = x
    // empujón perpendicular: se queda pegado a la recta, a radio + holgura, en el lado del que venía
    const frontal = slideCircle({ x: 120, y: 60 }, { x: 60, y: 120 }, 10, [diag]);
    expect((frontal.x - frontal.y) / Math.SQRT2).toBeCloseTo(10.5, 2);
    // empujón oblicuo: resbala a lo largo de la recta sin despegarse
    const oblicuo = slideCircle({ x: 120, y: 60 }, { x: 40, y: 60 }, 10, [diag]);
    expect((oblicuo.x - oblicuo.y) / Math.SQRT2).toBeCloseTo(10.5, 2);
    expect(oblicuo.y).toBeLessThan(59);
  });

  it('el cuerpo entero cuenta: el hueco por el que pasa un radio pequeño no deja pasar uno grande', () => {
    const hueco = [[100, 0, 100, 80], [100, 120, 100, 200]] as const;
    expect(slideCircle({ x: 60, y: 100 }, { x: 140, y: 100 }, 8, hueco)).toEqual({ x: 140, y: 100 });
    // el grande avanza hasta que su cuerpo toca las esquinas del hueco, y ahí se queda — sin colarse
    const grande = slideCircle({ x: 60, y: 100 }, { x: 140, y: 100 }, 30, hueco);
    expect(grande.x).toBeCloseTo(100 - Math.sqrt(30.5 ** 2 - 20 ** 2), 2);
    expect(grande.y).toBeCloseTo(100, 6);
  });

  it('sin muros que bloqueen, va donde le pidan', () => {
    expect(slideCircle({ x: 50, y: 100 }, { x: 150, y: 100 }, 10, [])).toEqual({ x: 150, y: 100 });
  });

  it('circleClearance: cuánto puede moverse el centro en cualquier dirección sin que hubiera recorte', () => {
    expect(circleClearance({ x: 50, y: 100 }, 10, [])).toBe(Infinity);
    // hasta el muro en x = 100: 50 de hueco, menos el cuerpo (10) y la holgura (0,5)
    expect(circleClearance({ x: 50, y: 100 }, 10, [MURO])).toBeCloseTo(39.5, 6);
    // pegado al muro: cero — y nunca negativo
    expect(circleClearance({ x: 89.5, y: 100 }, 10, [MURO])).toBeCloseTo(0, 6);
    expect(circleClearance({ x: 95, y: 100 }, 10, [MURO])).toBe(0);
  });

  it('quien YA estaba dentro de un muro no se queda encerrado', () => {
    expect(slideCircle({ x: 100, y: 100 }, { x: 105, y: 100 }, 10, [MURO])).toEqual({ x: 105, y: 100 });
  });

  /**
   * 🐞 EL TRABÓN DE LA ESQUINA (suyo, 2026-09-08: «*si toco una esquina se pega y sólo se destraba si muevo
   * el puntero en la dirección contraria*»).
   *
   * El rebote proyectaba el movimiento sobrante a lo largo «del muro más cercano al punto de contacto», y en
   * una esquina los dos están a la MISMA distancia: el desempate cogía siempre el primero de la lista, así
   * que UNA de las dos salidas de cada esquina quedaba muerta y la otra funcionaba. Por eso el fallo parecía
   * caprichoso. Los dos sentidos se prueban aquí: si vuelve el desempate, uno de los dos se queda a cero.
   */
  describe('la esquina no atrapa a nadie', () => {
    const ESQUINA = [[0, 0, 600, 0], [0, 0, 0, 600]] as const; // muro de arriba y muro izquierdo
    const R = 35;
    const enLaEsquina = { x: 35.5, y: 35.5 };                  // aparcado en el vértice, a radio + holgura

    it('con el dedo METIDO en el muro izquierdo, baja a lo largo de él', () => {
      const r = slideCircle(enLaEsquina, { x: 10, y: 300 }, R, ESQUINA);
      expect(r.x).toBeCloseTo(35.5, 2);
      expect(r.y).toBeCloseTo(300, 2);
    });

    it('con el dedo METIDO en el muro de arriba, va a lo largo de él', () => {
      const r = slideCircle(enLaEsquina, { x: 300, y: 10 }, R, ESQUINA);
      expect(r.x).toBeCloseTo(300, 2);
      expect(r.y).toBeCloseTo(35.5, 2);
    });

    it('y sigue sin poder cruzar: hacia fuera por el vértice se queda en la esquina', () => {
      const r = slideCircle(enLaEsquina, { x: -100, y: -100 }, R, ESQUINA);
      expect(r.x).toBeCloseTo(35.5, 2);
      expect(r.y).toBeCloseTo(35.5, 2);
    });

    /**
     * Y LAS CUATRO ESQUINAS, CON EL DEDO YA PASADO AL OTRO LADO DE LA PARED — que es lo que pasa de verdad
     * al empujar contra un muro y seguir tirando, y donde `nearestFree` no llega: el destino sigue siendo
     * ilegal, así que quien decide es el desempate del rebote.
     *
     * Cada esquina tiene DOS salidas y las dos tienen que valer. Con el desempate viejo, en cada esquina una
     * de las dos quedaba muerta: cuatro de estos ocho casos devolvían la esquina sin moverse ni un píxel.
     * Se prueban las cuatro esquinas y no una porque de qué salida se moría dependía del ORDEN de la lista
     * de muros, no de la geometría.
     */
    const S = 600;
    const SALA = [[0, 0, S, 0], [S, 0, S, S], [S, S, 0, S], [0, S, 0, 0]] as const;
    const salidas: Array<[string, ScenePoint, ScenePoint, ScenePoint]> = [
      ['sup-izq, dedo pasado el muro izquierdo', { x: 35.5, y: 35.5 }, { x: -50, y: 300 }, { x: 35.5, y: 300 }],
      ['sup-izq, dedo pasado el muro de arriba', { x: 35.5, y: 35.5 }, { x: 300, y: -50 }, { x: 300, y: 35.5 }],
      ['sup-der, dedo pasado el muro derecho  ', { x: S - 35.5, y: 35.5 }, { x: S + 50, y: 300 }, { x: S - 35.5, y: 300 }],
      ['sup-der, dedo pasado el muro de arriba', { x: S - 35.5, y: 35.5 }, { x: 300, y: -50 }, { x: 300, y: 35.5 }],
      ['inf-der, dedo pasado el muro derecho  ', { x: S - 35.5, y: S - 35.5 }, { x: S + 50, y: 300 }, { x: S - 35.5, y: 300 }],
      ['inf-der, dedo pasado el muro de abajo ', { x: S - 35.5, y: S - 35.5 }, { x: 300, y: S + 50 }, { x: 300, y: S - 35.5 }],
      ['inf-izq, dedo pasado el muro izquierdo', { x: 35.5, y: 35.5 + S - 71 }, { x: -50, y: 300 }, { x: 35.5, y: 300 }],
      ['inf-izq, dedo pasado el muro de abajo ', { x: 35.5, y: S - 35.5 }, { x: 300, y: S + 50 }, { x: 300, y: S - 35.5 }],
    ];
    it.each(salidas)('%s: resbala por la otra pared', (_nombre, desde, dedo, esperado) => {
      const r = slideCircle(desde, dedo, R, SALA);
      expect(r.x).toBeCloseTo(esperado.x, 2);
      expect(r.y).toBeCloseTo(esperado.y, 2);
    });
  });

  /**
   * La otra mitad del mismo arreglo: perseguir el punto legal más cercano al dedo NO puede convertirse en un
   * atajo para cruzar. Con el dedo al otro lado del muro, el punto legal más cercano cae también al otro
   * lado — y el barrido lo rechaza igual que antes.
   */
  it('el punto legal más cercano nunca abre la pared: el dedo al otro lado sigue sin pasar', () => {
    const r = slideCircle({ x: 50, y: 100 }, { x: 105, y: 100 }, 10, [MURO]);
    expect(r.x).toBeCloseTo(89.5, 3);
    expect(r.y).toBeCloseTo(100, 6);
  });
});
