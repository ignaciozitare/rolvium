import { describe, it, expect } from 'vitest';
import { chainWalls, groupInsideOf, groupOf, handleAt, HANDLE_KEYS, insideGroup, MIN_GROUP_PX, moveWalls, resizeRect, scaleWallsTo, wallBounds, wallsInRect, withWholeGroups } from './groupRules';
import type { Wall } from '../entities/Scene';

/**
 * 🧩 EL GRUPO (§ «EL GRUPO»). Lo que pidió el 2026-09-03 probando Builder sobre una foto: coger de un clic los
 * once muros del círculo, moverlos, estirarlos, y entrar al muro suelto con doble clic.
 *
 * 🔑 Esto NO son habitaciones: sobre una foto no hay suelo ni textura, hay muros. Sólo geometría y conjuntos.
 */
const muro = (id: string, x1: number, y1: number, x2: number, y2: number, groupId: string | null = null): Wall => ({
  id, sceneId: 'sc-1', campaignId: 'c1', x1, y1, x2, y2,
  visiblePlayers: false, kind: 'wall', blocksSight: true, blocksMove: true, isOpen: false, groupId,
});

/** Un cuadrado agrupado, como el que deja el rectángulo de Builder. */
const cuadrado = (g: string | null = 'g1'): Wall[] => [
  muro('a', 0, 0, 100, 0, g), muro('b', 100, 0, 100, 80, g),
  muro('c', 100, 80, 0, 80, g), muro('d', 0, 80, 0, 0, g),
];

describe('el marco que envuelve al grupo', () => {
  it('abraza todos los muros, ni más ni menos', () => {
    expect(wallBounds(cuadrado())).toEqual({ x: 0, y: 0, w: 100, h: 80 });
  });

  it('sin muros no hay marco', () => {
    expect(wallBounds([])).toBeNull();
  });

  it('los ocho tiradores caen donde se espera', () => {
    const r = { x: 10, y: 20, w: 100, h: 60 };
    expect(HANDLE_KEYS).toHaveLength(8);
    expect(handleAt(r, 'tl')).toEqual({ x: 10, y: 20 });
    expect(handleAt(r, 'br')).toEqual({ x: 110, y: 80 });
    expect(handleAt(r, 't')).toEqual({ x: 60, y: 20 });
    expect(handleAt(r, 'r')).toEqual({ x: 110, y: 50 });
  });
});

describe('estirar por un tirador', () => {
  const r = { x: 0, y: 0, w: 100, h: 80 };

  it('el lado de enfrente se queda clavado', () => {
    expect(resizeRect(r, 'br', { x: 150, y: 120 })).toEqual({ x: 0, y: 0, w: 150, h: 120 });
    // Por arriba a la izquierda el ancla es la esquina de abajo a la derecha: (100,80) no se mueve.
    const tl = resizeRect(r, 'tl', { x: -50, y: -20 });
    expect(tl.x + tl.w).toBe(100);
    expect(tl.y + tl.h).toBe(80);
  });

  /**
   * 🔒 LAS ESQUINAS GUARDAN LAS PROPORCIONES (dueño, 2026-09-03: «*los nodos de las esquinas deberían
   * escalarlo manteniendo proporciones*»). Estirar libre por una esquina deforma la sala, y un círculo
   * deformado deja de ser un círculo.
   */
  it('una esquina escala manteniendo la proporción: manda el eje que más se arrastra', () => {
    // Se tira mucho a lo ancho (×1,5) y poco a lo alto (×1,05): manda el ancho y la altura le sigue.
    const e = resizeRect(r, 'br', { x: 150, y: 84 });
    expect(e.w / e.h).toBeCloseTo(r.w / r.h, 6);
    expect(e.w).toBeCloseTo(150, 6);
    expect(e.h).toBeCloseTo(120, 6);
  });

  it('un tirador de en medio NO guarda proporción: para eso está', () => {
    const e = resizeRect(r, 'r', { x: 300, y: 0 });
    expect(e.w).toBe(300);
    expect(e.h).toBe(80);
  });

  /** 🔒 Agarrar un lado NO toca el otro eje: estirar a lo ancho deja la altura como estaba. */
  it('un tirador de en medio sólo estira en su dirección', () => {
    expect(resizeRect(r, 'r', { x: 200, y: 999 })).toEqual({ x: 0, y: 0, w: 200, h: 80 });
    expect(resizeRect(r, 'b', { x: 999, y: 200 })).toEqual({ x: 0, y: 0, w: 100, h: 200 });
  });

  /**
   * 🔒 Pasarse de largo NO deja el grupo del revés ni aplastado a nada. Sin tope, un tirón que cruza el lado
   * contrario deja una forma imposible de recuperar a mano.
   */
  it('no se puede estrujar más allá del mínimo, ni darle la vuelta', () => {
    // Por una esquina el tope respeta la proporción: se para cuando el lado CORTO llega al mínimo.
    const chico = resizeRect(r, 'br', { x: -500, y: -500 });
    expect(Math.min(chico.w, chico.h)).toBeCloseTo(MIN_GROUP_PX, 6);
    expect(chico.w / chico.h).toBeCloseTo(r.w / r.h, 6);
    const alReves = resizeRect(r, 'tl', { x: 500, y: 500 });
    expect(Math.min(alReves.w, alReves.h)).toBeCloseTo(MIN_GROUP_PX, 6);
    expect(alReves.x + alReves.w).toBeCloseTo(100, 6);
    expect(alReves.y + alReves.h).toBeCloseTo(80, 6);
    // Y por un lado suelto, el mínimo es el de siempre.
    expect(resizeRect(r, 'r', { x: -500, y: 0 }).w).toBe(MIN_GROUP_PX);
  });
});

describe('mover y escalar los muros', () => {
  it('mover en bloque no cambia la forma', () => {
    const movidos = moveWalls(cuadrado(), 30, -10);
    expect(movidos[0]).toEqual({ id: 'a', x1: 30, y1: -10, x2: 130, y2: -10 });
    expect(wallBounds(cuadrado().map((w, i) => ({ ...w, ...movidos[i]! })))).toEqual({ x: 30, y: -10, w: 100, h: 80 });
  });

  /** 🔒 La forma se conserva: al doblar el marco, cada punta se va al doble de donde estaba dentro de él. */
  it('escalar conserva la forma', () => {
    const walls = cuadrado();
    const from = { x: 0, y: 0, w: 100, h: 80 };
    const to = { x: 0, y: 0, w: 200, h: 160 };
    const escalados = scaleWallsTo(walls, from, to);
    expect(escalados[0]).toEqual({ id: 'a', x1: 0, y1: 0, x2: 200, y2: 0 });
    expect(escalados[1]).toEqual({ id: 'b', x1: 200, y1: 0, x2: 200, y2: 160 });
    expect(wallBounds(walls.map((w, i) => ({ ...w, ...escalados[i]! })))).toEqual(to);
  });

  it('escalar desde una esquina lleva el grupo a su sitio nuevo', () => {
    const escalados = scaleWallsTo(cuadrado(), { x: 0, y: 0, w: 100, h: 80 }, { x: 50, y: 50, w: 100, h: 80 });
    expect(escalados[0]).toEqual({ id: 'a', x1: 50, y1: 50, x2: 150, y2: 50 });
  });

  /**
   * 🔒 Un grupo PLANO —una fila de muros en la misma línea— tiene un lado de cero. Escalar ahí sería dividir
   * por cero y mandar los muros al infinito; se traslada y ya.
   */
  it('un grupo plano no se va al infinito', () => {
    const raya = [muro('a', 0, 50, 100, 50, 'g1')];
    const escalados = scaleWallsTo(raya, { x: 0, y: 50, w: 100, h: 0 }, { x: 0, y: 90, w: 200, h: 0 });
    expect(escalados[0]).toEqual({ id: 'a', x1: 0, y1: 90, x2: 200, y2: 90 });
    for (const v of Object.values(escalados[0]!)) expect(Number.isFinite(v) || typeof v === 'string').toBe(true);
  });
});

describe('coger por área', () => {
  it('coge lo que rodeas del todo', () => {
    const cogidos = wallsInRect(cuadrado(null), { x: -10, y: -10 }, { x: 200, y: 200 });
    expect(cogidos).toHaveLength(4);
  });

  /**
   * 🔒 Un muro que sólo CRUZA el área no se viene. Si bastara con rozarlo, un muro largo que pasa por la
   * esquina del recuadro se colaría en la selección y cogerías cosas que no querías.
   */
  it('un muro que sólo cruza el área se queda fuera', () => {
    const cruza = muro('largo', -500, 40, 500, 40);
    const cogidos = wallsInRect([...cuadrado(null), cruza], { x: -10, y: -10 }, { x: 200, y: 200 });
    expect(cogidos.map(w => w.id)).not.toContain('largo');
    expect(cogidos).toHaveLength(4);
  });

  it('el área al revés vale igual: se arrastra desde cualquier esquina', () => {
    const alDerecho = wallsInRect(cuadrado(null), { x: -10, y: -10 }, { x: 200, y: 200 });
    const alReves = wallsInRect(cuadrado(null), { x: 200, y: 200 }, { x: -10, y: -10 });
    expect(alReves.map(w => w.id)).toEqual(alDerecho.map(w => w.id));
  });
});

describe('el grupo es UNA cosa', () => {
  /** 🔒 Media cosa cogida no es nada que se pueda mover con sentido. */
  it('pillar tres muros de un grupo se los trae todos', () => {
    const todos = cuadrado('g1');
    const trozo = todos.slice(0, 2);
    expect(withWholeGroups(todos, trozo).map(w => w.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('los muros sueltos se cogen tal cual, sin arrastrar a nadie', () => {
    const sueltos = cuadrado(null);
    expect(withWholeGroups(sueltos, sueltos.slice(0, 2)).map(w => w.id)).toEqual(['a', 'b']);
  });

  it('no duplica un muro que ya estaba cogido', () => {
    const todos = cuadrado('g1');
    expect(withWholeGroups(todos, todos)).toHaveLength(4);
  });

  it('dos grupos distintos no se contagian', () => {
    const todos = [...cuadrado('g1'), muro('z', 500, 500, 600, 500, 'g2')];
    expect(withWholeGroups(todos, [todos[0]!]).map(w => w.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('un clic sobre un muro agrupado coge el grupo; sobre uno suelto, sólo él', () => {
    const todos = [...cuadrado('g1'), muro('z', 500, 500, 600, 500)];
    expect(groupOf(todos, todos[0]!)).toHaveLength(4);
    expect(groupOf(todos, todos[4]!)).toEqual([todos[4]]);
  });
});

/**
 * 🔗 LOS NODOS SON UNA CADENA — «*me separa los segmentos de la figura original, los nodos deberían ser como
 * una cadena a menos que yo elija que no*» (dueño, 2026-09-03).
 */
describe('chainWalls — arrastrar una punta se lleva las que estaban ahí', () => {
  const lado = muro;
  /** Un cuadrado, de los que deja el rectángulo de Builder. La esquina (0,0) la comparten `a` y `d`. */
  const cuadrado = [lado('a', 0, 0, 200, 0, 'g1'), lado('b', 200, 0, 200, 150, 'g1'), lado('c', 200, 150, 0, 150, 'g1'), lado('d', 0, 150, 0, 0, 'g1')];

  it('moviendo la punta A del lado de arriba, el lado de la izquierda la sigue', () => {
    const at = { x1: 30, y1: 20, x2: 200, y2: 0 };
    const cadena = chainWalls(cuadrado, 'a', { x1: 0, y1: 0, x2: 200, y2: 0 }, at, 'a');
    // Sólo el lado `d`, que es el que tocaba esa esquina — y sólo por su punta B.
    expect(cadena).toEqual([{ id: 'd', x1: 0, y1: 150, x2: 30, y2: 20 }]);
  });

  it('el muro que se arrastra NUNCA sale en la cadena: eso lo escribe quien llama', () => {
    const cadena = chainWalls(cuadrado, 'a', { x1: 0, y1: 0, x2: 200, y2: 0 }, { x1: 30, y1: 20, x2: 200, y2: 0 }, 'a');
    expect(cadena.some(c => c.id === 'a')).toBe(false);
  });

  it('arrastrando el lado ENTERO se sueldan sus DOS puntas: la figura no se abre por ningún lado', () => {
    const at = { x1: 0, y1: 40, x2: 200, y2: 40 };
    const cadena = chainWalls(cuadrado, 'a', { x1: 0, y1: 0, x2: 200, y2: 0 }, at, 'whole');
    expect(cadena.map(c => c.id).sort()).toEqual(['b', 'd']);
    expect(cadena.find(c => c.id === 'b')).toEqual({ id: 'b', x1: 200, y1: 40, x2: 200, y2: 150 });
    expect(cadena.find(c => c.id === 'd')).toEqual({ id: 'd', x1: 0, y1: 150, x2: 0, y2: 40 });
  });

  it('el lado de enfrente no se toca: mover un lado no es mover el grupo', () => {
    const cadena = chainWalls(cuadrado, 'a', { x1: 0, y1: 0, x2: 200, y2: 0 }, { x1: 0, y1: 40, x2: 200, y2: 40 }, 'whole');
    expect(cadena.some(c => c.id === 'c')).toBe(false);
  });

  /** La cadena es por SITIO, no por grupo: el imán del candado junta puntas de muros que no van juntos. */
  it('suelda también muros de grupos distintos, si sus puntas están en el mismo sitio', () => {
    const pegado = lado('otro', 0, 0, 0, -90, 'g9');
    const cadena = chainWalls([...cuadrado, pegado], 'a', { x1: 0, y1: 0, x2: 200, y2: 0 }, { x1: 30, y1: 20, x2: 200, y2: 0 }, 'a');
    expect(cadena.map(c => c.id).sort()).toEqual(['d', 'otro']);
  });

  it('una punta que no coincide con nada no arrastra a nadie', () => {
    const cadena = chainWalls(cuadrado, 'a', { x1: 200, y1: 0, x2: 0, y2: 0 }, { x1: 200, y1: 0, x2: 999, y2: 999 }, 'b');
    // (0,0) sí la tocaba `d`; se comprueba el caso contrario con una esquina que no existe.
    expect(chainWalls(cuadrado, 'a', { x1: 77, y1: 77, x2: 200, y2: 0 }, { x1: 90, y1: 90, x2: 200, y2: 0 }, 'a')).toEqual([]);
    expect(cadena.map(c => c.id)).toEqual(['d']);
  });

  /** Se mide contra el ANTES: si no, la segunda punta se pegaría a donde acaba de llegar la primera. */
  it('se mide contra las coordenadas de antes de mover nada', () => {
    const degenerado = [lado('a', 0, 0, 100, 0, 'g1'), lado('z', 0, 0, 100, 0, 'g1')];
    const cadena = chainWalls(degenerado, 'a', { x1: 0, y1: 0, x2: 100, y2: 0 }, { x1: 50, y1: 0, x2: 150, y2: 0 }, 'whole');
    expect(cadena).toEqual([{ id: 'z', x1: 50, y1: 0, x2: 150, y2: 0 }]);
  });
});

/**
 * 🫱 ANDAR POR DENTRO DEL GRUPO — sus dos quejas del 2026-09-03: «*si selecciono un nodo y quiero seleccionar
 * otro tengo que volver a hacer doble click*» y «*una vez dentro del grupo debería poder no sólo seleccionar
 * un vector sino arrastrar y seleccionar en grupo cosas*».
 */
describe('insideGroup y groupInsideOf — cuándo estoy trabajando por dentro', () => {
  const sala = cuadrado('g1');

  it('con un muro suelto del grupo elegido, estoy dentro', () => {
    expect(insideGroup(sala, 'a', [])).toBe(true);
    expect(groupInsideOf(sala, 'a', [])).toBe('g1');
  });

  /** La segunda manera de andar por dentro: un puñado cogido con el área. Sin esto, arrastrar te echaba fuera. */
  it('con un PUÑADO del grupo cogido, sigo dentro', () => {
    expect(insideGroup(sala, null, ['a', 'b'])).toBe(true);
    expect(groupInsideOf(sala, null, ['a', 'b'])).toBe('g1');
  });

  it('con el grupo ENTERO cogido no estoy dentro: estoy manejando la pieza', () => {
    expect(insideGroup(sala, null, ['a', 'b', 'c', 'd'])).toBe(false);
    expect(groupInsideOf(sala, null, ['a', 'b', 'c', 'd'])).toBeNull();
  });

  it('sin nada cogido, fuera', () => {
    expect(insideGroup(sala, null, [])).toBe(false);
    expect(groupInsideOf(sala, null, [])).toBeNull();
  });

  it('un muro suelto no es un grupo en el que se pueda entrar', () => {
    const libre = [muro('x', 0, 0, 50, 0, null)];
    expect(insideGroup(libre, 'x', [])).toBe(false);
    expect(groupInsideOf(libre, 'x', [])).toBeNull();
  });
});

describe('withWholeGroups por dentro del grupo', () => {
  const sala = cuadrado('g1');

  it('por fuera el grupo se viene entero: pillar dos trae los cuatro', () => {
    expect(withWholeGroups(sala, [sala[0]!, sala[1]!]).map(w => w.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  /** 🔑 Dentro, el área coge lo que pilló y nada más: inflarlo al grupo entero era lo que te echaba fuera. */
  it('por dentro coge sólo lo que pilló', () => {
    expect(withWholeGroups(sala, [sala[0]!, sala[1]!], 'g1').map(w => w.id).sort()).toEqual(['a', 'b']);
  });

  it('los OTROS grupos siguen viniéndose enteros: en ésos no estoy dentro', () => {
    const otro = [muro('o-a', 400, 400, 500, 400, 'g2'), muro('o-b', 500, 400, 500, 500, 'g2')];
    const todos = [...sala, ...otro];
    expect(withWholeGroups(todos, [sala[0]!, otro[0]!], 'g1').map(w => w.id).sort()).toEqual(['a', 'o-a', 'o-b']);
  });
});
