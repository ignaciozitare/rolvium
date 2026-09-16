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
