import { describe, it, expect } from 'vitest';
import type { RollExplain } from '@rolvium/core';
// Sin `renderWithProviders` a propósito: el desglose recibe su `t` por parámetro y no toca el i18n
// ni el router. Montarlo pelado es lo que demuestra que no depende de nada más.
import { render, screen } from '@testing-library/react';
import { RollBreakdown, pagesLabel } from './RollBreakdown';

const t = (key: string, p?: Record<string, string>) => {
  const texts: Record<string, string> = {
    'dice.log.breakdown.title': 'Cómo salió esta tirada',
    'dice.log.breakdown.applied': 'Lo que se aplicó',
    'dice.log.breakdown.ref': `Manual · ${p?.['pages'] ?? ''}`,
    'dice.log.breakdown.page': `p.${p?.['n'] ?? ''}`,
    'dice.log.breakdown.and': 'y',
  };
  return texts[key] ?? key;
};

describe('pagesLabel', () => {
  it('junta las páginas sin repetirlas, en orden, con la «y» final', () => {
    expect(pagesLabel([{ text: 'a', page: 96 }, { text: 'b', page: 82 }, { text: 'c', page: 96 }], t)).toBe('Manual · p.82 y p.96');
    expect(pagesLabel([{ text: 'a', page: 82 }], t)).toBe('Manual · p.82');
    expect(pagesLabel([{ text: 'a', page: 98 }, { text: 'b', page: 82 }, { text: 'c', page: 96 }], t)).toBe('Manual · p.82, p.96 y p.98');
  });
  it('sin páginas no hay referencia que enseñar', () => {
    expect(pagesLabel([{ text: 'a' }], t)).toBeNull();
    expect(pagesLabel([], t)).toBeNull();
  });
});

describe('<RollBreakdown>', () => {
  const full: RollExplain = {
    head: [{ text: '4 Combate = 4 dados', page: 82 }, { text: 'Reto a dificultad 2', page: 84 }],
    applied: [{ text: 'El arma no suma dados', page: 96 }],
    verdict: '2 éxitos contra 2 de dificultad = resultado ambiguo',
  };
  it('pinta cabecera, referencia, bloques y cierre; la primera línea no repite su página', () => {
    render(<RollBreakdown explain={full} id="tip-1" t={t} />);
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveAttribute('id', 'tip-1');
    expect(screen.getByText('Cómo salió esta tirada')).toBeInTheDocument();
    expect(screen.getByText('Manual · p.82, p.84 y p.96')).toBeInTheDocument();
    expect(screen.getByText('4 Combate = 4 dados')).toBeInTheDocument();
    expect(screen.getByText('Reto a dificultad 2 (p.84)')).toBeInTheDocument();
    expect(screen.getByText('El arma no suma dados (p.96)')).toBeInTheDocument();
    expect(screen.getByText(full.verdict as string)).toHaveClass('dc-tip-verdict');
  });
  it('sin nada que aplicar no pinta el rótulo, y sin cierre no pinta el cierre', () => {
    render(<RollBreakdown explain={{ head: [{ text: '4 dados' }], applied: [] }} id="tip-2" t={t} />);
    expect(screen.queryByText('Lo que se aplicó')).toBeNull();
    expect(document.querySelector('.dc-tip-verdict')).toBeNull();
    // sin páginas conocidas tampoco hay «Manual · …»
    expect(document.querySelector('.dc-tip-head em')).toBeNull();
  });
});
