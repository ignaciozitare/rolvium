import { useMemo } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { TEXTURE_CATEGORIES, type ImageAsset, type Texture } from '../domain/entities/Scene';
import {
  backgroundItems, backgroundPlace, canManageBackground, CAMPAIGN_GROUP, type BackgroundItem,
} from '../domain/useCases/backgroundRules';
import type { LibraryGroup } from '../domain/useCases/libraryRules';
import { LibraryCatalog } from './LibraryCatalog';

interface Props {
  /** Los fondos de ESTA campaña. `null` mientras se cargan. */
  images: ImageAsset[] | null;
  /** Las texturas de la herramienta, que valen también de fondo. `null` mientras se cargan. */
  textures: Texture[] | null;
  /**
   * El permiso `manage_textures`. Manda SÓLO sobre las texturas: sus fondos son de su campaña y siempre puede
   * con ellos (subir, renombrar, borrar), lo tenga o no.
   */
  canManageTextures: boolean;
  favorites: readonly string[];
  recents: readonly string[];
  onToggleFavorite: (item: BackgroundItem) => void;
  /** Elegirlo lo pone de fondo y cierra el catálogo: eso lo hace quien recibe esto. */
  onPick: (item: BackgroundItem) => void;
  /** Abrir la subida en lote. Con ficheros si vienen arrastrados sobre el catálogo. */
  onUpload: (files?: File[]) => void;
  onRename: (item: BackgroundItem, name: string) => void;
  /** Ya confirmado por él: quien recibe esto sólo tiene que borrarlo. */
  onRemove: (item: BackgroundItem) => void;
  onClose: () => void;
}

/**
 * EL CATÁLOGO DE FONDOS: la tercera cara del catálogo común (`LibraryCatalog`), después de las piezas y las
 * texturas. Spec de maps, § «EL FONDO DEL MAPA»; suyo, 2026-09-14: «*no hay un catálogo categorizado como con
 * las texturas y debería ser el mismo*».
 *
 * 🔑 **DOS BIBLIOTECAS A LA VEZ, Y LAS SUYAS ARRIBA.** Los fondos de su campaña entran como GRUPO del rail y
 * las texturas como secciones DE SERIE, que es exactamente el orden en que el catálogo pinta las secciones
 * (`sectionsOf`: primero los grupos, luego las de serie). Por eso no hace falta tocar el componente para que
 * salgan «arriba de las texturas de sistema», que es como él lo pidió.
 *
 * Los dos rótulos del rail ya existían: el de los grupos dice TUS FONDOS y el de las de serie, TEXTURAS DE
 * SISTEMA — cada cara los nombra con sus propias claves.
 *
 * Sin «mover a»: los suyos son de su campaña y las texturas ya están en su categoría, así que no hay adónde
 * llevarlos. Por eso `onMoveTo` no se pasa (y el catálogo esconde esa opción).
 */
export function BackgroundCatalog({
  images, textures, canManageTextures, favorites, recents, onToggleFavorite, onPick, onUpload, onRename, onRemove, onClose,
}: Props): JSX.Element {
  const { t } = useTranslation();
  const groups = useMemo<LibraryGroup[]>(
    () => [{ id: CAMPAIGN_GROUP, name: t('maps.backgrounds.catalog.mine'), order: 0 }],
    [t],
  );
  const items = useMemo(() => backgroundItems(images, textures), [images, textures]);
  return (
    <LibraryCatalog<BackgroundItem>
      keys="maps.backgrounds.catalog"
      icon={<span className="material-symbols-outlined mp-propcat-head-icon" aria-hidden="true">image</span>}
      items={items} groups={groups} builtIns={TEXTURE_CATEGORIES}
      builtInLabel={c => t(`maps.room.catalog.cat.${c}`)}
      placeOf={backgroundPlace} groupIcon="image"
      canManage canManageItem={b => canManageBackground(b, canManageTextures)}
      favorites={favorites} recents={recents} onToggleFavorite={onToggleFavorite} onPick={onPick}
      /*
       * La miniatura va CUBRIENDO, no repetida como en el catálogo de texturas: de fondo, una textura no se
       * embaldosa — se encaja en el mapa con Cubrir / Encajar. Enseñarla repetida prometería otra cosa.
       */
      renderThumb={b => (
        <span className="mp-propcat-bg" data-testid="mp-bg-thumb" style={{ backgroundImage: `url(${b.url})` }} />
      )}
      onUpload={(_group, files) => onUpload(files)}
      onRename={onRename}
      onRemove={onRemove}
      initialShelf={{ kind: 'pack', id: CAMPAIGN_GROUP }}
      hint={t('maps.backgrounds.catalog.hint')}
      onClose={onClose} />
  );
}
