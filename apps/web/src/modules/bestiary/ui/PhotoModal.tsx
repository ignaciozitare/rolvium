import { useTranslation } from '@rolvium/i18n';
import { SheetOverlay } from './SheetOverlay';
import { initialsOf } from '@/modules/maps/domain/useCases/mapRules';
import { resistanceOf } from '../domain/useCases/bestiaryRules';
import type { BestiaryEntry } from '../domain/entities/BestiaryEntry';

interface Props { entry: BestiaryEntry; onClose: () => void; onOpenSheet?: () => void }

/**
 * La foto de la criatura a tamaño grande — lo que abre el ojo de la ficha del catálogo.
 *
 * Sin imagen subida enseña el color y las iniciales, no un hueco roto: la mayoría de las 45 del manual no
 * tienen foto y aun así el director quiere ver de qué va la criatura.
 */
export function PhotoModal({ entry, onClose, onOpenSheet }: Props): JSX.Element {
  const { t } = useTranslation();
  const res = resistanceOf(entry.data);
  const meta = [
    entry.data.page ? t('bestiary.photo.page', { n: String(entry.data.page) }) : null,
    t('bestiary.card.resistance', { n: String(res) }),
    t('bestiary.card.protection', { n: String(entry.data.protection) }),
  ].filter(Boolean).join(' · ');

  return (
    <SheetOverlay title={entry.name} width={760} noPadding onClose={onClose}>
      <div className="bs-photo">
        {entry.tokenUrl
          ? <img className="bs-photo-img" src={entry.tokenUrl} alt={t('bestiary.photo.alt', { name: entry.name })} />
          : <div className="bs-photo-fallback" role="img" aria-label={t('bestiary.photo.alt', { name: entry.name })}>{initialsOf(entry.name)}</div>}
      </div>
      <div className="bs-photo-foot">
        <div>
          <div className="bs-photo-name">{entry.name}</div>
          <div className="bs-photo-meta">{meta}</div>
        </div>
        {onOpenSheet && <button type="button" className="bs-btn bs-btn-lg" onClick={onOpenSheet}>{t('bestiary.photo.openSheet')}</button>}
      </div>
    </SheetOverlay>
  );
}
