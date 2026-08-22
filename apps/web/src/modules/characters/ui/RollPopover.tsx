import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { GameSystem, SharedResourceDef, SheetData } from '@rolvium/core';
import {
  type RollIntent, diceOf, diceOrigin, headRef, poolChoices, previewRequest, rangeChoices, rangeOfIntent, statIdOf,
} from '../domain/useCases/rollIntent';

/** La reserva compartida de la mesa, tal y como la ve el desplegable. Ausente en la ficha aparte: allí no hay mesa. */
export interface SharedPoolHandle {
  def: SharedResourceDef;
  /** Dados que quedan en la mesa. */
  left: number;
  /** Dados que ya tienes en la mano. */
  hand: number;
  /** Deja la mano en `n` dados, cogiendo de la mesa o devolviendo. `false` = no se pudo. */
  setHand: (n: number) => Promise<boolean>;
}

interface Props {
  system: GameSystem;
  data: SheetData;
  intent: RollIntent;
  /** Rectángulo del botón que lo abrió: el desplegable nace pegado a él. */
  anchor: DOMRect | null;
  pool?: SharedPoolHandle;
  /**
   * Opciones que la mesa ya pone en toda tirada (dados de reserva en la mano…). Van DEBAJO de lo que se
   * elija aquí, y entran en la cuenta que se enseña: si no, el botón prometía menos dados de los que
   * salían de verdad.
   */
  baseOptions?: Record<string, unknown>;
  /** Texto del sistema (nombres de características, armas y alcances). */
  ts: (key: string) => string;
  onCancel: () => void;
  /** Tira de verdad con estas opciones. `false` = no se pudo, y el desplegable se queda abierto. */
  onConfirm: (options: Record<string, unknown>) => Promise<boolean>;
}

const WIDTH = 372;   // el ancho del `.pen` («Popover/Tirar», 372)
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * El desplegable de tirar — `rolvium.pen` «Mesa/Tiradas · rediseño», columnas 1 `Popover/Tirar` y
 * 2 `Popover/Disparar`.
 *
 * Sale SOBRE la ficha, pegado al botón que lo abrió, con captador invisible: un velo opaco lo
 * convertiría en otra pantalla, que es justo lo que el dueño rechazó en el Bestiario el 2026-08-21.
 *
 * Lo que enseña son DOS controles —cuántos dados tiras y cuántos coges de la reserva— y, si es un
 * disparo, el alcance. **Nada más**: las leyendas de «esto ya lo sabe la ficha» las quitó el dueño el
 * 2026-08-20 («mataban la pantalla»). Y aquí no hay dificultad ni especialidad: la dificultad la pone el
 * director (p.84) y la especialidad la decide él (p.83).
 */
export function RollPopover({ system, data, intent, anchor, pool, baseOptions, ts, onCancel, onConfirm }: Props): JSX.Element {
  const { t } = useTranslation();
  const panel = useRef<HTMLDivElement>(null);

  const weaponRange = useMemo(() => rangeOfIntent(system, intent), [system, intent]);
  const ranges = useMemo(() => rangeChoices(system, weaponRange), [system, weaponRange]);
  const statId = useMemo(() => statIdOf(system, data, intent), [system, data, intent]);
  const origin = useMemo(() => (statId ? diceOrigin(system, data, statId) : null), [system, data, statId]);

  // El alcance de partida es el del arma: es hasta donde llega, y el mapa lo confirmará cuando mida.
  const [rangeId, setRangeId] = useState<string | null>(() => ranges.find(r => r.id === weaponRange)?.id ?? null);
  const blocked = pool ? pool.def.blockedIf?.(data) ?? null : null;
  const [picked, setPicked] = useState(() => (pool && !blocked ? pool.hand : 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optionsWith = (extraDice: number, destiny: number): Record<string, unknown> => ({
    ...(baseOptions ?? {}),
    extraDice,
    ...(rangeId ? { range: rangeId } : {}),
    ...(pool ? { [`${pool.def.id}Dice`]: blocked ? 0 : destiny } : {}),
  });

  // Los dados que la ficha pone de suyo, sin tocar nada: es el número del que parte el contador.
  const base = diceOf(previewRequest(system, data, intent, optionsWith(0, 0)), ['own']);
  const [dice, setDice] = useState(base);
  // Cambiar de alcance o de arma no debe dejar el contador en un número de otra tirada.
  useEffect(() => { setDice(base); }, [base]);

  const extraDice = dice - base;
  /**
   * El techo de los dados que se pueden añadir a mano lo pone el SISTEMA, con su porqué y su página
   * (`engine.extraDiceMax`): el manual de Plenilunio da «uno o dos» por herramientas (p.87) y hasta cuatro
   * por atención médica en la recuperación (p.101), y no un máximo global. Sin esto el «+» no tenía techo
   * ninguno y el dueño llegó a **30 dados con Combate 4** desde el desplegable de disparar (2026-08-21).
   *
   * La pantalla sólo APAGA el botón y dice de dónde sale el tope: quien recorta de verdad es `poolFor`. Y
   * como una tirada de personaje lleva `characterId`, el servidor rehace ahí los grupos con ese mismo
   * `poolFor` (`performRoll`), así que **en esta pantalla** el techo no vive en el navegador — lección de la
   * tanda anterior, donde el de los dados de defensa sí vivía sólo aquí.
   * Se capa la SUBIDA y nunca la bajada: `−` sigue vivo siempre.
   */
  const cap = statId ? system.engine.extraDiceMax?.(data, { stat: statId, options: optionsWith(0, 0) }) ?? null : null;
  const capPage = cap?.ref ? system.references[cap.ref]?.page : undefined;
  const atCap = cap !== null && extraDice >= cap.max;
  const request = previewRequest(system, data, intent, optionsWith(extraDice, picked));
  const total = diceOf(request, ['own', 'destiny']);
  const manual = t('characters.sheet.manual');
  const ref = headRef(system, intent, ranges);
  const refPage = ref ? system.references[ref]?.page : undefined;
  const poolRef = pool?.def.ref ? system.references[pool.def.ref]?.page : undefined;
  const rangeRefKey = (system.catalogs?.['ranges'] ?? [])[0]?.ref;
  const rangePage = rangeRefKey ? system.references[rangeRefKey]?.page : undefined;

  const title = intent.kind === 'stat'
    ? t('characters.roll.titleStat', { name: origin ? ts(origin.statLabel) : intent.statId })
    : `${ts(intent.action.label)} · ${ts((system.catalogs?.[intent.action.appliesTo] ?? []).find(c => c.id === intent.itemId)?.label ?? intent.itemId)}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);
  useEffect(() => { panel.current?.focus(); }, []);

  /**
   * Pegado al botón y siempre dentro de la ventana: nace debajo y, si abajo no cabe, encima.
   *
   * El alto se MIDE una vez pintado en vez de suponerlo: con un alto supuesto, el desplegable de una
   * característica —que es bajito— se iba arriba sin necesidad y aparecía lejos del botón que lo abrió
   * (visto en la app). Mientras no se ha medido se pinta debajo, que es el sitio natural.
   */
  const [height, setHeight] = useState(0);
  useEffect(() => { setHeight(panel.current?.offsetHeight ?? 0); }, [ranges.length, !!pool, blocked]);
  const pos = useMemo(() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    if (!anchor) return { left: Math.round((vw - WIDTH) / 2), top: 80 };
    const below = anchor.bottom + 6;
    const fits = height === 0 || below + height <= vh - 8;
    return {
      left: Math.round(clamp(anchor.left, 8, Math.max(8, vw - WIDTH - 8))),
      top: Math.round(fits ? below : Math.max(8, Math.min(anchor.top - 6 - height, vh - 8 - height))),
    };
  }, [anchor, height]);

  const fire = async () => {
    setBusy(true);
    setError(null);
    try {
      // Coger de la mesa (o devolver) ANTES de tirar: el servidor sólo deja tirar los dados de reserva
      // que ya tienes en la mano, y es esa misma tirada la que los gasta.
      if (pool && !blocked && picked !== pool.hand && !(await pool.setHand(picked))) {
        setError(t('characters.roll.poolFailed'));
        return;
      }
      if (!(await onConfirm(optionsWith(extraDice, picked)))) setError(t('characters.sheet.rollFailed'));
    } finally {
      setBusy(false);
    }
  };

  const choices = pool && !blocked ? poolChoices(pool.def, pool.left, pool.hand) : [];

  return (
    <>
      {/* Captador invisible: cierra al pulsar fuera SIN tapar la mesa. */}
      <div className="ch-pop-catch" onClick={onCancel} aria-hidden="true" />
      <div className="ch-pop" role="dialog" aria-modal="false" aria-label={title} tabIndex={-1} ref={panel} style={pos}>
        <div className="ch-pop-head">
          <h3 className="ch-pop-title">{title}</h3>
          {refPage !== undefined && <span className="ch-pop-ref">{manual} · p.{refPage}</span>}
        </div>
        {error && <p className="ch-pop-err" role="alert">{error}</p>}

        <div className="ch-pop-block">
          <span className="ch-pop-label">{t('characters.roll.dice')}</span>
          <div className="ch-pop-count">
            <button type="button" className="rv-sheet-btn" aria-label={t('characters.roll.less')}
                    disabled={dice <= 0} onClick={() => setDice(n => Math.max(0, n - 1))}>−</button>
            <output className="ch-pop-n" aria-live="polite">{dice}</output>
            <button type="button" className="rv-sheet-btn" aria-label={t('characters.roll.more')}
                    disabled={atCap} onClick={() => setDice(n => n + 1)}>+</button>
            {origin && (
              <span className="ch-pop-from">
                {t('characters.roll.from', { stat: ts(origin.statLabel), n: String(origin.statValue) })}
                {origin.penalty > 0 && t('characters.roll.penalty', { n: String(origin.penalty), health: ts(origin.healthLabel).toLocaleLowerCase() })}
              </span>
            )}
          </div>
        </div>

        {ranges.length > 0 && (
          <div className="ch-pop-block">
            <span className="ch-pop-label">{t('characters.roll.range')}
              <em className="ch-pop-hint">{t('characters.roll.rangeHint')}{rangePage !== undefined && ` · p.${rangePage}`}</em>
            </span>
            {/* Los que quedan más lejos de lo que llega el arma salen apagados, como en el `.pen`: se
                ven —para saber que existen— pero no se pueden elegir (p.96). */}
            <div className="ch-pop-ranges" role="group" aria-label={t('characters.roll.range')}>
              {ranges.map(r => (
                <button key={r.id} type="button" className={`ch-pop-chip ${rangeId === r.id ? 'on' : ''} ${r.beyond ? 'beyond' : ''}`}
                        aria-pressed={rangeId === r.id} disabled={r.beyond} onClick={() => setRangeId(r.id)}>
                  {ts(r.label)} · {r.difficulty}
                </button>
              ))}
            </div>
          </div>
        )}

        {pool && (
          <div className="ch-pop-block">
            <span className="ch-pop-label">{t('characters.roll.pool', { name: ts(pool.def.label) })}
              {poolRef !== undefined && <em className="ch-pop-hint">p.{poolRef}</em>}
            </span>
            {blocked
              ? <p className="ch-pop-note">{ts(blocked)}</p>
              : (
                <div className="ch-pop-chips" role="group" aria-label={t('characters.roll.pool', { name: ts(pool.def.label) })}>
                  {choices.map(c => (
                    <button key={c.n} type="button" className={`ch-pop-chip ${picked === c.n ? 'on' : ''}`}
                            aria-pressed={picked === c.n} disabled={c.disabled} onClick={() => setPicked(c.n)}>{c.n}</button>
                  ))}
                  <span className="ch-pop-from">{t('characters.roll.poolLeft', { n: String(pool.left) })}</span>
                </div>
              )}
          </div>
        )}

        <div className="ch-pop-foot">
          <span className="ch-pop-extra">
            {extraDice >= 0 ? t('characters.roll.extra', { n: String(extraDice) }) : t('characters.roll.fewer', { n: String(-extraDice) })}
            {/* De dónde sale el tope, y sólo al llegar a él: en el resto del tiempo no hace falta decirlo. */}
            {atCap && cap && <em className="ch-pop-hint">{ts(cap.reason)}{capPage !== undefined && ` · ${manual} p.${capPage}`}</em>}
          </span>
          <button type="button" className="rv-sheet-btn gold" disabled={busy} onClick={() => { void fire(); }}>
            {busy ? t('common.saving')
              : intent.kind === 'stat'
                ? t('characters.roll.go', { n: String(total) })
                : t('characters.roll.goAction', { action: ts(intent.action.label), n: String(total) })}
          </button>
        </div>
      </div>
    </>
  );
}
