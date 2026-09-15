import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '../../../../tests/helpers/render';
import type { ChatMessage } from '../domain/entities/Chat';
import { WhisperPill } from './WhisperPill';

const base: ChatMessage = {
  id: 'm1', conversationId: 'conv1', authorId: 'laura', authorName: 'Laura', authorAvatarUrl: null, kind: 'text',
  body: 'Escuchas un ruido', characterId: null, characterName: null, systemId: null,
  rollKind: null, rollRequest: null, rollDice: null, rollResult: null, rollRefId: null, createdAt: '2026-09-15T21:04:00Z',
};

describe('<WhisperPill>', () => {
  it('un mensaje de texto enseña quién y el cuerpo', () => {
    renderWithProviders(<WhisperPill message={base} onOpen={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText('Laura te susurra')).toBeInTheDocument();
    expect(screen.getByText('Escuchas un ruido')).toBeInTheDocument();
  });

  it('una tirada privada enseña el aviso genérico, no un cuerpo vacío', () => {
    renderWithProviders(<WhisperPill message={{ ...base, kind: 'roll', body: 'Astucia' }} onOpen={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText('Tirada privada')).toBeInTheDocument();
  });

  it('pinchar el cuerpo abre, pinchar la X cierra', async () => {
    const u = userEvent.setup();
    const onOpen = vi.fn();
    const onDismiss = vi.fn();
    renderWithProviders(<WhisperPill message={base} onOpen={onOpen} onDismiss={onDismiss} />);
    await u.click(screen.getByText('Laura te susurra'));
    expect(onOpen).toHaveBeenCalled();
    await u.click(screen.getByLabelText('Cerrar el aviso'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
