import { useMemo } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { compressImage } from '@rolvium/ui';
import { CAMPAIGN_GROUP } from '../domain/useCases/backgroundRules';
import { nameFromFile } from '../domain/useCases/propRules';
import { compressionLevelsRepo } from '../container';
import { LibraryUpload, type Preparer } from './LibraryUpload';

interface Props {
  /** Ficheros que ya venían arrastrados sobre el catálogo, si los hay. */
  initialFiles?: File[];
  /** Guardar UNO ya comprimido. Quien recibe esto sube y crea la fila; la cola la lleva `LibraryUpload`. */
  onAdd: (name: string, blob: Blob) => Promise<void>;
  onClose: () => void;
}

/**
 * Comprimir con el destino `background`, con el nivel que haya elegido un admin en Ajustes (`balanced` de
 * serie). El fondo **nunca reduce resolución** en ningún nivel (spec `specs/core/images/SPEC.md`): sólo cambia
 * formato/calidad — su condición original («*¿pero se comprimen y pierden calidad? porque eso sería un
 * problema*», 2026-09-14) sigue cumplida.
 */
export const compressBackground: Preparer = async file => {
  const levels = await compressionLevelsRepo.load();
  return compressImage(file, 'background', levels?.background ?? 'balanced');
};

/**
 * SUBIR FONDOS EN LOTE: la cara de los FONDOS de la subida común (`LibraryUpload`). Él, 2026-09-14: «*el subir
 * está mal, tiene que ser como las texturas*» — hasta hoy era un fichero cada vez, con un `<input type="file">`.
 *
 * No hay «a qué grupo»: sólo hay uno —los fondos de ESTA campaña— y ahí va todo lo que entre por aquí («*está
 * separado y no es público para todo el mundo, sino que vive dentro de la campaña*»).
 */
export function BackgroundUpload({ initialFiles, onAdd, onClose, prepare = compressBackground }: Props & { prepare?: Preparer }): JSX.Element {
  const { t } = useTranslation();
  const groups = useMemo(() => [{ id: CAMPAIGN_GROUP, name: t('maps.backgrounds.catalog.mine') }], [t]);
  return (
    <LibraryUpload keys="maps.backgrounds.upload" groups={groups} allowUnsorted={false} groupId={CAMPAIGN_GROUP}
      {...(initialFiles ? { initialFiles } : {})}
      prepare={prepare} nameOf={f => nameFromFile(f, t('maps.backgrounds.upload.fallbackName'))}
      onAdd={(input, blob) => onAdd(input.name, blob)}
      onClose={onClose} />
  );
}
