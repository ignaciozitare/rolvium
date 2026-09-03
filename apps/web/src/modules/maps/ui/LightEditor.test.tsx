import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { LIGHT_BULB, LIGHT_SECRET, LIGHT_TORCH } from '../../../../tests/helpers/fakes';
import { LIGHT_COLORS } from '../domain/useCases/layerRules';
import { LightEditor } from './LightEditor';

// jsdom no trae PointerEvent: un MouseEvent con pointerId basta para los gestos, como en MapCanvas.test.
class FakePointerEvent extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) { super(type, init); this.pointerId = init.pointerId ?? 0; }
}
(globalThis as unknown as { PointerEvent: unknown }).PointerEvent = FakePointerEvent;

function mount(light = LIGHT_TORCH) {
  const cb = { onChange: vi.fn(), onRemove: vi.fn(), onClose: vi.fn() };
  renderWithProviders(<LightEditor light={light} {...cb} />);
  return cb;
}

describe('<LightEditor> — los iconos dicen qué hacen', () => {
  it('borrar y cerrar llevan tooltip', () => {
    mount();
    const tips = [...document.querySelectorAll('.rv-tip')].map(x => x.textContent ?? '');
    expect(tips).toContain('Borrar la luz');
    expect(tips).toContain('Cerrar el editor');
  });
});

describe('<LightEditor>', () => {
  it('marca la forma y el tipo de la luz que se está tocando', () => {
    mount();
    expect(screen.getByRole('radio', { name: 'Radio' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Cono' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'Antorcha' })).toHaveAttribute('aria-checked', 'true');
  });

  it('cambiar forma y tipo sale por el mismo sitio', async () => {
    const u = userEvent.setup();
    const cb = mount();
    await u.click(screen.getByRole('radio', { name: 'Cuadrado' }));
    expect(cb.onChange).toHaveBeenCalledWith({ shape: 'square' });
    await u.click(screen.getByRole('radio', { name: 'Hoguera' }));
    expect(cb.onChange).toHaveBeenLastCalledWith({ kind: 'fire' });
  });

  /** La apertura sólo tiene sentido en un cono; en radio y cuadrado no se enseña para no prometer nada. */
  it('la apertura del cono sólo aparece con la forma cono, y se ajusta', () => {
    mount();
    expect(screen.queryByRole('slider', { name: 'Apertura del cono en grados' })).not.toBeInTheDocument();
    document.body.innerHTML = '';
    const cb = mount({ ...LIGHT_TORCH, shape: 'cone' });
    const slider = screen.getByRole('slider', { name: 'Apertura del cono en grados' });
    expect(slider).toHaveValue('60');
    expect(screen.getByText('60°')).toBeInTheDocument();
    fireEvent.change(slider, { target: { value: '120' } });
    expect(cb.onChange).toHaveBeenCalledWith({ coneAngle: 120 });
  });

  it('el color sale de la paleta y se marca el puesto', async () => {
    const u = userEvent.setup();
    const cb = mount();
    expect(screen.getByRole('radio', { name: 'Color 1' })).toHaveAttribute('aria-checked', 'true');
    await u.click(screen.getByRole('radio', { name: 'Color 5' }));
    expect(cb.onChange).toHaveBeenCalledWith({ color: LIGHT_COLORS[4] });
  });

  /**
   * Lo que el dueño pidió al aprobar el diseño: que parpadeen de verdad. Que se anima no se ve en un
   * interruptor, así que se dice con todas las letras junto a él.
   */
  it('avisa de que el parpadeo SE ANIMA, y sólo cuando está puesto', async () => {
    const u = userEvent.setup();
    const cb = mount();
    expect(screen.getByText('Se anima')).toBeInTheDocument();
    await u.click(screen.getByRole('checkbox', { name: 'Parpadea' }));
    expect(cb.onChange).toHaveBeenCalledWith({ flicker: false });
    document.body.innerHTML = '';
    mount(LIGHT_BULB);
    expect(screen.queryByText('Se anima')).not.toBeInTheDocument();
  });

  /**
   * Alcance y sombra no se usan todavía. Salen igual —y rotulados «se guardan ya»— porque añadirlos el día
   * que las luces iluminen obligaría a repasar a mano todas las luces ya colocadas de todas las escenas.
   */
  it('deja poner el alcance en metros y encender la sombra, que es lo que la recorta contra los muros', async () => {
    const u = userEvent.setup();
    const cb = mount();
    expect(screen.getByText('Alcance y sombra')).toBeInTheDocument();
    expect(screen.getByText('6 m')).toBeInTheDocument();
    await u.click(screen.getByRole('checkbox', { name: 'Proyecta sombra' }));
    expect(cb.onChange).toHaveBeenCalledWith({ castsShadow: true });
  });

  it('el alcance se redondea a medio metro y no se sale de madre', async () => {
    const u = userEvent.setup();
    const cb = mount();
    const box = screen.getByRole('spinbutton', { name: 'Alcance en metros' });
    await u.clear(box);
    await u.type(box, '9999');
    expect(cb.onChange).toHaveBeenLastCalledWith({ rangeM: 60 });
  });

  /** Que hoy la luz no ilumine tiene que estar EN PANTALLA, no sólo en el código. */
  it('dice en pantalla cómo se sale del panel y qué hace la luz', () => {
    mount();
    expect(screen.getByText(/la X lo cierra sin borrar la luz/)).toBeInTheDocument();
  });

  it('se puede borrar', async () => {
    const u = userEvent.setup();
    const cb = mount();
    await u.click(screen.getByRole('button', { name: 'Borrar la luz' }));
    expect(cb.onRemove).toHaveBeenCalled();
  });
});


/**
 * Regresión, dueño 2026-08-31: «no puedo mover el modal de luces ni cerrarlo». Con la herramienta de luces un
 * clic fuera COLOCA otra luz, y cambiar de herramienta tampoco lo quitaba: el panel se quedaba tapando el
 * mapa hasta borrar la luz. Ahora tiene X, Escape y se arrastra por la cabecera.
 */
describe('<LightEditor> · salir y apartarlo', () => {
  it('la X cierra sin borrar la luz — son dos botones distintos y no se confunden', async () => {
    const cb = mount();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar el editor' }));
    expect(cb.onClose).toHaveBeenCalledTimes(1);
    expect(cb.onRemove).not.toHaveBeenCalled();
  });

  it('Escape también cierra: es la salida que se busca a ciegas', () => {
    const cb = mount();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(cb.onClose).toHaveBeenCalledTimes(1);
    expect(cb.onRemove).not.toHaveBeenCalled();
  });

  /**
   * Se arrastra por la cabecera, y **sale del mapa**: el lienzo recorta lo que se sale de él, así que al
   * agarrarlo el panel pasa a `fixed` y desde ahí va por toda la ventana (dueño, 2026-09-03).
   */
  it('se arrastra por la cabecera, sale del mapa y se corre con el ratón', () => {
    mount();
    const panel = screen.getByRole('group', { name: /Luz/ }) as HTMLElement;
    const head = panel.querySelector('.mp-light-head') as HTMLElement;
    expect(panel.style.position).toBe('');            // sin tocarlo, lo coloca el CSS
    fireEvent.pointerDown(head, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(head, { clientX: 160, clientY: 130, pointerId: 1 });
    expect(panel.style.position).toBe('fixed');
    expect([panel.style.left, panel.style.top]).toEqual(['60px', '30px']);
    // Al soltar se queda donde lo dejaste: mover no es un gesto que se deshaga solo.
    fireEvent.pointerUp(head, { pointerId: 1 });
    fireEvent.pointerMove(head, { clientX: 400, clientY: 400, pointerId: 1 });
    expect([panel.style.left, panel.style.top]).toEqual(['60px', '30px']);
  });

  it('pulsar borrar o cerrar NO empieza un arrastre: los botones mandan sobre el asa', () => {
    mount();
    const panel = screen.getByRole('group', { name: /Luz/ });
    const head = panel.querySelector('.mp-light-head') as HTMLElement;
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Borrar la luz' }), { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(head, { clientX: 300, clientY: 300, pointerId: 1 });
    expect((panel as HTMLElement).style.position).toBe('');
  });
});


/**
 * Dueño, 2026-08-31: «el cono tengo para ajustar el ángulo de iluminación pero no lo puedo rotar». La
 * apertura sin la dirección no sirve: un foco que sólo puede mirar a la derecha no es un foco. `rotation` ya
 * se guardaba y ya la leía el recorte contra los muros; lo que faltaba era poder tocarla.
 */
describe('<LightEditor> · el cono apunta a algún lado', () => {
  it('un cono trae apertura Y dirección, y la dirección se guarda', () => {
    const cb = mount(LIGHT_SECRET);
    expect(screen.getByRole('slider', { name: 'Apertura del cono en grados' })).toBeInTheDocument();
    const dir = screen.getByRole('slider', { name: 'Hacia dónde apunta' });
    fireEvent.change(dir, { target: { value: '135' } });
    expect(cb.onChange).toHaveBeenCalledWith({ rotation: 135 });
  });

  it('una luz de radio no enseña ninguna de las dos: no hay hacia dónde apuntar una bombilla', () => {
    mount(LIGHT_TORCH);
    expect(screen.queryByRole('slider', { name: 'Apertura del cono en grados' })).not.toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: 'Hacia dónde apunta' })).not.toBeInTheDocument();
  });

  it('una dirección guardada fuera de la vuelta se enseña dentro de ella', () => {
    mount({ ...LIGHT_SECRET, rotation: -90 });
    expect(screen.getByText('270°')).toBeInTheDocument();
  });
});

/** 🚨 «Que gire sola», § 7.2. Sólo con el cono, y un solo dato: `spinMs = 0` es quieta. */
describe('<LightEditor> la luz que gira', () => {
  it('el interruptor NO sale con un radio: girar sólo significa algo en un cono', () => {
    mount(LIGHT_TORCH);
    expect(screen.queryByRole('checkbox', { name: 'Que gire sola' })).not.toBeInTheDocument();
  });

  it('encenderlo pone la vuelta por defecto, y apagarlo la deja en cero', async () => {
    const u = userEvent.setup();
    const cb = mount({ ...LIGHT_SECRET, shape: 'cone', spinMs: 0 });
    await u.click(screen.getByRole('checkbox', { name: 'Que gire sola' }));
    expect(cb.onChange).toHaveBeenCalledWith({ spinMs: 4000 });
    document.body.innerHTML = '';
    const cb2 = mount({ ...LIGHT_SECRET, shape: 'cone', spinMs: 4000 });
    await u.click(screen.getByRole('checkbox', { name: 'Que gire sola' }));
    expect(cb2.onChange).toHaveBeenCalledWith({ spinMs: 0 });
  });

  it('la vuelta sólo se puede tocar si gira, y se rotula en segundos', () => {
    mount({ ...LIGHT_SECRET, shape: 'cone', spinMs: 0 });
    expect(screen.queryByRole('slider', { name: 'Vuelta' })).not.toBeInTheDocument();
    document.body.innerHTML = '';
    const cb = mount({ ...LIGHT_SECRET, shape: 'cone', spinMs: 4000 });
    expect(screen.getByText('4 s')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('slider', { name: 'Vuelta' }), { target: { value: '2000' } });
    expect(cb.onChange).toHaveBeenLastCalledWith({ spinMs: 2000 });
  });
});


/**
 * 🕯 LA BARRA DE INTENSIDAD (§ 7.2, dueño 2026-09-01: «cada una además del alcance color etc necesita una
 * barra de intensidad»). Cuánto CANTA la luz, que no es cuánto ILUMINA: eso es el alcance y sigue aparte.
 */
describe('<LightEditor> la intensidad', () => {
  it('la barra sale en todas las luces, con su valor escrito al lado', () => {
    for (const light of [LIGHT_TORCH, LIGHT_BULB, { ...LIGHT_SECRET, shape: 'cone' as const }]) {
      document.body.innerHTML = '';
      mount({ ...light, intensity: 60 });
      expect(screen.getByRole('slider', { name: 'Intensidad' })).toHaveValue('60');
      expect(screen.getByText('60 %')).toBeInTheDocument();
    }
  });

  it('moverla avisa con el valor nuevo', () => {
    const cb = mount({ ...LIGHT_TORCH, intensity: 100 });
    fireEvent.change(screen.getByRole('slider', { name: 'Intensidad' }), { target: { value: '35' } });
    expect(cb.onChange).toHaveBeenCalledWith({ intensity: 35 });
  });

  it('no deja apagarla del todo ni pasarse: una luz invisible parece borrada', () => {
    const cb = mount({ ...LIGHT_TORCH, intensity: 100 });
    const bar = screen.getByRole('slider', { name: 'Intensidad' });
    expect(bar).toHaveAttribute('min', '10');
    // El techo es 200: 100 es «como se pintaba siempre», y por encima está el margen que él pidió.
    expect(bar).toHaveAttribute('max', '200');
    fireEvent.change(bar, { target: { value: '0' } });
    expect(cb.onChange).toHaveBeenLastCalledWith({ intensity: 10 });
    fireEvent.change(bar, { target: { value: '900' } });
    expect(cb.onChange).toHaveBeenLastCalledWith({ intensity: 200 });
  });

  it('es cosa distinta del alcance: las dos conviven y no se pisan', () => {
    mount({ ...LIGHT_TORCH, intensity: 50, rangeM: 6 });
    expect(screen.getByRole('slider', { name: 'Intensidad' })).toHaveValue('50');
    expect(screen.getByRole('spinbutton', { name: 'Alcance en metros' })).toHaveValue(6);
  });
});


/**
 * 🎨 LA PALETA (dueño, 2026-09-02: «debería poder elegir más colores, no solo esos»). Doce en vez de seis.
 */
describe('<LightEditor> la paleta de colores', () => {
  it('ofrece los doce, cada uno con su puesto', () => {
    mount();
    expect(LIGHT_COLORS).toHaveLength(12);
    for (let i = 0; i < LIGHT_COLORS.length; i++) {
      expect(screen.getByRole('radio', { name: `Color ${i + 1}` })).toBeInTheDocument();
    }
  });

  /**
   * 🔒 Los seis de siempre SIGUEN en la paleta. Si uno desapareciera, una luz ya guardada con ese color se
   * quedaría con un color que el director ya no puede volver a elegir — y él dijo «no borres nada».
   */
  it('no se ha perdido ninguno de los seis originales', () => {
    for (const c of ['#e8a24e', '#f0e6c8', '#e07a3c', '#e0625c', '#a97fe0', '#9fb6d4']) {
      expect(LIGHT_COLORS).toContain(c);
    }
  });
});
