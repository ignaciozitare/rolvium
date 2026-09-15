import type { CompressionLevels } from './compressionLevels';

/**
 * El nivel de compresión de imágenes por tipo, que pone un admin en Ajustes PARA TODOS (spec:
 * `specs/core/images/SPEC.md`). Es un ajuste de plataforma —ni de escena, ni de campaña, ni de usuario—: leen
 * todos, escribe sólo quien administra los ajustes (`admin.manage_settings`, por RLS).
 *
 * Es un puerto y no una consulta suelta porque la UI no hace E/S: el adaptador vive en `infra`-equivalente
 * (aquí, junto al puerto, por ser un ajuste compartido entre módulos) y la pantalla lo recibe por `container.ts`.
 */
export interface CompressionLevelsPort {
  /** Lo guardado, ya saneado a la forma que entendemos; `null` si nadie lo ha tocado todavía. */
  load(): Promise<CompressionLevels | null>;
  /** Guarda los tres niveles para todos. Lanza si no se puede (sin permiso, sin red): quien llama deshace y avisa. */
  save(levels: CompressionLevels): Promise<void>;
}
