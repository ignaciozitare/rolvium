import type { Scene, SceneAdventure } from '../entities/Scene';

/**
 * EL DESPLEGABLE DE AVENTURAS del carril de escenas (rolvium.pen § 5 · «PL/Escenas · rail · ELEGIR LA AVENTURA
 * arriba del todo», aprobada el 2026-09-22).
 *
 * Sólo sale con DOS o más: toda campaña nace con su «Aventura 1», y con una sola no hay nada que elegir — su
 * corrección del 2026-09-21: «*sólo aparecerá el menú de aventuras si hay aventuras creadas, si no serán sólo
 * escenas*».
 */
export const showsAdventurePicker = (adventures: readonly SceneAdventure[] | undefined): adventures is readonly SceneAdventure[] =>
  (adventures?.length ?? 0) >= 2;

/**
 * QUÉ AVENTURA ENSEÑA el carril: la que el director eligió; si no eligió, la de la escena que está abierta (lo
 * que se ve en el mapa tiene que estar en la lista); si no, la que está EN CURSO; y si no, la primera.
 */
export function railAdventureId(
  adventures: readonly SceneAdventure[], openScene: Pick<Scene, 'adventureId'> | null, picked: string | null,
): string | null {
  const known = (id: string | null | undefined) => (id && adventures.some(a => a.id === id) ? id : null);
  return known(picked) ?? known(openScene?.adventureId) ?? adventures.find(a => a.status === 'running')?.id ?? adventures[0]?.id ?? null;
}
