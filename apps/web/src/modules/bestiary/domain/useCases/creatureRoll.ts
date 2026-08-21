import type { RollRequest, RollVisibility } from '@rolvium/core';
import type { StatId } from '@rolvium/system-plenilunio';
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
const sheetOf = (entry: BestiaryEntry): Record<string, unknown> =>
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
  const req = poolFor(sheet, {
    stat: choice.stat,
    options: {
      specialty: choice.specialty,
      difficulty: Math.max(0, Math.floor(choice.difficulty)),
      extraDice: Math.max(0, Math.floor(choice.extraDice)),
      // Una criatura no coge dados de la Reserva de Destino: la reserva es de la mesa, de los jugadores (p.88).
      destinyDice: 0,
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

/** Cuántos dados propios saldrán, para poder enseñarlo ANTES de tirar («DADOS QUE TIRAS» del diseño). */
export const ownDiceOf = (req: RollRequest): number =>
  req.groups.filter(g => g.tag !== 'opposition').reduce((n, g) => n + g.count, 0);
