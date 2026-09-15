import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '../../../../tests/helpers/render';
import { fakeChatPort } from '../../../../tests/helpers/fakes';
import type { ChatMessage } from '../domain/entities/Chat';
import { WhisperPill } from './WhisperPill';

const MSG: ChatMessage = {
  id: 'm1', conversationId: 'conv1', authorId: 'laura', authorName: 'Laura', authorAvatarUrl: null, kind: 'text',
  body: 'Escuchas un ruido detrás de ti.', characterId: null, characterName: null, systemId: null,
  rollKind: null, rollRequest: null, rollDice: null, rollResult: null, rollRefId: null, createdAt: '2026-09-16T21:04:00Z',
};

function mount(over: Partial<Parameters<typeof WhisperPill>[0]> = {}) {
  const chat = fakeChatPort({ messages: { conv1: [MSG] } });
  const props = {
    campaignId: 'c1', conversationId: 'conv1', title: 'Laura', myUserId: 'me', system: null,
    open: false, unread: 0, onToggle: vi.fn(), onClose: vi.fn(), onRead: vi.fn(), chat, ...over,
  };
  renderWithProviders(<WhisperPill {...props} />);
  return { ...props, chat };
}

describe('<WhisperPill> — la ventanita de conversación (tipo LinkedIn)', () => {
  it('minimizada enseña sólo la barrita: ni mensajes ni campo de escribir', () => {
    mount();
    expect(screen.getByRole('button', { name: 'Abrir la conversación con Laura' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Escuchas un ruido detrás de ti.')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Escribe a Laura…')).not.toBeInTheDocument();
  });

  it('desplegada trae la conversación entera (mensajes, escribir, tirar) y SIN la cabecera de la columna', async () => {
    mount({ open: true });
    expect(await screen.findByText('Escuchas un ruido detrás de ti.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Escribe a Laura…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tirar en privado' })).toBeInTheDocument();
    // la de la columna: sin ella habría dos cabeceras seguidas
    expect(screen.queryByRole('button', { name: 'Volver al directorio' })).not.toBeInTheDocument();
  });

  it('minimizada y con mensajes sin leer va en SANGRE y enseña el contador; desplegada no', () => {
    const { unmount } = renderWithProviders(<WhisperPill campaignId="c1" conversationId="conv1" title="Laura" myUserId="me"
      system={null} open={false} unread={3} onToggle={vi.fn()} onClose={vi.fn()} onRead={vi.fn()} chat={fakeChatPort()} />);
    const pastilla = screen.getByLabelText('Conversación con Laura');
    expect(pastilla.className).toContain('alert');
    expect(screen.getByText('3')).toBeInTheDocument();
    unmount();
    renderWithProviders(<WhisperPill campaignId="c1" conversationId="conv1" title="Laura" myUserId="me"
      system={null} open unread={3} onToggle={vi.fn()} onClose={vi.fn()} onRead={vi.fn()} chat={fakeChatPort({ messages: { conv1: [] } })} />);
    expect(screen.getByLabelText('Conversación con Laura').className).not.toContain('alert');
  });

  it('la barrita despliega y minimiza, y la X cierra — son dos gestos distintos', async () => {
    const u = userEvent.setup();
    const onToggle = vi.fn(); const onClose = vi.fn();
    renderWithProviders(<WhisperPill campaignId="c1" conversationId="conv1" title="Laura" myUserId="me"
      system={null} open unread={0} onToggle={onToggle} onClose={onClose} onRead={vi.fn()} chat={fakeChatPort({ messages: { conv1: [] } })} />);
    await u.click(screen.getByRole('button', { name: 'Minimizar la conversación con Laura' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Cerrar la conversación con Laura' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('desplegada marca leído y avisa por onRead', async () => {
    const onRead = vi.fn();
    const chat = fakeChatPort({ messages: { conv1: [] } });
    renderWithProviders(<WhisperPill campaignId="c1" conversationId="conv1" title="Laura" myUserId="me"
      system={null} open unread={0} onToggle={vi.fn()} onClose={vi.fn()} onRead={onRead} chat={chat} />);
    await screen.findByText('Todavía no hay mensajes.');
    await vi.waitFor(() => expect(onRead).toHaveBeenCalled());
    expect(chat.read).toEqual(['conv1']);
  });
});
