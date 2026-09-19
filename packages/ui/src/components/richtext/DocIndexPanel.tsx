import type { DocIndexEntry } from '@rolvium/core';
import './richtext.css';

export interface DocIndexPanelProps {
  entries: readonly DocIndexEntry[];
  /** Saltar a un título. Quien manda decide cómo: normalmente desplazando hasta `#rt-{id}`. */
  onJump: (blockId: string) => void;
  onClose?: (() => void) | undefined;
  labels: { title: string; empty: string; close: string };
  /** El título que se está leyendo, para marcarlo. */
  currentId?: string | null | undefined;
  className?: string | undefined;
}

/**
 * EL ÍNDICE, **al lado del texto y no dentro del documento** (orden suya, 2026-09-19: «*le das al botón índice
 * y te indexa todo lo que sea H1 y H2 de lo que esté en el h1 padre*» · «*al lado del navegador*»).
 *
 * No calcula nada: recibe lo que `buildDocIndex` saca del documento cada vez que se abre, que es lo que
 * garantiza que no pueda quedarse viejo. Sirve para las tres superficies.
 */
export function DocIndexPanel({ entries, onJump, onClose, labels, currentId, className }: DocIndexPanelProps) {
  return (
    <nav className={`rv-rt-index${className ? ` ${className}` : ''}`} aria-label={labels.title}>
      <div className="rv-rt-index-head">
        <span className="material-symbols-outlined" aria-hidden="true">toc</span>
        <span className="rv-rt-index-title">{labels.title}</span>
        {onClose && (
          <button type="button" className="rv-rt-index-close" onClick={onClose} title={labels.close} aria-label={labels.close}>
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        )}
      </div>
      {entries.length === 0
        ? <p className="rv-rt-index-empty">{labels.empty}</p>
        : (
          <ul className="rv-rt-index-list">
            {entries.map(entry => (
              <li key={entry.id}>
                <button
                  type="button"
                  className={`rv-rt-index-h1${entry.id === currentId ? ' on' : ''}`}
                  onClick={() => onJump(entry.id)}
                >
                  {entry.text}
                </button>
                {entry.children.length > 0 && (
                  <ul>
                    {entry.children.map(child => (
                      <li key={child.id}>
                        <button
                          type="button"
                          className={`rv-rt-index-h2${child.id === currentId ? ' on' : ''}`}
                          onClick={() => onJump(child.id)}
                        >
                          {child.text}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
    </nav>
  );
}
