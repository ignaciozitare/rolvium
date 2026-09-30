import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, renderWithProviders, screen, waitFor, within } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { compressImage } from '@rolvium/ui';
import { compressionLevelsRepo } from '@/shared/settings/container';
import type { Photo, PhotoUsage } from '../domain/entities/Photo';
import type { PhotosPort } from '../domain/ports/PhotosPort';
import { decodePhotoDrag, PHOTO_DRAG_MIME } from '@/shared/lib/photoDrag';
import { GalleryPanel } from './GalleryPanel';

vi.mock('@/shared/settings/container', () => ({ compressionLevelsRepo: { load: vi.fn(), save: vi.fn() } }));
vi.mock('@rolvium/ui', async importOriginal => ({ ...(await importOriginal<typeof import('@rolvium/ui')>()), compressImage: vi.fn() }));

/**
 * LA GALERÍA (H13) — la pestaña del carril, sólo del director. Su nombre es suyo (2026-09-24: «*cambia fotos
 * por galeria*»). Spec: `specs/modules/photos/SPEC.md`. Lámina: § 4 · `Fotos/Biblioteca · el carril`.
 *
 * Llevarla a la escena y mandarla por el chat son las rebanadas 4 y 5: aquí se comprueba que NO salen, porque
 * un botón que no hace nada es peor que no tenerlo.
 */
const foto = (over: Partial<Photo> = {}): Photo => ({
  id: 'ph-1', campaignId: 'c1', name: 'El puente de Queens', width: 1024, height: 1280,
  createdAt: '2026-09-27T10:00:00Z', ...over,
});

const SIN_USO: PhotoUsage = { adventures: [], scenes: [], messages: 0 };

const fakeRepo = (rows: Photo[] = [foto()], over: Partial<PhotosPort> = {}): PhotosPort => ({
  list: vi.fn().mockResolvedValue(rows),
  create: vi.fn(async (campaignId: string, p) => foto({ id: 'ph-new', campaignId, name: p.name })),
  rename: vi.fn(async (id: string, name: string) => foto({ id, name })),
  remove: vi.fn().mockResolvedValue(undefined),
  usage: vi.fn().mockResolvedValue(SIN_USO),
  urlsFor: vi.fn(async (_c: string, ids: readonly string[]) => Object.fromEntries(ids.map(id => [id, `https://x/${id}.webp`]))),
  ...over,
});

const png = (name: string, size = 2_000_000) => {
  const f = new File(['x'], name, { type: 'image/png' });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

const paint = (repo: PhotosPort = fakeRepo()) => {
  renderWithProviders(<GalleryPanel campaignId="c1" repo={repo} />);
  return { repo, input: () => screen.getByTestId('ph-input') as HTMLInputElement };
};

const abrirMenu = async (user: ReturnType<typeof userEvent.setup>, nombre = 'El puente de Queens') =>
  user.click(await screen.findByRole('button', { name: `Opciones de «${nombre}»` }));

beforeEach(() => {
  vi.mocked(compressionLevelsRepo.load).mockResolvedValue(null);
  vi.mocked(compressImage).mockResolvedValue({
    blob: new Blob(['c'], { type: 'image/webp' }), originalBytes: 2_800_000, bytes: 204_800,
    compressed: true, width: 1024, height: 1280,
  });
});

describe('GalleryPanel — lo que hay dentro', () => {
  it('lista las fotos de la campaña con su nombre y su imagen firmada', async () => {
    const { repo } = paint(fakeRepo([foto(), foto({ id: 'ph-2', name: 'Karen «K»' })]));
    expect(await screen.findByText('El puente de Queens')).toBeInTheDocument();
    expect(screen.getByText('Karen «K»')).toBeInTheDocument();
    await waitFor(() => expect(repo.list).toHaveBeenCalledWith('c1'));
    // Los enlaces se FIRMAN aparte y caducan: el bucket es privado, no hay url pública en la fila.
    expect(repo.urlsFor).toHaveBeenCalledWith('c1', ['ph-1', 'ph-2']);
    expect(screen.getByRole('button', { name: 'Ver «Karen «K»»' }).querySelector('img')).toHaveAttribute('src', 'https://x/ph-2.webp');
  });

  it('dice que son sólo suyas y de esta campaña', async () => {
    paint();
    expect(await screen.findByText(/Sólo tú las ves/)).toBeInTheDocument();
  });

  it('sin ninguna, lo dice y ofrece subir', async () => {
    paint(fakeRepo([]));
    expect(await screen.findByText('Todavía no hay fotos.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Subir fotos/i })).toBeInTheDocument();
  });

  it('busca por nombre sin tildes ni mayúsculas, y dice cuándo no hay nada', async () => {
    const user = userEvent.setup();
    paint(fakeRepo([foto(), foto({ id: 'ph-2', name: 'Cámara secreta' })]));
    await screen.findByText('Cámara secreta');
    await user.type(screen.getByRole('searchbox', { name: 'Buscar una foto…' }), 'camara');
    expect(screen.getByText('Cámara secreta')).toBeInTheDocument();
    expect(screen.queryByText('El puente de Queens')).toBeNull();
    await user.clear(screen.getByRole('searchbox', { name: 'Buscar una foto…' }));
    await user.type(screen.getByRole('searchbox', { name: 'Buscar una foto…' }), 'zzz');
    expect(await screen.findByText('Ninguna foto se llama así.')).toBeInTheDocument();
  });

  /** Su «b» del Bestiario no aplica aquí: a la escena y por el chat son las rebanadas 4 y 5. */
  it('el menú de una foto ofrece renombrar, verla grande y borrarla — y NADA que no funcione todavía', async () => {
    const user = userEvent.setup();
    paint();
    await abrirMenu(user);
    expect(screen.getByRole('menuitem', { name: 'Cambiarle el nombre' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Verla más grande' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Borrarla' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /escena/i })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /chat/i })).toBeNull();
  });
});

describe('GalleryPanel — subir', () => {
  it('comprime y sube cada fichero, y enseña cuánto ha adelgazado', async () => {
    const { repo, input } = paint(fakeRepo([]));
    await screen.findByText('Todavía no hay fotos.');
    await userEvent.setup().upload(input(), png('retrato-karen.png'));
    await waitFor(() => expect(repo.create).toHaveBeenCalled());
    // El nombre nace del fichero, sin la extensión (spec § What the user can do).
    expect(vi.mocked(repo.create).mock.calls[0]![1]).toMatchObject({ name: 'retrato-karen', width: 1024, height: 1280 });
    expect(await screen.findByText('2.7 MB → 200 KB')).toBeInTheDocument();
    expect(screen.getByText('hecha')).toBeInTheDocument();
  });

  it('comprime con el nivel que un admin puso en Ajustes, no con uno inventado aquí', async () => {
    vi.mocked(compressionLevelsRepo.load).mockResolvedValue({ texture: 'balanced', prop: 'balanced', background: 'balanced', photo: 'max' });
    const { input } = paint(fakeRepo([]));
    await screen.findByText('Todavía no hay fotos.');
    await userEvent.setup().upload(input(), png('x.png'));
    await waitFor(() => expect(compressImage).toHaveBeenCalledWith(expect.anything(), 'photo', 'max'));
  });

  /** 🔑 Una que no entra NO se lleva a las demás (spec § States & errors). */
  it('si una falla, las demás siguen y sólo ésa queda marcada', async () => {
    vi.mocked(compressImage)
      .mockRejectedValueOnce(Object.assign(new Error('grande'), { name: 'CompressError', code: 'input-too-large' }))
      .mockResolvedValue({ blob: new Blob(['c']), originalBytes: 10, bytes: 5, compressed: true, width: 10, height: 10 });
    const { repo, input } = paint(fakeRepo([]));
    await screen.findByText('Todavía no hay fotos.');
    await userEvent.setup().upload(input(), [png('enorme.png'), png('buena.png')]);
    await waitFor(() => expect(repo.create).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('no ha entrado')).toBeInTheDocument();
    expect(screen.getByText('hecha')).toBeInTheDocument();
  });
});

describe('GalleryPanel — renombrar, borrar y verla grande', () => {
  it('renombrar guarda el nombre nuevo', async () => {
    const user = userEvent.setup();
    const { repo } = paint();
    await abrirMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Cambiarle el nombre' }));
    const caja = await screen.findByRole('textbox');
    await user.clear(caja);
    await user.type(caja, 'El puente roto');
    await user.click(screen.getByRole('button', { name: /Aceptar|OK|Confirm/i }));
    await waitFor(() => expect(repo.rename).toHaveBeenCalledWith('ph-1', 'El puente roto'));
  });

  it('borrar pregunta ANTES dónde se usa, y lo enseña', async () => {
    const user = userEvent.setup();
    const repo = fakeRepo([foto()], {
      usage: vi.fn().mockResolvedValue({
        adventures: [{ id: 'a1', title: 'El almacén de los muelles' }],
        scenes: [{ id: 's1', name: 'Almacén de Queens' }],
        messages: 2,
      }),
    });
    paint(repo);
    await abrirMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Borrarla' }));
    await waitFor(() => expect(repo.usage).toHaveBeenCalledWith(foto()));
    expect(await screen.findByText('El almacén de los muelles')).toBeInTheDocument();
    expect(screen.getByText('Almacén de Queens')).toBeInTheDocument();
    expect(screen.getByText('2 mensajes del chat')).toBeInTheDocument();
    expect(screen.getByText(/queda «foto borrada» en su sitio/)).toBeInTheDocument();
  });

  it('confirmar borra de verdad; cancelar no toca nada', async () => {
    const user = userEvent.setup();
    const { repo } = paint();
    await abrirMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Borrarla' }));
    await screen.findByText('No está puesta en ningún sitio.');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(repo.remove).not.toHaveBeenCalled();

    await abrirMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Borrarla' }));
    await screen.findByText('No está puesta en ningún sitio.');
    await user.click(await screen.findByRole('button', { name: 'Borrarla' }));
    await waitFor(() => expect(repo.remove).toHaveBeenCalledWith(foto()));
    await waitFor(() => expect(screen.queryByText('El puente de Queens')).toBeNull());
  });

  /** Si no se puede mirar dónde se usa, se DICE — no se finge que no se usa en ningún sitio. */
  it('si no se puede mirar dónde se usa, lo dice y deja borrar igual', async () => {
    const user = userEvent.setup();
    paint(fakeRepo([foto()], { usage: vi.fn().mockRejectedValue(new Error('red')) }));
    await abrirMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Borrarla' }));
    expect(await screen.findByText(/No he podido mirar dónde se usa/)).toBeInTheDocument();
  });

  it('pinchar una foto la abre a lo grande, en la hoja de pergamino', async () => {
    const user = userEvent.setup();
    paint();
    await user.click(await screen.findByRole('button', { name: 'Ver «El puente de Queens»' }));
    const hoja = await screen.findByRole('dialog', { name: 'El puente de Queens' });
    expect(within(hoja).getByRole('img', { name: 'Ver «El puente de Queens»' })).toHaveAttribute('src', 'https://x/ph-1.webp');
    expect(within(hoja).getByText('1024 × 1280')).toBeInTheDocument();
  });
});

/**
 * LOS CAMINOS DE ERROR — los tres fallos que cazó la revisión del 2026-09-27 vivían justo aquí: un aviso que
 * no llegaba a pintarse y un diálogo que se reabría solo. Sin estas cuatro, los tres volverían sin que nadie
 * se enterara, porque todo lo demás sigue verde.
 */
describe('GalleryPanel — cuando algo falla, se ve', () => {
  it('si renombrar no se guarda, lo DICE y vuelve el nombre viejo', async () => {
    const user = userEvent.setup();
    paint(fakeRepo([foto()], { rename: vi.fn().mockRejectedValue(new Error('red')) }));
    await abrirMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Cambiarle el nombre' }));
    const caja = await screen.findByRole('textbox');
    await user.clear(caja);
    await user.type(caja, 'El puente roto');
    await user.click(screen.getByRole('button', { name: /Aceptar|OK|Confirm/i }));
    // El nombre se pinta antes de guardar (va suelto), así que al fallar tiene que DESHACERSE, no quedarse.
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido cambiar el nombre.');
    await waitFor(() => expect(screen.getByText('El puente de Queens')).toBeInTheDocument());
    expect(screen.queryByText('El puente roto')).toBeNull();
  });

  it('si borrar no se guarda, lo DICE y la foto sigue ahí', async () => {
    const user = userEvent.setup();
    paint(fakeRepo([foto()], { remove: vi.fn().mockRejectedValue(new Error('red')) }));
    await abrirMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Borrarla' }));
    await screen.findByText('No está puesta en ningún sitio.');
    await user.click(await screen.findByRole('button', { name: 'Borrarla' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido borrar.');
    expect(screen.getByText('El puente de Queens')).toBeInTheDocument();
  });

  /** 🔑 El aviso de formato tiene que AGUANTAR la resincro del final de la subida. */
  it('un lote mixto: lo que no es imagen se queda en la puerta y el aviso sigue cuando la buena termina', async () => {
    const { repo, input } = paint(fakeRepo([]));
    await screen.findByText('Todavía no hay fotos.');
    // El `accept` del selector es un consejo: eligiendo «todos los ficheros» un PDF entra igual.
    fireEvent.change(input(), {
      target: { files: [new File(['%PDF-1.7'], 'reglas.pdf', { type: 'application/pdf' }), png('buena.png')] },
    });
    await waitFor(() => expect(repo.create).toHaveBeenCalledTimes(1));
    expect(vi.mocked(repo.create).mock.calls[0]![1]).toMatchObject({ name: 'buena' });
    // El PDF no llega ni a la cola: no se comprime, no se sube y no ocupa sitio.
    expect(screen.queryByText('reglas.pdf')).toBeNull();
    expect(await screen.findByText('hecha')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Eso no es una imagen. Sólo PNG, JPG, WebP o GIF.');
  });

  it('si lo cancela mientras se mira dónde se usa, lo que llega tarde NO lo vuelve a abrir', async () => {
    const user = userEvent.setup();
    let contesta: (u: PhotoUsage) => void = () => {};
    const repo = fakeRepo([foto()], { usage: vi.fn(() => new Promise<PhotoUsage>(res => { contesta = res; })) });
    paint(repo);
    await abrirMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Borrarla' }));
    const titulo = 'Borrar «El puente de Queens»';
    expect(await screen.findByRole('heading', { name: titulo })).toBeInTheDocument();
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('heading', { name: titulo })).toBeNull();
    // Aquí contesta la base, tarde: el aviso tiene que quedarse cerrado.
    await act(async () => { contesta(SIN_USO); });
    expect(screen.queryByRole('heading', { name: titulo })).toBeNull();
    expect(repo.remove).not.toHaveBeenCalled();
  });
});

/**
 * 📷 LLEVARLA A LA ESCENA ARRASTRÁNDOLA (H13, rebanada 4). Orden suya del 2026-09-24: «*asegurate que pueda
 * arrastrar las fotos a la escena y no que solo sea con el boton*». Lo que sale de aquí lo recoge el mapa, y
 * el contrato entre los dos vive en `shared/lib/photoDrag` — aquí se fija el lado de la galería.
 */
describe('GalleryPanel — arrastrarla a la escena', () => {
  const arrastrar = (el: Element) => {
    const datos: Record<string, string> = {};
    const ev = new Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', { value: { setData: (k: string, v: string) => { datos[k] = v; }, effectAllowed: '' } });
    fireEvent(el, ev);
    return datos;
  };

  it('la miniatura se coge con la mano, y viajan su id y su TAMAÑO', async () => {
    paint();
    const mini = await screen.findByRole('button', { name: 'Ver «El puente de Queens»' });
    expect(mini).toHaveAttribute('draggable', 'true');
    // El tamaño va con el id para que el mapa sepa la huella al soltar, sin ir a preguntar a la base.
    expect(decodePhotoDrag(arrastrar(mini)[PHOTO_DRAG_MIME] ?? null)).toEqual({ id: 'ph-1', width: 1024, height: 1280 });
  });

  it('🔑 el NOMBRE no viaja: la fila de una foto puesta la lee el jugador y un nombre puede destripar', async () => {
    paint();
    const datos = arrastrar(await screen.findByRole('button', { name: 'Ver «El puente de Queens»' }));
    expect(Object.keys(datos)).toEqual([PHOTO_DRAG_MIME]);
    expect(datos[PHOTO_DRAG_MIME]).not.toContain('puente');
  });

  it('lo dice en pantalla, porque un arrastre no se ve venir', async () => {
    paint();
    expect(await screen.findByText('Arrástrala al mapa para ponerla en la escena.')).toBeInTheDocument();
  });

  it('pinchar la foto sigue abriéndola a lo grande: coger no rompe el clic', async () => {
    const user = userEvent.setup();
    paint();
    await user.click(await screen.findByRole('button', { name: 'Ver «El puente de Queens»' }));
    expect(await screen.findByRole('dialog', { name: 'El puente de Queens' })).toBeInTheDocument();
  });
});
