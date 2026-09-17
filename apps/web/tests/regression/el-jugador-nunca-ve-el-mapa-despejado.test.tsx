import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapCanvas } from '@/modules/maps/ui/MapCanvas';
import { SCENE_WAREHOUSE } from '../helpers/fakes';

/**
 * 🔒 UN JUGADOR NUNCA VE EL MAPA DESPEJADO. Orden suya, 2026-09-17: «*asegurémonos de que si abro una escena
 * con la niebla puesta, los jugadores nunca vean el mapa despejado*».
 *
 * Y era un agujero de verdad, no una precaución: la tapa de lo no visto se dibujaba sólo si el jugador YA
 * tenía niebla calculada (`playerSight = !!fog && !dmSight`). Con `fog` en `null` —al entrar, y en CADA cambio
 * de escena, porque `useScene` la borra en cuanto cambia el id— no se dibujaba nada y **el mapa se veía
 * limpio** hasta que contestaba el servidor. La tapa del hueco del mapa no cubre esto: se quita cuando llegan
 * las listas de la escena, y la niebla viene por otro camino.
 */
const base = {
  scene: SCENE_WAREHOUSE, tokens: [], walls: [], drawings: [], layers: [], lights: [], sceneProps: [],
  drags: {}, pin: null, tool: 'select' as const,
  stroke: { color: '#8b1a1a', width: 3 }, me: 'u-pip', view: { x: 0, y: 0, zoom: 1 },
  brush: 2, wallKind: 'wall' as const, wallShape: 'line' as const, snapGrid: true, chainNodes: false,
  showWalls: false, probe: null, nameOf: () => '',
  onViewChange: () => undefined,
};

describe('🔒 el jugador nunca ve el mapa despejado', () => {
  it('sin niebla calculada todavía, se tapa la escena ENTERA', () => {
    render(<svg><MapCanvas {...base} isDm={false} playerView={false} fog={null} /></svg>);
    // Tapa completa, sin máscara: ante la duda no se enseña de más.
    expect(screen.getByTestId('mp-fog-unseen-all')).toBeInTheDocument();
  });

  it('con la niebla ya calculada, se tapa sólo lo no visto', () => {
    const fog = { vision: [], lit: [], seen: [], explored: [], dim: [], unseen: [] } as never;
    render(<svg><MapCanvas {...base} isDm={false} playerView={false} fog={fog} /></svg>);
    expect(screen.getByTestId('mp-fog-unseen')).toBeInTheDocument();
    expect(screen.queryByTestId('mp-fog-unseen-all')).toBeNull();
  });

  it('al director no se le tapa nada: él prepara la escena', () => {
    render(<svg><MapCanvas {...base} isDm playerView={false} fog={null} /></svg>);
    expect(screen.queryByTestId('mp-fog-unseen-all')).toBeNull();
    expect(screen.queryByTestId('mp-fog-unseen')).toBeNull();
  });

  it('pero el director «viendo como jugador» SÍ: si no, no comprobaría nada', () => {
    render(<svg><MapCanvas {...base} isDm playerView fog={null} /></svg>);
    expect(screen.getByTestId('mp-fog-unseen-all')).toBeInTheDocument();
  });
});
