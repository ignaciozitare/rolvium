import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '../../../../tests/helpers/render';
import { plenilunio } from '@rolvium/system-plenilunio';
import { TokenAttackModal, type AttackTarget } from './TokenAttackModal';
import type { BestiaryEntry } from '../domain/entities/BestiaryEntry';

/** El ogro (p.152): Fortaleza 8, Combate 4, protección 3 y sin ataque impreso — pega sin armas. */
const ogre = (over: Partial<BestiaryEntry['data']> = {}): BestiaryEntry => ({
  id: 'ogre', origin: 'manual', name: 'Ogro', notes: '', tokenUrl: null, sourceRef: null,
  campaignId: null, editable: false,
  data: {
    stats: { fortitude: 8, combat: 4, will: 1 }, endurance: 10, destiny: 0, protection: 3, page: 152,
    abilities: [], capabilities: [], attacks: [], specialties: {}, ...over,
  },
});

/** 1 casilla = 1,5 m (METRES_PER_CELL). La distancia la mide el mapa: aquí llega ya medida. */
const karen: AttackTarget = { id: 'tk-1', name: 'Karen', cells: 2, metres: 3 };
const nix: AttackTarget = { id: 'tk-2', name: 'Nix', cells: 14, metres: 21 };

const setup = (entry = ogre(), targets: AttackTarget[] = [karen, nix]) => {
  const onAttack = vi.fn().mockResolvedValue({ id: 'r-1' });
  const onClose = vi.fn();
  renderWithProviders(
    <TokenAttackModal entry={entry} system={plenilunio} targets={targets} onAttack={onAttack} onClose={onClose} />,
  );
  return { onAttack, onClose };
};
const lastRequest = (onAttack: ReturnType<typeof vi.fn>) => onAttack.mock.calls.at(-1)?.[0];

beforeEach(() => vi.clearAllMocks());

describe('TokenAttackModal — atacar con el token de una criatura', () => {
  it('enseña de quién es el token y sus valores de juego', () => {
    setup();
    expect(screen.getByText('Ogro')).toBeInTheDocument();
    expect(screen.getByText(/Combate 4 · Resistencia 30 · protección 3/)).toBeInTheDocument();
    expect(screen.getByText(/p\.152/)).toBeInTheDocument();
  });

  it('ofrece a los personajes de la escena y dice a qué distancia está el elegido', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Karen' })).toBeInTheDocument();
    expect(screen.getByText(/Karen está a 2 casillas: cuerpo a cuerpo/)).toBeInTheDocument();
  });

  it('a distancia dice el alcance y contra qué dificultad se tira (p.96)', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Nix' }));
    expect(await screen.findByText(/Nix está a 14 casillas \(21 m\): alcance medio, reto a dificultad 3/)).toBeInTheDocument();
  });

  it('los dados salen de su Combate y los reparte el director (p.94)', async () => {
    const { onAttack } = setup();
    expect(screen.getByRole('status')).toHaveTextContent('4');
    await userEvent.click(screen.getByRole('button', { name: 'Un dado menos' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('3'));
    await userEvent.click(screen.getByRole('button', { name: 'Atacar a Karen' }));
    expect(lastRequest(onAttack).groups.find((g: { tag: string }) => g.tag === 'own').count).toBe(3);
  });

  it('cuerpo a cuerpo va sin oposición; un disparo lleva la dificultad del alcance', async () => {
    const { onAttack } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Atacar a Karen' }));
    expect(lastRequest(onAttack).groups.some((g: { tag: string }) => g.tag === 'opposition')).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Nix' }));
    await userEvent.click(screen.getByRole('button', { name: 'Atacar a Nix' }));
    expect(lastRequest(onAttack).groups.find((g: { tag: string }) => g.tag === 'opposition').count).toBe(3);
  });

  it('la tirada dice quién ataca a quién, y el daño de un puñetazo es su Fortaleza (p.97)', async () => {
    const { onAttack, onClose } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Atacar a Karen' }));
    const req = lastRequest(onAttack);
    expect(req.title).toBe('Ogro ataca a Karen');
    expect(req.options).toMatchObject({ weaponId: 'catalog.weapons.unarmed', weaponDamage: 8 });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('con ataque impreso arranca con SUS dados y lleva su daño', async () => {
    const { onAttack } = setup(ogre({ attacks: [{ label: 'catalog.creatureAttacks.mandoble', attack: 11, damage: 12 }] }));
    expect(screen.getByRole('status')).toHaveTextContent('11');
    await userEvent.click(screen.getByRole('button', { name: 'Atacar a Karen' }));
    expect(lastRequest(onAttack).options).toMatchObject({ weaponDamage: 12 });
  });

  it('más lejos del alcance muy largo no se puede disparar', async () => {
    setup(ogre(), [{ id: 'tk-3', name: 'Lejos', cells: 700, metres: 1050 }]);
    expect(screen.getByText(/demasiado lejos para dispararle/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Atacar a Lejos' })).toBeDisabled();
  });

  it('sin nadie en la escena lo dice en vez de ofrecer un ataque vacío', () => {
    setup(ogre(), []);
    expect(screen.getByText(/No hay ningún personaje en la escena/)).toBeInTheDocument();
  });

  it('si el servidor no puede tirar, lo dice y NO se cierra', async () => {
    const onAttack = vi.fn().mockResolvedValue(null);
    const onClose = vi.fn();
    renderWithProviders(<TokenAttackModal entry={ogre()} system={plenilunio} targets={[karen]} onAttack={onAttack} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Atacar a Karen' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
