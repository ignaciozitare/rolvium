import type { ViewMemoryPort } from '../domain/ports/ViewMemoryPort';

/** Una clave por campaña: en dos campañas distintas mira dos escenas distintas, y ninguna pisa a la otra. */
const keyOf = (campaignId: string): string => `rolvium_maps_scene_${campaignId}`;

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
}
