// ─── Rule references · Malefic Time: Plenilunio ──────────────────────────────
// key → { page, title, summary }. Pages point to the printed manual (NoSoloRol);
// title/summary are i18n keys of this package whose texts are our own
// paraphrases (never manual text). Used by tooltips: "<summary> · Manual p.XX".
import type { References, RuleReference } from '@rolvium/core';

const ref = (key: string, page: number): [string, RuleReference] => [key, { page, title: `ref.${key}.title`, summary: `ref.${key}.summary` }];

/** Manual pages as listed in the validated prototype (REFERENCIAS) plus sizes (p.25) and damage (p.98). */
export const references: References = Object.fromEntries([
  ref('stats', 20),
  ref('specialty', 85),
  ref('roll', 84),
  ref('degree', 87),
  ref('setback', 88),
  ref('destinyPool', 90),
  ref('destiny', 90),
  ref('fortune', 90),
  ref('endurance', 98),
  ref('resistance', 98),
  ref('health', 98),
  ref('damage', 98),
  ref('weapons', 97),
  ref('armours', 98),
  ref('gifts', 104),
  ref('xp', 91),
  ref('size', 25),
]);

export const REFERENCE_KEYS = Object.keys(references);
