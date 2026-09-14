import type { ImageAsset, Texture, TextureCategory } from '../entities/Scene';
import type { LibraryItem, LibraryPlace } from './libraryRules';

/**
 * EL FONDO DEL MAPA SALE DE DOS SITIOS (spec de maps, § «EL FONDO DEL MAPA»; orden suya del 2026-09-14: «*lo
 * que cambia aquí es que están los de sistema que son los mismos de la textura y los del DJ que son los que
 * sólo viven en la campaña*»).
 *
 * - **Los suyos**: los que sube el director. Viven **SÓLO en su campaña** («*los fondos de las campañas sólo
 *   son para la campaña del DM que la publicó*»), y quien lo hace cumplir de verdad es la RLS de `maps_images`.
 * - **Las texturas**: de la HERRAMIENTA, con sus siete categorías; valen en todos los mapas de todas las
 *   campañas.
 *
 * El catálogo los enseña JUNTOS, los suyos arriba, y para eso necesita verlos con la misma forma. Eso —y sólo
 * eso— es lo que hay aquí: nada de React y nada de Supabase.
 */

/**
 * El grupo del rail donde viven los suyos. No es una categoría de textura: es «lo de esta campaña», y por eso
 * entra como GRUPO y las texturas como secciones DE SERIE. Ése es justo el orden que pinta el catálogo común
 * (`sectionsOf`: primero los grupos, luego las de serie), que es lo que él pidió: los suyos arriba.
 */
export const CAMPAIGN_GROUP = 'campaign';

export interface BackgroundItem extends LibraryItem {
  url: string;
  /** `true` = suyo, de esta campaña. `false` = una textura de la herramienta. */
  mine: boolean;
  /** La categoría de la textura. `null` en los suyos: los fondos de una campaña no se clasifican. */
  category: TextureCategory | null;
}

/** Dónde vive cada uno: lo ÚNICO que distingue un fondo suyo de una textura para el catálogo. */
export const backgroundPlace = (b: BackgroundItem): LibraryPlace =>
  b.mine ? { group: CAMPAIGN_GROUP, builtIn: null } : { group: null, builtIn: b.category };

/**
 * Un fondo suyo. `uploadedBy` no viaja en la fila de `maps_images` y al catálogo no le hace falta: aquí no
 * hay «de serie» contra «tuyas» que distinguir — todo lo de esta sección es suyo por definición.
 */
export const fromImage = (img: ImageAsset): BackgroundItem => ({
  id: img.id, name: img.name, url: img.url, createdAt: img.createdAt, uploadedBy: null, mine: true, category: null,
});

/** Una textura, vista como fondo. Conserva su categoría, que es lo que la coloca en su sección. */
export const fromTexture = (tex: Texture): BackgroundItem => ({
  id: tex.id, name: tex.name, url: tex.url, createdAt: tex.createdAt, uploadedBy: tex.uploadedBy,
  mine: false, category: tex.category,
});

/**
 * Lo que enseña el catálogo. `null` mientras falte CUALQUIERA de las dos listas: enseñar sólo la mitad sería
 * decirle que no tiene fondos cuando lo que pasa es que aún no han llegado.
 */
export const backgroundItems = (
  images: readonly ImageAsset[] | null, textures: readonly Texture[] | null,
): BackgroundItem[] | null =>
  images === null || textures === null ? null : [...images.map(fromImage), ...textures.map(fromTexture)];

/**
 * ¿Puede ordenar ESTE? Sus fondos son suyos y siempre puede con ellos; tocar una textura es tocar la
 * biblioteca de la herramienta, y eso pide el permiso `manage_textures` — el mismo que en su catálogo.
 */
export const canManageBackground = (b: BackgroundItem, canManageTextures: boolean): boolean =>
  b.mine || canManageTextures;
