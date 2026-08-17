import type { SheetData } from '@rolvium/core';
import { apiFetch, ApiError } from '@/shared/lib/api';
import type { SheetSavePort, SheetSaveResult, SheetSaveError } from '../domain/ports/SheetSavePort';
import type { WriteOrigin } from '../domain/entities/Character';

/** `PUT /characters/:id/sheet` — server-side validation + derived + persistence as the actor. */
export class HttpSheetAdapter implements SheetSavePort {
  async save(characterId: string, data: SheetData, origin: WriteOrigin, xp?: number): Promise<SheetSaveResult | { error: SheetSaveError; issues?: { field: string; code: string }[] }> {
    try {
      return await apiFetch<SheetSaveResult>(`/characters/${encodeURIComponent(characterId)}/sheet`, { method: 'PUT', body: JSON.stringify({ data, origin, ...(xp !== undefined ? { xp } : {}) }) });
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'INVALID_SHEET') return { error: 'invalid_sheet' };
        if (e.status === 403) return { error: 'forbidden' };
        if (e.status === 404) return { error: 'not_found' };
      }
      return { error: 'unknown' };
    }
  }
}
