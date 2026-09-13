import { useMemo } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { TEXTURE_CATEGORIES, type Texture, type TextureCategory } from '../domain/entities/Scene';
import type { LibraryGroup, LibraryPlace } from '../domain/useCases/libraryRules';
import { LibraryCatalog } from './LibraryCatalog';

/** Cuántas casillas de ancho enseña la miniatura. Es la regla que hace que `tileCells` se VEA. */
export const PREVIEW_CELLS = 4;

/** Dónde vive una textura: en su categoría, siempre (las categorías son cerradas; no hay «sin clasificar»). */
export const texturePlace = (tex: Pick<Texture, 'category'>): LibraryPlace => ({ group: tex.category, builtIn: null });

export type TextureUse = 'wall' | 'floor' | 'door' | 'brush';

interface Props {
  /**
   * Para qué se está eligiendo: la pared de la sala, su suelo, una PUERTA (desde el 2026-09-07) o —desde la
   * rebanada 10— EL PINCEL. Sólo cambia la pista del pie: el catálogo es el mismo, que es todo el sentido de que
   * sea de la herramienta y no de una campaña.
   */
  which: TextureUse;
  /** `null` mientras se cargan: no es lo mismo «no hay ninguna» que «todavía no han llegado». */
  textures: Texture[] | null;
  /**
   * ¿PUEDE ORDENAR EL CATÁLOGO? Es el permiso `manage_textures` del motor de roles, no «es tuya» (orden suya
   * del 2026-09-04: «*esto tiene que ser un permiso en el motor de permisos, no lo puede hacer cualquiera*»).
   * Sin él no salen ni los tres puntos ni el botón de subir, ni siquiera sobre lo que subió uno mismo.
   *
   * Esconder los botones no protege nada: quien deniega de verdad es la base, con `has_tool('manage_textures')`
   * en las políticas de INSERT, UPDATE y DELETE de `maps_textures`.
   */
  canManage: boolean;
  favorites: readonly string[];
  recents: readonly string[];
  onToggleFavorite: (texture: Texture) => void;
  /** Elegir una copia además su tamaño de azulejo a la escena — eso lo hace quien recibe esto. */
  onPick: (texture: Texture) => void;
  /** Subir en lote a una categoría. Llega la que tenga abierta: subir a ciegas es cómo se pierde una textura. */
  onUpload: (category: TextureCategory, files?: File[]) => void;
  /** Renombrar y reclasificar (= «mover a» otra categoría), las opciones de los tres puntos. */
  onUpdate: (texture: Texture, patch: { name?: string; category?: TextureCategory }) => void;
  /** Ya confirmado por el usuario: quien recibe esto sólo tiene que borrarla. */
  onRemove: (texture: Texture) => void;
  onClose: () => void;
}

/**
 * EL CATÁLOGO DE TEXTURAS: la cara de las TEXTURAS del catálogo común (`LibraryCatalog`).
 *
 * Él, 2026-09-13, con el modal viejo de chips delante: «*quiero el mismo de los objetos, usa el mismo componente*»
 * (§ 6.8, punto 1). Así que es el catálogo a pantalla completa de las piezas con otra cara: el rail lleva las
 * categorías (que siguen siendo las siete cerradas: no hay «nueva categoría» ni «sin clasificar»), «Clasificar»
 * es «mover a» otra categoría, y la miniatura se REPITE al tamaño de baldosa que recuerda la textura.
 *
 * 🔑 UNA TEXTURA NO ES UN FONDO, y no se mezclan (él, 2026-09-04): un fondo es de LA CAMPAÑA (`ImageAsset`); una
 * textura es de LA HERRAMIENTA: se sube una vez y sirve en todos los mapas de todas las campañas.
 */
export function TextureCatalog({ which, textures, canManage, favorites, recents, onToggleFavorite, onPick, onUpload, onUpdate, onRemove, onClose }: Props): JSX.Element {
  const { t } = useTranslation();
  const groups = useMemo<LibraryGroup[]>(() => TEXTURE_CATEGORIES.map((c, i) => ({ id: c, name: t(`maps.room.catalog.cat.${c}`), order: i })), [t]);
  const hint = t(which === 'door' ? 'maps.room.catalog.doorHint' : which === 'brush' ? 'maps.room.catalog.brushHint' : 'maps.room.catalog.hint');
  return (
    <LibraryCatalog<Texture>
      keys="maps.textures.catalog"
      icon={<span className="material-symbols-outlined mp-propcat-head-icon" aria-hidden="true">texture</span>}
      items={textures} groups={groups} builtIns={[]} placeOf={texturePlace} groupIcon="label"
      canManage={canManage} favorites={favorites} recents={recents} onToggleFavorite={onToggleFavorite} onPick={onPick}
      /*
       * La miniatura se REPITE al tamaño que la textura recuerda, no estirada: es la única forma de ver si un
       * mosaico va a quedar diminuto o gigante antes de ponerlo (su queja del 2026-09-04).
       */
      renderThumb={tex => (
        <span className="mp-propcat-tex" data-testid="mp-tex-thumb" style={{ backgroundImage: `url(${tex.url})`, backgroundSize: `${(tex.tileCells / PREVIEW_CELLS) * 100}% auto` }} />
      )}
      onUpload={(g, files) => (files ? onUpload((g ?? 'misc') as TextureCategory, files) : onUpload((g ?? 'misc') as TextureCategory))}
      onRename={(tex, name) => onUpdate(tex, { name })}
      onMoveTo={(tex, g) => { if (g) onUpdate(tex, { category: g as TextureCategory }); }}
      onRemove={onRemove}
      initialShelf={{ kind: 'all' }}
      hint={hint}
      onClose={onClose} />
  );
}
