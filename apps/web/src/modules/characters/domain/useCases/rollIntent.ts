import type { ActionDef, GameSystem, RollRequest, SharedResourceDef, SheetData } from '@rolvium/core';

// ─── Lo que hay detrás del desplegable de tirar ──────────────────────────────
// `rolvium.pen` «Mesa/Tiradas · rediseño», columnas 1 (`Popover/Tirar`) y 2 (`Popover/Disparar`).
// Aquí vive la cuenta; la pantalla sólo la pinta. Nada de esto sabe de Plenilunio: todo sale del
// `GameSystem` que trae la campaña (su motor, sus catálogos y sus referencias al manual).

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Lo que se está a punto de tirar: una característica de la ficha, o la acción de una fila (un arma). */
export type RollIntent =
  | { kind: 'stat'; statId: string }
  | { kind: 'action'; action: ActionDef; itemId: string };

/**
 * La clave del manual que va en la cabecera del desplegable: «cómo se tira». El `.pen` pone «Manual ·
 * p.82», que es la página de `roll` en Plenilunio. Si un sistema no declara esa referencia, la cabecera
 * se queda sin página en vez de inventarse una.
 */
const ROLL_REF = 'roll';

/**
 * El alcance que declara la fila que se está usando, o `null` si no es una fila con alcance.
 *
 * Se lee del catálogo por `action.appliesTo` —igual que hace `<Sheet>` para pintar las columnas
 * derivadas— así que no hay ningún nombre de campo escrito a mano aquí. Es lo que distingue «la acción
 * de un arma», que abre el desplegable, de las demás acciones de la ficha, que siguen yendo directas.
 */
export function rangeOfIntent(system: GameSystem, intent: RollIntent): string | null {
  if (intent.kind !== 'action') return null;
  const item = (system.catalogs?.[intent.action.appliesTo] ?? []).find(c => c.id === intent.itemId);
  const range = rec(item?.data)['range'];
  return typeof range === 'string' ? range : null;
}

/**
 * Si este botón abre el desplegable o tira directo.
 *
 * Abren: TIRAR de una característica, y la acción de un arma (que se reconoce porque su fila declara
 * alcance). NO abren —y siguen exactamente como estaban— activar un don y recargar: el `.pen` no las
 * diseña, y meterlas ahí sería inventar. `reload` además no tira nada, sólo gasta.
 */
export const opensPopover = (system: GameSystem, intent: RollIntent): boolean =>
  intent.kind === 'stat' || (!!intent.action.toRoll && rangeOfIntent(system, intent) !== null);

/** La petición que saldría con estas opciones, sin gastar nada todavía. `null` = la acción no tira. */
export function previewRequest(system: GameSystem, data: SheetData, intent: RollIntent, options: Record<string, unknown>): RollRequest | null {
  if (intent.kind === 'stat') return system.engine.poolFor(data, { stat: intent.statId, options });
  return intent.action.toRoll ? intent.action.toRoll(data, intent.itemId, options) : null;
}

/** Dados de la petición con estas etiquetas (`own` = los de la ficha, `destiny` = los de la reserva). */
export const diceOf = (req: RollRequest | null, tags: readonly string[]): number =>
  (req?.groups ?? []).filter(g => tags.includes(g.tag ?? '')).reduce((n, g) => n + g.count, 0);

/** La característica sobre la que se tira, venga de un TIRAR o de la acción de un arma. */
export function statIdOf(system: GameSystem, data: SheetData, intent: RollIntent): string | null {
  if (intent.kind === 'stat') return intent.statId;
  const req = previewRequest(system, data, intent, {});
  const stat = rec(req?.options)['stat'];
  return typeof stat === 'string' ? stat : null;
}

export interface DiceOrigin {
  /** Clave i18n del sistema con el nombre de la característica. */
  statLabel: string;
  statValue: number;
  /** Dados que quita el estado de salud (0 = no quita ninguno). */
  penalty: number;
  /** Clave i18n del sistema con el nivel de salud que penaliza; vacía si no penaliza. */
  healthLabel: string;
}

/**
 * De dónde salen los dados: «tu Astucia 4, menos 1 por herido» del `.pen`.
 *
 * La penalización se lee del catálogo `healthLevels` (`data.penalty`), no restando totales: un arma
 * cuerpo a cuerpo suma su bonificación al mismo montón, y restar habría contado esa bonificación como
 * si fuera una herida.
 */
export function diceOrigin(system: GameSystem, data: SheetData, statId: string): DiceOrigin | null {
  const field = system.sheetSchema.sections.flatMap(s => s.fields).find(f => f.id === statId && f.type === 'stat');
  if (!field) return null;
  const health = str(data['health']);
  const level = (system.catalogs?.['healthLevels'] ?? []).find(h => h.id === health);
  const penalty = num(rec(level?.data)['penalty']);
  return {
    statLabel: field.label,
    statValue: num(rec(data[statId])['value']),
    penalty,
    healthLabel: penalty > 0 && level ? level.label : '',
  };
}

export interface RangeChoice {
  id: string;
  /** Clave i18n del sistema («Corto», «Medio»…). */
  label: string;
  difficulty: number;
  /** Más lejos de lo que llega el arma: se enseña apagado, como en el `.pen`. */
  beyond: boolean;
}

/**
 * Los alcances que ofrece un arma (p.96). El orden del catálogo `ranges` es el que dice cuáles quedan
 * fuera: un arma llega hasta el suyo y no más lejos.
 */
export function rangeChoices(system: GameSystem, weaponRange: string | null): RangeChoice[] {
  const ranges = system.catalogs?.['ranges'] ?? [];
  const reach = ranges.findIndex(r => r.id === weaponRange);
  if (reach < 0) return [];   // cuerpo a cuerpo (o un arma sin alcance publicado): no hay nada que elegir
  return ranges.map((r, i) => ({ id: r.id, label: r.label, difficulty: num(rec(r.data)['difficulty']), beyond: i > reach }));
}

export interface PoolChoice { n: number; disabled: boolean }

/**
 * Las fichas `0 1 2 3 4 5` de la reserva compartida. Se puede elegir hasta el tope por tirada, y sólo
 * hasta donde llegan los dados que ya tienes en la mano MÁS los que quedan en la mesa: pedir más de los
 * que hay no es una elección, es un botón que no hace nada.
 */
export const poolChoices = (def: SharedResourceDef, left: number, hand: number): PoolChoice[] =>
  Array.from({ length: def.perTakeMax + 1 }, (_, n) => ({ n, disabled: n > hand + Math.max(0, left) }));

/** La referencia del manual de la cabecera: «cómo se tira», o el alcance cuando es un disparo. */
export function headRef(system: GameSystem, intent: RollIntent, ranges: RangeChoice[]): string | null {
  const key = intent.kind === 'stat' || ranges.length === 0
    ? ROLL_REF
    : (system.catalogs?.['ranges'] ?? [])[0]?.ref ?? ROLL_REF;
  return system.references[key] ? key : null;
}
