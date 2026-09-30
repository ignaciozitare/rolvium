import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import userEvent from '@testing-library/user-event';
import { plenilunio } from '@rolvium/system-plenilunio';
import { renderWithProviders, screen, waitFor } from '../../../../tests/helpers/render';
import { fakeChatPort } from '../../../../tests/helpers/fakes';
import type { ChatMessage } from '../domain/entities/Chat';
import type { PhotosPort } from '@/modules/photos';
import type { Photo } from '@/modules/photos';
import { ConversationView } from './ConversationView';

const TEXT_MSG: ChatMessage = {
  id: 'm1', conversationId: 'conv1', authorId: 'laura', authorName: 'Laura', authorAvatarUrl: null, kind: 'text',
  body: 'Escuchas un ruido detrás de ti. Nadie más lo ha oído.', characterId: null, characterName: null, systemId: null,
  rollKind: null, rollRequest: null, rollDice: null, rollResult: null, rollRefId: null, photoId: null, createdAt: '2026-09-15T21:04:00Z',
};
const ROLL_MSG: ChatMessage = {
  id: 'm2', conversationId: 'conv1', authorId: 'karen', authorName: 'Karen', authorAvatarUrl: null, kind: 'roll',
  body: 'Astucia', characterId: null, characterName: 'Karen Sinclair', systemId: 'plenilunio',
  rollKind: 'system', rollRequest: { systemId: 'plenilunio', kind: 'system', title: 'Astucia', groups: [{ count: 2, sides: 6, tag: 'own' }], visibility: 'table' },
  rollDice: [[4, 1]], rollResult: { summary: 'roll.degree.setback', total: 5 }, rollRefId: null, photoId: null, createdAt: '2026-09-15T21:05:00Z',
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
    // dice CUÁL se ha leído: con eso el rincón le quita el contador a esa pastilla aunque se lea en la columna
    expect(onRead).toHaveBeenCalledWith('conv1');
    chat.push({ ...TEXT_MSG, id: 'm3', body: 'Nuevo susurro' });
    await screen.findByText('Nuevo susurro');
    await vi.waitFor(() => expect(onRead).toHaveBeenCalledTimes(2));
    await u.type(screen.getByPlaceholderText('Escribe a Laura…'), 'Vale');
    await u.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByText('Vale');
    expect(chat.read).toEqual(['conv1', 'conv1']);
    expect(onRead).toHaveBeenCalledTimes(2);
  });

  it('con hideHead (dentro de una pastilla) no pinta su cabecera: la pone la pastilla', async () => {
    const chat = fakeChatPort({ messages: { conv1: [] } });
    renderWithProviders(<ConversationView campaignId="c1" conversationId="conv1" title="Laura" myUserId="me" system={null} onBack={() => {}} hideHead chat={chat} />);
    await screen.findByText('Todavía no hay mensajes.');
    expect(screen.queryByRole('button', { name: 'Volver al directorio' })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Escribe a Laura…')).toBeInTheDocument();   // lo demás, intacto
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

/**
 * ✍️ EL SALTO DE LÍNEA (suyo, 2026-09-28: «*en el chat no me deja hacer un salto de linea tocando opt en mac
 * y control en windows*»). No es que estuviera mal atado: la caja era un `<input>`, donde un salto de línea
 * **no existe**. Ahora es de varias líneas, Enter manda y el modificador salta.
 *
 * 🔑 El salto se escribe A MANO. Un `<textarea>` sólo salta solo con Mayúsculas+Enter: con Alt o con Control
 * el navegador no escribe nada. Si estas pruebas dejaran de mirar el CONTENIDO de la caja y sólo miraran que
 * no se envía, pasarían igual con la caja vacía — y él volvería a decir lo mismo.
 */
describe('<ConversationView> el salto de línea', () => {
  const montar = () => {
    const chat = fakeChatPort({ messages: { conv1: [] }, users: { me: { name: 'Pip', avatarUrl: null } } });
    renderWithProviders(<ConversationView campaignId="c1" conversationId="conv1" title="Laura" myUserId="me" system={null} onBack={() => {}} chat={chat} />);
    return chat;
  };
  const caja = () => screen.getByPlaceholderText('Escribe a Laura…');

  it('Enter a secas MANDA', async () => {
    const u = userEvent.setup();
    const chat = montar();
    await screen.findByText('Todavía no hay mensajes.');
    await u.type(caja(), 'Voy primero.{Enter}');
    expect(chat.sent).toEqual([{ conversationId: 'conv1', authorId: 'me', body: 'Voy primero.' }]);
  });

  it('🔑 Opción+Enter (Mac) hace un salto de línea y NO manda', async () => {
    const u = userEvent.setup();
    const chat = montar();
    await screen.findByText('Todavía no hay mensajes.');
    await u.type(caja(), 'Primera{Alt>}{Enter}{/Alt}segunda');
    expect(caja()).toHaveValue('Primera\nsegunda');
    expect(chat.sent).toEqual([]);
  });

  it('🔑 Control+Enter (Windows) hace un salto de línea y NO manda', async () => {
    const u = userEvent.setup();
    const chat = montar();
    await screen.findByText('Todavía no hay mensajes.');
    await u.type(caja(), 'Primera{Control>}{Enter}{/Control}segunda');
    expect(caja()).toHaveValue('Primera\nsegunda');
    expect(chat.sent).toEqual([]);
  });

  it('Mayúsculas+Enter tampoco manda: es lo que la mano ya sabe de otros chats', async () => {
    const u = userEvent.setup();
    const chat = montar();
    await screen.findByText('Todavía no hay mensajes.');
    await u.type(caja(), 'Primera{Shift>}{Enter}{/Shift}');
    expect(chat.sent).toEqual([]);
  });

  it('el salto cae DONDE ESTÁ EL CURSOR, no al final', async () => {
    const u = userEvent.setup();
    montar();
    await screen.findByText('Todavía no hay mensajes.');
    await u.type(caja(), 'AB');
    const el = caja() as HTMLTextAreaElement;
    el.setSelectionRange(1, 1);
    await u.keyboard('{Alt>}{Enter}{/Alt}');
    expect(el).toHaveValue('A\nB');
  });

  /**
   * 🐞 LA CARRERA DEL CURSOR (2026-09-28). Éste es EL fallo que él vio y que la suite NO cazaba: el cursor se
   * recolocaba con `requestAnimationFrame`, y si seguía escribiendo antes de que llegara el fotograma las
   * letras caían donde estaba el cursor viejo — «Primera\ndasegun» en vez de «Primera\nsegunda».
   *
   * 🔑 Hay que partir el texto POR EL MEDIO y seguir tecleando. Saltando al FINAL la prueba no vale: al
   * repintarse la caja el navegador deja el cursor al final por su cuenta, que coincide con el sitio bueno, y
   * la versión rota pasa igual. (Medido: con `requestAnimationFrame` sólo esta prueba se pone roja.)
   */
  it('🔑 y la letra siguiente cae DETRÁS del salto, sin esperar a ningún fotograma', async () => {
    const u = userEvent.setup();
    montar();
    await screen.findByText('Todavía no hay mensajes.');
    await u.type(caja(), 'AB');
    const el = caja() as HTMLTextAreaElement;
    el.setSelectionRange(1, 1);
    await u.keyboard('{Alt>}{Enter}{/Alt}X');
    expect(el).toHaveValue('A\nXB');
  });

  it('y lo enviado con saltos se LEE con sus saltos', async () => {
    const u = userEvent.setup();
    const chat = montar();
    await screen.findByText('Todavía no hay mensajes.');
    await u.type(caja(), 'Uno{Alt>}{Enter}{/Alt}Dos{Enter}');
    expect(chat.sent).toEqual([{ conversationId: 'conv1', authorId: 'me', body: 'Uno\nDos' }]);
    // El salto tiene que llegar al texto pintado; que se VEA lo garantiza `white-space: pre-wrap` en `chat.css`.
    const pintado = await screen.findByText(/Uno/);
    expect(pintado.textContent).toBe('Uno\nDos');
  });

  /**
   * 🔑 Y QUE SE VEA. Aquí arriba se comprueba que el salto LLEGA al texto pintado, pero jsdom no aplica la
   * hoja de estilos: sin `white-space: pre-wrap` el navegador colapsa el salto a un espacio y en su pantalla
   * volvería a parecer que «no deja hacer un salto de linea», con la prueba de arriba en verde. Por eso el
   * CSS se lee a mano, como en `pastillas-pegadas-abajo`.
   */
  it('🔑 y el CSS deja que se VEA: sin pre-wrap el salto se guarda pero no se pinta', () => {
    const css = readFileSync(join(__dirname, 'chat.css'), 'utf8');
    const regla = css.slice(css.indexOf('.ch-message-text{'), css.indexOf('}', css.indexOf('.ch-message-text{')) + 1);
    expect(regla).toContain('white-space:pre-wrap');
  });
});

/**
 * 📷 LA FOTO POR EL CHAT (H13, rebanada 5). Suyo, 2026-09-28: «*en el chat no tengo forma de enviar una foto,
 * no hay un subir ni adjuntar desde la galeria, ten muchi ojo esto tiene que ser un icono no una palabra no
 * hay mucho lugar*». Lámina: § 4 · `Fotos/En el chat · mandarla y verla`, aprobada el 2026-09-24.
 *
 * Dos barreras, como siempre: la pantalla esconde el clip a quien no es director, y la base rechaza el
 * mensaje aunque se intente por la API (`chat_messages_insert`). Aquí se prueba la de pantalla.
 */
vi.mock('@rolvium/ui', async importOriginal => ({
  ...(await importOriginal<typeof import('@rolvium/ui')>()),
  // jsdom no tiene `createImageBitmap` ni canvas: sólo se dobla el compresor, el resto de `@rolvium/ui` es el real.
  compressImage: vi.fn().mockResolvedValue({ blob: new Blob(['c'], { type: 'image/webp' }), originalBytes: 2_000_000, bytes: 204_800, compressed: true, width: 1024, height: 1280 }),
}));
vi.mock('@/shared/settings/container', () => ({ compressionLevelsRepo: { load: vi.fn().mockResolvedValue(null), save: vi.fn() } }));

const FOTO: Photo = { id: 'ph-1', campaignId: 'c1', name: 'El puente', width: 1024, height: 1280, createdAt: '2026-09-27T10:00:00Z' };
const fakePhotos = (rows: Photo[] = [FOTO]): PhotosPort => ({
  list: vi.fn().mockResolvedValue(rows),
  create: vi.fn(async () => FOTO),
  rename: vi.fn(), remove: vi.fn(),
  usage: vi.fn().mockResolvedValue({ adventures: [], scenes: [], messages: 0 }),
  urlsFor: vi.fn(async (_c: string, ids: readonly string[]) => Object.fromEntries(ids.map(id => [id, `https://x/${id}.webp`]))),
});
const PHOTO_MSG: ChatMessage = {
  id: 'm3', conversationId: 'conv1', authorId: 'laura', authorName: 'Laura', authorAvatarUrl: null, kind: 'photo',
  body: 'Esto es lo que ves.', characterId: null, characterName: null, systemId: null,
  rollKind: null, rollRequest: null, rollDice: null, rollResult: null, rollRefId: null, photoId: 'ph-1',
  createdAt: '2026-09-15T21:06:00Z',
};

describe('<ConversationView> mandar una foto', () => {
  const montar = (isDm: boolean, chat = fakeChatPort({ messages: { conv1: [] }, users: { me: { name: 'Pip', avatarUrl: null } } }), photos = fakePhotos()) => {
    renderWithProviders(<ConversationView campaignId="c1" conversationId="conv1" title="Laura" myUserId="me" system={null}
      onBack={() => {}} chat={chat} isDm={isDm} photos={photos} />);
    return { chat, photos };
  };

  it('🔑 el clip es un ICONO, no una palabra: en esa fila no hay sitio', async () => {
    montar(true);
    const clip = await screen.findByRole('button', { name: 'Mandar una foto' });
    // Su rótulo vive en `aria-label`; lo que se ve es el símbolo.
    expect(clip.textContent?.trim()).toBe('attach_file');
    // Y enviar tampoco es ya una palabra (mismo motivo, mismo día).
    expect(screen.getByRole('button', { name: 'Enviar' }).textContent?.trim()).toBe('send');
  });

  it('🔑 un JUGADOR no tiene clip: mandar fotos es del director', async () => {
    montar(false);
    await screen.findByText('Todavía no hay mensajes.');
    expect(screen.queryByRole('button', { name: 'Mandar una foto' })).toBeNull();
  });

  it('ofrece los DOS caminos: del ordenador y de la galería', async () => {
    const u = userEvent.setup();
    montar(true);
    await u.click(await screen.findByRole('button', { name: 'Mandar una foto' }));
    expect(screen.getByRole('menuitem', { name: 'Subir una del ordenador' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'De la galería' })).toBeInTheDocument();
  });

  it('elegir una de la galería la MANDA', async () => {
    const u = userEvent.setup();
    const { chat } = montar(true);
    await u.click(await screen.findByRole('button', { name: 'Mandar una foto' }));
    await u.click(screen.getByRole('menuitem', { name: 'De la galería' }));
    await u.click(await screen.findByRole('button', { name: 'El puente' }));
    await waitFor(() => expect(chat.photosSent).toEqual([{ conversationId: 'conv1', authorId: 'me', photoId: 'ph-1' }]));
  });

  it('lo que estuviera escrito va de PIE, en un solo gesto y no en dos mensajes', async () => {
    const u = userEvent.setup();
    const { chat } = montar(true);
    await screen.findByText('Todavía no hay mensajes.');
    await u.type(screen.getByPlaceholderText('Escribe a Laura…'), 'Mira esto');
    await u.click(screen.getByRole('button', { name: 'Mandar una foto' }));
    await u.click(screen.getByRole('menuitem', { name: 'De la galería' }));
    await u.click(await screen.findByRole('button', { name: 'El puente' }));
    await waitFor(() => expect(chat.photosSent).toEqual([{ conversationId: 'conv1', authorId: 'me', photoId: 'ph-1', body: 'Mira esto' }]));
    expect(screen.getByPlaceholderText('Escribe a Laura…')).toHaveValue('');
  });

  /** El camino del ORDENADOR: se comprime, entra en la galería de la campaña y se manda, todo de un tirón. */
  it('subir una del ordenador la guarda en la galería Y la manda', async () => {
    const u = userEvent.setup();
    const { chat, photos } = montar(true, undefined, fakePhotos([]));
    await screen.findByText('Todavía no hay mensajes.');
    await u.click(screen.getByRole('button', { name: 'Mandar una foto' }));
    await u.click(screen.getByRole('menuitem', { name: 'Subir una del ordenador' }));
    const fichero = new File(['x'], 'retrato.png', { type: 'image/png' });
    Object.defineProperty(fichero, 'size', { value: 2_000_000 });
    await u.upload(screen.getByTestId('ch-photo-input'), fichero);
    // Entra en la biblioteca de la campaña: subir desde el chat no crea una foto suelta.
    await waitFor(() => expect(photos.create).toHaveBeenCalledWith('c1', expect.objectContaining({ name: 'retrato' })));
    await waitFor(() => expect(chat.photosSent).toEqual([{ conversationId: 'conv1', authorId: 'me', photoId: 'ph-1' }]));
  });

  it('una foto recibida se VE, con su pie y con el enlace firmado', async () => {
    const chat = fakeChatPort({ messages: { conv1: [PHOTO_MSG] } });
    const { photos } = montar(false, chat);
    const img = await screen.findByRole('img', { name: 'Esto es lo que ves.' });
    expect(img).toHaveAttribute('src', 'https://x/ph-1.webp');
    expect(screen.getByText('Esto es lo que ves.')).toBeInTheDocument();
    // El enlace se firma aparte: el mensaje sólo guarda QUÉ foto es, nunca su enlace.
    await waitFor(() => expect(photos.urlsFor).toHaveBeenCalledWith('c1', ['ph-1']));
  });

  it('🔑 borrada de la galería, el mensaje NO se rompe: queda su hueco', async () => {
    const chat = fakeChatPort({ messages: { conv1: [{ ...PHOTO_MSG, photoId: null }] } });
    montar(false, chat);
    expect(await screen.findByText('Foto borrada')).toBeInTheDocument();
    // Y el pie que él escribió sigue ahí: se borró la foto, no lo que dijo.
    expect(screen.getByText('Esto es lo que ves.')).toBeInTheDocument();
  });
});
