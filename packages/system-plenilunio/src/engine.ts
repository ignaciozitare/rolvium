// ─── Rules engine · Malefic Time: Plenilunio ─────────────────────────────────
// Pure functions ported from the validated prototype (clasificar, aplicarArmadura,
// resolverAccion, describirGrado, damage/health, progression) plus the
// `Engine` object required by the GameSystem port. No I/O, no randomness: the
// platform generates dice on the server and calls `resolve`.
import type { ActionDef, DiceGroup, Engine, ExtraDiceCap, RollRequest, RollResult, RolledDice, SharedResourceDef, SheetData, SheetPatch, TurnParticipant } from '@rolvium/core';
import {
  GIFT_IDS, GIFT_MAX_LEVEL, HEALTH_LEVELS, MAX_GIFT_TRADES, RANGE_DIFFICULTY, RECOVERY, armourById, capabilityLevel, hasCapability,
  isMelee, isStatId, sizeMod, weaponById,
  type CapabilityId, type CreatureCapability, type HealthId, type SizeId, type StatId, type WeaponData,
} from './catalogs';
import { capabilitiesOf, giftsOf, healthOf, num, statOf, str, weaponsOf, type GiftRow, type WeaponRow } from './schema';
import { explain } from './explain';

export const SYSTEM_ID = 'plenilunio';

// ─── Constants ───────────────────────────────────────────────────────────────
/** Shared Destiny pool (manual p.88–89): 10 dice by default, up to 5 per roll, players take, DM resets. */
export const DESTINY_POOL = { max: 10, initial: 10, perTakeMax: 5 } as const;
export const DESTINY_MAX = 10;
/** Highest value reachable with XP (manual p.91 only prices up to 6; creation presets may go higher, p.21). */
export const STAT_MAX = 6;
/** XP costs (manual p.91). */
export const XP_COSTS = { statTo5: 20, statTo6: 40, newSpecialty: 10, changeSpecialty: 3, gift: 10 } as const;
export const GIFT_ACTIVATION_COST = 1;

// ─── Derived values (manual p.25, p.89, p.98–101) ────────────────────────────
export interface Derived {
  endurance: number; resistanceMax: number; recoveryMax: number; fortuneMax: number; dicePenalty: number; healthIndex: number;
  protection: number; armourPenalty: number; giftPoints: number;
}
export const healthIndexOf = (h: HealthId) => HEALTH_LEVELS.findIndex(l => l.id === h);
export const healthPenaltyOf = (h: HealthId) => HEALTH_LEVELS[healthIndexOf(h)]?.penalty ?? 0;

/**
 * Endurance = Fortitude + Will ± size (min 1); Fortune max = Destiny (p.90, hard cap: «nunca pueden llegar a ser
 * mayores que la puntuación de Destino»).
 *
 * **Son DOS números y no uno** (RULES.md §6.3, verificado en el PDF el 2026-08-21):
 *  - `resistanceMax` = **Aguante × 3, SIEMPRE**. Es el tamaño de la pista, y lo fija la creación del personaje:
 *    p.25, literal, «Son iguales al triple del Aguante… deja los cuadrados en blanco correspondientes a tu
 *    Resistencia para poder tacharlos durante el juego». El estado de salud no borra casillas ya dibujadas.
 *  - `recoveryMax` = Aguante × el factor del estado (×3 sano/magullado, ×2 herido, ×1 malherido). Es hasta dónde
 *    te sube DESCANSAR, y sale sólo bajo el epígrafe «RECUPERACIÓN» de la p.101, cuyo sujeto es *se recupera*.
 *
 * El 2026-08-19 se fusionaron en uno leyendo la frase de la p.101 («sus puntos de Resistencia máximos pasan a ser
 * el doble…») como si definiera la pista, y Karen, herida, pasó a enseñar 12 casillas en vez de 18. Revertido por
 * orden del dueño el 2026-08-21: «el manual pdf manda». La lectura completa, con sus tres razones, en RULES.md §6.3.
 */
export function derived(sheet: SheetData): Derived {
  const endurance = Math.max(1, statOf(sheet, 'fortitude').value + statOf(sheet, 'will').value + sizeMod(sheet.size));
  const health = healthOf(sheet);
  const armour = armourById(str(sheet.armour, 'none'));
  /**
   * Las capacidades de la criatura, cuando la ficha es un bloque del bestiario (p.107–108). En una ficha de
   * personaje la lista viene vacía y nada de esto cambia:
   *  - **Inmune al dolor**: «sus niveles de salud sólo sirven para saber cuándo muere»; no resta dados (p.99).
   *  - **Piel gruesa N**: «armadura natural cuya protección es igual a la puntuación». Se SUMA a la armadura
   *    llevada en vez de sustituirla, porque son dos cosas distintas y ninguna criatura del libro lleva las dos.
   */
  const caps = capabilitiesOf(sheet);
  const destiny = num(sheet.destiny, 3);
  const spent = giftsOf(sheet).reduce((s, g) => s + num(g.level), 0);
  return {
    endurance,
    resistanceMax: endurance * 3,
    recoveryMax: endurance * RECOVERY[health].restFactor,
    fortuneMax: destiny,
    dicePenalty: hasCapability(caps, 'painImmune') ? 0 : healthPenaltyOf(health),
    healthIndex: healthIndexOf(health),
    protection: (armour?.data.protection ?? 0) + capabilityLevel(caps, 'thickHide'),
    armourPenalty: armour?.data.penalty ?? 0,
    // El tope del canje se aplica aquí TAMBIÉN, no sólo en `budgetOf`: si no, una ficha guardada con
    // más de MAX_GIFT_TRADES canjes enseñaría puntos de don inflados para siempre (hallazgo del QA).
    giftPoints: Math.max(0, destiny + Math.min(MAX_GIFT_TRADES, Math.max(0, num(sheet.giftTrade))) * 2 - spent),
  };
}

// ─── Dice classification (manual p.82) ───────────────────────────────────────
export interface Tally { fumbles: number; misses: number; successes: number; triumphs: number }
/** 1 fumble · 2–3 miss · 4–5 success · 6 triumph. */
export function classify(dice: readonly number[]): Tally {
  const t: Tally = { fumbles: 0, misses: 0, successes: 0, triumphs: 0 };
  for (const d of dice) {
    if (d === 1) t.fumbles++;
    else if (d <= 3) t.misses++;
    else if (d <= 5) t.successes++;
    else t.triumphs++;
  }
  return t;
}
/** Armour (manual p.98): only if the roll shows ≥1 fumble, up to `penalty` triumphs become plain successes. */
export function applyArmour(t: Tally, penalty: number): { tally: Tally; converted: number } {
  if (penalty > 0 && t.fumbles > 0) {
    const converted = Math.min(penalty, t.triumphs);
    return { tally: { ...t, triumphs: t.triumphs - converted, successes: t.successes + converted }, converted };
  }
  return { tally: t, converted: 0 };
}

export interface ResolveInput {
  own: readonly number[]; destiny?: readonly number[]; opposition?: readonly number[];
  specialty?: boolean; armourPenalty?: number;
  /** In conflicts the rival may apply a specialty too (p.85): their triumphs count double. Never for difficulty dice (p.84). */
  oppositionSpecialty?: boolean;
  /**
   * Éxitos automáticos que no salen de ningún dado: las capacidades de criatura que los conceden
   * (Amparo de la noche, Aura, Aura sombría — p.107–108). Se suman a los aciertos propios.
   */
  autoSuccesses?: number;
}
export interface Outcome {
  own: Tally; destiny: Tally; opposition: Tally;
  ownHits: number; destinyHits: number; oppositionHits: number;
  /** ownHits + destinyHits − oppositionHits: >0 success degree, <0 failure degree, 0 ambiguous. */
  difference: number;
  setback: boolean; destinyUp: boolean; armourConverted: number; specialty: boolean; oppositionSpecialty: boolean;
  /** Los éxitos automáticos que entraron (p.107–108). 0 en cualquier tirada de personaje. */
  autoSuccesses: number;
}
/**
 * Full resolution (manual p.82–89): specialty doubles own triumphs (p.83); Destiny dice always double and a
 * triumph among them raises Destiny (p.89); setback = no raw hit at all and ≥1 fumble (p.86).
 *
 * Los **éxitos automáticos** de las capacidades (p.107–108) se suman a los aciertos propios y TAMBIÉN cuentan
 * como acierto para el revés — ⚠ interpretación nuestra, el libro no lo dice (RULES.md §7.b.1): un revés es
 * «ni un solo acierto y al menos un fracaso» (p.86), y una criatura con Amparo de la noche 5 sí acierta, así
 * que no puede sufrir un revés al mismo tiempo. Si se lee al revés, se cambia en esta línea y en ninguna más.
 */
export function resolveAction(input: ResolveInput): Outcome {
  const specialty = !!input.specialty;
  const oppositionSpecialty = !!input.oppositionSpecialty;
  const autoSuccesses = Math.max(0, Math.floor(num(input.autoSuccesses)));
  const { tally: own, converted } = applyArmour(classify(input.own), input.armourPenalty ?? 0);
  const destiny = classify(input.destiny ?? []);
  const opposition = classify(input.opposition ?? []);
  const ownHits = own.successes + own.triumphs * (specialty ? 2 : 1) + autoSuccesses;
  const destinyHits = destiny.successes + destiny.triumphs * 2;
  const oppositionHits = opposition.successes + opposition.triumphs * (oppositionSpecialty ? 2 : 1);
  const raw = own.successes + own.triumphs + destiny.successes + destiny.triumphs + autoSuccesses;
  return {
    own, destiny, opposition, ownHits, destinyHits, oppositionHits,
    difference: ownHits + destinyHits - oppositionHits,
    setback: raw === 0 && own.fumbles + destiny.fumbles > 0,
    destinyUp: destiny.triumphs > 0,
    armourConverted: converted, specialty, oppositionSpecialty, autoSuccesses,
  };
}

// ─── Capacidades de criatura en la tirada (manual p.107–108) ─────────────────
/** Una capacidad que PODRÍA dar éxitos automáticos en esta tirada, con cuántos daría. */
export interface AutoSuccessOption { id: CapabilityId; level: number }
/**
 * Las capacidades que podrían aplicarse a esta tirada, según la característica y si es de noche.
 *
 * ⚠ **No se aplican solas**, igual que las especialidades (p.83): el director ve las que encajan y marca la
 * que corresponde. El «Aura» pide además que la tirada sea *para intimidar o liderar*, y el «Aura sombría»
 * que sea *para esconderse, moverse en silencio o pasar desapercibida* — eso el motor no lo puede saber.
 */
export function autoSuccessOptions(caps: readonly CreatureCapability[] | undefined, stat: StatId, night = false): AutoSuccessOption[] {
  const opts: AutoSuccessOption[] = [];
  const add = (id: CapabilityId) => { const level = capabilityLevel(caps, id); if (level > 0) opts.push({ id, level }); };
  if (stat === 'combat' && night) add('nightShelter');       // de noche, a su total de Combate cada turno
  if (stat === 'presence' && !night) add('aura');            // sólo de día, para intimidar o liderar
  if (stat === 'subtlety' && night) add('darkAura');         // sólo de noche, para esconderse o pasar desapercibida
  return opts;
}

/**
 * Incorpóreo (p.108): «usa la Voluntad de la criatura en lugar de su Fortaleza o su Combate para cualquier
 * pugna entre seres inmateriales». Sólo cambia esas dos; el resto de características se tiran como siempre.
 */
export const incorporealStat = (stat: StatId): StatId => (stat === 'fortitude' || stat === 'combat' ? 'will' : stat);
/** Incorpóreo (p.108): «no se la puede atacar físicamente». */
export const canBeAttackedPhysically = (caps: readonly CreatureCapability[] | undefined): boolean => !hasCapability(caps, 'incorporeal');

/** Degree of success/failure (manual p.85) as an i18n key of this package. */
export function degreeKey(difference: number): string {
  if (difference === 0) return 'roll.degree.ambiguous';
  if (difference > 0) return difference <= 3 ? `roll.degree.success.${difference}` : 'roll.degree.success.absolute';
  return -difference <= 3 ? `roll.degree.failure.${-difference}` : 'roll.degree.failure.absolute';
}

// ─── Pools (manual p.82–84, p.88, p.97) ──────────────────────────────────────
/** Shape of `RollRequest.options` produced by this system. */
export interface PlenilunioRollOptions {
  stat: StatId;
  specialty?: boolean;
  /** Armour penalty applied on this roll (0 = ignored). */
  armourPenalty?: number;
  /** Rival applies a specialty (conflicts only, p.85). */
  oppositionSpecialty?: boolean;
  extraDice?: number;
  /** Destiny-pool dice taken (≤ perTakeMax, none at Destiny 10). */
  destinyDice?: number;
  /** Opposition dice (challenge difficulty 1/2/3/5/6 or an opponent's pool). */
  difficulty?: number;
  /**
   * Los dados de enfrente son un RIVAL, no una dificultad (conflicto, p.93–95). No cambia ni un dado ni
   * una cuenta —`resolve` clasifica el grupo `opposition` igual— y existe sólo para que el desglose no
   * llame «reto a dificultad N» a lo que el manual llama conflicto.
   */
  conflict?: boolean;
  /** Set by actions. `range` picks the ranged difficulty (p.96) when no explicit difficulty is given. */
  weaponId?: string; ranged?: boolean; range?: keyof typeof RANGE_DIFFICULTY; weaponDamage?: number; bonusDice?: number; giftId?: string;
  /**
   * Capacidades de criatura marcadas por el director en esta tirada (p.107–108):
   *  - `autoSuccesses`: éxitos que no salen de ningún dado, y `autoSuccessFrom` la capacidad que los da.
   *  - `solarWrath`: puntuación de Ira solar, que suma al daño del arma.
   *  - `night`: si la escena es de noche. Lo marca el director tirada a tirada (decisión del dueño, 2026-08-21).
   */
  autoSuccesses?: number; autoSuccessFrom?: CapabilityId; solarWrath?: number; night?: boolean;
}
export const readOptions = (o: Record<string, unknown> | undefined): Partial<PlenilunioRollOptions> => (o ?? {}) as Partial<PlenilunioRollOptions>;

/** Reads the roll block of the sheet (difficulty / specialty / armour / extra) as defaults for poolFor. */
export function rollBlockOptions(sheet: SheetData): Pick<PlenilunioRollOptions, 'difficulty' | 'specialty' | 'armourPenalty' | 'extraDice'> {
  const d = derived(sheet);
  return {
    difficulty: Number(sheet.difficulty ?? 2) || 0,
    specialty: sheet.useSpecialty === 'yes' || sheet.useSpecialty === true,
    armourPenalty: (sheet.useArmour === 'yes' || sheet.useArmour === true) ? d.armourPenalty : 0,
    extraDice: num(sheet.extraDice),
  };
}

// ─── Extra dice ceiling (manual p.87, p.96, p.101) ───────────────────────────
/**
 * Cuántos dados extra puede añadir a mano quien tira. **El libro no da un máximo global**, así que el techo
 * sale de los casos que sí escribe, uno por uno (orden del dueño, 2026-08-21: «teniendo identificado los
 * casos … no pones dos, y si alguna habilidad te deja más lo permites»). Antes no había techo ninguno y se
 * llegaba a **30 dados con Combate 4** desde el desplegable de disparar.
 *
 *  - **`tools: 2`** — el caso normal. p.87, literal: «Si el personaje cuenta con herramientas adecuadas o de
 *    más calidad, **añade uno o dos dados** a la característica del personaje», y **no se acumulan**: «se
 *    añaden solo los dados que añada la mejor herramienta». Los accesorios de las armas a distancia (miras
 *    láser, telescópicas, p.96) son lo mismo: el libro dice que dan dados extra y no pone número.
 *  - **`medical: 4`** — la atención médica. p.101: «el grado de éxito que obtenga [el médico] se convierte en
 *    dados extra que el jugador del personaje herido añadirá en su **próxima tirada de recuperación**», y la
 *    tabla de grados de la p.85 llega hasta **4** («de forma absoluta»). La tirada de recuperación es de
 *    Fortaleza, así que es Fortaleza la que admite hasta 4.
 *
 * NO gastan de este techo, porque el motor ya los pone por su cuenta y no son «lo que el jugador añade a
 * mano»: la **bonificación del arma** cuerpo a cuerpo (p.87/p.97, 1–2 dados, y 3+ las excepcionales de la
 * p.157) va en `bonusDice`, y los **dados de la reserva de Destino** (p.88–89) van en su propio grupo.
 */
export const EXTRA_DICE_MAX = { tools: 2, medical: 4 } as const;
/**
 * ⚠ Interpretación: el tope de la atención médica se aplica a **cualquier** tirada de Fortaleza, porque la
 * app todavía no distingue «tirada de recuperación» de las demás. Peca de generoso en una Fortaleza que no
 * sea de recuperación, y es preferible a dejar fuera el único caso del libro que pasa de dos.
 *
 * Lo que el manual deja EXPRESAMENTE en manos del director —cuántos compañeros pueden apoyar una acción
 * conjunta, +1 dado cada uno (p.87: «quedará … en la decisión del director de juego»)— no está aquí: la app
 * no modela la acción conjunta todavía. Cuando se modele, su techo sale de cuántos apoyan.
 */
export function extraDiceMax(sheet: SheetData, action: { stat: string; options?: Record<string, unknown> }): ExtraDiceCap {
  const stat: StatId = isStatId(action.stat) ? action.stat : 'fortitude';
  return stat === 'fortitude'
    ? { max: EXTRA_DICE_MAX.medical, reason: 'sheet.roll.extraCap.medical', ref: 'recovery' }
    : { max: EXTRA_DICE_MAX.tools, reason: 'sheet.roll.extraCap.tools', ref: 'tools' };
}

// ─── Token size on the map (manual p.25) ─────────────────────────────────────
/**
 * Cuántas casillas de ancho ocupa el token de un personaje según su TAMAÑO, la columna «Estatura» de la tabla
 * de la p.25. Antes todo token nacía de una casilla —un gato y un dragón, igual de grandes— y el dueño los vio
 * además «demasiado pequeños» (2026-08-21).
 *
 * Cómo salen los números. La casilla del mapa mide `METRES_PER_CELL` (1,5 m), así que la huella literal de
 * cada tamaño es su estatura entre 1,5: diminuto 0,33 · pequeño 0,60 · mediano 1,13 · grande 2,67 · enorme
 * 5,33 casillas. A eso se le aplica el aumento de LEGIBILIDAD que pidió el dueño —«un 50% más para tamaño
 * normal»—, que fija el mediano en **1,5 casillas** y multiplica por 1,33 a todos por igual para que las
 * proporciones del libro se mantengan. Redondeado al cuarto de casilla, que es lo que se distingue en pantalla.
 *
 * | Tamaño   | Estatura (p.25) | Huella literal | En el mapa |
 * |----------|-----------------|----------------|------------|
 * | Diminuto | 50 cm           | 0,33           | **0,5**    |
 * | Pequeño  | 90 cm           | 0,60           | **0,75**   |
 * | Mediano  | 1,7 m           | 1,13           | **1,5**    |
 * | Grande   | 4 m             | 2,67           | **3,5**    |
 * | Enorme   | 8 m             | 5,33           | **7**      |
 *
 * ⚠ Interpretación: el libro NO da huellas en casillas —da estaturas y un modificador de Aguante—, así que el
 * paso a casillas y el 1,33 de legibilidad son nuestros. Lo que SÍ es del libro son las proporciones.
 */
export const TOKEN_CELLS: Record<SizeId, number> = { tiny: 0.5, small: 0.75, medium: 1.5, large: 3.5, huge: 7 };
/** `null` cuando la ficha no dice de qué tamaño es: el mapa pone entonces el suyo por defecto. */
export function tokenCells(sheet: SheetData): number | null {
  const id = str(sheet.size, '');
  return (TOKEN_CELLS as Record<string, number | undefined>)[id] ?? null;
}

/**
 * El orden de actuación de un combate (p.92, «Orden de actuación»), literal y en su orden:
 *
 *   «El orden de los turnos se determina según la puntuación de **Destino**… El primer turno corresponde al
 *   personaje con el Destino más alto y siguen los demás en orden decreciente. En caso de empate, el turno de
 *   un **personaje jugador es anterior** al de uno no jugador. **Si el empate es entre personajes jugadores**,
 *   va primero el que tenga mayor puntuación de **Combate**. Y si el empate persiste, **el director de juego
 *   decide** quién precede y quién va después.»
 *
 * Dos cosas que el libro dice y es fácil pasar por alto:
 * - El desempate por **Combate es SÓLO entre personajes jugadores** («si el empate es entre personajes
 *   jugadores»). Dos criaturas con el mismo Destino NO las desempata su Combate: caen directamente en el
 *   «decide el director». Darles el mismo criterio que a los PJ sería escribirle una regla al libro.
 * - **Devolver `0` es la respuesta correcta** cuando el empate persiste, no un fallo: es exactamente el hueco
 *   que el manual le deja al director, y `orderTurns` lo saca aparte para que alguien lo pregunte.
 *
 * La Fortuna no entra aquí: adelantarse gastándola (p.89, p.92) mueve un puesto YA ordenado, no cambia el
 * criterio con el que se ordenó.
 */
export function turnOrder(a: TurnParticipant, b: TurnParticipant): number {
  const destiny = num(b.sheet.destiny, 0) - num(a.sheet.destiny, 0);
  if (destiny !== 0) return destiny;
  if (a.isPlayerCharacter !== b.isPlayerCharacter) return a.isPlayerCharacter ? -1 : 1;
  if (!a.isPlayerCharacter) return 0;
  // `statOf` y no `num`: en la ficha de un personaje el Combate es un objeto `{value, specialties}` y en el
  // bloque de una criatura un número pelado. Leerlo a pelo daba 0 a los dos y los dejaba SIEMPRE empatados.
  return statOf(b.sheet, 'combat').value - statOf(a.sheet, 'combat').value;
}

/** Builds the RollRequest for a stat: own dice = stat − health penalty + extra + bonus; Destiny and opposition groups tagged. */
export function poolFor(sheet: SheetData, action: { stat: string; options?: Record<string, unknown> }): RollRequest {
  const stat: StatId = isStatId(action.stat) ? action.stat : 'fortitude';
  const opts: PlenilunioRollOptions = { ...rollBlockOptions(sheet), ...readOptions(action.options), stat };
  const d = derived(sheet);
  const destiny = num(sheet.destiny, 3);
  /**
   * El techo de los dados extra se aplica AQUÍ y no en la pantalla: cuando la tirada lleva ficha, el servidor
   * rehace los grupos con este mismo `poolFor` (`performRoll`, «the client's groups are only a preview»), así
   * que capándolo en un solo sitio vale igual en el navegador y en el servidor. Es la lección de la tanda
   * anterior, donde el techo de los dados de defensa vivía SÓLO en el navegador y un `{"defence": 40}` a mano
   * daba 40 dados. (Una tirada de criatura no lleva ficha y no se rehace: hueco de autoridad anterior a esto.)
   * **Sólo es un TECHO.** Un `extraDice` NEGATIVO es legítimo y no se toca: es como se dice «tiro con menos
   * dados de los que tengo», que el libro permite expresamente —el director reparte su Combate entre los
   * ataques y defensas del turno (p.94)— y es lo que usan el contador de la ficha («N dados menos») y el
   * ataque desde el token del mapa (`extraDice: dados − Combate`). Se capa la SUBIDA y nunca la bajada.
   */
  const extra = Math.min(Math.floor(num(opts.extraDice)), extraDiceMax(sheet, { stat, ...(action.options ? { options: action.options } : {}) }).max);
  const ownCount = Math.max(0, statOf(sheet, stat).value - d.dicePenalty + extra + num(opts.bonusDice));
  const destinyDice = destiny >= DESTINY_MAX ? 0 : Math.max(0, Math.min(DESTINY_POOL.perTakeMax, Math.floor(num(opts.destinyDice))));
  const opposition = Math.max(0, Math.floor(num(opts.difficulty)));
  const groups: DiceGroup[] = [{ count: ownCount, sides: 6, tag: 'own' }];
  if (destinyDice > 0) groups.push({ count: destinyDice, sides: 6, tag: 'destiny' });
  if (opposition > 0) groups.push({ count: opposition, sides: 6, tag: 'opposition' });
  // `extraDice` se guarda YA RECORTADO: en el Registro tiene que quedar lo que de verdad se tiró, no lo que
  // alguien pidió (misma corrección que se hizo con `defence_dice` en la tanda anterior).
  const options: PlenilunioRollOptions = { ...opts, extraDice: extra, destinyDice, armourPenalty: num(opts.armourPenalty), specialty: !!opts.specialty };
  return {
    systemId: SYSTEM_ID, kind: 'system', title: `sheet.stats.${stat}`, groups,
    options: options as unknown as Record<string, unknown>,
    ...(destinyDice > 0 ? { sharedResources: { destiny: destinyDice } } : {}),
    visibility: 'table',
  };
}

const diceByTag = (request: RollRequest, dice: RolledDice, tag: string): number[] =>
  request.groups.flatMap((g, i) => (g.tag === tag ? (dice[i] ?? []) : []));

/**
 * Damage of a winning attack (manual p.97). Cancellation: opposition hits cancel plain successes first, triumphs last;
 * a doubled triumph (specialty / Destiny die) may be half-cancelled. Then: success = 1, triumph = weapon damage,
 * doubled triumph = 2× weapon damage, half-cancelled doubled triumph = 1× weapon damage.
 * Implemented as units: success = 1 unit worth 1; plain triumph = 1 unit worth `weaponDamage`; doubled triumph = 2 units worth `weaponDamage` each.
 *
 * `solarWrath` es la Ira solar (p.108): «añade la puntuación de esta capacidad al daño del arma». Suma ENCIMA
 * del daño impreso de los ataques de las cajas, que no la traen dentro — comprobado con Gabriel, cuya espada
 * hace 9 = Fortaleza 7 + 2 de la tabla, teniendo Ira solar 3 (RULES.md §8.0).
 *
 * ⚠ Interpretación nuestra: los **éxitos automáticos** valen 1 punto de daño cada uno, como cualquier otro
 * éxito (p.97). El libro no lo dice; dejarlos fuera sería peor, porque entonces una criatura que gana el
 * ataque gracias a ellos haría menos daño del que su diferencia dice.
 */
export function attackDamage(o: Outcome, weaponDamage: number, solarWrath = 0): number {
  let successes = o.own.successes + o.destiny.successes + o.autoSuccesses;
  let triumphUnits = o.own.triumphs * (o.specialty ? 2 : 1) + o.destiny.triumphs * 2;
  let cancel = o.oppositionHits;
  const fromSuccesses = Math.min(cancel, successes); successes -= fromSuccesses; cancel -= fromSuccesses;
  triumphUnits -= Math.min(cancel, triumphUnits);
  return successes + triumphUnits * Math.max(1, weaponDamage + Math.max(0, Math.floor(solarWrath)));
}

// ─── Los dos ataques APARTE de las capacidades (manual p.107–108) ────────────
/**
 * **Ponzoña\***: «cualquier ataque de la criatura que tenga éxito inyecta el veneno». Resistirlo es un
 * conflicto entre la **Fortaleza de la víctima** y la puntuación de Ponzoña, y es un ataque APARTE del
 * principal: se resuelve con su propia tirada. Si vence la criatura, «cada éxito = 1 punto de daño y cada
 * triunfo = tantos puntos como la Ponzoña», que es exactamente la cuenta del daño de un arma (p.97).
 */
export const venomDamage = (o: Outcome, venom: number): number => (o.difference > 0 ? attackDamage(o, venom) : 0);

/** La Deflagración se resuelve como un reto a dificultad 1 (p.108). */
export const BLAST_DIFFICULTY = 1;
/** Radio de la Deflagración: 1 metro por punto (p.108). */
export const blastReach = (blast: number): number => Math.max(0, Math.floor(blast));
/**
 * Dados de una Deflagración contra quien está a `metres` metros: «tantos dados como la puntuación, −1 dado
 * por cada metro de distancia» (p.108). Fuera del radio no hay ataque, y por eso da 0.
 */
export const blastDice = (blast: number, metres: number): number =>
  Math.max(0, blastReach(blast) - Math.max(0, Math.floor(metres)));
/** Daño de una Deflagración que gana el reto: éxito = 1 punto, triunfo = la puntuación (p.108). */
export const blastDamage = (o: Outcome, blast: number): number => (o.difference > 0 ? attackDamage(o, blast) : 0);

/** Server-side resolution: classifies each tagged group and returns summary key + all numbers + effects. */
export function resolve(request: RollRequest, dice: RolledDice, sheet?: SheetData): RollResult {
  const opts = readOptions(request.options);
  const o = resolveAction({
    own: diceByTag(request, dice, 'own'), destiny: diceByTag(request, dice, 'destiny'), opposition: diceByTag(request, dice, 'opposition'),
    specialty: !!opts.specialty, armourPenalty: num(opts.armourPenalty), oppositionSpecialty: !!opts.oppositionSpecialty,
    autoSuccesses: num(opts.autoSuccesses),
  });
  const detail: Record<string, unknown> = {
    stat: opts.stat, own: o.own, destiny: o.destiny, opposition: o.opposition,
    ownHits: o.ownHits, destinyHits: o.destinyHits, oppositionHits: o.oppositionHits, difference: o.difference,
    setback: o.setback, destinyUp: o.destinyUp, armourConverted: o.armourConverted, specialty: o.specialty, degree: degreeKey(o.difference),
    autoSuccesses: o.autoSuccesses,
  };
  if (opts.weaponId) detail.damage = o.difference > 0 ? attackDamage(o, num(opts.weaponDamage, 1), num(opts.solarWrath)) : 0;
  /**
   * Lo que la FICHA sabía en el momento de tirar, guardado con la tirada. El desglose del Registro
   * («4 Combate − 1 por herido = 3 dados», «Chaleco antibalas — 1 triunfo pasa a éxito normal») no puede
   * leerlo de la ficha de ahora: la tirada es inmutable y tiene que seguir diciendo lo mismo dentro de un
   * mes, con el personaje ya curado y con otra armadura puesta. Sólo se guarda cuando el servidor tiene
   * la ficha delante; sin ella el desglose enseña lo que pueda y calla el resto.
   */
  if (sheet && isStatId(opts.stat ?? '')) {
    const st = statOf(sheet, opts.stat as StatId);
    detail.statValue = st.value;
    detail.statSpecialties = st.specialties;
    detail.dicePenalty = derived(sheet).dicePenalty;
    detail.health = str(sheet.health, 'healthy');
    detail.armour = str(sheet.armour, 'none');
  }
  const effects: Record<string, unknown> = {};
  if (o.destinyUp) {
    effects.destinyUp = true; effects.fortuneRefill = true;
    if (sheet) { const next = Math.min(DESTINY_MAX, num(sheet.destiny, 3) + 1); effects.patch = { destiny: next, fortune: next }; }
  }
  if (o.setback) effects.setback = true;
  if (opts.ranged && opts.weaponId) effects.ammoSpent = opts.weaponId;
  if (opts.giftId) effects.fortuneSpent = GIFT_ACTIVATION_COST;
  return { summary: o.setback ? 'roll.summary.setback' : degreeKey(o.difference), detail, effects, total: o.difference };
}

// ─── Damage & health (manual p.89, p.98–101) ─────────────────────────────────
/**
 * Protection subtracts; every full multiple of Endurance in one blow marks one health level (4× = dead); Resistance
 * goes down by the net damage and dropping below 0 leaves the character unconscious (p.98).
 * `fortune` = Fortune points spent to lower the wound's severity, one level each (p.89); Resistance is still lost.
 */
export function applyDamage(sheet: SheetData, damage: number, fortune = 0): SheetPatch {
  const d = derived(sheet);
  const net = Math.max(0, Math.floor(damage) - d.protection);
  const levels = Math.max(0, Math.floor(net / d.endurance) - Math.max(0, Math.floor(fortune)));
  /**
   * **Ancla terrenal** (p.108): mientras el ancla exista la criatura «no puede ser destruida», y «cualquier
   * resultado que la deje en nivel de salud muerto se trata como otro nivel malherido», del que se recupera
   * con el tiempo de forma normal. O sea: el estado se queda en malherido y la Resistencia baja igual.
   */
  const floorIdx = hasCapability(capabilitiesOf(sheet), 'earthlyAnchor') ? healthIndexOf('badlyWounded') : HEALTH_LEVELS.length - 1;
  const idx = Math.min(floorIdx, d.healthIndex + levels);
  const health = HEALTH_LEVELS[idx]?.id ?? 'dead';
  const remaining = num(sheet.resistance) - net;
  const patch: SheetPatch = { resistance: Math.max(0, remaining), health };
  if (net > 0 && remaining < 0) patch.unconscious = 'yes';
  if (fortune > 0) patch.fortune = Math.max(0, num(sheet.fortune) - Math.floor(fortune));
  return patch;
}

/** Fortune spend/refill helpers (manual p.89–90). */
export const spendFortune = (sheet: SheetData, amount = 1): SheetPatch | null =>
  num(sheet.fortune) >= amount ? { fortune: num(sheet.fortune) - amount } : null;
export const refillFortune = (sheet: SheetData): SheetPatch => ({ fortune: derived(sheet).fortuneMax });
/** «Recobrar el aliento» (p.89): 1 Fortune → regain half of the Resistance lost (rounded down, ⚠ interpretación). */
export function catchBreath(sheet: SheetData): SheetPatch | null {
  if (num(sheet.fortune) < 1) return null;
  const d = derived(sheet);
  /**
   * Lo perdido se mide contra la PISTA (`resistanceMax`, ×3), no contra `recoveryMax`: recobrar el aliento no es
   * descansar —es un punto de Fortuna «para sacar fuerzas de flaqueza»— y la p.89 no le pone el tope del estado
   * de salud, sólo dice «la mitad de los puntos de Resistencia perdidos» (RULES.md §6.3).
   *
   * Sin `Math.min` contra el máximo: se capa la SUBIDA, nunca la bajada (misma regla que `rest` y las casillas).
   * Con la pista fija en ×3 el tope volvería a sobrar —`resistencia + ⌊(máx − resistencia)/2⌋ ≤ máx` por
   * construcción—, pero una ficha guardada puede llevar `resistance > resistanceMax` si se le baja Fortaleza o
   * Voluntad después, y ahí el `Math.min` cobraría la Fortuna y QUITARÍA puntos. (Hallazgo del Review, 2026-08-19.)
   */
  const lost = Math.max(0, d.resistanceMax - num(sheet.resistance));
  return { fortune: num(sheet.fortune) - 1, resistance: num(sheet.resistance) + Math.floor(lost / 2) };
}
/**
 * Rest after the scene (p.101): Resistance back up to `recoveryMax` — ×3 Endurance sano/magullado, ×2 herido,
 * ×1 malherido. NUNCA hasta `resistanceMax`: es justo el número que la p.101 recorta, y subir hasta la pista
 * entera dejaría curado del todo a un personaje malherido con sólo pasar la escena.
 * Se capa la subida y nunca la bajada: descansar no quita Resistencia ya marcada (RULES.md §6.3).
 */
export const rest = (sheet: SheetData): SheetPatch => ({ resistance: Math.max(num(sheet.resistance), derived(sheet).recoveryMax), unconscious: 'no' });

/** Ammo bookkeeping for ranged weapons (manual p.97). */
export function weaponData(row: WeaponRow): WeaponData | null {
  if (row.custom) return { bonus: row.custom.bonus, damage: row.custom.damage, strength: row.custom.strength, range: row.custom.range as WeaponData['range'], magazine: row.custom.magazine };
  return weaponById(row.id)?.data ?? null;
}
export function spendAmmo(sheet: SheetData, weaponId: string): SheetPatch | null {
  const rows = weaponsOf(sheet);
  const i = rows.findIndex(r => r.id === weaponId);
  const row = rows[i];
  if (!row || row.ammo === null || row.ammo === undefined || row.ammo <= 0) return null;
  return { weapons: rows.map((r, j) => (j === i ? { ...r, ammo: (r.ammo ?? 0) - 1 } : r)) };
}
/**
 * Recargar saca balas de la MUNICIÓN que llevas encima (`reserve`) y llena el cargador. Devuelve null
 * si no hay de dónde: el arma no tiene cargador, ya está lleno, o no te queda munición suelta.
 *
 * El libro no da una tabla de recarga, pero sí las dos piezas: el «Cargador» por arma (p.97) y que la
 * munición es un recurso escaso que se consigue y se lleva («entre 20 y 40 balas» en el equipo inicial,
 * p.019; «conseguir munición es muy difícil», p.030). ⚠ Interpretación: el cargador se llena hasta
 * donde alcance la munición, sin exigir tenerlo completo.
 */
export function reload(sheet: SheetData, weaponId: string): SheetPatch | null {
  const rows = weaponsOf(sheet);
  const i = rows.findIndex(r => r.id === weaponId);
  const row = rows[i];
  const data = row ? weaponData(row) : null;
  if (!row || !data || data.magazine === null) return null;
  const inMag = num(row.ammo);
  const reserve = num((row as unknown as Record<string, unknown>)['reserve']);
  const need = data.magazine - inMag;
  if (need <= 0 || reserve <= 0) return null;
  const moved = Math.min(need, reserve);
  return { weapons: rows.map((r, j) => (j === i ? { ...r, ammo: inMag + moved, reserve: reserve - moved } : r)) };
}

// ─── Progression (manual p.91) ───────────────────────────────────────────────
export type ProgressionKind = 'stat' | 'specialty.new' | 'specialty.change' | 'gift.new' | 'gift.level';
export interface ProgressionChange { kind: string; target: string; to?: unknown }

/** XP cost of a change or null when the rules forbid it (max stat 6, duplicate specialty/gift, gift level 5…). Does not check XP balance. */
export function progressionCost(sheet: SheetData, change: ProgressionChange): number | null {
  switch (change.kind as ProgressionKind) {
    case 'stat': {
      if (!isStatId(change.target)) return null;
      const v = statOf(sheet, change.target).value;
      if (v >= STAT_MAX) return null;
      return v >= 5 ? XP_COSTS.statTo6 : XP_COSTS.statTo5;
    }
    case 'specialty.new': {
      if (!isStatId(change.target) || typeof change.to !== 'string' || !change.to) return null;
      return statOf(sheet, change.target).specialties.includes(change.to) ? null : XP_COSTS.newSpecialty;
    }
    case 'specialty.change': {
      if (!isStatId(change.target) || typeof change.to !== 'string' || !change.to) return null;
      const s = statOf(sheet, change.target).specialties;
      return s.length === 0 || s.includes(change.to) ? null : XP_COSTS.changeSpecialty;
    }
    case 'gift.new':
      if (!(GIFT_IDS as readonly string[]).includes(change.target)) return null;
      return giftsOf(sheet).some(g => g.id === change.target) ? null : XP_COSTS.gift;
    case 'gift.level': {
      const g = giftsOf(sheet).find(x => x.id === change.target);
      return g && num(g.level, 1) < GIFT_MAX_LEVEL ? XP_COSTS.gift : null;
    }
  }
  return null;
}

/** Applies a change, debiting XP. Returns {} when not allowed or unaffordable. */
export function progressionApply(sheet: SheetData, change: ProgressionChange): SheetPatch {
  const cost = progressionCost(sheet, change);
  const xp = num(sheet.xp);
  if (cost === null || xp < cost) return {};
  const patch: SheetPatch = { xp: xp - cost };
  const target = change.target as StatId;
  switch (change.kind as ProgressionKind) {
    case 'stat': { const s = statOf(sheet, target); patch[target] = { ...s, value: s.value + 1 }; break; }
    case 'specialty.new': { const s = statOf(sheet, target); patch[target] = { ...s, specialties: [...s.specialties, change.to as string] }; break; }
    case 'specialty.change': { const s = statOf(sheet, target); patch[target] = { ...s, specialties: [change.to as string, ...s.specialties.slice(1)] }; break; }
    case 'gift.new': patch.gifts = [...giftsOf(sheet), { id: change.target, level: 1 } satisfies GiftRow]; break;
    case 'gift.level': patch.gifts = giftsOf(sheet).map(g => (g.id === change.target ? { ...g, level: num(g.level, 1) + 1 } : g)); break;
  }
  return patch;
}

// ─── Shared resources & actions ──────────────────────────────────────────────
export const sharedResources: SharedResourceDef[] = [{
  id: 'destiny', label: 'system.destinyPool', ref: 'destinyPool',
  max: DESTINY_POOL.max, initial: DESTINY_POOL.initial, perTakeMax: DESTINY_POOL.perTakeMax,
  whoCanTake: 'player', whoCanReset: 'dm',
  blockedIf: sheet => (num(sheet.destiny, 3) >= DESTINY_MAX ? 'roll.destinyBlocked' : null),
}];

const attackRequest = (sheet: SheetData, itemId: string, options: Record<string, unknown> | undefined, ranged: boolean): RollRequest => {
  const row = weaponsOf(sheet).find(r => r.id === itemId) ?? { id: itemId, ammo: null };
  const data = weaponData(row) ?? { bonus: 0, damage: 0, strength: true, range: 'melee' as const, magazine: null };
  const weaponDamage = data.strength ? statOf(sheet, 'fortitude').value + data.damage : data.damage;
  const extra: Partial<PlenilunioRollOptions> = { weaponId: itemId, ranged, weaponDamage, bonusDice: ranged ? 0 : data.bonus };
  const range = readOptions(options).range;
  if (ranged && range && options?.difficulty === undefined && RANGE_DIFFICULTY[range] !== undefined) extra.difficulty = RANGE_DIFFICULTY[range];
  const req = poolFor(sheet, { stat: 'combat', options: { ...(options ?? {}), ...extra } });
  return { ...req, title: `catalog.weapons.${itemId}` };
};

/** Un arma ofrece SOLO su acción: c/c o a distancia, nunca las dos (p.96–97, y `attackActionFor`). */
const rowIsMelee = (row: Record<string, unknown>): boolean => {
  const d = weaponData(row as unknown as WeaponRow);
  return !d || isMelee(d);
};
export const actions: ActionDef[] = [
  { id: 'attack.melee', icon: 'swords', label: 'sheet.actions.attackMelee', appliesTo: 'weapons', appliesToRow: rowIsMelee, toRoll: (s, id, o) => attackRequest(s, id, o, false) },
  {
    id: 'attack.ranged', icon: 'target', label: 'sheet.actions.attackRanged', appliesTo: 'weapons',
    appliesToRow: r => !rowIsMelee(r),
    /**
     * Un disparo gasta un punto de cargador (p.97). Que el arco, la ballesta y el tirachinas pongan
     * «Cargador 1» es lo que fija la unidad: una unidad = un disparo, y a recargar. Sin balas devuelve
     * null y el botón se apaga; recargar es una acción aparte que el libro cobra en dados de Combate
     * (p.96) y que todavía no está construida.
     */
    spend: (sheet, id) => {
      // `spendAmmo` ya existía y está probado: se reutiliza en vez de repetir la cuenta. Devuelve null
      // cuando el arma no tiene cargador, así que aquí se distingue ese caso —un arma a distancia sin
      // munición declarada se dispara gratis— de quedarse sin balas, que sí apaga el botón.
      const row = weaponsOf(sheet).find(r => str(r.id) === id);
      const d = row ? weaponData(row) : null;
      if (d && d.magazine === null) return {};
      return spendAmmo(sheet, id);
    },
    toRoll: (s, id, o) => attackRequest(s, id, o, true),
  },
  {
    // Recargar no tira dados: mueve balas de la munición al cargador. El libro lo cobra como acción del
    // turno con al menos 1 dado de Combate y sin tirada (p.96); ese coste en dados todavía no se aplica.
    id: 'reload', icon: 'refresh', label: 'sheet.actions.reload', appliesTo: 'weapons',
    appliesToRow: r => !rowIsMelee(r),
    spend: (sheet, id) => reload(sheet, id),
  },
  {
    id: 'gift.activate', icon: 'bolt', label: 'sheet.actions.activateGift', appliesTo: 'gifts', cost: 'sheet.actions.giftCost',
    toRoll: (sheet, giftId, options) => {
      const req = poolFor(sheet, { stat: str(options?.stat, 'will'), options: { ...(options ?? {}), giftId } });
      return { ...req, title: `catalog.gifts.${giftId}.name` };
    },
  },
];
/** Which attack action a weapon row uses. */
export const attackActionFor = (row: WeaponRow): 'attack.melee' | 'attack.ranged' => {
  const d = weaponData(row);
  return d && !isMelee(d) ? 'attack.ranged' : 'attack.melee';
};

export const engine: Engine = {
  derived: sheet => ({ ...derived(sheet) }),
  poolFor, extraDiceMax, tokenCells, resolve, applyDamage,
  progression: { cost: progressionCost, apply: progressionApply },
  sharedResources, actions,
  explain, turnOrder,
};

