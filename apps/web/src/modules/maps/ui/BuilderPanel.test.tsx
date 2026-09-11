import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, within, fireEvent } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { WALL_1, WALL_DOOR } from '../../../../tests/helpers/fakes';
import { DEFAULT_DOOR } from '../domain/entities/Scene';
import { DOOR_COLORS } from '../domain/useCases/mapRules';
import { BuilderPanel } from './BuilderPanel';

// jsdom no trae PointerEvent: un MouseEvent con pointerId basta para los gestos, como en LightEditor.test.
class FakePointerEvent extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) { super(type, init); this.pointerId = init.pointerId ?? 0; }
}
(globalThis as unknown as { PointerEvent: unknown }).PointerEvent = FakePointerEvent;

/**
 * EL PANEL DE BUILDER v3 (`rolvium.pen` · `ePNCc`, `zpsjH`, `CvkXT`, `tS9zl`). Orden del dueño del
 * 2026-09-03: «*ya es hora que dejes esto maqueteado en el menú que va y que dejes de agregar cosas en este*».
 */
function mount(over: Partial<React.ComponentProps<typeof BuilderPanel>> = {}) {
  const cb = { onMode: vi.fn(), onKind: vi.fn(), onShape: vi.fn(), onSnapGrid: vi.fn(), onChainNodes: vi.fn(), onClose: vi.fn() };
  const base: React.ComponentProps<typeof BuilderPanel> = {
    mode: 'photo', wall: null, kind: 'wall', shape: 'segment', snapGrid: true, chainNodes: true, ...cb, ...over,
  };
  const r = renderWithProviders(<BuilderPanel {...base} />);
  /** Volver a pintar cambiando sólo lo que interesa: repetir la lista entera de props se rompía en cada prop nueva. */
  const re = (next: Partial<React.ComponentProps<typeof BuilderPanel>>) => r.rerender(<BuilderPanel {...base} {...next} />);
  return { ...r, cb, re };
}

describe('<BuilderPanel> la cabecera', () => {
  it('lleva SU icono, el de verdad, y no un Material Symbol genérico', () => {
    mount();
    const icono = screen.getByTestId('mp-builder-icon');
    expect(icono).toHaveStyle({ maskImage: 'url(/icons/builder-mask.png)' });
  });

  it('la X cierra el panel', async () => {
    const { cb } = mount();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar Builder' }));
    expect(cb.onClose).toHaveBeenCalled();
  });

  /**
   * Se aparta arrastrando por la cabecera, y **se sale del mapa**: el lienzo recorta lo que se sale de él, así
   * que al agarrarlo el panel pasa a `fixed` y desde ahí va por toda la ventana (dueño, 2026-09-03: «*los
   * modales de las herramientas están confinados dentro del mapa, deberían estar por donde quiera*»).
   */
  it('se agarra por la cabecera, se sale del mapa y se mueve por la ventana', () => {
    const { container } = mount();
    const panel = container.querySelector('.mp-builder') as HTMLElement;
    const asa = container.querySelector('.rv-fpanel-head') as HTMLElement;
    // Sin tocarlo lo coloca el CSS: nada en el `style`.
    expect(panel.style.position).toBe('');
    fireEvent.pointerDown(asa, { clientX: 100, clientY: 100, pointerId: 1, button: 0 });
    fireEvent.pointerMove(asa, { clientX: 160, clientY: 130, pointerId: 1 });
    // Ya suelto de la caja del mapa, y corrido lo que se corrió el ratón.
    expect(panel.style.position).toBe('fixed');
    expect(panel.style.left).toBe('60px');
    expect(panel.style.top).toBe('30px');
    fireEvent.pointerUp(asa, { pointerId: 1 });
  });
});

/**
 * LO PRIMERO DEL PANEL, y por una razón: mezclar las dos maneras fue el fallo de la sesión anterior
 * («*estás mezclando estas dos opciones*», 2026-09-03).
 */
describe('<BuilderPanel> en qué estoy trabajando · las dos conviven', () => {
  it('ofrece las dos maneras y marca la puesta', () => {
    mount();
    const modos = screen.getByRole('radiogroup', { name: /En qué estoy trabajando/ });
    expect(within(modos).getByRole('radio', { name: /Sobre una foto/ })).toHaveAttribute('aria-checked', 'true');
    expect(within(modos).getByRole('radio', { name: /Dibujar aquí/ })).toHaveAttribute('aria-checked', 'false');
  });

  it('cambiar de manera lo avisa hacia arriba', async () => {
    const { cb } = mount();
    await userEvent.setup().click(screen.getByRole('radio', { name: /Dibujar aquí/ }));
    expect(cb.onMode).toHaveBeenCalledWith('draw');
  });

  /** La nota de abajo dice qué pasa con las texturas en cada manera: es lo que separa los dos frames del `.pen`. */
  it('la nota cambia con la manera', () => {
    const { re } = mount();
    expect(screen.getByText(/el suelo ya lo pone la foto/)).toBeInTheDocument();
    re({ mode: 'draw' });
    // Desde la rebanada 8 dibujar aquí NO levanta muros normales: levanta SALAS, y eso es lo que la nota
    // tiene que decir. La nota vieja pasaba a mentir en pantalla en cuanto las salas existieran.
    expect(screen.getByText(/lo que levantas son SALAS/)).toBeInTheDocument();
  });
});

describe('<BuilderPanel> qué levanto y con qué forma', () => {
  it('muro, puerta y ventana siguen ahí, intactos', async () => {
    const { cb } = mount();
    for (const name of ['Muro', 'Puerta', 'Ventana']) expect(screen.getByRole('radio', { name })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Muro' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Puerta' }));
    expect(cb.onKind).toHaveBeenCalledWith('door');
  });

  it('ofrece las SEIS formas del diseño y marca la puesta', async () => {
    const { cb } = mount();
    const formas = screen.getByRole('radiogroup', { name: 'Con qué forma' });
    for (const name of ['A mano', 'Recta', 'Rectángulo', 'Círculo', 'Polígono', 'A pulso']) {
      expect(within(formas).getByRole('radio', { name })).toBeInTheDocument();
    }
    expect(within(formas).getByRole('radio', { name: 'A mano' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.setup().click(within(formas).getByRole('radio', { name: 'Polígono' }));
    expect(cb.onShape).toHaveBeenCalledWith('poly');
  });

  it('la pista de abajo cambia con la forma: cada una se dibuja con un gesto distinto', () => {
    const { re } = mount({ shape: 'poly' });
    // 🔴 Desde el 2026-09-10 «polígono» es el trazo libre cerrado, por orden suya.
    expect(screen.getByText(/con el contorno de la mano/)).toBeInTheDocument();
    re({ shape: 'line' });
    expect(screen.getByText(/sale un muro, y sólo uno/)).toBeInTheDocument();
    re({ shape: 'rect' });
    expect(screen.getByText(/arrastra para levantar la sala/)).toBeInTheDocument();
    re({ shape: 'free' });
    expect(screen.getByText(/saca una BANDA del ancho elegido siguiendo la mano/)).toBeInTheDocument();
  });
});

/**
 * EL CANDADO, aprobado el 2026-09-03 («*tira*»). Empieza cerrado: sin tocarlo, Builder es el de siempre.
 */
/**
 * ── EL ANCHO DE LA BANDA DE «A PULSO» (§ «Rebanada 10 · B») ──
 *
 * Lo que se construyó por error para el pincel no se tiró: es lo que a él le faltaba aquí. Palabra suya el
 * 2026-09-10 con la pantalla delante: «*el a mano no servía de nada*».
 */
describe('<BuilderPanel> el ancho de la banda', () => {
  it('sólo sale con «A pulso», y dice que sale una banda siguiendo la mano', () => {
    const { re } = mount({ mode: 'draw', shape: 'free' });
    expect(screen.getByTestId('mp-band')).toBeInTheDocument();
    expect(screen.getByText(/saca una BANDA del ancho elegido siguiendo la mano/)).toBeInTheDocument();
    re({ mode: 'draw', shape: 'poly' });
    expect(screen.queryByTestId('mp-band')).not.toBeInTheDocument();
  });

  it('mover el ancho lo avisa hacia arriba', () => {
    const onBandCells = vi.fn();
    mount({ mode: 'draw', shape: 'free', bandCells: 0.22, onBandCells });
    fireEvent.change(screen.getByRole('slider', { name: 'Ancho' }), { target: { value: '1.5' } });
    expect(onBandCells).toHaveBeenCalledWith(1.5);
  });

  /** De serie es el grosor de muro de la escena: una escena existente no cambia hasta que él lo toque. */
  it('arranca en el grosor de muro que le llega', () => {
    mount({ mode: 'draw', shape: 'free', bandCells: 0.34 });
    expect(screen.getByRole('slider', { name: 'Ancho' })).toHaveValue('0.34');
  });

  /** Un vano es un tramo recto y sin ancho: ofrecerlo prometería algo que no pasa. */
  it('con una puerta no sale', () => {
    mount({ mode: 'draw', buildKind: 'door', shape: 'free' });
    expect(screen.queryByTestId('mp-band')).not.toBeInTheDocument();
  });

  /** Y también marcando sobre una foto: allí la banda se convierte en los muros de su contorno. */
  it('sobre una foto sí sale, porque allí la banda marca los muros de su contorno', () => {
    mount({ mode: 'photo', shape: 'free' });
    expect(screen.getByTestId('mp-band')).toBeInTheDocument();
  });

  /** ── EL BORDE DE «A PULSO» (§ 10B.4 · `rolvium.pen` · `R7gay`) ── */
  it('el borde sale con «A pulso», y la barra de cuánto de roto sólo con borde roto', () => {
    const { re } = mount({ mode: 'draw', shape: 'free', bandTip: 'clean' });
    const borde = screen.getByTestId('mp-band-edge');
    expect(within(borde).getByRole('radio', { name: 'Limpio' })).toHaveAttribute('aria-checked', 'true');
    expect(within(borde).queryByRole('slider', { name: 'Cuánto de roto' })).not.toBeInTheDocument();
    re({ mode: 'draw', shape: 'free', bandTip: 'rough', bandRoughness: 0.6 });
    expect(screen.getByRole('slider', { name: 'Cuánto de roto' })).toHaveValue('60');
    // Con las palabras del pincel: «0,6» no le dice nada a nadie.
    expect(within(screen.getByTestId('mp-band-edge')).getByText('bastante')).toBeInTheDocument();
    re({ mode: 'draw', shape: 'poly', bandTip: 'rough' });
    expect(screen.queryByTestId('mp-band-edge')).not.toBeInTheDocument();
  });

  it('elegir borde roto y mover la barra lo avisan hacia arriba, y soltar la barra la guarda', () => {
    const onBandTip = vi.fn(), onBandRoughness = vi.fn(), onBandRoughnessEnd = vi.fn();
    const { re } = mount({ mode: 'draw', shape: 'free', bandTip: 'clean', onBandTip, onBandRoughness, onBandRoughnessEnd });
    fireEvent.click(screen.getByRole('radio', { name: 'Borde roto' }));
    expect(onBandTip).toHaveBeenCalledWith('rough');
    re({ mode: 'draw', shape: 'free', bandTip: 'rough', bandRoughness: 0.5, onBandTip, onBandRoughness, onBandRoughnessEnd });
    const barra = screen.getByRole('slider', { name: 'Cuánto de roto' });
    fireEvent.change(barra, { target: { value: '80' } });
    expect(onBandRoughness).toHaveBeenCalledWith(0.8);
    expect(onBandRoughnessEnd).not.toHaveBeenCalled();
    fireEvent.pointerUp(barra);
    expect(onBandRoughnessEnd).toHaveBeenCalledTimes(1);
  });

  it('con una puerta tampoco sale el borde', () => {
    mount({ mode: 'draw', buildKind: 'door', shape: 'free', bandTip: 'rough' });
    expect(screen.queryByTestId('mp-band-edge')).not.toBeInTheDocument();
  });

  /** Sobre una foto cada lado del trazo es un muro suelto: un canto roto dejaría cientos (suyo, 2026-09-11). */
  it('sobre una foto no sale el borde, aunque el ancho sí', () => {
    mount({ mode: 'photo', shape: 'free', bandTip: 'rough', bandRoughness: 0.6 });
    expect(screen.getByTestId('mp-band')).toBeInTheDocument();
    expect(screen.queryByTestId('mp-band-edge')).not.toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: 'Cuánto de roto' })).not.toBeInTheDocument();
  });
});

describe('<BuilderPanel> el candado de pegar a la rejilla', () => {
  it('cerrado lo dice, y su pista promete que nada ha cambiado', () => {
    mount();
    const candado = screen.getByRole('button', { name: /Pegado a la rejilla/ });
    expect(candado).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/como siempre/)).toBeInTheDocument();
  });

  it('pulsarlo lo abre', async () => {
    const { cb } = mount();
    await userEvent.setup().click(screen.getByRole('button', { name: /Pegado a la rejilla/ }));
    expect(cb.onSnapGrid).toHaveBeenCalledWith(false);
  });

  /** 3ª condición suya: abierto NO es libre a secas — sin el imán quedan rendijas y por ahí se cuela la vista. */
  it('abierto avisa de que las puntas siguen pegándose a las de otros muros', () => {
    mount({ snapGrid: false });
    expect(screen.getByRole('button', { name: /Libre/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/las puntas se pegan a las puntas de otros muros/)).toBeInTheDocument();
  });
});

describe('<BuilderPanel> lo que tengo cogido', () => {
  it('sin nada cogido, la sección ni aparece: estorbaría en el 99 % de los clics', () => {
    mount();
    expect(screen.queryByText('Lo que tengo cogido')).not.toBeInTheDocument();
  });

  it('un grupo cogido ofrece SOLTAR y dice cuántos muros son', async () => {
    const cb2 = { onUngroup: vi.fn(), onGroup: vi.fn() };
    mount({ groupCount: 11, grouped: true, ...cb2 });
    expect(screen.getByText('Grupo · 11 muros')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Soltar' }));
    expect(cb2.onUngroup).toHaveBeenCalled();
    expect(cb2.onGroup).not.toHaveBeenCalled();
  });

  it('varios muros sueltos ofrecen AGRUPAR', async () => {
    const cb2 = { onUngroup: vi.fn(), onGroup: vi.fn() };
    mount({ groupCount: 3, grouped: false, ...cb2 });
    expect(screen.getByText('3 muros sueltos')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Agrupar' }));
    expect(cb2.onGroup).toHaveBeenCalled();
  });

  /** Lo que hacía la barra vieja con un muro elegido tenía que venirse al panel, o se perdía. */
  it('con un muro cogido se puede enseñárselo a los jugadores y borrarlo', async () => {
    const u = userEvent.setup();
    const cb2 = { onVisible: vi.fn(), onRemove: vi.fn() };
    mount({ wall: WALL_1, ...cb2 });
    await u.click(screen.getByRole('checkbox', { name: /visible para jugadores/ }));
    expect(cb2.onVisible).toHaveBeenCalledWith(true);
    await u.click(screen.getByRole('button', { name: 'Quitar segmento' }));
    expect(cb2.onRemove).toHaveBeenCalled();
  });

  it('una puerta se abre desde el panel; un muro macizo no ofrece abrirse', async () => {
    const onToggleOpen = vi.fn();
    const { re } = mount({ wall: WALL_DOOR, onToggleOpen });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Abrir' }));
    expect(onToggleOpen).toHaveBeenCalled();
    re({ wall: WALL_1 });
    expect(screen.queryByRole('button', { name: 'Abrir' })).not.toBeInTheDocument();
  });

  /** El gesto nuevo no se adivina solo: con un muro cogido, el panel lo dice. */
  it('con un muro cogido cuenta que el doble clic sobre su línea añade un nodo', () => {
    mount({ wall: WALL_1 });
    expect(screen.getByText(/doble clic sobre su línea añade un nodo/)).toBeInTheDocument();
  });
});

/**
 * 🔗 LOS NODOS EN CADENA — «*los nodos deberían ser como una cadena a menos que yo elija que no*» (dueño,
 * 2026-09-03). Va PUESTO por omisión, que es lo que pidió.
 */
describe('<BuilderPanel> los nodos en cadena', () => {
  it('arranca en cadena, y lo dice', () => {
    mount();
    expect(screen.getByRole('button', { name: /En cadena/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/se lleva las de al lado/)).toBeInTheDocument();
  });

  it('se puede quitar', async () => {
    const { cb } = mount();
    await userEvent.setup().click(screen.getByRole('button', { name: /En cadena/ }));
    expect(cb.onChainNodes).toHaveBeenCalledWith(false);
  });

  /** Quitada, avisa de lo que puede pasar: una figura abierta es un hueco por donde se cuela la visión. */
  it('quitada, avisa de que la figura puede quedar abierta', () => {
    mount({ chainNodes: false });
    expect(screen.getByRole('button', { name: /Sueltos/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/la figura puede quedar abierta/)).toBeInTheDocument();
  });

  it('cuenta cómo coger todos los muros, que si no no se adivina', () => {
    mount();
    expect(screen.getByText(/coge todos los muros/)).toBeInTheDocument();
  });
});

/**
 * ── REBANADA 8: EL ESTILO DE LA MAZMORRA Y LAS DOS TEXTURAS BASE ──
 *
 * Aparecen SÓLO en «Dibujar aquí». Marcando sobre una foto el suelo lo pone la foto, y enseñarlos ahí era
 * literalmente el fallo que él señaló: «*estás mezclando estas dos opciones*».
 */
describe('<BuilderPanel> el estilo de la mazmorra (sólo dibujando aquí)', () => {
  it('sobre una foto NO se ofrecen ni preajustes ni texturas', () => {
    mount({ mode: 'photo' });
    expect(screen.queryByText('Estilo de la mazmorra')).not.toBeInTheDocument();
    expect(screen.queryByText('Las dos texturas base')).not.toBeInTheDocument();
  });

  it('dibujando aquí salen los NUEVE preajustes, en su rejilla', () => {
    mount({ mode: 'draw' });
    const grupo = screen.getByRole('radiogroup', { name: 'Estilo de la mazmorra' });
    expect(within(grupo).getAllByRole('radio')).toHaveLength(9);
    expect(within(grupo).getByText('Rayado clásico')).toBeInTheDocument();
    expect(within(grupo).getByText('Trazo a mano')).toBeInTheDocument();
  });

  it('el elegido se marca, y pinchar otro lo avisa', async () => {
    const onPreset = vi.fn();
    mount({ mode: 'draw', preset: 'ink', onPreset });
    expect(screen.getByTestId('mp-preset-ink')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('mp-preset-hatch')).toHaveAttribute('aria-checked', 'false');
    await userEvent.setup().click(screen.getByTestId('mp-preset-cavern'));
    expect(onPreset).toHaveBeenCalledWith('cavern');
  });

  /** La miniatura es la ESQUINA DE UNA SALA MONTADA, no un cuadrado de color: fue su segunda corrección. */
  it('cada preajuste enseña una miniatura, no un cuadrado de color', () => {
    mount({ mode: 'draw' });
    expect(screen.getByTestId('mp-preset-hatch').querySelector('svg.mp-builder-preset-mini')).not.toBeNull();
  });
});

describe('<BuilderPanel> las dos texturas base y el grosor', () => {
  it('sin foto propia enseña el nombre del preajuste, y ofrece subir una', () => {
    mount({ mode: 'draw', preset: 'cavern' });
    const fila = screen.getByText('Las dos texturas base').closest('fieldset')!;
    expect(within(fila).getAllByText('Caverna')).toHaveLength(2);   // pared y suelo
    /**
     * ELEGIR, NO SUBIR. Es la MISMA corrección que ya se le hizo a la puerta, y él la tuvo que repetir para
     * las texturas base: «*ese botón no es para subir, es para elegir; luego ya dentro del modal se pueden
     * subir*» (2026-09-07). El botón abre el CATÁLOGO; subir una foto se hace dentro.
     */
    expect(within(fila).getAllByRole('button', { name: 'Elegir' })).toHaveLength(2);
    expect(within(fila).queryByRole('button', { name: '+ Subir' })).not.toBeInTheDocument();
  });

  it('con una foto suya, manda la suya — y se puede quitar', async () => {
    const onTexture = vi.fn(), onClearTexture = vi.fn();
    mount({ mode: 'draw', wallTextureUrl: 'https://x/roca.png', onTexture, onClearTexture });
    const fila = screen.getByText('Las dos texturas base').closest('fieldset')!;
    expect(within(fila).getByText('Foto tuya')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(within(fila).getByRole('button', { name: 'Cambiar' }));
    expect(onTexture).toHaveBeenCalledWith('wall');
    await user.click(within(fila).getByRole('button', { name: 'Quitar' }));
    expect(onClearTexture).toHaveBeenCalledWith('wall');
  });

  /** El grosor va EN CASILLAS, no en píxeles: así el muro no cambia de aspecto con otra rejilla. */
  it('el grosor se enseña en centésimas de casilla y avisa al moverlo', () => {
    const onThickness = vi.fn();
    mount({ mode: 'draw', thickness: 0.22, onThickness });
    const slider = screen.getByRole('slider', { name: 'Grosor del muro' });
    expect(screen.getByText('22')).toBeInTheDocument();
    fireEvent.change(slider, { target: { value: '0.4' } });
    expect(onThickness).toHaveBeenCalledWith(0.4);
  });
});

/**
 * ── LA BARRITA DEL TAMAÑO DE LAS FICHAS ──
 *
 * Encargo suyo del 2026-09-07: «*si dibujan pasillos pequeños los tokens no pasarán… no quiero eliminar la
 * colisión, quiero reducir el tamaño*», y «*el tamaño se configura no por saltos sino con una barrita
 * progresiva*». Diseño aprobado en `rolvium.pen` · «PL/Builder · panel · TAMAÑO DE LAS FICHAS».
 */
describe('<BuilderPanel> — el tamaño de las fichas', () => {
  const barra = () => screen.getByRole('slider', { name: 'TAMAÑO DE LAS FICHAS · TODA LA ESCENA' });

  it('enseña LO QUE OCUPA UNA FICHA NORMAL, no el multiplicador: «×0,66» no dice nada', () => {
    mount({ mode: 'draw', tokenScale: 1 });
    expect(screen.getAllByText(/1,5/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/×/)).not.toBeInTheDocument();
  });

  it('a dos tercios enseña UNA casilla, que es la respuesta a «¿pasa por el pasillo?»', () => {
    mount({ mode: 'draw', tokenScale: 2 / 3 });
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('es CONTINUA y recorre de la mitad a un cuarto más, como él la pidió', () => {
    mount({ mode: 'draw', tokenScale: 1 });
    const b = barra();
    expect(b).toHaveAttribute('min', '0.5');
    expect(b).toHaveAttribute('max', '1.25');
    // Un paso de 0,01 es lo que la hace progresiva y no de saltos.
    expect(Number(b.getAttribute('step'))).toBeLessThanOrEqual(0.01);
  });

  it('mientras arrastra AVISA para el previo, y al soltar es cuando GUARDA', () => {
    const onTokenScale = vi.fn(), onTokenScaleEnd = vi.fn();
    mount({ mode: 'draw', tokenScale: 1, onTokenScale, onTokenScaleEnd });
    fireEvent.change(barra(), { target: { value: '0.66' } });
    expect(onTokenScale).toHaveBeenCalledWith(0.66);
    // Todavía NO se ha guardado: sería una escritura por píxel de arrastre.
    expect(onTokenScaleEnd).not.toHaveBeenCalled();
    fireEvent.pointerUp(barra());
    expect(onTokenScaleEnd).toHaveBeenCalled();
  });

  it('lleva la marca del centro, para volver a «como siempre» sin buscar', () => {
    const { container } = mount({ mode: 'draw', tokenScale: 0.66 });
    expect(barra()).toHaveAttribute('list', 'mp-token-scale-ticks');
    const marca = container.querySelector('#mp-token-scale-ticks option');
    expect(marca).toHaveAttribute('value', '1');
  });

  it('sale en los DOS modos: las fichas están tanto sobre una foto como levantando salas', () => {
    mount({ mode: 'photo', tokenScale: 1 });
    expect(barra()).toBeInTheDocument();
  });
});

/**
 * ── EL AZULEJO Y SU MUESTRA ──
 *
 * Petición suya del 2026-09-04 probando el constructor: «*necesito que la textura se pueda escalar y tener un
 * previo de cómo iría quedando cuando la escale, porque tengo una textura de mosaicos que quedan muy grandes*».
 */
describe('<BuilderPanel> escalar la textura', () => {
  it('sin foto puesta NO hay escala que tocar: un color no se escala', () => {
    mount({ mode: 'draw' });
    expect(screen.queryByRole('slider', { name: 'Azulejo · pared' })).not.toBeInTheDocument();
  });

  it('con una foto sale el deslizador, y arrastrar avisa EN VIVO', () => {
    const onTextureScale = vi.fn(), onTextureScaleEnd = vi.fn();
    mount({ mode: 'draw', floorTextureUrl: 'https://x/mosaico.png', floorScale: 4, onTextureScale, onTextureScaleEnd });
    const slider = screen.getByRole('slider', { name: 'Azulejo · suelo' });
    fireEvent.change(slider, { target: { value: '0.5' } });
    expect(onTextureScale).toHaveBeenCalledWith('floor', 0.5);
    // Guardar es al SOLTAR, no en cada píxel del arrastre.
    expect(onTextureScaleEnd).not.toHaveBeenCalled();
    fireEvent.pointerUp(slider);
    expect(onTextureScaleEnd).toHaveBeenCalledTimes(1);
  });

  /**
   * La muestra es el «previo»: enseña CUÁNTOS AZULEJOS ENTRAN EN UNA CASILLA, que es lo único que hay que
   * decidir. Vale tres casillas de ancho, así que a escala 1 el azulejo mide un tercio de la muestra.
   */
  it('la muestra enseña el azulejo al tamaño que tendrá sobre la rejilla', () => {
    const { re } = mount({ mode: 'draw', floorTextureUrl: 'https://x/mosaico.png', floorScale: 1 });
    const muestra = () => screen.getAllByTestId('mp-tex-swatch').at(-1)!;
    expect(muestra()).toHaveStyle({ backgroundSize: '22px 22px' });
    re({ mode: 'draw', floorTextureUrl: 'https://x/mosaico.png', floorScale: 3 });
    // El triple de casillas por azulejo → el azulejo llena la muestra entera.
    expect(muestra()).toHaveStyle({ backgroundSize: '66px 66px' });
  });
});

/**
 * ── EXCAVAR O RELLENAR ──
 *
 * Suyo, 2026-09-04: «*hoy tomamos como que las habitaciones son huecos en el muro, entonces los muros serán
 * relleno de esos huecos*». Dibujando aquí hay CUATRO cosas que levantar; sobre una foto siguen siendo tres.
 */
describe('<BuilderPanel> qué levanto: sala o muro', () => {
  it('sobre una foto siguen siendo las tres de siempre, intactas', () => {
    mount({ mode: 'photo' });
    const grupo = screen.getByRole('radiogroup', { name: 'Tipo de segmento' });
    expect(within(grupo).getAllByRole('radio')).toHaveLength(3);
    expect(within(grupo).queryByText('Sala')).not.toBeInTheDocument();
  });

  it('dibujando aquí sale SALA la primera, porque excavar es lo normal', () => {
    mount({ mode: 'draw' });
    const grupo = screen.getByRole('radiogroup', { name: 'Tipo de segmento' });
    const opciones = within(grupo).getAllByRole('radio');
    expect(opciones).toHaveLength(4);
    expect(opciones[0]).toHaveTextContent('Sala');
    expect(opciones[0]).toHaveAttribute('aria-checked', 'true');
  });

  it('elegir MURO lo avisa', async () => {
    const onBuildKind = vi.fn();
    mount({ mode: 'draw', onBuildKind });
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Muro' }));
    expect(onBuildKind).toHaveBeenCalledWith('wall');
  });
});

/**
 * ── LAS PUERTAS, DE VERDAD (`rolvium.pen` · «PL/Builder · panel · PUERTA cogida») ──
 *
 * Cuatro filas que salen SÓLO cuando lo cogido es una puerta. Su encargo del 2026-09-07: «*tengo que poder
 * elegir si la puerta es de una o dos hojas y si abre para un lado o el otro (preseteado en algo, cosa de
 * que no sea obligatorio configurarla)*». Y el mismo panel sirve para una puerta de SALA, que es lo que
 * arregla el fallo de origen: una puerta dibujada en una sala no se podía ni abrir ni borrar.
 */
/**
 * «*dejaste como opciones el a mano, recta, círculo etc, en una puerta o ventana no tiene sentido*»
 * (suyo, 2026-09-07 con la app delante). Un vano es siempre un tramo recto de A a B.
 */
describe('<BuilderPanel> las formas NO salen con una puerta o una ventana', () => {
  it('dibujando aquí: con SALA o MURO sí, con PUERTA y VENTANA no', () => {
    const { re } = mount({ mode: 'draw', buildKind: 'room' });
    expect(screen.getByRole('radiogroup', { name: 'Con qué forma' })).toBeInTheDocument();
    re({ mode: 'draw', buildKind: 'wall' });
    expect(screen.getByRole('radiogroup', { name: 'Con qué forma' })).toBeInTheDocument();
    for (const k of ['door', 'window'] as const) {
      re({ mode: 'draw', buildKind: k });
      expect(screen.queryByRole('radiogroup', { name: 'Con qué forma' })).not.toBeInTheDocument();
    }
  });

  it('con un vano no queda NADA de muro ni de sala: ni estilo, ni texturas base, ni grosor', () => {
    const { re } = mount({ mode: 'draw', buildKind: 'room', onPreset: vi.fn(), onTexture: vi.fn(), onThickness: vi.fn() });
    expect(screen.getByText('Estilo de la mazmorra')).toBeInTheDocument();
    expect(screen.getByText('Las dos texturas base')).toBeInTheDocument();
    re({ mode: 'draw', buildKind: 'door', onPreset: vi.fn(), onTexture: vi.fn(), onThickness: vi.fn() });
    expect(screen.queryByText('Estilo de la mazmorra')).not.toBeInTheDocument();
    expect(screen.queryByText('Las dos texturas base')).not.toBeInTheDocument();
    expect(screen.queryByText('Grosor del muro')).not.toBeInTheDocument();
    // Pero lo que SÍ vale para dibujar un vano se queda: la rejilla y los nodos.
    expect(screen.getByText('Pegar a la rejilla')).toBeInTheDocument();
  });

  it('y marcando sobre una foto, lo mismo: manda `kind`', () => {
    const { re } = mount({ mode: 'photo', kind: 'wall' });
    expect(screen.getByRole('radiogroup', { name: 'Con qué forma' })).toBeInTheDocument();
    re({ mode: 'photo', kind: 'door' });
    expect(screen.queryByRole('radiogroup', { name: 'Con qué forma' })).not.toBeInTheDocument();
  });
});

describe('<BuilderPanel> cómo es la puerta cogida', () => {
  const VANO = { id: 'ro-1', sceneId: 'sc-1', campaignId: 'c1', x1: 0, y1: 0, x2: 0, y2: 60, kind: 'door' as const, isOpen: false, ...DEFAULT_DOOR };
  const fila = (nombre: string) => screen.getByRole('radiogroup', { name: nombre });

  /**
   * ── LA CORRECCIÓN DE CONCEPTO (suya, 2026-09-07: «*sólo me deja poner las propiedades de la puerta una
   * vez creada, eso está como el culo*») ──
   * Los ajustes salen al ELEGIR puerta, y la puerta nace ya así. Antes había que dibujarla y cogerla.
   */
  it('al elegir PUERTA salen sus ajustes ANTES de dibujar nada, sobre el borrador', async () => {
    const onDoor = vi.fn();
    mount({ mode: 'draw', buildKind: 'door', doorDraft: { ...DEFAULT_DOOR }, onDoor });
    expect(screen.getByTestId('mp-door-opts')).toBeInTheDocument();
    expect(screen.getByText('se dibuja ya así · y esto mismo edita la que tengas cogida')).toBeInTheDocument();
    await userEvent.setup().click(within(fila('Hojas')).getByRole('radio', { name: 'Dos' }));
    expect(onDoor).toHaveBeenLastCalledWith({ leaves: 2 });
  });

  it('con una VENTANA elegida no hay ajustes: una ventana no se configura ni se abre', () => {
    mount({ mode: 'draw', buildKind: 'window', doorDraft: { ...DEFAULT_DOOR }, onDoor: vi.fn() });
    expect(screen.queryByTestId('mp-door-opts')).not.toBeInTheDocument();
  });

  /**
   * ── Y EL BORRADOR NO SE CUELA EN LO QUE HAYA COGIDO ──
   * Con algo cogido que NO es una puerta —una ventana de sala, un muro—, `onDoor` escribe en esa fila
   * (así lo reparte `SceneTab`). Si además saliera el borrador, el panel enseñaría los valores de la
   * próxima puerta y cada clic los escribiría en la ventana: mentiría dos veces y el borrador ni se
   * enteraría. Con algo cogido que no es puerta, aquí no hay ajustes de puerta.
   */
  it('con una VENTANA o un MURO cogidos no sale el borrador, aunque «Puerta» esté elegido', () => {
    const VENTANA = { ...VANO, kind: 'window' as const };
    const { re } = mount({ mode: 'draw', buildKind: 'door', doorDraft: { ...DEFAULT_DOOR }, roomOpening: VENTANA, onDoor: vi.fn() });
    expect(screen.queryByTestId('mp-door-opts')).not.toBeInTheDocument();
    re({ mode: 'draw', buildKind: 'door', doorDraft: { ...DEFAULT_DOOR }, roomOpening: null, wall: WALL_1, onDoor: vi.fn() });
    expect(screen.queryByTestId('mp-door-opts')).not.toBeInTheDocument();
    // Sobre una foto es el mismo caso: `kind` viene del muro cogido, pero el vano cogido es una ventana.
    re({ mode: 'photo', kind: 'door', doorDraft: { ...DEFAULT_DOOR }, roomOpening: VENTANA, onDoor: vi.fn() });
    expect(screen.queryByTestId('mp-door-opts')).not.toBeInTheDocument();
  });

  it('con una puerta COGIDA el bloque es el mismo, pero sin la pista del borrador', () => {
    mount({ wall: WALL_DOOR, onDoor: vi.fn() });
    expect(screen.getByTestId('mp-door-opts')).toBeInTheDocument();
    expect(screen.queryByText('se dibuja ya así · y esto mismo edita la que tengas cogida')).not.toBeInTheDocument();
  });

  it('los colores van en rejilla ordenada, no en una lista que se dobla sola', () => {
    mount({ wall: WALL_DOOR, onDoor: vi.fn() });
    const rejilla = screen.getByRole('radiogroup', { name: 'Color' });
    expect(rejilla).toHaveClass('mp-door-colors');
    // El de la escena PRIMERO, y detrás las familias en su orden.
    expect(within(rejilla).getAllByRole('radio')[0]).toHaveAccessibleName('El de la escena');
    expect(within(rejilla).getAllByRole('radio')).toHaveLength(DOOR_COLORS.length + 1);
  });

  it('sin nada cogido no hay filas de puerta: el panel no se llena de ajustes que no tocan', () => {
    mount();
    expect(screen.queryByRole('radiogroup', { name: 'Hojas' })).not.toBeInTheDocument();
  });

  it('un MURO liso o una VENTANA tampoco las traen: sólo una puerta se configura', () => {
    const { re } = mount({ wall: WALL_1, onDoor: vi.fn() });
    expect(screen.queryByRole('radiogroup', { name: 'Hojas' })).not.toBeInTheDocument();
    re({ wall: { ...WALL_DOOR, kind: 'window' }, onDoor: vi.fn() });
    expect(screen.queryByRole('radiogroup', { name: 'Hojas' })).not.toBeInTheDocument();
  });

  it('con una puerta cogida salen las cuatro, marcadas en lo que trae de fábrica', () => {
    mount({ wall: WALL_DOOR, onDoor: vi.fn() });
    expect(within(fila('Hojas')).getByRole('radio', { name: 'Una' })).toHaveAttribute('aria-checked', 'true');
    expect(within(fila('Bisagra')).getByRole('radio', { name: 'Un extremo' })).toHaveAttribute('aria-checked', 'true');
    expect(within(fila('Abre hacia')).getByRole('radio', { name: 'Un lado' })).toHaveAttribute('aria-checked', 'true');
    // El color de serie es el de la ESCENA, no uno propio.
    expect(within(fila('Color')).getByRole('radio', { name: 'El de la escena' })).toHaveAttribute('aria-checked', 'true');
  });

  it('cada interruptor manda su cambio, y sólo el suyo', async () => {
    const onDoor = vi.fn();
    const u = userEvent.setup();
    const { re } = mount({ wall: WALL_DOOR, onDoor });
    await u.click(within(fila('Hojas')).getByRole('radio', { name: 'Dos' }));
    expect(onDoor).toHaveBeenLastCalledWith({ leaves: 2 });
    await u.click(within(fila('Bisagra')).getByRole('radio', { name: 'El otro' }));
    expect(onDoor).toHaveBeenLastCalledWith({ hinge: 'end' });
    await u.click(within(fila('Abre hacia')).getByRole('radio', { name: 'El otro' }));
    expect(onDoor).toHaveBeenLastCalledWith({ swing: 'left' });
    // Y volver al de la escena es poner el color a nulo, que es lo que significa «el trazo del muro».
    re({ wall: { ...WALL_DOOR, doorColor: '#8b1a1a' }, onDoor });
    await u.click(within(fila('Color')).getByRole('radio', { name: 'El de la escena' }));
    expect(onDoor).toHaveBeenLastCalledWith({ doorColor: null });
  });

  it('con DOS hojas la bisagra desaparece: cada hoja ya cuelga de su propio extremo', () => {
    mount({ wall: { ...WALL_DOOR, leaves: 2 }, onDoor: vi.fn() });
    expect(screen.getByRole('radiogroup', { name: 'Hojas' })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Bisagra' })).not.toBeInTheDocument();
  });

  it('un VANO DE SALA se edita con los mismos controles, se abre y se BORRA', async () => {
    const onDoor = vi.fn(), onToggleOpen = vi.fn(), onRemove = vi.fn();
    mount({ roomOpening: VANO, onDoor, onToggleOpen, onRemove });
    const u = userEvent.setup();
    await u.click(within(fila('Hojas')).getByRole('radio', { name: 'Dos' }));
    expect(onDoor).toHaveBeenLastCalledWith({ leaves: 2 });
    await u.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(onToggleOpen).toHaveBeenCalled();
    // La papelera: `removeRoomOpening` existía y no la llamaba nadie.
    await u.click(screen.getByRole('button', { name: 'Quitar segmento' }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('trae fila de TEXTURA, del mismo catálogo que la pared y el suelo', async () => {
    const onDoorTexture = vi.fn(), onDoor = vi.fn();
    const { re } = mount({ wall: WALL_DOOR, onDoor, onDoorTexture });
    const u = userEvent.setup();
    // El botón dice ELEGIR y no «+ Subir»: abre el catálogo, no sube nada (corrección suya del 2026-09-07).
    expect(screen.queryByRole('button', { name: '+ Subir' })).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Elegir' }));
    expect(onDoorTexture).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument();
    // Con una puesta, se puede cambiar y quitar — y quitarla es dejarla a nulo.
    re({ wall: { ...WALL_DOOR, doorTextureUrl: 'https://x/roble.png' }, onDoor, onDoorTexture });
    expect(screen.getByRole('button', { name: 'Cambiar' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(onDoor).toHaveBeenLastCalledWith({ doorTextureUrl: null });
  });

  it('un vano de sala NO trae el interruptor de esconder: la sala ES el dibujo del mapa', () => {
    const { re } = mount({ roomOpening: VANO, onDoor: vi.fn(), onVisible: vi.fn() });
    expect(screen.queryByLabelText('visible para jugadores')).not.toBeInTheDocument();
    // Un muro suelto sí lo trae, que es la diferencia.
    re({ wall: WALL_DOOR, roomOpening: null, onDoor: vi.fn(), onVisible: vi.fn() });
    expect(screen.getByLabelText('visible para jugadores')).toBeInTheDocument();
  });
});
