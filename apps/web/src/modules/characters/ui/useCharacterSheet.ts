import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameSystem, SheetData, SheetPatch } from '@rolvium/core';
import { systemRegistry } from '@/systems/registry';
import type { Character, CharacterPatch, WriteOrigin } from '../domain/entities/Character';
import type { CharactersPort } from '../domain/ports/CharactersPort';

export type SheetStatus = 'loading' | 'ready' | 'not_found' | 'system_not_installed' | 'error';
export const AUTOSAVE_MS = 700;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** Row-level columns mirrored from the sheet data (name/concept/health/xp are materialised for the table). */
export function rowPatchFor(system: GameSystem, data: SheetData, before: Character): CharacterPatch {
  const patch: CharacterPatch = { data, derived: system.engine.derived(data), health: str(data.health) ?? before.health };
  const name = str(data.name)?.trim(); if (name && name !== before.name) patch.name = name;
  const concept = str(data.concept); if (concept !== null && concept !== (before.concept ?? '')) patch.concept = concept;
  const xp = num(data.xp); if (xp !== null && xp !== before.xp) patch.xp = xp;
  return patch;
}

/**
 * Loads a character + its game system, keeps a local draft of `data`, autosaves
 * edits (debounced) through the repo tagging the audit origin. Shared by the
 * separate sheet page and the table's Ficha tab.
 */
export function useCharacterSheet(id: string | null, repo: CharactersPort, autosaveMs = AUTOSAVE_MS) {
  const [character, setCharacter] = useState<Character | null>(null);
  const [system, setSystem] = useState<GameSystem | null>(null);
  const [status, setStatus] = useState<SheetStatus>('loading');
  const [data, setData] = useState<SheetData>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const pending = useRef<{ data: SheetData; origin: WriteOrigin } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!id) { setStatus('not_found'); return; }
    setStatus('loading');
    try {
      const c = await repo.getById(id);
      if (!c) { setStatus('not_found'); return; }
      setCharacter(c); setData(c.data); setDirty(false);
      try { setSystem(await systemRegistry.load(c.systemId)); } catch { setStatus('system_not_installed'); return; }
      setStatus('ready');
    } catch { setStatus('error'); }
  }, [id, repo]);
  useEffect(() => { void load(); }, [load]);

  const flush = useCallback(async () => {
    const job = pending.current; pending.current = null;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (!job || !character || !system) return;
    setSaving(true);
    try {
      const patch = rowPatchFor(system, job.data, character);
      // Authoritative path: the API validates the sheet against the schema, recomputes derived/health and persists as the actor.
      const r = await repo.saveSheet(character.id, { ...patch, data: job.data }, job.origin);
      if ('error' in r) throw new Error(r.error);
      patch.derived = r.derived; patch.health = r.health;
      setCharacter(prev => (prev ? { ...prev, ...patch, data: job.data, derived: patch.derived ?? prev.derived, health: patch.health ?? prev.health, xp: patch.xp ?? prev.xp, name: patch.name ?? prev.name, concept: patch.concept ?? prev.concept } : prev));
      setDirty(false); setSaveError(false);
    } catch { setSaveError(true); }
    finally { setSaving(false); }
  }, [character, system, repo]);

  /** Applies a patch to the draft; `origin` tags the audit row. `immediate` skips the debounce (damage, roll effects). */
  const applyPatch = useCallback((patch: SheetPatch, origin: WriteOrigin = 'sheet', immediate = false) => {
    setData(prev => {
      const next = { ...prev, ...patch };
      pending.current = { data: next, origin };
      return next;
    });
    setDirty(true);
    if (timer.current) clearTimeout(timer.current);
    if (immediate) { timer.current = setTimeout(() => void flush(), 0); }
    else timer.current = setTimeout(() => void flush(), autosaveMs);
  }, [flush, autosaveMs]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const derived = useMemo(() => (system ? system.engine.derived(data) : {}), [system, data]);

  return useMemo(() => ({ character, system, status, data, derived, dirty, saving, saveError, applyPatch, save: flush, reload: load }),
    [character, system, status, data, derived, dirty, saving, saveError, applyPatch, flush, load]);
}
export type CharacterSheetState = ReturnType<typeof useCharacterSheet>;
