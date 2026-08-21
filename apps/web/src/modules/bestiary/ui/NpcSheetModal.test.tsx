import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '../../../../tests/helpers/render';
import { plenilunio } from '@rolvium/system-plenilunio';
import { NpcSheetModal } from './NpcSheetModal';
import { emptyNpc, gameValuesOf } from '../domain/useCases/bestiaryRules';
import type { BestiaryEntry } from '../domain/entities/BestiaryEntry';

const npc = (sheet: Record<string, unknown> = {}, over: Partial<BestiaryEntry> = {}): BestiaryEntry => ({
  id: 'be-npc', origin: 'npc', name: 'Padre Vidal', notes: 'Aliado del grupo',
  tokenUrl: null, sourceRef: null, campaignId: 'c1', editable: true,
  data: { stats: {}, endurance: 0, destiny: 0, protection: 0, abilities: [], specialties: {}, sheet },
  ...over,
});

const setup = (entry = npc(), handlers = {}) => {
  const props = { entry, system: plenilunio, campaignId: 'c1', onSave: vi.fn().mockResolvedValue(undefined), onUploadImage: vi.fn().mockResolvedValue('https://x/t.webp'), onDelete: vi.fn(), onClose: vi.fn(), ...handlers };
  renderWithProviders(<NpcSheetModal {...props} />);
  return props;
};

beforeEach(() => vi.clearAllMocks());

describe('NpcSheetModal — es la ficha de personaje, no un bloque de criatura', () => {
  /**
   * La razón de reutilizar `<Sheet>`: un aliado tiene dones, armas, equipo y salud igual que un PJ.
   * Si esto dejara de renderizar el esquema del sistema, el director tendría medio PNJ.
   */
  it('pinta la ficha que dicta el esquema del sistema, no siete números sueltos', () => {
    setup();
    // «Dones» y «Equipo» sólo existen en la ficha de personaje: un bloque de criatura no los tiene.
    // Si aparecen es que se está pintando el sheetSchema de Plenilunio y no un formulario de este módulo.
    expect(screen.getAllByText('Dones').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Equipo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Fortaleza').length).toBeGreaterThan(0);
  });

  it('una ficha recién creada sale vacía, no rota', () => {
    const fresh = emptyNpc('c1', plenilunio.id, 'PNJ sin nombre');
    expect(fresh.origin).toBe('npc');
    expect(fresh.data.sheet).toEqual({});
    setup(npc(fresh.data.sheet as Record<string, unknown>));
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
  });
});

describe('NpcSheetModal — guardar', () => {
  /**
   * NO se guarda solo, a diferencia de la ficha de un PJ. Ésta es una ventana que el director abre y
   * cierra: un guardado automático dentro de un modal le deja sin saber si lo que tocó quedó guardado.
   */
  it('guarda la ficha dentro de la entrada del bestiario', async () => {
    const { onSave } = setup(npc({ combat: { value: 4 } }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ sheet: { combat: { value: 4 } } }),
    })));
  });

  it('el nombre de la ficha manda sobre el del listado: un PNJ no puede tener dos', async () => {
    const { onSave } = setup(npc({ name: 'Padre Vidal el Viejo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Padre Vidal el Viejo' })));
  });

  it('un nombre en blanco dentro de la ficha no borra el que tenía', async () => {
    const { onSave } = setup(npc({ name: '   ' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Padre Vidal' })));
  });

  /** Una entrada guardada «para todas mis campañas» no puede caer en una sola por editar su ficha. */
  it('un PNJ global sigue siendo global después de guardar', async () => {
    const { onSave } = setup(npc({}, { campaignId: null }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ campaignId: null })));
  });

  it('si guardar falla se dice y la ficha no se cierra', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('sin permiso'));
    const { onClose } = setup(npc(), { onSave });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('sin permiso');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('avisa de que los cambios no se guardan solos', () => {
    setup();
    expect(screen.getByText(/NO se guardan solos/)).toBeInTheDocument();
  });
});

describe('gameValuesOf — los números de un PNJ salen de SU ficha', () => {
  /**
   * Un PNJ no tiene Aguante suelto: su Resistencia sale de la ficha, y quien sabe leerla es el motor del
   * sistema. Si se calculara con `Aguante × 3` como una criatura, todos los PNJ saldrían con Resistencia 0.
   */
  it('un PNJ usa el motor del sistema, no Aguante × 3', () => {
    const derive = vi.fn().mockReturnValue({ resistance: 21, protection: 2 });
    expect(gameValuesOf(npc({ fortitude: { value: 4 } }), derive)).toEqual({ resistance: 21, protection: 2 });
    expect(derive).toHaveBeenCalledWith({ fortitude: { value: 4 } });
  });

  it('una criatura NO pasa por el motor de fichas: es Aguante × 3', () => {
    const derive = vi.fn();
    const ogre = npc({}, { origin: 'manual', data: { stats: {}, endurance: 10, destiny: 0, protection: 3, abilities: [], specialties: {} } });
    expect(gameValuesOf(ogre, derive)).toEqual({ resistance: 30, protection: 3 });
    expect(derive).not.toHaveBeenCalled();
  });

  it('si el motor no da un número, se cae al valor de la entrada en vez de pintar basura', () => {
    const derive = vi.fn().mockReturnValue({ resistance: null, protection: undefined });
    const e = npc({}, { data: { stats: {}, endurance: 5, destiny: 0, protection: 1, abilities: [], specialties: {}, sheet: {} } });
    expect(gameValuesOf(e, derive)).toEqual({ resistance: 15, protection: 1 });
  });
});
