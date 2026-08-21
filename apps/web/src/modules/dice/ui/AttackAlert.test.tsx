import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '../../../../tests/helpers/render';
import type { PendingAttack } from '../domain/entities/Attack';
import { AttackAlert } from './AttackAlert';

const attack: PendingAttack = {
  id: 'atk-1', campaignId: 'c1', attackerName: 'Ogro', targetCharacterId: 'ch1',
  dice: 4, stat: 'combat', createdAt: '2026-08-21T00:00:00Z',
};

const setup = (over: { defenceMax?: number | null; statLabel?: string | null; ok?: boolean } = {}) => {
  const onAnswer = vi.fn().mockResolvedValue(over.ok ?? true);
  renderWithProviders(
    <AttackAlert attack={attack} defenceMax={over.defenceMax === undefined ? 4 : over.defenceMax}
                 statLabel={over.statLabel === undefined ? 'Combate' : over.statLabel} onAnswer={onAnswer} />,
  );
  return { onAnswer };
};

beforeEach(() => vi.clearAllMocks());

describe('AttackAlert — «te ataca un ogro» (`.pen` columna 5)', () => {
  it('dice quién ataca, con cuántos dados y que es un conflicto (p.93)', () => {
    setup();
    expect(screen.getByRole('alertdialog', { name: 'Te atacan' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Te ataca Ogro' })).toBeInTheDocument();
    expect(screen.getByText(/Cuerpo a cuerpo con 4 dados de Combate\. Es un conflicto/)).toBeInTheDocument();
  });

  it('ofrece de 0 a su Combate, y dice cuántos tiene', () => {
    setup();
    for (const n of ['0', '1', '2', '3', '4']) expect(screen.getByRole('button', { name: n })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '5' })).not.toBeInTheDocument();
    expect(screen.getByText('tienes Combate: 4 dados')).toBeInTheDocument();
  });

  /** El coste (p.94) es TEXTO: no hay orden de turnos y no se finge con un contador. Pero cambia con lo elegido. */
  it('el coste cambia con lo que elige, antes de pulsar nada', async () => {
    setup();
    expect(screen.getByText(/con 0 te quedarán 4 para actuar/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    expect(await screen.findByText(/con 2 te quedarán 2 para actuar/)).toBeInTheDocument();
    expect(screen.getByText(/Si gastas los 4, pierdes el turno/)).toBeInTheDocument();
  });

  it('«defenderme» manda los dados elegidos y se apaga mientras contesta', async () => {
    const { onAnswer } = setup();
    await userEvent.click(screen.getByRole('button', { name: '3' }));
    const go = await screen.findByRole('button', { name: 'Defenderme · 3 dados' });
    await userEvent.click(go);
    expect(onAnswer).toHaveBeenCalledWith(3);
    await waitFor(() => expect(go).toBeDisabled());
  });

  it('un solo dado se dice en singular', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    expect(await screen.findByRole('button', { name: 'Defenderme · 1 dado' })).toBeInTheDocument();
  });

  /** 0 es una RESPUESTA, no el silencio: la tirada sale sin nada enfrente. */
  it('«no me defiendo» contesta con 0', async () => {
    const { onAnswer } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'No me defiendo' }));
    expect(onAnswer).toHaveBeenCalledWith(0);
  });

  it('sin haber elegido dados, «defenderme» está apagado: la salida es no defenderse', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Defenderme · 0 dados' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'No me defiendo' })).toBeEnabled();
  });

  it('si no se pudo contestar lo dice y deja volver a intentarlo', async () => {
    const { onAnswer } = setup({ ok: false });
    await userEvent.click(screen.getByRole('button', { name: 'No me defiendo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/No se ha podido contestar/);
    await waitFor(() => expect(screen.getByRole('button', { name: 'No me defiendo' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'No me defiendo' }));
    expect(onAnswer).toHaveBeenCalledTimes(2);
  });

  /**
   * Sin ficha no se sabe cuántos dados puede gastar. Se dice y se le deja no defenderse, en vez de
   * ofrecerle unas fichas inventadas o dejarle sin ninguna salida.
   */
  it('sin poder leer su ficha lo explica y sólo deja no defenderse', () => {
    setup({ defenceMax: null });
    expect(screen.getByText(/No se ha podido leer tu ficha/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '0' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Defenderme/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No me defiendo' })).toBeEnabled();
  });

  it('un ataque sin característica guardada calla su nombre en vez de inventárselo', () => {
    setup({ statLabel: null });
    expect(screen.getByText(/Cuerpo a cuerpo con 4 dados\. Es un conflicto/)).toBeInTheDocument();
    expect(screen.getByText('tienes 4 dados')).toBeInTheDocument();
  });

  /**
   * A propósito no hay X, ni Escape, ni pulsar fuera: si no contesta la tirada espera indefinidamente
   * (decisión del dueño), así que quitarse el aviso de en medio dejaría la partida parada sin que se note.
   */
  it('no se puede cerrar sin contestar: no hay X ni sale con Escape', async () => {
    const { onAnswer } = setup();
    expect(screen.queryByRole('button', { name: /cerrar/i })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onAnswer).not.toHaveBeenCalled();
  });
});
