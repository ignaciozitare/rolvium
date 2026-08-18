import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { CatalogItem, GameSystem } from '@rolvium/core';
import { UserAvatar } from '@rolvium/ui';
import type { CampaignMember, TableRole } from '@/modules/campaigns/domain/entities/Campaign';
import type { Character } from '@/modules/characters/domain/entities/Character';
import type { CharactersPort } from '@/modules/characters/domain/ports/CharactersPort';
import { characterAvatar } from '@/modules/characters/domain/useCases/characterRules';
import { sysT } from '@/modules/characters/domain/useCases/systemText';
import type { ImageAsset, Scene, ScenePatch } from '../domain/entities/Scene';
import type { MapsPort } from '../domain/ports/MapsPort';
import { canvasToScene, centerOn, fitView, tokenCellAt, tokenFromBestiary, tokenFromCharacter, ZOOM_STEP, zoomAt, type Point, type Tool, type View } from '../domain/useCases/mapRules';
import { mapsRepo } from '../container';
import { useScene } from './useScene';
import { MapCanvas, type StrokeStyle } from './MapCanvas';
import { Toolbar } from './Toolbar';
import { StrokeBar } from './StrokeBar';
import { CanvasControls } from './CanvasControls';
import { ScenesMenu } from './ScenesMenu';
import { BackgroundPopover } from './BackgroundPopover';
import { EncounterMenu } from './EncounterMenu';
import './maps.css';

interface Props {
  campaignId: string;
  role: TableRole;
  userId: string;
  system: GameSystem;
  members: CampaignMember[];
  /** From the table snapshot (live). Players see this scene; the DM starts on it. */
  activeSceneId: string | null;
  charactersRepo: CharactersPort;
  repo?: MapsPort;
}

const DEFAULT_STROKE: StrokeStyle = { color: '#c9a84c', width: 2 };

/** «Escena» tab: the DM prepares (scenes · background · walls · encounters), everyone plays on top (rolvium.pen Mesa/Escena). */
export function SceneTab({ campaignId, role, userId, system, members, activeSceneId, charactersRepo, repo = mapsRepo }: Props): JSX.Element {
  const { t, locale } = useTranslation();
  const isDm = role === 'dm';
  const ts = useMemo(() => sysT(system, locale), [system, locale]);
  const [scenes, setScenes] = useState<Scene[] | null>(null);
  const [playerScene, setPlayerScene] = useState<Scene | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [images, setImages] = useState<ImageAsset[] | null>(null);
  const [pcs, setPcs] = useState<Character[] | null>(null);
  const [tool, setTool] = useState<Tool>('move');
  const [stroke, setStroke] = useState<StrokeStyle>(DEFAULT_STROKE);
  const [view, setView] = useState<View>({ zoom: 1, panX: 0, panY: 0 });
  const [showWalls, setShowWalls] = useState(true);
  const [playerView, setPlayerView] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  const [encounter, setEncounter] = useState<CatalogItem | null>(null);
  const [pcMenu, setPcMenu] = useState(false);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // ── load: DM lists; player follows the active scene ──
  useEffect(() => {
    let alive = true;
    setStatus('loading');
    if (isDm) {
      void repo.listScenes(campaignId).then(l => { if (!alive) return; setScenes(l); setSelectedId(cur => cur && l.some(s => s.id === cur) ? cur : (l.find(s => s.id === activeSceneId)?.id ?? l[0]?.id ?? null)); setStatus('ready'); }).catch(() => { if (alive) setStatus('error'); });
    } else if (activeSceneId) {
      void repo.getScene(activeSceneId).then(s => { if (!alive) return; setPlayerScene(s); setStatus('ready'); }).catch(() => { if (alive) setStatus('error'); });
    } else { setPlayerScene(null); setStatus('ready'); }
    return () => { alive = false; };
  }, [repo, campaignId, isDm, activeSceneId]);

  const scene = isDm ? scenes?.find(s => s.id === selectedId) ?? null : playerScene;
  const st = useScene(repo, scene, userId);
  const live = st.scene;
  const viewport = () => ({ width: stageRef.current?.clientWidth ?? 0, height: stageRef.current?.clientHeight ?? 0 });
  const viewCenter = (): Point => { const vp = viewport(); return { x: vp.width / 2, y: vp.height / 2 }; };

  useEffect(() => { if (live) setView(fitView(live, viewport())); setSelectedTokenId(null); setEncounter(null); }, [live?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (st.pin && st.pin.by !== userId) setView(v => centerOn(v, st.pin!, viewport())); }, [st.pin, userId]);
  useEffect(() => { if (tool !== 'encounter') setEncounter(null); }, [tool]);

  const nameOf = useCallback((uid: string) => members.find(m => m.userId === uid)?.name ?? uid, [members]);
  const patchScene = useCallback(async (id: string, patch: ScenePatch) => {
    setScenes(l => l?.map(s => (s.id === id ? { ...s, ...patch } : s)) ?? l);
    await repo.updateScene(id, patch);
  }, [repo]);
  const openBg = async () => { setBgOpen(o => !o); if (images === null) setImages(await repo.listImages(campaignId).catch(() => [])); };
  const openPcMenu = async () => { setPcMenu(o => !o); if (pcs === null) setPcs((await charactersRepo.listByCampaign(campaignId).catch(() => [] as Character[])).filter(c => c.kind === 'pc')); };
  const centerCell = (): Point => {
    if (!live) return { x: 0, y: 0 };
    const vp = viewport();
    const c = vp.width && vp.height ? canvasToScene({ x: vp.width / 2, y: vp.height / 2 }, view) : { x: live.width / 2, y: live.height / 2 };
    return tokenCellAt(c, live.grid.size);
  };
  const placePc = async (c: Character) => {
    if (!live) return;
    setPcMenu(false);
    await st.addToken(tokenFromCharacter(c, members.find(m => m.userId === c.ownerId)?.avatarUrl, live.id, centerCell()));
  };
  const bestiary = system.catalogs['bestiary'] ?? [];
  const selectedToken = st.tokens.find(tk => tk.id === selectedTokenId) ?? null;

  if (status === 'loading') return <section className="tb-hoja tb-placeholder">{t('maps.loading')}</section>;
  if (status === 'error') return <section className="tb-hoja tb-placeholder">{t('maps.error')}</section>;

  const header = (
    <div className="mp-head">
      <div className="mp-head-l"><span className="tb-rotulo">{t('maps.scene')}</span><span className="mp-scene-name">{live?.name ?? '—'}</span></div>
      <div className="mp-head-r">
        {isDm && scenes && <ScenesMenu scenes={scenes} selectedId={selectedId} activeSceneId={activeSceneId} onSelect={setSelectedId}
          onCreate={async name => { const s = await repo.createScene({ campaignId, name, sortOrder: scenes.length }); setScenes(l => [...(l ?? []), s]); setSelectedId(s.id); }}
          onRename={(id, name) => patchScene(id, { name })}
          onActivate={id => repo.setActiveScene(campaignId, id)}
          onToggleVisible={(id, visiblePlayers) => patchScene(id, { visiblePlayers })}
          onRemove={async id => { await repo.removeScene(id); setScenes(l => { const n = (l ?? []).filter(s => s.id !== id); setSelectedId(cur => (cur === id ? n[0]?.id ?? null : cur)); return n; }); }} />}
        {isDm && live && <button type="button" className={`tb-btn ${bgOpen ? 'tb-btn-solid' : ''}`} aria-pressed={bgOpen} onClick={() => void openBg()}>{t('maps.bg.button')}</button>}
        {isDm && live && (
          <span className="mp-pcwrap">
            <button type="button" className={`tb-btn ${pcMenu ? 'tb-btn-solid' : ''}`} aria-pressed={pcMenu} onClick={() => void openPcMenu()}>{t('maps.place.pc')}</button>
            {pcMenu && (
              <div className="mp-pop mp-pcmenu" role="menu" aria-label={t('maps.place.pick')}>
                {pcs === null && <span className="tb-dim tb-italic">{t('common.loading')}</span>}
                {pcs?.length === 0 && <span className="tb-dim tb-italic">{t('characters.table.groupEmpty')}</span>}
                {pcs?.map(c => {
                  const placed = st.tokens.some(tk => tk.characterId === c.id);
                  return <button key={c.id} type="button" role="menuitem" className="mp-menu-item" disabled={placed} onClick={() => void placePc(c)}>
                    <UserAvatar user={{ name: c.name, avatarUrl: characterAvatar(c, members.find(m => m.userId === c.ownerId)?.avatarUrl) }} size={22} />{c.name}{placed && <span className="tb-dim"> · {t('maps.place.already')}</span>}
                  </button>;
                })}
              </div>
            )}
          </span>
        )}
        {!isDm && <span className="tb-italic tb-dim mp-note">{t('maps.dmDecides')}</span>}
      </div>
    </div>
  );

  if (!live) {
    return <section className="mp-root">{header}<div className="tb-hoja tb-placeholder"><span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-lg)' }}>map</span><p>{isDm ? t('maps.noScenesDm') : t('maps.noScene')}</p></div></section>;
  }

  const hiddenCount = st.tokens.filter(tk => !tk.visible).length;
  const bgName = live.bgImageUrl ? (images?.find(i => i.url === live.bgImageUrl)?.name ?? live.bgImageUrl.split('/').pop() ?? '') : t('maps.noBackground');
  return (
    <section className="mp-root">
      {header}
      <StrokeBar value={stroke} onChange={setStroke} onClearMine={() => void st.clearMine()} onClearAll={isDm ? () => void st.clearAll() : undefined} />
      <div className="mp-stage-row">
        <Toolbar tool={tool} isDm={isDm} onChange={setTool} />
        <div className="mp-stage" ref={stageRef}>
          <MapCanvas scene={live} tokens={st.tokens} walls={st.walls} drawings={st.drawings} drags={st.drags} pin={st.pin} tool={tool} stroke={stroke} me={userId} isDm={isDm}
            playerView={playerView} showWalls={showWalls} view={view} onViewChange={setView} nameOf={nameOf}
            onDragToken={st.dragToken} onMoveToken={(id, x, y) => void st.moveToken(id, x, y)}
            onAddDrawing={(kind, data) => void st.addDrawing({ sceneId: live.id, campaignId, kind, data, color: stroke.color, width: stroke.width })}
            onErase={id => void st.eraseDrawing(id)}
            onAddWall={(a, b) => void st.addWall({ sceneId: live.id, campaignId, x1: a.x, y1: a.y, x2: b.x, y2: b.y, visiblePlayers: false })}
            onPin={st.focusPin}
            onPlace={encounter ? cell => void st.addToken(tokenFromBestiary(encounter, ts(encounter.label), campaignId, live.id, cell)) : undefined}
            selectedTokenId={selectedTokenId} onSelectToken={setSelectedTokenId} />
          <span className="mp-canvas-label">{isDm && !playerView ? t('maps.dmView') : t('maps.playerVision', { name: live.name })}</span>
          {isDm && selectedToken && (
            <div className="mp-tokbar" role="toolbar" aria-label={t('maps.token.selected')}>
              <span className="mp-tokbar-name">{selectedToken.name}</span>
              <button type="button" className="tb-btn tb-btn-xs" onClick={() => void st.patchToken(selectedToken.id, { visible: !selectedToken.visible })}>{selectedToken.visible ? t('maps.token.hide') : t('maps.token.show')}</button>
              <button type="button" className="tb-btn tb-btn-xs" onClick={() => { void st.removeToken(selectedToken.id); setSelectedTokenId(null); }}>{t('maps.token.remove')}</button>
            </div>
          )}
          {isDm && tool === 'encounter' && (
            <EncounterMenu entries={bestiary} labelOf={e => ts(e.label)} selectedId={encounter?.id ?? null} onSelect={setEncounter} onClose={() => setTool('move')} />
          )}
          {isDm && bgOpen && (
            <BackgroundPopover scene={live} images={images}
              onColor={hex => void patchScene(live.id, { bgColor: hex })}
              onImage={url => void patchScene(live.id, { bgImageUrl: url })}
              onTransform={tr => void patchScene(live.id, { bgTransform: tr })}
              onUpload={async f => { const img = await repo.uploadImage(campaignId, f, f.name.replace(/\.[^.]+$/, '')); setImages(l => [img, ...(l ?? [])]); await patchScene(live.id, { bgImageUrl: img.url }); }}
              onClose={() => setBgOpen(false)} />
          )}
          <CanvasControls isDm={isDm} showWalls={showWalls} playerView={playerView}
            onZoomIn={() => setView(v => zoomAt(v, ZOOM_STEP, viewCenter()))} onZoomOut={() => setView(v => zoomAt(v, 1 / ZOOM_STEP, viewCenter()))}
            onCenter={() => setView(fitView(live, viewport()))} onToggleWalls={() => setShowWalls(w => !w)} onTogglePlayerView={() => setPlayerView(v => !v)} />
        </div>
      </div>
      <p className="mp-foot tb-italic tb-dim">
        {isDm
          ? <><span className="mp-dm-tag">{t('maps.dmOnly')}</span> {t('maps.fogSoon')} · {t('maps.dmFoot', { walls: String(st.walls.length), hidden: String(hiddenCount), bg: bgName })}</>
          : t('maps.playerFoot')}
      </p>
    </section>
  );
}
