import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GameSystem } from '@rolvium/core';
import { systemRegistry } from '@/systems/registry';
import type { TablePort } from '../domain/ports/TablePort';
import type { TableSnapshot } from '../domain/entities/Table';

export type TableStatus = 'loading' | 'ready' | 'not_member' | 'system_not_installed' | 'error';

/** Loads the campaign, its game system and keeps the snapshot live. */
export function useTable(campaignId: string, repo: TablePort) {
  const [snap, setSnap] = useState<TableSnapshot | null>(null);
  const [system, setSystem] = useState<GameSystem | null>(null);
  const [status, setStatus] = useState<TableStatus>('loading');

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    void (async () => {
      try {
        const s = await repo.load(campaignId);
        if (!alive) return;
        if (!s) { setStatus('not_member'); return; }
        setSnap(s);
        try { setSystem(await systemRegistry.load(s.campaign.systemId)); }
        catch { setStatus('system_not_installed'); return; }
        if (alive) setStatus('ready');
      } catch { if (alive) setStatus('error'); }
    })();
    return () => { alive = false; };
  }, [campaignId, repo]);

  useEffect(() => {
    if (status !== 'ready') return;
    return repo.subscribe(campaignId, partial => setSnap(prev => prev ? { ...prev, ...partial } : prev));
  }, [campaignId, repo, status]);

  const patchResources = useCallback((rid: string, state: TableSnapshot['resources'][string]) => {
    setSnap(prev => prev ? { ...prev, resources: { ...prev.resources, [rid]: state } } : prev);
  }, []);

  return useMemo(() => ({ snap, system, status, patchResources }), [snap, system, status, patchResources]);
}
