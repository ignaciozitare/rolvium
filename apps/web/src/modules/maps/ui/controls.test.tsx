import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent, within } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { plenilunio } from '@rolvium/system-plenilunio';
import { sysT } from '@/modules/characters/domain/useCases/systemText';
import { SCENE_WAREHOUSE, WALL_1, WALL_DOOR } from '../../../../tests/helpers/fakes';
import { STROKE_COLORS } from '../domain/useCases/mapRules';
import { Toolbar } from './Toolbar';
import { StrokeBar } from './StrokeBar';
import { CanvasControls } from './CanvasControls';
import { EncounterMenu } from './EncounterMenu';
import { SegmentBar } from './SegmentBar';

describe('<Toolbar>', () => {
  it('three labelled blocks: Dados abre el lanzador y va primero; el jugador no ve el bloque de director; Fondo y Colocar PJ son botones de panel, no herramientas', async () => {
    const onChange = vi.fn(), onDice = vi.fn(), onPlacePc = vi.fn(), onBackground = vi.fn();
    const { rerender } = renderWithProviders(<Toolbar tool="select" isDm={false} onChange={onChange} onDice={onDice} />);
    // juego: Dados + Seleccionar · Medir · Pin  ·  lienzo: Lápiz · Línea · Caja · Círculo · Texto · Borrar
    expect(screen.getAllByRole('button')).toHaveLength(10);
    expect(screen.getByRole('button', { name: 'Seleccionar' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Lanzador de dados' }));
    expect(onDice).toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Lápiz' }));
    expect(onChange).toHaveBeenCalledWith('pencil');
    rerender(<Toolbar tool="wall" isDm onChange={onChange} onDice={onDice} onPlacePc={onPlacePc} onBackground={onBackground} />);
    // + DIRECTOR: Muro · Revelar · Ocultar · Encuentro · Colocar PJ · Fondo del mapa
    expect(screen.getAllByRole('button')).toHaveLength(16);
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

  /**
   * Paredes sólidas (rebanada 4): un ajuste de ESTA escena, junto a la luz y la niebla, que pone el director.
   * La etiqueta dice si está encendido o apagado — de un icono no se deduce qué pasa al pulsarlo.
   */
  it('el interruptor de paredes sólidas es del director, dice su estado y lo cambia', async () => {
    const u = userEvent.setup();
    const p = { onZoomIn: vi.fn(), onZoomOut: vi.fn(), onCenter: vi.fn(), onToggleWalls: vi.fn(), onTogglePlayerView: vi.fn(), showWalls: true, playerView: false, onSolidWalls: vi.fn() };
    // el jugador NO lo ve: no es suyo
    const { rerender } = renderWithProviders(<CanvasControls {...p} isDm={false} scene={SCENE_WAREHOUSE} />);
    expect(screen.queryByRole('button', { name: /paredes/i })).not.toBeInTheDocument();

    rerender(<CanvasControls {...p} isDm scene={{ ...SCENE_WAREHOUSE, solidWalls: false }} />);
    const off = screen.getByRole('button', { name: 'Paredes atravesables · pulsa para hacerlas sólidas' });
    expect(off).toHaveAttribute('aria-pressed', 'false');
    await u.click(off);
    expect(p.onSolidWalls).toHaveBeenCalledWith(true);

    rerender(<CanvasControls {...p} isDm scene={{ ...SCENE_WAREHOUSE, solidWalls: true }} />);
    const on = screen.getByRole('button', { name: 'Paredes sólidas · los tokens no las atraviesan' });
    expect(on).toHaveAttribute('aria-pressed', 'true');
    await u.click(on);
    expect(p.onSolidWalls).toHaveBeenLastCalledWith(false);
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

describe('<SegmentBar> — el tipo de segmento vive sobre el mapa, no en una barra a lo ancho', () => {
  it('con la herramienta Muro y nada seleccionado elige lo que se dibujará', async () => {
    const onKind = vi.fn();
    renderWithProviders(<SegmentBar wall={null} kind="wall" onKind={onKind} />);
    expect(screen.getByRole('radio', { name: 'Muro' })).toBeChecked();
    expect(screen.getByText('dibuja una puerta o una ventana sobre un muro y lo parte · pasa el ratón por una para abrirla o cerrarla')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Ventana' }));
    expect(onKind).toHaveBeenCalledWith('window');
    // sin segmento seleccionado no hay nada que borrar ni que abrir
    expect(screen.queryByRole('button', { name: 'Quitar segmento' })).not.toBeInTheDocument();
  });

  it('con un segmento seleccionado cambia su tipo, su visibilidad, lo abre y lo borra', async () => {
    const u = userEvent.setup();
    const cb = { onKind: vi.fn(), onVisible: vi.fn(), onToggleOpen: vi.fn(), onRemove: vi.fn() };
    renderWithProviders(<SegmentBar wall={WALL_DOOR} kind="door" {...cb} />);
    expect(screen.getByRole('radio', { name: 'Puerta' })).toBeChecked();
    await u.click(screen.getByRole('checkbox', { name: 'visible para jugadores' }));
    expect(cb.onVisible).toHaveBeenCalledWith(true);
    await u.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(cb.onToggleOpen).toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Quitar segmento' }));
    expect(cb.onRemove).toHaveBeenCalled();
  });

  it('un muro liso no se abre: no ofrece el botón', () => {
    renderWithProviders(<SegmentBar wall={WALL_1} kind="wall" onKind={vi.fn()} onToggleOpen={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Abrir|Cerrar/ })).not.toBeInTheDocument();
  });
});

describe('<CanvasControls> — la luz y la niebla como iconos, no como barra', () => {
  const base = { onZoomIn: vi.fn(), onZoomOut: vi.fn(), onCenter: vi.fn(), onToggleWalls: vi.fn(), onTogglePlayerView: vi.fn(), showWalls: true, playerView: false };

  it('el director alterna día/noche y la niebla automática desde la pila del zoom', async () => {
    const u = userEvent.setup();
    const onFogMode = vi.fn(), onLighting = vi.fn();
    renderWithProviders(<CanvasControls {...base} isDm scene={SCENE_WAREHOUSE} onFogMode={onFogMode} onLighting={onLighting} />);
    const stack = screen.getByRole('group', { name: 'Controles del lienzo' });
    await u.click(within(stack).getByRole('button', { name: 'Día' }));
    expect(onLighting).toHaveBeenCalledWith('night');
    const fog = within(stack).getByRole('button', { name: 'Niebla automática por visión' });
    expect(fog).toHaveAttribute('aria-pressed', 'true');
    await u.click(fog);
    expect(onFogMode).toHaveBeenCalledWith('manual');
  });

  it('de noche el icono lo dice con los metros, y el jugador no ve ninguno de los dos', async () => {
    renderWithProviders(<CanvasControls {...base} isDm scene={{ ...SCENE_WAREHOUSE, lighting: 'night' }} onFogMode={vi.fn()} onLighting={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Noche · 10 m' })).toHaveAttribute('aria-pressed', 'true');

    document.body.innerHTML = '';
    renderWithProviders(<CanvasControls {...base} isDm={false} scene={SCENE_WAREHOUSE} onFogMode={vi.fn()} onLighting={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Día|Noche/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Niebla automática por visión' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Acercar' })).toBeInTheDocument();
  });
});
