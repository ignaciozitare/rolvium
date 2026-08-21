// ─── El desglose de una tirada · Malefic Time: Plenilunio ────────────────────
// «CÓMO SALIÓ ESTA TIRADA»: de dónde salieron los dados, qué reglas se aplicaron sin preguntar y
// cómo se cierra el resultado. Lo escribe el SISTEMA porque es el único que sabe qué regla entró y
// en qué página del manual está; la plataforma sólo lo pinta (rolvium.pen `Tooltip/Desglose`).
//
// Todo sale de la tirada YA GUARDADA —petición + dados + resultado— y NUNCA de la ficha de ahora:
// una tirada es inmutable y su desglose tiene que decir lo mismo dentro de un mes, con el personaje
// ya curado y con otra armadura puesta. Lo que la ficha sabía al tirar lo dejó `resolve` en `detail`;
// cuando no está (tiradas viejas, o resueltas sin ficha) esa línea SE CALLA en vez de inventarse un
// número.
import type { ExplainLine, RollExplain, RollRequest, RollResult, RolledDice } from '@rolvium/core';
import { armourById, isStatId, specialtyById, type StatId } from './catalogs';
import { readOptions } from './engine';
import { references } from './references';

/**
 * Una línea con la página del manual de una referencia ya declarada en `references.ts` (una sola
 * verdad, probada contra RULES.md §9). Sin referencia conocida, la línea va sin página en vez de con
 * una inventada.
 */
const line = (text: string, refKey: string): ExplainLine => {
  const p = references[refKey]?.page;
  return p === undefined ? { text } : { text, page: p };
};

/**
 * Rellena `{{clave}}` en un texto de las locales del sistema. Las locales del paquete no interpolan
 * hoy —son cadenas planas— y el desglose es la primera pieza que necesita meter números dentro.
 */
export function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

type Ts = (key: string) => string;
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
/** Un nombre del catálogo, en el idioma de quien mira, en minúscula para que encaje dentro de una frase. */
const lower = (s: string): string => s.toLocaleLowerCase();

const countOf = (request: RollRequest, tag: string): number =>
  request.groups.reduce((n, g) => (g.tag === tag ? n + g.count : n), 0);

/**
 * El desglose de una tirada de característica. Devuelve `null` cuando no hay nada que desglosar:
 * una tirada libre (no la resuelve este motor) o una petición sin característica.
 */
export function explain(roll: { request: RollRequest; dice: RolledDice; result: RollResult }, ts: Ts): RollExplain | null {
  const { request, result } = roll;
  if (request.kind !== 'system') return null;
  const o = readOptions(request.options);
  if (!o.stat || !isStatId(o.stat)) return null;
  const stat: StatId = o.stat;
  const d = result.detail ?? {};

  const head: ExplainLine[] = [];
  const applied: ExplainLine[] = [];

  // ─── De dónde salieron los dados (p.82) ────────────────────────────────────
  const ownDice = countOf(request, 'own');
  const statValue = typeof d['statValue'] === 'number' ? d['statValue'] : null;
  if (statValue === null) {
    head.push(line(fill(ts('roll.explain.diceOnly'), { n: ownDice }), 'roll'));
  } else {
    const parts = [fill(ts('roll.explain.diceFrom'), { value: statValue, stat: ts(`sheet.stats.${stat}`) })];
    const penalty = num(d['dicePenalty']);
    const health = text(d['health']);
    if (penalty > 0 && health) parts.push(fill(ts('roll.explain.dicePenalty'), { n: penalty, health: lower(ts(`sheet.health.${health}`)) }));
    const bonus = num(o.bonusDice);
    if (bonus > 0) parts.push(fill(ts('roll.explain.diceWeapon'), { n: bonus }));
    const extra = num(o.extraDice);
    if (extra > 0) parts.push(fill(ts('roll.explain.diceExtra'), { n: extra }));
    parts.push(fill(ts('roll.explain.diceTotal'), { n: ownDice }));
    head.push(line(parts.join(' '), 'roll'));
  }

  // ─── La Reserva de la mesa, que no es suya (p.88) ──────────────────────────
  const destinyDice = countOf(request, 'destiny');
  if (destinyDice > 0) head.push(line(fill(ts('roll.explain.destiny'), { n: destinyDice }), 'destinyPool'));

  /**
   * Contra qué se tiró. ⚠ Ojo con p.85: el Registro NO debe decir si los dados de enfrente son la
   * dificultad o un rival —«Luis no sabe si el director tira porque hay otro personaje o porque es la
   * dificultad»—, y por eso el Registro sigue sin etiquetarlos. El DESGLOSE sí puede: quien lo abre es
   * quien ya sabe de qué iba la tirada, y decirle «reto a dificultad 3» cuando fue un conflicto sería
   * mentirle sobre qué regla se aplicó.
   *
   * `conflict` lo marca la petición (un ataque cuerpo a cuerpo, p.93): los dados de enfrente son los que
   * el defensor gastó en defenderse, no una dificultad que puso nadie. Sin la marca se mantiene lo de
   * siempre, que es lo cierto para una tirada de ficha: su oposición es la dificultad de un reto.
   */
  const opposition = countOf(request, 'opposition');
  if (o.conflict) {
    // Defenderse con 0 dados es una respuesta —«no me defiendo»— y tiene que contarse: sin esta línea,
    // un ataque sin oposición se lee igual que uno donde nadie llegó a contestar.
    head.push(line(opposition > 0
      ? fill(ts('roll.explain.conflict'), { n: opposition })
      : ts('roll.explain.conflictNone'), 'melee'));
  } else if (opposition > 0) {
    let challenge = fill(ts('roll.explain.challenge'), { n: opposition });
    if (o.ranged && o.range) challenge += fill(ts('roll.explain.range'), { range: lower(ts(`sheet.range.${o.range}`)) });
    head.push(line(challenge, o.ranged ? 'ranged' : 'difficulty'));
  }

  // ─── Lo que se aplicó ──────────────────────────────────────────────────────
  // La especialidad la decide el director al tirar, no se aplica sola (p.83). Sin el nombre guardado
  // no se pinta: decir «Especialidad — no aplicada» sin decir cuál no informa de nada.
  const specialties = Array.isArray(d['statSpecialties']) ? (d['statSpecialties'] as unknown[]).map(text).filter((x): x is string => !!x) : [];
  const specialtyId = specialties[0];
  const specialtyName = specialtyId ? specialtyById(specialtyId) : null;
  if (specialtyName) {
    const name = ts(specialtyName.label);
    applied.push(line(fill(ts(d['specialty'] === true ? 'roll.explain.specialtyOn' : 'roll.explain.specialtyOff'), { name }), 'specialty'));
  }

  // El arma: a distancia es un reto contra la dificultad del alcance y NO suma dados; cuerpo a cuerpo
  // sí suma su bonificación (p.96–97). Son dos reglas distintas y el jugador sólo ve el resultado.
  if (o.weaponId) {
    if (o.ranged) applied.push(line(ts('roll.explain.weaponRanged'), 'ranged'));
    else if (num(o.bonusDice) > 0) applied.push(line(fill(ts('roll.explain.weaponMelee'), { n: num(o.bonusDice) }), 'weapons'));
  }

  // La armadura sólo entra si salió algún fracaso (p.98); si no salió, entra y no hace nada, y eso
  // también hay que contarlo — es la diferencia entre «no llevaba» y «no hizo falta».
  if (num(o.armourPenalty) > 0) {
    const worn = text(d['armour']);
    const item = worn ? armourById(worn) : null;
    const name = item ? ts(item.label) : ts('sheet.armour.worn');
    const converted = num(d['armourConverted']);
    applied.push(line(converted > 0
      ? fill(ts(converted === 1 ? 'roll.explain.armourOn' : 'roll.explain.armourOnMany'), { armour: name, n: converted })
      : fill(ts('roll.explain.armourOff'), { armour: name }), 'armours'));
  }

  if (o.giftId) applied.push(line(fill(ts('roll.explain.gift'), { name: ts(`catalog.gifts.${o.giftId}.name`) }), 'gifts'));

  /**
   * Los éxitos automáticos de una capacidad (p.107–108). No son dados, así que no salen arriba con el puñado:
   * salen aquí, con lo que se aplicó, y con el nombre de la capacidad cuando la tirada lo guardó. Sin nombre
   * se dice el número igualmente: un acierto que no viene de ningún dado tiene que estar contado en alguna parte.
   */
  const auto = num(d['autoSuccesses'], num(o.autoSuccesses));
  if (auto > 0) {
    const from = o.autoSuccessFrom;
    applied.push(line(from
      ? fill(ts(auto === 1 ? 'roll.explain.capabilityOne' : 'roll.explain.capability'), { name: ts(`catalog.capabilities.${from}.name`), n: auto })
      : fill(ts(auto === 1 ? 'roll.explain.autoSuccess' : 'roll.explain.autoSuccesses'), { n: auto }), 'bestiary'));
  }

  // ─── El cierre (p.85) ──────────────────────────────────────────────────────
  const hits = num(d['ownHits']) + num(d['destinyHits']);
  const difference = num(d['difference'], NaN);
  if (Number.isNaN(difference)) return { head, applied };
  const degree = difference === 0
    ? ts('roll.explain.degree.ambiguous')
    : fill(ts(difference > 0 ? 'roll.explain.degree.success' : 'roll.explain.degree.failure'), { n: Math.abs(difference) });
  const verdict = fill(ts(o.conflict ? 'roll.explain.verdictConflict' : 'roll.explain.verdict'), {
    own: fill(ts(hits === 1 ? 'roll.explain.hit' : 'roll.explain.hits'), { n: hits }),
    opp: num(d['oppositionHits']),
    degree,
  });
  return { head, applied, verdict };
}
