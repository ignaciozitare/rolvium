import { describe, it, expect } from 'vitest';
import { PACK_DUNGEON, PACK_FOREST, PROP_COLUMN, PROP_OAK, PROP_TABLE, SCENE_PROP_COLUMN, SCENE_PROP_OAK, SCENE_WAREHOUSE } from '../../../../../tests/helpers/fakes';
import type { Prop, SceneProp } from '../entities/Scene';
import {
  MAX_SCALE, MIN_SCALE, PROP_CATEGORIES, RECENTS_MAX, clampScale, countIn, dueToSow, duplicateProp, filterProps, footprintOf,
  blockShapeOfUpload, fromPropFrame, hasAppProps, hitProp, isAppProp, matchesQuery, nameFromFile, normDeg, paintOrderProps, plantProp, pointInProp, silhouetteOfAlpha,
  propCorners, propPath, pushRecent, randomRotation, randomScale, restack, rotateHandleAt, rotationToward, scaleChanged,
  scaleFromCorner, scaleFromCornerAnchored, propsInRect, propPlace, scaleOfWidth, scatterIn, sectionsOf, sowStepPx, topZ, toPropFrame,
  groupBoxFromCorner, groupCorners, groupRotateHandleAt, propsBounds, rotatePropsBy, scalePropsTo,
  PHOTO_SPAN_CELLS, photoFootprint, photoIdsOf, photoIdsVisibleTo, plantPhoto, rectTouchesPlayArea,
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
    expect(nameFromFile('.png')).toBe('Objeto');
    // …y quien llama pone el suyo: la misma función la usan los objetos y las texturas.
    expect(nameFromFile('.png', 'Textura')).toBe('Textura');
    expect(nameFromFile('roca.webp', 'Textura')).toBe('roca');
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

  it('y desde las OTRAS TRES esquinas igual: la de enfrente se queda exactamente donde estaba', () => {
    const marco = propsBounds([A, B])!;   // (250, 75) 500 × 450
    // Tirando de NW, la clavada es SE (750, 525): el marco crece hacia arriba y a la izquierda.
    expect(groupBoxFromCorner(marco, 'nw', { x: -250, y: -375 })).toEqual({ x: -250, y: -375, w: 1000, h: 900 });
    // Tirando de NE, la clavada es SW (250, 525).
    expect(groupBoxFromCorner(marco, 'ne', { x: 1250, y: -375 })).toEqual({ x: 250, y: -375, w: 1000, h: 900 });
    // Tirando de SW, la clavada es NE (750, 75).
    expect(groupBoxFromCorner(marco, 'sw', { x: -250, y: 975 })).toEqual({ x: -250, y: 75, w: 1000, h: 900 });
    // En los tres, la esquina de enfrente sigue en su sitio y la proporción no se ha roto.
    for (const [esquina, mano, fija] of [['nw', { x: -250, y: -375 }, { x: 750, y: 525 }], ['ne', { x: 1250, y: -375 }, { x: 250, y: 525 }], ['sw', { x: -250, y: 975 }, { x: 750, y: 75 }]] as const) {
      const r = groupBoxFromCorner(marco, esquina, mano);
      expect([r.x, r.x + r.w]).toContain(fija.x);
      expect([r.y, r.y + r.h]).toContain(fija.y);
      expect(r.w / r.h).toBeCloseTo(marco.w / marco.h);
    }
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

// ── LA SILUETA (§ 6.9) ───────────────────────────────────────────────────────

/** Opacidad de mentira: un óvalo apaisado dentro de una imagen cuadrada, que es el caso de sus vehículos. */
const CAMION = (() => {
  const w = 64, h = 64, data = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dentro = ((x - 32) / 30) ** 2 + ((y - 32) / 8) ** 2 <= 1;
    data[y * w + x] = dentro ? 255 : 0;
  }
  return { data, width: w, height: h };
})();

describe('la silueta de lo que se sube (§ 6.9)', () => {
  it('🔑 de la foto de un camión sale una silueta apaisada, no el cuadrado que él vio en pantalla', () => {
    const s = silhouetteOfAlpha(CAMION);
    expect(s).not.toBeNull();
    expect(s!.length).toBeGreaterThanOrEqual(3);
    // Ancha de verdad y baja de verdad: eso es lo que arregla la sombra del camión.
    expect(Math.max(...s!.map(p => Math.abs(p.x)))).toBeGreaterThan(0.4);
    expect(Math.max(...s!.map(p => Math.abs(p.y)))).toBeLessThan(0.2);
  });

  it('sin opacidad que leer, la pieza nace con el rectángulo de siempre', () => {
    expect(silhouetteOfAlpha(null)).toBeNull();
    expect(silhouetteOfAlpha(undefined)).toBeNull();
    // Una imagen entera transparente tampoco da figura.
    expect(silhouetteOfAlpha({ data: new Uint8ClampedArray(32 * 32), width: 32, height: 32 })).toBeNull();
    expect(blockShapeOfUpload(null)).toBe('rect');
  });

  it('con silueta, la pieza nace diciendo que estorba POR SU SILUETA', () => {
    expect(blockShapeOfUpload(silhouetteOfAlpha(CAMION))).toBe('silhouette');
  });

  it('la copia plantada HEREDA la silueta de la biblioteca, como hereda la foto', () => {
    const silueta = silhouetteOfAlpha(CAMION);
    const planted = plantProp({ ...OAK, defaultBlockShape: 'silhouette', defaultSilhouette: silueta }, { x: 10, y: 20 }, SCENE_WAREHOUSE);
    expect(planted.blockShape).toBe('silhouette');
    expect(planted.silhouette).toEqual(silueta);
    // Y la huella que la mide sigue siendo la pieza entera, como con el rectángulo.
    expect(planted.blockW).toBe(planted.width);
    expect(planted.blockH).toBe(planted.height);
  });

  it('una pieza vieja, sin silueta, se planta exactamente como hasta hoy', () => {
    const planted = plantProp(OAK, { x: 10, y: 20 }, SCENE_WAREHOUSE);
    expect(planted.blockShape).toBe('rect');
    expect(planted.silhouette).toBeNull();
  });
});

/**
 * LA FOTO PUESTA EN LA ESCENA (H13, rebanada 4). Una foto puesta **es** una fila de `maps_scene_props`, que es
 * lo que le regala moverse, estirarse, girarse, copiarse y deshacerse sin una línea propia — y lo que la deja
 * DEBAJO DE LAS FICHAS, que es lo que él pidió el 2026-09-27 («*debajo*»).
 *
 * Las tres cosas que la base EXIGE de una foto puesta (`maps_scene_props_photo_shape`) se fijan aquí: sin
 * nombre, sin enlace y sin estorbar. Si alguien las cambia, la inserción la rechaza Postgres, no un test.
 */
describe('plantPhoto — poner una foto en la escena', () => {
  const G = SCENE_WAREHOUSE.grid.size;
  const FOTO = { id: 'ph-1', width: 1024, height: 1280 };

  it('nace donde se suelta, apuntando a su foto y SIN ser una pieza de la biblioteca', () => {
    const puesta = plantPhoto(FOTO, { x: 250, y: 180 }, SCENE_WAREHOUSE, G);
    expect(puesta.photoId).toBe('ph-1');
    expect(puesta.propId).toBeNull();
    expect(puesta).toMatchObject({ sceneId: SCENE_WAREHOUSE.id, campaignId: SCENE_WAREHOUSE.campaignId, x: 250, y: 180, rotation: 0 });
  });

  it('🔑 no se lleva NI EL NOMBRE NI EL ENLACE: esa fila la lee el jugador y un nombre puede destripar', () => {
    const puesta = plantPhoto(FOTO, { x: 0, y: 0 }, SCENE_WAREHOUSE, G);
    expect(puesta.name).toBe('');
    expect(puesta.imageUrl).toBe('');
  });

  it('🔑 no estorba ni la vista ni el paso, y no lleva silueta', () => {
    const puesta = plantPhoto(FOTO, { x: 0, y: 0 }, SCENE_WAREHOUSE, G);
    expect(puesta.blocksSight).toBe(false);
    expect(puesta.blocksMove).toBe(false);
    expect(puesta.silhouette).toBeNull();
  });

  it('mide seis casillas por su lado mayor y NO se deforma', () => {
    // SEIS es una decisión de producto, no un detalle: escrita en el spec y en el comentario de la constante.
    expect(PHOTO_SPAN_CELLS).toBe(6);
    const puesta = plantPhoto(FOTO, { x: 0, y: 0 }, SCENE_WAREHOUSE, G);
    expect(puesta.height).toBe(PHOTO_SPAN_CELLS * G);
    // 1024/1280 de un lado mayor de seis casillas: la proporción de la foto, clavada.
    expect(puesta.width).toBe(Math.round(PHOTO_SPAN_CELLS * G * (1024 / 1280)));
    expect(puesta.width / puesta.height).toBeCloseTo(1024 / 1280, 2);
  });

  it('una foto apaisada manda por el ancho, no por el alto', () => {
    const puesta = plantPhoto({ id: 'ph-2', width: 1600, height: 900 }, { x: 0, y: 0 }, SCENE_WAREHOUSE, G);
    expect(puesta.width).toBe(PHOTO_SPAN_CELLS * G);
    expect(puesta.height).toBeLessThan(puesta.width);
  });

  it('se apila y se pone en la capa que se le diga, como cualquier pieza', () => {
    const puesta = plantPhoto(FOTO, { x: 0, y: 0 }, SCENE_WAREHOUSE, G, 'ly-7', 42);
    expect(puesta.layerId).toBe('ly-7');
    expect(puesta.z).toBe(42);
  });
});

describe('photoFootprint — la huella, sin deformar nunca', () => {
  it('encoge y agranda hasta el lado pedido conservando la proporción', () => {
    expect(photoFootprint(200, 100, 50)).toEqual({ width: 50, height: 25 });
    expect(photoFootprint(200, 100, 400)).toEqual({ width: 400, height: 200 });
  });

  it('una foto sin medidas sale cuadrada en vez de desaparecer del mapa', () => {
    expect(photoFootprint(0, 0, 120)).toEqual({ width: 120, height: 120 });
  });

  it('una foto larguísima no deja el lado corto en cero', () => {
    expect(photoFootprint(10000, 1, 100).height).toBeGreaterThanOrEqual(1);
  });
});

describe('photoIdsOf — qué hay que firmar para poder pintar', () => {
  const conFoto = (id: string, photoId: string | null): SceneProp => ({ ...SCENE_PROP_OAK, id, photoId });

  it('saca los ids de foto, sin repetir y sin las piezas normales', () => {
    expect(photoIdsOf([conFoto('a', 'ph-1'), conFoto('b', null), conFoto('c', 'ph-1'), conFoto('d', 'ph-2')]))
      .toEqual(['ph-1', 'ph-2']);
  });

  it('sin fotos puestas no hay nada que firmar', () => {
    expect(photoIdsOf([SCENE_PROP_OAK, SCENE_PROP_COLUMN])).toEqual([]);
    expect(photoIdsOf([])).toEqual([]);
  });
});

/**
 * EL ÁREA DE JUEGO (H13, rebanada 4). Suyo, 2026-09-22: «*solo se tienen que ver las fotos dentro de la escena
 * en el area de juego si las pongo al costado los jugadores no las ven solo el dm*».
 *
 * 🔑 Esta cuenta es **la misma que hace la base** en `maps_rect_touches_play_area`. Si las dos dejan de decir
 * lo mismo, el director ve una cosa y el jugador otra — que es el fallo que esto existe para no tener.
 */
describe('rectTouchesPlayArea — qué toca el mapa y qué se queda al costado', () => {
  const ESCENA = SCENE_WAREHOUSE; // 1080 × 675
  const foto = (over: Partial<{ x: number; y: number; width: number; height: number; rotation: number }> = {}) =>
    ({ x: 540, y: 337, width: 300, height: 200, rotation: 0, ...over });

  it('en el centro del mapa, dentro', () => {
    expect(rectTouchesPlayArea(foto(), ESCENA)).toBe(true);
  });

  it('asomando por el borde, dentro: lo que sobresale se recorta, no se esconde', () => {
    expect(rectTouchesPlayArea(foto({ x: 1050 }), ESCENA)).toBe(true);
    expect(rectTouchesPlayArea(foto({ y: -50 }), ESCENA)).toBe(true);
  });

  it('aparcada al costado, FUERA', () => {
    expect(rectTouchesPlayArea(foto({ x: 1400 }), ESCENA)).toBe(false);
    expect(rectTouchesPlayArea(foto({ x: -400 }), ESCENA)).toBe(false);
    expect(rectTouchesPlayArea(foto({ y: 1200 }), ESCENA)).toBe(false);
  });

  it('tocar el borde justo NO cuenta como dentro', () => {
    // Centro a media huella del borde: se tocan exactamente, y eso es fuera.
    expect(rectTouchesPlayArea(foto({ x: 1080 + 150 }), ESCENA)).toBe(false);
  });

  it('girada, se mide la forma de verdad y no la caja que la envuelve', () => {
    // Una foto larga y estrecha pasada la esquina: recta se queda fuera; girada 45° su punta sí alcanza el
    // mapa. Si esto midiera la caja que la envuelve en vez de la forma, las dos darían lo mismo.
    const casiFuera = { x: 1180, y: 775, width: 300, height: 40, rotation: 0 };
    expect(rectTouchesPlayArea(casiFuera, ESCENA)).toBe(false);
    expect(rectTouchesPlayArea({ ...casiFuera, x: 1150, y: 700, rotation: 45 }, ESCENA)).toBe(true);
  });

  /**
   * 🔴 LOS DOS EJES PROPIOS DE LA PIEZA, clavados. Estas tres están **pasada una esquina**: la caja que las
   * envuelve sí pisa el mapa, pero la foto girada no lo toca. Sólo los dos ejes de la pieza lo distinguen, así
   * que si alguien los quita —o quita uno— esto se pone rojo. Los tres valores están comprobados contra
   * `maps_rect_touches_play_area` en la base (2026-09-28): las dos contestan `false`.
   *
   * Hacía falta porque la prueba de arriba NO lo distingue: sus dos casos los decide ya el eje del mapa, y
   * pasaba igual de verde con la caja envolvente.
   */
  it('🔴 pasada una esquina, FUERA aunque su caja envolvente pise el mapa', () => {
    expect(rectTouchesPlayArea({ x: 1186, y: 803, width: 472, height: 119, rotation: 108 }, ESCENA)).toBe(false);
    expect(rectTouchesPlayArea({ x: -111, y: 773, width: 283, height: 105, rotation: 31 }, ESCENA)).toBe(false);
    expect(rectTouchesPlayArea({ x: -202, y: -221, width: 513, height: 481, rotation: 146 }, ESCENA)).toBe(false);
    // Éstas las separa el eje de LO LARGO de la foto, que es el único de los cuatro que las caza: si se quita
    // ese eje, o se le cambia un signo, estas tres cambian de respuesta. Comprobadas contra la base.
    expect(rectTouchesPlayArea({ x: 1100, y: 800, width: 185, height: 368, rotation: 241 }, ESCENA)).toBe(false);
    expect(rectTouchesPlayArea({ x: -38, y: 1016, width: 520, height: 643, rotation: 307 }, ESCENA)).toBe(false);
    expect(rectTouchesPlayArea({ x: -262, y: 717, width: 418, height: 695, rotation: 42 }, ESCENA)).toBe(true);
  });

  /**
   * 🔴 EL GIRO NO TIENE CUADRANTE BUENO. `cos` y `sin` entran **en valor absoluto** en los cuatro topes, porque
   * ahí lo que se mide es cuánto ocupa, y ocupar no es negativo. Sin esos valores absolutos, un giro de más de
   * 90° deja topes en negativo y la cuenta dice «fuera» de una foto que está **en medio del mapa**: al jugador
   * le desaparecería una foto que el director ve puesta. Comprobadas contra la base (2026-09-28): `true`.
   */
  it('🔴 dentro es dentro en los cuatro cuadrantes, no sólo girando poco', () => {
    expect(rectTouchesPlayArea({ x: 771, y: 372, width: 477, height: 369, rotation: 271 }, ESCENA)).toBe(true);
    expect(rectTouchesPlayArea({ x: -188, y: 31, width: 327, height: 387, rotation: 210 }, ESCENA)).toBe(true);
    expect(rectTouchesPlayArea({ x: 135, y: 413, width: 517, height: 232, rotation: 137 }, ESCENA)).toBe(true);
  });

  it('🔴 el borde justo tampoco cuenta cuando está girada', () => {
    // El borde EXACTO para esta huella y este giro, con la misma cuenta que hace la función: tocarse es fuera.
    // Se hace por los DOS lados, el de abajo y el de la derecha, porque cada uno lo decide un tope distinto.
    const rad = (135 * Math.PI) / 180;
    const c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
    expect(rectTouchesPlayArea({ x: 1080 + (150 * c + 100 * s), y: 337.5, width: 300, height: 200, rotation: 135 }, ESCENA)).toBe(false);
    const rad15 = (15 * Math.PI) / 180;
    const bordeAbajo = 675 + (150 * Math.abs(Math.sin(rad15)) + 100 * Math.abs(Math.cos(rad15)));
    expect(rectTouchesPlayArea({ x: 540, y: bordeAbajo, width: 300, height: 200, rotation: 15 }, ESCENA)).toBe(false);
  });

  /**
   * 🔴 EL ANCHO VA CON SU COSENO Y EL ALTO CON SU SENO, no al revés. Cruzarlos es el error de copia más fácil
   * de cometer aquí y no se nota en una foto cuadrada ni a 0°/90°, pero con una foto alargada y girada cambia
   * la respuesta en un rango ancho — no sólo en el borde. Comprobadas contra la base (2026-09-28).
   */
  it('🔴 no se cruzan el ancho y el alto en los topes', () => {
    expect(rectTouchesPlayArea({ x: 1307, y: 761, width: 208, height: 483, rotation: 270 }, ESCENA)).toBe(true);
    expect(rectTouchesPlayArea({ x: 1188, y: 451, width: 412, height: 38, rotation: 156 }, ESCENA)).toBe(true);
    expect(rectTouchesPlayArea({ x: 1282, y: 692, width: 438, height: 372, rotation: 88 }, ESCENA)).toBe(false);
  });
});

describe('photoIdsVisibleTo — el director las ve todas; el jugador, sólo las del mapa', () => {
  const puesta = (id: string, photoId: string, x: number): SceneProp =>
    ({ ...SCENE_PROP_OAK, id, propId: null, photoId, name: '', imageUrl: '', x, y: 337, width: 300, height: 200, rotation: 0 });
  const DENTRO = puesta('sp-1', 'ph-dentro', 540);
  const AL_COSTADO = puesta('sp-2', 'ph-costado', 1500);

  it('el DIRECTOR ve también la que tiene aparcada al costado, esperando su momento', () => {
    expect(photoIdsVisibleTo([DENTRO, AL_COSTADO], SCENE_WAREHOUSE, true)).toEqual(['ph-dentro', 'ph-costado']);
  });

  it('🔑 el JUGADOR sólo ve la que está en el mapa', () => {
    expect(photoIdsVisibleTo([DENTRO, AL_COSTADO], SCENE_WAREHOUSE, false)).toEqual(['ph-dentro']);
  });

  it('las piezas normales no entran aquí: ésas no se firman', () => {
    expect(photoIdsVisibleTo([SCENE_PROP_OAK, DENTRO], SCENE_WAREHOUSE, false)).toEqual(['ph-dentro']);
  });
});
