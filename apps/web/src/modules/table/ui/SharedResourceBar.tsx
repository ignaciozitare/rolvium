import { useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { Crescent } from '@rolvium/ui';
import type { SharedResourceDef, SharedResourceState } from '@rolvium/core';
import type { TableRole } from '@/modules/campaigns/domain/entities/Campaign';
import type { ResourceError } from '../domain/entities/Table';
import { canReset, canTake, handOf } from '../domain/useCases/tableRules';

interface Props {
  def: SharedResourceDef;
  state: SharedResourceState | undefined;
  role: TableRole;
  userId: string;
  label: string;
  onTake: () => Promise<ResourceError | null>;
  onReturn: () => Promise<ResourceError | null>;
  onReset: () => Promise<ResourceError | null>;
}

/** Centered shared-resource bar (rolvium.pen "Reserva de Destino"): pool moons + "en tu mano" + Devolver/Reiniciar. */
export function SharedResourceBar({ def, state, role, userId, label, onTake, onReturn, onReset }: Props): JSX.Element {
  const { t } = useTranslation();
  const [err, setErr] = useState<string | null>(null);
  const value = state?.value ?? 0, max = state?.max ?? def.max, hand = handOf(state, userId);
  const run = async (fn: () => Promise<ResourceError | null>) => { const e = await fn(); setErr(e ? t(`table.resource.errors.${e}`) : null); };
  return (
    <div className={`tb-res ${hand > 0 ? 'has-hand' : ''}`} role="group" aria-label={label}>
      <div className="tb-res-pool">
        <span className="tb-rotulo">{label}</span>
        <div className="tb-res-moons">
          {Array.from({ length: max }, (_, i) => (
            <button key={i} type="button" className="tb-moon-btn" disabled={i >= value || !canTake(def, state, role, userId)}
              onClick={() => void run(onTake)} aria-label={i < value ? t('table.resource.take') : t('table.resource.spent')} style={{ opacity: i < value ? 1 : 0.16 }}>
              <Crescent size={34} />
            </button>
          ))}
        </div>
        <span className="tb-res-count">{value}/{max}</span>
      </div>
      <div className="tb-res-hand">
        {role === 'player' ? (
          <>
            <span className="tb-rotulo tb-gold">{t('table.resource.inHand')}</span>
            <div className="tb-res-dots" aria-label={t('table.resource.inHand')}>
              {Array.from({ length: def.perTakeMax }, (_, i) => <span key={i} className={`tb-dot ${i < hand ? 'on' : ''}`} />)}
            </div>
            <span className="tb-res-plus">+{hand}</span>
            <button type="button" className="tb-btn" disabled={hand === 0} onClick={() => void run(onReturn)}>{t('table.resource.return')}</button>
          </>
        ) : (
          <span className="tb-rotulo">{t('table.resource.dmNote')}</span>
        )}
        {canReset(def, role) && <button type="button" className="tb-btn tb-btn-gold" onClick={() => void run(onReset)}>{t('table.resource.reset')}</button>}
      </div>
      {err && <span className="tb-res-err" role="alert">{err}</span>}
    </div>
  );
}
