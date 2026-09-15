import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '../../../../tests/helpers/render';
import { fakeChatRollsPort } from '../../../../tests/helpers/fakes';
import { ChatRollPopover } from './ChatRollPopover';

describe('<ChatRollPopover>', () => {
  it('tira los dados libres pedidos y cierra al conseguirlo', async () => {
    const u = userEvent.setup();
    const rolls = fakeChatRollsPort({ id: 'msg-1' });
    const onClose = vi.fn();
    renderWithProviders(<ChatRollPopover conversationId="conv1" onClose={onClose} rolls={rolls} />);
    await u.click(screen.getByRole('button', { name: 'Tirar 2 D6' }));
    expect(rolls.requests).toHaveLength(1);
    expect(rolls.requests[0]).toMatchObject({ conversationId: 'conv1', systemId: null, kind: 'free', groups: [{ count: 2, sides: 6 }] });
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('sin conseguirlo enseña el error y no cierra', async () => {
    const u = userEvent.setup();
    const rolls = fakeChatRollsPort(null);
    const onClose = vi.fn();
    renderWithProviders(<ChatRollPopover conversationId="conv1" onClose={onClose} rolls={rolls} />);
    await u.click(screen.getByRole('button', { name: 'Tirar 1 D20' }));
    expect(await screen.findByText('No se pudo tirar.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('cerrar con la X llama a onClose sin tirar', async () => {
    const u = userEvent.setup();
    const rolls = fakeChatRollsPort();
    const onClose = vi.fn();
    renderWithProviders(<ChatRollPopover conversationId="conv1" onClose={onClose} rolls={rolls} />);
    await u.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(rolls.requests).toHaveLength(0);
    expect(onClose).toHaveBeenCalled();
  });
});
