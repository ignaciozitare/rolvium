import { describe, it, expect, vi } from 'vitest';
import { act, renderWithProviders, screen, waitFor, within } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import type { CompressionLevelsPort } from '@/shared/settings/CompressionLevelsPort';
import type { CompressionLevels } from '@/shared/settings/compressionLevels';
import { AdminSettings } from './AdminSettings';

/**
 * ADMIN → AJUSTES (`rolvium.pen` · `Admin/Ajustes`, aprobado el 2026-09-14): pantalla con pestañas — hoy sólo
 * «Imágenes» — con el nivel de compresión de texturas, objetos y fondos. Se guarda al elegir, sin botón.
 */
const fakePort = (over: Partial<CompressionLevelsPort> = {}): CompressionLevelsPort => ({
  load: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(undefined),
  ...over,
});

const grupo = (name: string) => screen.getByRole('radiogroup', { name });

describe('<AdminSettings>', () => {
  it('es la pestaña «Imágenes» con los tres tipos, y sin nada guardado los tres nacen en Equilibrado', async () => {
    renderWithProviders(<AdminSettings compressionLevels={fakePort()} />);
    expect(screen.getByRole('tab', { name: 'Imágenes' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Compresión de imágenes')).toBeInTheDocument();
    for (const tipo of ['Texturas', 'Objetos', 'Fondos']) {
      await waitFor(() => expect(within(grupo(tipo)).getByRole('radio', { name: 'Equilibrado' })).toHaveAttribute('aria-checked', 'true'));
    }
  });

  /** El fondo nunca baja de resolución en ningún nivel: se dice en pantalla para que no haya dudas. */
  it('avisa de que el fondo no pierde resolución', () => {
    renderWithProviders(<AdminSettings compressionLevels={fakePort()} />);
    expect(screen.getByText(/Nunca pierde resolución/)).toBeInTheDocument();
  });

  it('parte de lo guardado, no de lo de serie', async () => {
    const port = fakePort({ load: vi.fn().mockResolvedValue({ texture: 'max', prop: 'light', background: 'balanced' }) });
    renderWithProviders(<AdminSettings compressionLevels={port} />);
    await waitFor(() => expect(within(grupo('Texturas')).getByRole('radio', { name: 'Máximo ahorro' })).toHaveAttribute('aria-checked', 'true'));
    expect(within(grupo('Objetos')).getByRole('radio', { name: 'Ligero' })).toHaveAttribute('aria-checked', 'true');
  });

  it('elegir un nivel lo guarda al momento, con los otros dos intactos', async () => {
    const u = userEvent.setup();
    const port = fakePort();
    renderWithProviders(<AdminSettings compressionLevels={port} />);
    await u.click(within(grupo('Objetos')).getByRole('radio', { name: 'Máximo ahorro' }));
    await waitFor(() => expect(port.save).toHaveBeenCalledWith({ texture: 'balanced', prop: 'max', background: 'balanced' }));
    expect(within(grupo('Objetos')).getByRole('radio', { name: 'Máximo ahorro' })).toHaveAttribute('aria-checked', 'true');
  });

  /** Sin `manage_settings` la RLS deniega el guardado: la pantalla no puede quedarse enseñando un nivel falso. */
  it('si la base deniega el guardado, lo deshace y lo dice', async () => {
    const u = userEvent.setup();
    const port = fakePort({ save: vi.fn().mockRejectedValue(new Error('row-level security')) });
    renderWithProviders(<AdminSettings compressionLevels={port} />);
    await u.click(within(grupo('Texturas')).getByRole('radio', { name: 'Ligero' }));
    expect(await screen.findByText('No se pudo guardar el nivel.')).toBeInTheDocument();
    expect(within(grupo('Texturas')).getByRole('radio', { name: 'Equilibrado' })).toHaveAttribute('aria-checked', 'true');
  });

  /** El aviso de que no se ha podido guardar tiene que cantarlo el lector de pantalla, no sólo dibujarse. */
  it('el fallo al guardar se anuncia', async () => {
    const u = userEvent.setup();
    const port = fakePort({ save: vi.fn().mockRejectedValue(new Error('row-level security')) });
    renderWithProviders(<AdminSettings compressionLevels={port} />);
    await u.click(within(grupo('Texturas')).getByRole('radio', { name: 'Ligero' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar el nivel.');
  });

  /**
   * La lectura de la base trae lo de ANTES de tocar nada. Si tarda y llega después de haber elegido, no puede
   * pisar la elección: si lo hiciera, la pantalla enseñaría un nivel distinto del que se acaba de guardar.
   */
  it('una lectura lenta no pisa lo que ya se ha elegido, y se guarda sobre lo que ella trae', async () => {
    const u = userEvent.setup();
    let contesta: (v: CompressionLevels | null) => void = () => undefined;
    const port = fakePort({ load: vi.fn(() => new Promise<CompressionLevels | null>(res => { contesta = res; })) });
    renderWithProviders(<AdminSettings compressionLevels={port} />);

    await u.click(within(grupo('Texturas')).getByRole('radio', { name: 'Ligero' }));
    // Todavía no se ha escrito nada: hasta saber qué hay guardado, escribir pisaría los otros dos.
    expect(port.save).not.toHaveBeenCalled();

    await act(async () => { contesta({ texture: 'max', prop: 'max', background: 'max' }); });
    await waitFor(() => expect(port.save).toHaveBeenCalledWith({ texture: 'light', prop: 'max', background: 'max' }));
    // La lectura llegó tarde y trae «máximo» en texturas: no puede deshacer lo que se acaba de elegir.
    expect(within(grupo('Texturas')).getByRole('radio', { name: 'Ligero' })).toHaveAttribute('aria-checked', 'true');
    expect(port.load).toHaveBeenCalledTimes(1);
  });

  /**
   * Se deshace SÓLO el tipo que falló. (Lo que la otra llamada ya escribió con el valor optimista del tipo
   * fallido no se reescribe: `save` manda los tres juntos — ver la nota del informe de revisión.)
   */
  it('deshace sólo el tipo que falló, no lo que se eligió mientras tanto', async () => {
    const u = userEvent.setup();
    let rechaza: (e: Error) => void = () => undefined;
    const save = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((_res, rej) => { rechaza = rej; }))
      .mockResolvedValue(undefined);
    renderWithProviders(<AdminSettings compressionLevels={fakePort({ save })} />);

    await u.click(within(grupo('Texturas')).getByRole('radio', { name: 'Ligero' }));
    await u.click(within(grupo('Objetos')).getByRole('radio', { name: 'Máximo ahorro' }));
    await act(async () => { rechaza(new Error('row-level security')); });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(within(grupo('Texturas')).getByRole('radio', { name: 'Equilibrado' })).toHaveAttribute('aria-checked', 'true');
    expect(within(grupo('Objetos')).getByRole('radio', { name: 'Máximo ahorro' })).toHaveAttribute('aria-checked', 'true');
  });

  /**
   * 🔑 `save` escribe los TRES niveles juntos. Si la lectura falla, la pantalla enseña los de serie: guardar
   * entonces rebajaría a Equilibrado los otros dos tipos que el dueño había puesto en otra cosa, sin avisar.
   */
  it('si la lectura falló, vuelve a leer antes de guardar y no pisa los otros dos', async () => {
    const u = userEvent.setup();
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('sin red'))
      .mockResolvedValue({ texture: 'max', prop: 'max', background: 'max' });
    const port = fakePort({ load });
    renderWithProviders(<AdminSettings compressionLevels={port} />);

    await u.click(within(grupo('Texturas')).getByRole('radio', { name: 'Ligero' }));
    await waitFor(() => expect(port.save).toHaveBeenCalledWith({ texture: 'light', prop: 'max', background: 'max' }));
    // y la pantalla deja de mentir sobre los otros dos
    expect(within(grupo('Objetos')).getByRole('radio', { name: 'Máximo ahorro' })).toHaveAttribute('aria-checked', 'true');
  });

  it('si la relectura tampoco puede, no guarda nada y lo dice', async () => {
    const u = userEvent.setup();
    const port = fakePort({ load: vi.fn().mockRejectedValue(new Error('sin red')) });
    renderWithProviders(<AdminSettings compressionLevels={port} />);

    await u.click(within(grupo('Texturas')).getByRole('radio', { name: 'Ligero' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(port.save).not.toHaveBeenCalled();
    expect(within(grupo('Texturas')).getByRole('radio', { name: 'Equilibrado' })).toHaveAttribute('aria-checked', 'true');
  });
});
