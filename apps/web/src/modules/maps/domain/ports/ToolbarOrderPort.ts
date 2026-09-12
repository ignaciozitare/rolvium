import type { ToolbarOrder } from '../useCases/toolbarRules';

/**
 * 🧲 EL ORDEN DE LA BARRA DE HERRAMIENTAS, que pone el admin PARA TODOS (spec § «La barra se ordena arrastrando, y el
 * orden lo pone el admin para todos», 2026-09-12). Es UN ajuste de plataforma —ni de escena, ni de campaña, ni de
 * usuario—: leen todos, escribe sólo quien administra los ajustes (`admin.manage_settings`, por RLS).
 *
 * Es un puerto y no una consulta suelta porque la UI no hace E/S: el adaptador vive en `infra/` y la pantalla lo recibe
 * por `container.ts`, como todo lo demás.
 */
export interface ToolbarOrderPort {
  /** Lo guardado, ya saneado a la forma que entendemos; `null` si nadie ha ordenado nada todavía. */
  load(): Promise<ToolbarOrder | null>;
  /** Guarda el orden para todos. Lanza si no se puede (sin permiso, sin red): quien llama deshace y avisa. */
  save(order: ToolbarOrder): Promise<void>;
}
