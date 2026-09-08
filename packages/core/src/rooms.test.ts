import { describe, expect, it } from 'vitest';
import type { BlockSegment, ScenePoint } from './maps';
import { digs, fills, orientRing, pointInRing, roomMoveSegments, roomOutline, roomSightSegments, roomWalls, type RoomRing } from './rooms';

/**
 * EL MOTOR DE UNIÓN DE LAS SALAS (specs/modules/maps/SPEC.md § «Cómo se levanta una sala»).
 *
 * Lo que se sujeta aquí es la regla que él cerró el 2026-09-04 y que no admite matices: **las salas SE
 * FUNDEN, nunca se apilan**. El muro compartido desaparece y el muro es el contorno de la UNIÓN. Si esto se
 * rompe, la mazmorra sale con tabiques en medio de las habitaciones y la niebla se corta donde no debe.
 */

const rect = (x1: number, y1: number, x2: number, y2: number): RoomRing =>
  [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }];

/** Cuánto mide el contorno en total. Es la medida que delata un tabique que sobra o un lado que falta. */
const perimeter = (segs: BlockSegment[]): number =>
  segs.reduce((sum, [x1, y1, x2, y2]) => sum + Math.hypot(x2 - x1, y2 - y1), 0);

/** ¿Pasa el contorno por este punto? Con la misma holgura de dibujo con la que trabaja el motor. */
const touches = (segs: BlockSegment[], p: ScenePoint, eps = 1): boolean =>
  segs.some(([x1, y1, x2, y2]) => {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    const t = len2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((p.x - x1) * dx + (p.y - y1) * dy) / len2));
    return Math.hypot(p.x - (x1 + t * dx), p.y - (y1 + t * dy)) <= eps;
  });

describe('roomOutline — una sola forma', () => {
  it('devuelve el contorno del rectángulo, y nada más', () => {
    const out = roomOutline(digs(rect(0, 0, 100, 60)));
    expect(perimeter(out)).toBeCloseTo(320, 6);
    expect(touches(out, { x: 50, y: 0 })).toBe(true);
    expect(touches(out, { x: 50, y: 30 })).toBe(false);   // el interior no es muro
  });

  it('una forma con menos de tres puntos no encierra nada y no da contorno', () => {
    expect(roomOutline(digs([{ x: 0, y: 0 }, { x: 10, y: 0 }]))).toEqual([]);
    expect(roomOutline([])).toEqual([]);
  });
});

describe('roomOutline — SE FUNDEN, nunca se apilan (orden suya del 2026-09-04)', () => {
  it('dos rectángulos SOLAPADOS dan una sola silueta y el trozo tapado desaparece', () => {
    // Uno de 0..100 y otro de 60..160, solapados en la banda 60..100.
    const out = roomOutline(digs(rect(0, 0, 100, 60), rect(60, 0, 160, 60)));
    // La pared vertical del primero en x=100 cae DENTRO del segundo: no es muro.
    expect(touches(out, { x: 100, y: 30 })).toBe(false);
    // Y la del segundo en x=60 cae dentro del primero: tampoco.
    expect(touches(out, { x: 60, y: 30 })).toBe(false);
    // Lo que queda es el rectángulo 0..160, que es la unión.
    expect(perimeter(out)).toBeCloseTo(2 * (160 + 60), 6);
  });

  it('dos rectángulos que SE TOCAN sin solaparse también se funden: el tabique se cae', () => {
    // «si se tocan se solapan» — dos salas pegadas por una cara son UNA.
    const out = roomOutline(digs(rect(0, 0, 100, 60), rect(100, 0, 200, 60)));
    expect(touches(out, { x: 100, y: 30 })).toBe(false);   // la cara compartida ya no es pared
    expect(perimeter(out)).toBeCloseTo(2 * (200 + 60), 6);
  });

  it('el tabique se cae SÓLO en el tramo compartido: lo que sobresale sigue siendo pared', () => {
    // El segundo es más bajo, así que sólo comparten de y=0 a y=40.
    const out = roomOutline(digs(rect(0, 0, 100, 60), rect(100, 0, 200, 40)));
    expect(touches(out, { x: 100, y: 20 })).toBe(false);   // tramo compartido: abierto
    expect(touches(out, { x: 100, y: 50 })).toBe(true);    // lo que sobresale: sigue habiendo pared
  });

  it('dos salas SEPARADAS siguen siendo dos siluetas enteras', () => {
    const out = roomOutline(digs(rect(0, 0, 100, 60), rect(200, 0, 300, 60)));
    expect(perimeter(out)).toBeCloseTo(320 * 2, 6);
    expect(touches(out, { x: 100, y: 30 })).toBe(true);
    expect(touches(out, { x: 200, y: 30 })).toBe(true);
  });

  it('una sala DENTRO de otra desaparece entera: no deja pared por dentro', () => {
    const out = roomOutline(digs(rect(0, 0, 200, 200), rect(50, 50, 150, 150)));
    expect(perimeter(out)).toBeCloseTo(800, 6);
    expect(touches(out, { x: 50, y: 100 })).toBe(false);
  });

  it('vale para CUALQUIER forma, no sólo el rectángulo («lo mismo pasa con cualquier forma geométrica»)', () => {
    // Un triángulo apoyado sobre el techo de un rectángulo: se funden por la cara común.
    const triangle: RoomRing = [{ x: 20, y: 0 }, { x: 80, y: 0 }, { x: 50, y: -40 }];
    const out = roomOutline(digs(rect(0, 0, 100, 60), triangle));
    expect(touches(out, { x: 50, y: 0 })).toBe(false);     // el trozo de techo bajo el triángulo se abre
    expect(touches(out, { x: 10, y: 0 })).toBe(true);      // el resto del techo, no
    expect(touches(out, { x: 35, y: -20 })).toBe(true);    // y el triángulo aporta sus dos lados
  });

  it('cada forma se sigue recordando por separado: quitar una devuelve a las demás su contorno', () => {
    const a = rect(0, 0, 100, 60), b = rect(100, 0, 200, 60);
    expect(touches(roomOutline(digs(a, b)), { x: 100, y: 30 })).toBe(false);
    // Se borra la segunda —lo que él puede hacer porque la unión se calcula, no se destruye— y la pared vuelve.
    expect(touches(roomOutline(digs(a)), { x: 100, y: 30 })).toBe(true);
  });

  it('tres salas en fila se funden de dos en dos sin dejar ningún tabique', () => {
    const out = roomOutline(digs(rect(0, 0, 100, 60), rect(100, 0, 200, 60), rect(200, 0, 300, 60)));
    expect(perimeter(out)).toBeCloseTo(2 * (300 + 60), 6);
  });

  /**
   * 🐞 EL TRAMO REPETIDO TRES VECES, Y EL ORDEN EN QUE ÉL LAS DIBUJÓ NO PUEDE IMPORTAR.
   *
   * `A` es la sala grande, `B` se apoya DENTRO de ella pegada al mismo lado derecho, y `C` está pegada por
   * FUERA en ese mismo tramo. Los tres tramos caen uno encima de otro: dos en un sentido y uno al revés.
   *
   * Resolviéndolo por parejas, el resultado dependía de con quién se emparejase primero: dibujando `C` antes
   * que `B` se caían esas dos y el lado de `B` se quedaba de pie, como una pared fantasma cruzando la
   * habitación fundida. Con la rejilla cerrada, que dos lados caigan en la misma coordenada exacta es lo
   * normal, no una rareza — así que esto se ve jugando.
   */
  it('un tramo repetido TRES veces se resuelve igual se dibujen en el orden que se dibujen', () => {
    const a = rect(0, 0, 100, 100);     // la sala grande
    const b = rect(0, 0, 100, 50);      // dentro de A, comparte su lado derecho de y=0 a y=50
    const c = rect(100, 0, 200, 50);    // pegada por fuera, en ese mismo tramo
    const esperado = 2 * (100 + 100) + 2 * 100;   // el contorno de la L que forman A y C
    for (const orden of [[a, b, c], [a, c, b], [c, b, a], [b, c, a]]) {
      const out = roomOutline(digs(...orden));
      // Ni una pared en mitad de lo fundido…
      expect(touches(out, { x: 100, y: 25 })).toBe(false);
      // …y el resto del contorno intacto: el lado derecho de A por debajo de C sigue siendo pared.
      expect(touches(out, { x: 100, y: 75 })).toBe(true);
      expect(perimeter(out)).toBeCloseTo(esperado, 6);
    }
  });

  /**
   * Y da igual hacia qué lado dé la vuelta cada forma: un polígono se dibuja como venga la mano, y el motor
   * las endereza antes de comparar nada.
   */
  it('dos salas pegadas se funden aunque estén recorridas en sentidos contrarios', () => {
    const a = rect(0, 0, 100, 60);
    const alRevés = [...rect(100, 0, 200, 60)].reverse();
    expect(touches(roomOutline(digs(a, alRevés)), { x: 100, y: 30 })).toBe(false);
    expect(perimeter(roomOutline(digs(a, alRevés)))).toBeCloseTo(2 * (200 + 60), 6);
  });
});

/**
 * `orientRing` se exporta para que el DIBUJO enderece con la misma regla que el cálculo: la máscara SVG que
 * abre los agujeros en la roca cuenta vueltas, y dos anillos al revés se anulan donde se solapan — un islote
 * de roca dentro de la habitación.
 */
describe('orientRing — todos los anillos dan la vuelta al mismo lado', () => {
  it('endereza el que va al revés y deja quieto el que ya va bien', () => {
    const bien = rect(0, 0, 100, 60);
    const mal = [...bien].reverse();
    const área = (r: RoomRing): number => {
      let t = 0;
      for (let i = 0; i < r.length; i++) { const p = r[i]!, q = r[(i + 1) % r.length]!; t += p.x * q.y - q.x * p.y; }
      return t / 2;
    };
    expect(área(mal)).toBeLessThan(0);
    expect(área(orientRing(mal))).toBeGreaterThan(0);
    expect(orientRing(bien)).toEqual(bien);
    // Y es idempotente: enderezar dos veces no lo vuelve a dar la vuelta.
    expect(orientRing(orientRing(mal))).toEqual(orientRing(mal));
  });

  it('menos de tres puntos no encierran nada y se devuelven tal cual', () => {
    const suelto: RoomRing = [{ x: 1, y: 2 }, { x: 3, y: 4 }];
    expect(orientRing(suelto)).toEqual(suelto);
  });
});

describe('roomWalls — los vanos se anotan SOBRE el contorno (no parten ninguna fila)', () => {
  const room = rect(0, 0, 100, 60);

  it('sin vanos, todo el contorno es roca', () => {
    const walls = roomWalls(digs(room));
    expect(walls.every(w => w.kind === 'wall')).toBe(true);
    expect(perimeter(walls.map(w => w.seg))).toBeCloseTo(320, 6);
  });

  it('una puerta parte su lado en roca · puerta · roca, y sólo ese lado', () => {
    const walls = roomWalls(digs(room), [{ x1: 40, y1: 0, x2: 60, y2: 0, kind: 'door', isOpen: false }]);
    const doors = walls.filter(w => w.kind === 'door');
    expect(doors).toHaveLength(1);
    expect(perimeter(doors.map(w => w.seg))).toBeCloseTo(20, 6);
    // Nada se ha perdido por el camino: el contorno sigue midiendo lo mismo.
    expect(perimeter(walls.map(w => w.seg))).toBeCloseTo(320, 6);
  });

  it('una puerta CERRADA sigue cortando la vista; abierta, deja pasar', () => {
    const closed = roomWalls(digs(room), [{ x1: 40, y1: 0, x2: 60, y2: 0, kind: 'door', isOpen: false }]);
    const open = roomWalls(digs(room), [{ x1: 40, y1: 0, x2: 60, y2: 0, kind: 'door', isOpen: true }]);
    expect(perimeter(roomSightSegments(closed))).toBeCloseTo(320, 6);
    expect(perimeter(roomSightSegments(open))).toBeCloseTo(300, 6);
    expect(perimeter(roomMoveSegments(open))).toBeCloseTo(300, 6);
  });

  it('una ventana deja ver y NO deja pasar — como la de siempre', () => {
    const walls = roomWalls(digs(room), [{ x1: 40, y1: 0, x2: 60, y2: 0, kind: 'window', isOpen: false }]);
    expect(perimeter(roomSightSegments(walls))).toBeCloseTo(300, 6);   // se ve a través
    expect(perimeter(roomMoveSegments(walls))).toBeCloseTo(320, 6);    // pero no se pasa
  });

  it('un vano que cae en una pared que ya no existe (tabique fundido) no reaparece', () => {
    const walls = roomWalls(digs(rect(0, 0, 100, 60), rect(100, 0, 200, 60)),
      [{ x1: 100, y1: 20, x2: 100, y2: 40, kind: 'door', isOpen: false }]);
    expect(walls.some(w => w.kind === 'door')).toBe(false);
    expect(perimeter(walls.map(w => w.seg))).toBeCloseTo(2 * (200 + 60), 6);
  });

  it('el vano SOBREVIVE a que se mueva una forma: se guarda dónde está, no en qué lado', () => {
    const opening = { x1: 40, y1: 0, x2: 60, y2: 0, kind: 'door' as const, isOpen: true };
    // Se estira el rectángulo hacia la derecha: el contorno es otro, la puerta sigue en su sitio.
    const walls = roomWalls(digs(rect(0, 0, 300, 60)), [opening]);
    expect(walls.filter(w => w.kind === 'door')).toHaveLength(1);
    expect(perimeter(roomSightSegments(walls))).toBeCloseTo(2 * (300 + 60) - 20, 6);
  });
});

describe('pointInRing', () => {
  it('dice lo que está dentro y lo que está fuera', () => {
    const r = rect(0, 0, 100, 60);
    expect(pointInRing({ x: 50, y: 30 }, r)).toBe(true);
    expect(pointInRing({ x: 150, y: 30 }, r)).toBe(false);
    expect(pointInRing({ x: 50, y: 90 }, r)).toBe(false);
  });
});

/**
 * ── LOS MUROS SON RELLENO ──
 *
 * Suyo, 2026-09-04, probando el constructor: «*así como genero habitaciones necesito generar muros para
 * corregir o lo que sea. Hoy tomamos como que las habitaciones son huecos en el muro, entonces los muros
 * serán relleno de esos huecos*».
 *
 * O sea: la roca lo cubre todo, una sala le quita un trozo, y un muro se lo devuelve. No es una entidad
 * nueva ni una segunda física — es la misma forma con el signo cambiado.
 */
describe('roomOutline — el relleno devuelve roca al hueco', () => {
  it('un relleno dentro de una sala abre un agujero de roca, con su contorno', () => {
    const sala = rect(0, 0, 200, 200);
    const pilar = rect(80, 80, 120, 120);
    const out = roomOutline([...digs(sala), ...fills(pilar)]);
    // El contorno de la sala sigue entero…
    expect(touches(out, { x: 100, y: 0 })).toBe(true);
    // …y el pilar aporta el suyo: por sus cuatro lados hay vacío a un lado y roca al otro.
    expect(perimeter(out)).toBeCloseTo(800 + 160, 6);
    expect(touches(out, { x: 80, y: 100 })).toBe(true);
  });

  it('un relleno que parte una sala en dos la parte de verdad', () => {
    const sala = rect(0, 0, 200, 100);
    const tabique = rect(90, 0, 110, 100);
    const out = roomOutline([...digs(sala), ...fills(tabique)]);
    // Los dos lados del tabique son pared; su techo y su suelo NO, porque ahí ya había roca a los dos lados.
    expect(touches(out, { x: 90, y: 50 })).toBe(true);
    expect(touches(out, { x: 110, y: 50 })).toBe(true);
    expect(touches(out, { x: 100, y: 0 })).toBe(false);
    // Quedan dos salas de 90×100: es exactamente lo que se ve, no la suma de los contornos por separado.
    expect(perimeter(out)).toBeCloseTo(2 * (2 * (90 + 100)), 6);
  });

  it('un relleno FUERA de toda sala no pinta nada: ahí ya era todo roca', () => {
    const out = roomOutline([...digs(rect(0, 0, 100, 100)), ...fills(rect(300, 300, 400, 400))]);
    expect(perimeter(out)).toBeCloseTo(400, 6);
  });

  it('un relleno que tapa la sala entera la borra: no queda ni un tramo de muro', () => {
    expect(roomOutline([...digs(rect(50, 50, 150, 150)), ...fills(rect(0, 0, 200, 200))])).toEqual([]);
  });

  it('un relleno pegado a la pared de la sala la engorda hacia dentro, sin duplicar el borde', () => {
    // El relleno se come la franja de la izquierda: la pared se desplaza a x = 40 y no queda nada en x = 0.
    const out = roomOutline([...digs(rect(0, 0, 200, 100)), ...fills(rect(0, 0, 40, 100))]);
    expect(touches(out, { x: 0, y: 50 })).toBe(false);
    expect(touches(out, { x: 40, y: 50 })).toBe(true);
    expect(perimeter(out)).toBeCloseTo(2 * (160 + 100), 6);
  });

  it('sin salas no hay mapa, por muchos rellenos que haya', () => {
    expect(roomOutline([...digs(), ...fills(rect(0, 0, 100, 100))])).toEqual([]);
  });

  it('el relleno vale para cualquier forma, igual que la sala', () => {
    const redondo: RoomRing = Array.from({ length: 24 }, (_, i) => ({
      x: 100 + 30 * Math.cos((2 * Math.PI * i) / 24), y: 100 + 30 * Math.sin((2 * Math.PI * i) / 24),
    }));
    const out = roomOutline([...digs(rect(0, 0, 200, 200)), ...fills(redondo)]);
    expect(perimeter(out)).toBeGreaterThan(800);      // la sala más el contorno del pilar redondo
    expect(touches(out, { x: 130, y: 100 }, 3)).toBe(true);
  });
});

describe('roomWalls — un vano se abre igual en un muro de relleno', () => {
  it('la puerta se anota sobre el contorno, venga de una sala o de un relleno', () => {
    const walls = roomWalls([...digs(rect(0, 0, 200, 100)), ...fills(rect(90, 0, 110, 100))], [{ x1: 90, y1: 30, x2: 110, y2: 30, kind: 'door', isOpen: true }]);
    // El tabique tiene ahora un hueco por el que se pasa: su lado izquierdo está partido.
    expect(walls.some(w => w.kind === 'door' && w.isOpen)).toBe(false);   // la puerta va SOBRE un lado, no cruzándolo
    expect(perimeter(roomMoveSegments(walls))).toBeGreaterThan(0);
  });
});

/**
 * ── EL ORDEN MANDA, COMO EN CUALQUIER HERRAMIENTA DE DIBUJO ──
 *
 * La primera versión resolvía el mapa como «todo lo excavado menos todo lo rellenado», y con eso un muro
 * ganaba SIEMPRE: dibujar una sala encima de un muro no hacía nada. Que es justo lo que él iba a intentar.
 */
describe('roomOutline — la última forma dibujada es la que manda', () => {
  const sala = rect(0, 0, 200, 200);
  const muro = rect(50, 50, 150, 150);

  it('un muro DESPUÉS de la sala la tapa', () => {
    const out = roomOutline([...digs(sala), ...fills(muro)]);
    expect(touches(out, { x: 50, y: 100 })).toBe(true);      // el muro deja su contorno
    expect(perimeter(out)).toBeCloseTo(800 + 400, 6);
  });

  it('y una sala DESPUÉS del muro lo vuelve a abrir', () => {
    const out = roomOutline([...digs(sala), ...fills(muro), ...digs(rect(50, 50, 150, 150))]);
    expect(touches(out, { x: 50, y: 100 })).toBe(false);     // el muro ha desaparecido
    expect(perimeter(out)).toBeCloseTo(800, 6);
  });

  it('excavar sólo un trozo del muro deja el resto en pie', () => {
    const out = roomOutline([...digs(sala), ...fills(muro), ...digs(rect(50, 50, 100, 150))]);
    // Lo excavado va de x=50 a x=100, así que el muro que queda es la franja 100..150: sus dos cantos
    // son pared, y por dentro de la parte excavada ya no queda nada.
    expect(touches(out, { x: 100, y: 100 })).toBe(true);
    expect(touches(out, { x: 150, y: 100 })).toBe(true);
    expect(touches(out, { x: 60, y: 100 })).toBe(false);
  });
});

/**
 * ── LAS PUERTAS, DE VERDAD ──
 * El tramo del contorno tiene que poder decir DE QUÉ VANO salió: es lo único que permite volver de lo que se
 * pinta a la fila que guarda cómo es esa puerta (hojas, bisagra, lado, color). Sin esto, una puerta de sala
 * se dibujaría siempre igual, que es justo el aspecto que él mandó cambiar.
 */
describe('roomWalls — de qué vano salió cada tramo', () => {
  const room: RoomRing = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];

  it('el tramo del vano lleva su id; la roca de al lado no lleva ninguno', () => {
    const walls = roomWalls(digs(room), [{ id: 'ro-7', x1: 40, y1: 0, x2: 60, y2: 0, kind: 'door', isOpen: false }]);
    const puerta = walls.filter(w => w.kind === 'door');
    expect(puerta).toHaveLength(1);
    expect(puerta[0].openingId).toBe('ro-7');
    expect(walls.filter(w => w.kind === 'wall').every(w => w.openingId === undefined)).toBe(true);
  });

  it('sin id el contorno sigue saliendo igual: quien no lo necesita no tiene que inventarlo', () => {
    const walls = roomWalls(digs(room), [{ x1: 40, y1: 0, x2: 60, y2: 0, kind: 'door', isOpen: true }]);
    const puerta = walls.find(w => w.kind === 'door')!;
    expect(puerta.isOpen).toBe(true);
    expect(puerta.openingId).toBeUndefined();
  });

  it('dos vanos en el mismo lado no se mezclan los ids', () => {
    const walls = roomWalls(digs(room), [
      { id: 'a', x1: 10, y1: 0, x2: 30, y2: 0, kind: 'door', isOpen: false },
      { id: 'b', x1: 60, y1: 0, x2: 80, y2: 0, kind: 'window', isOpen: false },
    ]);
    expect(walls.find(w => w.kind === 'door')!.openingId).toBe('a');
    expect(walls.find(w => w.kind === 'window')!.openingId).toBe('b');
  });
});
