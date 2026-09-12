import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent, within } from '../helpers/render';
import userEvent from '@testing-library/user-event';
import { FloatingPanel, OptionGroup, PanelHint, PanelIconButton, PanelNote, PanelSection, Slider } from '@rolvium/ui';

// jsdom no trae PointerEvent: un MouseEvent con pointerId basta para los gestos, como en BuilderPanel.test.
class FakePointerEvent extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) { super(type, init); this.pointerId = init.pointerId ?? 0; }
}
(globalThis as unknown as { PointerEvent: unknown }).PointerEvent = FakePointerEvent;

/**
 * LAS PIEZAS DE LOS PANELES DE LA MESA en `@rolvium/ui` (revisión del 2026-09-11). El Builder, el Pincel y el
 * editor de luces llevaban cada uno su copia de la carcasa, del deslizador y de los botones de opción; ahora
 * son estas. Lo que aquí se fija es lo que los tres ya hacían y no puede perderse al compartirlo.
 */
describe('<FloatingPanel>', () => {
  function mount(over: Partial<React.ComponentProps<typeof FloatingPanel>> = {}) {
    const onClose = vi.fn();
    const r = renderWithProviders(
      <FloatingPanel title="Pincel" moveLabel="Mover el panel" closeLabel="Cerrar el pincel" onClose={onClose} className="mi-sitio"
        icon={<span data-testid="icono">brush</span>} {...over}>
        <p>contenido</p>
      </FloatingPanel>,
    );
    return { ...r, onClose };
  }

  it('es un grupo con nombre, título, icono y contenido, y lleva la clase de quien lo coloca', () => {
    mount();
    const panel = screen.getByRole('group', { name: 'Pincel' });
    expect(panel).toHaveClass('rv-fpanel', 'mi-sitio');
    expect(within(panel).getByText('Pincel')).toBeInTheDocument();
    expect(within(panel).getByTestId('icono')).toBeInTheDocument();
    expect(within(panel).getByText('contenido')).toBeInTheDocument();
    expect(panel.querySelector('.rv-fpanel-head')).toHaveAttribute('title', 'Mover el panel');
  });

  it('el nombre del grupo puede ser otro que el título', () => {
    mount({ ariaLabel: 'Elegir la antorcha' });
    expect(screen.getByRole('group', { name: 'Elegir la antorcha' })).toBeInTheDocument();
  });

  it('la X cierra, y lleva tooltip', async () => {
    const { onClose } = mount();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar el pincel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect([...document.querySelectorAll('.rv-tip')].map(t => t.textContent)).toContain('Cerrar el pincel');
  });

  it('las acciones de la cabecera van antes de la X', () => {
    const onRemove = vi.fn();
    mount({ actions: <PanelIconButton icon="delete" label="Borrar la luz" onClick={onRemove} /> });
    const botones = screen.getAllByRole('button').map(b => b.getAttribute('aria-label'));
    expect(botones).toEqual(['Borrar la luz', 'Cerrar el pincel']);
    fireEvent.click(screen.getByRole('button', { name: 'Borrar la luz' }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('se agarra por la cabecera, se sale del mapa y se queda donde lo sueltas', () => {
    mount();
    const panel = screen.getByRole('group', { name: 'Pincel' });
    const asa = panel.querySelector('.rv-fpanel-head') as HTMLElement;
    expect(panel.style.position).toBe('');
    fireEvent.pointerDown(asa, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(asa, { clientX: 160, clientY: 130, pointerId: 1 });
    expect(panel.style.position).toBe('fixed');
    expect([panel.style.left, panel.style.top]).toEqual(['60px', '30px']);
    fireEvent.pointerUp(asa, { pointerId: 1 });
    fireEvent.pointerMove(asa, { clientX: 400, clientY: 400, pointerId: 1 });
    expect([panel.style.left, panel.style.top]).toEqual(['60px', '30px']);
  });

  it('pulsar un botón de la cabecera NO empieza un arrastre', () => {
    mount();
    const panel = screen.getByRole('group', { name: 'Pincel' });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Cerrar el pincel' }), { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(panel.querySelector('.rv-fpanel-head') as HTMLElement, { clientX: 300, clientY: 300, pointerId: 1 });
    expect(panel.style.position).toBe('');
  });

  it('Escape NO cierra de serie: en el Builder es para cancelar el polígono', () => {
    const { onClose } = mount();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('con closeOnEscape, Escape cierra', () => {
    const { onClose } = mount({ closeOnEscape: true });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('<PanelSection> · <PanelHint> · <PanelNote>', () => {
  it('el bloque lleva su rótulo, su clase y su testid; la pista y la nota se leen', () => {
    renderWithProviders(
      <PanelSection label="Forma" className="mp-door-opts" testId="bloque">
        <PanelHint>lo elegido es el límite</PanelHint>
        <PanelNote>se arrastra por la cabecera</PanelNote>
      </PanelSection>,
    );
    const bloque = screen.getByTestId('bloque');
    expect(bloque.tagName).toBe('FIELDSET');
    expect(bloque).toHaveClass('rv-fpanel-section', 'mp-door-opts');
    expect(within(bloque).getByText('Forma').tagName).toBe('LEGEND');
    expect(screen.getByText('lo elegido es el límite')).toHaveClass('rv-fpanel-hint');
    const nota = screen.getByText('se arrastra por la cabecera');
    expect(nota).toHaveClass('rv-fpanel-note');
    expect(nota.querySelector('.material-symbols-outlined')?.textContent).toBe('info');
  });

  it('la pista puede ir en un span, dentro de un texto que no admite párrafos', () => {
    renderWithProviders(<span><PanelHint as="span">se queda puesto</PanelHint></span>);
    const pista = screen.getByText('se queda puesto');
    expect(pista.tagName).toBe('SPAN');
    expect(pista).toHaveClass('rv-fpanel-hint');
  });
});

describe('<Slider>', () => {
  it('el nombre de la barra puede ser otro que el rótulo que se ve, y guardar no recibe el evento', () => {
    const onCommit = vi.fn();
    renderWithProviders(
      <Slider label="TAMAÑO" ariaLabel="TAMAÑO DE LAS FICHAS" value={1} min={0} max={2} step={0.1} layout="inline"
        onChange={() => {}} onCommit={onCommit} commitOnBlur />,
    );
    const barra = screen.getByRole('slider', { name: 'TAMAÑO DE LAS FICHAS' });
    expect(screen.getByText('TAMAÑO')).toHaveClass('rv-slider-l');
    fireEvent.pointerUp(barra, { pointerId: 1 });
    fireEvent.blur(barra);
    expect(onCommit).toHaveBeenCalledTimes(2);
    expect(onCommit.mock.calls.every(args => args.length === 0)).toBe(true);
  });

  it('apilado: rótulo y lectura arriba, mueve en vivo y guarda al soltar con ratón o teclado', () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    renderWithProviders(<Slider label="Tamaño" value={12} min={2} max={60} step={1} valueText="1,2 casillas" onChange={onChange} onCommit={onCommit} />);
    const barra = screen.getByRole('slider', { name: 'Tamaño' });
    expect(barra).toHaveValue('12');
    expect(barra.closest('.rv-slider')).not.toHaveClass('inline');
    expect(screen.getByText('1,2 casillas')).toHaveClass('rv-slider-v');
    fireEvent.change(barra, { target: { value: '35' } });
    expect(onChange).toHaveBeenCalledWith(35);
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(barra, { pointerId: 1 });
    fireEvent.keyUp(barra, { key: 'ArrowRight' });
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it('perder el foco no guarda, salvo que se pida', () => {
    const sin = vi.fn();
    const con = vi.fn();
    renderWithProviders(<>
      <Slider label="Uno" value={1} min={0} max={2} step={1} onChange={() => {}} onCommit={sin} />
      <Slider label="Dos" value={1} min={0} max={2} step={1} onChange={() => {}} onCommit={con} commitOnBlur />
    </>);
    fireEvent.blur(screen.getByRole('slider', { name: 'Uno' }));
    fireEvent.blur(screen.getByRole('slider', { name: 'Dos' }));
    expect(sin).not.toHaveBeenCalled();
    expect(con).toHaveBeenCalledTimes(1);
  });

  it('en fila, con el rótulo escondido, sigue teniendo nombre; sin lectura no pinta lectura', () => {
    renderWithProviders(<Slider label="Intensidad" value={60} min={0} max={100} step={5} layout="inline" hideLabel onChange={() => {}} />);
    const barra = screen.getByRole('slider', { name: 'Intensidad' });
    const fila = barra.closest('.rv-slider') as HTMLElement;
    expect(fila).toHaveClass('inline');
    expect(within(fila).getByText('Intensidad')).toHaveClass('rv-sr-only');
    expect(fila.querySelector('.rv-slider-v')).toBeNull();
  });

  it('las muescas van en un datalist con el id que se le pida, y el texto para el lector', () => {
    const { container } = renderWithProviders(
      <Slider label="Fichas" value={1} min={0.3} max={1.5} step={0.01} ticks={[1]} ticksId="mis-muescas" ariaValueText="1 casilla" onChange={() => {}} />,
    );
    const barra = screen.getByRole('slider', { name: 'Fichas' });
    expect(barra).toHaveAttribute('list', 'mis-muescas');
    expect(barra).toHaveAttribute('aria-valuetext', '1 casilla');
    expect(container.querySelector('#mis-muescas option')).toHaveAttribute('value', '1');
  });
});

describe('<OptionGroup>', () => {
  const OPCIONES = [
    { value: 'room', label: 'Habitación', icon: 'dashboard' },
    { value: 'rock', label: 'Muro', icon: <span data-testid="dibujo" /> },
    { value: 'uncover', label: 'Destapar lo de debajo', wide: true },
  ] as const;

  it('marca la elegida, en sangre, y avisa de la que se pulsa', async () => {
    const onChange = vi.fn();
    renderWithProviders(<OptionGroup ariaLabel="Sobre qué pinto" options={OPCIONES} value="room" onChange={onChange} />);
    const grupo = screen.getByRole('radiogroup', { name: 'Sobre qué pinto' });
    expect(grupo).toHaveClass('rv-options', 'cols-2');
    const room = within(grupo).getByRole('radio', { name: /Habitación/ });
    expect(room).toHaveAttribute('aria-checked', 'true');
    expect(room).toHaveClass('rv-option', 'chip', 'caps', 'on');
    expect(within(grupo).getByRole('radio', { name: /Muro/ })).toHaveAttribute('aria-checked', 'false');
    await userEvent.setup().click(within(grupo).getByRole('radio', { name: /Muro/ }));
    expect(onChange).toHaveBeenCalledWith('rock');
  });

  it('el icono puede ser un Material Symbol o un dibujo, y lo que va solo ocupa la fila', () => {
    renderWithProviders(<OptionGroup ariaLabel="Qué" options={OPCIONES} value="room" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: /Habitación/ }).querySelector('.material-symbols-outlined')?.textContent).toBe('dashboard');
    expect(screen.getByTestId('dibujo')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Destapar/ })).toHaveClass('wide');
  });

  it('con filo, en fila o en tres columnas, y sin versalitas para los nombres que se leen', () => {
    renderWithProviders(<>
      <OptionGroup ariaLabel="Forma" options={[{ value: 'cone', label: 'Cono' }, { value: 'radius', label: 'Radio' }]} value="cone" onChange={() => {}} look="outline" columns="row" />
      <OptionGroup ariaLabel="Tipo" options={[{ value: 'torch', label: 'Antorcha' }]} value="torch" onChange={() => {}} look="outline" columns={3} caps={false} />
    </>);
    expect(screen.getByRole('radiogroup', { name: 'Forma' })).toHaveClass('cols-row');
    expect(screen.getByRole('radio', { name: 'Cono' })).toHaveClass('outline', 'on');
    expect(screen.getByRole('radiogroup', { name: 'Tipo' })).toHaveClass('cols-3');
    expect(screen.getByRole('radio', { name: 'Antorcha' })).not.toHaveClass('caps');
  });
});
