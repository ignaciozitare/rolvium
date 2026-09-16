import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '../../../../tests/helpers/render';
import { fakeChatPort, fakeSound } from '../../../../tests/helpers/fakes';
import type { ChatMessage } from '../domain/entities/Chat';
import { WhisperWatcher } from './WhisperWatcher';

const FROM_LAURA: ChatMessage = {
  id: 'm1', conversationId: 'conv1', authorId: 'laura', authorName: 'Laura', authorAvatarUrl: null, kind: 'text',
  body: 'Escuchas un ruido detrás de ti.', characterId: null, characterName: null, systemId: null,
  rollKind: null, rollRequest: null, rollDice: null, rollResult: null, rollRefId: null, createdAt: '2026-09-16T21:04:00Z',
};

describe('<WhisperWatcher> — el rincón de las pastillas', () => {
  it('sin conversaciones abiertas no pinta nada sobre la mesa', () => {
    renderWithProviders(<WhisperWatcher campaignId="c1" myUserId="me" system={null} chat={fakeChatPort()} sound={fakeSound()} />);
    expect(screen.queryByLabelText('Susurros abiertos')).not.toBeInTheDocument();
  });

  it('abrir desde el directorio deja la pastilla MINIMIZADA (la conversación se lee en la columna)', async () => {
    const chat = fakeChatPort({ messages: { 'conv-1': [] } });
    const onConsumed = vi.fn();
    renderWithProviders(<WhisperWatcher campaignId="c1" myUserId="me" system={null} chat={chat} sound={fakeSound()}
      requestOpen={{ id: 'conv-1', title: 'Laura' }} onRequestOpenConsumed={onConsumed} />);
    expect(await screen.findByLabelText('Conversación con Laura')).toBeInTheDocument();
    // barrita: se ofrece ABRIRLA, y la conversación no está montada dentro
    expect(screen.getByRole('button', { name: 'Abrir la conversación con Laura' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Escribe a Laura…')).not.toBeInTheDocument();
    expect(onConsumed).toHaveBeenCalled();
  });

  it('un susurro de OTRO sin pastilla abierta: nace MINIMIZADA, en sangre, con contador y SUENA', async () => {
    const chat = fakeChatPort();
    const sound = fakeSound();
    renderWithProviders(<WhisperWatcher campaignId="c1" myUserId="me" system={null} chat={chat} sound={sound} />);
    chat.push(FROM_LAURA);
    const pastilla = await screen.findByLabelText('Conversación con Laura');
    expect(pastilla.className).toContain('alert');
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(sound.plays).toBe(1);
    // un segundo mensaje de la misma conversación sube el contador y NO vuelve a sonar
    chat.push({ ...FROM_LAURA, id: 'm2', body: 'Otro más' });
    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(sound.plays).toBe(1);
  });

  it('lo que escribo YO no saca pastilla ni suena', async () => {
    const chat = fakeChatPort();
    const sound = fakeSound();
    renderWithProviders(<WhisperWatcher campaignId="c1" myUserId="me" system={null} chat={chat} sound={sound} />);
    chat.push({ ...FROM_LAURA, authorId: 'me', authorName: 'Pip' });
    await new Promise(r => setTimeout(r, 0));
    expect(screen.queryByLabelText('Conversación con Pip')).not.toBeInTheDocument();
    expect(sound.plays).toBe(0);
  });

  it('si la pastilla ya está DESPLEGADA el mensaje entra dentro: ni contador ni ruido', async () => {
    const u = userEvent.setup();
    const chat = fakeChatPort({ messages: { conv1: [] } });
    const sound = fakeSound();
    renderWithProviders(<WhisperWatcher campaignId="c1" myUserId="me" system={null} chat={chat} sound={sound}
      requestOpen={{ id: 'conv1', title: 'Laura' }} />);
    await u.click(await screen.findByRole('button', { name: 'Abrir la conversación con Laura' }));
    await screen.findByText('Todavía no hay mensajes.');
    chat.push(FROM_LAURA);
    expect(await screen.findByText('Escuchas un ruido detrás de ti.')).toBeInTheDocument();
    expect(sound.plays).toBe(0);
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('desplegar y volver a minimizar con la barrita; cerrar la quita del todo', async () => {
    const u = userEvent.setup();
    const chat = fakeChatPort({ messages: { conv1: [] } });
    renderWithProviders(<WhisperWatcher campaignId="c1" myUserId="me" system={null} chat={chat} sound={fakeSound()}
      requestOpen={{ id: 'conv1', title: 'Laura' }} />);
    await u.click(await screen.findByRole('button', { name: 'Abrir la conversación con Laura' }));
    expect(await screen.findByPlaceholderText('Escribe a Laura…')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Minimizar la conversación con Laura' }));
    expect(screen.queryByPlaceholderText('Escribe a Laura…')).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Abrir la conversación con Laura' }));
    expect(await screen.findByPlaceholderText('Escribe a Laura…')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Cerrar la conversación con Laura' }));
    expect(screen.queryByLabelText('Conversación con Laura')).not.toBeInTheDocument();
  });

  it('si la pastilla YA estaba puesta, volver a abrirla desde el directorio NO la despliega: sólo pone el contador a cero', async () => {
    const chat = fakeChatPort({ messages: { conv1: [] } });
    const { rerender } = renderWithProviders(<WhisperWatcher campaignId="c1" myUserId="me" system={null} chat={chat} sound={fakeSound()} />);
    chat.push(FROM_LAURA);
    await screen.findByText('1');
    rerender(<WhisperWatcher campaignId="c1" myUserId="me" system={null} chat={chat} sound={fakeSound()}
      requestOpen={{ id: 'conv1', title: 'Laura' }} />);
    await vi.waitFor(() => expect(screen.queryByText('1')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Conversación con Laura').className).not.toContain('alert');
    // sigue siendo barrita: la conversación se lee en la columna
    expect(screen.getByRole('button', { name: 'Abrir la conversación con Laura' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Escribe a Laura…')).not.toBeInTheDocument();
  });

  it('si él la había DESPLEGADO, volver a abrirla desde el directorio la respeta: no se le cierra en la cara', async () => {
    const u = userEvent.setup();
    const chat = fakeChatPort({ messages: { conv1: [] } });
    const { rerender } = renderWithProviders(<WhisperWatcher campaignId="c1" myUserId="me" system={null} chat={chat} sound={fakeSound()} />);
    chat.push(FROM_LAURA);
    await u.click(await screen.findByRole('button', { name: 'Abrir la conversación con Laura' }));
    expect(await screen.findByPlaceholderText('Escribe a Laura…')).toBeInTheDocument();
    rerender(<WhisperWatcher campaignId="c1" myUserId="me" system={null} chat={chat} sound={fakeSound()}
      requestOpen={{ id: 'conv1', title: 'Laura' }} />);
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Minimizar la conversación con Laura' })).toBeInTheDocument());
    expect(screen.getByPlaceholderText('Escribe a Laura…')).toBeInTheDocument();
  });

  it('desplegar una minimizada pone su contador a cero', async () => {
    const u = userEvent.setup();
    const chat = fakeChatPort({ messages: { conv1: [] } });
    renderWithProviders(<WhisperWatcher campaignId="c1" myUserId="me" system={null} chat={chat} sound={fakeSound()} />);
    chat.push(FROM_LAURA);
    await screen.findByText('1');
    await u.click(screen.getByRole('button', { name: 'Abrir la conversación con Laura' }));
    expect(screen.queryByText('1')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Conversación con Laura').className).not.toContain('alert');
  });

  it('caben TRES a la vez: la cuarta cierra la más vieja', async () => {
    const chat = fakeChatPort();
    renderWithProviders(<WhisperWatcher campaignId="c1" myUserId="me" system={null} chat={chat} sound={fakeSound()} />);
    for (const [i, quien] of ['Laura', 'Marta', 'Dani', 'Nico'].entries()) {
      chat.push({ ...FROM_LAURA, id: `m${i}`, conversationId: `conv${i}`, authorId: `u${i}`, authorName: quien });
    }
    expect(await screen.findByLabelText('Conversación con Nico')).toBeInTheDocument();
    expect(screen.getByLabelText('Conversación con Marta')).toBeInTheDocument();
    expect(screen.getByLabelText('Conversación con Dani')).toBeInTheDocument();
    expect(screen.queryByLabelText('Conversación con Laura')).not.toBeInTheDocument();
  });

  it('avisa el total de no leídos al montar, en cada mensaje y cuando la columna marca leído — sin resuscribir', async () => {
    const chat = fakeChatPort({ directory: [{ key: 'laura', conversationId: 'conv1', isGroup: false, title: 'Laura', role: 'dm', memberCount: null, memberIds: ['laura'], lastKind: 'text', lastBody: 'hola', unreadCount: 2 }] });
    const onUnreadChange = vi.fn();
    const { rerender } = renderWithProviders(<WhisperWatcher campaignId="c1" myUserId="me" system={null} chat={chat} sound={fakeSound()} onUnreadChange={onUnreadChange} readInColumn={null} />);
    await vi.waitFor(() => expect(onUnreadChange).toHaveBeenCalledWith(2));
    chat.directory[0]!.unreadCount = 0;
    rerender(<WhisperWatcher campaignId="c1" myUserId="me" system={null} chat={chat} sound={fakeSound()} onUnreadChange={onUnreadChange} readInColumn={{ id: 'conv1', tick: 1 }} />);
    await vi.waitFor(() => expect(onUnreadChange).toHaveBeenLastCalledWith(0));
    expect(chat.subscribers).toBe(1);
  });

  /**
   * 🐞 El precio de que la pastilla nazca barrita: el mensaje que llega mientras él lee esa conversación EN LA
   * COLUMNA no puede dejarle la barrita en sangre con un «1» de algo que acaba de leer. La columna dice cuál ha
   * marcado leída y esa pastilla se queda a cero. (Review del 2026-09-16.)
   */
  it('lo que llega mientras la lees EN LA COLUMNA no deja contador en la barrita', async () => {
    const chat = fakeChatPort({ messages: { conv1: [] } });
    const { rerender } = renderWithProviders(<WhisperWatcher campaignId="c1" myUserId="me" system={null} chat={chat} sound={fakeSound()}
      requestOpen={{ id: 'conv1', title: 'Laura' }} readInColumn={{ id: 'conv1', tick: 1 }} />);
    await screen.findByLabelText('Conversación con Laura');
    chat.push(FROM_LAURA);                       // llega mientras él la está leyendo en la columna
    await screen.findByText('1');                // por un instante sí sube…
    // …y la columna, que también lo recibe, marca leído: eso es lo que llega aquí
    rerender(<WhisperWatcher campaignId="c1" myUserId="me" system={null} chat={chat} sound={fakeSound()}
      requestOpen={null} readInColumn={{ id: 'conv1', tick: 2 }} />);
    await vi.waitFor(() => expect(screen.queryByText('1')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Conversación con Laura').className).not.toContain('alert');
  });

  it('una pastilla de GRUPO nacida de un susurro se corrige con el nombre de verdad, no el de quien escribió', async () => {
    const chat = fakeChatPort({
      directory: [{ key: 'g1', conversationId: 'grupo-1', isGroup: true, title: 'Marta, Dani', role: null, memberCount: 3, memberIds: [], lastKind: 'text', lastBody: 'hola', unreadCount: 1 }],
    });
    renderWithProviders(<WhisperWatcher campaignId="c1" myUserId="me" system={null} chat={chat} sound={fakeSound()} />);
    chat.push({ ...FROM_LAURA, conversationId: 'grupo-1', authorId: 'marta', authorName: 'Marta' });
    // nace con quien escribió, porque es lo único que trae el mensaje…
    expect(await screen.findByLabelText(/Conversación con/)).toBeInTheDocument();
    // …y el directorio la corrige: en un grupo el título son todos, no uno
    await vi.waitFor(() => expect(screen.getByLabelText('Conversación con Marta, Dani')).toBeInTheDocument());
  });

  it('el total de no leídos se avisa aunque el padre cambie de función en cada repintado, sin rehacer el canal', async () => {
    const chat = fakeChatPort({ directory: [{ key: 'laura', conversationId: 'conv1', isGroup: false, title: 'Laura', role: 'dm', memberCount: null, memberIds: ['laura'], lastKind: 'text', lastBody: 'hola', unreadCount: 2 }] });
    const vistos: number[] = [];
    const { rerender } = renderWithProviders(<WhisperWatcher campaignId="c1" myUserId="me" system={null} chat={chat} sound={fakeSound()} onUnreadChange={n => vistos.push(n)} />);
    await vi.waitFor(() => expect(vistos).toContain(2));
    rerender(<WhisperWatcher campaignId="c1" myUserId="me" system={null} chat={chat} sound={fakeSound()} onUnreadChange={n => vistos.push(n)} />);
    chat.directory[0]!.unreadCount = 5;
    chat.push(FROM_LAURA);
    await vi.waitFor(() => expect(vistos.at(-1)).toBe(5));
    expect(chat.subscribers).toBe(1);   // una función nueva en cada repintado NO rehace la suscripción
  });
});
