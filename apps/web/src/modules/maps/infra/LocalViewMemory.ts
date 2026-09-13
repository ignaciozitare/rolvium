import type { ViewMemoryPort } from '../domain/ports/ViewMemoryPort';
import type { BuilderMode } from '../domain/useCases/roomRules';
import { pushRecent } from '../domain/useCases/propRules';

/** Una clave por campaña: en dos campañas distintas mira dos escenas distintas, y ninguna pisa a la otra. */
const keyOf = (campaignId: string): string => `rolvium_maps_scene_${campaignId}`;
/** UNA clave para el modo del Builder, sin campaña: es «la última elección que hice», no una por mesa. */
const BUILDER_MODE_KEY = 'rolvium_maps_builder_mode';
const isBuilderMode = (v: string | null): v is BuilderMode => v === 'photo' || v === 'draw';
/** Las dos listas de la galería de piezas, sin campaña: la biblioteca es una para toda la herramienta. */
const FAVORITE_PROPS_KEY = 'rolvium_maps_prop_favorites';
const RECENT_PROPS_KEY = 'rolvium_maps_prop_recents';
/** Y las dos de las texturas, que desde el 2026-09-13 tienen el mismo catálogo. */
const FAVORITE_TEXTURES_KEY = 'rolvium_maps_texture_favorites';
const RECENT_TEXTURES_KEY = 'rolvium_maps_texture_recents';
/** Una lista de ids guardada como JSON. Cualquier cosa que no sea una lista de textos vale como vacía. */
const readIds = (key: string): string[] => {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
};
const writeIds = (key: string, ids: string[]): void => {
  try { localStorage.setItem(key, JSON.stringify(ids)); } catch { /* almacenamiento no disponible */ }
};

/**
 * EN EL NAVEGADOR, y a propósito: es una preferencia de SU pantalla, no un dato de la partida — el mismo
 * reparto que el tema y el idioma (`shared/hooks/useTheme.tsx`).
 *
 * Todo va envuelto en `try`: con el almacenamiento capado (modo privado de algunos navegadores, cookies de
 * terceros bloqueadas) `localStorage` no devuelve `null`, LANZA. Sin esto la pantalla del mapa no abriría.
 */
export class LocalViewMemory implements ViewMemoryPort {
  lastScene(campaignId: string): string | null {
    try { return localStorage.getItem(keyOf(campaignId)); } catch { return null; }
  }

  rememberScene(campaignId: string, sceneId: string): void {
    try { localStorage.setItem(keyOf(campaignId), sceneId); } catch { /* almacenamiento no disponible */ }
  }

  lastBuilderMode(): BuilderMode | null {
    try { const v = localStorage.getItem(BUILDER_MODE_KEY); return isBuilderMode(v) ? v : null; } catch { return null; }
  }

  rememberBuilderMode(mode: BuilderMode): void {
    try { localStorage.setItem(BUILDER_MODE_KEY, mode); } catch { /* almacenamiento no disponible */ }
  }

  favoriteProps(): string[] { return readIds(FAVORITE_PROPS_KEY); }
  toggleFavoriteProp(id: string): string[] { return toggleIn(FAVORITE_PROPS_KEY, id); }
  recentProps(): string[] { return readIds(RECENT_PROPS_KEY); }
  rememberRecentProp(id: string): string[] { return pushIn(RECENT_PROPS_KEY, id); }

  favoriteTextures(): string[] { return readIds(FAVORITE_TEXTURES_KEY); }
  toggleFavoriteTexture(id: string): string[] { return toggleIn(FAVORITE_TEXTURES_KEY, id); }
  recentTextures(): string[] { return readIds(RECENT_TEXTURES_KEY); }
  rememberRecentTexture(id: string): string[] { return pushIn(RECENT_TEXTURES_KEY, id); }
}

/** Marcar o desmarcar en una lista guardada, y devolver cómo queda. */
function toggleIn(key: string, id: string): string[] {
  const cur = readIds(key);
  const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
  writeIds(key, next);
  return next;
}
/** Meter al principio de una lista de recientes guardada, y devolver cómo queda. */
function pushIn(key: string, id: string): string[] {
  const next = pushRecent(readIds(key), id);
  writeIds(key, next);
  return next;
}
