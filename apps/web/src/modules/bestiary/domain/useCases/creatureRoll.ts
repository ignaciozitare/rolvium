import type { DiceGroup, RollRequest, RollVisibility } from '@rolvium/core';
import type { CreatureAttack, StatId, WeaponRange } from '@rolvium/system-plenilunio';
import type { BestiaryEntry } from '../entities/BestiaryEntry';

/** Lo que el director elige en el desplegable antes de tirar por una criatura. */
export interface CreatureRollChoice {
  stat: StatId;
  /** Le vale su especialidad en ESA característica — lo decide el director, no se aplica sola (p.83). */
  specialty: boolean;
  /** Dados de oposición: la dificultad del desafío (p.84). */
  difficulty: number;
  extraDice: number;
  visibility: RollVisibility;
  /**
   * La escena es de noche. No es dato de la escena: lo marca el director en la propia tirada (decisión del
   * dueño, 2026-08-21). Sólo viaja para que quede escrito en el Registro qué se tuvo en cuenta.
   */
  night?: boolean;
  /**
   * Éxitos automáticos de la capacidad que el director marcó, y cuál es (p.107–108). No son dados: los suma
   * el motor a los aciertos. `autoSuccessFrom` es el id de la capacidad, para que el desglose la nombre.
   */
  autoSuccesses?: number;
  autoSuccessFrom?: string | null;
  /** Ira solar: su puntuación suma al daño del ataque (p.108). 0 = no la tiene. */
  solarWrath?: number;
  /** El ataque impreso que eligió el director, con su ataque y su daño ya calculados por el libro. */
  attack?: CreatureAttack | null;
}

/** Lo que el director elige para una Deflagración, que es un ataque APARTE y no se tira con característica. */
export interface CreatureBlastChoice {
  /** Puntuación de la capacidad: el radio en metros y el daño por triunfo (p.108). */
  level: number;
  /** A cuántos metros está la víctima. */
  metres: number;
  /** Dados que quedan a esa distancia: la puntuación menos 1 por metro. Los calcula el motor. */
  dice: number;
  /** Reto a dificultad 1 (p.108); el director puede subirla si deja ponerse a cubierto (p.96). */
  difficulty: number;
  visibility: RollVisibility;
}

/** La firma de `engine.poolFor` del sistema. Entra por parámetro: el dominio del bestiario no conoce ningún sistema. */
export type PoolFor = (sheet: Record<string, unknown>, action: { stat: string; options?: Record<string, unknown> }) => RollRequest;

/**
 * La forma de ficha que el motor sabe leer, hecha con el bloque de la criatura.
 *
 * `statOf` acepta la característica como número suelto, así que un bloque de bestiario encaja sin
 * traducirlo a la ficha completa de un personaje.
 *
 * `health: 'healthy'` a propósito: la penalización por heridas es de los personajes, que llevan estado de
 * salud. Una criatura lleva Resistencia, y el manual no le resta dados por estar dañada — restárselos sería
 * inventarse una regla que el libro no tiene.
 */
export const sheetOf = (entry: BestiaryEntry): Record<string, unknown> =>
  ({
    ...entry.data.stats, health: 'healthy', destiny: 0, size: 'normal',
    // Sus capacidades viajan con la ficha porque hay reglas que el motor aplica solo a partir de ellas
    // (Piel gruesa es protección, Inmune al dolor no resta dados, Ancla terrenal no la deja morir, p.107–108).
    capabilities: entry.data.capabilities ?? [],
  });

/**
 * La tirada del director EN NOMBRE de una criatura — lo que el spec llama «tirar en su nombre» y lo que
 * justificó meter las especialidades como dato.
 *
 * **No recalcula el puñado de dados.** Arma la ficha que el motor ya sabe leer y delega en su `poolFor`.
 * Las reglas de dados viven en el paquete del sistema y sólo ahí: duplicarlas aquí es cómo se acaba con dos
 * verdades que se contradicen, y con las reglas manda el manual (regla del dueño, 2026-08-17).
 *
 * Un **PNJ aliado** tiene ficha de personaje de verdad: se le pasa la suya y tira exactamente como un
 * jugador, con sus dones, su armadura y su penalización por heridas.
 */
export function creatureRollRequest(entry: BestiaryEntry, choice: CreatureRollChoice, poolFor: PoolFor, statLabel: string): RollRequest {
  const sheet = entry.origin === 'npc' && entry.data.sheet ? entry.data.sheet : sheetOf(entry);
  /**
   * El ataque impreso de un bloque en caja trae SU número de dados ya calculado («Espada oriental 9»), que es
   * Combate más la bonificación del arma (p.97). Aquí no se recalcula nada: la diferencia con su Combate entra
   * como la bonificación del arma que el motor ya sabe sumar, y el daño impreso viaja tal cual.
   *
   * `weaponId` lleva la CLAVE del nombre del ataque (`catalog.creatureAttacks.*`). El motor sólo la usa para
   * saber que esto es un ataque —y así calcular el daño— y para nombrarlo; no busca ningún arma de la tabla.
   */
  const attack = choice.attack ?? null;
  const combat = Number(entry.data.stats.combat ?? 0);
  const req = poolFor(sheet, {
    stat: attack ? 'combat' : choice.stat,
    options: {
      specialty: choice.specialty,
      difficulty: Math.max(0, Math.floor(choice.difficulty)),
      extraDice: Math.max(0, Math.floor(choice.extraDice)),
      // Una criatura no coge dados de la Reserva de Destino: la reserva es de la mesa, de los jugadores (p.88).
      destinyDice: 0,
      night: !!choice.night,
      autoSuccesses: Math.max(0, Math.floor(choice.autoSuccesses ?? 0)),
      ...(choice.autoSuccessFrom ? { autoSuccessFrom: choice.autoSuccessFrom } : {}),
      ...(choice.solarWrath ? { solarWrath: choice.solarWrath } : {}),
      ...(attack ? { weaponId: attack.label, weaponDamage: attack.damage, bonusDice: attack.attack - combat } : {}),
    },
  });
  return {
    ...req,
    // El rótulo del Registro. Va ya traducido, no como clave, porque el nombre de la criatura es texto libre
    // del director y no existe en ningún diccionario: el Registro es acta de lo que pasó, no plantilla.
    title: `${entry.name} · ${statLabel}`,
    visibility: choice.visibility,
  };
}

/**
 * La **Deflagración** (p.108): un ataque APARTE del principal, que no se tira con ninguna característica —
 * los dados salen de la propia puntuación, menos uno por cada metro de distancia— y que se resuelve como un
 * reto a dificultad 1. Por eso no pasa por `poolFor` como las demás: su puñado no sale de la ficha.
 *
 * Se apoya igualmente en `poolFor` para no inventarse la forma de una petición (sistema, tipo, opciones) y
 * le cambia SÓLO los grupos de dados. Va sin característica a propósito: el desglose del Registro prefiere
 * callar antes que decir «3 Combate», que sería mentira.
 */
export function creatureBlastRequest(entry: BestiaryEntry, choice: CreatureBlastChoice, poolFor: PoolFor, blastLabel: string): RollRequest {
  const difficulty = Math.max(0, Math.floor(choice.difficulty));
  const dice = Math.max(0, Math.floor(choice.dice));
  const base = poolFor(sheetOf(entry), { stat: 'combat', options: { destinyDice: 0, difficulty } });
  const groups: DiceGroup[] = [{ count: dice, sides: 6, tag: 'own' }];
  if (difficulty > 0) groups.push({ count: difficulty, sides: 6, tag: 'opposition' });
  return {
    ...base,
    groups,
    options: {
      difficulty,
      // El daño de la Deflagración se cuenta como el de un arma: éxito 1 punto, triunfo la puntuación (p.108).
      weaponId: 'catalog.capabilities.blast.name', weaponDamage: choice.level,
      blastLevel: choice.level, blastMetres: Math.max(0, Math.floor(choice.metres)),
    },
    title: `${entry.name} · ${blastLabel}`,
    visibility: choice.visibility,
  };
}

/** Cuántos dados propios saldrán, para poder enseñarlo ANTES de tirar («DADOS QUE TIRAS» del diseño). */
export const ownDiceOf = (req: RollRequest): number =>
  req.groups.filter(g => g.tag !== 'opposition').reduce((n, g) => n + g.count, 0);

/** Lo que el director elige al atacar con el token de una criatura (`.pen` «Modal/Atacar con el token»). */
export interface CreatureAttackChoice {
  /** Dados de Combate que pone. Puede repartirlos entre varios objetivos, así que los teclea él (p.94). */
  dice: number;
  /** El alcance al que queda la víctima, ya medido por el mapa. `melee` es conflicto (p.93). */
  range: WeaponRange | null;
  /** Dados de oposición: la dificultad del alcance en un disparo (p.96). Cuerpo a cuerpo va a 0. */
  difficulty: number;
  visibility: RollVisibility;
  /** El ataque impreso de su caja, si lo tiene. Sin él pega sin armas, y el daño es su Fortaleza (p.97). */
  attack?: CreatureAttack | null;
  /** Ira solar: suma al daño (p.108). */
  solarWrath?: number;
  /**
   * Éxitos automáticos de una capacidad que el director marcó (Amparo de la noche, p.107). La HORA no se
   * pregunta aquí: sale del interruptor de día/noche de la escena, que es donde vive (dueño, 2026-08-21).
   */
  autoSuccesses?: number;
  autoSuccessFrom?: string | null;
}

/**
 * Atacar CON la criatura desde su token del mapa (`.pen` «6 · Toca el token de la criatura en el mapa y
 * ataca con ella»). Es la misma tirada de Combate de siempre; lo que cambia es de dónde salen los datos:
 *
 * - **Los dados los pone el director**, porque el libro le deja repartir su Combate entre varios ataques y
 *   defensas del turno (p.94) y eso no lo puede adivinar el motor.
 * - **La distancia la mide el mapa**, y de ahí sale si es cuerpo a cuerpo o un disparo y contra qué
 *   dificultad (p.96). Cuerpo a cuerpo va SIN oposición: es un conflicto y los dados de enfrente son los
 *   que gaste el jugador en defenderse, que es la pieza que todavía no existe.
 * - **El daño**: el impreso de su caja si la tiene; si no, sin armas, que el libro paga con su Fortaleza.
 *
 * `title` llega ya escrito y traducido: el nombre de la criatura y el de quien recibe el golpe son texto
 * libre del director y no existen en ningún diccionario.
 */
export function creatureAttackRequest(entry: BestiaryEntry, choice: CreatureAttackChoice, poolFor: PoolFor, title: string): RollRequest {
  const combat = Number(entry.data.stats.combat ?? 0);
  const fortitude = Number(entry.data.stats.fortitude ?? 0);
  const attack = choice.attack ?? null;
  const dice = Math.max(0, Math.floor(choice.dice));
  const req = poolFor(sheetOf(entry), {
    stat: 'combat',
    options: {
      destinyDice: 0,
      difficulty: Math.max(0, Math.floor(choice.difficulty)),
      /**
       * Los dados que pone el director, dichos como diferencia con su Combate para no recalcular el puñado.
       * Van en DOS sitios distintos a propósito, y no en uno solo, porque el techo de dados extra (p.87) sólo
       * capa lo que se añade a mano:
       *
       *  - El **ataque impreso** de su caja («Mandoble 11») es Combate más la bonificación del arma (p.97),
       *    así que su diferencia con el Combate va donde va la de cualquier arma: en `bonusDice`, que no
       *    gasta del techo —igual que ya hacía `creatureRollRequest`—. Metido en `extraDice` se lo comía el
       *    techo: Luz-Malefic ataca a dos manos con 10 y su Combate es 6, y habría tirado 8 (p.163).
       *  - Lo que el director sube o baja **a mano** sobre ese puñado impreso sí es un dado extra, y sí tiene
       *    techo. Negativo es legítimo y no se toca: así reparte su Combate entre los ataques del turno (p.94).
       */
      bonusDice: attack ? attack.attack - combat : 0,
      extraDice: dice - (attack ? attack.attack : combat),
      ranged: choice.range !== null && choice.range !== 'melee',
      ...(choice.range && choice.range !== 'melee' ? { range: choice.range } : {}),
      weaponId: attack ? attack.label : 'catalog.weapons.unarmed',
      weaponDamage: attack ? attack.damage : fortitude,
      ...(choice.solarWrath ? { solarWrath: choice.solarWrath } : {}),
      autoSuccesses: Math.max(0, Math.floor(choice.autoSuccesses ?? 0)),
      ...(choice.autoSuccessFrom ? { autoSuccessFrom: choice.autoSuccessFrom } : {}),
    },
  });
  return { ...req, title, visibility: choice.visibility };
}
