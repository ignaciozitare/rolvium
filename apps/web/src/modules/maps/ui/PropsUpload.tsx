import { useTranslation } from '@rolvium/i18n';
import { compressImage, type AlphaMap } from '@rolvium/ui';
import type { PropPack } from '../domain/entities/Scene';
import { nameFromFile } from '../domain/useCases/propRules';
import { compressionLevelsRepo } from '../container';
import { LibraryUpload, type Preparer } from './LibraryUpload';

/** Lo que hace falta para crear la pieza: el resto (foto, quién, escala) lo pone quien la guarda. */
export interface PropUploadInput {
  name: string; packId: string | null; naturalWidth: number; naturalHeight: number;
  /** La opacidad de la foto, para sacarle la silueta (§ 6.9). `null` si el navegador no supo leerla. */
  alpha?: AlphaMap | null;
}

interface Props {
  packs: readonly PropPack[];
  /** El paquete al que van: el abierto en el catálogo, cambiable aquí. `null` = «Sin clasificar». */
  packId: string | null;
  /** Ficheros que ya venían arrastrados sobre el catálogo, si los hay. */
  initialFiles?: File[];
  /**
   * Guardar UNA pieza ya comprimida. Quien recibe esto sube y crea la fila; aquí sólo se comprime (camino
   * único de `specs/core/images/SPEC.md`) y se lleva la cola. Si lanza, la fila de la cola queda en «no se pudo».
   */
  onAdd: (input: PropUploadInput, blob: Blob) => Promise<void>;
  onClose: () => void;
}

/** Comprimir con el destino `prop`, con el nivel que haya elegido un admin en Ajustes (`balanced` de serie). */
export type Compressor = Preparer;
const compressProp: Compressor = async file => {
  const levels = await compressionLevelsRepo.load();
  /*
   * Y de paso se pide la OPACIDAD (§ 6.9): la silueta sale de la MISMA pasada en la que la imagen ya está
   * abierta para comprimirla, sin volver a bajarla ni descodificarla. Si el navegador no sabe darla, llega
   * `null` y la pieza nace con el rectángulo de siempre — subir no puede fallar por esto.
   */
  return compressImage(file, 'prop', levels?.prop ?? 'balanced', undefined, { alpha: true });
};

/**
 * SUBIR PIEZAS EN LOTE (`rolvium.pen` · `DCs6S`): la cara de las PIEZAS de la subida común (`LibraryUpload`).
 * Van a un paquete (o a «Sin clasificar») y se comprimen conservando la transparencia: WebP lleva alfa y el
 * compresor no aplana. Sin alfa una mesa llegaría con un recuadro blanco y la galería no serviría de nada.
 */
export function PropsUpload({ packs, packId, initialFiles, onAdd, onClose, compress = compressProp }: Props & { compress?: Compressor }): JSX.Element {
  const { t } = useTranslation();
  return (
    <LibraryUpload keys="maps.props.upload" groups={packs} allowUnsorted groupId={packId}
      {...(initialFiles ? { initialFiles } : {})}
      prepare={compress} nameOf={f => nameFromFile(f, t('maps.props.upload.fallbackName'))}
      onAdd={(input, blob) => onAdd({ name: input.name, packId: input.groupId, naturalWidth: input.naturalWidth, naturalHeight: input.naturalHeight, alpha: input.alpha ?? null }, blob)}
      onClose={onClose} />
  );
}
