import { describe, expect, it } from 'vitest';
import { ROOM_PRESETS, type RoomPreset, type Scene } from '../entities/Scene';
import {
  outlinePath, ringFromSides, ringOf, ringPath, ringsOf, ROOM_STYLES, roomAt, sceneTextures,
  shadowDepthPx, shapeAt, shapeColorOf, shapeImageOf, snapSpanToOutline, spansOf, styleOf, tileMatrix, wallWidthPx, roomWallsOf,
} from './roomStyles';
import type { RoomSide } from './roomRules';
import type { RoomOpeningSpan } from '@rolvium/core';
import type { Room } from '../entities/Scene';
import { DEFAULT_DOOR } from '../entities/Scene';

const scene = (over: Partial<Scene> = {}): Scene => ({
  id: 'sc-1', campaignId: 'c1', name: 'Cripta', width: 600, height: 400, bgColor: '#111111', bgImageUrl: null,
  bgTransform: { mode: 'cover', x: 0, y: 0, scale: 1 }, grid: { size: 30, visible: true }, fogMode: 'vision',
  lighting: 'day', nightRadiusM: 10, solidWalls: false, sortOrder: 0, visiblePlayers: false, doorColor: null, doorTextureUrl: null, tokenScale: 1,
  brushTip: 'soft', brushSize: 1.2, brushStrength: 0.6, brushHardness: 0.4, brushRoughness: 0.5, rockPaintUrl: null,
  roomPreset: 'hatch', wallTextureUrl: null, floorTextureUrl: null, wallThickness: 0.22, wallTextureScale: 4, floorTextureScale: 4,
  createdAt: '', updatedAt: '', ...over,
});

describe('los nueve preajustes', () => {
  it('están los nueve del diseño, y ninguno se repite', () => {
    expect(ROOM_PRESETS).toHaveLength(9);
    expect(new Set(ROOM_PRESETS).size).toBe(9);
    for (const k of ROOM_PRESETS) expect(ROOM_STYLES[k]).toBeDefined();
  });

  /**
   * NINGÚN COLOR VIVE EN EL MÓDULO. Los valores están en `RolviumApp.css` (`--rm-*`), que es el único sitio
   * donde pueden vivir — así se retoca la paleta entera de la mazmorra sin abrir un componente. Este test es
   * el que impide que alguien «arregle» un estilo metiendo un hex a mano.
   */
  it('todos los colores son variables CSS, nunca un hex', () => {
    for (const k of ROOM_PRESETS) {
      const st = styleOf(k);
      for (const v of [st.rock, st.floor, st.wall, st.hatch, st.band]) {
        if (v !== null) expect(v).toMatch(/^var\(--rm-[a-z_]+-[a-z]+\)$/);
      }
    }
  });

  it('un preajuste desconocido no rompe el mapa: cae en el de serie', () => {
    expect(styleOf('no-existe' as RoomPreset)).toBe(ROOM_STYLES.hatch);
  });

  it('sólo «Trazo a mano» tiembla — su corrección del 2026-09-03', () => {
    expect(ROOM_PRESETS.filter(k => styleOf(k).wobble)).toEqual(['hand']);
  });

  it('los rayados son los tres que llevan trazo, y las bandas macizas las dos que la llevan', () => {
    expect(ROOM_PRESETS.filter(k => styleOf(k).hatch)).toEqual(['hatch', 'hatch_gray', 'fill']);
    expect(ROOM_PRESETS.filter(k => styleOf(k).band)).toEqual(['ancient', 'fill']);
  });
});

describe('sceneTextures — el preajuste rellena, la foto suya manda', () => {
  it('sin foto propia, las dos texturas las pone el preajuste', () => {
    const t = sceneTextures(scene({ roomPreset: 'ink' }));
    expect(t.style.key).toBe('ink');
    expect(t.rockUrl).toBeNull();
    expect(t.floorUrl).toBeNull();
  });

  it('con una foto suya, ésa manda — el preajuste no bloquea nada', () => {
    const t = sceneTextures(scene({ wallTextureUrl: 'https://x/roca.png' }));
    expect(t.rockUrl).toBe('https://x/roca.png');
  });
});

describe('el grosor y la sombra van en CASILLAS, no en píxeles', () => {
  /** Es lo que hace que el muro se vea igual de grueso con la rejilla en 15 que en 60. */
  it('el grosor sale de la rejilla', () => {
    expect(wallWidthPx(scene({ grid: { size: 30, visible: true } }))).toBeCloseTo(6.6, 6);
    expect(wallWidthPx(scene({ grid: { size: 60, visible: true } }))).toBeCloseTo(13.2, 6);
  });

  it('nunca baja de dos píxeles: un muro de medio píxel no se ve', () => {
    expect(wallWidthPx(scene({ grid: { size: 4, visible: true }, wallThickness: 0.1 }))).toBe(2);
  });

  it('una escena vieja sin la columna se pinta con el grosor de serie', () => {
    expect(wallWidthPx(scene({ wallThickness: 0 as number }))).toBeCloseTo(6.6, 6);
  });

  it('la sombra es un TERCIO de casilla, fija (decisión revisable del 2026-09-04)', () => {
    expect(shadowDepthPx(scene())).toBeCloseTo(10, 6);
  });
});

describe('de las filas a la geometría', () => {
  const sides: RoomSide[] = [
    { x1: 0, y1: 0, x2: 10, y2: 0 },
    { x1: 10, y1: 0, x2: 10, y2: 10 },
    { x1: 10, y1: 10, x2: 0, y2: 10 },
    { x1: 0, y1: 10, x2: 0, y2: 0 },
  ];

  it('los lados de una forma se guardan como el anillo de sus puntas', () => {
    expect(ringFromSides(sides)).toEqual([[0, 0], [10, 0], [10, 10], [0, 10]]);
  });

  it('y el anillo guardado vuelve a ser puntos', () => {
    expect(ringOf({ points: [[1, 2], [3, 4]] })).toEqual([{ x: 1, y: 2 }, { x: 3, y: 4 }]);
    expect(ringsOf([{ points: [[1, 2]] }, { points: [[3, 4]] }] as never)).toHaveLength(2);
  });

  it('los vanos guardados viajan al motor tal cual', () => {
    expect(spansOf([{ id: 'o', sceneId: 's', campaignId: 'c', x1: 1, y1: 2, x2: 3, y2: 4, kind: 'door', isOpen: true, ...DEFAULT_DOOR }]))
      // El `id` viaja desde «Las puertas, de verdad»: es lo que deja volver del tramo pintado a la fila que
      // dice CÓMO es esa puerta. Sin él, el contorno no sabría cuántas hojas tiene ni hacia dónde abre.
      .toEqual([{ id: 'o', x1: 1, y1: 2, x2: 3, y2: 4, kind: 'door', isOpen: true }]);
  });
});

describe('los caminos SVG', () => {
  it('un anillo se cierra: sin la Z el agujero no sería un agujero', () => {
    expect(ringPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])).toBe('M 0 0 L 10 0 L 10 10 Z');
  });

  it('menos de tres puntos no encierran nada y no dan camino', () => {
    expect(ringPath([{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe('');
  });

  it('el contorno normal son rectas', () => {
    expect(outlinePath([[0, 0, 10, 0]])).toBe('M 0 0 L 10 0');
  });

  /**
   * EL TEMBLOR ES SIEMPRE EL MISMO. Si cambiara en cada pintada, la pared vibraría sola — y el lienzo se
   * repinta varias veces por segundo mientras alguien arrastra una ficha.
   */
  it('el trazo a mano tiembla, y tiembla SIEMPRE IGUAL', () => {
    const a = outlinePath([[0, 0, 10, 0]], true, 2);
    const b = outlinePath([[0, 0, 10, 0]], true, 2);
    expect(a).toBe(b);
    expect(a).toContain('Q');
    expect(a).not.toBe(outlinePath([[0, 0, 10, 0]]));
  });

  it('sin temblor pedido, no tiembla aunque se le pase cantidad', () => {
    expect(outlinePath([[0, 0, 10, 0]], false, 5)).toBe('M 0 0 L 10 0');
  });
});

/**
 * ── «NO PONE LAS PUERTAS» (suyo, 2026-09-07 con la app delante) ──
 *
 * No era que no se guardaran: al PINTAR, sólo se dibujan los vanos cuyas dos puntas caen a 2 px de un lado
 * del contorno, y a mano eso es una lotería. Ahora el trazo se PROYECTA sobre la pared que tenía a la vista.
 */
describe('snapSpanToOutline — la puerta se engancha a la pared', () => {
  /** Una sala cuadrada de (0,0) a (100,100): sus lados son el contorno. */
  const sala = (): Room => ({
    id: 'r1', sceneId: 's', campaignId: 'c', kind: 'room', shape: 'rect',
    points: [[0, 0], [100, 0], [100, 100], [0, 100]], floorPreset: 'hatch', floorUrl: null, floorColor: null, floorMaskUrl: null, floorPaintUrl: null, createdAt: '', updatedAt: '',
  });
  const vano = (x1: number, y1: number, x2: number, y2: number): RoomOpeningSpan =>
    ({ x1, y1, x2, y2, kind: 'door', isOpen: false });

  it('un trazo A OJO cerca de la pared se clava en ella, y entonces SÍ se dibuja', () => {
    // A 6 px por dentro del lado de arriba: antes se perdía; ahora se clava en y = 0.
    const puesto = snapSpanToOutline([sala()], vano(30, 6, 70, 5), 15)!;
    expect(puesto).not.toBeNull();
    expect(puesto.y1).toBeCloseTo(0, 6);
    expect(puesto.y2).toBeCloseTo(0, 6);
    expect(puesto.x1).toBeCloseTo(30, 6);
    expect(puesto.x2).toBeCloseTo(70, 6);
    // Y ya proyectado, el motor que pinta sí lo reconoce como puerta — que es lo que fallaba.
    expect(roomWallsOf([sala()], [{ id: 'o', sceneId: 's', campaignId: 'c', ...puesto, ...DEFAULT_DOOR }])
      .some(w => w.kind === 'door')).toBe(true);
  });

  it('en mitad del suelo no se engancha a nada: ahí no hay pared', () => {
    expect(snapSpanToOutline([sala()], vano(30, 40, 70, 60), 15)).toBeNull();
  });

  it('las DOS puntas tienen que estar cerca de la MISMA pared', () => {
    // Una punta pegada al lado de arriba y la otra a media sala: no es un vano de esa pared.
    expect(snapSpanToOutline([sala()], vano(30, 1, 70, 50), 15)).toBeNull();
  });

  it('un trazo perpendicular a la pared no deja vano: proyectado se queda en nada', () => {
    expect(snapSpanToOutline([sala()], vano(50, 0, 50, 10), 15)).toBeNull();
  });

  it('sin salas no hay contorno al que engancharse', () => {
    expect(snapSpanToOutline([], vano(30, 0, 70, 0), 15)).toBeNull();
  });
});

/**
 * ── LA SALA BAJO EL PINCEL (rebanada 9) ──
 * El pincel del suelo no pide elegir sala antes: se apunta con el ratón y pinta la que hay debajo.
 */
describe('roomAt — a qué sala apunta el pincel del suelo', () => {
  const cuadrado = (id: string, x: number, y: number, lado = 100): Room => ({
    id, sceneId: 's', campaignId: 'c', kind: 'room', shape: 'rect',
    points: [[x, y], [x + lado, y], [x + lado, y + lado], [x, y + lado]],
    floorPreset: 'hatch', floorUrl: null, floorColor: null, floorMaskUrl: null, floorPaintUrl: null, createdAt: '', updatedAt: '',
  });

  it('devuelve la sala que hay bajo el punto, y nada fuera de todas', () => {
    const salas = [cuadrado('a', 0, 0), cuadrado('b', 200, 0)];
    expect(roomAt(salas, { x: 50, y: 50 })?.id).toBe('a');
    expect(roomAt(salas, { x: 250, y: 50 })?.id).toBe('b');
    expect(roomAt(salas, { x: 150, y: 50 })).toBeNull();
    expect(roomAt([], { x: 1, y: 1 })).toBeNull();
  });

  /** Donde dos salas se solapan manda la de ARRIBA, que es la que él está viendo cuando apunta. */
  it('con dos solapadas manda la última dibujada, que es la que se ve', () => {
    const salas = [cuadrado('vieja', 0, 0), cuadrado('nueva', 50, 50)];
    expect(roomAt(salas, { x: 75, y: 75 })?.id).toBe('nueva');
    expect(roomAt(salas, { x: 10, y: 10 })?.id).toBe('vieja');
  });

  /** Un TABIQUE no tiene suelo que pintar: es roca devuelta al hueco, no una sala. */
  it('un relleno no cuenta: no hay suelo que repintar en un tabique', () => {
    const tabique: Room = { ...cuadrado('t', 0, 0), kind: 'fill' };
    expect(roomAt([tabique], { x: 50, y: 50 })).toBeNull();
  });
});

/**
 * ── CADA FORMA SE PINTA CON LO SUYO (§ «Rebanada 10») ──
 *
 * Lo único de verdad nuevo de la rebanada, junto con convertir un trazo en un anillo: que un brochazo lleve
 * su propia textura o su propio color, y que quitarle la de arriba descubra la de abajo.
 */
describe('con qué se pinta una forma — foto, color, preajuste', () => {
  const forma = (over: Partial<Room> = {}): Room => ({
    id: 'r1', sceneId: 's', campaignId: 'c', kind: 'room', shape: 'brush',
    points: [[0, 0], [10, 0], [10, 10], [0, 10]],
    floorPreset: 'hatch', floorUrl: null, floorColor: null, floorMaskUrl: null, floorPaintUrl: null, createdAt: '', updatedAt: '', ...over,
  });
  const mapa = scene({ wallTextureUrl: 'roca.png', floorTextureUrl: 'suelo.png' });

  /** Una forma sin nada propio se ve como siempre: la del mapa. Es lo que deja intactas las salas ya hechas. */
  it('sin foto propia manda la del mapa, y la del MURO no es la del suelo', () => {
    expect(shapeImageOf(forma(), mapa)).toBe('suelo.png');
    expect(shapeImageOf(forma({ kind: 'fill' }), mapa)).toBe('roca.png');
  });

  /** Y con la suya, manda la suya — que es lo que hace que un brochazo lleve su piedra. */
  it('con foto propia manda la suya, excave o rellene', () => {
    expect(shapeImageOf(forma({ floorUrl: 'losa.png' }), mapa)).toBe('losa.png');
    expect(shapeImageOf(forma({ kind: 'fill', floorUrl: 'granito.png' }), mapa)).toBe('granito.png');
  });

  /**
   * 🔑 EL ORDEN: la foto gana al color y el color gana al preajuste. La consecuencia buscada es que quitarle
   * la textura a un brochazo NO lo deje en blanco: descubre el color que llevaba debajo.
   */
  it('el color propio manda sobre el preajuste, y sigue ahí debajo de la foto', () => {
    const conColor = forma({ floorColor: '#5f8f6a' });
    expect(shapeColorOf(conColor, 'hatch')).toBe('#5f8f6a');
    // La misma forma con foto: el color no se ha ido, se queda debajo para cuando le quite la foto.
    expect(shapeColorOf(forma({ floorColor: '#5f8f6a', floorUrl: 'losa.png' }), 'hatch')).toBe('#5f8f6a');
  });

  /**
   * ⚠️ Sin color propio se cae al preajuste, y ahí se respeta de dónde salía cada uno: la roca de un relleno
   * es la de LA ESCENA y el suelo de una sala es el que ella se llevó al dibujarse. Cambiarlo repintaría
   * mapas ya hechos, que es lo que él prohibió en redondo.
   */
  it('sin color propio manda el preajuste: el suelo el de la forma, la roca la de la escena', () => {
    expect(shapeColorOf(forma({ floorPreset: 'cavern' }), 'ink')).toBe(styleOf('cavern').floor);
    expect(shapeColorOf(forma({ kind: 'fill', floorPreset: 'cavern' }), 'ink')).toBe(styleOf('ink').rock);
  });
});

/**
 * ── LO QUE SE LLEVA EL BORRADOR ──
 * `roomAt` sólo mira las que EXCAVAN, porque un tabique no tiene suelo que repintar. El borrador del pincel
 * sí tiene que poder derribar un brochazo de MURO: es la mitad de lo que se pinta.
 */
describe('shapeAt — la forma que se lleva el borrador', () => {
  const cuadrado = (id: string, x: number, y: number, kind: Room['kind'] = 'room'): Room => ({
    id, sceneId: 's', campaignId: 'c', kind, shape: 'brush',
    points: [[x, y], [x + 100, y], [x + 100, y + 100], [x, y + 100]],
    floorPreset: 'hatch', floorUrl: null, floorColor: null, floorMaskUrl: null, floorPaintUrl: null, createdAt: '', updatedAt: '',
  });

  it('coge también las que RELLENAN, al revés que el pincel del suelo', () => {
    const formas = [cuadrado('muro', 0, 0, 'fill')];
    expect(shapeAt(formas, { x: 50, y: 50 })?.id).toBe('muro');
    // `roomAt` no la ve, y así tiene que seguir: ahí se elige a qué SUELO apunta el pincel de la rebanada 9.
    expect(roomAt(formas, { x: 50, y: 50 })).toBeNull();
  });

  it('con dos solapadas manda la última, que es la que él está viendo', () => {
    const formas = [cuadrado('vieja', 0, 0), cuadrado('nueva', 50, 50, 'fill')];
    expect(shapeAt(formas, { x: 75, y: 75 })?.id).toBe('nueva');
    expect(shapeAt(formas, { x: 10, y: 10 })?.id).toBe('vieja');
    expect(shapeAt(formas, { x: 500, y: 500 })).toBeNull();
  });
});

/**
 * ── LA TEXTURA DEL PINCEL SE GIRA (suyo, 2026-09-10: «*además de escalarse, que se pueda girar*») ──
 * Una sola matriz para lo pintado y para el previo: si se calculasen por separado, lo que se ve al mover el
 * giro y lo que cae al dar el brochazo podrían no coincidir.
 */
describe('tileMatrix', () => {
  const cerca = (got: number[], want: number[]) => want.forEach((w, i) => expect(got[i]).toBeCloseTo(w, 9));

  it('sin girar sólo escala la foto al tamaño del azulejo', () => {
    cerca(tileMatrix(54, 108, 108), [0.5, 0, 0, 0.5, 0, 0]);
    cerca(tileMatrix(54, 108, 108, 0), [0.5, 0, 0, 0.5, 0, 0]);
  });

  it('girar un cuarto de vuelta cambia los ejes, sin deformar', () => {
    cerca(tileMatrix(54, 108, 108, 90), [0, 0.5, -0.5, 0, 0, 0]);
  });

  /** Primero se escala y DESPUÉS se gira: una foto apaisada no sale torcida al girarla. */
  it('una foto que no es cuadrada escala cada eje por su lado y luego gira', () => {
    const [a, b, c, d] = tileMatrix(60, 120, 60, 90);
    expect(a).toBeCloseTo(0); expect(b).toBeCloseTo(0.5);   // el eje X de la foto: ×0,5 y girado
    expect(c).toBeCloseTo(-1); expect(d).toBeCloseTo(0);    // el eje Y: ×1 y girado
  });
});
