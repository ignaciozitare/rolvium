import { describe, it, expect, vi } from 'vitest';
import { plenilunio } from '@rolvium/system-plenilunio';
import { renderWithProviders, screen } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { fakeRollLog } from '../../../../tests/helpers/fakes';
import { SidePanel } from './SidePanel';

describe('<SidePanel>', () => {
  it('muestra el Registro por defecto, cambia a las pestañas «pronto», y NO duplica el botón del lanzador', async () => {
    const u = userEvent.setup();
    const onToggle = vi.fn();
    const { rerender } = renderWithProviders(<SidePanel campaignId="c1" system={plenilunio} rollerOpen={false} onToggleRoller={onToggle} log={fakeRollLog()} />);
    expect(screen.getByRole('tab', { name: 'Registro' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('Combate')).toBeInTheDocument();
    for (const name of ['Chat', 'Notas', 'Bitácora']) {
      await u.click(screen.getByRole('tab', { name }));
      expect(screen.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Esta parte de la mesa llega pronto.')).toBeInTheDocument();
    }
    await u.click(screen.getByRole('tab', { name: 'Registro' }));
    expect(await screen.findByText('Combate')).toBeInTheDocument();
    // el lanzador se abre desde la primera herramienta de la barra de la escena; aquí ya no hay botón
    expect(screen.queryByRole('button', { name: /Lanzador de dados/ })).not.toBeInTheDocument();
    expect(onToggle).not.toHaveBeenCalled();
    rerender(<SidePanel campaignId="c1" system={plenilunio} rollerOpen onToggleRoller={onToggle} log={fakeRollLog()} />);
    expect(screen.queryByRole('button', { name: /Lanzador de dados/ })).not.toBeInTheDocument();
  });
});
