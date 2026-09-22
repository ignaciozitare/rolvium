import { describe, it, expect } from 'vitest';
import type { SceneAdventure } from '../entities/Scene';
import { railAdventureId, showsAdventurePicker } from './sceneAdventureRules';

const A: SceneAdventure[] = [
  { id: 'a1', title: 'El almacén de los muelles', status: 'done' },
  { id: 'a2', title: 'La feria de las sombras', status: 'running' },
  { id: 'a3', title: 'Prólogo en Queens', status: 'draft' },
];

describe('showsAdventurePicker', () => {
  it('sólo con dos o más aventuras: con la «Aventura 1» sola, el carril de siempre', () => {
    expect(showsAdventurePicker(A)).toBe(true);
    expect(showsAdventurePicker([A[0]!])).toBe(false);
    expect(showsAdventurePicker([])).toBe(false);
    expect(showsAdventurePicker(undefined)).toBe(false);
  });
});

describe('railAdventureId — qué aventura enseña el carril', () => {
  it('manda la que eligió el director', () => {
    expect(railAdventureId(A, { adventureId: 'a1' }, 'a3')).toBe('a3');
  });
  it('si no eligió, la de la escena abierta: lo que se ve en el mapa está en la lista', () => {
    expect(railAdventureId(A, { adventureId: 'a1' }, null)).toBe('a1');
  });
  it('sin escena abierta, la EN CURSO; y sin ninguna en curso, la primera', () => {
    expect(railAdventureId(A, null, null)).toBe('a2');
    expect(railAdventureId(A.map(a => ({ ...a, status: 'draft' as const })), null, null)).toBe('a1');
  });
  it('una elegida o una escena de una aventura que ya no está (archivada, borrada) no cuenta', () => {
    expect(railAdventureId(A, { adventureId: 'archivada' }, 'borrada')).toBe('a2');
  });
  it('sin aventuras, ninguna', () => {
    expect(railAdventureId([], null, null)).toBeNull();
  });
});
