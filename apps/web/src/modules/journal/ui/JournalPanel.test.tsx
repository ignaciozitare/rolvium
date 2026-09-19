import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '../../../../tests/helpers/render';
import { emptyDoc, heading, paragraph, type RichDoc } from '@rolvium/core';
import { LogbookConflictError, type CampaignLogbook, type CampaignNotes } from '../domain/entities/Journal';
import type { JournalPort } from '../domain/ports/JournalPort';
import { JournalPanel } from './JournalPanel';
import { SAVE_DELAY_MS } from './useJournalDoc';

const DOC: RichDoc = { v: 1, blocks: [heading(1, [{ t: 'El almacén' }]), heading(2, [{ t: 'Llegada' }]), paragraph([{ t: 'Llegan de noche.' }])] };

const NOTES: CampaignNotes = { id: 'n1', campaignId: 'c1', userId: 'u1', doc: DOC, updatedAt: '2026-09-20T10:00:00Z' };
const LOGBOOK: CampaignLogbook = { id: 'l1', campaignId: 'c1', doc: emptyDoc(), updatedBy: null, updatedAt: '2026-09-20T10:00:00Z' };

function fakeJournal(over: Partial<JournalPort> = {}): JournalPort {
  return {
    openNotes: vi.fn().mockResolvedValue(NOTES),
    saveNotes: vi.fn().mockResolvedValue('2026-09-20T10:05:00Z'),
    openLogbook: vi.fn().mockResolvedValue(LOGBOOK),
    saveLogbook: vi.fn().mockResolvedValue('2026-09-20T10:05:00Z'),
    ...over,
  };
}

const paint = (journal: JournalPort, kind: 'notes' | 'logbook' = 'notes') =>
  renderWithProviders(<JournalPanel kind={kind} campaignId="c1" myUserId="u1" journal={journal} />);

afterEach(() => { vi.useRealTimers(); });

describe('JournalPanel — abrir', () => {
  it('pide MIS notas de ESTA campaña y las pinta', async () => {
    const journal = fakeJournal();
    paint(journal);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('El almacén');
    expect(journal.openNotes).toHaveBeenCalledWith('c1', 'u1');
  });

  it('la Bitácora es de la campaña, no de la persona', async () => {
    const journal = fakeJournal();
    paint(journal, 'logbook');
    await waitFor(() => expect(journal.openLogbook).toHaveBeenCalledWith('c1'));
    expect(journal.openNotes).not.toHaveBeenCalled();
  });

  it('avisa de quién es cada superficie, que es lo que evita escribir en el sitio equivocado', async () => {
    const journal = fakeJournal();
    const { unmount } = paint(journal);
    expect(await screen.findByText(/Privadas: nadie más las ve/)).toBeInTheDocument();
    unmount();
    paint(fakeJournal(), 'logbook');
    expect(await screen.findByText(/Compartida: todos pueden leer y escribir/)).toBeInTheDocument();
  });

  it('si la base dice que no, lo cuenta y deja reintentar — no se queda en blanco', async () => {
    const openNotes = vi.fn().mockRejectedValueOnce(new Error('rls')).mockResolvedValue(NOTES);
    paint(fakeJournal({ openNotes }));
    expect(await screen.findByText('No se ha podido abrir esto.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(openNotes).toHaveBeenCalledTimes(2);
  });
});

describe('JournalPanel — guarda sola', () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });

  it('no hay botón de guardar, y lo escrito se guarda solo tras un momento', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const journal = fakeJournal();
    paint(journal);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: /Guardar/i })).toBeNull();

    await user.click(screen.getAllByRole('textbox')[0]!);
    await user.keyboard(' y llueve');
    expect(journal.saveNotes).not.toHaveBeenCalled();

    vi.advanceTimersByTime(SAVE_DELAY_MS);
    await waitFor(() => expect(journal.saveNotes).toHaveBeenCalledTimes(1));
    expect((journal.saveNotes as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe('n1');
    expect(await screen.findByText('guardado hace un momento')).toBeInTheDocument();
  });

  it('escribir seguido guarda UNA vez, no una por tecla', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const journal = fakeJournal();
    paint(journal);
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getAllByRole('textbox')[0]!);
    await user.keyboard('abcdef');
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    await waitFor(() => expect(journal.saveNotes).toHaveBeenCalledTimes(1));
  });

  it('la Bitácora se guarda contra la marca con la que se abrió, y con quién la guarda', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const journal = fakeJournal();
    paint(journal, 'logbook');
    await waitFor(() => expect(journal.openLogbook).toHaveBeenCalled());
    await user.click(screen.getAllByRole('textbox')[0]!);
    await user.keyboard('x');
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    await waitFor(() => expect(journal.saveLogbook).toHaveBeenCalled());
    const [id, , expected, userId] = (journal.saveLogbook as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect([id, expected, userId]).toEqual(['l1', '2026-09-20T10:00:00Z', 'u1']);
  });

  it('si otro guardó antes, lo dice y ofrece ver lo que hay — sin perder lo escrito', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const saveLogbook = vi.fn().mockRejectedValue(new LogbookConflictError('2026-09-20T10:03:00Z'));
    const journal = fakeJournal({ saveLogbook });
    paint(journal, 'logbook');
    await waitFor(() => expect(journal.openLogbook).toHaveBeenCalled());
    await user.click(screen.getAllByRole('textbox')[0]!);
    await user.keyboard('lo mío');
    vi.advanceTimersByTime(SAVE_DELAY_MS);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Otra persona guardó la bitácora/);
    expect(screen.getByText('lo mío')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver lo que hay' }));
    await waitFor(() => expect(journal.openLogbook).toHaveBeenCalledTimes(2));
  });

  it('un fallo al guardar se cuenta, en vez de fingir que se guardó', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const journal = fakeJournal({ saveNotes: vi.fn().mockRejectedValue(new Error('red')) });
    paint(journal);
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getAllByRole('textbox')[0]!);
    await user.keyboard('x');
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    expect(await screen.findByText('no se ha podido guardar')).toBeInTheDocument();
  });

  /**
   * 🐞 UN FALLO AL GUARDAR SE LLEVABA EL TEXTO (cazado en la revisión del 2026-09-20). `write` vaciaba lo
   * pendiente ANTES de mandarlo, así que al fallar no quedaba nada: ni el `Cmd+S` ni el guardado al cerrar
   * tenían qué mandar, y quien dejara de escribir al ver el aviso perdía lo escrito sin enterarse.
   */
  it('tras un fallo, lo escrito sigue pendiente: el cierre lo reintenta en vez de tirarlo', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const saveNotes = vi.fn().mockRejectedValueOnce(new Error('red')).mockResolvedValue('2026-09-20T10:06:00Z');
    const journal = fakeJournal({ saveNotes });
    const { unmount } = paint(journal);
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getAllByRole('textbox')[0]!);
    await user.keyboard('lo que no entró');
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    expect(await screen.findByText('no se ha podido guardar')).toBeInTheDocument();

    // Cerrar la mesa vuelve a intentarlo — y con el MISMO texto, no con uno vacío.
    unmount();
    expect(saveNotes).toHaveBeenCalledTimes(2);
    const primero = saveNotes.mock.calls[0]![1] as RichDoc;
    expect(saveNotes.mock.calls[1]![1]).toEqual(primero);
  });

  it('cambiar de pestaña no se lleva por delante lo que quedaba a medio guardar', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const journal = fakeJournal();
    const { unmount } = paint(journal);
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getAllByRole('textbox')[0]!);
    await user.keyboard('a medias');
    unmount();
    expect(journal.saveNotes).toHaveBeenCalledTimes(1);
  });
});

describe('JournalPanel — el índice', () => {
  it('se abre al pulsar ÍNDICE y trae los H1 con sus H2 colgando', async () => {
    const user = userEvent.setup();
    paint(fakeJournal());
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('button', { name: /Índice/ }));
    const panel = screen.getByRole('navigation', { name: 'Índice' });
    expect(panel).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'El almacén' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Llegada' })).toBeInTheDocument();
  });

  it('se cierra desde el propio panel y desde el botón', async () => {
    const user = userEvent.setup();
    paint(fakeJournal());
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('button', { name: /Índice/ }));
    await user.click(screen.getByRole('button', { name: 'Cerrar el índice' }));
    expect(screen.queryByRole('navigation', { name: 'Índice' })).toBeNull();
  });

  it('sin títulos lo dice, en vez de salir un panel vacío', async () => {
    const user = userEvent.setup();
    paint(fakeJournal({ openNotes: vi.fn().mockResolvedValue({ ...NOTES, doc: emptyDoc() }) }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Índice/ })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Índice/ }));
    expect(screen.getByText(/Todavía no hay títulos/)).toBeInTheDocument();
  });
});
