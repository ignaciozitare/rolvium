import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '../../../../tests/helpers/render';
import { plenilunio } from '@rolvium/system-plenilunio';
import { CreatureRollPopover } from './CreatureRollPopover';
import type { BestiaryEntry } from '../domain/entities/BestiaryEntry';

const ogre = (over: Partial<BestiaryEntry> = {}): BestiaryEntry => ({
  id: 'be-1', origin: 'custom', name: 'Ogro con antorcha', notes: '', tokenUrl: null, sourceRef: 'ogre',
  campaignId: 'c1', editable: true,
  data: {
    // Sin Cultura a propósito: el manual deja características sin publicar y eso NO es 0.
    stats: { fortitude: 8, combat: 4 }, endurance: 10, destiny: 0, protection: 3,
    abilities: [], specialties: { combat: ['ogre.club'] }, page: 152,
  },
  ...over,
});

const setup = (entry = ogre(), over: Record<string, unknown> = {}) => {
  const onRoll = vi.fn().mockResolvedValue({ id: 'r-1' });
  const onClose = vi.fn();
  renderWithProviders(
    <CreatureRollPopover entry={entry} system={plenilunio} specialtyLabel={(id: string) => id}
                         onRoll={onRoll} onClose={onClose} {...over} />,
  );
  return { onRoll, onClose };
};

const lastRequest = (onRoll: ReturnType<typeof vi.fn>) => onRoll.mock.calls.at(-1)?.[0];

beforeEach(() => vi.clearAllMocks());

describe('CreatureRollPopover — tirar por la criatura, no abrir el lanzador libre', () => {
  it('sólo ofrece las características que el manual publica de esa criatura', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Fortaleza' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Combate' })).toBeInTheDocument();
    // Cultura no está en el bloque: ausente no es 0, y no se tira por lo que no está escrito.
    expect(screen.queryByRole('button', { name: 'Cultura' })).not.toBeInTheDocument();
  });

  it('enseña cuántos dados salen ANTES de tirar, y de dónde vienen', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Combate' }));
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText(/su Combate 4/)).toBeInTheDocument();
  });

  it('los dados extra suben la cuenta que se enseña', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Combate' }));
    await userEvent.click(screen.getByRole('button', { name: 'Un dado más' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('5'));
  });

  it('ofrece la especialidad de ESA criatura y sólo cuando la tiene', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Combate' }));
    expect(screen.getByLabelText(/ogre.club/)).toBeInTheDocument();
    // Fortaleza no tiene especialidad en este bloque: no se ofrece la casilla.
    await userEvent.click(screen.getByRole('button', { name: 'Fortaleza' }));
    expect(screen.queryByLabelText(/ogre.club/)).not.toBeInTheDocument();
  });

  it('manda la tirada con la característica, la especialidad, la dificultad y la visibilidad', async () => {
    const { onRoll, onClose } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Combate' }));
    await userEvent.click(screen.getByLabelText(/ogre.club/));
    await userEvent.click(screen.getByRole('button', { name: /Difícil · 3/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Secreta' }));
    await userEvent.click(screen.getByRole('button', { name: /^Tirar/ }));

    await waitFor(() => expect(onRoll).toHaveBeenCalledOnce());
    const req = lastRequest(onRoll);
    expect(req.options.specialty).toBe(true);
    expect(req.groups.find((g: { tag?: string }) => g.tag === 'opposition').count).toBe(3);
    expect(req.visibility).toBe('secret');
    expect(req.title).toBe('Ogro con antorcha · Combate');
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  /** Cambiar de característica tiene que soltar la especialidad: el garrote no sirve para esquivar. */
  it('al cambiar de característica desmarca la especialidad anterior', async () => {
    const { onRoll } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Combate' }));
    await userEvent.click(screen.getByLabelText(/ogre.club/));
    await userEvent.click(screen.getByRole('button', { name: 'Fortaleza' }));
    await userEvent.click(screen.getByRole('button', { name: /^Tirar/ }));

    await waitFor(() => expect(onRoll).toHaveBeenCalledOnce());
    expect(lastRequest(onRoll).options.specialty).toBe(false);
  });

  it('si el servidor no puede tirar, lo dice y NO se cierra', async () => {
    const onRoll = vi.fn().mockResolvedValue(null);
    const onClose = vi.fn();
    renderWithProviders(
      <CreatureRollPopover entry={ogre()} system={plenilunio} specialtyLabel={(id: string) => id}
                           onRoll={onRoll} onClose={onClose} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /^Tirar/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/No se ha podido tirar/);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('una criatura sin ninguna característica publicada lo dice en vez de ofrecer una tirada vacía', () => {
    setup(ogre({ data: { stats: {}, endurance: 0, destiny: 0, protection: 0, abilities: [], specialties: {} } }));
    expect(screen.getByText(/no publica ninguna característica/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Tirar/ })).not.toBeInTheDocument();
  });
});

/**
 * Tanda 3 del bestiario (`.pen` «Bestiario/Tirar por una criatura»): los ataques que imprime la caja, la
 * casilla de noche, las capacidades marcables y la Deflagración. El ejemplo es Baal (p.126), el único
 * bloque del libro que trae de todo.
 */
const baal = (over: Partial<BestiaryEntry['data']> = {}): BestiaryEntry => ogre({
  id: 'be-2', name: 'Baal',
  data: {
    stats: { fortitude: 7, combat: 8, will: 5, cunning: 4, subtlety: 5, presence: 3, culture: 8 },
    endurance: 12, destiny: 9, protection: 0, page: 126,
    abilities: ['Alado', 'Aura sombría 5', 'Piel de humano', 'Amparo de la noche 3', 'Deflagración 5'],
    capabilities: [{ id: 'winged' }, { id: 'darkAura', level: 5 }, { id: 'humanSkin' }, { id: 'nightShelter', level: 3 }, { id: 'blast', level: 5 }],
    attacks: [{ label: 'catalog.creatureAttacks.espadaOriental', attack: 9, damage: 10 }],
    specialties: { combat: ['creature.espadasSamurais'] },
    ...over,
  },
});

describe('CreatureRollPopover — los ataques del bloque', () => {
  it('ofrece los ataques impresos y tira SUS dados, no los de la característica', async () => {
    const { onRoll } = setup(baal());
    await userEvent.click(screen.getByRole('button', { name: /Espada oriental · 9 · daño 10/ }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('9'));
    expect(screen.getByText(/su ataque Espada oriental · 9/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tirar 9' }));
    const req = lastRequest(onRoll);
    // 9 dados: su Combate 8 más la bonificación del arma, que es la diferencia con el ataque impreso.
    expect(req.groups.find((g: { tag: string }) => g.tag === 'own').count).toBe(9);
    expect(req.options.weaponDamage).toBe(10);
    expect(req.options.weaponId).toBe('catalog.creatureAttacks.espadaOriental');
  });

  it('«a mano» vuelve a los dados de su Combate', async () => {
    setup(baal());
    await userEvent.click(screen.getByRole('button', { name: /Espada oriental/ }));
    await userEvent.click(screen.getByRole('button', { name: 'A mano · 8' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('8'));
  });

  it('una criatura sin ataques impresos no enseña la fila', () => {
    setup(ogre());
    expect(screen.queryByText('¿Con qué ataca?')).not.toBeInTheDocument();
  });
});

describe('CreatureRollPopover — las capacidades (p.107–108)', () => {
  it('la casilla de noche sólo sale si alguna capacidad depende de la hora', () => {
    setup(baal());
    expect(screen.getByLabelText(/Es de noche/)).toBeInTheDocument();
  });

  it('de día no ofrece ninguna capacidad nocturna; de noche sí, con sus éxitos automáticos', async () => {
    setup(baal());
    await userEvent.click(screen.getByRole('button', { name: 'Combate' }));
    expect(screen.queryByText(/Amparo de la noche/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/Es de noche/));
    expect(screen.getByLabelText(/Amparo de la noche 3/)).toBeInTheDocument();
    expect(screen.getByText('+3 éxitos automáticos')).toBeInTheDocument();
  });

  it('marcada, la capacidad viaja en la tirada con su nombre', async () => {
    const { onRoll } = setup(baal());
    await userEvent.click(screen.getByRole('button', { name: 'Combate' }));
    await userEvent.click(screen.getByLabelText(/Es de noche/));
    await userEvent.click(screen.getByLabelText(/Amparo de la noche 3/));
    await userEvent.click(screen.getByRole('button', { name: /^Tirar/ }));
    expect(lastRequest(onRoll).options).toMatchObject({ autoSuccesses: 3, autoSuccessFrom: 'nightShelter', night: true });
  });

  /** Amparo de la noche es del Combate: al cambiar de característica deja de contar, aunque siga marcada. */
  it('lo marcado deja de contar cuando ya no encaja con la característica', async () => {
    const { onRoll } = setup(baal());
    await userEvent.click(screen.getByRole('button', { name: 'Combate' }));
    await userEvent.click(screen.getByLabelText(/Es de noche/));
    await userEvent.click(screen.getByLabelText(/Amparo de la noche 3/));
    await userEvent.click(screen.getByRole('button', { name: 'Voluntad' }));
    expect(screen.queryByText('Capacidades que podrían aplicar')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Tirar/ }));
    expect(lastRequest(onRoll).options.autoSuccesses).toBe(0);
  });
});

describe('CreatureRollPopover — la Deflagración', () => {
  it('no se tira con característica, y los dados bajan un dado por metro', async () => {
    const { onRoll } = setup(baal());
    await userEvent.click(screen.getByRole('button', { name: 'Deflagración · 5' }));
    await waitFor(() => expect(screen.getByText(/no se tira con ninguna característica/)).toBeInTheDocument());
    // Con la Deflagración elegida hay DOS contadores: primero los metros y debajo los dados.
    const dados = () => screen.getAllByRole('status')[1];
    expect(dados()).toHaveTextContent('5');
    await userEvent.click(screen.getByRole('button', { name: 'Un metro más' }));
    await userEvent.click(screen.getByRole('button', { name: 'Un metro más' }));
    await waitFor(() => expect(dados()).toHaveTextContent('3'));
    await userEvent.click(screen.getByRole('button', { name: 'Tirar 3' }));
    const req = lastRequest(onRoll);
    expect(req.groups.find((g: { tag: string }) => g.tag === 'own').count).toBe(3);
    // Reto a dificultad 1 (p.108), y el daño por triunfo es la puntuación.
    expect(req.options).toMatchObject({ difficulty: 1, weaponDamage: 5, blastLevel: 5, blastMetres: 2 });
    expect(req.title).toContain('Deflagración');
  });

  it('fuera del radio no hay ataque: 0 dados', async () => {
    setup(baal());
    await userEvent.click(screen.getByRole('button', { name: 'Deflagración · 5' }));
    for (let i = 0; i < 6; i++) await userEvent.click(screen.getByRole('button', { name: 'Un metro más' }));
    await waitFor(() => expect(screen.getAllByRole('status')[1]).toHaveTextContent('0'));
  });

  it('una criatura sin Deflagración no la ofrece', () => {
    setup(baal({ capabilities: [{ id: 'winged' }], attacks: [], stats: { combat: 8 }, endurance: 12, destiny: 9, protection: 0, abilities: [], specialties: {}, page: 126 }));
    expect(screen.queryByText(/Deflagración/)).not.toBeInTheDocument();
  });
});
