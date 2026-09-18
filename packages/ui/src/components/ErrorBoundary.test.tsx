import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

/** Un trozo que revienta AL PINTARSE, que es lo único que una red de React puede parar. */
function Revienta({ roto }: { roto: boolean }): JSX.Element {
  if (roto) throw new Error('data.points de undefined');
  return <p>el trozo, entero</p>;
}

const fallback = (reintentar: () => void) => (
  <div><span>se ha roto</span><button type="button" onClick={reintentar}>reintentar</button></div>
);

afterEach(() => { vi.restoreAllMocks(); });
/* React escribe el error por su cuenta además del nuestro; se silencia para que el test se lea. */
const callar = () => vi.spyOn(console, 'error').mockImplementation(() => {});

describe('ErrorBoundary', () => {
  it('sin error, no se mete en medio: pinta lo suyo', () => {
    render(<ErrorBoundary fallback={fallback}><Revienta roto={false} /></ErrorBoundary>);
    expect(screen.getByText('el trozo, entero')).toBeInTheDocument();
    expect(screen.queryByText('se ha roto')).toBeNull();
  });

  it('un error al pintar se queda DENTRO: lo de al lado sigue vivo', () => {
    callar();
    render(
      <div>
        <p>lo de al lado</p>
        <ErrorBoundary fallback={fallback}><Revienta roto /></ErrorBoundary>
      </div>,
    );
    expect(screen.getByText('se ha roto')).toBeInTheDocument();
    // Esto es TODO el arreglo: antes, esto desaparecía con el resto del árbol.
    expect(screen.getByText('lo de al lado')).toBeInTheDocument();
  });

  it('reintentar vuelve a montar el trozo, y si ya no falla se ve entero', async () => {
    callar();
    function Padre(): JSX.Element {
      const [roto, setRoto] = useState(true);
      return (
        <ErrorBoundary fallback={r => (
          <button type="button" onClick={() => { setRoto(false); r(); }}>reintentar</button>
        )}><Revienta roto={roto} /></ErrorBoundary>
      );
    }
    render(<Padre />);
    await userEvent.click(screen.getByRole('button', { name: 'reintentar' }));
    expect(screen.getByText('el trozo, entero')).toBeInTheDocument();
  });

  it('deja el error escrito con el nombre del trozo, y avisa a quien quiera enterarse', () => {
    const espia = callar();
    const onError = vi.fn();
    render(<ErrorBoundary label="maps:canvas" fallback={fallback} onError={onError}><Revienta roto /></ErrorBoundary>);
    expect(espia.mock.calls.some(c => String(c[0]).includes('maps:canvas'))).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0]![0] as Error).message).toContain('data.points');
  });
});
