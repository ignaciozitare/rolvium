import { describe, it, expect } from 'vitest';
import { emptyDoc } from '@rolvium/core';
import type { Adventure } from '../entities/Adventure';
import { canRemoveAdventure, moveInOrder, nextSortOrder, runningPatches, sceneDestinations } from './adventureRules';

const adv = (id: string, over: Partial<Adventure> = {}): Adventure => ({
  id, campaignId: 'c1', title: id, summary: null, doc: emptyDoc(), status: 'draft', sortOrder: 0,
  updatedAt: '2026-09-21T10:00:00Z', ...over,
});

describe('moveInOrder — subir y bajar', () => {
  const list = [{ id: 'a', sortOrder: 0 }, { id: 'b', sortOrder: 1 }, { id: 'c', sortOrder: 2 }];

  it('subir cambia su sitio con el de arriba, y nada más', () => {
    expect(moveInOrder(list, 'b', 'up')).toEqual([{ id: 'b', sortOrder: 0 }, { id: 'a', sortOrder: 1 }]);
  });

  it('bajar cambia su sitio con el de abajo', () => {
    expect(moveInOrder(list, 'b', 'down')).toEqual([{ id: 'c', sortOrder: 1 }, { id: 'b', sortOrder: 2 }]);
  });

  it('el primero no sube y el último no baja', () => {
    expect(moveInOrder(list, 'a', 'up')).toEqual([]);
    expect(moveInOrder(list, 'c', 'down')).toEqual([]);
    expect(moveInOrder(list, 'no-existe', 'up')).toEqual([]);
  });

  it('reparte los huecos que ya había aunque no sean seguidos (escenas de una aventura entre las de otras)', () => {
    expect(moveInOrder([{ id: 'x', sortOrder: 3 }, { id: 'y', sortOrder: 7 }], 'y', 'up'))
      .toEqual([{ id: 'y', sortOrder: 3 }, { id: 'x', sortOrder: 7 }]);
  });

  /** Las aventuras nuevas nacían TODAS con `sort_order = 0`: cambiar dos ceros entre sí no movía nada. */
  it('con empates, los deshace para que el cambio se vea', () => {
    const tied = [{ id: 'a', sortOrder: 0 }, { id: 'b', sortOrder: 0 }, { id: 'c', sortOrder: 0 }];
    const moves = moveInOrder(tied, 'c', 'up');
    const after = tied.map(x => moves.find(m => m.id === x.id) ?? x).sort((p, q) => p.sortOrder - q.sortOrder);
    expect(after.map(x => x.id)).toEqual(['a', 'c', 'b']);
    expect(new Set(after.map(x => x.sortOrder)).size).toBe(3);
  });
});

describe('nextSortOrder', () => {
  it('va detrás de todo, y en una lista vacía es el primero', () => {
    expect(nextSortOrder([{ id: 'a', sortOrder: 4 }, { id: 'b', sortOrder: 1 }])).toBe(5);
    expect(nextSortOrder([])).toBe(0);
  });
});

describe('runningPatches — sólo UNA en curso', () => {
  it('marca la elegida y pasa a TERMINADA la que estaba en curso', () => {
    const all = [adv('a', { status: 'running' }), adv('b'), adv('c', { status: 'done' })];
    expect(runningPatches(all, 'b')).toEqual([{ id: 'b', status: 'running' }, { id: 'a', status: 'done' }]);
  });

  it('si ya estaba en curso no cambia nada', () => {
    expect(runningPatches([adv('a', { status: 'running' }), adv('b')], 'a')).toEqual([]);
  });

  it('si había dos en curso (de antes de esta regla), deja sólo la elegida', () => {
    const all = [adv('a', { status: 'running' }), adv('b', { status: 'running' }), adv('c')];
    expect(runningPatches(all, 'c')).toEqual([
      { id: 'c', status: 'running' }, { id: 'a', status: 'done' }, { id: 'b', status: 'done' },
    ]);
  });

  it('sacar una del archivo marcándola en curso también funciona', () => {
    expect(runningPatches([adv('a', { status: 'archived' }), adv('b', { status: 'running' })], 'a'))
      .toEqual([{ id: 'a', status: 'running' }, { id: 'b', status: 'done' }]);
  });
});

describe('canRemoveAdventure', () => {
  it('la última de la campaña no se borra — contando también las archivadas', () => {
    expect(canRemoveAdventure([adv('a')])).toBe(false);
    expect(canRemoveAdventure([adv('a'), adv('b', { status: 'archived' })])).toBe(true);
  });
});

describe('sceneDestinations — a dónde van las escenas de la que se borra', () => {
  it('todas las demás, las archivadas al final, y sale marcada la EN CURSO', () => {
    const all = [adv('arch', { status: 'archived' }), adv('a'), adv('run', { status: 'running' }), adv('gone')];
    const { options, preferred } = sceneDestinations(all, 'gone');
    expect(options.map(a => a.id)).toEqual(['a', 'run', 'arch']);
    expect(preferred).toBe('run');
  });

  it('si se borra la que está en curso, sale marcada la primera del carril', () => {
    const all = [adv('run', { status: 'running' }), adv('a'), adv('b')];
    expect(sceneDestinations(all, 'run').preferred).toBe('a');
  });

  it('si no queda ninguna, no hay destino', () => {
    expect(sceneDestinations([adv('a')], 'a')).toEqual({ options: [], preferred: null });
  });
});
