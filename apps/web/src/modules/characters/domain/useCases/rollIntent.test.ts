import { describe, expect, it } from 'vitest';
import { plenilunio } from '@rolvium/system-plenilunio';
import type { ActionDef, SheetData } from '@rolvium/core';
import { KAREN_DATA } from '../../../../../tests/helpers/fakes';
import {
  type RollIntent, diceOf, diceOrigin, headRef, opensPopover, poolChoices, previewRequest, rangeChoices, rangeOfIntent, statIdOf,
} from './rollIntent';

const action = (id: string): ActionDef => plenilunio.engine.actions!.find(a => a.id === id)!;
const shoot: RollIntent = { kind: 'action', action: action('attack.ranged'), itemId: 'magnum44' };
const hit: RollIntent = { kind: 'action', action: action('attack.melee'), itemId: 'bat' };
const gift: RollIntent = { kind: 'action', action: action('gift.activate'), itemId: 'titanFury' };
const reload: RollIntent = { kind: 'action', action: action('reload'), itemId: 'magnum44' };
const stat: RollIntent = { kind: 'stat', statId: 'cunning' };
const destiny = plenilunio.engine.sharedResources![0]!;

describe('rollIntent — lo que hay detrás del desplegable de tirar', () => {
  it('abre el desplegable TIRAR y las acciones de arma; activar un don y recargar siguen yendo directas', () => {
    expect(opensPopover(plenilunio, stat)).toBe(true);
    expect(opensPopover(plenilunio, shoot)).toBe(true);
    expect(opensPopover(plenilunio, hit)).toBe(true);
    // El `.pen` no diseña estas dos: dejarlas como estaban es lo contrario de inventar.
    expect(opensPopover(plenilunio, gift)).toBe(false);
    expect(opensPopover(plenilunio, reload)).toBe(false);
  });

  it('el alcance sale de la fila del catálogo, no de un nombre escrito a mano', () => {
    expect(rangeOfIntent(plenilunio, shoot)).toBe('medium');
    expect(rangeOfIntent(plenilunio, hit)).toBe('melee');
    expect(rangeOfIntent(plenilunio, gift)).toBeNull();
    expect(rangeOfIntent(plenilunio, stat)).toBeNull();
  });

  it('un arma ofrece los alcances hasta el suyo; más lejos se ve pero no se elige (p.96)', () => {
    const r = rangeChoices(plenilunio, 'medium');
    expect(r.map(x => [x.id, x.difficulty, x.beyond])).toEqual([
      ['short', 2, false], ['medium', 3, false], ['long', 5, true], ['veryLong', 6, true],
    ]);
    // Un rifle de francotirador llega a todo; cuerpo a cuerpo no hay nada que elegir.
    expect(rangeChoices(plenilunio, 'veryLong').every(x => !x.beyond)).toBe(true);
    expect(rangeChoices(plenilunio, 'melee')).toEqual([]);
    expect(rangeChoices(plenilunio, null)).toEqual([]);
  });

  it('la característica sobre la que se tira: la del botón, o la que use la acción', () => {
    expect(statIdOf(plenilunio, KAREN_DATA, stat)).toBe('cunning');
    expect(statIdOf(plenilunio, KAREN_DATA, shoot)).toBe('combat');
  });

  it('«tu Astucia 4, menos 1 por herido»: la penalización se lee del catálogo, no restando totales', () => {
    const sano = diceOrigin(plenilunio, KAREN_DATA, 'cunning')!;
    expect(sano).toMatchObject({ statLabel: 'sheet.stats.cunning', penalty: 0, healthLabel: '' });
    expect(sano.statValue).toBe(3);
    const herido: SheetData = { ...KAREN_DATA, health: 'wounded' };
    expect(diceOrigin(plenilunio, herido, 'cunning')).toMatchObject({ penalty: 1, healthLabel: 'sheet.health.wounded' });
    // Con un bate (bonificación +1) restar totales habría dicho «menos −1 por herido»: por eso no se resta.
    expect(diceOf(previewRequest(plenilunio, herido, hit, {}), ['own'])).toBe(4); // Combate 4 − 1 herido + 1 bate
    expect(diceOrigin(plenilunio, herido, 'combat')!.penalty).toBe(1);
    expect(diceOrigin(plenilunio, KAREN_DATA, 'noExiste')).toBeNull();
  });

  it('la petición previa es la que se va a tirar: el alcance pone la dificultad y los extras suman', () => {
    const req = previewRequest(plenilunio, KAREN_DATA, shoot, { range: 'long', extraDice: 2 })!;
    expect(req.title).toBe('catalog.weapons.magnum44');
    expect(req.options).toMatchObject({ range: 'long', difficulty: 5 });
    expect(diceOf(req, ['own'])).toBe(4 + 2);           // Combate 4, sin bonificación a distancia (p.96)
    expect(diceOf(req, ['opposition'])).toBe(5);
    // Recargar no tira nada.
    expect(previewRequest(plenilunio, KAREN_DATA, reload, {})).toBeNull();
  });

  it('las fichas de la reserva llegan hasta el tope por tirada, y sólo hasta los dados que hay', () => {
    expect(poolChoices(destiny, 10, 0).map(c => c.disabled)).toEqual([false, false, false, false, false, false]);
    // Con 1 en la mano y 1 en la mesa se puede llegar a 2, no a 3.
    expect(poolChoices(destiny, 1, 1).map(c => c.disabled)).toEqual([false, false, false, true, true, true]);
    expect(poolChoices(destiny, 0, 0).map(c => c.disabled)).toEqual([false, true, true, true, true, true]);
  });

  it('la cabecera cita «cómo se tira» (p.82) y, en un disparo, el alcance (p.96)', () => {
    expect(headRef(plenilunio, stat, [])).toBe('roll');
    expect(headRef(plenilunio, shoot, rangeChoices(plenilunio, 'medium'))).toBe('ranged');
    expect(plenilunio.references['roll']!.page).toBe(82);
    expect(plenilunio.references['ranged']!.page).toBe(96);
    // Cuerpo a cuerpo no tiene alcances que elegir: se queda con «cómo se tira».
    expect(headRef(plenilunio, hit, [])).toBe('roll');
  });
});
