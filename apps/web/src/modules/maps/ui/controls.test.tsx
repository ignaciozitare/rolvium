import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { plenilunio } from '@rolvium/system-plenilunio';
import { sysT } from '@/modules/characters/domain/useCases/systemText';
import { STROKE_COLORS } from '../domain/useCases/mapRules';
import { Toolbar } from './Toolbar';
import { StrokeBar } from './StrokeBar';
import { CanvasControls } from './CanvasControls';
import { EncounterMenu } from './EncounterMenu';

describe('<Toolbar>', () => {
  it('player: 8 tools; DM adds Muro · Revelar · Ocultar · Encuentro (fog tools disabled «próximamente»); pressed state + onChange', async () => {
    const onChange = vi.fn();
    const { rerender } = renderWithProviders(<Toolbar tool="move" isDm={false} onChange={onChange} />);
    expect(screen.getAllByRole('button')).toHaveLength(8);
    expect(screen.getByRole('button', { name: 'Mover' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Lápiz' }));
    expect(onChange).toHaveBeenCalledWith('pencil');
    rerender(<Toolbar tool="wall" isDm onChange={onChange} />);
    expect(screen.getAllByRole('button')).toHaveLength(12);
    expect(screen.getByRole('button', { name: 'Muro' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Revelar · próximamente' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Encuentro' })).toBeEnabled();
  });
});

describe('<StrokeBar>', () => {
  it('width slider + colour radios change the style; clear mine / clear all (DM only)', async () => {
    const u = userEvent.setup();
    const onChange = vi.fn(); const onClearMine = vi.fn(); const onClearAll = vi.fn();
    const { rerender } = renderWithProviders(<StrokeBar value={{ color: STROKE_COLORS[1], width: 2 }} onChange={onChange} onClearMine={onClearMine} />);
    expect(screen.getByRole('radio', { name: 'Color 2' })).toBeChecked();
    await u.click(screen.getByRole('radio', { name: 'Color 3' }));
    expect(onChange).toHaveBeenCalledWith({ color: STROKE_COLORS[2], width: 2 });
    fireEvent.change(screen.getByRole('slider', { name: 'Grosor del trazo' }), { target: { value: '3' } });
    expect(onChange).toHaveBeenLastCalledWith({ color: STROKE_COLORS[1], width: 6 });
    expect(screen.getByText('lo que dibujas lo ve toda la mesa')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpiar todos' })).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Limpiar mis trazos' }));
    expect(onClearMine).toHaveBeenCalled();
    rerender(<StrokeBar value={{ color: STROKE_COLORS[1], width: 2 }} onChange={onChange} onClearMine={onClearMine} onClearAll={onClearAll} />);
    await u.click(screen.getByRole('button', { name: 'Limpiar todos' }));
    expect(onClearAll).toHaveBeenCalled();
  });
});

describe('<CanvasControls>', () => {
  it('zoom in/out/centre for everyone; walls toggle + «ver como jugador» for the DM', async () => {
    const u = userEvent.setup();
    const p = { onZoomIn: vi.fn(), onZoomOut: vi.fn(), onCenter: vi.fn(), onToggleWalls: vi.fn(), onTogglePlayerView: vi.fn(), showWalls: true, playerView: false };
    const { rerender } = renderWithProviders(<CanvasControls {...p} isDm={false} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    await u.click(screen.getByRole('button', { name: 'Acercar' })); expect(p.onZoomIn).toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Alejar' })); expect(p.onZoomOut).toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Centrar' })); expect(p.onCenter).toHaveBeenCalled();
    rerender(<CanvasControls {...p} isDm />);
    await u.click(screen.getByRole('button', { name: 'Ver/ocultar muros' })); expect(p.onToggleWalls).toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Ver como jugador' })); expect(p.onTogglePlayerView).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Ver/ocultar muros' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('<EncounterMenu>', () => {
  it('lists the system bestiary with Res/Prot, filters by search, selects an entry, closes', async () => {
    const u = userEvent.setup();
    const ts = sysT(plenilunio, 'es');
    const entries = plenilunio.catalogs['bestiary'] ?? [];
    const onSelect = vi.fn(); const onClose = vi.fn();
    renderWithProviders(<EncounterMenu entries={entries} labelOf={e => ts(e.label)} selectedId={null} onSelect={onSelect} onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Colocar encuentro' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Elegir / })).toHaveLength(entries.length);
    expect(screen.getByRole('button', { name: 'Elegir Mutante' })).toHaveTextContent(/Res \d+/);
    await u.type(screen.getByRole('searchbox'), 'ogr');
    expect(screen.getAllByRole('button', { name: /^Elegir / })).toHaveLength(1);
    await u.click(screen.getByRole('button', { name: 'Elegir Ogro' }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'ogre' }));
    await u.clear(screen.getByRole('searchbox'));
    await u.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalled();
  });
});
