import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { Drawing } from '@/modules/maps/domain/entities/Scene';
import { SafeRegion } from '@/shared/ui/SafeRegion';
import { renderWithProviders } from '../helpers/render';

/**
 * 🐞 LA RED (spec: `specs/core/errors/SPEC.md`; maqueta: `rolvium.pen` § 11, aprobada por él el 2026-09-17).
 *
 * Su orden: «*cualquier error al pintar te tumba la mesa entera en vez de estropear un trozo*». Lo destapó el
 * fallo de los trazos (v0.12.2): `DrawingShape` leía `data.points` sobre nada y lanzaba AL PINTARSE, y como no
 * había ni una red en `apps/web`, React desmontaba el árbol ENTERO — la mesa en blanco con la partida en
 * marcha. Este test reproduce ese error exacto y exige que se quede dentro de su trozo.
 */
function Reventon(): JSX.Element {
  /*
   * El fallo TAL CUAL era: un trazo cuyo dibujo no llegó, y alguien leyendo `data.points` sobre nada.
   * `DrawingShape` ya lleva su propia red desde v0.12.2, así que aquí se reproduce el acceso a pelo — lo que
   * se está probando es la RED, no aquel arreglo.
   */
  const sinDibujo = { kind: 'stroke', color: '#8b1a1a', width: 3 } as unknown as Drawing;
  const data = sinDibujo.data as unknown as { points: [number, number][] } | undefined;
  return <svg><polyline points={data!.points.map(p => p.join(',')).join(' ')} /></svg>;
}

afterEach(() => { vi.restoreAllMocks(); });
const callar = () => vi.spyOn(console, 'error').mockImplementation(() => {});

describe('🐞 un trozo roto no tumba la mesa', () => {
  it('el trozo que revienta se apaga solo; lo de al lado sigue en pie', () => {
    callar();
    renderWithProviders(
      <div>
        <p>la barra de herramientas</p>
        <SafeRegion label="maps:canvas"><Reventon /></SafeRegion>
      </div>,
    );
    expect(screen.getByTestId('safe-region-fallback')).toBeInTheDocument();
    // Esto es todo el arreglo: antes, esto desaparecía con el resto de la mesa.
    expect(screen.getByText('la barra de herramientas')).toBeInTheDocument();
  });

  it('el aviso dice lo que hay que decir y ofrece reintentar, sin ofrecer recargar', () => {
    callar();
    renderWithProviders(<SafeRegion label="maps:canvas"><Reventon /></SafeRegion>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reintentar|try again/i })).toBeInTheDocument();
    // Dentro de la mesa NO se ofrece recargar: tiraría la partida entera por un trozo.
    expect(screen.queryByRole('button', { name: /recargar|reload/i })).toBeNull();
  });

  it('la de la pantalla entera SÍ ofrece recargar, que es el último recurso', () => {
    callar();
    renderWithProviders(<SafeRegion variant="page" label="app"><Reventon /></SafeRegion>);
    expect(screen.getByRole('button', { name: /recargar|reload/i })).toBeInTheDocument();
  });

  it('reintentar vuelve a montar el trozo: si el dato ya está bien, se ve', async () => {
    callar();
    function Trozo({ roto }: { roto: boolean }): JSX.Element {
      if (roto) throw new Error('data.points de undefined');
      return <p>el mapa, entero</p>;
    }
    function Mesa(): JSX.Element {
      const [roto, setRoto] = useState(true);
      return (
        <div>
          <button type="button" onClick={() => setRoto(false)}>llega el dato bueno</button>
          <SafeRegion label="maps:canvas"><Trozo roto={roto} /></SafeRegion>
        </div>
      );
    }
    renderWithProviders(<Mesa />);
    await userEvent.click(screen.getByRole('button', { name: 'llega el dato bueno' }));
    await userEvent.click(screen.getByRole('button', { name: /reintentar|try again/i }));
    expect(screen.getByText('el mapa, entero')).toBeInTheDocument();
  });

  it('sin error no se mete en medio', () => {
    renderWithProviders(<SafeRegion label="x"><p>todo bien</p></SafeRegion>);
    expect(screen.getByText('todo bien')).toBeInTheDocument();
    expect(screen.queryByTestId('safe-region-fallback')).toBeNull();
  });
});
