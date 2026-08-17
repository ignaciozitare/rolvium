import type { FieldDef, SheetData, SheetSchema } from './gameSystem';

export interface SheetIssue { field: string; code: 'type' | 'min' | 'max' | 'option' | 'unknown'; }

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function checkField(f: FieldDef, v: unknown, path: string, out: SheetIssue[]): void {
  if (v === undefined || v === null) return; // missing = default
  switch (f.type) {
    case 'text': case 'longtext': case 'image': case 'health':
      if (typeof v !== 'string') out.push({ field: path, code: 'type' }); break;
    case 'number': case 'counter': case 'boxes':
      if (!isNum(v)) { out.push({ field: path, code: 'type' }); break; }
      if (f.min !== undefined && v < f.min) out.push({ field: path, code: 'min' });
      if (f.max !== undefined && v > f.max) out.push({ field: path, code: 'max' });
      break;
    case 'select':
      if (typeof v !== 'string') out.push({ field: path, code: 'type' });
      else if (f.options && !f.options.some(o => o.value === v)) out.push({ field: path, code: 'option' });
      break;
    case 'stat': {
      // { value: number, specialties?: string[] } — value bounded by min/max
      if (typeof v !== 'object' || Array.isArray(v)) { out.push({ field: path, code: 'type' }); break; }
      const s = v as { value?: unknown; specialties?: unknown };
      if (!isNum(s.value)) out.push({ field: `${path}.value`, code: 'type' });
      else {
        if (f.min !== undefined && s.value < f.min) out.push({ field: `${path}.value`, code: 'min' });
        if (f.max !== undefined && s.value > f.max) out.push({ field: `${path}.value`, code: 'max' });
      }
      if (s.specialties !== undefined && !(Array.isArray(s.specialties) && s.specialties.every(x => typeof x === 'string'))) out.push({ field: `${path}.specialties`, code: 'type' });
      break;
    }
    case 'list': case 'table': {
      if (!Array.isArray(v)) { out.push({ field: path, code: 'type' }); break; }
      const cols = f.type === 'list' ? f.itemFields : f.columns;
      if (f.max !== undefined && v.length > f.max) out.push({ field: path, code: 'max' });
      v.forEach((item, i) => {
        if (typeof item !== 'object' || item === null) { out.push({ field: `${path}[${i}]`, code: 'type' }); return; }
        for (const c of cols ?? []) checkField(c, (item as Record<string, unknown>)[c.id], `${path}[${i}].${c.id}`, out);
      });
      break;
    }
  }
}

/**
 * Validates a sheet's stored data against its schema (types, ranges, select
 * options, list shapes). Derived fields are ignored (the engine owns them).
 * Unknown top-level keys are reported as `unknown` — the API rejects them so a
 * client cannot smuggle arbitrary payload into `characters.data`.
 */
export function validateSheet(schema: SheetSchema, data: SheetData): SheetIssue[] {
  const out: SheetIssue[] = [];
  const known = new Map<string, FieldDef>();
  for (const s of schema.sections) for (const f of s.fields) known.set(f.id, f);
  for (const [k, v] of Object.entries(data)) {
    const f = known.get(k);
    if (!f) { out.push({ field: k, code: 'unknown' }); continue; }
    if (f.derived) continue;
    checkField(f, v, k, out);
  }
  return out;
}
