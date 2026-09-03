import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor, within } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { plenilunio } from '@rolvium/system-plenilunio';
import { sysT } from '@/modules/characters/domain/useCases/systemText';
import { SCENE_WAREHOUSE, WALL_1, WALL_DOOR } from '../../../../tests/helpers/fakes';
import { STROKE_COLORS } from '../domain/useCases/mapRules';
import { Toolbar } from './Toolbar';
import type { Tool } from '../domain/useCases/mapRules';
import { StrokeBar } from './StrokeBar';
import { CanvasControls } from './CanvasControls';
import { EncounterMenu } from './EncounterMenu';
import { BuilderPanel } from './BuilderPanel';

describe('<Toolbar>', () => {
  it('three labelled blocks: Dados abre el lanzador y va primero; el jugador no ve el bloque de director; Fondo y Colocar PJ son botones de panel, no herramientas', async () => {
    const onChange = vi.fn(), onDice = vi.fn(), onPlacePc = vi.fn(), onBackground = vi.fn();
    const { rerender } = renderWithProviders(<Toolbar tool="select" isDm={false} onChange={onChange} onDice={onDice} />);
    // juego: Dados + Seleccionar · Medir · Pin  ·  lienzo: UN icono, «Dibujar», con las seis dentro
    expect(screen.getAllByRole('button')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Seleccionar' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Lanzador de dados' }));
    expect(onDice).toHaveBeenCalled();
    // Las seis de dibujar viven tras un icono, para no comerse el alto de la barra (dueño, 2026-09-03).
    const u0 = userEvent.setup();
    await u0.click(screen.getByRole('button', { name: 'Dibujar' }));
    await u0.click(await screen.findByRole('menuitemradio', { name: 'Lápiz' }));
    expect(onChange).toHaveBeenCalledWith('pencil');
    rerender(<Toolbar tool="wall" isDm onChange={onChange} onDice={onDice} onPlacePc={onPlacePc} onBackground={onBackground} />);
    // + DIRECTOR: Luz · Muro · Fondo del mapa · Pincel de transparencia ‖ Revelar · Ocultar ‖ Encuentro · Colocar PJ
    expect(screen.getAllByRole('button')).toHaveLength(13);
    // El pincel y la luz entran en el bloque del director: son cosa suya (rebanada 7).
    expect(screen.getByRole('button', { name: 'Pincel de transparencia' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Luz de ambiente' })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Colocar PJ' }));
    expect(onPlacePc).toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Fondo del mapa' }));
    expect(onBackground).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Builder' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Revelar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Ocultar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Encuentro' })).toBeEnabled();
    // the name is a Tooltip, not the browser's `title`: instant, placed, and following the system's look.
    // It is aria-hidden on purpose — the button's aria-label already carries the accessible name.
    const tips = [...document.querySelectorAll('.rv-tip')];
    expect(tips.map(t => t.textContent)).toContain('Builder');
    expect(tips.every(t => t.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(screen.getByRole('button', { name: 'Builder' })).not.toHaveAttribute('title');
  });

  /**
   * «Builder» (antes «Muro») usa el DIBUJO DEL DUEÑO, no un icono de Material — y va de máscara para que se
   * tiña con el botón: con un `<img>` el dibujo, que es oscuro, desaparecería sobre el negro del seleccionado.
   */
  it('Builder lleva el icono propio, como máscara para que se tiña con el botón', () => {
    renderWithProviders(<Toolbar tool="select" isDm onChange={vi.fn()} onDice={vi.fn()} onPlacePc={vi.fn()} onBackground={vi.fn()} />);
    const btn = screen.getByRole('button', { name: 'Builder' });
    const img = btn.querySelector('[data-testid="mp-tool-img"]') as HTMLElement;
    expect(img).toBeInTheDocument();
    /**
     * Lo que se pinta es `builder-mask.png`, el mismo dibujo del dueño con el alfa engordado. Su PNG original
     * sigue en la carpeta sin tocar: a tamaño real sus trazos no pasaban de 152 sobre 255, así que el icono
     * nunca llegaba a teñirse del color del botón y se veía descolorido al lado de los de Material
     * (dueño, 2026-09-01: «el icono se ve muy claro respecto a los otros»).
     */
    expect(img.style.maskImage || img.style.webkitMaskImage).toContain('/icons/builder-mask.png');
    // Y ya no es el «fence» de Material.
    expect(btn.querySelector('.material-symbols-outlined')).toBeNull();
  });

  /**
   * PIN DEL ORDEN DEL BLOQUE DE DIRECTOR, fijado por el dueño el 31-ago-2026: «ponlo arriba de los muros y
   * ventanas, y debajo de muros y ventanas el de imágenes… le demos coherencia al orden». El criterio es
   * agrupar primero lo que CONSTRUYE la escena, luego la niebla, luego el juego. Los botones de panel
   * (Fondo del mapa, Colocar PJ) van intercalados a propósito, no apilados al final como antes.
   *
   * Sin este test, «ordenar» el componente devuelve el orden viejo y nadie se entera: los otros asserts de
   * este fichero sólo miran que los botones ESTÉN, no en qué orden.
   */
  it('el bloque del director va en el orden que fijó el dueño', () => {
    renderWithProviders(<Toolbar tool="select" isDm onChange={vi.fn()} onDice={vi.fn()} onPlacePc={vi.fn()} onBackground={vi.fn()} />);
    const names = screen.getAllByRole('button').map(b => b.getAttribute('aria-label'));
    expect(names.slice(-8)).toEqual([
      'Luz de ambiente', 'Builder', 'Fondo del mapa', 'Pincel de transparencia',
      'Revelar', 'Ocultar', 'Encuentro', 'Colocar PJ',
    ]);
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

/**
 * TODOS los botones de sólo icono de la escena llevan el `Tooltip` del sistema, no el `title` del navegador
 * (dueño, 2026-09-01: «no me entero con los botones que hay»). El nativo tarda casi un segundo, cae donde
 * quiere y no sigue el look de la mesa. Sin este test, quitar un `Tooltip` «al ordenar» no rompe nada visible.
 */
describe('los botones de sólo icono dicen su nombre al pasar el ratón', () => {
  const tips = (): string[] => [...document.querySelectorAll('.rv-tip')].map(x => x.textContent ?? '');

  it('los controles del lienzo: los ocho tienen tooltip y ninguno usa el `title` del navegador', () => {
    const p = { onZoomIn: vi.fn(), onZoomOut: vi.fn(), onCenter: vi.fn(), onToggleWalls: vi.fn(), onTogglePlayerView: vi.fn(), showWalls: true, playerView: false, onSolidWalls: vi.fn(), onFogMode: vi.fn(), onLighting: vi.fn() };
    renderWithProviders(<CanvasControls {...p} isDm scene={SCENE_WAREHOUSE} />);
    for (const name of ['Acercar', 'Alejar', 'Centrar', 'Ver/ocultar muros', 'Ver como jugador']) {
      expect(tips()).toContain(name);
      expect(screen.getByRole('button', { name })).not.toHaveAttribute('title');
    }
    // La pila vive pegada al borde derecho, así que el rótulo sale a la IZQUIERDA o se saldría de la pantalla.
    expect([...document.querySelectorAll('.rv-tip')].every(x => x.getAttribute('data-placement') === 'left')).toBe(true);
    // El nombre accesible sigue siendo el del botón: el globo es sólo la mitad visual.
    expect([...document.querySelectorAll('.rv-tip')].every(x => x.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  it('«Quitar segmento», que era una papelera muda, ya se presenta', () => {
    renderWithProviders(<BuilderPanel mode="photo" wall={WALL_1} kind="wall" shape="segment" snapGrid={false} chainNodes
      onMode={vi.fn()} onKind={vi.fn()} onShape={vi.fn()} onSnapGrid={vi.fn()} onChainNodes={vi.fn()} onClose={vi.fn()} onRemove={vi.fn()} />);
    expect(tips()).toContain('Quitar segmento');
    expect(screen.getByRole('button', { name: 'Quitar segmento' })).not.toHaveAttribute('title');
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

describe('<CanvasControls> — la luz y la niebla como iconos, no como barra', () => {
  const base = { onZoomIn: vi.fn(), onZoomOut: vi.fn(), onCenter: vi.fn(), onToggleWalls: vi.fn(), onTogglePlayerView: vi.fn(), showWalls: true, playerView: false };

  it('el director alterna día/noche y la niebla automática desde la pila del zoom', async () => {
    const u = userEvent.setup();
    const onFogMode = vi.fn(), onLighting = vi.fn();
    renderWithProviders(<CanvasControls {...base} isDm scene={SCENE_WAREHOUSE} onFogMode={onFogMode} onLighting={onLighting} />);
    const stack = screen.getByRole('group', { name: 'Controles del lienzo' });
    await u.click(within(stack).getByRole('button', { name: 'Día' }));
    expect(onLighting).toHaveBeenCalledWith('night');
    const fog = within(stack).getByRole('button', { name: 'Niebla automática por visión · se abre sola al moverse las fichas; pulsa para manual' });
    expect(fog).toHaveAttribute('aria-pressed', 'true');
    await u.click(fog);
    expect(onFogMode).toHaveBeenCalledWith('manual');
  });

  /**
   * 🌫 EL FALLO DEL 2026-09-03. Las dos escenas de producción estaban en `manual` con cero zonas destapadas, y
   * en manual el servidor devuelve `vision: []` (`sceneVision.ts`): el mapa se quedaba entero tapado y no se
   * abría. Parecía la niebla dinámica rota y sólo estaba APAGADA — el botón decía «Niebla automática por
   * visión» tanto encendida como apagada, así que ni delataba el estado ni avisaba de lo que hacía al pulsar.
   */
  it('apagada lo DICE, y no repite la etiqueta de encendida', async () => {
    const u = userEvent.setup();
    const onFogMode = vi.fn();
    renderWithProviders(<CanvasControls {...base} isDm scene={{ ...SCENE_WAREHOUSE, fogMode: 'manual' }} onFogMode={onFogMode} onLighting={vi.fn()} />);
    const stack = screen.getByRole('group', { name: 'Controles del lienzo' });
    expect(within(stack).queryByRole('button', { name: /se abre sola al moverse/ })).toBeNull();
    const fog = within(stack).getByRole('button', { name: 'Niebla manual · sólo la abre tu pincel; pulsa para automática' });
    expect(fog).toHaveAttribute('aria-pressed', 'false');
    await u.click(fog);
    expect(onFogMode).toHaveBeenCalledWith('vision');
  });

  it('de noche el icono lo dice con los metros, y el jugador no ve ninguno de los dos', async () => {
    renderWithProviders(<CanvasControls {...base} isDm scene={{ ...SCENE_WAREHOUSE, lighting: 'night' }} onFogMode={vi.fn()} onLighting={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Noche · 10 m' })).toHaveAttribute('aria-pressed', 'true');

    document.body.innerHTML = '';
    renderWithProviders(<CanvasControls {...base} isDm={false} scene={SCENE_WAREHOUSE} onFogMode={vi.fn()} onLighting={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Día|Noche/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Niebla/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Acercar' })).toBeInTheDocument();
  });
});


/**
 * 🧱 ENSEÑARLE LOS MUROS A LOS JUGADORES, TODOS DE GOLPE (dueño, 2026-09-03: «agrega un botón para que los
 * jugadores puedan ver las líneas de los muros»). Es un ajuste de la ESCENA, no una vista suya: se guarda y lo
 * ve toda la mesa. Por eso vive con la luz, las paredes sólidas y la niebla, y no con el velo.
 */
describe('<CanvasControls> los muros, enseñados a los jugadores', () => {
  const base = { onZoomIn: vi.fn(), onZoomOut: vi.fn(), onCenter: vi.fn(), showWalls: true, onToggleWalls: vi.fn(), playerView: false, onTogglePlayerView: vi.fn() };

  it('apagado dice que no los ven y al pulsar pide enseñarlos', async () => {
    const u = userEvent.setup();
    const onWallsToPlayers = vi.fn();
    renderWithProviders(<CanvasControls {...base} isDm wallsToPlayers={false} onWallsToPlayers={onWallsToPlayers} />);
    const b = screen.getByRole('button', { name: 'Los jugadores no ven los muros · pulsa para enseñárselos' });
    expect(b).toHaveAttribute('aria-pressed', 'false');
    await u.click(b);
    expect(onWallsToPlayers).toHaveBeenCalledWith(true);
  });

  it('encendido dice que SÍ los ven y al pulsar pide ocultarlos', async () => {
    const u = userEvent.setup();
    const onWallsToPlayers = vi.fn();
    renderWithProviders(<CanvasControls {...base} isDm wallsToPlayers onWallsToPlayers={onWallsToPlayers} />);
    const b = screen.getByRole('button', { name: 'Los jugadores VEN los muros · pulsa para ocultárselos' });
    expect(b).toHaveAttribute('aria-pressed', 'true');
    await u.click(b);
    expect(onWallsToPlayers).toHaveBeenCalledWith(false);
  });

  /**
   * El icono es un DIBUJO nuestro y va de MÁSCARA, no de `<img>`: encendido el fondo es negro y con una imagen
   * el dibujo se quedaría negro sobre negro. Y son DOS dibujos distintos —ladrillos y puntos—, que es
   * exactamente lo que él pidió; con uno solo el botón no diría nada por sí mismo.
   */
  it('el icono es la pared dibujada, y cambia de ladrillos a puntos según el estado', () => {
    const { rerender } = renderWithProviders(<CanvasControls {...base} isDm wallsToPlayers onWallsToPlayers={vi.fn()} />);
    const mask = (): string => (screen.getByRole('button', { name: /ven los muros/i }).querySelector('[data-testid="mp-ctl-img"]') as HTMLElement).style.maskImage;
    expect(mask()).toContain('/icons/wall-bricks.svg');
    rerender(<CanvasControls {...base} isDm wallsToPlayers={false} onWallsToPlayers={vi.fn()} />);
    expect(mask()).toContain('/icons/wall-dotted.svg');
    expect(screen.getByRole('button', { name: /ven los muros/i }).querySelector('.material-symbols-outlined')).toBeNull();
  });

  it('a un jugador no se le ofrece: es un ajuste del director', () => {
    renderWithProviders(<CanvasControls {...base} isDm={false} wallsToPlayers onWallsToPlayers={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /jugadores.*muros|muros.*jugadores/ })).toBeNull();
  });

  /** Sin la pareja de propiedades no se monta: es lo que deja el botón fuera cuando la escena no tiene muros. */
  it('sin el callback no aparece', () => {
    renderWithProviders(<CanvasControls {...base} isDm />);
    expect(screen.queryByRole('button', { name: /ven los muros/ })).toBeNull();
  });
});

/**
 * 🌫 QUITARSE EL VELO GRIS (dueño, 2026-09-02: «al dm le falta un desactivar esa capa gris para él, para que
 * pueda ver bien»). Es SUYO: no toca la escena, no viaja y un jugador no se entera.
 */
describe('<CanvasControls> el velo del director', () => {
  const base = { onZoomIn: vi.fn(), onZoomOut: vi.fn(), onCenter: vi.fn(), showWalls: true, onToggleWalls: vi.fn(), playerView: false, onTogglePlayerView: vi.fn() };

  it('el director lo puede quitar y volver a poner, y la etiqueta dice cuál es', async () => {
    const u = userEvent.setup();
    const onToggleFogVeil = vi.fn();
    renderWithProviders(<CanvasControls {...base} isDm fogVeil onToggleFogVeil={onToggleFogVeil} />);
    await u.click(screen.getByRole('button', { name: 'Velo del director: puesto' }));
    expect(onToggleFogVeil).toHaveBeenCalledTimes(1);
  });

  it('quitado, lo dice', () => {
    renderWithProviders(<CanvasControls {...base} isDm fogVeil={false} onToggleFogVeil={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Velo del director: quitado' })).toBeInTheDocument();
  });

  it('a un jugador no se le ofrece: no es suyo', () => {
    renderWithProviders(<CanvasControls {...base} isDm={false} fogVeil onToggleFogVeil={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Velo del director/ })).toBeNull();
  });
});


/**
 * 🐞 «DIRECTAMENTE NO FUNCIONA EL OCULTAR O REVELAR» (dueño, 2026-09-02, con la sonda puesta).
 *
 * No se había roto: el lienzo ignora las herramientas del director en ese modo DESDE SIEMPRE —«ver como
 * jugador» le quita los privilegios y pintar la niebla es uno—, pero la barra las seguía ofreciendo. Se
 * pintaba con ellas y no pasaba nada, que es peor que no poder.
 */
describe('<Toolbar> viendo como jugador', () => {
  const props = { tool: 'select' as Tool, onChange: vi.fn(), onDice: vi.fn() };

  it('las del director salen APAGADAS, y dicen por qué', () => {
    renderWithProviders(<Toolbar {...props} isDm playerView />);
    for (const name of [/^Builder/, /^Luz/, /^Revelar/, /^Ocultar/]) {
      const btn = screen.getByRole('button', { name });
      expect(btn).toBeDisabled();
      expect(btn.getAttribute('aria-label')).toContain('no mientras ves como jugador');
    }
  });

  it('las de siempre siguen a mano: mirar como un jugador no es quedarse manco', async () => {
    renderWithProviders(<Toolbar {...props} isDm playerView />);
    for (const name of ['Seleccionar', 'Medir', 'Dibujar']) {
      expect(screen.getByRole('button', { name })).toBeEnabled();
    }
    // Y dentro del icono de dibujar siguen estando las seis, ninguna apagada.
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Dibujar' }));
    for (const name of ['Lápiz', 'Línea', 'Caja', 'Círculo', 'Texto', 'Borrar']) {
      expect(await screen.findByRole('menuitemradio', { name })).toBeEnabled();
    }
  });

  it('sin ese modo, las del director están disponibles como siempre', () => {
    renderWithProviders(<Toolbar {...props} isDm />);
    expect(screen.getByRole('button', { name: /^Revelar/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^Luz/ })).toBeEnabled();
  });
});

/**
 * ✏️ LAS SEIS DE DIBUJAR, EN UN ICONO (dueño, 2026-09-03: «*quiero que todas estas sean un solo icono y
 * cuando hagas click despliegue al lado un menú con las opciones de dibujo libre, para ahorrar espacio en la
 * barra de herramientas*»).
 */
describe('<Toolbar> · las seis de dibujar en un icono', () => {
  const props = { onChange: vi.fn(), onDice: vi.fn() };

  it('un solo botón en la barra, y las seis dentro del menú', async () => {
    renderWithProviders(<Toolbar {...props} tool="select" isDm={false} />);
    for (const name of ['Lápiz', 'Línea', 'Caja', 'Círculo', 'Texto', 'Borrar']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    await userEvent.setup().click(screen.getByRole('button', { name: 'Dibujar' }));
    const menu = await screen.findByRole('menu', { name: 'Dibujar' });
    expect(within(menu).getAllByRole('menuitemradio')).toHaveLength(6);
  });

  it('elegir una la pone y cierra el menú', async () => {
    const onChange = vi.fn();
    const u = userEvent.setup();
    renderWithProviders(<Toolbar {...props} onChange={onChange} tool="select" isDm={false} />);
    await u.click(screen.getByRole('button', { name: 'Dibujar' }));
    await u.click(await screen.findByRole('menuitemradio', { name: 'Círculo' }));
    expect(onChange).toHaveBeenCalledWith('circle');
    expect(screen.queryByRole('menu', { name: 'Dibujar' })).not.toBeInTheDocument();
  });

  /** Sin esto no habría forma de saber con qué estás dibujando sin abrir el menú. */
  it('el icono enseña la herramienta puesta, y el botón se ve encendido', async () => {
    renderWithProviders(<Toolbar {...props} tool="pencil" isDm={false} />);
    const btn = screen.getByRole('button', { name: 'Dibujar' });
    expect(btn).toHaveClass('on');
    expect(btn.textContent).toContain('edit');            // el icono del Lápiz, no el genérico
    await userEvent.setup().click(btn);
    expect(await screen.findByRole('menuitemradio', { name: 'Lápiz' })).toHaveAttribute('aria-checked', 'true');
  });

  it('volver a elegir la que ya está puesta la apaga, como cualquier otra herramienta', async () => {
    const onChange = vi.fn();
    const u = userEvent.setup();
    renderWithProviders(<Toolbar {...props} onChange={onChange} tool="pencil" isDm={false} />);
    await u.click(screen.getByRole('button', { name: 'Dibujar' }));
    await u.click(await screen.findByRole('menuitemradio', { name: 'Lápiz' }));
    expect(onChange).toHaveBeenCalledWith('select');
  });

  it('Escape cierra el menú', async () => {
    const u = userEvent.setup();
    renderWithProviders(<Toolbar {...props} tool="select" isDm={false} />);
    await u.click(screen.getByRole('button', { name: 'Dibujar' }));
    await screen.findByRole('menu', { name: 'Dibujar' });
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu', { name: 'Dibujar' })).not.toBeInTheDocument());
  });
});
