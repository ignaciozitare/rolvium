import type { ReactNode } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { Tooltip } from '@rolvium/ui';
import { initialsOf } from '@/modules/maps/domain/useCases/mapRules';
import { gameValuesOf } from '../domain/useCases/bestiaryRules';
import type { BestiaryEntry } from '../domain/entities/BestiaryEntry';

interface Props {
  entry: BestiaryEntry;
  specialtyLabel: (id: string) => string;
  onRoll: (e: BestiaryEntry) => void;
  onPlace: (e: BestiaryEntry) => void;
  /** Editar si es propia; duplicar si es del manual — las del manual no se tocan. */
  onEdit: (e: BestiaryEntry) => void;
  onPhoto: (e: BestiaryEntry) => void;
  onMore: (e: BestiaryEntry) => void;
  /**
   * Lee la ficha de un PNJ para sacar sus valores de juego. Entra por parámetro porque quien sabe leerla
   * es el motor del sistema, y esta ficha no conoce ningún sistema.
   */
  derive?: (sheet: Record<string, unknown>) => Record<string, unknown>;
  /**
   * El desplegable de tirada, cuando es ESTA la criatura por la que se está tirando. Se pinta dentro de la
   * ficha a propósito: así sale encima de ella, el catálogo se sigue viendo y no hay que calcular
   * coordenadas ni seguirla al hacer scroll.
   */
  popover?: ReactNode;
}

const ORIGIN_KEY = { manual: 'bestiary.origin.manual', custom: 'bestiary.origin.custom', npc: 'bestiary.origin.npc' } as const;

/**
 * Ficha del catálogo. La imagen manda, que es lo que pidió el dueño: sin ella el director no reconoce la
 * criatura de un vistazo y acaba leyendo nombres.
 *
 * El ojo aparece al pasar por encima y abre la foto entera. Está como `<button>` de verdad y no como un adorno
 * que reacciona al ratón, porque si no con teclado no habría manera de llegar a la foto.
 *
 * Reutilización — **NEW (propio del módulo)**, decidido a conciencia: los botones NO usan `Btn` de `@rolvium/ui`.
 * Esta ficha vive dentro de la mesa, que va vestida con el pergamino del sistema de juego (`--sys-*`), y `Btn`
 * trae el degradado ámbar de la plataforma: metido en una hoja de pergamino canta. Es el mismo criterio que ya
 * siguen `EncounterMenu` y `StrokeBar` de `maps`, con sus clases `mp-*`. Donde sí manda el estilo de la
 * plataforma —los modales— se usan los componentes compartidos: `Modal`, `Btn` y `Tooltip`.
 */
export function EntryCard({ entry, specialtyLabel, onRoll, onPlace, onEdit, onPhoto, onMore, derive, popover }: Props): JSX.Element {
  const { t } = useTranslation();
  const specs = Object.values(entry.data.specialties).flat().slice(0, 2);
  const { resistance, protection } = gameValuesOf(entry, derive);
  const editKey = entry.editable ? 'bestiary.action.edit' : 'bestiary.action.duplicate';

  return (
    <article className="bs-card">
      <div className="bs-card-img">
        {entry.tokenUrl
          ? <img src={entry.tokenUrl} alt="" className="bs-card-photo" />
          : <span className="bs-card-ini" aria-hidden="true">{initialsOf(entry.name)}</span>}
        <Tooltip label={t('bestiary.action.photo')} placement="left">
          <button type="button" className="bs-card-eye" aria-label={t('bestiary.action.photoOf', { name: entry.name })} onClick={() => onPhoto(entry)}>
            <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>visibility</span>
          </button>
        </Tooltip>
      </div>

      <div className="bs-card-body">
        <div className="bs-card-head">
          <h3 className="bs-card-name">{entry.name}</h3>
          <span className={`bs-origin bs-origin-${entry.origin}`}>{t(ORIGIN_KEY[entry.origin])}</span>
        </div>

        <p className="bs-card-stats">
          {t('bestiary.card.resistance', { n: String(resistance) })} · {t('bestiary.card.protection', { n: String(protection) })}
        </p>

        {specs.length > 0 && (
          <ul className="bs-card-specs">
            {specs.map(id => <li key={id} className="bs-spec">{specialtyLabel(id)}</li>)}
          </ul>
        )}

        {entry.notes && <p className="bs-card-notes">{entry.notes}</p>}

        <p className="bs-card-src">
          {entry.data.page ? t('bestiary.card.page', { n: String(entry.data.page) })
            : entry.origin === 'npc' ? t('bestiary.card.npcSheet') : t('bestiary.card.own')}
        </p>

        <div className="bs-card-actions">
          <button type="button" className="bs-btn" onClick={() => onRoll(entry)}>{t('bestiary.action.roll')}</button>
          <button type="button" className="bs-btn bs-btn-on" onClick={() => onPlace(entry)}>{t('bestiary.action.place')}</button>
          <button type="button" className="bs-btn" onClick={() => onEdit(entry)}>{t(editKey)}</button>
          <span className="bs-card-sp" />
          <button type="button" className="bs-icon" aria-label={t('bestiary.action.more', { name: entry.name })} onClick={() => onMore(entry)}>
            <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>more_horiz</span>
          </button>
        </div>
      </div>

      {popover}
    </article>
  );
}
