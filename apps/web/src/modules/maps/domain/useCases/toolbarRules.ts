/**
 * 🧲 EL ORDEN DE LA BARRA DE HERRAMIENTAS, que pone el admin PARA TODOS (specs/modules/maps/SPEC.md § «La barra
 * se ordena arrastrando, y el orden lo pone el admin para todos», confirmado por el dueño el 2026-09-12).
 *
 * Reglas puras: ni React, ni E/S. Aquí vive el ORDEN DE SERIE —el que él fijó el 31-ago— y cómo se le aplica lo
 * guardado sin que nada pueda romperse: un botón desconocido se ignora, uno que falte cae en su sitio de serie, y los
 * bloques no se mezclan porque cada bloque se ordena por su cuenta.
 */

/** Los tres bloques de la barra. Son lo que ve cada rol: un jugador no tiene `dm`. NO se mezclan. */
export type ToolbarBlock = 'play' | 'draw' | 'dm';
export const TOOLBAR_BLOCKS: readonly ToolbarBlock[] = ['play', 'draw', 'dm'];

/**
 * Una RAYA dentro del bloque del director (las que separan construir · niebla · juego). Es un ítem más de la lista
 * para que se quede donde está mientras los botones se mueven a su alrededor; no se arrastra ni se guarda como botón.
 */
export const TOOLBAR_SEP = 'sep';

/** El orden de serie, bloque a bloque. Los ids son de BOTONES (herramientas Y botones de panel), no de herramientas. */
export const DEFAULT_TOOLBAR_ORDER: Readonly<Record<ToolbarBlock, readonly string[]>> = {
  play: ['dice', 'select', 'measure', 'pin'],
  draw: ['draw'],
  // Luz · Builder · Fondo del mapa · Pincel ‖ Revelar · Ocultar ‖ Encuentro · Colocar PJ — suyo, 2026-08-31.
  dm: ['light', 'wall', 'background', 'mask', TOOLBAR_SEP, 'reveal', 'hide', TOOLBAR_SEP, 'encounter', 'placePc'],
};

/** Lo que se guarda: cada bloque con sus ids en orden. Los bloques que falten salen de serie. */
export type ToolbarOrder = Partial<Record<ToolbarBlock, readonly string[]>>;

/** La clave del ajuste de plataforma donde vive el orden (`app_settings.key`). */
export const TOOLBAR_ORDER_KEY = 'maps.toolbar_order';

const isSep = (id: string): boolean => id === TOOLBAR_SEP;

/**
 * El orden REAL de un bloque: lo guardado, saneado contra el de serie.
 * - Un id que no esté en el de serie (un botón que ya no existe, o basura) se ignora.
 * - Un id de serie que falte en lo guardado (un botón NUEVO, o una raya) se mete detrás del último vecino de serie que
 *   sí esté; si ninguno de sus vecinos anteriores está, va al principio. Así «Piezas» (rebanada 6) aparecerá en su
 *   sitio de serie sin deshacer el orden que él haya puesto.
 * - Las rayas se tratan igual que los botones: si lo guardado las trae, mandan; si no, caen en su sitio de serie.
 * Sin nada guardado devuelve el de serie tal cual.
 */
export function resolvedBlockOrder(block: ToolbarBlock, saved?: readonly string[]): string[] {
  const base = DEFAULT_TOOLBAR_ORDER[block];
  if (!saved) return [...base];
  // Las rayas pueden repetirse: se cuentan, no se buscan por nombre.
  const sepsBase = base.filter(isSep).length;
  const kept: string[] = [];
  let seps = 0;
  for (const id of saved) {
    if (typeof id !== 'string') continue;
    if (isSep(id)) { if (seps < sepsBase) { kept.push(id); seps++; } continue; }
    if (!base.includes(id) || kept.includes(id)) continue;
    kept.push(id);
  }
  // Lo que falta, en su sitio de serie.
  for (let i = 0; i < base.length; i++) {
    const id = base[i]!;
    if (isSep(id)) { if (seps >= sepsBase) continue; seps++; } else if (kept.includes(id)) continue;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const prev = base[j]!;
      const k = isSep(prev) ? -1 : kept.indexOf(prev);
      if (k >= 0) { at = k + 1; break; }
    }
    kept.splice(at, 0, id);
  }
  return kept;
}

/** Los tres bloques resueltos de una vez. */
export function resolvedToolbarOrder(saved?: ToolbarOrder | null): Record<ToolbarBlock, string[]> {
  return {
    play: resolvedBlockOrder('play', saved?.play),
    draw: resolvedBlockOrder('draw', saved?.draw),
    dm: resolvedBlockOrder('dm', saved?.dm),
  };
}

/**
 * Mover un botón DENTRO de su bloque: `id` pasa a estar justo antes de `before` (o al final con `null`). Las rayas no
 * se mueven ni sirven de destino. Si no hay nada que cambiar devuelve LA MISMA lista (por identidad), para que quien
 * llama sepa que no hay que guardar nada.
 */
export function moveToolbarItem(order: readonly string[], id: string, before: string | null): readonly string[] {
  if (isSep(id) || (before !== null && isSep(before)) || id === before) return order;
  const from = order.indexOf(id);
  if (from < 0 || (before !== null && !order.includes(before))) return order;
  const without = order.filter(x => x !== id);
  const at = before === null ? without.length : without.indexOf(before);
  if (at === from) return order;
  const next = [...without];
  next.splice(at, 0, id);
  return next;
}

/**
 * Lo leído de la base, saneado a la forma que entendemos: un objeto con listas de textos por bloque. Cualquier otra
 * cosa (null, un número, una lista suelta) es «no hay nada guardado». La FORMA la valida quien lee, no la base.
 */
export function parseToolbarOrder(value: unknown): ToolbarOrder | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out: ToolbarOrder = {};
  for (const block of TOOLBAR_BLOCKS) {
    const list = (value as Record<string, unknown>)[block];
    if (Array.isArray(list)) out[block] = list.filter((x): x is string => typeof x === 'string');
  }
  return out;
}
