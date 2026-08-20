import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor, within } from '../../../../tests/helpers/render';
import { plenilunio } from '@rolvium/system-plenilunio';
import { BestiaryTab } from './BestiaryTab';
import type { BestiaryPort } from '../domain/ports/BestiaryPort';
import type { BestiaryEntry } from '../domain/entities/BestiaryEntry';

const own = (over: Partial<BestiaryEntry> = {}): BestiaryEntry => ({
  id: 'be-1', origin: 'custom', name: 'Ogro con antorcha', notes: 'Prende lo que toca',
  tokenUrl: null, sourceRef: 'ogre', campaignId: 'c1', editable: true,
  data: { stats: { fortitude: 8, combat: 4 }, endurance: 10, destiny: 0, protection: 3, abilities: [], specialties: { combat: ['creature.garrote'] }, page: 152 },
  ...over,
});

const makeRepo = (entries: BestiaryEntry[] = [own()]): BestiaryPort => ({
  listForCampaign: vi.fn().mockResolvedValue(entries),
  create: vi.fn().mockImplementation(async (i) => own({ id: 'be-new', name: i.name, campaignId: i.campaignId })),
  update: vi.fn().mockImplementation(async (id, p) => own({ id, ...p })),
  remove: vi.fn().mockResolvedValue(undefined),
  uploadToken: vi.fn().mockResolvedValue('https://x/t.webp'),
});

const setup = (repo: BestiaryPort = makeRepo(), props = {}) =>
  renderWithProviders(<BestiaryTab campaignId="c1" system={plenilunio} repo={repo} {...props} />);

/**
 * Busca la ficha por su título. Espera primero al encabezado porque las del manual pintan al instante
 * —vienen del paquete del sistema— y las propias llegan después, de la base.
 */
const cardOf = async (name: string): Promise<HTMLElement> => {
  const heading = await screen.findByRole('heading', { name });
  return heading.closest('article') as HTMLElement;
};

beforeEach(() => vi.clearAllMocks());

describe('BestiaryTab — el listado une las dos fuentes', () => {
  /**
   * Lo que más se puede romper sin ruido: que el catálogo del manual deje de aparecer y el director sólo vea
   * lo suyo. Son 45 bloques que vienen del paquete del sistema, no de la base.
   */
  it('enseña las criaturas del manual junto a las propias', async () => {
    setup();
    expect(await screen.findByRole('heading', { name: 'Ogro' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ogro con antorcha' })).toBeInTheDocument();
    expect(screen.getByText(/45 del manual/)).toBeInTheDocument();
  });

  it('pide sólo las entradas de esta campaña y este sistema', async () => {
    const repo = makeRepo();
    setup(repo);
    await waitFor(() => expect(repo.listForCampaign).toHaveBeenCalledWith('c1', plenilunio.id));
  });

  it('la Resistencia se calcula, no se lee de la fila', async () => {
    setup();
    const card = await cardOf('Ogro');
    expect(within(card).getByText(/Resistencia 30/)).toBeInTheDocument();   // Aguante 10 × 3 (p.25)
  });

  it('avisa de que esto no lo ve ningún jugador', async () => {
    setup();
    expect(await screen.findByText('SOLO DIRECTOR')).toBeInTheDocument();
  });
});

describe('BestiaryTab — buscar y filtrar', () => {
  it('el buscador no distingue acentos ni mayúsculas', async () => {
    setup();
    await screen.findByRole('heading', { name: 'Arpía' });
    await userEvent.type(screen.getByRole('searchbox'), 'arpia');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Arpía' })).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Ogro' })).not.toBeInTheDocument();
  });

  it('el filtro «Propios» deja fuera las del manual', async () => {
    setup();
    await screen.findByRole('heading', { name: 'Ogro' });
    await userEvent.click(screen.getByRole('button', { name: 'Propios' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Ogro' })).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Ogro con antorcha' })).toBeInTheDocument();
  });

  it('sin resultados sale un vacío con explicación, no una rejilla en blanco', async () => {
    setup();
    await screen.findByRole('heading', { name: 'Ogro' });
    await userEvent.type(screen.getByRole('searchbox'), 'zzzz');
    expect(await screen.findByText('Ninguna criatura coincide')).toBeInTheDocument();
  });
});

describe('BestiaryTab — las del manual no se editan', () => {
  /**
   * Regla del spec: un bloque del libro no se toca. El botón dice DUPLICAR y al pulsarlo se crea una copia
   * propia, que es la que se abre para editar. Si esto se rompiera, el director creería estar cambiando el
   * manual.
   */
  it('en una criatura del manual el botón duplica y abre la copia', async () => {
    const repo = makeRepo();
    setup(repo);
    const card = await cardOf('Ogro');
    await userEvent.click(within(card).getByRole('button', { name: 'Duplicar' }));

    await waitFor(() => expect(repo.create).toHaveBeenCalled());
    const arg = (repo.create as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(arg).toMatchObject({ origin: 'custom', sourceRef: 'ogre', systemId: plenilunio.id });
    expect(arg.name).toMatch(/^Ogro \(\d+\)$/);
  });

  it('en una entrada propia el botón edita y abre su ficha', async () => {
    setup();
    const card = await cardOf('Ogro con antorcha');
    await userEvent.click(within(card).getByRole('button', { name: 'Editar' }));
    expect(await screen.findByRole('heading', { name: 'Ficha del encuentro' })).toBeInTheDocument();
  });
});

describe('BestiaryTab — los PNJ aliados con ficha completa', () => {
  const NPC = own({ id: 'be-npc', origin: 'npc', name: 'Padre Vidal',
    data: { stats: {}, endurance: 0, destiny: 0, protection: 0, abilities: [], specialties: {}, sheet: { name: 'Padre Vidal' } } });

  /**
   * Un aliado abre la ficha COMPLETA de personaje, no el formulario de criatura: tiene dones, armas y
   * equipo. Abrirle el de criatura le daría siete números sueltos y ningún sitio donde poner su escopeta.
   */
  it('un PNJ abre la ficha de personaje, no la de encuentro', async () => {
    setup(makeRepo([NPC]));
    const card = await cardOf('Padre Vidal');
    await userEvent.click(within(card).getByRole('button', { name: 'Editar' }));
    expect(await screen.findByRole('heading', { name: /Ficha de Padre Vidal/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ficha del encuentro' })).not.toBeInTheDocument();
  });

  it('«Nuevo PNJ con ficha» crea una entrada de tipo PNJ con la ficha vacía', async () => {
    const repo = makeRepo([NPC]);
    setup(repo);
    await screen.findByRole('heading', { name: 'Ogro' });
    await userEvent.click(screen.getByRole('button', { name: '+ Nuevo PNJ con ficha' }));
    await waitFor(() => expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      origin: 'npc', campaignId: 'c1', data: expect.objectContaining({ sheet: {} }),
    })));
  });

  it('el filtro «PNJ con ficha» los separa de los encuentros', async () => {
    setup(makeRepo([NPC, own()]));
    await screen.findByRole('heading', { name: 'Padre Vidal' });
    await userEvent.click(screen.getByRole('button', { name: 'PNJ con ficha' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Ogro con antorcha' })).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Padre Vidal' })).toBeInTheDocument();
  });
});

describe('BestiaryTab — la foto', () => {
  /** El ojo tiene que ser alcanzable sin ratón: si sólo apareciera al pasar por encima, con teclado no habría foto. */
  it('el ojo es un botón de verdad y abre la foto', async () => {
    setup();
    await screen.findByRole('heading', { name: 'Ogro' });
    await userEvent.click(screen.getByRole('button', { name: 'Ver la foto de Ogro' }));
    // Nota: el `Modal` compartido no expone role="dialog" (hueco de accesibilidad preexistente, anotado
    // como deuda), así que se busca por lo que sólo existe dentro del modal de la foto.
    expect(await screen.findByLabelText('Ilustración de Ogro')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir ficha' })).toBeInTheDocument();
  });

  /**
   * La mayoría de las 45 del manual no tienen foto: sin respaldo saldría un hueco roto. Se reutiliza
   * `initialsOf` de `maps`, que da una letra por palabra —«Ogro» → «O», «Ogro con antorcha» → «OC»—,
   * el mismo criterio que ya usan los tokens del mapa.
   */
  it('sin imagen subida enseña las iniciales, no un hueco roto', async () => {
    setup();
    await screen.findByRole('heading', { name: 'Ogro' });
    await userEvent.click(screen.getByRole('button', { name: 'Ver la foto de Ogro' }));
    expect(await screen.findByLabelText('Ilustración de Ogro')).toHaveTextContent('O');
  });
});

describe('BestiaryTab — crear y borrar', () => {
  it('«Nuevo encuentro» crea una entrada de esta campaña y abre su ficha', async () => {
    const repo = makeRepo();
    setup(repo);
    await screen.findByRole('heading', { name: 'Ogro' });
    await userEvent.click(screen.getByRole('button', { name: '+ Nuevo encuentro' }));
    await waitFor(() => expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ campaignId: 'c1', origin: 'custom' })));
    expect(await screen.findByRole('heading', { name: 'Ficha del encuentro' })).toBeInTheDocument();
  });

  /**
   * De punta a punta: lo que la ficha guarda tiene que llegar al repositorio, `token_url` incluido. Con la
   * imagen fuera del patch la foto sobrevive en pantalla pero no en la fila, y se pierde al recargar.
   */
  it('guardar la ficha manda al repositorio también la imagen', async () => {
    const repo = makeRepo([own({ tokenUrl: 'https://x/ogro.webp' })]);
    setup(repo);
    const card = await cardOf('Ogro con antorcha');
    await userEvent.click(within(card).getByRole('button', { name: 'Editar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(repo.update).toHaveBeenCalledWith('be-1', expect.objectContaining({ tokenUrl: 'https://x/ogro.webp' })));
  });

  /** Borrar una plantilla NO puede vaciar la escena: el aviso lo dice y la base lo garantiza (ON DELETE SET NULL). */
  it('borrar pide confirmación y avisa de que los tokens colocados se quedan', async () => {
    const repo = makeRepo();
    setup(repo);
    const card = await cardOf('Ogro con antorcha');
    await userEvent.click(within(card).getByRole('button', { name: 'Editar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));

    expect(await screen.findByText(/se quedan donde están/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(repo.remove).toHaveBeenCalledWith('be-1'));
  });
});

describe('BestiaryTab — colocar y tirar', () => {
  it('colocar avisa a la mesa con la entrada elegida', async () => {
    const onPlace = vi.fn();
    setup(makeRepo(), { onPlace });
    const card = await cardOf('Ogro');
    await userEvent.click(within(card).getByRole('button', { name: 'Colocar' }));
    expect(onPlace).toHaveBeenCalled();
  });

  it('si un error de la base tumba la carga, se dice; no se finge una lista vacía', async () => {
    const repo = makeRepo();
    (repo.listForCampaign as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('sin permiso'));
    setup(repo);
    expect(await screen.findByRole('alert')).toHaveTextContent('sin permiso');
  });
});
