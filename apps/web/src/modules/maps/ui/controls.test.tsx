import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { plenilunio } from '@rolvium/system-plenilunio';
import { sysT } from '@/modules/characters/domain/useCases/systemText';
import { SCENE_WAREHOUSE, WALL_1, WALL_DOOR, WALL_WINDOW } from '../../../../tests/helpers/fakes';
import { STROKE_COLORS } from '../domain/useCases/mapRules';
import { Toolbar } from './Toolbar';
import { StrokeBar } from './StrokeBar';
import { CanvasControls } from './CanvasControls';
import { EncounterMenu } from './EncounterMenu';
import { DmOptionsBar } from './DmOptionsBar';

describe('<Toolbar>', () => {
  it('three labelled blocks: Dados abre el lanzador y va primero; el jugador no ve el bloque de director; Fondo y Colocar PJ son botones de panel, no herramientas', async () => {
    const onChange = vi.fn(), onDice = vi.fn(), onPlacePc = vi.fn(), onBackground = vi.fn();
    const { rerender } = renderWithProviders(<Toolbar tool="select" isDm={false} onChange={onChange} onDice={onDice} />);
    // JUEGO: Dados + Seleccionar · Medir · Pin  ·  LIENZO: 5 de dibujo
    expect(screen.getAllByRole('button')).toHaveLength(9);
    expect(screen.getByText('Juego')).toBeInTheDocument();
    expect(screen.getByText('Lienzo')).toBeInTheDocument();
    expect(screen.queryByText('Director')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seleccionar' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Lanzador de dados' }));
    expect(onDice).toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Lápiz' }));
    expect(onChange).toHaveBeenCalledWith('pencil');
    rerender(<Toolbar tool="wall" isDm onChange={onChange} onDice={onDice} onPlacePc={onPlacePc} onBackground={onBackground} />);
    // + DIRECTOR: Muro · Revelar · Ocultar · Encuentro · Colocar PJ · Fondo del mapa
    expect(screen.getAllByRole('button')).toHaveLength(15);
    expect(screen.getByText('Director')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Colocar PJ' }));
    expect(onPlacePc).toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Fondo del mapa' }));
    expect(onBackground).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Muro' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Revelar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Ocultar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Encuentro' })).toBeEnabled();
    // the name is a Tooltip, not the browser's `title`: instant, placed, and following the system's look.
    // It is aria-hidden on purpose — the button's aria-label already carries the accessible name.
    const tips = [...document.querySelectorAll('.rv-tip')];
    expect(tips.map(t => t.textContent)).toContain('Muro');
    expect(tips.every(t => t.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(screen.getByRole('button', { name: 'Muro' })).not.toHaveAttribute('title');
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

describe('<StrokeBar> as the fog brush', () => {
  it('with a brush tool it becomes «Pincel»: sizes + revelar/ocultar todo, and the stroke controls step aside', async () => {
    const u = userEvent.setup();
    const onBrush = vi.fn(); const onRevealAll = vi.fn(); const onHideAll = vi.fn();
    renderWithProviders(
      <StrokeBar value={{ color: STROKE_COLORS[1], width: 2 }} onChange={vi.fn()} onClearMine={vi.fn()}
        tool="reveal" brush={3} onBrush={onBrush} onRevealAll={onRevealAll} onHideAll={onHideAll} />,
    );
    expect(screen.queryByRole('slider', { name: 'Grosor del trazo' })).not.toBeInTheDocument();
    expect(screen.getByText('revelar u ocultar afecta a todos los jugadores')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Tamaño 3' })).toBeChecked();
    await u.click(screen.getByRole('radio', { name: 'Tamaño 1' }));
    expect(onBrush).toHaveBeenCalledWith(1);
    await u.click(screen.getByRole('button', { name: 'Revelar todo' }));
    expect(onRevealAll).toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Ocultar todo' }));
    expect(onHideAll).toHaveBeenCalled();
  });

  it('a player never gets the brush bar even on a brush tool, because they are given no brush', () => {
    renderWithProviders(<StrokeBar value={{ color: STROKE_COLORS[1], width: 2 }} onChange={vi.fn()} onClearMine={vi.fn()} tool="reveal" />);
    expect(screen.getByRole('slider', { name: 'Grosor del trazo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revelar todo' })).not.toBeInTheDocument();
  });
});

describe('<StrokeBar> as the wall-type picker', () => {
  it('with the Muro tool it becomes «Muro»: the three types + how to work a door, and the stroke controls step aside', async () => {
    const onWallKind = vi.fn();
    renderWithProviders(
      <StrokeBar value={{ color: STROKE_COLORS[1], width: 2 }} onChange={vi.fn()} onClearMine={vi.fn()} tool="wall" wallKind="wall" onWallKind={onWallKind} />,
    );
    expect(screen.queryByRole('slider', { name: 'Grosor del trazo' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Muro' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Puerta' })).not.toBeChecked();
    expect(screen.getByText('clic en una puerta o una ventana para abrirla o cerrarla')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Ventana' }));
    expect(onWallKind).toHaveBeenCalledWith('window');
  });

  it('a player never gets the type picker — the bar stays «Trazo» on the same tool', () => {
    renderWithProviders(<StrokeBar value={{ color: STROKE_COLORS[1], width: 2 }} onChange={vi.fn()} onClearMine={vi.fn()} tool="wall" />);
    expect(screen.getByRole('slider', { name: 'Grosor del trazo' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Puerta' })).not.toBeInTheDocument();
  });
});

describe('<DmOptionsBar>', () => {
  const scene = { ...SCENE_WAREHOUSE };
  const walls = [WALL_1, WALL_DOOR, WALL_WINDOW];

  it('shows automatic fog on, the light segmented control and the tally of what players cannot see', async () => {
    const u = userEvent.setup();
    const onFogMode = vi.fn(); const onLighting = vi.fn();
    renderWithProviders(<DmOptionsBar scene={scene} walls={walls} hiddenTokens={3} onFogMode={onFogMode} onLighting={onLighting} />);
    expect(screen.getByRole('checkbox', { name: 'Niebla automática por visión' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Día' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Noche · 10 m' })).not.toBeChecked();
    expect(screen.getByText('1 muros · 1 puertas · 1 ventanas (invisibles para jugadores) · 3 tokens ocultos')).toBeInTheDocument();
    await u.click(screen.getByRole('radio', { name: 'Noche · 10 m' }));
    expect(onLighting).toHaveBeenCalledWith('night');
    await u.click(screen.getByRole('checkbox', { name: 'Niebla automática por visión' }));
    expect(onFogMode).toHaveBeenCalledWith('manual');
  });

  it('at night the light control is on «Noche» and turning the automatic fog back on asks for `vision`', async () => {
    const onFogMode = vi.fn(); const onLighting = vi.fn();
    renderWithProviders(<DmOptionsBar scene={{ ...scene, lighting: 'night', fogMode: 'manual' }} walls={[]} hiddenTokens={0} onFogMode={onFogMode} onLighting={onLighting} />);
    expect(screen.getByRole('radio', { name: 'Noche · 10 m' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Niebla automática por visión' })).not.toBeChecked();
    await userEvent.setup().click(screen.getByRole('checkbox', { name: 'Niebla automática por visión' }));
    expect(onFogMode).toHaveBeenCalledWith('vision');
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Día' }));
    expect(onLighting).toHaveBeenCalledWith('day');
  });
});
