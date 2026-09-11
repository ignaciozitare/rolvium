import { useId, type ReactNode } from 'react';
import './panel.css';

export interface SliderProps {
  /** El nombre: se ve (salvo con `hideLabel`) y es el nombre accesible de la barra. */
  label: string;
  /**
   * Otro nombre para el lector de pantalla cuando el rótulo que se ve se queda corto: el tamaño de las fichas
   * ENSEÑA «TAMAÑO» y la barra se LLAMA «TAMAÑO DE LAS FICHAS · TODA LA ESCENA».
   */
  ariaLabel?: string | undefined;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Lo que se lee al lado de la barra: «1,2 casillas», «60 %», «15°». Sin él no se pinta lectura. */
  valueText?: ReactNode;
  /**
   * SE SOLTÓ. Mover es continuo y guardar es una vez: sin esto cada paso del deslizador sería una escritura
   * en la base. Salta con `pointerup` (ratón) y `keyup` (teclado), las dos formas de soltar un deslizador.
   */
  onCommit?: (() => void) | undefined;
  /** Guardar también al perder el foco. */
  commitOnBlur?: boolean | undefined;
  /**
   * `stacked` (de serie, el del Pincel): rótulo y lectura arriba, la barra debajo a todo lo ancho.
   * `inline`: rótulo, barra y lectura en una fila, como ya lo llevaban el Builder y las luces.
   */
  layout?: 'stacked' | 'inline' | undefined;
  /** Sólo en `inline`: el rótulo no se ve, pero sigue siendo el nombre de la barra. */
  hideLabel?: boolean | undefined;
  /** Lo que lee un lector de pantalla cuando el número solo no dice nada. */
  ariaValueText?: string | undefined;
  /** Muescas sobre la barra (el valor de siempre, por ejemplo), con el `datalist` del navegador. */
  ticks?: readonly number[] | undefined;
  /** El `id` del `datalist` de las muescas, cuando quien lo usa necesita uno fijo. */
  ticksId?: string | undefined;
  /** Para colocarlo o darle ancho desde fuera. El aspecto no se toca desde fuera. */
  className?: string | undefined;
}

/**
 * EL DESLIZADOR DE LA MESA. Uno solo para todos los paneles: antes había tres maneras de hacerlo —apilado en el
 * Pincel, en fila en el Builder y en las luces— y dos de ellas ni siquiera llevaban el color de la mesa.
 *
 * Primitiva neutra, como `Tooltip`: el aspecto entra SÓLO por las variables `--sys-*`.
 */
export function Slider({
  label, ariaLabel, value, min, max, step, onChange, valueText, onCommit, commitOnBlur = false,
  layout = 'stacked', hideLabel = false, ariaValueText, ticks, ticksId, className,
}: SliderProps) {
  const autoId = useId();
  const listId = ticks?.length ? (ticksId ?? autoId) : undefined;
  const muescas = listId && ticks ? <datalist id={listId}>{ticks.map(v => <option key={v} value={v} />)}</datalist> : null;
  // Sin el evento: a quien guarda no le importa cómo se soltó, y así no le llega un argumento que no espera.
  const commit = onCommit ? (): void => onCommit() : undefined;
  const barra = (
    <input type="range" min={min} max={max} step={step} value={value} aria-label={ariaLabel ?? label}
      aria-valuetext={ariaValueText} list={listId}
      onChange={e => onChange(Number(e.target.value))}
      onPointerUp={commit} onKeyUp={commit} onBlur={commitOnBlur ? commit : undefined} />
  );
  const lectura = valueText === undefined || valueText === null ? null : <span className="rv-slider-v">{valueText}</span>;
  const extra = className ? ` ${className}` : '';

  if (layout === 'inline') {
    return (
      <label className={`rv-slider inline${extra}`}>
        <span className={hideLabel ? 'rv-sr-only' : 'rv-slider-l'}>{label}</span>
        {muescas}
        {barra}
        {lectura}
      </label>
    );
  }
  return (
    <label className={`rv-slider${extra}`}>
      <span className="rv-slider-head">
        <span className="rv-fpanel-label">{label}</span>
        {lectura}
      </span>
      {muescas}
      {barra}
    </label>
  );
}
