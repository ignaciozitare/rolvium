import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './Layout';

describe('EmptyState — el tono', () => {
  it('de serie va en acento, como siempre', () => {
    const { container } = render(<EmptyState icon="auto_stories" title="Sin campañas" />);
    expect(container.querySelector('span')).toHaveStyle({ background: 'var(--ac-dim)', color: 'var(--ac)' });
  });

  it('`red` sigue siendo rojo: nadie que ya lo use cambia de aspecto', () => {
    const { container } = render(<EmptyState icon="key_off" title="Código inválido" tone="red" />);
    expect(container.querySelector('span')).toHaveStyle({ background: 'var(--red-dim)', color: 'var(--red)' });
  });

  it('`amber` es el de «se ha roto y no es culpa tuya» (2026-09-17, la red de errores)', () => {
    // Va aparte del rojo a propósito: el rojo de esta familia es «has hecho algo mal», y usarlo para la red
    // haría pensar que se ha perdido algo cuando no se pierde nada.
    const { container } = render(<EmptyState icon="warning" title="Algo se ha roto" tone="amber" />);
    expect(container.querySelector('span')).toHaveStyle({ background: 'var(--amber-dim)', color: 'var(--amber)' });
  });

  it('pinta lo que se le da: icono, título, descripción y acciones', () => {
    render(<EmptyState icon="warning" title="Algo se ha roto" description="No has perdido nada." actions={<button type="button">Reintentar</button>} />);
    expect(screen.getByText('warning')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Algo se ha roto' })).toBeInTheDocument();
    expect(screen.getByText('No has perdido nada.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
