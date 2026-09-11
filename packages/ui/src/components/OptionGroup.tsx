import type { ReactNode } from 'react';
import './panel.css';

export interface OptionItem<V extends string | number> {
  value: V;
  label: ReactNode;
  /** Un Material Symbol por su nombre, o cualquier dibujo propio (la punta del pincel). */
  icon?: ReactNode;
  /** Ocupa la fila entera, como «Destapar lo de debajo». */
  wide?: boolean | undefined;
}

export interface OptionGroupProps<V extends string | number> {
  ariaLabel: string;
  options: readonly OptionItem<V>[];
  value: V;
  onChange: (value: V) => void;
  /** `chip` (de serie, el del Pincel): relleno suave. `outline` (el del Builder): con filo. */
  look?: 'chip' | 'outline' | undefined;
  /** Columnas de la rejilla; `row` = todas en una fila, a partes iguales. */
  columns?: 2 | 3 | 'row' | undefined;
  /** Mayúsculas espaciadas, de serie. Apagado para nombres que se leen como palabras, como los tipos de luz. */
  caps?: boolean | undefined;
  className?: string | undefined;
}

/**
 * ELEGIR UNA DE VARIAS en un panel de la mesa: «Sobre qué pinto», la forma del Builder, el tipo de luz.
 *
 * Lo ELEGIDO va SIEMPRE en rojo sangre, y no se puede cambiar desde fuera a propósito: en la vista del
 * director el negro es el fondo sobre el que se ve arte y el oro es la herramienta activa de la barra (reglas
 * del dueño, 2026-08-31 y 2026-09-04). El editor de luces llevaba lo elegido en negro y en oro; ya no.
 *
 * No sirve para muestras de color ni para miniaturas con dibujo: ahí lo que se elige ES el arte.
 */
export function OptionGroup<V extends string | number>({
  ariaLabel, options, value, onChange, look = 'chip', columns = 2, caps = true, className,
}: OptionGroupProps<V>) {
  return (
    <div className={`rv-options cols-${columns}${className ? ` ${className}` : ''}`} role="radiogroup" aria-label={ariaLabel}>
      {options.map(o => {
        const on = o.value === value;
        const cls = ['rv-option', look, caps ? 'caps' : '', on ? 'on' : '', o.wide ? 'wide' : ''].filter(Boolean).join(' ');
        return (
          <button key={String(o.value)} type="button" role="radio" aria-checked={on} className={cls} onClick={() => onChange(o.value)}>
            {typeof o.icon === 'string'
              ? <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }} aria-hidden="true">{o.icon}</span>
              : o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
