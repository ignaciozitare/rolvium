/**
 * LO QUE ESTABA MIRANDO EL DIRECTOR, para que una recarga no le mueva la vista (petición suya, 2026-09-10:
 * «*si recargo debería caer en la misma vista o escena*»).
 *
 * 🔑 **No es la escena ACTIVA de la mesa.** Aquélla (`campaigns.active_scene_id`) es lo que ven los jugadores
 * y viaja a todo el mundo; ésta es sólo dónde tiene puesto el ojo él, vive en SU navegador y no la ve nadie.
 * Mezclarlas cambiaría la partida de los demás por recargar una pestaña.
 *
 * Es un puerto y no una llamada suelta a `localStorage` porque la UI no hace E/S: el adaptador vive en
 * `infra/` y la pantalla lo recibe por `container.ts`, como todo lo demás.
 */
export interface ViewMemoryPort {
  /** La última escena que miró en esta campaña, o `null` si no hay nada apuntado. */
  lastScene(campaignId: string): string | null;
  rememberScene(campaignId: string, sceneId: string): void;
}
