import type { DiceGroup, RollRequest, RollVisibility } from '@rolvium/core';
import type { Roll } from '../entities/Roll';

/** The free roller's dice, in the order of the design (rolvium.pen PL/Lanzador flotante). Icons: Material Symbols. */
export interface DieKind { id: string; sides: number; icon: string; tag?: string; label: string }
export const DIE_KINDS: readonly DieKind[] = [
  { id: 'd4', sides: 4, icon: 'change_history', label: 'D4' },
  { id: 'd6', sides: 6, icon: 'square', label: 'D6' },
  { id: 'd8', sides: 8, icon: 'diamond', label: 'D8' },
  { id: 'd10', sides: 10, icon: 'pentagon', label: 'D10' },
  { id: 'd12', sides: 12, icon: 'hexagon', label: 'D12' },
  { id: 'd20', sides: 20, icon: 'deployed_code', label: 'D20' },
  { id: 'd100', sides: 100, icon: 'hexagon', label: 'D100' },
  /** Fudge/Fate: three faces mapped by the server to −1 / 0 / +1. */
  { id: 'fudge', sides: 3, icon: 'add_box', tag: 'fudge', label: 'FUDGE' },
];
export const MAX_FREE_DICE = 6;
export const MODIFIER_RANGE = { min: -20, max: 20 } as const;

/** Notation of a free roll: `2D10`, `4DF`, with the modifier when non-zero (`2D10+3`). */
export function notationOf(groups: DiceGroup[], modifier = 0): string {
  const g = groups.map(x => `${x.count}${x.tag === 'fudge' ? 'DF' : `D${x.sides}`}`).join(' + ');
  return modifier ? `${g}${modifier > 0 ? '+' : '−'}${Math.abs(modifier)}` : g;
}

/** Builds the free-roll intention for the API (system null, no character). */
export function freeRollRequest(die: DieKind, count: number, modifier: number, visibility: RollVisibility): RollRequest {
  const n = Math.max(1, Math.min(MAX_FREE_DICE, Math.floor(count)));
  const group: DiceGroup = { count: n, sides: die.sides, ...(die.tag ? { tag: die.tag } : {}) };
  const mod = Math.max(MODIFIER_RANGE.min, Math.min(MODIFIER_RANGE.max, Math.trunc(modifier)));
  return { systemId: null, kind: 'free', title: notationOf([group], mod), groups: [group], visibility, ...(mod ? { modifier: mod } : {}) };
}

export type DieTone = 'triumph' | 'fumble' | 'plain';
/** System-agnostic die emphasis: the top face is a triumph, a 1 is a fumble. Fudge: + / −. */
export function dieTone(value: number, sides: number, tag?: string): DieTone {
  if (tag === 'fudge') return value === 3 ? 'triumph' : value === 1 ? 'fumble' : 'plain';
  if (sides <= 1) return 'plain';
  return value >= sides ? 'triumph' : value === 1 ? 'fumble' : 'plain';
}
/** Face label: Fudge shows + / 0 / −. */
export function dieFace(value: number, tag?: string): string {
  if (tag === 'fudge') return value === 3 ? '+' : value === 1 ? '−' : '0';
  return String(value);
}

export interface RollDie { value: number; sides: number; tag?: string; tone: DieTone; face: string; shared: boolean }
export interface RollNotice { text: string; tone: 'gold' | 'blood' }
export interface RollDescription {
  title: string;
  /** Right-hand figure: «7—1» (own hits vs opposition) for opposed system rolls, or the total. */
  score: string | null;
  /** Human verdict (system summary in the viewer's language); null for free rolls. */
  degree: string | null;
  own: RollDie[];
  opposition: RollDie[];
  notices: RollNotice[];
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const OPPOSITION_TAG = 'opposition';
/** Tags of dice that came from a shared pool (gold border in the log). */
const isSharedTag = (roll: Roll, tag: string | undefined): boolean => !!tag && !!roll.request.sharedResources && tag in roll.request.sharedResources;

/**
 * Turns a persisted roll into the lines the Registro shows. Platform strings via `t`; system texts via `ts`
 * (`result.summary` and `roll.effects.<key>` are keys of the system's locales).
 */
export function describeRoll(roll: Roll, t: (key: string, params?: Record<string, string>) => string, ts: (key: string) => string): RollDescription {
  const dice = (pred: (g: DiceGroup) => boolean): RollDie[] => roll.request.groups.flatMap((g, i) => pred(g)
    ? (roll.dice[i] ?? []).map(v => ({ value: v, sides: g.sides, ...(g.tag ? { tag: g.tag } : {}), tone: dieTone(v, g.sides, g.tag), face: dieFace(v, g.tag), shared: isSharedTag(roll, g.tag) }))
    : []);
  const own = dice(g => g.tag !== OPPOSITION_TAG);
  const opposition = dice(g => g.tag === OPPOSITION_TAG);
  if (roll.kind === 'free') {
    const notation = notationOf(roll.request.groups, roll.request.modifier ?? 0);
    const who = roll.authorName?.trim();
    return { title: who ? t('dice.log.freeTitle', { notation, who }) : notation, score: isNum(roll.result.total) ? String(roll.result.total) : null, degree: null, own, opposition, notices: [] };
  }
  const d = roll.result.detail ?? {};
  const hits = isNum(d['ownHits']) ? d['ownHits'] + (isNum(d['destinyHits']) ? d['destinyHits'] : 0) : null;
  const score = hits !== null && isNum(d['oppositionHits']) ? `${hits}—${d['oppositionHits']}` : isNum(roll.result.total) ? String(roll.result.total) : null;
  const notices: RollNotice[] = Object.entries(roll.result.effects ?? {})
    .filter(([, v]) => v === true)
    .map(([k]) => ({ key: k, text: ts(`roll.effects.${k}`) }))
    .filter(x => x.text !== `roll.effects.${x.key}`)
    .map(x => ({ text: x.text, tone: /setback|fumble|fail|revés/i.test(x.key) ? 'blood' : 'gold' }));
  return { title: ts(roll.title), score, degree: ts(roll.result.summary), own, opposition, notices };
}
