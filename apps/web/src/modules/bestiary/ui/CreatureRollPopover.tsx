import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { GameSystem, RollVisibility } from '@rolvium/core';
import {
  BLAST_DIFFICULTY, DIFFICULTIES, STAT_IDS, autoSuccessOptions, blastDice, blastReach, capabilityById, capabilityLevel,
} from '@rolvium/system-plenilunio';
import type { CapabilityId, StatId } from '@rolvium/system-plenilunio';
import { sysT } from '@/modules/characters/domain/useCases/systemText';
import { canRoll, specialtiesFor } from '../domain/useCases/bestiaryRules';
import { creatureBlastRequest, creatureRollRequest, ownDiceOf, sheetOf } from '../domain/useCases/creatureRoll';
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
  /** La escena es de noche. Va en la tirada, no en la escena: lo marca el director (decisión del dueño). */
  const [night, setNight] = useState(false);
  /** El ataque impreso elegido, `null` = a mano. Y si lo elegido es la Deflagración, que no es un ataque más. */
  const [attackIdx, setAttackIdx] = useState<number | null>(null);
  const [blastOn, setBlastOn] = useState(false);
  const [metres, setMetres] = useState(0);
  const [marked, setMarked] = useState<CapabilityId[]>([]);
  const panel = useRef<HTMLDivElement>(null);

  const specs = stat ? specialtiesFor(entry, stat) : [];

  // ─── Lo que la criatura trae en su bloque (p.107–108) ────────────────────
  const caps = useMemo(() => entry.data.capabilities ?? [], [entry]);
  const attacks = entry.data.attacks ?? [];
  const blastLevel = capabilityLevel(caps, 'blast');
  const solarWrath = capabilityLevel(caps, 'solarWrath');
  const combat = Number(entry.data.stats.combat ?? 0);
  /** La casilla de noche sólo tiene sentido si alguna de sus capacidades depende de la hora. */
  const timeMatters = caps.some(c => !!capabilityById(c.id)?.data.timeOfDay);

  /**
   * Las capacidades que PODRÍAN aplicar a esta tirada. Las decide el motor a partir de la característica y
   * de la hora; marcarlas es del director, como la especialidad (p.83, p.107). Lo marcado se filtra contra
   * lo ofrecido en vez de limpiarse a mano: al cambiar de característica, lo que ya no encaja deja de contar.
   */
  const autoOptions = useMemo(
    () => (stat && !blastOn ? autoSuccessOptions(caps, stat, night) : []),
    [caps, stat, night, blastOn]);
  const active = autoOptions.filter(o => marked.includes(o.id));
  const autoSuccesses = active.reduce((n, o) => n + o.level, 0);

  const attack = attackIdx !== null ? attacks[attackIdx] ?? null : null;

  const request = useMemo(() => {
    const poolFor = (sheet: Record<string, unknown>, action: { stat: string; options?: Record<string, unknown> }) =>
      system.engine.poolFor(sheet, action);
    if (blastOn) {
      return creatureBlastRequest(entry, {
        level: blastLevel, metres, dice: blastDice(blastLevel, metres) + extraDice, difficulty, visibility,
      }, poolFor, ts('catalog.capabilities.blast.name'));
    }
    if (!stat) return null;
    return creatureRollRequest(entry, {
      stat, specialty, difficulty, extraDice, visibility, night,
      autoSuccesses, autoSuccessFrom: active[0]?.id ?? null, solarWrath, attack,
    }, poolFor, attack ? ts(attack.label) : ts(`sheet.stats.${stat}`));
  }, [entry, stat, specialty, difficulty, extraDice, visibility, system, ts, blastOn, blastLevel, metres, night, autoSuccesses, active, solarWrath, attack]);

  const dice = request ? ownDiceOf(request) : 0;
  /**
   * El techo de los dados que el director añade a mano lo pone el SISTEMA (`engine.extraDiceMax`): en
   * Plenilunio, «uno o dos» por herramientas (p.87) y hasta cuatro por atención médica (p.101), porque el
   * libro no da un máximo global. Sin esto el «+» no tenía techo ninguno, igual que en la ficha.
   * La pantalla APAGA el botón y `poolFor` recorta al construir la petición. OJO: una tirada de criatura NO
   * lleva `characterId`, así que el servidor NO la rehace (`performRoll` sólo reconstruye con ficha): aquí el
   * techo vive de verdad en el navegador. Es un hueco de autoridad ANTERIOR a esto y común a toda tirada de
   * criatura —los dados salen igual del cliente—, y quien tira es el director, que es su propia mesa.
   * Anotado en WORK_STATE para decidirlo aparte; no se ensancha en esta tanda.
   */
  const cap = stat ? system.engine.extraDiceMax?.(sheetOf(entry), { stat }) ?? null : null;
  const atCap = cap !== null && extraDice >= cap.max;

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
                  <button key={s} type="button" className={`bs-btn ${stat === s && !blastOn ? 'bs-btn-on' : ''}`}
                          aria-pressed={stat === s && !blastOn}
                          onClick={() => { setStat(s); setSpecialty(false); setAttackIdx(null); setBlastOn(false); }}>
                    {t(`bestiary.stat.${s}`)}
                  </button>
                ))}
              </div>
              {blastOn && <p className="bs-note">{t('bestiary.roll.blastNoStat')}</p>}

              {/* Los ATAQUES que imprime el bloque en caja, con su ataque y su daño ya calculados por el
                  libro (p.97 para la cuenta, pero NO se recalculan: se copian). Elegir uno tira los dados
                  del ataque en vez de los de la característica. La Deflagración va aquí porque también es
                  un ataque, aunque sea uno APARTE que no usa característica ninguna (p.108). */}
              {(attacks.length > 0 || blastLevel > 0) && (
                <>
                  <span className="bs-label">{t('bestiary.roll.attacks')}</span>
                  <div className="bs-roll-stats" role="group" aria-label={t('bestiary.roll.attacks')}>
                    <button type="button" className={`bs-btn ${attack === null && !blastOn ? 'bs-btn-on' : ''}`}
                            aria-pressed={attack === null && !blastOn}
                            onClick={() => { setAttackIdx(null); setBlastOn(false); setStat('combat'); }}>
                      {t('bestiary.roll.attackNone', { n: String(combat) })}
                    </button>
                    {attacks.map((a, i) => (
                      <button key={a.label} type="button" className={`bs-btn ${attackIdx === i && !blastOn ? 'bs-btn-on' : ''}`}
                              aria-pressed={attackIdx === i && !blastOn}
                              onClick={() => { setAttackIdx(i); setBlastOn(false); setStat('combat'); }}>
                        {t(a.fortuneCost ? 'bestiary.roll.attackFortune' : 'bestiary.roll.attackChip',
                           { name: ts(a.label), attack: String(a.attack), damage: String(a.damage) })}
                      </button>
                    ))}
                    {blastLevel > 0 && (
                      <button type="button" className={`bs-btn ${blastOn ? 'bs-btn-on' : ''}`} aria-pressed={blastOn}
                              onClick={() => { setBlastOn(true); setAttackIdx(null); setStat(null); setDifficulty(BLAST_DIFFICULTY); }}>
                        {t('bestiary.roll.blast', { n: String(blastLevel) })}
                      </button>
                    )}
                  </div>
                  <p className="bs-note">
                    {blastOn ? t('bestiary.roll.blastNote') : t('bestiary.roll.attacksNote', { page: String(entry.data.page ?? '') })}
                  </p>
                </>
              )}

              {/* Los metros de la Deflagración los teclea el director (decisión del dueño, 2026-08-21):
                  cuando existan los ataques sobre el mapa, la distancia saldrá de ahí. */}
              {blastOn && (
                <div className="bs-roll-dice">
                  <span className="bs-label">{t('bestiary.roll.metres')}</span>
                  <div className="bs-roll-count">
                    <button type="button" className="bs-btn" aria-label={t('bestiary.roll.metresLess')}
                            disabled={metres <= 0} onClick={() => setMetres(n => Math.max(0, n - 1))}>−</button>
                    <output className="bs-roll-n" aria-live="polite">{t('bestiary.roll.metresValue', { n: String(metres) })}</output>
                    <button type="button" className="bs-btn" aria-label={t('bestiary.roll.metresMore')}
                            onClick={() => setMetres(n => n + 1)}>+</button>
                    <span className="bs-roll-from">{t('bestiary.roll.metresFrom', { radius: String(blastReach(blastLevel)) })}</span>
                  </div>
                  <p className="bs-note">{t('bestiary.roll.blastDamage', { n: String(blastLevel) })}</p>
                </div>
              )}

              <div className="bs-roll-dice">
                <span className="bs-label">{t('bestiary.roll.dice')}</span>
                <div className="bs-roll-count">
                  <button type="button" className="bs-btn" aria-label={t('bestiary.roll.less')}
                          disabled={extraDice <= 0} onClick={() => setExtraDice(n => Math.max(0, n - 1))}>−</button>
                  <output className="bs-roll-n" aria-live="polite">{dice}</output>
                  <button type="button" className="bs-btn" aria-label={t('bestiary.roll.more')}
                          disabled={atCap} onClick={() => setExtraDice(n => n + 1)}>+</button>
                  <span className="bs-roll-from">
                    {blastOn
                      ? t('bestiary.roll.fromBlast', { level: String(blastLevel), metres: String(metres) })
                      : attack
                        ? t('bestiary.roll.fromAttack', { name: ts(attack.label), n: String(attack.attack) })
                        : t('bestiary.roll.from', { stat: t(`bestiary.stat.${stat}`), n: String(stat ? entry.data.stats[stat] ?? 0 : 0) })}
                    {extraDice > 0 && ` · ${t('bestiary.roll.extra', { n: String(extraDice) })}`}
                  </span>
                  {/* De dónde sale el tope, y sólo al llegar a él. */}
                  {atCap && cap && <span className="bs-roll-from">{ts(cap.reason)}</span>}
                  {autoSuccesses > 0 && (
                    <span className="bs-auto">{t('bestiary.roll.capabilityAuto', { n: String(autoSuccesses) })}</span>
                  )}
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

              {/* La hora la marca el director en la propia tirada, no la escena. Sólo sale si alguna de sus
                  capacidades depende de ella (Aura de día; Aura sombría y Amparo de la noche, de noche). */}
              {timeMatters && !blastOn && (
                <label className="bs-scope">
                  <input type="checkbox" checked={night} onChange={e => setNight(e.target.checked)} />
                  <span className="material-symbols-outlined bs-scope-i" aria-hidden="true">dark_mode</span>
                  <span>{t('bestiary.roll.night')}</span>
                </label>
              )}

              {/* Las capacidades NO se aplican solas, igual que la especialidad: el motor no puede saber si la
                  tirada es «para intimidar o liderar», que es lo que pide el Aura (p.107). */}
              {autoOptions.length > 0 && (
                <>
                  <span className="bs-label">{t('bestiary.roll.capabilities')}</span>
                  {autoOptions.map(o => (
                    <label key={o.id} className="bs-scope">
                      <input type="checkbox" checked={marked.includes(o.id)}
                             onChange={e => setMarked(ids => (e.target.checked ? [...ids, o.id] : ids.filter(x => x !== o.id)))} />
                      <span>{ts(`catalog.capabilities.${o.id}.name`)} {o.level}</span>
                      <span className="bs-auto">{t('bestiary.roll.capabilityAuto', { n: String(o.level) })}</span>
                    </label>
                  ))}
                  <p className="bs-note">{t('bestiary.roll.capabilitiesNote')}</p>
                </>
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

              {blastOn && <p className="bs-note">{t('bestiary.roll.blastDifficulty')}</p>}

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
                <button type="button" className="bs-btn bs-btn-on bs-btn-lg" onClick={fire} disabled={busy || !request}>
                  {busy ? t('common.saving') : t('bestiary.roll.go', { n: String(dice) })}
                </button>
              </div>
            </>
          )}
      </div>
    </>
  );
}
