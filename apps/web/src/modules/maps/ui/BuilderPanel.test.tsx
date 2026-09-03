import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, within, fireEvent } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { WALL_1, WALL_DOOR } from '../../../../tests/helpers/fakes';
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
    const asa = container.querySelector('.mp-builder-head') as HTMLElement;
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
    expect(screen.getByText(/se levantan MUROS normales/)).toBeInTheDocument();
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
    expect(screen.getByText(/pincha otra vez sobre el primero/)).toBeInTheDocument();
    re({ shape: 'line' });
    expect(screen.getByText(/sale un muro, y sólo uno/)).toBeInTheDocument();
    re({ shape: 'rect' });
    expect(screen.getByText(/arrastra para levantar la sala/)).toBeInTheDocument();
  });
});

/**
 * EL CANDADO, aprobado el 2026-09-03 («*tira*»). Empieza cerrado: sin tocarlo, Builder es el de siempre.
 */
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
