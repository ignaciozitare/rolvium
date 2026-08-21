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
const karen: AttackTarget = { id: 'tk-1', name: 'Karen', cells: 2, metres: 3, characterId: 'ch-karen' };
const nix: AttackTarget = { id: 'tk-2', name: 'Nix', cells: 14, metres: 21, characterId: 'ch-nix' };

const setup = (entry = ogre(), targets: AttackTarget[] = [karen, nix], night = false) => {
  const onAttack = vi.fn().mockResolvedValue({ id: 'r-1' });
  const onOpenAttack = vi.fn().mockResolvedValue({ id: 'atk-1' });
  const onClose = vi.fn();
  renderWithProviders(
    <TokenAttackModal entry={entry} system={plenilunio} targets={targets} night={night}
                      onAttack={onAttack} onOpenAttack={onOpenAttack} onClose={onClose} />,
  );
  return { onAttack, onOpenAttack, onClose };
};

/** El lunar (p.120): de noche, su Amparo de la noche 2 le añade éxitos automáticos al Combate. */
const lunar = () => ogre({
  stats: { fortitude: 7, combat: 6, will: 3 },
  capabilities: [{ id: 'winged' }, { id: 'darkAura', level: 2 }, { id: 'nightShelter', level: 2 }],
});
const lastRequest = (onAttack: ReturnType<typeof vi.fn>) => onAttack.mock.calls.at(-1)?.[0];
/** Cuerpo a cuerpo no tira: abre un ataque a la espera, y la petición viaja dentro (p.93). */
const lastPending = (onOpenAttack: ReturnType<typeof vi.fn>) => onOpenAttack.mock.calls.at(-1)?.[0];
const lastPendingRequest = (onOpenAttack: ReturnType<typeof vi.fn>) => lastPending(onOpenAttack)?.request;

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
    const { onOpenAttack } = setup();
    expect(screen.getByRole('status')).toHaveTextContent('4');
    await userEvent.click(screen.getByRole('button', { name: 'Un dado menos' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('3'));
    await userEvent.click(screen.getByRole('button', { name: 'Atacar a Karen' }));
    expect(lastPendingRequest(onOpenAttack).groups.find((g: { tag: string }) => g.tag === 'own').count).toBe(3);
    expect(lastPending(onOpenAttack).dice).toBe(3);
  });

  /**
   * Cuerpo a cuerpo es un CONFLICTO (p.93): la tirada no sale aquí, se abre un ataque a la espera y los
   * dados de enfrente los pone el jugador al defenderse. Un disparo es un reto y sale en el acto (p.96).
   */
  it('cuerpo a cuerpo NO tira: abre el ataque y espera al jugador', async () => {
    const { onAttack, onOpenAttack, onClose } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Atacar a Karen' }));
    expect(onAttack).not.toHaveBeenCalled();
    expect(lastPending(onOpenAttack)).toMatchObject({ targetTokenId: 'tk-1', targetCharacterId: 'ch-karen', dice: 4 });
    expect(lastPendingRequest(onOpenAttack).groups.some((g: { tag: string }) => g.tag === 'opposition')).toBe(false);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('y lo dice antes de pulsar, para que el director sepa que la tirada no sale ahora', () => {
    setup();
    expect(screen.getByText(/le llegará el aviso y la tirada saldrá cuando conteste/)).toBeInTheDocument();
  });

  it('un disparo sí tira en el acto, con la dificultad del alcance (p.96)', async () => {
    const { onAttack, onOpenAttack } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Nix' }));
    await userEvent.click(screen.getByRole('button', { name: 'Atacar a Nix' }));
    expect(onOpenAttack).not.toHaveBeenCalled();
    expect(lastRequest(onAttack).groups.find((g: { tag: string }) => g.tag === 'opposition').count).toBe(3);
    expect(screen.queryByText(/le llegará el aviso/)).not.toBeInTheDocument();
  });

  it('el ataque dice quién ataca a quién, y el daño de un puñetazo es su Fortaleza (p.97)', async () => {
    const { onOpenAttack, onClose } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Atacar a Karen' }));
    const req = lastPendingRequest(onOpenAttack);
    expect(req.title).toBe('Ogro ataca a Karen');
    expect(req.options).toMatchObject({ weaponId: 'catalog.weapons.unarmed', weaponDamage: 8 });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('con ataque impreso arranca con SUS dados y lleva su daño', async () => {
    const { onOpenAttack } = setup(ogre({ attacks: [{ label: 'catalog.creatureAttacks.mandoble', attack: 11, damage: 12 }] }));
    expect(screen.getByRole('status')).toHaveTextContent('11');
    await userEvent.click(screen.getByRole('button', { name: 'Atacar a Karen' }));
    expect(lastPendingRequest(onOpenAttack).options).toMatchObject({ weaponDamage: 12 });
  });

  it('más lejos del alcance muy largo no se puede disparar', async () => {
    setup(ogre(), [{ id: 'tk-3', name: 'Lejos', cells: 700, metres: 1050, characterId: 'ch-lejos' }]);
    expect(screen.getByText(/demasiado lejos para dispararle/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Atacar a Lejos' })).toBeDisabled();
  });

  it('sin nadie en la escena lo dice en vez de ofrecer un ataque vacío', () => {
    setup(ogre(), []);
    expect(screen.getByText(/No hay ningún personaje en la escena/)).toBeInTheDocument();
  });

  it('si no se puede avisar al jugador, lo dice y NO se cierra', async () => {
    const onOpenAttack = vi.fn().mockResolvedValue(null);
    const onClose = vi.fn();
    renderWithProviders(<TokenAttackModal entry={ogre()} system={plenilunio} targets={[karen]}
                                          onAttack={vi.fn()} onOpenAttack={onOpenAttack} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Atacar a Karen' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/No se ha podido avisar al jugador/);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('si el servidor no puede tirar un disparo, lo dice y NO se cierra', async () => {
    const onAttack = vi.fn().mockResolvedValue(null);
    const onClose = vi.fn();
    renderWithProviders(<TokenAttackModal entry={ogre()} system={plenilunio} targets={[nix]}
                                          onAttack={onAttack} onOpenAttack={vi.fn()} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Atacar a Nix' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  /**
   * La hora NO se pregunta aquí: la dice el interruptor de día/noche del mapa (dueño, 2026-08-21). De ella
   * dependen las capacidades nocturnas, que son las que hacen que una criatura pegue distinto de noche.
   */
  it('de noche ofrece sus capacidades nocturnas; de día no', async () => {
    setup(lunar(), [karen], true);
    expect(screen.getByLabelText(/Amparo de la noche 2/)).toBeInTheDocument();
    expect(screen.getByText('+2 éxitos automáticos')).toBeInTheDocument();
    expect(screen.getByText(/Es de noche en esta escena/)).toBeInTheDocument();
  });

  it('de día no sale ninguna nocturna, y no hay casilla que marcar', () => {
    setup(lunar(), [karen], false);
    expect(screen.queryByText(/Amparo de la noche/)).not.toBeInTheDocument();
    expect(screen.queryByText('Capacidades que podrían aplicar')).not.toBeInTheDocument();
  });

  it('la capacidad marcada viaja en el ataque con su nombre', async () => {
    const { onOpenAttack } = setup(lunar(), [karen], true);
    await userEvent.click(screen.getByLabelText(/Amparo de la noche 2/));
    await userEvent.click(screen.getByRole('button', { name: 'Atacar a Karen' }));
    expect(lastPendingRequest(onOpenAttack).options).toMatchObject({ autoSuccesses: 2, autoSuccessFrom: 'nightShelter' });
  });

  it('sin marcarla no suma nada: no se aplica sola (p.107)', async () => {
    const { onOpenAttack } = setup(lunar(), [karen], true);
    await userEvent.click(screen.getByRole('button', { name: 'Atacar a Karen' }));
    expect(lastPendingRequest(onOpenAttack).options.autoSuccesses).toBe(0);
  });
});
