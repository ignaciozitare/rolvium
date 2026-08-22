import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, fireEvent } from '../../../../tests/helpers/render';
import { plenilunio } from '@rolvium/system-plenilunio';
import userEvent from '@testing-library/user-event';
import { fakeRollsPort } from '../../../../tests/helpers/fakes';
import { DiceRoller } from './DiceRoller';

// jsdom has no PointerEvent: a MouseEvent with pointerId is enough for the drag handlers.
class FakePointerEvent extends MouseEvent { pointerId: number; constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) { super(type, init); this.pointerId = init.pointerId ?? 0; } }
(globalThis as unknown as { PointerEvent: unknown }).PointerEvent = FakePointerEvent;

describe('<DiceRoller>', () => {
  it('tap on a quantity rolls that many dice of that kind with the chosen visibility and modifier; shows the last roll', async () => {
    const u = userEvent.setup();
    const rolls = fakeRollsPort({ summary: 'roll.free', total: 13 });
    renderWithProviders(<DiceRoller campaignId="c1" rolls={rolls} onClose={() => {}} initial={{ x: 10, y: 10 }} />);
    expect(screen.getByRole('dialog', { name: 'Lanzador de dados' })).toHaveAttribute('aria-modal', 'false');
    await u.click(screen.getByRole('button', { name: 'Tirar 3 D6' }));
    await waitFor(() => expect(rolls.requests).toHaveLength(1));
    expect(rolls.requests[0]).toMatchObject({ campaignId: 'c1', systemId: null, kind: 'free', groups: [{ count: 3, sides: 6 }], visibility: 'table' });
    expect(rolls.requests[0]!.modifier).toBeUndefined();
    expect(await screen.findByText('última: 3D6 = 13')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tirar 3 D6' })).toHaveClass('on');
    // visibility tab + modifier
    await u.click(screen.getByRole('button', { name: 'Secreta' }));
    await u.click(screen.getByRole('button', { name: 'Subir el modificador' }));
    await u.click(screen.getByRole('button', { name: 'Subir el modificador' }));
    await u.click(screen.getByRole('button', { name: 'Bajar el modificador' }));
    expect(screen.getByRole('status')).toHaveTextContent('+1');
    await u.click(screen.getByRole('button', { name: 'Tirar 2 D10' }));
    await waitFor(() => expect(rolls.requests).toHaveLength(2));
    expect(rolls.requests[1]).toMatchObject({ groups: [{ count: 2, sides: 10 }], visibility: 'secret', modifier: 1, title: '2D10+1' });
    // Fudge carries its tag
    await u.click(screen.getByRole('button', { name: 'Tirar 4 FUDGE' }));
    await waitFor(() => expect(rolls.requests).toHaveLength(3));
    expect(rolls.requests[2]!.groups[0]).toEqual({ count: 4, sides: 3, tag: 'fudge' });
  });
  it('reports a failed roll, closes with the × button and with Escape, and drags by its header', async () => {
    const u = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<DiceRoller campaignId="c1" rolls={fakeRollsPort(null)} onClose={onClose} initial={{ x: 10, y: 20 }} />);
    await u.click(screen.getByRole('button', { name: 'Tirar 1 D20' }));
    expect(await screen.findByText('No se ha podido tirar.')).toHaveClass('err');
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveStyle({ left: '10px', top: '20px' });
    const handle = screen.getByTestId('dice-roller-handle');
    fireEvent.pointerDown(handle, { clientX: 50, clientY: 30, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 150, clientY: 90, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(dialog).toHaveStyle({ left: '110px', top: '80px' });
    await u.click(screen.getByRole('button', { name: 'Cerrar el lanzador' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await u.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('DiceRoller — el modo director (.pen columna 4: el mismo lanzador, expandido)', () => {
  it('con `ask` lleva el título de director y el panel de pedir encima del lanzador de siempre', () => {
    renderWithProviders(
      <DiceRoller campaignId="c1" onClose={vi.fn()} rolls={{ roll: vi.fn() } as never}
                  ask={{ system: plenilunio, targets: [{ characterId: 'ch1', name: 'Karen' }], onAsk: vi.fn().mockResolvedValue(true) }} />,
    );
    expect(screen.getByRole('dialog', { name: 'Lanzador de dados' })).toHaveTextContent('Lanzador · director');
    expect(screen.getByText('¿A quién le pides la tirada?')).toBeInTheDocument();
    // y el lanzador libre sigue debajo: sus tiradas para sí van por donde siempre
    expect(screen.getByRole('group', { name: 'Visibilidad de la tirada' })).toBeInTheDocument();
  });
  it('sin `ask` es el lanzador de siempre, sin panel', () => {
    renderWithProviders(<DiceRoller campaignId="c1" onClose={vi.fn()} rolls={{ roll: vi.fn() } as never} />);
    expect(screen.queryByText('¿A quién le pides la tirada?')).not.toBeInTheDocument();
  });
});
