import { useMemo } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { Prop, PropPack } from '../domain/entities/Scene';
import type { LibraryGroup } from '../domain/useCases/libraryRules';
import { packGroups, PROP_CATEGORIES, propPlace, type PropShelf } from '../domain/useCases/propRules';
import { LibraryCatalog } from './LibraryCatalog';

interface Props {
  /** `null` mientras se cargan: no es lo mismo «vacía» que «todavía no han llegado». */
  props: Prop[] | null;
  packs: PropPack[] | null;
  /**
   * ¿PUEDE ORDENAR LA BIBLIOTECA? Es el permiso `manage_props` del motor de roles («*por permisos, como las
   * texturas*»). Sin él no salen ni «Subir piezas», ni los tres puntos, ni «Nuevo paquete». Quien deniega de
   * verdad es la base, con `has_tool('manage_props')` en las políticas.
   */
  canManage: boolean;
  favorites: readonly string[];
  recents: readonly string[];
  onToggleFavorite: (prop: Prop) => void;
  /** Elegir una la hace el sello y cierra el catálogo: eso lo hace quien recibe esto. */
  onPick: (prop: Prop) => void;
  /** Abrir la subida en lote, en el paquete que se esté mirando. Con ficheros si vienen arrastrados. */
  onUpload: (packId: string | null, files?: File[]) => void;
  onRename: (prop: Prop, name: string) => void;
  onMoveTo: (prop: Prop, packId: string | null) => void;
  /** Ya confirmado: quien recibe esto sólo tiene que borrarla. */
  onRemove: (prop: Prop) => void;
  onNewPack: (name: string) => void;
  onRenamePack: (pack: PropPack, name: string) => void;
  onRemovePack: (pack: PropPack) => void;
  /** Con qué estante se abre. De serie, el primer paquete; sin paquetes, todo. */
  initialShelf?: PropShelf;
  onClose: () => void;
}

/**
 * EL CATÁLOGO DE PIEZAS (`rolvium.pen` · `w7sTC0`): la cara de las PIEZAS del catálogo común (`LibraryCatalog`).
 *
 * 🔑 LA BIBLIOTECA ES DE LA HERRAMIENTA (él, 2026-09-11: «*lo que se sube sirve para todos*») y va en PAQUETES
 * propios (2026-09-09), no en las seis categorías de agosto: ésas sólo valen para las piezas de serie, que hoy
 * no existen, así que su bloque del rail no se pinta hasta que haya alguna. Aquí sólo se dice qué es un paquete,
 * dónde vive cada pieza y cómo se pinta su arte; todo lo demás es el catálogo común.
 */
export function PropsCatalog({
  props, packs, canManage, favorites, recents, onToggleFavorite, onPick, onUpload, onRename, onMoveTo, onRemove,
  onNewPack, onRenamePack, onRemovePack, initialShelf, onClose,
}: Props): JSX.Element {
  const { t } = useTranslation();
  const groups = useMemo(() => (packs ? packGroups(packs) : null), [packs]);
  const packOf = (g: LibraryGroup): PropPack | undefined => packs?.find(k => k.id === g.id);
  return (
    <LibraryCatalog<Prop>
      keys="maps.props.catalog"
      icon={<span className="mp-tool-img mp-propcat-head-icon" aria-hidden="true" style={{ maskImage: 'url(/icons/props-mask.svg)', WebkitMaskImage: 'url(/icons/props-mask.svg)' }} />}
      items={props} groups={groups} builtIns={PROP_CATEGORIES} builtInLabel={c => t(`maps.props.catalog.cat.${c}`)}
      placeOf={propPlace} groupIcon="folder" canManage={canManage} favorites={favorites} recents={recents}
      onToggleFavorite={onToggleFavorite} onPick={onPick}
      renderThumb={p => <img src={p.imageUrl} alt="" loading="lazy" />}
      onUpload={onUpload} onRename={onRename} onMoveTo={onMoveTo} onRemove={onRemove}
      onNewGroup={onNewPack}
      onRenameGroup={(g, name) => { const k = packOf(g); if (k) onRenamePack(k, name); }}
      onRemoveGroup={g => { const k = packOf(g); if (k) onRemovePack(k); }}
      {...(initialShelf ? { initialShelf } : {})}
      onClose={onClose} />
  );
}
