// ─── Rule references · Malefic Time: Plenilunio ──────────────────────────────
// key → { page, title, summary }. Pages point to the printed manual (NoSoloRol);
// title/summary are i18n keys of this package whose texts are our own
// paraphrases (never manual text). Used by tooltips: "<summary> · Manual p.XX".
import type { References, RuleReference } from '@rolvium/core';

const ref = (key: string, page: number): [string, RuleReference] => [key, { page, title: `ref.${key}.title`, summary: `ref.${key}.summary` }];

/** Printed manual pages, verified against the book (see RULES.md §9). */
export const references: References = Object.fromEntries([
  ref('stats', 20),
  ref('specialty', 83),
  ref('roll', 82),
  ref('difficulty', 84),
  ref('degree', 85),
  ref('setback', 86),
  ref('destinyPool', 88),
  ref('destiny', 88),
  ref('fortune', 89),
  ref('endurance', 98),
  ref('resistance', 98),
  ref('health', 99),
  ref('damage', 97),
  ref('weapons', 97),
  ref('armours', 98),
  ref('recovery', 101),
  ref('gifts', 102),
  ref('xp', 91),
  ref('size', 25),
]);

export const REFERENCE_KEYS = Object.keys(references);
