import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Drawing, NewDrawing, NewToken, NewWall, RowChange, Scene, Token, Wall } from '../domain/entities/Scene';
import type { MapsLiveEvent, MapsPort } from '../domain/ports/MapsPort';
import type { Point } from '../domain/useCases/mapRules';

export interface LiveDrag { tokenId: string; x: number; y: number }
export interface LivePin { x: number; y: number; by: string; at: number }

function applyChange<T extends { id: string }>(list: T[], c: RowChange<T>): T[] {
  if (c.type === 'DELETE') return list.filter(i => i.id !== c.id);
  if (!c.row) return list;
  const i = list.findIndex(x => x.id === c.id);
  if (i < 0) return [...list, c.row];
  const next = [...list]; next[i] = c.row; return next;
}

const DRAG_HZ_MS = 50; // ~20 Hz (specs/core/realtime: broadcast 20–30 Hz)

/**
 * Loads a scene's tokens/walls/drawings, follows the scene channel and exposes the actions the
 * canvas needs. Optimistic updates for what I change; realtime brings everyone else's.
 */
export function useScene(repo: MapsPort, scene: Scene | null, me: string) {
  const sceneId = scene?.id ?? null;
  const [tokens, setTokens] = useState<Token[]>([]);
  const [walls, setWalls] = useState<Wall[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [live, setLive] = useState<Scene | null>(scene);
  const [drags, setDrags] = useState<Record<string, LiveDrag>>({});
  const [pin, setPin] = useState<LivePin | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const lastSent = useRef(0);

  useEffect(() => { setLive(scene); }, [scene]);

  useEffect(() => {
    if (!sceneId) { setTokens([]); setWalls([]); setDrawings([]); setStatus('ready'); return; }
    let alive = true;
    setStatus('loading');
    void Promise.all([repo.listTokens(sceneId), repo.listWalls(sceneId), repo.listDrawings(sceneId)])
      .then(([t, w, d]) => { if (!alive) return; setTokens(t); setWalls(w); setDrawings(d); setStatus('ready'); })
      .catch(() => { if (alive) setStatus('error'); });
    const off = repo.subscribe(sceneId, {
      onScene: c => { if (c.type === 'DELETE') setLive(null); else if (c.row) setLive(c.row); },
      onToken: c => { setTokens(l => applyChange(l, c)); if (c.type !== 'INSERT') setDrags(d => { if (!d[c.id]) return d; const n = { ...d }; delete n[c.id]; return n; }); },
      onWall: c => setWalls(l => applyChange(l, c)),
      onDrawing: c => setDrawings(l => applyChange(l, c)),
      onEvent: (e: MapsLiveEvent) => {
        if (e.type === 'token.moved') {
          if (e.final) setDrags(d => { const n = { ...d }; delete n[e.tokenId]; return n; });
          else setDrags(d => ({ ...d, [e.tokenId]: { tokenId: e.tokenId, x: e.x, y: e.y } }));
        } else if (e.type === 'pin.focused' && e.by !== me) setPin({ x: e.x, y: e.y, by: e.by, at: Date.now() });
      },
    });
    return () => { alive = false; off(); setDrags({}); setPin(null); };
  }, [repo, sceneId, me]);

  const dragToken = useCallback((tokenId: string, x: number, y: number) => {
    if (!sceneId || !live) return;
    const now = Date.now();
    if (now - lastSent.current < DRAG_HZ_MS) return;
    lastSent.current = now;
    repo.broadcast(sceneId, { type: 'token.moved', campaignId: live.campaignId, sceneId, tokenId, x, y, final: false });
  }, [repo, sceneId, live]);

  const moveToken = useCallback(async (tokenId: string, x: number, y: number) => {
    if (!sceneId || !live) return;
    setTokens(l => l.map(t => (t.id === tokenId ? { ...t, x, y } : t)));
    repo.broadcast(sceneId, { type: 'token.moved', campaignId: live.campaignId, sceneId, tokenId, x, y, final: true });
    await repo.updateToken(tokenId, { x, y });
  }, [repo, sceneId, live]);

  const addToken = useCallback(async (t: NewToken) => { const created = await repo.addToken(t); setTokens(l => (l.some(x => x.id === created.id) ? l : [...l, created])); return created; }, [repo]);
  const removeToken = useCallback(async (id: string) => { setTokens(l => l.filter(t => t.id !== id)); await repo.removeToken(id); }, [repo]);
  const patchToken = useCallback(async (id: string, patch: Partial<Token>) => { setTokens(l => l.map(t => (t.id === id ? { ...t, ...patch } : t))); await repo.updateToken(id, patch); }, [repo]);
  const addDrawing = useCallback(async (d: NewDrawing) => { const created = await repo.addDrawing(d); setDrawings(l => (l.some(x => x.id === created.id) ? l : [...l, created])); return created; }, [repo]);
  const eraseDrawing = useCallback(async (id: string) => { setDrawings(l => l.filter(d => d.id !== id)); await repo.removeDrawing(id); }, [repo]);
  const clearMine = useCallback(async () => { if (!sceneId) return; setDrawings(l => l.filter(d => d.authorId !== me)); await repo.removeMyDrawings(sceneId); }, [repo, sceneId, me]);
  const clearAll = useCallback(async () => { if (!sceneId) return; setDrawings([]); await repo.removeAllDrawings(sceneId); }, [repo, sceneId]);
  const addWall = useCallback(async (w: NewWall) => { const created = await repo.addWall(w); setWalls(l => (l.some(x => x.id === created.id) ? l : [...l, created])); return created; }, [repo]);
  const removeWall = useCallback(async (id: string) => { setWalls(l => l.filter(w => w.id !== id)); await repo.removeWall(id); }, [repo]);
  const focusPin = useCallback((p: Point) => {
    if (!sceneId || !live) return;
    repo.broadcast(sceneId, { type: 'pin.focused', campaignId: live.campaignId, sceneId, x: p.x, y: p.y, by: me });
    setPin({ x: p.x, y: p.y, by: me, at: Date.now() });
  }, [repo, sceneId, live, me]);

  return useMemo(() => ({
    scene: live, tokens, walls, drawings, drags, pin, status,
    dragToken, moveToken, addToken, removeToken, patchToken, addDrawing, eraseDrawing, clearMine, clearAll, addWall, removeWall, focusPin,
  }), [live, tokens, walls, drawings, drags, pin, status, dragToken, moveToken, addToken, removeToken, patchToken, addDrawing, eraseDrawing, clearMine, clearAll, addWall, removeWall, focusPin]);
}
export type SceneState = ReturnType<typeof useScene>;
