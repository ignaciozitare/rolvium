import { useMemo, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { GameSystem } from '@rolvium/core';
// Mismo precedente que TokenAttackModal: la UI del sistema instalado lee sus catálogos directamente.
import { STAT_IDS } from '@rolvium/system-plenilunio';
import { sysT } from '@/modules/characters/domain/useCases/systemText';
import type { OpenRollRequestsInput } from '../domain/entities/RollRequestAsk';
import { DifficultyHold } from './DifficultyHold';

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
 * El gesto es el del diseño y vive en `DifficultyHold`, compartido con los encuentros: se marca a quién
 * (chips, «puedes marcar varios», con «A TODOS»), se MANTIENE PULSADA una característica y se suelta encima
 * de la dificultad — la petición sale sin botón de confirmar. «Le vale su especialidad — lo decides tú
 * (p.83)» viaja con la petición.
 */
export function DmAskPanel({ system, targets, onAsk }: Props): JSX.Element {
  const { t, locale } = useTranslation();
  const ts = useMemo(() => sysT(system, locale), [system, locale]);
  const [selected, setSelected] = useState<string[]>([]);
  const [specialty, setSpecialty] = useState(false);
  const [menuStat, setMenuStat] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; err?: boolean } | null>(null);

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

  return (
    <div className="dc-ask">
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
          <DifficultyHold key={stat} label={ts(`sheet.stats.${stat}`)} ts={ts} disabled={busy}
                          open={menuStat === stat} onOpen={o => setMenuStat(o ? stat : null)}
                          onPick={d => void fire(stat, d)} />
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
