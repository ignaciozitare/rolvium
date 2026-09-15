import { useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { DIE_KINDS, notationOf, freeRollRequest } from '@/modules/dice/domain/useCases/rollRules';
import type { ChatRollsPort } from '../domain/ports/ChatRollsPort';
import { chatRollsPort as defaultRolls } from '../container';

interface Props {
  conversationId: string;
  onClose: () => void;
  rolls?: ChatRollsPort;
}

/**
 * Tirar en privado (`rolvium.pen` `H8P1R`, icono «Tirar» en la Entrada). Reutiliza los mismos dados/lógica
 * que el Lanzador de la mesa (`DIE_KINDS`, `freeRollRequest`, `notationOf` — puros, sin UI) pero como un
 * popover propio de la conversación: sin visibilidad (ya es privada) y sin modificador, para que quepa
 * junto al campo de escribir. El resultado no vuelve aquí — llega por `ChatPort.subscribeMessages`, igual
 * que le llega a cualquier otro participante.
 */
export function ChatRollPopover({ conversationId, onClose, rolls = defaultRolls }: Props): JSX.Element {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const roll = async (dieId: string, count: number) => {
    if (busy) return;
    const die = DIE_KINDS.find(d => d.id === dieId);
    if (!die) return;
    setBusy(true); setError(false);
    const req = freeRollRequest(die, count, 0, 'table');
    const out = await rolls.roll({ ...req, conversationId });
    setBusy(false);
    if (!out) { setError(true); return; }
    onClose();
  };

  return (
    <section className="ch-roll-pop" role="dialog" aria-modal="false" aria-label={t('chat.roll.title')}>
      <div className="ch-roll-pop-head">
        <span>{t('chat.roll.title')}</span>
        <button type="button" className="ch-roll-pop-x" onClick={onClose} aria-label={t('chat.roll.close')}>
          <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }}>close</span>
        </button>
      </div>
      <div className="ch-roll-pop-rows">
        {DIE_KINDS.map(die => (
          <div key={die.id} className="ch-roll-pop-row">
            <span className="ch-roll-pop-die"><span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }} aria-hidden="true">{die.icon}</span>{die.label}</span>
            {[1, 2, 3, 4].map(n => (
              <button key={n} type="button" disabled={busy} aria-label={t('chat.roll.rollN', { n: String(n), die: die.label })} onClick={() => { void roll(die.id, n); }}>
                {n}
              </button>
            ))}
          </div>
        ))}
      </div>
      {error && <p className="ch-roll-pop-error" role="alert">{t('chat.roll.failed')}</p>}
      {busy && <p className="ch-roll-pop-busy" aria-live="polite">{t('chat.roll.rolling', { notation: notationOf([{ count: 1, sides: 6 }]) })}</p>}
    </section>
  );
}
