import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '../../../../tests/helpers/render';
import type { ChatDirectoryEntry } from '../domain/entities/Chat';
import { Directory } from './Directory';

const LAURA: ChatDirectoryEntry = { key: 'laura', conversationId: 'conv-laura', isGroup: false, title: 'Laura', role: 'dm', memberCount: null, memberIds: ['laura'], lastKind: 'text', lastBody: 'Escuchas un ruido detrás de ti…', unreadCount: 1 };
const KAREN: ChatDirectoryEntry = { key: 'karen', conversationId: null, isGroup: false, title: 'Karen', role: 'player', memberCount: null, memberIds: ['karen'], lastKind: null, lastBody: null, unreadCount: 0 };
const GROUP: ChatDirectoryEntry = { key: 'conv-group', conversationId: 'conv-group', isGroup: true, title: 'Marta, Dani', role: null, memberCount: 2, memberIds: [], lastKind: null, lastBody: null, unreadCount: 0 };

describe('<Directory>', () => {
  it('pinta nombre, previsualización y el no leídos; sin conversación aún enseña el rol', async () => {
    renderWithProviders(<Directory entries={[LAURA, KAREN]} onOpen={vi.fn()} onCreateGroup={vi.fn()} />);
    expect(screen.getByText('Laura')).toBeInTheDocument();
    expect(screen.getByText('Escuchas un ruido detrás de ti…')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Karen')).toBeInTheDocument();
    expect(screen.getByText('Jugador')).toBeInTheDocument();
  });

  it('un grupo enseña «Grupo · N personas» en vez del rol', () => {
    renderWithProviders(<Directory entries={[GROUP]} onOpen={vi.fn()} onCreateGroup={vi.fn()} />);
    expect(screen.getByText('Marta, Dani')).toBeInTheDocument();
    expect(screen.getByText('Grupo · 2 personas')).toBeInTheDocument();
  });

  it('pinchar una fila fuera de modo grupo abre esa conversación', async () => {
    const u = userEvent.setup();
    const onOpen = vi.fn();
    renderWithProviders(<Directory entries={[LAURA]} onOpen={onOpen} onCreateGroup={vi.fn()} />);
    await u.click(screen.getByText('Laura'));
    expect(onOpen).toHaveBeenCalledWith(LAURA);
  });

  it('+ Grupo entra en modo selección: marca a varios (nunca a un grupo ya existente) y confirma con sus ids', async () => {
    const u = userEvent.setup();
    const onCreateGroup = vi.fn();
    renderWithProviders(<Directory entries={[LAURA, KAREN, GROUP]} onOpen={vi.fn()} onCreateGroup={onCreateGroup} />);
    await u.click(screen.getByRole('button', { name: '+ Grupo' }));
    // el grupo ya existente no se puede marcar
    expect(screen.getByText('Marta, Dani').closest('button')).toBeDisabled();
    await u.click(screen.getByText('Laura'));
    await u.click(screen.getByText('Karen'));
    expect(screen.getByRole('button', { name: 'Crear grupo (2)' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Crear grupo (2)' }));
    expect(onCreateGroup).toHaveBeenCalledWith(expect.arrayContaining(['laura', 'karen']));
  });

  it('cancelar el modo grupo no crea nada y vuelve a abrir conversaciones al pinchar', async () => {
    const u = userEvent.setup();
    const onOpen = vi.fn();
    const onCreateGroup = vi.fn();
    renderWithProviders(<Directory entries={[LAURA]} onOpen={onOpen} onCreateGroup={onCreateGroup} />);
    await u.click(screen.getByRole('button', { name: '+ Grupo' }));
    await u.click(screen.getByText('Laura'));
    await u.click(screen.getByRole('button', { name: 'Cancelar grupo' }));
    expect(onCreateGroup).not.toHaveBeenCalled();
    await u.click(screen.getByText('Laura'));
    expect(onOpen).toHaveBeenCalledWith(LAURA);
  });

  it('sin nadie más en la campaña enseña el estado vacío', () => {
    renderWithProviders(<Directory entries={[]} onOpen={vi.fn()} onCreateGroup={vi.fn()} />);
    expect(screen.getByText('Todavía no hay nadie más en esta campaña.')).toBeInTheDocument();
  });
});
