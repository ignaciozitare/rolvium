import { describe, it, expect } from 'vitest';
import {
  countIn, filterItems, hasBuiltIn, inShelf, LIBRARY_DRAG_MIME, matchesQuery, rangeIds, sectionsOf, sortItems, toggleId,
  type LibraryGroup, type LibraryItem, type PlaceOf,
} from './libraryRules';

/**
 * Las reglas COMUNES del catálogo (§ 6.8, punto 1: «*el mismo componente*» para piezas y texturas). Se prueban
 * con una biblioteca inventada donde cada cosa dice dónde vive por `placeOf`, que es lo único que cambia entre
 * una pieza y una textura.
 */
interface Thing extends LibraryItem { where: string | null; serie: string | null }
const thing = (id: string, name: string, where: string | null, serie: string | null = null, uploadedBy: string | null = 'u-gm', createdAt = '2026-09-01'): Thing =>
  ({ id, name, where, serie, uploadedBy, createdAt });
const place: PlaceOf<Thing> = t => ({ group: t.where, builtIn: t.serie });
const GROUPS: LibraryGroup[] = [{ id: 'g-madera', name: 'Madera', order: 2 }, { id: 'g-piedra', name: 'Piedra', order: 1 }];
const GRANITO = thing('t-granito', 'Granito', 'g-piedra', null, null, '2026-09-03');   // la trae Rolvium, y vive en Piedra
const ADOQUIN = thing('t-adoquin', 'Adoquín', 'g-piedra', null, 'u-gm', '2026-09-02');
const ROBLE = thing('t-roble', 'Roble viejo', 'g-madera');
const SUELTA = thing('t-suelta', 'Árbol suelto', null);
const SERIE = thing('t-serie', 'Silla de serie', null, 'furniture', null);
const ALL = [GRANITO, ADOQUIN, ROBLE, SUELTA, SERIE];
const CTX = { favorites: ['t-roble'], recents: ['t-adoquin', 't-granito'] };

describe('libraryRules — estantes y buscador', () => {
  it('el buscador no distingue mayúsculas ni acentos, y vacío coincide con todo', () => {
    expect(matchesQuery(SUELTA, 'arbol')).toBe(true);
    expect(matchesQuery(SUELTA, 'ÁRBOL')).toBe(true);
    expect(matchesQuery(SUELTA, 'roble')).toBe(false);
    expect(matchesQuery(SUELTA, '  ')).toBe(true);
  });

  it('cada estante coge lo suyo: un grupo (aunque lo traiga la app), lo sin clasificar, los de serie, recientes y favoritos', () => {
    expect(inShelf(GRANITO, { kind: 'pack', id: 'g-piedra' }, CTX, place)).toBe(true);   // de la app, pero VIVE en Piedra
    expect(inShelf(ROBLE, { kind: 'pack', id: 'g-piedra' }, CTX, place)).toBe(false);
    expect(inShelf(SUELTA, { kind: 'pack', id: null }, CTX, place)).toBe(true);
    expect(inShelf(SERIE, { kind: 'pack', id: null }, CTX, place)).toBe(false);          // la de serie no es «sin clasificar»
    expect(inShelf(SERIE, { kind: 'category', category: 'furniture' }, CTX, place)).toBe(true);
    expect(inShelf(ROBLE, { kind: 'favorites' }, CTX, place)).toBe(true);
    expect(inShelf(GRANITO, { kind: 'recent' }, CTX, place)).toBe(true);
    expect(inShelf(ROBLE, { kind: 'recent' }, CTX, place)).toBe(false);
    expect(countIn(ALL, { kind: 'pack', id: 'g-piedra' }, CTX, place)).toBe(2);
    expect(countIn(ALL, { kind: 'all' }, CTX, place)).toBe(5);
  });

  it('filtrar cruza el estante con el buscador; ordenar por nombre, por fecha, y recientes en su orden', () => {
    expect(filterItems(ALL, { kind: 'all' }, 'roble', CTX, place).map(t => t.id)).toEqual(['t-roble']);
    expect(filterItems(ALL, { kind: 'pack', id: 'g-piedra' }, 'gra', CTX, place).map(t => t.id)).toEqual(['t-granito']);
    expect(sortItems([ROBLE, ADOQUIN, GRANITO], 'name', CTX, { kind: 'all' }).map(t => t.id)).toEqual(['t-adoquin', 't-granito', 't-roble']);
    expect(sortItems([ROBLE, ADOQUIN, GRANITO], 'recent', CTX, { kind: 'all' }).map(t => t.id)).toEqual(['t-granito', 't-adoquin', 't-roble']);
    expect(sortItems([GRANITO, ADOQUIN], 'name', CTX, { kind: 'recent' }).map(t => t.id)).toEqual(['t-adoquin', 't-granito']);
  });

  it('las secciones: una por grupo en su orden, luego lo sin clasificar, luego lo de serie; y sin agrupar todo junto', () => {
    const secs = sectionsOf(ALL, GROUPS, ['furniture', 'misc'], { kind: 'all' }, '', 'name', CTX, true, place);
    expect(secs.map(s => s.key)).toEqual(['pack:g-piedra', 'pack:g-madera', 'pack:none', 'cat:furniture']);
    expect(secs[0]!.group?.name).toBe('Piedra');
    expect(secs[0]!.items.map(t => t.id)).toEqual(['t-adoquin', 't-granito']);
    expect(secs[3]!.builtIn).toBe('furniture');
    expect(sectionsOf(ALL, GROUPS, [], { kind: 'pack', id: 'g-madera' }, '', 'name', CTX, true, place).map(s => s.key)).toEqual(['pack:g-madera']);
    const junto = sectionsOf(ALL, GROUPS, [], { kind: 'all' }, '', 'name', CTX, false, place);
    expect(junto.map(s => s.key)).toEqual(['all']);
    expect(junto[0]!.items).toHaveLength(5);
    expect(sectionsOf([], GROUPS, [], { kind: 'all' }, '', 'name', CTX, true, place)).toEqual([]);
    // Algo cuyo grupo ya no existe cae en «sin clasificar», no se pierde.
    const huerfana = thing('t-h', 'Huérfana', 'g-borrado');
    expect(sectionsOf([huerfana], GROUPS, [], { kind: 'all' }, '', 'name', CTX, true, place)[0]!.key).toBe('pack:none');
  });

  it('¿hay algo de serie? sólo si alguna cosa vive en una sección de serie', () => {
    expect(hasBuiltIn(ALL, place)).toBe(true);
    expect(hasBuiltIn([GRANITO, ROBLE], place)).toBe(false);   // que la traiga la app no la hace «de serie» aquí
  });
});

describe('libraryRules — la selección múltiple (§ 6.8, punto 4)', () => {
  it('marcar y desmarcar una', () => {
    expect(toggleId([], 'a')).toEqual(['a']);
    expect(toggleId(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('Mayús+clic coge el tramo desde el ancla, hacia cualquier lado, sin repetir; sin ancla es marcar una', () => {
    const visible = ['a', 'b', 'c', 'd', 'e'];
    expect(rangeIds(visible, ['b'], 'b', 'd')).toEqual(['b', 'c', 'd']);
    expect(rangeIds(visible, ['d'], 'd', 'a')).toEqual(['d', 'a', 'b', 'c']);
    expect(rangeIds(visible, [], null, 'c')).toEqual(['c']);
    expect(rangeIds(visible, ['a'], 'fuera', 'c')).toEqual(['a', 'c']);
  });

  it('el arrastre interno lleva su propio tipo, para no confundirlo con soltar imágenes', () => {
    expect(LIBRARY_DRAG_MIME).toMatch(/^application\//);
  });
});
