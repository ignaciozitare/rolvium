import { describe, it, expect } from 'vitest';
import { PACK_DUNGEON, PACK_FOREST, PROP_COLUMN, PROP_OAK, PROP_TABLE, SCENE_PROP_COLUMN, SCENE_PROP_OAK, SCENE_WAREHOUSE } from '../../../../../tests/helpers/fakes';
import type { Prop, SceneProp } from '../entities/Scene';
import {
  MAX_SCALE, MIN_SCALE, PROP_CATEGORIES, RECENTS_MAX, clampScale, countIn, dueToSow, duplicateProp, filterProps, footprintOf,
  fromPropFrame, hasAppProps, hitProp, isAppProp, matchesQuery, nameFromFile, normDeg, paintOrderProps, plantProp, pointInProp,
  propCorners, propPath, pushRecent, randomRotation, randomScale, restack, rotateHandleAt, rotationToward, scaleChanged,
  scaleFromCorner, scaleFromCornerAnchored, propsInRect, propPlace, scaleOfWidth, scatterIn, sectionsOf, sowStepPx, topZ, toPropFrame,
  groupBoxFromCorner, groupCorners, groupRotateHandleAt, propsBounds, rotatePropsBy, scalePropsTo,
} from './propRules';

const OAK = PROP_OAK;
const COLUMN = PROP_COLUMN;
/** Una de serie: la trae la app, sin quien la subió. */
const APP_CHAIR: Prop = { ...OAK, id: 'pr-chair', packId: null, uploadedBy: null, name: 'Silla', category: 'furniture' };
const CTX = { favorites: [] as string[], recents: [] as string[] };

describe('propRules — la escala que se recuerda (§ 6.4)', () => {
  it('la huella sale del tamaño natural por la escala, y la proporción no se puede romper', () => {
    expect(footprintOf(OAK, 1)).toEqual({ width: 200, height: 300 });
    const grande = footprintOf(OAK, 1.5);
    expect(grande).toEqual({ width: 300, height: 450 });
    expect(grande.width / grande.height).toBeCloseTo(OAK.naturalWidth / OAK.naturalHeight);
  });

  it('del ancho se saca la escala de vuelta: es lo que permite RECORDAR lo que se hizo con el ratón', () => {
    expect(scaleOfWidth(OAK, 300)).toBeCloseTo(1.5);
    expect(scaleOfWidth(OAK, 200)).toBeCloseTo(1);
  });

  it('la escala se acota por los dos lados: ni un roble de un kilómetro ni una mota invisible', () => {
    expect(clampScale(1000)).toBe(MAX_SCALE);
    expect(clampScale(0)).toBe(MIN_SCALE);
    expect(clampScale(-3)).toBe(MIN_SCALE);
    expect(footprintOf(OAK, 1e6).width).toBe(200 * MAX_SCALE);
  });

  it('sólo se reescribe la biblioteca cuando la escala ha cambiado de verdad', () => {
    expect(scaleChanged(1, 1)).toBe(false);
    expect(scaleChanged(1, 1.00001)).toBe(false);
    expect(scaleChanged(1, 1.2)).toBe(true);
  });
});

describe('propRules — plantar y duplicar (§ 6.4, § 6.5)', () => {
  it('plantar copia la foto y el nombre: es lo que hace que sobreviva a borrar la pieza de la biblioteca', () => {
    const planted = plantProp(OAK, { x: 120, y: 340 }, SCENE_WAREHOUSE);
    expect(planted).toMatchObject({
      sceneId: SCENE_WAREHOUSE.id, campaignId: SCENE_WAREHOUSE.campaignId, propId: OAK.id,
      imageUrl: OAK.imageUrl, name: OAK.name, x: 120, y: 340, rotation: 0, layerId: null, z: 0,
    });
  });

  it('plantar usa la escala que la pieza recuerda, y la que se le pase manda sobre ella; el giro y el z también', () => {
    expect(plantProp({ ...OAK, defaultScale: 2 }, { x: 0, y: 0 }, SCENE_WAREHOUSE)).toMatchObject({ width: 400, height: 600 });
    expect(plantProp({ ...OAK, defaultScale: 2 }, { x: 0, y: 0 }, SCENE_WAREHOUSE, null, 0.5)).toMatchObject({ width: 100, height: 150 });
    expect(plantProp(OAK, { x: 0, y: 0 }, SCENE_WAREHOUSE, null, 1, 370, 4)).toMatchObject({ rotation: 10, z: 4 });
  });

  it('el estorbo nace con lo que diga la biblioteca, cubriendo la huella entera', () => {
    const arbol = plantProp(OAK, { x: 0, y: 0 }, SCENE_WAREHOUSE, null, 1);
    expect(arbol).toMatchObject({ blocksSight: false, blocksMove: false, blockShape: 'rect', blockW: 200, blockH: 300, blockDx: 0, blockDy: 0 });
    const col = plantProp({ ...COLUMN, naturalWidth: 100, naturalHeight: 260 }, { x: 0, y: 0 }, SCENE_WAREHOUSE);
    expect(col).toMatchObject({ blocksSight: true, blocksMove: true, blockShape: 'circle', blockW: 260, blockH: 260 });
  });

  it('planta en la capa que se le diga; sin decir nada, en su capa natural', () => {
    expect(plantProp(OAK, { x: 0, y: 0 }, SCENE_WAREHOUSE).layerId).toBeNull();
    expect(plantProp(OAK, { x: 0, y: 0 }, SCENE_WAREHOUSE, 'ly-7').layerId).toBe('ly-7');
  });

  it('duplicar conserva giro y tamaño y sube un peldaño: plantar de nuevo perdería lo ajustado a mano', () => {
    const puesta: SceneProp = { ...SCENE_PROP_OAK, width: 333, height: 499, rotation: 42, blocksSight: true, blockW: 50, blockDx: 7, z: 3 };
    const copia = duplicateProp(puesta, { x: 500, y: 600 });
    expect(copia).toMatchObject({ x: 500, y: 600, width: 333, height: 499, rotation: 42, blocksSight: true, blockW: 50, blockDx: 7, z: 4 });
    expect(copia).not.toHaveProperty('id');
  });

  it('el nombre sale del fichero sin la extensión, y nunca vacío', () => {
    expect(nameFromFile('arbol-viejo.png')).toBe('arbol-viejo');
    expect(nameFromFile('brasero.webp')).toBe('brasero');
    expect(nameFromFile('.png')).toBe('Pieza');
    expect(nameFromFile('x'.repeat(100) + '.png')).toHaveLength(80);
  });
});

describe('propRules — el catálogo: estantes, buscador y secciones (§ 6.2)', () => {
  it('dónde vive cada pieza: las tuyas en su paquete (o en ninguno), las de serie en su categoría', () => {
    expect(propPlace(OAK)).toEqual({ group: OAK.packId, builtIn: null });
    expect(propPlace({ ...OAK, packId: null })).toEqual({ group: null, builtIn: null });
    expect(propPlace(APP_CHAIR)).toEqual({ group: null, builtIn: 'furniture' });
  });

  const ALL = [OAK, COLUMN, PROP_TABLE, APP_CHAIR];

  it('son seis categorías de serie, cerradas, y sólo cuentan para las piezas de la app', () => {
    expect(PROP_CATEGORIES).toEqual(['furniture', 'vegetation', 'floors', 'doors', 'markers', 'misc']);
    expect(isAppProp(APP_CHAIR)).toBe(true);
    expect(isAppProp(OAK)).toBe(false);
    expect(hasAppProps([OAK, COLUMN])).toBe(false);
    expect(hasAppProps(ALL)).toBe(true);
  });

  it('el buscador ignora mayúsculas y acentos, y vacío no filtra nada', () => {
    expect(matchesQuery({ name: 'Árbol viejo' }, 'arbol')).toBe(true);
    expect(matchesQuery({ name: 'Árbol viejo' }, 'VIEJO')).toBe(true);
    expect(matchesQuery({ name: 'Árbol viejo' }, '  ')).toBe(true);
    expect(matchesQuery({ name: 'Árbol viejo' }, 'mesa')).toBe(false);
  });

  it('cada estante enseña lo suyo: un paquete, «Sin clasificar», una categoría de serie, favoritos, recientes', () => {
    expect(filterProps(ALL, { kind: 'pack', id: PACK_FOREST.id }, '', CTX).map(p => p.id)).toEqual(['pr-oak']);
    expect(filterProps(ALL, { kind: 'pack', id: null }, '', CTX).map(p => p.id)).toEqual(['pr-tab']);
    expect(filterProps(ALL, { kind: 'category', category: 'furniture' }, '', CTX).map(p => p.id)).toEqual(['pr-chair']);
    expect(filterProps(ALL, { kind: 'favorites' }, '', { ...CTX, favorites: ['pr-col'] }).map(p => p.id)).toEqual(['pr-col']);
    expect(filterProps(ALL, { kind: 'recent' }, '', { ...CTX, recents: ['pr-tab', 'pr-oak'] }).map(p => p.id)).toEqual(['pr-oak', 'pr-tab']);
    // y el buscador se suma al estante
    expect(filterProps(ALL, { kind: 'all' }, 'mesa', CTX).map(p => p.id)).toEqual(['pr-tab']);
    expect(countIn(ALL, { kind: 'pack', id: PACK_DUNGEON.id }, CTX)).toBe(1);
  });

  it('agrupado, una sección por paquete en su orden, luego las sin clasificar y luego las de serie', () => {
    const secs = sectionsOf(ALL, [PACK_FOREST, PACK_DUNGEON], { kind: 'all' }, '', 'name', CTX, true);
    expect(secs.map(s => s.key)).toEqual(['pack:pk-dun', 'pack:pk-for', 'pack:none', 'cat:furniture']);
    expect(secs[0]!.title).toBe('Mazmorra propia');
    expect(secs[2]!.pack).toBeNull();
    expect(secs[3]!.category).toBe('furniture');
    // una pieza cuyo paquete ya no existe cae en «Sin clasificar», no desaparece
    const huérfana = { ...OAK, id: 'pr-orf', packId: 'pk-borrado' };
    expect(sectionsOf([huérfana], [], { kind: 'all' }, '', 'name', CTX, true).map(s => s.key)).toEqual(['pack:none']);
  });

  it('sin agrupar, o en recientes y favoritos, sale todo junto y sin cabecera; recientes en su propio orden', () => {
    expect(sectionsOf(ALL, [PACK_FOREST], { kind: 'all' }, '', 'name', CTX, false).map(s => s.title)).toEqual([null]);
    const rec = sectionsOf(ALL, [PACK_FOREST], { kind: 'recent' }, '', 'name', { ...CTX, recents: ['pr-tab', 'pr-col'] }, true);
    expect(rec[0]!.props.map(p => p.id)).toEqual(['pr-tab', 'pr-col']);
    expect(sectionsOf([], [], { kind: 'all' }, '', 'name', CTX, false)).toEqual([]);
  });

  it('ordena por nombre o por lo más nuevo', () => {
    const byName = sectionsOf([COLUMN, OAK], [], { kind: 'all' }, '', 'name', CTX, false)[0]!.props.map(p => p.name);
    expect(byName).toEqual(['Columna', 'Roble']);
    const byRecent = sectionsOf([OAK, COLUMN], [], { kind: 'all' }, '', 'recent', CTX, false)[0]!.props.map(p => p.id);
    expect(byRecent).toEqual(['pr-col', 'pr-oak']);
  });

  it('recientes: lo último primero, sin repetidos y con tope', () => {
    expect(pushRecent(['b', 'a'], 'a')).toEqual(['a', 'b']);
    expect(pushRecent(Array.from({ length: RECENTS_MAX }, (_, i) => `x${i}`), 'nuevo')).toHaveLength(RECENTS_MAX);
  });
});

describe('propRules — dónde vive la foto', () => {
  it('va al bucket de fondos, bajo `props/` y SIN campaña: la biblioteca es de la herramienta', () => {
    expect(propPath('pr-oak')).toBe('props/pr-oak.webp');
  });
});

describe('propRules — sembrar muchas (§ 6.4, S/5)', () => {
  it('cuanta más densidad, menos paso; y el paso crece con el área', () => {
    expect(sowStepPx(50, 'low')).toBeGreaterThan(sowStepPx(50, 'mid'));
    expect(sowStepPx(50, 'mid')).toBeGreaterThan(sowStepPx(50, 'high'));
    expect(sowStepPx(100, 'mid')).toBe(2 * sowStepPx(50, 'mid'));
    expect(sowStepPx(0, 'high')).toBe(4);   // nunca cero: sembraría en cada píxel
  });

  it('la primera siempre toca; luego sólo al recorrer el paso', () => {
    expect(dueToSow(null, { x: 0, y: 0 }, 40)).toBe(true);
    expect(dueToSow({ x: 0, y: 0 }, { x: 30, y: 0 }, 40)).toBe(false);
    expect(dueToSow({ x: 0, y: 0 }, { x: 40, y: 0 }, 40)).toBe(true);
  });

  it('esparce dentro del disco, gira en pasos de 5° y varía el tamaño un ±35 % acotado', () => {
    let seq = [0.25, 0.81, 0.5, 0.99, 0.0, 1 - 1e-9];
    const rng = () => seq.shift() ?? 0.5;
    const p = scatterIn({ x: 100, y: 100 }, 50, rng);
    expect(Math.hypot(p.x - 100, p.y - 100)).toBeLessThanOrEqual(50.01);
    expect(randomRotation(rng) % 5).toBe(0);
    seq = [0.0];
    expect(randomScale(2, rng)).toBeCloseTo(1.3);
    seq = [1 - 1e-9];
    expect(randomScale(2, rng)).toBeCloseTo(2.7, 3);
    seq = [1 - 1e-9];
    expect(randomScale(MAX_SCALE, rng)).toBe(MAX_SCALE);
    expect(normDeg(-5)).toBe(355);
  });
});

describe('propRules — lo plantado: orden, apilado, coger y tocar (§ 6.5, § 6.6)', () => {
  const A = SCENE_PROP_OAK;              // z 0, en (400, 300), 300 × 450
  const B = SCENE_PROP_COLUMN;           // z 1, en (700, 200), 100 × 100
  const C: SceneProp = { ...A, id: 'sp-c', z: 0, createdAt: '2026-09-12T07:00:00Z' };

  it('se pintan de abajo arriba: por z y, a igual z, lo más antiguo primero; una nueva va encima de todo', () => {
    expect(paintOrderProps([B, C, A]).map(p => p.id)).toEqual(['sp-oak', 'sp-c', 'sp-col']);
    expect(topZ([A, B, C])).toBe(2);
    expect(topZ([])).toBe(0);
  });

  it('traer adelante · enviar atrás · al frente · al fondo devuelven SÓLO los z que cambian, normalizados', () => {
    const list = [A, C, B];   // orden de pintado: oak(0) · c(0) · col(1)
    expect(restack(list, 'sp-oak', 'front')).toEqual([{ id: 'sp-c', patch: { z: 0 } }, { id: 'sp-col', patch: { z: 1 } }, { id: 'sp-oak', patch: { z: 2 } }].filter(x => list.find(p => p.id === x.id)!.z !== x.patch.z));
    expect(restack(list, 'sp-col', 'back').map(x => `${x.id}:${x.patch.z}`)).toEqual(['sp-col:0', 'sp-oak:1', 'sp-c:2']);
    expect(restack(list, 'sp-oak', 'forward').map(x => `${x.id}:${x.patch.z}`)).toEqual(['sp-oak:1', 'sp-col:2']);
    // ya está arriba de todo: adelante no cambia nada más que normalizar lo que faltara
    expect(restack(list, 'sp-col', 'forward').map(x => `${x.id}:${x.patch.z}`)).toEqual(['sp-c:1', 'sp-col:2']);
    expect(restack(list, 'nadie', 'front')).toEqual([]);
  });

  it('un punto se mira en el marco de la pieza, deshaciendo su giro, y vuelve igual', () => {
    const girada = { ...A, rotation: 90 };
    const local = toPropFrame(girada, { x: 400, y: 450 });   // 150 por debajo del centro → a la IZQUIERDA en su marco
    expect(local.x).toBeCloseTo(150);
    expect(local.y).toBeCloseTo(0);
    const back = fromPropFrame(girada, local);
    expect(back.x).toBeCloseTo(400);
    expect(back.y).toBeCloseTo(450);
  });

  it('coger: dentro sí, fuera no, y con giro se respeta el giro; entre dos, gana la de más arriba', () => {
    expect(pointInProp(A, { x: 400, y: 300 })).toBe(true);
    expect(pointInProp(A, { x: 560, y: 300 })).toBe(false);          // fuera por la derecha (ancho 300)
    expect(pointInProp({ ...A, rotation: 90 }, { x: 560, y: 300 })).toBe(true);   // girada, el alto (450) mira a los lados
    const encima: SceneProp = { ...B, x: 400, y: 300 };
    expect(hitProp([A, encima], { x: 400, y: 300 })!.id).toBe('sp-col');
    expect(hitProp([A, encima], { x: 300, y: 300 })!.id).toBe('sp-oak');
    expect(hitProp([A], { x: 0, y: 0 })).toBeNull();
  });

  it('las esquinas y el tirador de giro salen ya girados', () => {
    const c = propCorners(A);
    expect(c.nw).toEqual({ x: 250, y: 75 });
    expect(c.se).toEqual({ x: 550, y: 525 });
    const g = propCorners({ ...A, rotation: 90 });
    expect(g.nw.x).toBeCloseTo(625);
    expect(g.nw.y).toBeCloseTo(150);
    const h = rotateHandleAt(A, 20);
    expect(h).toEqual({ x: 400, y: 300 - 225 - 20 });
  });

  it('escalar desde una esquina mantiene la proporción y no baja del mínimo', () => {
    const doble = scaleFromCorner(A, { x: 400 + 300, y: 300 + 450 });   // la mano al doble de distancia
    expect(doble.width).toBeCloseTo(600);
    expect(doble.height).toBeCloseTo(900);
    const mini = scaleFromCorner(A, { x: 400, y: 300 });
    expect(mini.width).toBe(8);
    expect(mini.height).toBeCloseTo(12);
  });

  /** Él, 2026-09-13: «*cuando redimensiono no tiene que ser desde el centro*» (§ 6.8, punto 2). */
  it('estirar desde una esquina deja CLAVADA la de enfrente: crece hacia la mano y el centro se mueve', () => {
    // A: centro (400, 300), 300 × 450 → esquina se en (550, 525), nw en (250, 75).
    const doble = scaleFromCornerAnchored(A, 'se', { x: 250 + 600, y: 75 + 900 });   // la mano al doble, desde la nw
    expect(doble.width).toBeCloseTo(600);
    expect(doble.height).toBeCloseTo(900);
    // La nw sigue en (250, 75): el centro nuevo está a medio ancho y medio alto de ella.
    expect(doble.x).toBeCloseTo(250 + 300);
    expect(doble.y).toBeCloseTo(75 + 450);
    // Tirando de la nw hacia dentro, la se (550, 525) no se mueve y la pieza encoge hacia ella.
    const mitad = scaleFromCornerAnchored(A, 'nw', { x: 550 - 150, y: 525 - 225 });
    expect(mitad.width).toBeCloseTo(150);
    expect(mitad.height).toBeCloseTo(225);
    expect(mitad.x).toBeCloseTo(550 - 75);
    expect(mitad.y).toBeCloseTo(525 - 112.5);
    // Torcido no deforma: la proporción se mantiene; y no baja del mínimo aunque se cruce la esquina.
    const torcido = scaleFromCornerAnchored(A, 'se', { x: 250 + 900, y: 75 + 100 });
    expect(torcido.height / torcido.width).toBeCloseTo(1.5);
    const cruzado = scaleFromCornerAnchored(A, 'se', { x: 0, y: 0 });
    expect(cruzado.width).toBe(8);
    // Girada 90°, la esquina clavada sigue clavada en el lienzo.
    const girada = { ...A, rotation: 90 };
    const antes = propCorners(girada).nw;
    const g = scaleFromCornerAnchored(girada, 'se', propCorners(girada).se);   // la mano en la propia esquina: no cambia
    const despues = propCorners({ ...girada, ...g }).nw;
    expect(despues.x).toBeCloseTo(antes.x);
    expect(despues.y).toBeCloseTo(antes.y);
  });

  it('el recuadro de selección coge las piezas cuyo centro cae dentro (§ 6.8, punto 5)', () => {
    expect(propsInRect([A, B], { x: 0, y: 0 }, { x: 500, y: 500 })).toEqual(['sp-oak']);
    expect(propsInRect([A, B], { x: 800, y: 500 }, { x: 0, y: 0 })).toEqual(['sp-oak', 'sp-col']);   // al revés también
    expect(propsInRect([A, B], { x: 0, y: 0 }, { x: 10, y: 10 })).toEqual([]);
  });

  it('el giro apunta a la mano, con «arriba» como 0°', () => {
    expect(rotationToward(A, { x: 400, y: 0 })).toBe(0);
    expect(rotationToward(A, { x: 900, y: 300 })).toBe(90);
    expect(rotationToward(A, { x: 400, y: 900 })).toBe(180);
    expect(rotationToward(A, { x: 0, y: 300 })).toBe(270);
  });
});

/*
 * VARIAS COGIDAS: el marco del grupo, estirarlo y girarlo. Orden suya del 2026-09-14 («*son los mismos nodos
 * de cuando seleccionas un solo objeto*»). Los números van calculados a mano: el Roble ocupa de (250, 75) a
 * (550, 525) y la Columna de (650, 150) a (750, 250), así que el marco de los dos es (250, 75) 500 × 450.
 */
describe('propRules — el grupo de piezas cogidas: marco, estirar y girar (§ 6.8, punto 5)', () => {
  const A = SCENE_PROP_OAK;    // el Roble plantado: (400, 300), 300 × 450, sin girar
  const B = SCENE_PROP_COLUMN; // la Columna: (700, 200), 100 × 100

  it('el marco envuelve a todas, y se mide por las esquinas YA GIRADAS, no por la caja sin girar', () => {
    expect(propsBounds([A, B])).toEqual({ x: 250, y: 75, w: 500, h: 450 });
    expect(propsBounds([])).toBeNull();
    // El Roble tumbado 90°: 300 × 450 pasa a ocupar 450 de ancho por 300 de alto alrededor de su centro.
    expect(propsBounds([{ ...A, rotation: 90 }])).toEqual({ x: 175, y: 150, w: 450, h: 300 });
  });

  it('las cuatro esquinas y el tirador de giro salen donde los de una pieza sola', () => {
    const marco = propsBounds([A, B])!;
    expect(groupCorners(marco)).toEqual({
      nw: { x: 250, y: 75 }, ne: { x: 750, y: 75 }, se: { x: 750, y: 525 }, sw: { x: 250, y: 525 },
    });
    expect(groupRotateHandleAt(marco, 22)).toEqual({ x: 500, y: 53 });
  });

  it('estirar desde una esquina deja CLAVADA la contraria y mantiene la proporción del grupo', () => {
    const marco = propsBounds([A, B])!;
    // La mano al doble de la diagonal desde la esquina clavada (250, 75) → el marco dobla, y el origen no se mueve.
    expect(groupBoxFromCorner(marco, 'se', { x: 1250, y: 975 })).toEqual({ x: 250, y: 75, w: 1000, h: 900 });
    // Y no se puede estrujar hasta desaparecer: con la mano sobre la esquina clavada, queda el mínimo.
    expect(groupBoxFromCorner(marco, 'se', { x: 250, y: 75 })).toEqual({ x: 250, y: 75, w: 8, h: 7.2 });
  });

  it('al llevar el grupo de un marco a otro, cada pieza se corre y crece en la MISMA proporción', () => {
    const from = propsBounds([A, B])!;
    const to = groupBoxFromCorner(from, 'se', { x: 1250, y: 975 });
    expect(scalePropsTo([A, B], from, to)).toEqual([
      { id: 'sp-oak', patch: { x: 550, y: 525, width: 600, height: 900 } },
      { id: 'sp-col', patch: { x: 1150, y: 325, width: 200, height: 200 } },
    ]);
    // La proporción de cada una se respeta: el Roble sigue siendo 2 a 3.
    expect(600 / 900).toBeCloseTo(A.width / A.height);
  });

  it('girar el grupo gira cada pieza sobre sí misma Y la lleva alrededor del centro del marco', () => {
    expect(rotatePropsBy([A, B], { x: 500, y: 300 }, 90)).toEqual([
      { id: 'sp-oak', patch: { x: 500, y: 200, rotation: 90 } },
      { id: 'sp-col', patch: { x: 600, y: 500, rotation: 90 } },
    ]);
    // Sin giro no se mueve nada, y el giro se acumula sobre el que ya tenía.
    expect(rotatePropsBy([{ ...A, rotation: 30 }], { x: 500, y: 300 }, 0)).toEqual([
      { id: 'sp-oak', patch: { x: 400, y: 300, rotation: 30 } },
    ]);
    expect(rotatePropsBy([{ ...A, rotation: 350 }], { x: 400, y: 300 }, 20)[0]!.patch.rotation).toBe(10);
  });
});
