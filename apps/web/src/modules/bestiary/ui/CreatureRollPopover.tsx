import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { GameSystem, RollVisibility } from '@rolvium/core';
import { DIFFICULTIES, STAT_IDS } from '@rolvium/system-plenilunio';
import type { StatId } from '@rolvium/system-plenilunio';
import { sysT } from '@/modules/characters/domain/useCases/systemText';
import { canRoll, specialtiesFor } from '../domain/useCases/bestiaryRules';
import { creatureRollRequest, ownDiceOf } from '../domain/useCases/creatureRoll';
import { errorText } from '../domain/useCases/errorText';
import type { BestiaryEntry } from '../domain/entities/BestiaryEntry';

interface Props {
  entry: BestiaryEntry;
  system: GameSystem;
  specialtyLabel: (id: string) => string;
  /** Tira de verdad: el servidor genera los dados y escribe el Registro. Devuelve null si no se pudo. */
  onRoll: (req: ReturnType<typeof creatureRollRequest>) => Promise<unknown>;
  onClose: () => void;
}

const VISIBILITIES: RollVisibility[] = ['table', 'dm', 'secret'];

/**
 * Tirar EN NOMBRE de una criatura — `.pen` «Mesa/Tiradas · rediseño», columna `Popover/Tirar`.
 *
 * Sustituye al atajo que abría el lanzador libre de dados. Aquél tiraba dados sueltos y tiraba la criatura a
 * la basura: sin sus características, sin poder marcar su especialidad y sin elegir quién ve el resultado —
 * justo lo que el dueño rechazó el 2026-08-21 («no lo que establecimos»).
 *
 * Lo que este desplegable NO es: el **panel del director** completo (pedir tirada a los jugadores, lista de
 * encuentros de la escena, ATACAR). Eso es H6 y sigue pendiente; esto es la pieza que hace honesto el botón
 * «Tirar» del catálogo, que sí está en el diseño.
 */
export function CreatureRollPopover({ entry, system, specialtyLabel, onRoll, onClose }: Props): JSX.Element {
  const { t, locale } = useTranslation();
  const ts = useMemo(() => sysT(system, locale), [system, locale]);

  const rollable = useMemo(() => STAT_IDS.filter(s => canRoll(entry, s)), [entry]);
  const [stat, setStat] = useState<StatId | null>(rollable[0] ?? null);
  const [specialty, setSpecialty] = useState(false);
  const [difficulty, setDifficulty] = useState(2);
  const [extraDice, setExtraDice] = useState(0);
  const [visibility, setVisibility] = useState<RollVisibility>('table');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  const specs = stat ? specialtiesFor(entry, stat) : [];

  const request = useMemo(() => {
    if (!stat) return null;
    return creatureRollRequest(entry, { stat, specialty, difficulty, extraDice, visibility },
      (sheet, action) => system.engine.poolFor(sheet, action), ts(`sheet.stats.${stat}`));
  }, [entry, stat, specialty, difficulty, extraDice, visibility, system, ts]);

  const dice = request ? ownDiceOf(request) : 0;

  const fire = async () => {
    if (!request) return;
    setBusy(true);
    setError(null);
    try {
      const outcome = await onRoll(request);
      if (outcome === null) { setError(t('bestiary.roll.failed')); return; }
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  // Escape cierra, como cualquier cosa que se abre encima. El clic fuera lo recoge el captador invisible.
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => { panel.current?.focus(); }, []);

  return (
    <>
      {/* Captador invisible: cierra al pulsar fuera SIN tapar la mesa. Un velo opaco convertiría el
          desplegable en otra pantalla, que es justo lo que el dueño rechazó. */}
      <div className="bs-pop-catch" onClick={onClose} aria-hidden="true" />
      <div className="bs-pop bs-roll" role="dialog" aria-modal="false" tabIndex={-1} ref={panel}
           aria-label={t('bestiary.roll.title', { name: entry.name })}>
        <div className="bs-pop-head">
          <h3 className="bs-pop-title">{t('bestiary.roll.title', { name: entry.name })}</h3>
          <button type="button" className="bs-ov-x" aria-label={t('common.close')} onClick={onClose}>
            <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>close</span>
          </button>
        </div>
        {error && <p className="bs-error" role="alert">{error}</p>}

        {/* El manual deja características SIN VALOR en los bloques que no publica enteros: ausente no es 0,
            es «el libro no lo dice». Por eso no se ofrecen — no se tira por lo que no está escrito. */}
        {rollable.length === 0
          ? <p className="bs-note">{t('bestiary.roll.noStats')}</p>
          : (
            <>
              <span className="bs-label">{t('bestiary.roll.stat')}</span>
              <div className="bs-roll-stats" role="group" aria-label={t('bestiary.roll.stat')}>
                {rollable.map(s => (
                  <button key={s} type="button" className={`bs-btn ${stat === s ? 'bs-btn-on' : ''}`}
                          aria-pressed={stat === s} onClick={() => { setStat(s); setSpecialty(false); }}>
                    {t(`bestiary.stat.${s}`)}
                  </button>
                ))}
              </div>

              <div className="bs-roll-dice">
                <span className="bs-label">{t('bestiary.roll.dice')}</span>
                <div className="bs-roll-count">
                  <button type="button" className="bs-btn" aria-label={t('bestiary.roll.less')}
                          disabled={extraDice <= 0} onClick={() => setExtraDice(n => Math.max(0, n - 1))}>−</button>
                  <output className="bs-roll-n" aria-live="polite">{dice}</output>
                  <button type="button" className="bs-btn" aria-label={t('bestiary.roll.more')}
                          onClick={() => setExtraDice(n => n + 1)}>+</button>
                  <span className="bs-roll-from">
                    {t('bestiary.roll.from', { stat: t(`bestiary.stat.${stat}`), n: String(stat ? entry.data.stats[stat] ?? 0 : 0) })}
                    {extraDice > 0 && ` · ${t('bestiary.roll.extra', { n: String(extraDice) })}`}
                  </span>
                </div>
              </div>

              {/* «El director la elige al tirar» (decisión del dueño en el spec): el garrote no sirve para
                  esquivar, así que la especialidad NO se aplica sola por característica. */}
              {specs.length > 0 && (
                <label className="bs-scope">
                  <input type="checkbox" checked={specialty} onChange={e => setSpecialty(e.target.checked)} />
                  <span>{t('bestiary.roll.specialty', { name: specs.map(specialtyLabel).join(' · ') })}</span>
                </label>
              )}

              <span className="bs-label">{t('bestiary.roll.difficulty')}</span>
              <div className="bs-roll-stats" role="group" aria-label={t('bestiary.roll.difficulty')}>
                {DIFFICULTIES.map(d => (
                  <button key={d.id} type="button" className={`bs-btn ${difficulty === d.value ? 'bs-btn-on' : ''}`}
                          aria-pressed={difficulty === d.value} onClick={() => setDifficulty(d.value)}>
                    {ts(`roll.difficulty.${d.id}`)} · {d.value}
                  </button>
                ))}
              </div>

              <span className="bs-label">{t('bestiary.roll.visibility')}</span>
              <div className="bs-roll-stats" role="group" aria-label={t('bestiary.roll.visibility')}>
                {VISIBILITIES.map(v => (
                  <button key={v} type="button" className={`bs-btn ${visibility === v ? 'bs-btn-on' : ''}`}
                          aria-pressed={visibility === v} onClick={() => setVisibility(v)}>
                    {t(`dice.roller.${v}`)}
                  </button>
                ))}
              </div>

              <div className="bs-sheet-foot">
                <button type="button" className="bs-btn bs-btn-on bs-btn-lg" onClick={fire} disabled={busy || !stat}>
                  {busy ? t('common.saving') : t('bestiary.roll.go', { n: String(dice) })}
                </button>
              </div>
            </>
          )}
      </div>
    </>
  );
}
