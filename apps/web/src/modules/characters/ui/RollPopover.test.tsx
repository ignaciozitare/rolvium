import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { plenilunio } from '@rolvium/system-plenilunio';
import type { ActionDef, SheetData } from '@rolvium/core';
import { renderWithProviders, screen, within } from '../../../../tests/helpers/render';
import { KAREN_DATA } from '../../../../tests/helpers/fakes';
import { sysT } from '../domain/useCases/systemText';
import type { RollIntent } from '../domain/useCases/rollIntent';
import { RollPopover, type SharedPoolHandle } from './RollPopover';

const ts = sysT(plenilunio, 'es');
const action = (id: string): ActionDef => plenilunio.engine.actions!.find(a => a.id === id)!;
const SHOOT: RollIntent = { kind: 'action', action: action('attack.ranged'), itemId: 'magnum44' };
const STAT: RollIntent = { kind: 'stat', statId: 'cunning' };
const destiny = plenilunio.engine.sharedResources![0]!;

const anchor = { left: 100, top: 200, bottom: 220, right: 180, width: 80, height: 20, x: 100, y: 200, toJSON: () => ({}) } as DOMRect;

function mount(over: Partial<Parameters<typeof RollPopover>[0]> = {}, data: SheetData = KAREN_DATA) {
  const onConfirm = vi.fn(async () => true);
  const onCancel = vi.fn();
  renderWithProviders(
    <RollPopover system={plenilunio} data={data} intent={STAT} anchor={anchor} ts={ts} onCancel={onCancel} onConfirm={onConfirm} {...over} />,
  );
  return { onConfirm, onCancel, pop: screen.getByRole('dialog') };
}

const pool = (over: Partial<SharedPoolHandle> = {}): SharedPoolHandle =>
  ({ def: destiny, left: 10, hand: 0, setHand: vi.fn(async () => true), ...over });

describe('<RollPopover> — `.pen` «Mesa/Tiradas · rediseño», columnas 1 y 2', () => {
  it('columna 1: cabecera con la página, contador con su origen, y tira con lo elegido', async () => {
    const u = userEvent.setup();
    const { pop, onConfirm } = mount();
    expect(within(pop).getByRole('heading', { name: 'Tirar · Astucia' })).toBeInTheDocument();
    expect(within(pop).getByText('Manual · p.82')).toBeInTheDocument();
    expect(within(pop).getByText('Dados que tiras')).toBeInTheDocument();
    expect(within(pop).getByText('tu Astucia 3')).toBeInTheDocument();
    // Astucia 3 y sana: parte de 3, y el botón promete lo mismo que el contador.
    expect(within(pop).getByRole('status')).toHaveTextContent('3');
    expect(within(pop).getByRole('button', { name: 'Tirar 3' })).toBeInTheDocument();
    expect(within(pop).getByText('+ dados extra: 0')).toBeInTheDocument();
    await u.click(within(pop).getByRole('button', { name: 'Un dado más' }));
    expect(within(pop).getByText('+ dados extra: 1')).toBeInTheDocument();
    await u.click(within(pop).getByRole('button', { name: 'Tirar 4' }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ extraDice: 1 }));
  });

  /**
   * Regresión, prueba del dueño 2026-08-21: el «+» no tenía TECHO y llegó a **30 dados con Combate 4**
   * («+ dados extra: 26»). El manual no da un máximo global, así que el techo sale de los casos que sí
   * escribe (RULES.md §2.8): «uno o dos» dados por herramientas y no acumulables (p.87).
   * La pantalla sólo apaga el botón y dice de dónde sale el tope; quien recorta es `poolFor`.
   */
  it('regresión · el «+» se apaga a los 2 dados extra, y dice por qué (p.87)', async () => {
    const u = userEvent.setup();
    const { pop } = mount({ intent: SHOOT });
    const more = within(pop).getByRole('button', { name: 'Un dado más' });
    const less = within(pop).getByRole('button', { name: 'Un dado menos' });
    await u.click(more);
    expect(more).toBeEnabled();
    await u.click(more);
    expect(within(pop).getByText('+ dados extra: 2')).toBeInTheDocument();
    expect(more).toBeDisabled();
    expect(within(pop).getByText(/Tope: 2 dados por herramientas/)).toBeInTheDocument();
    // Se capa la SUBIDA y nunca la bajada: el «−» sigue vivo y al bajar el «+» revive.
    expect(less).toBeEnabled();
    await u.click(less);
    expect(more).toBeEnabled();
  });

  /**
   * La atención médica es el único caso del libro que pasa de dos: el grado de éxito del médico se convierte
   * en dados extra en la próxima tirada de recuperación (p.101), y el grado llega a 4 (p.85). La tirada de
   * recuperación es de Fortaleza, así que Fortaleza admite 4.
   */
  it('en Fortaleza el techo sube a 4 por la atención médica (p.101)', async () => {
    const u = userEvent.setup();
    const { pop } = mount({ intent: { kind: 'stat', statId: 'fortitude' } as RollIntent });
    const more = within(pop).getByRole('button', { name: 'Un dado más' });
    for (let i = 0; i < 4; i++) await u.click(more);
    expect(within(pop).getByText('+ dados extra: 4')).toBeInTheDocument();
    expect(more).toBeDisabled();
    expect(within(pop).getByText(/Tope: 4 dados/)).toBeInTheDocument();
  });

  it('«tu Combate 4, menos 1 por herido»: la ficha ya descuenta las heridas (p.99)', () => {
    const { pop } = mount({ intent: SHOOT }, { ...KAREN_DATA, health: 'wounded' });
    expect(within(pop).getByText('tu Combate 4, menos 1 por herido')).toBeInTheDocument();
    expect(within(pop).getByRole('status')).toHaveTextContent('3');
  });

  it('columna 2: alcance del arma preseleccionado, los que no alcanza apagados, y la dificultad viaja (p.96)', async () => {
    const u = userEvent.setup();
    const { pop, onConfirm } = mount({ intent: SHOOT });
    expect(within(pop).getByRole('heading', { name: 'Disparar · Revólver magnum .44' })).toBeInTheDocument();
    expect(within(pop).getByText('Manual · p.96')).toBeInTheDocument();
    expect(within(pop).getByText('lo mide el mapa · p.96')).toBeInTheDocument();
    expect(within(pop).getByRole('button', { name: 'Medio · 3' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(pop).getByRole('button', { name: 'Corto · 2' })).not.toBeDisabled();
    expect(within(pop).getByRole('button', { name: 'Largo · 5' })).toBeDisabled();
    expect(within(pop).getByRole('button', { name: 'Muy largo · 6' })).toBeDisabled();
    await u.click(within(pop).getByRole('button', { name: 'Corto · 2' }));
    await u.click(within(pop).getByRole('button', { name: 'Disparar · 4 dados' }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ range: 'short' }));
  });

  it('una característica no enseña alcance, y una tirada sin mesa no enseña la reserva', () => {
    const { pop } = mount();
    expect(within(pop).queryByText('Alcance')).not.toBeInTheDocument();
    expect(within(pop).queryByText(/Reserva de Destino/)).not.toBeInTheDocument();
  });

  it('la reserva: fichas 0…5, lo que queda en la mesa, y coge los dados ANTES de tirar', async () => {
    const u = userEvent.setup();
    const setHand = vi.fn(async () => true);
    const { pop, onConfirm } = mount({ pool: pool({ left: 10, hand: 0, setHand }) });
    expect(within(pop).getByText('Dados de la Reserva de Destino')).toBeInTheDocument();
    expect(within(pop).getByText('p.88')).toBeInTheDocument();
    expect(within(pop).getByText('quedan 10 en la mesa')).toBeInTheDocument();
    const chips = within(pop).getByRole('group', { name: 'Dados de la Reserva de Destino' });
    expect(within(chips).getAllByRole('button').map(b => b.textContent)).toEqual(['0', '1', '2', '3', '4', '5']);
    await u.click(within(chips).getByRole('button', { name: '2' }));
    // Con 2 de la reserva el botón promete 5: 3 propios + 2 de la mesa.
    await u.click(within(pop).getByRole('button', { name: 'Tirar 5' }));
    expect(setHand).toHaveBeenCalledWith(2);
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ destinyDice: 2 }));
  });

  it('no se pueden pedir más dados de los que hay entre la mano y la mesa', () => {
    const { pop } = mount({ pool: pool({ left: 1, hand: 1 }) });
    const chips = within(pop).getByRole('group', { name: 'Dados de la Reserva de Destino' });
    expect(within(chips).getByRole('button', { name: '2' })).not.toBeDisabled();
    expect(within(chips).getByRole('button', { name: '3' })).toBeDisabled();
    // Los que ya tienes en la mano salen elegidos: es lo que se va a tirar si no tocas nada.
    expect(within(chips).getByRole('button', { name: '1' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('con Destino 10 la reserva no se ofrece: se dice por qué (p.88)', () => {
    const { pop } = mount({ pool: pool() }, { ...KAREN_DATA, destiny: 10 });
    expect(within(pop).getByText('Con Destino 10 ya no se pueden coger dados de la reserva.')).toBeInTheDocument();
    expect(within(pop).queryByRole('group', { name: 'Dados de la Reserva de Destino' })).not.toBeInTheDocument();
  });

  it('si no se pueden coger los dados, no se tira y se dice', async () => {
    const u = userEvent.setup();
    const { pop, onConfirm } = mount({ pool: pool({ setHand: vi.fn(async () => false) }) });
    await u.click(within(within(pop).getByRole('group', { name: 'Dados de la Reserva de Destino' })).getByRole('button', { name: '3' }));
    await u.click(within(pop).getByRole('button', { name: 'Tirar 6' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(await within(pop).findByRole('alert')).toHaveTextContent('No se han podido coger esos dados de la reserva.');
  });

  it('si la tirada falla se queda abierto y lo dice, en vez de cerrarse en falso', async () => {
    const u = userEvent.setup();
    const { pop } = mount({ onConfirm: vi.fn(async () => false) });
    await u.click(within(pop).getByRole('button', { name: 'Tirar 3' }));
    expect(await within(pop).findByRole('alert')).toHaveTextContent('No se ha podido tirar. Inténtalo de nuevo.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('se cierra con Escape y pulsando fuera, sin velo que tape la mesa', async () => {
    const u = userEvent.setup();
    const { onCancel } = mount();
    await u.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
    await u.click(document.querySelector('.ch-pop-catch') as HTMLElement);
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
