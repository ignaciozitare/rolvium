import { useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { PendingRollRequest } from '../domain/entities/RollRequestAsk';

interface Props {
  request: PendingRollRequest;
  /** El nombre de la característica y el de la dificultad, ya traducidos por el sistema. */
  statLabel: string;
  difficultyLabel: string;
  /** Cuántos dados le da su característica ahora mismo; `null` si no se pudo leer su ficha. */
  poolSize: number | null;
  onAnswer: () => Promise<boolean>;
}

/**
 * «EL DIRECTOR TE PIDE UNA TIRADA» — el aviso que le SALTA al jugador (`rolvium.pen`
 * «Mesa/Tiradas · avisos del panel del director» → `Aviso/Tirada pedida`).
 *
 * El jugador no elige nada: la característica y la dificultad las eligió el director, la especialidad la
 * decidió él (p.83) y el puñado lo rearma el SERVIDOR con su ficha. Su única salida es TIRAR — y como en el
 * aviso de la columna 5, **no hay forma de cerrarlo**: si no contesta, la petición espera indefinidamente y
 * nadie tira por él (decisión del dueño, 2026-08-20).
 *
 * Reutilización declarada: **NEW (module-specific)** — mismo papel y mismos motivos que `AttackAlert`.
 */
export function RollRequestAlert({ request, statLabel, difficultyLabel, poolSize, onAnswer }: Props): JSX.Element {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const answer = async () => {
    setBusy(true);
    setError(false);
    const ok = await onAnswer();
    // Si salió bien no se apaga `busy`: el aviso se va solo en cuanto la fila deja de estar pendiente.
    if (!ok) { setError(true); setBusy(false); }
  };

  return (
    <div className="dc-atk dc-ask-alert" role="alertdialog" aria-modal="false" aria-label={t('dice.request.aria')}>
      <div className="dc-atk-head">
        <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }} aria-hidden="true">casino</span>
        <h2 className="dc-atk-title">{t('dice.request.title')}</h2>
      </div>
      <p className="dc-atk-sub">
        {t('dice.request.sub', { stat: statLabel, difficulty: difficultyLabel, n: String(request.difficulty) })}
        {request.specialtyAllowed ? ` ${t('dice.request.specialty')}` : ''}
      </p>
      {error && <p className="dc-atk-error" role="alert">{t('dice.request.failed')}</p>}
      <p className="dc-atk-note">{t('dice.request.waits')}</p>
      <div className="dc-atk-foot">
        <button type="button" className="dc-atk-go" disabled={busy} onClick={() => void answer()}>
          {poolSize !== null ? t('dice.request.roll', { n: String(poolSize) }) : t('dice.request.rollPlain')}
        </button>
      </div>
    </div>
  );
}
