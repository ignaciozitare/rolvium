import type { SceneVision } from '@rolvium/core';

export type { SceneVision } from '@rolvium/core';

/**
 * Vision and fog, computed by the API — never here.
 *
 * The browser only receives the walls it is allowed to see, so it CANNOT work out what is behind a hidden one.
 * Asking the server is the security boundary, not an optimisation (specs/modules/maps/SPEC.md § «Rules & limits»).
 */
export interface VisionPort {
  /**
   * Recompute and remember: on entering the scene, on moving a token, on a door / light / wall change.
   *
   * `at` es la posición PROVISIONAL de un token propio mientras se arrastra: con ella el servidor contesta
   * «qué verías si lo sueltas aquí» y NO guarda nada. Sirve para que la niebla siga al token en vez de saltar
   * al soltarlo. Sin `at`, es el refresco normal y sí se guarda lo explorado.
   */
  refresh(sceneId: string, at?: { tokenId: string; x: number; y: number; from?: { x: number; y: number } }, opts?: {
    /**
     * LA SONDA DE PRUEBA (§ 7.3). Un punto en px de escena, SÓLO del director: «qué vería un jugador desde
     * aquí». La calcula el SERVIDOR por el mismo camino que la del jugador de verdad —recalcularla aquí haría
     * que lo que ve él y lo que ve el jugador pudieran discrepar, que es justo lo que viene a comprobar— y
     * **no guarda nada**: lo que contesta es lo que se ve DESDE ESE PUNTO, y la memoria la une el navegador.
     */
    probe?: { x: number; y: number };
  }): Promise<SceneVision>;
  /** DM brush: reveal or hide a disc (scene px) on every player's explored cells at once. */
  paint(sceneId: string, op: 'reveal' | 'hide', at: { x: number; y: number; radius: number }): Promise<SceneVision>;
  /** DM: «Revelar todo» / «Ocultar todo» for the whole scene. */
  paintAll(sceneId: string, op: 'reveal' | 'hide'): Promise<SceneVision>;
}
