import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '../../../../tests/helpers/render';
import { fakeChatPort } from '../../../../tests/helpers/fakes';
import type { ChatDirectoryEntry } from '../domain/entities/Chat';
import { SusurrosPanel } from './SusurrosPanel';

const LAURA: ChatDirectoryEntry = { key: 'laura', conversationId: 'conv-laura', isGroup: false, title: 'Laura', role: 'dm', memberCount: null, memberIds: ['laura'], lastKind: 'text', lastBody: 'Voy primero', unreadCount: 0 };
const KAREN: ChatDirectoryEntry = { key: 'karen', conversationId: null, isGroup: false, title: 'Karen', role: 'player', memberCount: null, memberIds: ['karen'], lastKind: null, lastBody: null, unreadCount: 0 };

describe('<SusurrosPanel>', () => {
  it('abre el directorio, entra a una conversación existente y vuelve', async () => {
    const u = userEvent.setup();
    const chat = fakeChatPort({ directory: [LAURA], messages: { 'conv-laura': [] } });
    renderWithProviders(<SusurrosPanel campaignId="c1" myUserId="me" system={null} chat={chat} />);
    await u.click(await screen.findByText('Laura'));
    expect(await screen.findByText('Todavía no hay mensajes.')).toBeInTheDocument();
    expect(chat.opened).toEqual([]); // ya tenía conversación: no crea una nueva
    await u.click(screen.getByRole('button', { name: 'Volver al directorio' }));
    expect(await screen.findByText('Laura')).toBeInTheDocument();
  });

  it('pinchar a alguien sin conversación previa la crea (chat_create_conversation) antes de abrirla', async () => {
    const u = userEvent.setup();
    const chat = fakeChatPort({ directory: [KAREN], messages: {} });
    renderWithProviders(<SusurrosPanel campaignId="c1" myUserId="me" system={null} chat={chat} />);
    await u.click(await screen.findByText('Karen'));
    expect(chat.opened).toEqual([{ campaignId: 'c1', memberIds: ['karen'] }]);
    expect(await screen.findByText('Todavía no hay mensajes.')).toBeInTheDocument();
  });

  it('crear un grupo abre esa conversación directo, sin pasar por el directorio', async () => {
    const u = userEvent.setup();
    const chat = fakeChatPort({ directory: [LAURA, KAREN], messages: {} });
    renderWithProviders(<SusurrosPanel campaignId="c1" myUserId="me" system={null} chat={chat} />);
    await screen.findByText('Laura');
    await u.click(screen.getByRole('button', { name: '+ Grupo' }));
    await u.click(screen.getByText('Karen'));
    await u.click(screen.getByRole('button', { name: 'Crear grupo (1)' }));
    expect(chat.opened).toEqual([{ campaignId: 'c1', memberIds: ['karen'] }]);
    expect(await screen.findByText('Todavía no hay mensajes.')).toBeInTheDocument();
  });

  it('una conversación pendiente (de la pastilla) se abre directo, y se avisa que ya se consumió', async () => {
    const chat = fakeChatPort({ directory: [], messages: { 'conv-1': [] } });
    let consumed = false;
    renderWithProviders(<SusurrosPanel campaignId="c1" myUserId="me" system={null} chat={chat} pendingOpen={{ id: 'conv-1', title: 'Laura' }} onPendingOpenConsumed={() => { consumed = true; }} />);
    expect(await screen.findByText('Todavía no hay mensajes.')).toBeInTheDocument();
    expect(consumed).toBe(true);
  });

  it('abrir una conversación sube onRead (la campanita de la pestaña se recuenta con eso)', async () => {
    const u = userEvent.setup();
    const onRead = vi.fn();
    const chat = fakeChatPort({ directory: [LAURA], messages: { 'conv-laura': [] } });
    renderWithProviders(<SusurrosPanel campaignId="c1" myUserId="me" system={null} chat={chat} onRead={onRead} />);
    await u.click(await screen.findByText('Laura'));
    await screen.findByText('Todavía no hay mensajes.');
    await vi.waitFor(() => expect(onRead).toHaveBeenCalledTimes(1));
    expect(chat.read).toEqual(['conv-laura']);
  });
});
