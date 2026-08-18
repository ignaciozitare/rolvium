import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { CatalogItem, GameSystem } from '@rolvium/core';
import { UserAvatar, useDialog } from '@rolvium/ui';
import type { CampaignMember, TableRole } from '@/modules/campaigns/domain/entities/Campaign';
import type { Character } from '@/modules/characters/domain/entities/Character';
import type { CharactersPort } from '@/modules/characters/domain/ports/CharactersPort';
import { characterAvatar } from '@/modules/characters/domain/useCases/characterRules';
import { sysT } from '@/modules/characters/domain/useCases/systemText';
import type { ImageAsset, Scene, ScenePatch, Wall, WallKind } from '../domain/entities/Scene';
import type { MapsPort } from '../domain/ports/MapsPort';
import type { VisionPort } from '../domain/ports/VisionPort';
import { canvasToScene, centerOn, DEFAULT_BRUSH, fitView, isBrush, isDraw, newWallOf, WALL_FLAGS, STROKE_COLORS, tokenCellAt, tokenFromBestiary, tokenFromCharacter, ZOOM_STEP, zoomAt, type Point, type Tool, type View } from '../domain/useCases/mapRules';
import { mapsRepo, visionPort } from '../container';
import { useScene } from './useScene';
import { MapCanvas, type StrokeStyle } from './MapCanvas';
import { Toolbar } from './Toolbar';
import { StrokeBar } from './StrokeBar';
import { SegmentBar } from './SegmentBar';
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
  /** The dice roller belongs to H6 and is hosted by the table; the scene only owns the button that opens it. */
  onOpenDice?: () => void;
  diceOpen?: boolean;
  repo?: MapsPort;
  vision?: VisionPort;
}

/** Gold, the second swatch of the persisted stroke palette (mapRules.STROKE_COLORS). */
const DEFAULT_STROKE: StrokeStyle = { color: STROKE_COLORS[1], width: 2 };

/** «Escena» tab: the DM prepares (scenes · background · walls · encounters), everyone plays on top (rolvium.pen Mesa/Escena). */
export function SceneTab({ campaignId, role, userId, system, members, activeSceneId, charactersRepo, onOpenDice, diceOpen = false, repo = mapsRepo, vision = visionPort }: Props): JSX.Element {
  const { t, locale } = useTranslation();
  const dialog = useDialog();
  const isDm = role === 'dm';
  const ts = useMemo(() => sysT(system, locale), [system, locale]);
  const [scenes, setScenes] = useState<Scene[] | null>(null);
  const [playerScene, setPlayerScene] = useState<Scene | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  /** Mutations can be refused by RLS (e.g. someone else's token) or fail offline: surface it instead of swallowing. */
  const [failed, setFailed] = useState(false);
  const run = useCallback((p: Promise<unknown>) => { void p.then(() => setFailed(false)).catch(() => setFailed(true)); }, []);
  const [images, setImages] = useState<ImageAsset[] | null>(null);
  const [pcs, setPcs] = useState<Character[] | null>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [stroke, setStroke] = useState<StrokeStyle>(DEFAULT_STROKE);
  const [view, setView] = useState<View>({ zoom: 1, panX: 0, panY: 0 });
  const [showWalls, setShowWalls] = useState(true);
  const [playerView, setPlayerView] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  const [encounter, setEncounter] = useState<CatalogItem | null>(null);
  const [pcMenu, setPcMenu] = useState(false);
  const [pendingPc, setPendingPc] = useState<Character | null>(null);
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);
  const [brush, setBrush] = useState<number>(DEFAULT_BRUSH);
  const [wallKind, setWallKind] = useState<WallKind>('wall');
  const [railFolded, setRailFolded] = useState(false);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [quickMenu, setQuickMenu] = useState<{ at: Point; scene: Point } | null>(null);
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
  const st = useScene(repo, scene, userId, vision);
  const live = st.scene;
  const viewport = () => ({ width: stageRef.current?.clientWidth ?? 0, height: stageRef.current?.clientHeight ?? 0 });
  const viewCenter = (): Point => { const vp = viewport(); return { x: vp.width / 2, y: vp.height / 2 }; };

  useEffect(() => { if (live) setView(fitView(live, viewport())); setSelectedTokenIds([]); setEncounter(null); }, [live?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Whoever accepts the pin centres on it — including the one who dropped it, which is what «enfoque» means.
  useEffect(() => { if (st.pin) setView(v => centerOn(v, st.pin!, viewport())); }, [st.pin]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tool !== 'encounter') setEncounter(null); }, [tool]);
  useEffect(() => { if (live) { setPendingPc(null); setPcMenu(false); } }, [live?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
  /** Same gesture as «Encuentro»: pick who, then click where. Placing blind in the middle of the view was a guess. */
  const pickPc = (c: Character) => { setPendingPc(c); setPcMenu(false); };
  const placePcAt = async (c: Character, cell: Point) => {
    if (!live) return;
    setPendingPc(null);
    await st.addToken(tokenFromCharacter(c, members.find(m => m.userId === c.ownerId)?.avatarUrl, live.id, cell));
  };
  const bestiary = system.catalogs['bestiary'] ?? [];
  const selectedTokens = st.tokens.filter(tk => selectedTokenIds.includes(tk.id));
  const selectedToken = selectedTokens.length === 1 ? selectedTokens[0]! : null;
  const selectedWall = st.walls.find(w => w.id === selectedWallId) ?? null;

  if (status === 'loading') return <section className="tb-hoja tb-placeholder">{t('maps.loading')}</section>;
  if (status === 'error') return <section className="tb-hoja tb-placeholder">{t('maps.error')}</section>;

  const scenesRail = isDm && scenes && live ? (
    <ScenesMenu scenes={scenes} selectedId={selectedId} activeSceneId={activeSceneId} onSelect={setSelectedId}
      collapsed={railFolded} onToggleCollapsed={() => setRailFolded(f => !f)}
      onCreate={async name => { const sc = await repo.createScene({ campaignId, name, sortOrder: scenes.length }); setScenes(l => [...(l ?? []), sc]); setSelectedId(sc.id); }}
      onRename={(id, name) => patchScene(id, { name })}
      onActivate={id => repo.setActiveScene(campaignId, id)}
      onToggleVisible={(id, visiblePlayers) => patchScene(id, { visiblePlayers })}
      onRemove={async id => { await repo.removeScene(id); setScenes(l => { const n = (l ?? []).filter(sc => sc.id !== id); setSelectedId(cur => (cur === id ? n[0]?.id ?? null : cur)); return n; }); }} />
  ) : null;

  if (!live) {
    return <section className="mp-root"><div className="tb-hoja tb-placeholder"><span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-lg)' }}>map</span><p>{isDm ? t('maps.noScenesDm') : t('maps.noScene')}</p></div></section>;
  }

  const hiddenCount = st.tokens.filter(tk => !tk.visible).length;
  const bgName = live.bgImageUrl ? (images?.find(i => i.url === live.bgImageUrl)?.name ?? live.bgImageUrl.split('/').pop() ?? '') : t('maps.noBackground');
  return (
    <section className="mp-root">
      <div className="mp-stage-row">
        {scenesRail}
        <Toolbar tool={tool} isDm={isDm} onChange={setTool}
          onDice={() => onOpenDice?.()} diceOpen={diceOpen}
          {...(isDm ? { onPlacePc: () => void openPcMenu(), placePcOpen: pcMenu, onBackground: () => void openBg(), backgroundOpen: bgOpen } : {})} />
        <div className="mp-stage" ref={stageRef}>
          <MapCanvas scene={live} tokens={st.tokens} walls={st.walls} drawings={st.drawings} drags={st.drags} pin={st.pin} tool={tool} stroke={stroke} me={userId} isDm={isDm}
            playerView={playerView} showWalls={showWalls} fog={st.fog} brush={brush} wallKind={wallKind} view={view} onViewChange={setView} nameOf={nameOf}
            onCloseMenus={() => setQuickMenu(null)}
            onAddText={async at => {
              const text = await dialog.prompt(t('maps.text.prompt'));
              if (text?.trim()) run(st.addDrawing({ sceneId: live.id, campaignId, kind: 'text', data: { x: at.x, y: at.y, text: text.trim() }, color: stroke.color, width: stroke.width }));
            }}
            onDragToken={st.dragToken} onMoveToken={(id, x, y) => run(st.moveToken(id, x, y))}
            onAddDrawing={(kind, data) => run(st.addDrawing({ sceneId: live.id, campaignId, kind, data, color: stroke.color, width: stroke.width }))}
            onErase={id => run(st.eraseDrawing(id))}
            onAddWall={(a, b) => run(st.addWall({ sceneId: live.id, campaignId, x1: a.x, y1: a.y, x2: b.x, y2: b.y, visiblePlayers: false, ...newWallOf(wallKind) }))}
            onToggleWall={(w: Wall) => run(st.patchWall(w.id, { isOpen: !w.isOpen }))}
            onPaintFog={(at, op) => run(st.paintFog(at, op))}
            onPin={pt => { st.focusPin(pt); setView(v => centerOn(v, pt, viewport())); }}
            placing={!!encounter || !!pendingPc}
            onPlace={cell => {
              if (pendingPc) { run(placePcAt(pendingPc, cell)); return; }
              if (encounter) run(st.addToken(tokenFromBestiary(encounter, ts(encounter.label), campaignId, live.id, cell)));
            }}
            selectedTokenIds={selectedTokenIds} onSelectToken={id => setSelectedTokenIds(id ? [id] : [])} onMarquee={setSelectedTokenIds}
            selectedWallId={selectedWallId} onSelectWall={setSelectedWallId}
            onContextMenu={(at, pt) => setQuickMenu({ at, scene: pt })}
            onDeleteSelection={() => {
              if (selectedWall && isDm) { run(st.removeWall(selectedWall.id)); setSelectedWallId(null); return; }
              if (selectedTokens.length && isDm) { selectedTokens.forEach(tk => run(st.removeToken(tk.id))); setSelectedTokenIds([]); }
            }}
            onMoveWall={(id, at) => run(st.patchWallGeometry(id, at))} />
          {isDm && (
            <div className="mp-dmtag" role="group" aria-label={t('maps.dmOptions')}>
              <span className="mp-dm-tag">{t('maps.dmOnly')}</span>
              <span className="tb-italic">{t('maps.dmCounts', { walls: String(st.walls.filter(w => w.kind === 'wall').length), doors: String(st.walls.filter(w => w.kind === 'door').length), windows: String(st.walls.filter(w => w.kind === 'window').length), hidden: String(hiddenCount) })} · {bgName}</span>
            </div>
          )}
          <span className="mp-canvas-label">{isDm && !playerView
            ? `${t('maps.dmView')}${live.fogMode === 'vision' ? ` · ${t('maps.fog.byVision')}` : ''}${isBrush(tool) ? ` · ${t(`maps.brush.${tool}`)}` : ''}`
            : `${t('maps.playerVision', { name: live.name })}${live.lighting === 'night' ? ` · ${t('maps.light.night', { m: String(live.nightRadiusM) })}` : ''}`}</span>
          {(isDraw(tool) || (isDm && isBrush(tool))) && (
            <StrokeBar value={stroke} onChange={setStroke} onClearMine={() => run(st.clearMine())} onClearAll={isDm ? () => run(st.clearAll()) : undefined}
              tool={tool}
              {...(isDm && isBrush(tool) ? { brush, onBrush: setBrush, onRevealAll: () => run(st.paintAllFog('reveal')), onHideAll: () => run(st.paintAllFog('hide')) } : {})} />
          )}
          {isDm && (tool === 'wall' || selectedWall) && (
            <SegmentBar wall={selectedWall} kind={selectedWall ? selectedWall.kind : wallKind}
              onKind={k => (selectedWall ? run(st.patchWall(selectedWall.id, { kind: k, ...WALL_FLAGS[k] })) : setWallKind(k))}
              {...(selectedWall ? {
                onVisible: (v: boolean) => run(st.patchWall(selectedWall.id, { visiblePlayers: v })),
                onToggleOpen: () => run(st.patchWall(selectedWall.id, { isOpen: !selectedWall.isOpen })),
                onRemove: () => { run(st.removeWall(selectedWall.id)); setSelectedWallId(null); },
              } : {})} />
          )}
          {pendingPc && (
            <div className="mp-placing" role="status">
              {t('maps.place.now', { name: pendingPc.name })}
              <button type="button" className="tb-btn tb-btn-xs" onClick={() => setPendingPc(null)}>{t('common.cancel')}</button>
            </div>
          )}
          {quickMenu && (
            <div className="mp-pop mp-quick" role="menu" aria-label={t('maps.quick.title')} style={{ left: quickMenu.at.x, top: quickMenu.at.y }}>
              <button type="button" role="menuitem" className="mp-menu-item" onClick={() => { st.focusPin(quickMenu.scene); setView(v => centerOn(v, quickMenu.scene, viewport())); setQuickMenu(null); }}>
                <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>location_on</span>{t('maps.tool.pin')}
              </button>
              <button type="button" role="menuitem" className="mp-menu-item" onClick={() => { onOpenDice?.(); setQuickMenu(null); }}>
                <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>casino</span>{t('maps.action.dice')}
              </button>
            </div>
          )}
          {isDm && selectedTokens.length > 0 && (
            <div className="mp-tokbar" role="toolbar" aria-label={t('maps.token.selected')}>
              <span className="mp-tokbar-name">{selectedToken ? selectedToken.name : t('maps.token.many', { n: String(selectedTokens.length) })}</span>
              <button type="button" className="tb-btn tb-btn-xs" onClick={() => { const show = selectedTokens.some(tk => !tk.visible); selectedTokens.forEach(tk => run(st.patchToken(tk.id, { visible: show }))); }}>
                {selectedTokens.some(tk => !tk.visible) ? t('maps.token.show') : t('maps.token.hide')}
              </button>
              <button type="button" className="tb-btn tb-btn-xs" onClick={() => { selectedTokens.forEach(tk => run(st.removeToken(tk.id))); setSelectedTokenIds([]); }}>{t('maps.token.remove')}</button>
            </div>
          )}
          {isDm && pcMenu && (
            <div className="mp-pop mp-pcmenu" role="menu" aria-label={t('maps.place.pick')}>
              {pcs === null && <span className="tb-dim tb-italic">{t('common.loading')}</span>}
              {pcs?.length === 0 && <span className="tb-dim tb-italic">{t('characters.table.groupEmpty')}</span>}
              {pcs?.map(c => {
                const placed = st.tokens.some(tk => tk.characterId === c.id);
                return <button key={c.id} type="button" role="menuitem" className="mp-menu-item" disabled={placed} onClick={() => pickPc(c)}>
                  <UserAvatar user={{ name: c.name, avatarUrl: characterAvatar(c, members.find(m => m.userId === c.ownerId)?.avatarUrl) }} size={22} />{c.name}{placed && <span className="tb-dim"> · {t('maps.place.already')}</span>}
                </button>;
              })}
            </div>
          )}
          {isDm && tool === 'encounter' && (
            <EncounterMenu entries={bestiary} labelOf={e => ts(e.label)} selectedId={encounter?.id ?? null} onSelect={setEncounter} onClose={() => setTool('select')} />
          )}
          {isDm && bgOpen && (
            <BackgroundPopover scene={live} images={images}
              onColor={hex => run(patchScene(live.id, { bgColor: hex }))}
              onImage={url => run(patchScene(live.id, { bgImageUrl: url }))}
              onTransform={tr => run(patchScene(live.id, { bgTransform: tr }))}
              onUpload={async f => { const img = await repo.uploadImage(campaignId, f, f.name.replace(/\.[^.]+$/, '')); setImages(l => [img, ...(l ?? [])]); await patchScene(live.id, { bgImageUrl: img.url }); }}
              onClose={() => setBgOpen(false)} />
          )}
          <CanvasControls isDm={isDm} showWalls={showWalls} playerView={playerView} scene={live}
            onFogMode={mode => run(patchScene(live.id, { fogMode: mode }))}
            onLighting={lighting => run(patchScene(live.id, { lighting }))}
            onZoomIn={() => setView(v => zoomAt(v, ZOOM_STEP, viewCenter()))} onZoomOut={() => setView(v => zoomAt(v, 1 / ZOOM_STEP, viewCenter()))}
            onCenter={() => setView(fitView(live, viewport()))} onToggleWalls={() => setShowWalls(w => !w)} onTogglePlayerView={() => setPlayerView(v => !v)} />
        </div>
      </div>
      {failed && <p className="mp-foot mp-foot-err" role="alert">{t('maps.saveFailed')}</p>}
      {!isDm && <p className="mp-foot tb-italic tb-dim">{t('maps.dmDecides')} {live.lighting === 'night' ? t('maps.playerFootNight', { m: String(live.nightRadiusM) }) : t('maps.playerFoot')}</p>}
    </section>
  );
}
