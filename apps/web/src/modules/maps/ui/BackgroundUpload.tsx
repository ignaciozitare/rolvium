import { useMemo } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { CAMPAIGN_GROUP } from '../domain/useCases/backgroundRules';
import { nameFromFile } from '../domain/useCases/propRules';
import { LibraryUpload, type Preparer } from './LibraryUpload';
import { rawTexture } from './TextureUpload';

interface Props {
  /** Ficheros que ya venían arrastrados sobre el catálogo, si los hay. */
  initialFiles?: File[];
  /** Guardar UNO ya comprimido. Quien recibe esto sube y crea la fila; la cola la lleva `LibraryUpload`. */
  onAdd: (name: string, blob: Blob) => Promise<void>;
  onClose: () => void;
}

/**
 * ENTRAN TAL CUAL, SIN COMPRIMIR — el mismo preparador que las texturas, porque es lo que él pidió: «*tiene que
 * ser como las texturas*». Y porque comprimir aquí SÍ se nota: pregunta suya del 2026-09-14, «*¿pero se comprimen
 * y pierden calidad? porque eso sería un problema*». El compresor de fondos reescala a 2560 px de lado mayor y
 * reguarda a calidad 0,82: un mapa de 4000 px perdía la mitad del detalle al hacer zoom.
 */
export const sinComprimir: Preparer = rawTexture;

/**
 * SUBIR FONDOS EN LOTE: la cara de los FONDOS de la subida común (`LibraryUpload`). Él, 2026-09-14: «*el subir
 * está mal, tiene que ser como las texturas*» — hasta hoy era un fichero cada vez, con un `<input type="file">`.
 *
 * No hay «a qué grupo»: sólo hay uno —los fondos de ESTA campaña— y ahí va todo lo que entre por aquí («*está
 * separado y no es público para todo el mundo, sino que vive dentro de la campaña*»).
 *
 * Y **entran tal cual, sin comprimir**, igual que las texturas: un fondo es lo que más de cerca se mira de toda
 * la mesa, y perder detalle ahí se ve. Sigue siendo así desde siempre; lo único que cambia es que ahora entran
 * de a muchos.
 */
export function BackgroundUpload({ initialFiles, onAdd, onClose, prepare = sinComprimir }: Props & { prepare?: Preparer }): JSX.Element {
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
