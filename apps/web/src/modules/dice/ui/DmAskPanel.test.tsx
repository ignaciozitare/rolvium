import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor, fireEvent } from '../../../../tests/helpers/render';
import { plenilunio } from '@rolvium/system-plenilunio';
import { DmAskPanel, type AskTarget } from './DmAskPanel';

const TARGETS: AskTarget[] = [
  { characterId: 'ch-karen', name: 'Karen' },
  { characterId: 'ch-elias', name: 'Elías' },
];

const setup = (targets: AskTarget[] = TARGETS, ok = true) => {
  const onAsk = vi.fn().mockResolvedValue(ok);
  renderWithProviders(<DmAskPanel system={plenilunio} targets={targets} onAsk={onAsk} />);
  return { onAsk };
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => { vi.restoreAllMocks(); delete (document as { elementFromPoint?: unknown }).elementFromPoint; });

describe('DmAskPanel — «¿A quién le pides la tirada?» (.pen columna 4)', () => {
  it('mantener pulsada la característica abre su dificultad pegada, y elegirla manda la petición SIN confirmar', async () => {
    const u = userEvent.setup();
    const { onAsk } = setup();
    await u.click(screen.getByRole('button', { name: 'Karen' }));
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Fortaleza' }));
    await u.click(await screen.findByRole('menuitem', { name: 'Media · 2' }));
    await waitFor(() => expect(onAsk).toHaveBeenCalledWith({
      targetCharacterIds: ['ch-karen'], stat: 'fortitude', difficulty: 2, specialtyAllowed: false,
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('Pedida a 1 · Fortaleza.');
  });

  it('soltar ENCIMA de la dificultad también dispara (el gesto del diseño: sin botón de confirmar)', async () => {
    const u = userEvent.setup();
    const { onAsk } = setup();
    await u.click(screen.getByRole('button', { name: 'Elías' }));
    const stat = screen.getByRole('button', { name: 'Combate' });
    fireEvent.pointerDown(stat);
    const option = await screen.findByRole('menuitem', { name: 'Difícil · 3' });
    // jsdom no implementa elementFromPoint: se define aquí como lo que hay bajo el dedo al soltar
    (document as { elementFromPoint?: unknown }).elementFromPoint = vi.fn().mockReturnValue(option);
    fireEvent.pointerUp(stat, { clientX: 10, clientY: 10 });
    await waitFor(() => expect(onAsk).toHaveBeenCalledWith({
      targetCharacterIds: ['ch-elias'], stat: 'combat', difficulty: 3, specialtyAllowed: false,
    }));
  });

  it('«A todos» marca a todos, y la casilla de la especialidad viaja con la petición (p.83)', async () => {
    const u = userEvent.setup();
    const { onAsk } = setup();
    await u.click(screen.getByRole('button', { name: 'A todos' }));
    await u.click(screen.getByRole('checkbox'));
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Astucia' }));
    await u.click(await screen.findByRole('menuitem', { name: 'Épica · 6' }));
    await waitFor(() => expect(onAsk).toHaveBeenCalledWith({
      targetCharacterIds: ['ch-karen', 'ch-elias'], stat: 'cunning', difficulty: 6, specialtyAllowed: true,
    }));
  });

  it('sin nadie marcado no se pide: lo dice y se queda', async () => {
    const u = userEvent.setup();
    const { onAsk } = setup();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Voluntad' }));
    await u.click(await screen.findByRole('menuitem', { name: 'Fácil · 1' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Marca antes a quién');
    expect(onAsk).not.toHaveBeenCalled();
  });

  it('si la API no puede, lo dice y el panel sigue usable', async () => {
    const u = userEvent.setup();
    const { onAsk } = setup(TARGETS, false);
    await u.click(screen.getByRole('button', { name: 'Karen' }));
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Presencia' }));
    await u.click(await screen.findByRole('menuitem', { name: 'Media · 2' }));
    await waitFor(() => expect(onAsk).toHaveBeenCalled());
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo pedir');
    expect(screen.getByRole('button', { name: 'Karen' })).toBeEnabled();
  });
});
