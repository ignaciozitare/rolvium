import type { SheetData } from '@rolvium/core';
import type { WriteOrigin } from '../entities/Character';

export interface SheetSaveResult { derived: Record<string, unknown>; health: string | null }
export type SheetSaveError = 'invalid_sheet' | 'forbidden' | 'not_found' | 'unknown';

/** The authoritative save: the API validates the sheet against the system schema and recomputes derived/health. */
export interface SheetSavePort {
  save(characterId: string, data: SheetData, origin: WriteOrigin, xp?: number): Promise<SheetSaveResult | { error: SheetSaveError; issues?: { field: string; code: string }[] }>;
}
