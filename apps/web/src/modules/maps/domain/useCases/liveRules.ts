/**
 * EL ECO QUE LLEGA TARDE (2026-09-15, del mismo fallo que el parpadeo del pincel).
 *
 * `postgres_changes` no promete orden: dos cambios seguidos sobre la misma fila pueden llegar al revés, y en
 * producción —donde hay latencia de verdad— pasa. Aplicar el viejo encima del nuevo hace retroceder la fila:
 * con la pintura eso significa que el mapa vuelve a apuntar al PNG anterior y las últimas pinceladas se
 * esfuman de la pantalla (en la base siguen estando).
 *
 * Aquí no se mira quién lo mandó ni cuándo llegó: sólo si la fila que viene es MÁS VIEJA que la que ya hay.
 */

interface Versioned {
  updatedAt?: string;
  /** Las capas llevan número de versión propio desde la rebanada 7: es más fino que el reloj. */
  paintVersion?: number;
  maskVersion?: number;
}

const read = (row: unknown): Versioned => {
  const r = (row ?? {}) as Record<string, unknown>;
  return {
    ...(typeof r.updatedAt === 'string' ? { updatedAt: r.updatedAt } : {}),
    ...(typeof r.paintVersion === 'number' ? { paintVersion: r.paintVersion } : {}),
    ...(typeof r.maskVersion === 'number' ? { maskVersion: r.maskVersion } : {}),
  };
};
const time = (v: string | undefined): number | null => {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
};

/**
 * `true` si `next` es una versión MÁS VIEJA de la misma fila que `prev` y por tanto no debe aplicarse.
 * Ante la duda —falta el dato, empatan, o la fecha no se entiende— devuelve `false`: perder un cambio bueno
 * es peor que aplicar dos veces el mismo.
 */
export function isStaleRow(prev: unknown, next: unknown): boolean {
  const a = read(prev), b = read(next);
  const ta = time(a.updatedAt), tb = time(b.updatedAt);
  /* Cada pareja es una pista comparable: los números de versión y el reloj. Cualquier pista que diga «la que
     viene es MÁS NUEVA» gana — si se contradicen (la versión sube y la fecha baja), manda la versión, que es
     la que la base sube a mano en cada guardado. */
  const pistas: [number, number][] = [];
  if (a.paintVersion !== undefined && b.paintVersion !== undefined) pistas.push([a.paintVersion, b.paintVersion]);
  if (a.maskVersion !== undefined && b.maskVersion !== undefined) pistas.push([a.maskVersion, b.maskVersion]);
  if (ta !== null && tb !== null) pistas.push([ta, tb]);
  if (pistas.some(([antes, ahora]) => ahora > antes)) return false;
  return pistas.some(([antes, ahora]) => ahora < antes);
}

/**
 * LO QUE EL ECO NO TRAE, NO LO BORRA (2026-09-16, su fallo «*desaparecen habitaciones cuando quiero pintar*»).
 *
 * Postgres guarda FUERA DE LA FILA los valores grandes (TOAST) y, en un UPDATE que no los toca, **no los
 * repite en el aviso de replicación**: la fila llega entera menos esa columna. Medido contra su escena «test
 * dungeon2»: guardar una pincelada actualiza las 53 salas de golpe —todas apuntan al mismo PNG— y **9 de los
 * 53 ecos llegan SIN `points`**. Los 9 son de mano alzada, los más gordos (de 1.796 a 3.800 bytes); una
 * rectangular ocupa 200 y no cruza el umbral nunca. De ahí su «*sólo pasa con las de freehand*».
 *
 * El mapeo de infraestructura no puede distinguir «no vino» de «vacío» (`r.points ?? []`), así que la sala se
 * queda sin contorno y DESAPARECE de la pantalla: `ringPath` no dibuja nada y ni el suelo ni el agujero la
 * cuentan. En la base no se ha perdido nada — por eso recargar las devuelve, que es justo lo que él veía.
 *
 * La regla es la mínima que lo arregla y no puede tapar un cambio de verdad. **Un eco no puede dejarnos peor
 * de lo que estábamos**, y eso son dos cosas, las dos imposibles como cambio legítimo:
 *
 * 1. **No VACÍA una lista que ya teníamos.** Vaciarla no es un cambio de verdad en ninguna de estas filas —una
 *    sala sin contorno no existe: lo que se hace es borrar la fila, y eso llega como DELETE—. Una lista CON
 *    contenido pisa a la anterior como siempre.
 * 2. **No convierte en `undefined` algo que teníamos.** `undefined` NO es un valor: por REST siempre vienen
 *    todas las columnas pedidas (una vacía llega como `null`, que sí es un valor y sí manda). Un campo sólo
 *    sale `undefined` cuando su columna **no vino en el eco**, que es exactamente el caso que nos ocupa.
 *
 * El punto 2 es el que salva `maps_drawings.data` (2026-09-17, medido: un trazo de 400 puntos pierde el dibujo
 * en el eco; uno de 200 llega entero). Y ahí no es que se pierda un trazo: `mapDrawingRow` pasa `data` sin red,
 * `DrawingShape` lee `data.points`, y eso **revienta al pintar**. Como no hay ni un ErrorBoundary en la app,
 * React tira el árbol entero y **la mesa se queda en blanco** — la misma firma desesperante que las salas.
 *
 * Va por forma de dato y no por nombre de columna a propósito: cualquier columna que cruce el umbral mañana
 * queda cubierta sin que nadie tenga que acordarse de apuntarla aquí. **Lo que exige a cambio es que el
 * mapeador NO invente un valor por defecto** para una columna que pueda faltar — ver `mapScenePropRow`.
 *
 * Devuelve `next` TAL CUAL cuando no hay nada que conservar: copiar siempre haría que React viese una fila
 * nueva en cada eco y repintase el mapa entero de balde.
 */
export function keepUnsent<T>(prev: unknown, next: T): T {
  if (!prev || !next || typeof prev !== 'object' || typeof next !== 'object') return next;
  const antes = prev as Record<string, unknown>;
  const ahora = next as Record<string, unknown>;
  /* Se recorren las claves de las DOS: una columna que no vino ni siquiera aparece en la fila mapeada, así que
     mirando sólo las de `ahora` se escaparía justo el caso que estamos cazando. */
  let out: Record<string, unknown> | null = null;
  for (const k of new Set([...Object.keys(ahora), ...Object.keys(antes)])) {
    const viene = ahora[k], habia = antes[k];
    const listaVaciada = Array.isArray(viene) && viene.length === 0 && Array.isArray(habia) && habia.length > 0;
    const noVino = viene === undefined && habia !== undefined;
    if (listaVaciada || noVino) {
      out ??= { ...ahora };
      out[k] = habia;
    }
  }
  return (out ?? ahora) as T;
}
