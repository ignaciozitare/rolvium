import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { GameSystem } from '@rolvium/core';
// Mismo precedente que TokenAttackModal: la UI del sistema instalado lee sus catálogos directamente.
import { DIFFICULTIES, STAT_IDS } from '@rolvium/system-plenilunio';
import { sysT } from '@/modules/characters/domain/useCases/systemText';
import type { OpenRollRequestsInput } from '../domain/entities/RollRequestAsk';

export interface AskTarget { characterId: string; name: string }

interface Props {
  system: GameSystem;
  /** Los personajes de la mesa con dueño: son a quienes se les puede pedir. */
  targets: AskTarget[];
  /** Abre el lote. Devuelve `false` si no se pudo, para que el panel lo diga y siga usable. */
  onAsk: (input: Omit<OpenRollRequestsInput, 'campaignId'>) => Promise<boolean>;
}

/**
 * «¿A QUIÉN LE PIDES LA TIRADA?» — la mitad de pedir del panel del director (`rolvium.pen` columna 4,
 * `qHMjx` → `QWHSS`; `specs/modules/dice/SPEC.md` § «Columna 4 · el panel del director»).
 *
 * El gesto es el del diseño: se marca a quién (chips, «puedes marcar varios», con «A TODOS»), se MANTIENE
 * PULSADA una característica y el desplegable de dificultad sale pegado a ella; **sueltas encima de la
 * dificultad y la petición sale — sin botón de confirmar**. Con ratón también vale pulsar y luego pulsar la
 * dificultad. «Le vale su especialidad — lo decides tú (p.83)» viaja con la petición.
 */
export function DmAskPanel({ system, targets, onAsk }: Props): JSX.Element {
  const { t, locale } = useTranslation();
  const ts = useMemo(() => sysT(system, locale), [system, locale]);
  const [selected, setSelected] = useState<string[]>([]);
  const [specialty, setSpecialty] = useState(false);
  const [menuStat, setMenuStat] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; err?: boolean } | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const all = targets.length > 0 && selected.length === targets.length;
  const toggle = (id: string) => setSelected(l => (l.includes(id) ? l.filter(x => x !== id) : [...l, id]));

  const fire = async (stat: string, difficulty: number) => {
    setMenuStat(null);
    if (busy) return;
    if (selected.length === 0) { setNote({ text: t('dice.ask.pickFirst'), err: true }); return; }
    setBusy(true);
    setNote(null);
    const ok = await onAsk({ targetCharacterIds: selected, stat, difficulty, specialtyAllowed: specialty });
    setNote(ok ? { text: t('dice.ask.sent', { n: String(selected.length), stat: ts(`sheet.stats.${stat}`) }) } : { text: t('dice.ask.failed'), err: true });
    setBusy(false);
  };

  /** Soltar ENCIMA de la dificultad dispara la petición, aunque el puntero naciera en la característica. */
  const releaseOver = (e: ReactPointerEvent<HTMLButtonElement>, stat: string) => {
    const el = typeof document !== 'undefined' ? document.elementFromPoint(e.clientX, e.clientY) : null;
    const opt = el?.closest?.('[data-ask-diff]') as HTMLElement | null;
    if (opt?.dataset['askDiff']) void fire(stat, Number(opt.dataset['askDiff']));
  };

  useEffect(() => {
    if (!menuStat) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setMenuStat(null); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuStat(null); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key); };
  }, [menuStat]);

  return (
    <div className="dc-ask" ref={root}>
      <span className="dc-ask-label">{t('dice.ask.who')}</span>
      <span className="dc-ask-hint">{t('dice.ask.whoHint')}</span>
      <div className="dc-ask-targets" role="group" aria-label={t('dice.ask.who')}>
        {targets.map(x => (
          <button key={x.characterId} type="button" className={`dc-ask-chip ${selected.includes(x.characterId) ? 'on' : ''}`}
                  aria-pressed={selected.includes(x.characterId)} disabled={busy} onClick={() => toggle(x.characterId)}>
            {x.name}
          </button>
        ))}
        <button type="button" className={`dc-ask-chip ${all ? 'on' : ''}`} aria-pressed={all} disabled={busy || targets.length === 0}
                onClick={() => setSelected(all ? [] : targets.map(x => x.characterId))}>
          {t('dice.ask.everyone')}
        </button>
      </div>

      <span className="dc-ask-label">{t('dice.ask.hold')}</span>
      <span className="dc-ask-hint">{t('dice.ask.holdHint')}</span>
      <div className="dc-ask-stats" role="group" aria-label={t('dice.ask.hold')}>
        {STAT_IDS.map(stat => (
          <span key={stat} className="dc-ask-stat-slot">
            {/* Capturar el puntero es lo que hace REAL el gesto con ratón: sin captura sólo el táctil la
                tiene implícita, el pointerup de «soltar encima» cae en la opción (cuya ruta no pasa por
                este botón) y releaseOver no corre — y el click sintetizado cae en el ancestro común, no en
                la opción: el gesto no disparaba NADA con ratón. Con captura, pointerup llega aquí siempre
                y el click derivado apunta a este botón (sin onClick) — un solo disparo, por estructura.
                Mismo precedente que MapCanvas. */}
            <button type="button" className={`dc-ask-stat ${menuStat === stat ? 'on' : ''}`} disabled={busy}
                    onPointerDown={e => { e.currentTarget.setPointerCapture?.(e.pointerId); setMenuStat(stat); }}
                    onPointerUp={e => releaseOver(e, stat)}>
              {ts(`sheet.stats.${stat}`)}
            </button>
            {menuStat === stat && (
              <span className="dc-ask-menu" role="menu" aria-label={t('dice.ask.difficulty')}>
                {DIFFICULTIES.map(d => (
                  <button key={d.id} type="button" role="menuitem" data-ask-diff={d.value}
                          onClick={() => void fire(stat, d.value)}>
                    {ts(`roll.difficulty.${d.id}`)} · {d.value}
                  </button>
                ))}
              </span>
            )}
          </span>
        ))}
      </div>

      <label className="dc-ask-specialty">
        <input type="checkbox" checked={specialty} disabled={busy} onChange={e => setSpecialty(e.target.checked)} />
        <span>{t('dice.ask.specialty')}</span>
      </label>
      {note && <p className={`dc-ask-note ${note.err ? 'err' : ''}`} role={note.err ? 'alert' : 'status'}>{note.text}</p>}
    </div>
  );
}
