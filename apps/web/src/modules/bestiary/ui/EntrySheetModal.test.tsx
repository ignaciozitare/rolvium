import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '../../../../tests/helpers/render';
import { plenilunio } from '@rolvium/system-plenilunio';
import { EntrySheetModal } from './EntrySheetModal';
import type { BestiaryEntry } from '../domain/entities/BestiaryEntry';

const entry = (over: Partial<BestiaryEntry> = {}): BestiaryEntry => ({
  id: 'be-1', origin: 'custom', name: 'Ogro con antorcha', notes: 'Prende lo que toca',
  tokenUrl: null, sourceRef: 'ogre', campaignId: 'c1', editable: true,
  data: { stats: { fortitude: 8, combat: 4 }, endurance: 10, destiny: 0, protection: 3, abilities: [], specialties: { combat: ['creature.garrote'] }, page: 152 },
  ...over,
});

const setup = (over: Partial<BestiaryEntry> = {}, handlers = {}) => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const props = {
    entry: entry(over), system: plenilunio, campaignId: 'c1',
    specialtyLabel: (id: string) => (id === 'creature.garrote' ? 'Garrote' : id),
    onSave, onUploadImage: vi.fn().mockResolvedValue('https://x/t.webp'),
    onDuplicate: vi.fn(), onDelete: vi.fn(), onClose: vi.fn(), ...handlers,
  };
  renderWithProviders(<EntrySheetModal {...props} />);
  return props;
};

beforeEach(() => vi.clearAllMocks());

describe('EntrySheetModal — la Resistencia no se teclea', () => {
  /**
   * Es Aguante × 3 (p.25). Se enseña como resultado, no como campo: si fuera editable, alguien guardaría un
   * número que contradice la regla y nadie se enteraría hasta una partida.
   */
  it('sale calculada y se recalcula al cambiar el Aguante', async () => {
    setup();
    expect(screen.getByText('30')).toBeInTheDocument();

    const aguante = screen.getByLabelText('Aguante');
    await userEvent.clear(aguante);
    await userEvent.type(aguante, '4');
    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());
  });

  it('no hay ningún campo donde escribirla', () => {
    setup();
    expect(screen.queryByRole('spinbutton', { name: 'Resistencia' })).not.toBeInTheDocument();
  });
});

describe('EntrySheetModal — ausente no es 0', () => {
  /**
   * La regla más fácil de romper del hexágono. El manual no publica cuatro características del mutante:
   * dejarlas en 0 sería inventarse el bloque, y el director tiraría dados que el libro no le da.
   */
  it('una característica que el libro no publica se pinta «—», no 0', () => {
    setup({ data: { ...entry().data, stats: { fortitude: 3, combat: 3, will: 1 } } });
    expect(screen.getAllByText('—')).toHaveLength(4);           // astucia, sutileza, presencia, cultura
    expect(screen.queryByLabelText('Astucia')).not.toBeInTheDocument();
  });

  it('se le puede dar valor a una ausente, y quitárselo a una que lo tiene', async () => {
    setup({ data: { ...entry().data, stats: { fortitude: 3 } } });

    await userEvent.click(screen.getAllByRole('button', { name: 'Darle un valor a esta característica' })[0]!);
    await waitFor(() => expect(screen.getAllByText('—')).toHaveLength(5));

    // Tras darle valor a una hay DOS con valor (Fortaleza y la nueva): se le quita a la primera.
    await userEvent.click(screen.getAllByRole('button', { name: 'Dejar esta característica sin valor' })[0]!);
    await waitFor(() => expect(screen.getAllByText('—')).toHaveLength(6));
  });

  it('un 0 impreso sigue siendo un valor: se puede escribir y se guarda', async () => {
    const { onSave } = setup({ data: { ...entry().data, stats: { culture: 0 } } });
    expect(screen.getByLabelText('Cultura')).toHaveValue(0);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ stats: { culture: 0 } }) })));
  });
});

describe('EntrySheetModal — las especialidades', () => {
  it('salen con su nombre traducido junto a su característica', () => {
    setup();
    expect(screen.getByText('Garrote')).toBeInTheDocument();
  });

  it('una característica sin especialidad lo dice, no deja el hueco mudo', () => {
    setup();
    expect(screen.getAllByText('sin especialidad').length).toBeGreaterThan(0);
  });
});

describe('EntrySheetModal — «guardar para todas mis campañas»', () => {
  /** Sin campaña = global. Es la representación que eligió el dueño; si se perdiera, la entrada volvería a una sola partida. */
  it('marcarla guarda la entrada sin campaña', async () => {
    const { onSave } = setup();
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ campaignId: null })));
  });

  it('una entrada ya global aparece marcada, y desmarcarla la trae a esta campaña', async () => {
    const { onSave } = setup({ campaignId: null });
    expect(screen.getByRole('checkbox')).toBeChecked();
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ campaignId: 'c1' })));
  });
});

describe('EntrySheetModal — guardar', () => {
  it('manda el nombre y las notas editadas', async () => {
    const { onSave } = setup();
    await userEvent.clear(screen.getByLabelText('Nombre'));
    await userEvent.type(screen.getByLabelText('Nombre'), 'Ogro con machete');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ogro con machete' })));
  });

  /** Un nombre en blanco dejaría una ficha anónima en el listado, imposible de encontrar con el buscador. */
  it('un nombre vacío no borra el que había', async () => {
    const { onSave } = setup();
    await userEvent.clear(screen.getByLabelText('Nombre'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ogro con antorcha' })));
  });

  /**
   * Subir la imagen sólo la deja en el bucket: quien escribe `token_url` en la fila es este patch. Si no
   * viajara, la foto se vería hasta recargar la página y después desaparecería sin ningún error — el peor
   * tipo de fallo, porque parece que ha funcionado.
   */
  it('la imagen ya subida viaja en el guardado', async () => {
    const { onSave } = setup({ tokenUrl: 'https://x/ya-subida.webp' });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ tokenUrl: 'https://x/ya-subida.webp' })));
  });

  it('una entrada sin imagen manda la imagen en blanco, no la omite', async () => {
    const { onSave } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ tokenUrl: null })));
  });

  it('si guardar falla, se dice y la ficha no se cierra', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('sin permiso'));
    const { onClose } = setup({}, { onSave });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('sin permiso');
    expect(onClose).not.toHaveBeenCalled();
  });
});
