import { useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { PendingAttack } from '../domain/entities/Attack';

interface Props {
  attack: PendingAttack;
  /**
   * Cuántos dados puede gastar como mucho: los que le daría su característica ahora mismo. `null` cuando no
   * se ha podido leer su ficha — entonces sólo puede no defenderse, y se le dice por qué.
   */
  defenceMax: number | null;
  /** El nombre de la característica, ya traducido por el sistema. `null` si el ataque no la traía guardada. */
  statLabel: string | null;
  /** `true` mientras contesta y hasta que el aviso se va, para que no se pueda contestar dos veces. */
  onAnswer: (defence: number) => Promise<boolean>;
}

/**
 * «TE ATACA UN OGRO» — el aviso que le SALTA al jugador atacado (`rolvium.pen` `oSBrx` → `Aviso/Te atacan`,
 * columna 5; `specs/modules/dice/SPEC.md` § «El aviso que le salta al jugador»).
 *
 * Un ataque cuerpo a cuerpo es un **conflicto** (p.93): los dados de enfrente no los pone el director, los
 * pone quien se defiende. Por eso la tirada no ha salido todavía y está esperando a esta pantalla.
 *
 * **No hay botón de cerrar, ni Escape, ni pulsar fuera**, al revés que el resto de los desplegables de la
 * mesa: si el jugador no contesta la tirada espera indefinidamente y nadie la resuelve por él (decisión del
 * dueño), así que un aviso que se puede quitar de en medio sin querer deja la partida parada sin que se
 * note. Las dos salidas son las dos del diseño: «no me defiendo» o «defenderme».
 *
 * Reutilización declarada: **NEW (module-specific)**. El `Modal` de `@rolvium/ui` viste el tema de la app
 * —fondo oscuro/claro, radios, sombras— y esto vive DENTRO de la mesa, donde manda el papel del sistema; y
 * su contrato incluye cerrar con Escape y con la X, que es justo lo que aquí no puede pasar. Mismo motivo
 * por el que ya son propios `SheetOverlay`, `EncounterMenu` y el modal de atacar.
 */
export function AttackAlert({ attack, defenceMax, statLabel, onAnswer }: Props): JSX.Element {
  const { t } = useTranslation();
  const max = defenceMax ?? 0;
  const [dice, setDice] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const chosen = Math.min(dice, max);
  const answer = async (n: number) => {
    setBusy(true);
    setError(false);
    const ok = await onAnswer(n);
    if (!ok) { setError(true); setBusy(false); }
    // Si salió bien no se apaga `busy`: el aviso se va solo en cuanto la fila deja de estar pendiente, y
    // hasta entonces los botones tienen que seguir apagados.
  };

  return (
    <div className="dc-atk" role="alertdialog" aria-modal="false" aria-label={t('dice.attack.aria')}>
      <div className="dc-atk-head">
        <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }} aria-hidden="true">swords</span>
        <h2 className="dc-atk-title">{t('dice.attack.title', { name: attack.attackerName })}</h2>
      </div>
      <p className="dc-atk-sub">
        {statLabel
          ? t('dice.attack.sub', { n: String(attack.dice), stat: statLabel })
          : t('dice.attack.subNoStat', { n: String(attack.dice) })}
      </p>

      {error && <p className="dc-atk-error" role="alert">{t('dice.attack.failed')}</p>}
      {defenceMax === null && <p className="dc-atk-note">{t('dice.attack.noSheet')}</p>}

      {defenceMax !== null && (
        <>
          <span className="dc-atk-label">
            {statLabel ? t('dice.attack.howMany', { stat: statLabel }) : t('dice.attack.howManyNoStat')}
          </span>
          {/* Fichas 0…Combate, como las dibuja el `.pen`: se ve de un vistazo cuántos te quedan. */}
          <div className="dc-atk-dice" role="group" aria-label={statLabel ? t('dice.attack.howMany', { stat: statLabel }) : t('dice.attack.howManyNoStat')}>
            {Array.from({ length: max + 1 }, (_, n) => (
              <button key={n} type="button" className={`dc-atk-chip ${chosen === n ? 'on' : ''}`}
                      aria-pressed={chosen === n} disabled={busy} onClick={() => setDice(n)}>{n}</button>
            ))}
            <span className="dc-atk-have">
              {statLabel ? t('dice.attack.youHave', { stat: statLabel, n: String(max) }) : t('dice.attack.youHaveNoStat', { n: String(max) })}
            </span>
          </div>

          {/*
            El coste es TEXTO, no una cuenta que lleve la app: no hay orden de turnos todavía y no se va a
            fingir con un contador. Cambia con lo elegido porque el `.pen` lo pide así — el jugador ve qué
            le va a costar antes de pulsar.
          */}
          <p className="dc-atk-cost">
            <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }} aria-hidden="true">schedule</span>
            <span>{t('dice.attack.cost', { n: String(chosen), left: String(max - chosen), max: String(max) })}</span>
          </p>
        </>
      )}

      <div className="dc-atk-foot">
        <button type="button" className="dc-atk-btn" disabled={busy} onClick={() => void answer(0)}>
          {t('dice.attack.noDefence')}
        </button>
        {defenceMax !== null && (
          <button type="button" className="dc-atk-btn gold" disabled={busy || chosen === 0} onClick={() => void answer(chosen)}>
            {chosen === 1 ? t('dice.attack.defendOne') : t('dice.attack.defend', { n: String(chosen) })}
          </button>
        )}
      </div>
    </div>
  );
}
