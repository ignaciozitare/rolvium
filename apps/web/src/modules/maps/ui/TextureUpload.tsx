import { useMemo } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { compressImage } from '@rolvium/ui';
import { TEXTURE_CATEGORIES, type TextureCategory } from '../domain/entities/Scene';
import { nameFromFile } from '../domain/useCases/propRules';
import { compressionLevelsRepo } from '../container';
import { LibraryUpload, type Preparer } from './LibraryUpload';

/** Lo que hace falta para crear la textura: el resto (foto, quién, baldosa de serie) lo pone quien la guarda. */
export interface TextureUploadInput { name: string; category: TextureCategory }

interface Props {
  /** La categoría a la que van: la abierta en el catálogo, cambiable aquí. */
  category: TextureCategory;
  /** Ficheros que ya venían arrastrados sobre el catálogo, si los hay. */
  initialFiles?: File[];
  /** Guardar UNA textura. Quien recibe esto sube y crea la fila. Si lanza, la fila de la cola queda en «no se pudo». */
  onAdd: (input: TextureUploadInput, blob: Blob) => Promise<void>;
  onClose: () => void;
}

/**
 * Una textura entra TAL CUAL, como entraba por el selector de fichero de antes: es un mosaico que se repite y
 * se mira de cerca, y ya se guardaba sin comprimir. Ya no es el preparador de serie (ver `compressTexture`) pero
 * se deja para quien necesite el fichero sin tocar.
 */
export const rawTexture: Preparer = async file => ({ blob: file, originalBytes: file.size, bytes: file.size, compressed: false, width: 0, height: 0 });

/**
 * Comprimir al destino `texture`, con el nivel que haya elegido un admin en Ajustes (`balanced` si nadie lo ha
 * tocado). Aparte para poder doblarlo en los tests.
 */
export const compressTexture: Preparer = async file => {
  const levels = await compressionLevelsRepo.load();
  return compressImage(file, 'texture', levels?.texture ?? 'balanced');
};

/**
 * SUBIR TEXTURAS EN LOTE: la cara de las TEXTURAS de la subida común (`LibraryUpload`). Él, 2026-09-13: «*para las
 * texturas, para subirlas hazlo igual que como hiciste con las piezas … puedo subir de a muchas*» (§ 6.8, punto 1).
 * En vez de «A qué paquete» sale «A qué categoría», y aquí valen también JPG: una textura no necesita transparencia.
 */
export function TextureUpload({ category, initialFiles, onAdd, onClose, prepare = compressTexture }: Props & { prepare?: Preparer }): JSX.Element {
  const { t } = useTranslation();
  const groups = useMemo(() => TEXTURE_CATEGORIES.map(c => ({ id: c, name: t(`maps.room.catalog.cat.${c}`) })), [t]);
  return (
    <LibraryUpload keys="maps.textures.upload" groups={groups} allowUnsorted={false} groupId={category}
      {...(initialFiles ? { initialFiles } : {})}
      prepare={prepare} nameOf={f => nameFromFile(f, t('maps.textures.upload.fallbackName'))}
      onAdd={(input, blob) => onAdd({ name: input.name, category: (input.groupId ?? category) as TextureCategory }, blob)}
      onClose={onClose} />
  );
}
