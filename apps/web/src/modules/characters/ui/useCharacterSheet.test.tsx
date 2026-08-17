import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { plenilunio } from '@rolvium/system-plenilunio';
import { fakeCharactersRepo, CHARACTER_KAREN } from '../../../../tests/helpers/fakes';
import { rowPatchFor, useCharacterSheet } from './useCharacterSheet';

describe('useCharacterSheet', () => {
  it('loads character + system, applies patches with derived recompute and autosaves tagging the origin', async () => {
    const repo = fakeCharactersRepo();
    const { result } = renderHook(() => useCharacterSheet('ch-karen', repo, 10));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.system?.id).toBe('plenilunio');
    expect(result.current.derived.endurance).toBe(7);
    act(() => result.current.applyPatch({ fortitude: { value: 5, specialties: [] } }, 'sheet'));
    expect(result.current.dirty).toBe(true);
    expect(result.current.derived.endurance).toBe(8);
    await waitFor(() => expect(repo.updates.length).toBe(1));
    expect(repo.updates[0]!.origin).toBe('sheet');
    expect(repo.updates[0]!.patch.derived).toMatchObject({ endurance: 8, resistanceMax: 24 });
    await waitFor(() => expect(result.current.dirty).toBe(false));
    // immediate flush (damage) + row columns mirrored (health/xp/name)
    act(() => result.current.applyPatch({ health: 'wounded', xp: 30, name: 'Karen' }, 'damage', true));
    await waitFor(() => expect(repo.updates.length).toBe(2));
    expect(repo.updates[1]).toMatchObject({ origin: 'damage', patch: { health: 'wounded', xp: 30, name: 'Karen' } });
  });
  it('reports not_found / error / save failure', async () => {
    const repo = fakeCharactersRepo();
    const nf = renderHook(() => useCharacterSheet('nope', repo, 10));
    await waitFor(() => expect(nf.result.current.status).toBe('not_found'));
    const none = renderHook(() => useCharacterSheet(null, repo, 10));
    await waitFor(() => expect(none.result.current.status).toBe('not_found'));
    const bad = fakeCharactersRepo(); bad.getById = async () => { throw new Error('x'); };
    const er = renderHook(() => useCharacterSheet('ch-karen', bad, 10));
    await waitFor(() => expect(er.result.current.status).toBe('error'));
    const failing = fakeCharactersRepo(); failing.saveSheet = async () => ({ error: 'unknown' });
    const f = renderHook(() => useCharacterSheet('ch-karen', failing, 10));
    await waitFor(() => expect(f.result.current.status).toBe('ready'));
    act(() => f.result.current.applyPatch({ concept: 'x' }, 'sheet', true));
    await waitFor(() => expect(f.result.current.saveError).toBe(true));
  });
  it('applyRemote merges a server-applied change into draft + character without saving or dirtying', async () => {
    const repo = fakeCharactersRepo();
    const { result } = renderHook(() => useCharacterSheet('ch-karen', repo, 10));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.applyRemote({ destiny: 3, fortune: 3 }, { derived: { endurance: 42 }, health: 'bruised' }));
    expect(result.current.data.destiny).toBe(3);
    expect(result.current.character?.data.fortune).toBe(3);
    expect(result.current.character?.derived.endurance).toBe(42);
    expect(result.current.character?.health).toBe('bruised');
    expect(result.current.dirty).toBe(false);
    await new Promise(r => setTimeout(r, 30));
    expect(repo.updates).toHaveLength(0);
  });
  it('rowPatchFor mirrors only changed row columns', () => {
    const p = rowPatchFor(plenilunio, { ...CHARACTER_KAREN.data, concept: 'Nueva' }, CHARACTER_KAREN);
    expect(p.concept).toBe('Nueva'); expect(p.name).toBeUndefined(); expect(p.xp).toBeUndefined(); expect(p.health).toBe('healthy');
  });
});
