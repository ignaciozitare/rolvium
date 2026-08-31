import type { NewSceneProp, Prop, PropCategory, Scene, SceneProp } from '../entities/Scene';

/**
 * Reglas puras de la galería de piezas (specs/modules/maps/SPEC.md § Rebanada 6). Sin React, sin Supabase:
 * sólo números y decisiones. Lo que pinta vive en `ui/`, lo que guarda en `infra/`.
 */

/** Las seis que trae la app, en el orden en que se enseñan. Cerradas por elección del dueño (2026-08-31). */
export const PROP_CATEGORIES: readonly PropCategory[] = ['furniture', 'vegetation', 'floors', 'doors', 'markers', 'misc'] as const;

/** Igual que el alcance de una luz: se acota para que un dedo torpe no plante un roble de un kilómetro. */
export const MIN_SCALE = 0.05;
export const MAX_SCALE = 50;
export const clampScale = (v: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, v));

/**
 * La huella de una pieza en px de escena. Un solo número de escala para los dos lados: por eso la pieza no
 * se puede deformar por accidente (§ 6.4, «mantiene la proporción»).
 */
export const footprintOf = (p: Pick<Prop, 'naturalWidth' | 'naturalHeight'>, scale: number): { width: number; height: number } => {
  const s = clampScale(scale);
  return { width: p.naturalWidth * s, height: p.naturalHeight * s };
};

/**
 * La escala que representa una huella: el camino de vuelta, para poder RECORDAR lo que el director acaba de
 * hacer con el ratón. Se mide por el ancho porque la proporción está garantizada por `footprintOf`.
 */
export const scaleOfWidth = (p: Pick<Prop, 'naturalWidth'>, width: number): number =>
  clampScale(width / (p.naturalWidth || 1));

/**
 * ¿Hay que reescribir la escala recordada de la biblioteca? Sólo cuando de verdad ha cambiado: si no, cada
 * arrastre que acabe donde empezó escribiría en la biblioteca sin motivo.
 */
export const scaleChanged = (a: number, b: number): boolean => Math.abs(a - b) > 1e-4;

/**
 * Plantar una pieza: la copia que se guarda en la escena. La foto y el nombre se COPIAN —es lo que hace que
 * sobreviva a que borren la pieza de la biblioteca— y el estorbo nace con lo que diga la biblioteca, con la
 * forma cubriendo su huella entera. El director la afina después si quiere.
 */
export function plantProp(
  prop: Prop,
  at: { x: number; y: number },
  scene: Pick<Scene, 'id' | 'campaignId'>,
  layerId: string | null = null,
  scale: number = prop.defaultScale,
): NewSceneProp {
  const { width, height } = footprintOf(prop, scale);
  return {
    sceneId: scene.id, campaignId: scene.campaignId, layerId, propId: prop.id,
    imageUrl: prop.imageUrl, name: prop.name,
    x: at.x, y: at.y, width, height, rotation: 0,
    blocksSight: prop.defaultBlocksSight, blocksMove: prop.defaultBlocksMove,
    blockShape: prop.defaultBlockShape,
    // La forma que estorba nace cubriendo la pieza entera; en círculo manda el lado mayor, que es lo que
    // rodea al dibujo en vez de dejarle las esquinas fuera.
    blockW: prop.defaultBlockShape === 'circle' ? Math.max(width, height) : width,
    blockH: prop.defaultBlockShape === 'circle' ? Math.max(width, height) : height,
    blockDx: 0, blockDy: 0,
  };
}

/**
 * Copiar y pegar una pieza ya plantada, CON su giro y su tamaño (§ 6.3). No es plantar otra vez: plantar
 * volvería a la escala de la biblioteca y perdería lo que se acaba de ajustar a mano.
 */
export const duplicateProp = (p: SceneProp, at: { x: number; y: number }): NewSceneProp => {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = p;
  return { ...rest, x: at.x, y: at.y };
};

/** Coincide por nombre, sin distinguir mayúsculas ni acentos: se busca «arbol» y sale «Árbol». */
const fold = (v: string): string => v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
export const matchesQuery = (p: Pick<Prop, 'name'>, query: string): boolean =>
  fold(query) === '' || fold(p.name).includes(fold(query));

/** Lo que enseña la galería: la categoría elegida (o todas) y el buscador, en un solo paso. */
export const filterProps = (props: readonly Prop[], category: PropCategory | null, query: string): Prop[] =>
  props.filter(p => (category === null || p.category === category) && matchesQuery(p, query));

/** Las de la app y las tuyas se enseñan juntas, pero se distinguen: es lo que prepara el catálogo de serie. */
export const isAppProp = (p: Pick<Prop, 'campaignId'>): boolean => p.campaignId === null;

/**
 * Dónde vive la foto de una pieza dentro del bucket de fondos, que ya existe. Mismo precedente que las
 * máscaras del pincel de transparencia: un bucket nuevo pediría configurar políticas otra vez para nada.
 */
export const propPath = (campaignId: string, id: string): string => `${campaignId}/props/${id}.webp`;
