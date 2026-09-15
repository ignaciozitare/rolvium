import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '../../../../tests/helpers/render';
import { fakeChatPort } from '../../../../tests/helpers/fakes';
import type { ChatMessage } from '../domain/entities/Chat';
import { WhisperWatcher } from './WhisperWatcher';

const FROM_LAURA: ChatMessage = {
  id: 'm1', conversationId: 'conv1', authorId: 'laura', authorName: 'Laura', authorAvatarUrl: null, kind: 'text',
  body: 'Escuchas un ruido detrás de ti. Nadie más lo…', characterId: null, characterName: null, systemId: null,
  rollKind: null, rollRequest: null, rollDice: null, rollResult: null, rollRefId: null, createdAt: '2026-09-15T21:04:00Z',
};

describe('<WhisperWatcher>', () => {
  it('no pinta nada hasta que llega un susurro de OTRO', async () => {
    const chat = fakeChatPort();
    renderWithProviders(<WhisperWatcher campaignId="c1" myUserId="me" chat={chat} onOpen={vi.fn()} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    chat.push(FROM_LAURA);
    expect(await screen.findByText('Laura te susurra')).toBeInTheDocument();
    expect(screen.getByText('Escuchas un ruido detrás de ti. Nadie más lo…')).toBeInTheDocument();
  });

  it('un mensaje propio no saca la pastilla', async () => {
    const chat = fakeChatPort();
    renderWithProviders(<WhisperWatcher campaignId="c1" myUserId="me" chat={chat} onOpen={vi.fn()} />);
    chat.push({ ...FROM_LAURA, authorId: 'me', authorName: 'Pip' });
    await new Promise(r => setTimeout(r, 0));
    expect(screen.queryByText('Pip te susurra')).not.toBeInTheDocument();
  });

  it('pincharla la cierra y avisa con la conversación y el nombre de quien susurró', async () => {
    const u = userEvent.setup();
    const chat = fakeChatPort();
    const onOpen = vi.fn();
    renderWithProviders(<WhisperWatcher campaignId="c1" myUserId="me" chat={chat} onOpen={onOpen} />);
    chat.push(FROM_LAURA);
    await u.click(await screen.findByText('Laura te susurra'));
    expect(onOpen).toHaveBeenCalledWith('conv1', 'Laura');
    expect(screen.queryByText('Laura te susurra')).not.toBeInTheDocument();
  });

  it('cerrarla con la X la quita sin avisar', async () => {
    const u = userEvent.setup();
    const chat = fakeChatPort();
    const onOpen = vi.fn();
    renderWithProviders(<WhisperWatcher campaignId="c1" myUserId="me" chat={chat} onOpen={onOpen} />);
    chat.push(FROM_LAURA);
    await u.click(await screen.findByLabelText('Cerrar el aviso'));
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.queryByText('Laura te susurra')).not.toBeInTheDocument();
  });

  it('avisa el total de no leídos al montar y en cada mensaje nuevo', async () => {
    const chat = fakeChatPort({ directory: [{ key: 'laura', conversationId: 'conv1', isGroup: false, title: 'Laura', role: 'dm', memberCount: null, memberIds: ['laura'], lastKind: 'text', lastBody: 'hola', unreadCount: 2 }] });
    const onUnreadChange = vi.fn();
    renderWithProviders(<WhisperWatcher campaignId="c1" myUserId="me" chat={chat} onOpen={vi.fn()} onUnreadChange={onUnreadChange} />);
    await vi.waitFor(() => expect(onUnreadChange).toHaveBeenCalledWith(2));
    chat.directory[0]!.unreadCount = 3;
    chat.push(FROM_LAURA);
    await vi.waitFor(() => expect(onUnreadChange).toHaveBeenLastCalledWith(3));
  });

  it('recuenta los no leídos cuando cambia refreshKey (el usuario acaba de marcar leída una conversación)', async () => {
    const chat = fakeChatPort({ directory: [{ key: 'laura', conversationId: 'conv1', isGroup: false, title: 'Laura', role: 'dm', memberCount: null, memberIds: ['laura'], lastKind: 'text', lastBody: 'hola', unreadCount: 2 }] });
    const onUnreadChange = vi.fn();
    const { rerender } = renderWithProviders(<WhisperWatcher campaignId="c1" myUserId="me" chat={chat} onOpen={vi.fn()} onUnreadChange={onUnreadChange} refreshKey={0} />);
    await vi.waitFor(() => expect(onUnreadChange).toHaveBeenCalledWith(2));
    chat.directory[0]!.unreadCount = 0;
    rerender(<WhisperWatcher campaignId="c1" myUserId="me" chat={chat} onOpen={vi.fn()} onUnreadChange={onUnreadChange} refreshKey={1} />);
    await vi.waitFor(() => expect(onUnreadChange).toHaveBeenLastCalledWith(0));
    expect(chat.subscribers).toBe(1);   // recontar no resuscribe el tiempo real
  });
});
