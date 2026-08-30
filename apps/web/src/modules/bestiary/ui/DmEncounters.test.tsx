import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor, fireEvent, within } from '../../../../tests/helpers/render';
import { plenilunio } from '@rolvium/system-plenilunio';
import { fakeMapsRepo, PLAYER_USER, SCENE_WAREHOUSE, TOKEN_KAREN, TOKEN_MUTANT } from '../../../../tests/helpers/fakes';
import { DmEncounters } from './DmEncounters';

/** El ogro del catálogo (p.152), pegado a Karen: hueco 0 → cuerpo a cuerpo. */
const tokenOgro = { ...TOKEN_MUTANT, id: 'tk-ogro', bestiaryRef: 'ogre', name: 'Ogro', visible: true, x: TOKEN_KAREN.x + 1, y: TOKEN_KAREN.y, state: {} };
const tokenMutante = { ...TOKEN_MUTANT, id: 'tk-mut2', name: 'Mutante', visible: true, x: TOKEN_KAREN.x + 3, y: TOKEN_KAREN.y };

const setup = (over: { tokens?: (typeof tokenOgro)[]; activeSceneId?: string | null } = {}) => {
  const repo = fakeMapsRepo({ scenes: [SCENE_WAREHOUSE], tokens: (over.tokens ?? [TOKEN_KAREN, tokenOgro]) as never });
  const onRoll = vi.fn().mockResolvedValue({ id: 'r-1' });
  const onOpenAttack = vi.fn().mockResolvedValue({ id: 'atk-1' });
  const onOpenBestiary = vi.fn();
  renderWithProviders(
    <DmEncounters system={plenilunio} maps={repo} campaignId="c1" activeSceneId={over.activeSceneId === undefined ? 'sc-1' : over.activeSceneId}
                  extraEncounters={[]} onRoll={onRoll} onOpenAttack={onOpenAttack} onOpenBestiary={onOpenBestiary} />,
  );
  return { repo, onRoll, onOpenAttack, onOpenBestiary };
};

beforeEach(() => vi.clearAllMocks());

describe('DmEncounters — «Encuentros en la escena» del panel (.pen columna 4)', () => {
  it('nace COLAPSADA con el número, y desplegada enseña la fila con su bloque', async () => {
    setup();
    const head = await screen.findByRole('button', { name: /Encuentros en la escena · 1/ });
    expect(head).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Ogro')).not.toBeInTheDocument();
    await userEvent.setup().click(head);
    expect(await screen.findByText('Ogro')).toBeInTheDocument();
    expect(screen.getByText(/Resistencia 30 · protección 3 · p\.152/)).toBeInTheDocument();
  });

  it('al desplegar una criatura se cierra la anterior', async () => {
    const u = userEvent.setup();
    setup({ tokens: [TOKEN_KAREN, tokenOgro, tokenMutante] as never });
    await u.click(await screen.findByRole('button', { name: /Encuentros en la escena · 2/ }));
    await u.click(screen.getByRole('button', { name: 'Desplegar Ogro' }));
    expect(screen.getByRole('group', { name: 'Otras tiradas' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Desplegar Mutante' }));
    // sólo un desplegado a la vez: el grupo de chips que queda es el del mutante
    expect(screen.getAllByRole('group', { name: 'Otras tiradas' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Desplegar Ogro' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('renombrar en la fila guarda el mote en el token y la línea de abajo conserva el bloque', async () => {
    const u = userEvent.setup();
    const { repo } = setup();
    await u.click(await screen.findByRole('button', { name: /Encuentros en la escena/ }));
    await u.click(screen.getAllByRole('button', { name: 'Renombrar' })[0]!);
    const input = screen.getByRole('textbox', { name: 'Renombrar' });
    await u.clear(input);
    await u.type(input, 'El de la puerta');
    await u.click(screen.getAllByRole('button', { name: 'Renombrar' })[0]!);
    await waitFor(() => expect(repo.tokenUpdates.at(-1)).toEqual({ id: 'tk-ogro', patch: { name: 'El de la puerta' } }));
    expect(screen.getByText('El de la puerta')).toBeInTheDocument();
    expect(screen.getByText(/Ogro · Resistencia 30/)).toBeInTheDocument();
  });

  it('los chips de «otras tiradas» tiran por la criatura con la dificultad del mantener-pulsado', async () => {
    const u = userEvent.setup();
    const { onRoll } = setup();
    await u.click(await screen.findByRole('button', { name: /Encuentros en la escena/ }));
    await u.click(screen.getByRole('button', { name: 'Desplegar Ogro' }));
    fireEvent.pointerDown(within(screen.getByRole('group', { name: 'Otras tiradas' })).getByRole('button', { name: 'Fortaleza' }));
    await u.click(await screen.findByRole('menuitem', { name: 'Media · 2' }));
    await waitFor(() => expect(onRoll).toHaveBeenCalled());
    const req = onRoll.mock.calls.at(-1)![0] as { options?: Record<string, unknown>; groups: { tag?: string; count: number }[] };
    expect(req.options).toMatchObject({ stat: 'fortitude', difficulty: 2 });
    // el ogro tira con SU Fortaleza (8), no con nada del panel
    expect(req.groups.find(g => g.tag === 'own')?.count).toBe(8);
  });

  it('ATACAR abre el modal del token y cuerpo a cuerpo abre el ataque A LA ESPERA con la escena puesta', async () => {
    const u = userEvent.setup();
    const { onOpenAttack, onRoll } = setup();
    await u.click(await screen.findByRole('button', { name: /Encuentros en la escena/ }));
    await u.click(screen.getByRole('button', { name: 'Atacar' }));
    const modal = await screen.findByRole('dialog', { name: 'Atacar con Ogro' });
    await u.click(within(modal).getByRole('button', { name: /^Atacar a Karen/ }));
    await waitFor(() => expect(onOpenAttack).toHaveBeenCalled());
    expect(onOpenAttack.mock.calls[0]![0]).toMatchObject({
      sceneId: 'sc-1', attackerTokenId: 'tk-ogro', attackerName: 'Ogro', targetCharacterId: TOKEN_KAREN.characterId,
    });
    expect(onRoll).not.toHaveBeenCalled();
  });

  it('«+ Añadir» lleva al Bestiario, y sin escena activa la sección no pinta nada', async () => {
    const u = userEvent.setup();
    const { onOpenBestiary } = setup();
    await u.click(await screen.findByRole('button', { name: /Encuentros en la escena/ }));
    await u.click(screen.getByRole('button', { name: '+ Añadir' }));
    expect(onOpenBestiary).toHaveBeenCalled();
  });
});
