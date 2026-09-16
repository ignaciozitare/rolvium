import { silhouetteRing } from '@rolvium/core';
import type { Prop, PropPatch, Silhouette } from '../entities/Scene';

/**
 * LA PASADA DE UNA VEZ (specs/modules/maps/SPEC.md § 6.9).
 *
 * Sus 133 objetos se subieron antes de que existiera la silueta, así que nacieron con el rectángulo. Le
 * ofrecimos sacárselas una a una según se fueran usando o todas de golpe, y contestó el 2026-09-16: «*hazlas
 * de a una vez*».
 *
 * Esto es esa pasada, SIN React y SIN Supabase: recibe la lista, dos funciones para leer y para guardar, y va
 * avisando de por dónde va. Así la pantalla sólo tiene que enseñar el avance, y la pasada se puede probar
 * entera sin navegador.
 *
 * ── LO QUE NO PISA ──
 * Una pieza a la que él le puso ÓVALO a mano NO se toca: la forma se cambia sólo cuando sigue siendo el
 * rectángulo de fábrica. La silueta sí se guarda igual, para que el día que la elija ya esté ahí.
 */

/** Opacidad en crudo. Escrito por forma y no por tipo importado: el dominio no depende de quien la lee. */
export interface AlphaData { data: ArrayLike<number>; width: number; height: number }

export interface SilhouettePassDeps {
  /** Traer la opacidad de una foto ya subida. `null` = no se pudo (red, CORS): esa pieza se salta. */
  alphaOf: (url: string) => Promise<AlphaData | null>;
  /** Guardar la silueta en la BIBLIOTECA. */
  saveProp: (id: string, patch: PropPatch) => Promise<unknown>;
  /**
   * Y llevarla a lo YA PLANTADO en los mapas. Sin esto la pasada no se vería: lo que él tiene delante en sus
   * escenas son copias, y seguirían tapando con su rectángulo. Sólo alcanza a las copias que siguen con la
   * forma de fábrica, y sólo a las filas que sus permisos le dejen tocar.
   */
  applyToPlanted: (propId: string, silhouette: Silhouette) => Promise<unknown>;
}

export interface SilhouettePassProgress {
  /** Cuántas van miradas, de `total`. */
  done: number;
  total: number;
  /** El nombre de la que se está mirando, para poder decirlo en pantalla. */
  name: string;
}

export interface SilhouettePassResult {
  /** A cuántas se les sacó la silueta. */
  hechas: number;
  /** Cuántas se saltaron por no poder leer su foto. Se puede volver a intentar: la pasada es repetible. */
  fallidas: number;
  /** Cuántas ya la tenían. */
  yaEstaban: number;
}

/** ¿Le falta la silueta? Lo que decide si entra en la pasada — y lo que la hace REPETIBLE sin gastar de más. */
export const needsSilhouette = (p: Pick<Prop, 'defaultSilhouette'>): boolean => !p.defaultSilhouette;

/**
 * Qué se le cambia a una pieza cuando su silueta sale bien. La forma se toca SÓLO si sigue siendo la de
 * fábrica: un óvalo puesto a mano es una decisión suya y aquí no se revoca.
 */
export function silhouettePatch(p: Pick<Prop, 'defaultBlockShape'>, silhouette: Silhouette): PropPatch {
  return p.defaultBlockShape === 'rect'
    ? { defaultSilhouette: silhouette, defaultBlockShape: 'silhouette' }
    : { defaultSilhouette: silhouette };
}

/**
 * La pasada entera. Va de una en una a propósito: ciento treinta y tres descargas a la vez se comen la
 * memoria y la red, y esto se lanza a mano una vez en la vida — que tarde medio minuto no es un problema.
 *
 * Una pieza que falla no para nada: se cuenta y se sigue. Volver a lanzarla sólo mira las que quedaron.
 */
export async function runSilhouettePass(
  props: readonly Prop[],
  deps: SilhouettePassDeps,
  onProgress?: (p: SilhouettePassProgress) => void,
): Promise<SilhouettePassResult> {
  const out: SilhouettePassResult = { hechas: 0, fallidas: 0, yaEstaban: 0 };
  let done = 0;
  for (const prop of props) {
    onProgress?.({ done, total: props.length, name: prop.name });
    done += 1;
    if (!needsSilhouette(prop)) { out.yaEstaban += 1; continue; }
    const alpha = await deps.alphaOf(prop.imageUrl);
    const ring = alpha ? silhouetteRing(alpha.data, alpha.width, alpha.height) : [];
    if (ring.length < 3) { out.fallidas += 1; continue; }
    const patch = silhouettePatch(prop, ring);
    await deps.saveProp(prop.id, patch);
    /*
     * A lo plantado SÓLO si la pieza pasa de verdad a estorbar por su silueta. Con un ÓVALO puesto a mano
     * arriba, bajar la silueta a las copias contradiría lo que él eligió — y las copias no tienen pantalla
     * donde verlo ni forma de volver atrás. Lo cazó la review.
     */
    if (patch.defaultBlockShape === 'silhouette') await deps.applyToPlanted(prop.id, ring);
    out.hechas += 1;
  }
  onProgress?.({ done, total: props.length, name: '' });
  return out;
}
