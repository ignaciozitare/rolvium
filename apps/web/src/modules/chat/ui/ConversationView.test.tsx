import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { plenilunio } from '@rolvium/system-plenilunio';
import { renderWithProviders, screen } from '../../../../tests/helpers/render';
import { fakeChatPort } from '../../../../tests/helpers/fakes';
import type { ChatMessage } from '../domain/entities/Chat';
import { ConversationView } from './ConversationView';

const TEXT_MSG: ChatMessage = {
  id: 'm1', conversationId: 'conv1', authorId: 'laura', authorName: 'Laura', authorAvatarUrl: null, kind: 'text',
  body: 'Escuchas un ruido detrás de ti. Nadie más lo ha oído.', characterId: null, characterName: null, systemId: null,
  rollKind: null, rollRequest: null, rollDice: null, rollResult: null, rollRefId: null, createdAt: '2026-09-15T21:04:00Z',
};
const ROLL_MSG: ChatMessage = {
  id: 'm2', conversationId: 'conv1', authorId: 'karen', authorName: 'Karen', authorAvatarUrl: null, kind: 'roll',
  body: 'Astucia', characterId: null, characterName: 'Karen Sinclair', systemId: 'plenilunio',
  rollKind: 'system', rollRequest: { systemId: 'plenilunio', kind: 'system', title: 'Astucia', groups: [{ count: 2, sides: 6, tag: 'own' }], visibility: 'table' },
  rollDice: [[4, 1]], rollResult: { summary: 'roll.degree.setback', total: 5 }, rollRefId: null, createdAt: '2026-09-15T21:05:00Z',
};

describe('<ConversationView>', () => {
  it('carga los mensajes, marca leído al abrir, y una tirada se pinta como entrada del Registro', async () => {
    const chat = fakeChatPort({ messages: { conv1: [TEXT_MSG, ROLL_MSG] } });
    renderWithProviders(<ConversationView campaignId="c1" conversationId="conv1" title="Laura" myUserId="me" system={plenilunio} onBack={() => {}} chat={chat} />);
    expect(await screen.findByText('Escuchas un ruido detrás de ti. Nadie más lo ha oído.')).toBeInTheDocument();
    expect(chat.read).toEqual(['conv1']);
    // la tirada reutiliza RollEntry del Registro: el nombre del personaje sale como «quién», no el de la cuenta
    expect(screen.getByText('Karen Sinclair')).toBeInTheDocument();
  });

  it('el aviso de que lo tirado aquí no sale en el Registro está siempre visible', async () => {
    const chat = fakeChatPort({ messages: { conv1: [] } });
    renderWithProviders(<ConversationView campaignId="c1" conversationId="conv1" title="Laura" myUserId="me" system={plenilunio} onBack={() => {}} chat={chat} />);
    expect(await screen.findByText('Todavía no hay mensajes.')).toBeInTheDocument();
    expect(screen.getByText('Lo que se tira aquí no sale en el Registro: no queda rastro para nadie.')).toBeInTheDocument();
  });

  it('escribir y enviar manda el texto como autor propio y limpia el campo', async () => {
    const u = userEvent.setup();
    const chat = fakeChatPort({ messages: { conv1: [] }, users: { me: { name: 'Pip', avatarUrl: null } } });
    renderWithProviders(<ConversationView campaignId="c1" conversationId="conv1" title="Laura" myUserId="me" system={null} onBack={() => {}} chat={chat} />);
    await screen.findByText('Todavía no hay mensajes.');
    const input = screen.getByPlaceholderText('Escribe a Laura…');
    await u.type(input, 'Voy primero, cúbreme.');
    await u.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(chat.sent).toEqual([{ conversationId: 'conv1', authorId: 'me', body: 'Voy primero, cúbreme.' }]);
    expect(await screen.findByText('Voy primero, cúbreme.')).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('un mensaje que llega por tiempo real de OTRO se añade y vuelve a marcar leído', async () => {
    const chat = fakeChatPort({ messages: { conv1: [] } });
    renderWithProviders(<ConversationView campaignId="c1" conversationId="conv1" title="Laura" myUserId="me" system={null} onBack={() => {}} chat={chat} />);
    await screen.findByText('Todavía no hay mensajes.');
    chat.read.length = 0;
    chat.push({ ...TEXT_MSG, id: 'm3', body: 'Nuevo susurro' });
    expect(await screen.findByText('Nuevo susurro')).toBeInTheDocument();
    expect(chat.read).toContain('conv1');
  });

  it('el popover de tirar en privado se ancla DENTRO de la entrada: como hermano de fuera quedaba lejos, fuera del viewport', async () => {
    const u = userEvent.setup();
    const chat = fakeChatPort({ messages: { conv1: [] } });
    renderWithProviders(<ConversationView campaignId="c1" conversationId="conv1" title="Laura" myUserId="me" system={null} onBack={() => {}} chat={chat} />);
    await screen.findByText('Todavía no hay mensajes.');
    await u.click(screen.getByRole('button', { name: 'Tirar en privado' }));
    const pop = screen.getByRole('dialog', { name: 'Tirar en privado' });
    const composer = pop.closest('.ch-composer');
    expect(composer).not.toBeNull();
    expect(composer).toContainElement(screen.getByRole('button', { name: 'Enviar' }));
  });

  it('onRead avisa cada vez que se marca leído (al abrir y con cada mensaje ajeno); escribir uno mismo no marca nada', async () => {
    const u = userEvent.setup();
    const onRead = vi.fn();
    const chat = fakeChatPort({ messages: { conv1: [] }, users: { me: { name: 'Pip', avatarUrl: null } } });
    renderWithProviders(<ConversationView campaignId="c1" conversationId="conv1" title="Laura" myUserId="me" system={null} onBack={() => {}} onRead={onRead} chat={chat} />);
    await screen.findByText('Todavía no hay mensajes.');
    await vi.waitFor(() => expect(onRead).toHaveBeenCalledTimes(1));
    chat.push({ ...TEXT_MSG, id: 'm3', body: 'Nuevo susurro' });
    await screen.findByText('Nuevo susurro');
    await vi.waitFor(() => expect(onRead).toHaveBeenCalledTimes(2));
    await u.type(screen.getByPlaceholderText('Escribe a Laura…'), 'Vale');
    await u.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByText('Vale');
    expect(chat.read).toEqual(['conv1', 'conv1']);
    expect(onRead).toHaveBeenCalledTimes(2);
  });

  it('volver llama a onBack', async () => {
    const u = userEvent.setup();
    const chat = fakeChatPort({ messages: { conv1: [] } });
    const onBack = vi.fn();
    renderWithProviders(<ConversationView campaignId="c1" conversationId="conv1" title="Laura" myUserId="me" system={null} onBack={onBack} chat={chat} />);
    await screen.findByText('Todavía no hay mensajes.');
    await u.click(screen.getByRole('button', { name: 'Volver al directorio' }));
    expect(onBack).toHaveBeenCalled();
  });
});
