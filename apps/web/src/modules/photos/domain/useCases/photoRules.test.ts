import { describe, it, expect } from 'vitest';
import { cleanPhotoName, nameFromFile, searchPhotos } from './photoRules';
import { PHOTO_NAME_MAX, photoObjectPath } from '../entities/Photo';

describe('nameFromFile — con qué nombre nace una foto', () => {
  it('el del fichero, sin la extensión', () => {
    expect(nameFromFile('La cripta.jpg', 'Foto')).toBe('La cripta');
    expect(nameFromFile('mapa.del.tesoro.webp', 'Foto')).toBe('mapa.del.tesoro');
  });

  it('los guiones bajos se leen como espacios, y los espacios de más se van', () => {
    expect(nameFromFile('carta__del_conde .png', 'Foto')).toBe('carta del conde');
  });

  it('si no queda nada, el nombre de reserva', () => {
    expect(nameFromFile('.png', 'Foto')).toBe('Foto');
    expect(nameFromFile('', 'Foto')).toBe('Foto');
  });

  it('nunca pasa del tope de la base', () => {
    expect(nameFromFile(`${'a'.repeat(200)}.jpg`, 'Foto')).toHaveLength(PHOTO_NAME_MAX);
  });
});

describe('cleanPhotoName — renombrar', () => {
  it('recorta y aprieta los espacios', () => {
    expect(cleanPhotoName('  El   sótano  ')).toBe('El sótano');
  });
  it('un nombre vacío no vale', () => {
    expect(cleanPhotoName('   ')).toBeNull();
  });
  it('se corta en el tope', () => {
    expect(cleanPhotoName('b'.repeat(300))).toHaveLength(PHOTO_NAME_MAX);
  });
});

describe('searchPhotos — la búsqueda de la biblioteca', () => {
  const photos = [{ name: 'Cámara secreta' }, { name: 'El conde' }, { name: 'CARTA del conde' }];

  it('sin tildes ni mayúsculas', () => {
    expect(searchPhotos(photos, 'camara')).toEqual([{ name: 'Cámara secreta' }]);
    expect(searchPhotos(photos, 'CONDE')).toEqual([{ name: 'El conde' }, { name: 'CARTA del conde' }]);
  });

  it('vacía = todas, en su orden', () => {
    expect(searchPhotos(photos, '  ')).toEqual(photos);
  });

  it('sin resultados, lista vacía', () => {
    expect(searchPhotos(photos, 'dragón')).toEqual([]);
  });
});

describe('photoObjectPath — dónde vive el fichero', () => {
  it('campaña/foto, sin extensión: así un jugador la puede pedir sin leer la biblioteca', () => {
    expect(photoObjectPath('c1', 'p1')).toBe('c1/p1');
  });
});
