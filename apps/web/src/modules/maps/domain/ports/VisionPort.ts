import type { SceneVision } from '@rolvium/core';

export type { SceneVision } from '@rolvium/core';

/**
 * Vision and fog, computed by the API — never here.
 *
 * The browser only receives the walls it is allowed to see, so it CANNOT work out what is behind a hidden one.
 * Asking the server is the security boundary, not an optimisation (specs/modules/maps/SPEC.md § «Rules & limits»).
 */
/** El brochazo del pincel de niebla: dónde, cómo de grande y con qué forma. */
export interface FogBrush {
  x: number; y: number; radius: number;
  strength?: number;
  hardness?: number;
  /** El contorno roto: un multiplicador de radio por vértice dando la vuelta. Ausente = círculo. */
  edge?: number[];
}

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
  /**
   * DM brush: reveal or hide a disc (scene px) on every player's explored cells at once.
   *
   * La forma del brochazo (rebanada 9) va aparte del centro y el radio y es OPCIONAL: sin ella el servidor
   * pinta el disco duro de siempre. `edge` es el contorno roto, y lo tira el NAVEGADOR porque «distinto cada
   * vez» es una tirada por pincelada; el servidor sólo lo lee.
   *
   * ⚠️ En la niebla la transparencia sólo puede ser COBERTURA: se guarda por casillas, y una casilla está o
   * no está. A media fuerza se abre a manchas y una segunda pasada abre más — que es lo contrario de «tapa o
   * destapa a saco». A fuerza máxima sale el disco entero, sin azar.
   */
  paint(sceneId: string, op: 'reveal' | 'hide', at: FogBrush): Promise<SceneVision>;
  /** DM: «Revelar todo» / «Ocultar todo» for the whole scene. */
  paintAll(sceneId: string, op: 'reveal' | 'hide'): Promise<SceneVision>;
}
