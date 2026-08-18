import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { RollVisibility } from '@rolvium/core';
import type { RollsPort } from '../domain/ports/RollsPort';
import { rollsPort as defaultRolls } from '../container';
import { DIE_KINDS, MAX_FREE_DICE, MODIFIER_RANGE, freeRollRequest, notationOf, type DieKind } from '../domain/useCases/rollRules';
import './dice.css';

interface Props {
  campaignId: string;
  onClose: () => void;
  rolls?: RollsPort;
  /** Initial screen position (px). Defaults to just right of the scene toolbar, which is where it is opened from. */
  initial?: { x: number; y: number };
}
const VISIBILITIES: RollVisibility[] = ['table', 'dm', 'secret'];
const QUANTITIES = Array.from({ length: MAX_FREE_DICE }, (_, i) => i + 1);
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * Lanzador de dados (rolvium.pen PL/Lanzador flotante): floating, draggable by its header, NOT modal — the table
 * stays usable underneath. Tap a quantity = roll that many dice of that kind, with the chosen visibility + modifier.
 */
export function DiceRoller({ campaignId, onClose, rolls = defaultRolls, initial }: Props): JSX.Element {
  const { t } = useTranslation();
  const [visibility, setVisibility] = useState<RollVisibility>('table');
  const [modifier, setModifier] = useState(0);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ die: string; count: number; text: string; err?: boolean } | null>(null);
  /**
   * It opens from the first tool of the scene bar, so it appears right next to that bar instead of across the
   * screen: you press the die and the roller is under your cursor. Falls back to a sane left margin off-canvas.
   */
  const [pos, setPos] = useState(() => {
    if (initial) return initial;
    const bar = typeof document !== 'undefined' ? document.querySelector('.mp-toolbar') : null;
    const r = bar?.getBoundingClientRect();
    return r ? { x: Math.round(r.right + 10), y: Math.round(r.top) } : { x: 96, y: 160 };
  });
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const w = typeof window !== 'undefined' ? window.innerWidth : 1e9, h = typeof window !== 'undefined' ? window.innerHeight : 1e9;
    setPos({ x: clamp(e.clientX - drag.current.dx, 0, Math.max(0, w - 120)), y: clamp(e.clientY - drag.current.dy, 0, Math.max(0, h - 40)) });
  };
  const onPointerUp = () => { drag.current = null; };
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [onClose]);

  const roll = useCallback(async (die: DieKind, count: number) => {
    if (busy) return;
    setBusy(true);
    const req = freeRollRequest(die, count, modifier, visibility);
    try {
      const out = await rolls.roll({ ...req, campaignId });
      if (!out) setLast({ die: die.id, count, text: t('dice.roller.failed'), err: true });
      else setLast({ die: die.id, count, text: t('dice.roller.last', { notation: notationOf(req.groups, req.modifier ?? 0), total: String(out.result.total ?? '') }) });
    } finally { setBusy(false); }
  }, [busy, modifier, visibility, rolls, campaignId, t]);

  return (
    <section className="dc-roller" role="dialog" aria-modal="false" aria-label={t('dice.roller.title')} style={{ left: pos.x, top: pos.y }}>
      <div className="dc-roller-head" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} data-testid="dice-roller-handle">
        <span className="dc-roller-head-l">
          <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }} aria-label={t('dice.roller.drag')}>drag_indicator</span>
          {t('dice.roller.title')}
        </span>
        <button type="button" className="dc-roller-x" onClick={onClose} aria-label={t('dice.roller.close')}><span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }}>close</span></button>
      </div>
      <div className="dc-roller-vis" role="group" aria-label={t('dice.roller.visibility')}>
        {VISIBILITIES.map(v => <button key={v} type="button" aria-pressed={visibility === v} onClick={() => setVisibility(v)}>{t(`dice.roller.${v}`)}</button>)}
      </div>
      <div className="dc-roller-rows">
        {DIE_KINDS.map(die => (
          <div key={die.id} className="dc-roller-row">
            <span className="dc-roller-die"><span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }} aria-hidden="true">{die.icon}</span>{die.label}</span>
            {QUANTITIES.map(n => (
              <button key={n} type="button" className={`dc-roller-q ${last && !last.err && last.die === die.id && last.count === n ? 'on' : ''}`} disabled={busy}
                aria-label={t('dice.roller.rollN', { n: String(n), die: die.label })} onClick={() => { void roll(die, n); }}>{n}</button>
            ))}
          </div>
        ))}
      </div>
      <div className="dc-roller-foot">
        <div className="dc-roller-mod">
          {t('dice.roller.mod')}
          <button type="button" aria-label={t('dice.roller.modDown')} onClick={() => setModifier(m => clamp(m - 1, MODIFIER_RANGE.min, MODIFIER_RANGE.max))}>−</button>
          <output aria-live="polite">{modifier >= 0 ? `+${modifier}` : `−${Math.abs(modifier)}`}</output>
          <button type="button" aria-label={t('dice.roller.modUp')} onClick={() => setModifier(m => clamp(m + 1, MODIFIER_RANGE.min, MODIFIER_RANGE.max))}>+</button>
        </div>
        <span className={`dc-roller-last ${last?.err ? 'err' : ''}`} aria-live="polite">{busy ? t('dice.roller.rolling') : last ? last.text : t('dice.roller.none')}</span>
      </div>
    </section>
  );
}
