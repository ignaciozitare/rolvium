import { describe, it, expect } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, screen, waitFor, within } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { plenilunio } from '@rolvium/system-plenilunio';
import { SystemsPage, packageFacts } from './SystemsPage';

function mount(load = async () => plenilunio) {
  renderWithProviders(
    <Routes>
      <Route path="/systems" element={<SystemsPage load={load} />} />
      <Route path="/campaigns" element={<div>CAMPAIGNS</div>} />
    </Routes>,
    { providers: { routerProps: { initialEntries: ['/systems'] } } },
  );
}

describe('/systems', () => {
  it('packageFacts reads counts from the package', () => {
    const f = packageFacts(plenilunio);
    expect(f.sections).toBe(plenilunio.sheetSchema.sections.length);
    expect(f.catalogs).toBe(Object.keys(plenilunio.catalogs).length);
    expect(f.items).toBeGreaterThan(50);
    expect(f.steps).toBe(plenilunio.generator.length);
    expect(f.font).toBe('Cormorant Garamond');
    expect(f.locales).toContain('es');
  });

  it('shows the installed package (publisher, version, facts, themed preview) and the coming-soon systems', async () => {
    mount();
    const card = await screen.findByRole('article', { name: 'Plenilunio' });
    expect(within(card).getByText('Instalado')).toBeInTheDocument();
    await waitFor(() => expect(within(card).getByText(`NoSoloRol · paquete v${plenilunio.version}`)).toBeInTheDocument());
    const facts = within(card).getByRole('list', { name: 'Qué incluye' });
    expect(within(facts).getByText(/Generador de personaje de \d+ pasos/)).toBeInTheDocument();
    expect(within(facts).getByText(/Tema visual: Cormorant Garamond/)).toBeInTheDocument();
    expect(within(facts).getByText(/Idiomas del paquete: Español/)).toBeInTheDocument();
    expect(card.querySelector('.rv-system-preview')).toHaveStyle({ '--sys-ink': plenilunio.theme.vars.ink });
    const soon = screen.getByRole('article', { name: 'Cyberpunk' });
    expect(within(soon).getByText('Próximamente')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'D&D 5e' })).toBeInTheDocument();
    expect(screen.getByText('¿Tienes un sistema?')).toBeInTheDocument();
  });

  it('«Crear campaña con …» sends to /campaigns', async () => {
    mount();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Crear campaña con Plenilunio' }));
    expect(screen.getByText('CAMPAIGNS')).toBeInTheDocument();
  });

  it('shows a load error when the package cannot be loaded', async () => {
    mount(async () => { throw new Error('boom'); });
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido cargar el paquete.');
  });
});
