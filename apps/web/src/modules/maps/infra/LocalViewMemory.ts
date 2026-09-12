import type { ViewMemoryPort } from '../domain/ports/ViewMemoryPort';
import type { BuilderMode } from '../domain/useCases/roomRules';

/** Una clave por campaña: en dos campañas distintas mira dos escenas distintas, y ninguna pisa a la otra. */
const keyOf = (campaignId: string): string => `rolvium_maps_scene_${campaignId}`;
/** UNA clave para el modo del Builder, sin campaña: es «la última elección que hice», no una por mesa. */
const BUILDER_MODE_KEY = 'rolvium_maps_builder_mode';
const isBuilderMode = (v: string | null): v is BuilderMode => v === 'photo' || v === 'draw';

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
}
