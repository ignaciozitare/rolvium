import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { GameSystem, RollVisibility } from '@rolvium/core';
import { autoSuccessOptions, capabilityLevel, rangeForMetres, RANGE_DIFFICULTY } from '@rolvium/system-plenilunio';
import type { CapabilityId } from '@rolvium/system-plenilunio';
import { sysT } from '@/modules/characters/domain/useCases/systemText';
import { initialsOf } from '@/modules/maps/domain/useCases/mapRules';
import { creatureAttackRequest } from '../domain/useCases/creatureRoll';
import { errorText } from '../domain/useCases/errorText';
import { resistanceOf } from '../domain/useCases/bestiaryRules';
import type { BestiaryEntry } from '../domain/entities/BestiaryEntry';

/** Un objetivo posible, con la distancia YA medida por el mapa: aquí no se calculan casillas. */
export interface AttackTarget {
  id: string;
  name: string;
  cells: number;
  metres: number;
  /**
   * El personaje que hay detrás del token. Es a QUIÉN se le pide la defensa cuando el golpe es cuerpo a
   * cuerpo, así que un token sin personaje no es objetivo de un conflicto (la escena ya sólo manda los que
   * lo tienen).
   */
  characterId: string;
}

interface Props {
  /** La criatura del token, ya resuelta: del manual o de las propias del director. */
  entry: BestiaryEntry;
  system: GameSystem;
  /** Los personajes que hay en la escena, con su distancia. Vacío = no hay a quién atacar. */
  targets: AttackTarget[];
  /**
   * Si es de noche en la escena. **No se pregunta aquí**: sale del interruptor de día/noche del mapa, que es
   * donde vive (dueño, 2026-08-21). De ella dependen las capacidades nocturnas de la criatura (p.107).
   */
  night?: boolean;
  onAttack: (req: ReturnType<typeof creatureAttackRequest>) => Promise<unknown>;
  /**
   * Abrir un ataque A LA ESPERA en vez de tirar. Se usa SÓLO cuerpo a cuerpo, que es un conflicto (p.93):
   * los dados de enfrente son los que el jugador decida gastar en defenderse, así que hay que preguntárselo
   * antes de tirar. Devuelve `null` si no se pudo abrir.
   */
  onOpenAttack: (input: { targetTokenId: string; targetCharacterId: string; dice: number; request: ReturnType<typeof creatureAttackRequest> }) => Promise<unknown>;
  onClose: () => void;
}

/**
 * Atacar CON el token de una criatura — `.pen` «Columna · atacar desde el token», `Modal/Atacar con el token`.
 *
 * La idea del diseño, literal: «así da igual cuántas criaturas haya en la escena: no hay lista que crezca.
 * Atacas desde el bicho que estás mirando, y el mapa ya sabe a qué distancia está cada jugador — o sea que
 * también sabe si es cuerpo a cuerpo o un disparo, y con qué dificultad».
 *
 * **Cuerpo a cuerpo no tira aquí**: el libro lo resuelve como un conflicto (p.93) en el que los dados de
 * enfrente son los que el jugador decida gastar en defenderse, así que el ataque se queda A LA ESPERA, al
 * jugador le salta el aviso (columna 5 del `.pen`) y la tirada sale cuando conteste. Un disparo sí sale en
 * el acto, porque es un reto contra la dificultad del alcance (p.96) y ahí no hay a quién preguntar.
 */
export function TokenAttackModal({ entry, system, targets, night = false, onAttack, onOpenAttack, onClose }: Props): JSX.Element {
  const { t, locale } = useTranslation();
  const ts = useMemo(() => sysT(system, locale), [system, locale]);

  const combat = Number(entry.data.stats.combat ?? 0);
  const attack = entry.data.attacks?.[0] ?? null;
  const caps = useMemo(() => entry.data.capabilities ?? [], [entry]);
  const solarWrath = capabilityLevel(caps, 'solarWrath');
  /** Las capacidades que podrían aplicar a ESTE ataque: Combate, y la hora que diga la escena (p.107). */
  const autoOptions = useMemo(() => autoSuccessOptions(caps, 'combat', night), [caps, night]);
  const [marked, setMarked] = useState<CapabilityId[]>([]);
  const active = autoOptions.filter(o => marked.includes(o.id));
  const autoSuccesses = active.reduce((n, o) => n + o.level, 0);
  /** El puñado por defecto: su ataque impreso si lo tiene, y si no su Combate a secas. */
  const base = attack ? attack.attack : combat;

  const [targetId, setTargetId] = useState<string | null>(targets[0]?.id ?? null);
  const [dice, setDice] = useState(base);
  const [visibility] = useState<RollVisibility>('table');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  const target = targets.find(x => x.id === targetId) ?? null;
  const range = target ? rangeForMetres(target.metres) : null;
  const ranged = range !== null && range !== 'melee';
  const difficulty = ranged ? RANGE_DIFFICULTY[range] : 0;

  /** La línea de la distancia del `.pen`: la mide el mapa y de ahí sale contra qué se tira. */
  const distance = !target ? null
    : range === null ? t('bestiary.attack.tooFar', { name: target.name, cells: String(target.cells), metres: String(target.metres) })
    : ranged ? t('bestiary.attack.ranged', {
      name: target.name, cells: String(target.cells), metres: String(target.metres),
      range: ts(`sheet.range.${range}`).toLocaleLowerCase(), difficulty: String(difficulty),
    })
    : t('bestiary.attack.melee', { name: target.name, cells: String(target.cells) });

  const fire = async () => {
    if (!target || range === null) return;
    setBusy(true);
    setError(null);
    try {
      const req = creatureAttackRequest(entry,
        { dice, range, difficulty, visibility, attack, solarWrath, autoSuccesses, autoSuccessFrom: active[0]?.id ?? null },
        (sheet, action) => system.engine.poolFor(sheet, action),
        t('bestiary.attack.title', { name: entry.name, target: target.name }));
      // Cuerpo a cuerpo NO se tira aquí: se abre el ataque y espera a que el jugador ponga su defensa.
      const outcome = range === 'melee'
        ? await onOpenAttack({ targetTokenId: target.id, targetCharacterId: target.characterId, dice, request: req })
        : await onAttack(req);
      if (outcome === null) { setError(t(range === 'melee' ? 'bestiary.attack.openFailed' : 'bestiary.roll.failed')); return; }
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  useEffect(() => { panel.current?.focus(); }, []);

  return (
    <>
      <div className="bs-pop-catch" onClick={onClose} aria-hidden="true" />
      <div className="bs-pop bs-atk" role="dialog" aria-modal="false" tabIndex={-1} ref={panel}
           aria-label={t('bestiary.attack.with', { name: entry.name })}>
        {/* Sin X de cerrar, como lo dibuja el `.pen`: se cierra con Escape o pulsando fuera. */}
        <div className="bs-atk-head">
          <span className="bs-atk-tok" aria-hidden="true">{initialsOf(entry.name)}</span>
          <span className="bs-atk-id">
            <span className="bs-atk-name">{entry.name}</span>
            <span className="bs-atk-data">
              {t('bestiary.attack.stats', {
                combat: String(combat), resistance: String(resistanceOf(entry.data)), protection: String(entry.data.protection),
              })}
              {entry.data.page ? ` · ${t('bestiary.attack.page', { n: String(entry.data.page) })}` : ''}
            </span>
          </span>
        </div>
        {error && <p className="bs-error" role="alert">{error}</p>}

        {targets.length === 0
          ? <p className="bs-note">{t('bestiary.attack.noTargets')}</p>
          : (
            <>
              <span className="bs-label">{t('bestiary.attack.who')}</span>
              <div className="bs-roll-stats" role="group" aria-label={t('bestiary.attack.who')}>
                {targets.map(x => (
                  <button key={x.id} type="button" className={`bs-btn ${targetId === x.id ? 'bs-btn-on' : ''}`}
                          aria-pressed={targetId === x.id} onClick={() => setTargetId(x.id)}>
                    {x.name}
                  </button>
                ))}
              </div>
              {distance && <p className="bs-atk-dist">{distance}</p>}
              {range === 'melee' && <p className="bs-note">{t('bestiary.attack.meleeWait')}</p>}

              <span className="bs-label">{t('bestiary.attack.dice')}</span>
              <div className="bs-roll-count">
                <button type="button" className="bs-btn" aria-label={t('bestiary.roll.less')}
                        disabled={dice <= 0} onClick={() => setDice(n => Math.max(0, n - 1))}>−</button>
                <output className="bs-roll-n" aria-live="polite">{dice}</output>
                <button type="button" className="bs-btn" aria-label={t('bestiary.roll.more')}
                        onClick={() => setDice(n => n + 1)}>+</button>
                <span className="bs-roll-from">
                  {attack
                    ? t('bestiary.attack.fromAttack', { name: ts(attack.label), n: String(base) })
                    : t('bestiary.attack.from', { n: String(combat) })}
                </span>
              </div>

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
                  <p className="bs-note">{t(night ? 'bestiary.attack.nightNote' : 'bestiary.attack.dayNote')}</p>
                </>
              )}

              <div className="bs-sheet-foot bs-atk-foot">
                <button type="button" className="bs-btn bs-btn-atk bs-btn-lg" onClick={fire}
                        disabled={busy || !target || range === null}>
                  {busy ? t('common.saving') : t('bestiary.attack.go', { name: target?.name ?? '' })}
                </button>
              </div>
            </>
          )}
      </div>
    </>
  );
}
