import { describe, it, expect } from 'vitest';
import { groupOf, handleAt, HANDLE_KEYS, MIN_GROUP_PX, moveWalls, resizeRect, scaleWallsTo, wallBounds, wallsInRect, withWholeGroups } from './groupRules';
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
    expect(resizeRect(r, 'tl', { x: -50, y: -20 })).toEqual({ x: -50, y: -20, w: 150, h: 100 });
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
    expect(resizeRect(r, 'br', { x: -500, y: -500 })).toEqual({ x: 0, y: 0, w: MIN_GROUP_PX, h: MIN_GROUP_PX });
    const alReves = resizeRect(r, 'tl', { x: 500, y: 500 });
    expect(alReves.w).toBe(MIN_GROUP_PX);
    expect(alReves.h).toBe(MIN_GROUP_PX);
    expect(alReves.x).toBe(100 - MIN_GROUP_PX);
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
