import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { GameSystem, RollVisibility } from '@rolvium/core';
import { capabilityLevel, rangeForMetres, RANGE_DIFFICULTY } from '@rolvium/system-plenilunio';
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
}

interface Props {
  /** La criatura del token, ya resuelta: del manual o de las propias del director. */
  entry: BestiaryEntry;
  system: GameSystem;
  /** Los personajes que hay en la escena, con su distancia. Vacío = no hay a quién atacar. */
  targets: AttackTarget[];
  onAttack: (req: ReturnType<typeof creatureAttackRequest>) => Promise<unknown>;
  onClose: () => void;
}

/**
 * Atacar CON el token de una criatura — `.pen` «Columna · atacar desde el token», `Modal/Atacar con el token`.
 *
 * La idea del diseño, literal: «así da igual cuántas criaturas haya en la escena: no hay lista que crezca.
 * Atacas desde el bicho que estás mirando, y el mapa ya sabe a qué distancia está cada jugador — o sea que
 * también sabe si es cuerpo a cuerpo o un disparo, y con qué dificultad».
 *
 * Lo que NO hace todavía, y por qué: **cuerpo a cuerpo va sin oposición**. El libro lo resuelve como un
 * conflicto (p.93) en el que los dados de enfrente son los que el jugador decida gastar en defenderse, y ese
 * aviso al jugador es la columna 5 del `.pen`, que no está construida. Un disparo sí lleva su dificultad,
 * porque es un reto contra el alcance (p.96) y ahí no hace falta preguntarle a nadie.
 */
export function TokenAttackModal({ entry, system, targets, onAttack, onClose }: Props): JSX.Element {
  const { t, locale } = useTranslation();
  const ts = useMemo(() => sysT(system, locale), [system, locale]);

  const combat = Number(entry.data.stats.combat ?? 0);
  const attack = entry.data.attacks?.[0] ?? null;
  const solarWrath = capabilityLevel(entry.data.capabilities ?? [], 'solarWrath');
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
      const req = creatureAttackRequest(entry, { dice, range, difficulty, visibility, attack, solarWrath },
        (sheet, action) => system.engine.poolFor(sheet, action),
        t('bestiary.attack.title', { name: entry.name, target: target.name }));
      const outcome = await onAttack(req);
      if (outcome === null) { setError(t('bestiary.roll.failed')); return; }
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
