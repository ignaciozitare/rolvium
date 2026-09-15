import { describe, it, expect, vi } from 'vitest';
import { plenilunio } from '@rolvium/system-plenilunio';
import { renderWithProviders, screen } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { fakeRollLog, fakeChatPort } from '../../../../tests/helpers/fakes';
import { SidePanel } from './SidePanel';

describe('<SidePanel>', () => {
  it('muestra el Registro por defecto, cambia a las pestañas «pronto», y NO duplica el botón del lanzador', async () => {
    const u = userEvent.setup();
    const onToggle = vi.fn();
    const { rerender } = renderWithProviders(<SidePanel campaignId="c1" system={plenilunio} rollerOpen={false} onToggleRoller={onToggle} log={fakeRollLog()} myUserId="me" chat={fakeChatPort()} />);
    expect(screen.getByRole('tab', { name: 'Registro' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('Combate')).toBeInTheDocument();
    for (const name of ['Notas', 'Bitácora']) {
      await u.click(screen.getByRole('tab', { name }));
      expect(screen.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Esta parte de la mesa llega pronto.')).toBeInTheDocument();
    }
    await u.click(screen.getByRole('tab', { name: 'Registro' }));
    expect(await screen.findByText('Combate')).toBeInTheDocument();
    // el lanzador se abre desde la primera herramienta de la barra de la escena; aquí ya no hay botón
    expect(screen.queryByRole('button', { name: /Lanzador de dados/ })).not.toBeInTheDocument();
    expect(onToggle).not.toHaveBeenCalled();
    rerender(<SidePanel campaignId="c1" system={plenilunio} rollerOpen onToggleRoller={onToggle} log={fakeRollLog()} myUserId="me" chat={fakeChatPort()} />);
    expect(screen.queryByRole('button', { name: /Lanzador de dados/ })).not.toBeInTheDocument();
  });

  it('la pestaña SUSURROS abre el directorio de verdad, no el «pronto»', async () => {
    const u = userEvent.setup();
    const chat = fakeChatPort({ directory: [{ key: 'laura', conversationId: null, isGroup: false, title: 'Laura', role: 'dm', memberCount: null, memberIds: ['laura'], lastKind: null, lastBody: null, unreadCount: 0 }] });
    renderWithProviders(<SidePanel campaignId="c1" system={plenilunio} rollerOpen={false} onToggleRoller={vi.fn()} log={fakeRollLog()} myUserId="me" chat={chat} />);
    await u.click(screen.getByRole('tab', { name: 'Susurros' }));
    expect(await screen.findByText('Laura')).toBeInTheDocument();
    expect(screen.queryByText('Esta parte de la mesa llega pronto.')).not.toBeInTheDocument();
  });

  it('la campanita de no leídos sale junto a SUSURROS cuando no es la pestaña activa, y desaparece al abrirla', async () => {
    const u = userEvent.setup();
    renderWithProviders(<SidePanel campaignId="c1" system={plenilunio} rollerOpen={false} onToggleRoller={vi.fn()} log={fakeRollLog()} myUserId="me" chat={fakeChatPort()} chatUnread={3} />);
    expect(screen.getByRole('tab', { name: /Susurros/ })).toHaveTextContent('3');
    await u.click(screen.getByRole('tab', { name: /Susurros/ }));
    expect(screen.getByRole('tab', { name: /Susurros/ })).not.toHaveTextContent('3');
  });

  it('la pastilla trae una conversación pendiente: SUSURROS pasa a primer plano solo', async () => {
    const chat = fakeChatPort({ directory: [] });
    const onConsumed = vi.fn();
    renderWithProviders(<SidePanel campaignId="c1" system={plenilunio} rollerOpen={false} onToggleRoller={vi.fn()} log={fakeRollLog()} myUserId="me" chat={chat}
      pendingChatOpen={{ id: 'conv-1', title: 'Laura' }} onPendingChatOpenConsumed={onConsumed} />);
    expect(screen.getByRole('tab', { name: 'Susurros' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('Laura')).toBeInTheDocument();
    expect(onConsumed).toHaveBeenCalled();
  });

  it('abrir una conversación en SUSURROS sube onChatRead: con eso TablePage manda recontar la campanita', async () => {
    const u = userEvent.setup();
    const onChatRead = vi.fn();
    const chat = fakeChatPort({
      directory: [{ key: 'laura', conversationId: 'conv-1', isGroup: false, title: 'Laura', role: 'dm', memberCount: null, memberIds: ['laura'], lastKind: 'text', lastBody: 'hola', unreadCount: 2 }],
      messages: { 'conv-1': [] },
    });
    renderWithProviders(<SidePanel campaignId="c1" system={plenilunio} rollerOpen={false} onToggleRoller={vi.fn()} log={fakeRollLog()} myUserId="me" chat={chat} chatUnread={2} onChatRead={onChatRead} />);
    await u.click(screen.getByRole('tab', { name: /Susurros/ }));
    await u.click(await screen.findByText('Laura'));
    await screen.findByText('Todavía no hay mensajes.');
    await vi.waitFor(() => expect(onChatRead).toHaveBeenCalledTimes(1));
  });

  it('abrir una conversación sube onChatOpen: con eso TablePage saca la pastilla sobre la mesa', async () => {
    const u = userEvent.setup();
    const onChatOpen = vi.fn();
    const chat = fakeChatPort({
      directory: [{ key: 'laura', conversationId: 'conv-1', isGroup: false, title: 'Laura', role: 'dm', memberCount: null, memberIds: ['laura'], lastKind: 'text', lastBody: 'hola', unreadCount: 0 }],
      messages: { 'conv-1': [] },
    });
    renderWithProviders(<SidePanel campaignId="c1" system={plenilunio} rollerOpen={false} onToggleRoller={vi.fn()} log={fakeRollLog()} myUserId="me" chat={chat} onChatOpen={onChatOpen} />);
    await u.click(screen.getByRole('tab', { name: /Susurros/ }));
    await u.click(await screen.findByText('Laura'));
    expect(onChatOpen).toHaveBeenCalledWith('conv-1', 'Laura');
  });
});
