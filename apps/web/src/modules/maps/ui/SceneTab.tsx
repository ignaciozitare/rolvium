import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { CatalogItem, GameSystem, RollRequest } from '@rolvium/core';
import { UserAvatar, useDialog } from '@rolvium/ui';
import type { CampaignMember, TableRole } from '@/modules/campaigns/domain/entities/Campaign';
import type { Character } from '@/modules/characters/domain/entities/Character';
import type { CharactersPort } from '@/modules/characters/domain/ports/CharactersPort';
import { characterAvatar } from '@/modules/characters/domain/useCases/characterRules';
import { sysT } from '@/modules/characters/domain/useCases/systemText';
import type { ImageAsset, Scene, ScenePatch, Wall, WallKind } from '../domain/entities/Scene';
import type { MapsPort } from '../domain/ports/MapsPort';
import type { VisionPort } from '../domain/ports/VisionPort';
import { canvasToScene, centerOn, DEFAULT_BRUSH, distanceCells, fitView, isBrush, isDraw, METRES_PER_CELL, newWallOf, planOpening, WALL_FLAGS, STROKE_COLORS, tokenCellAt, tokenCenter, tokenFromBestiary, tokenFromCharacter, ZOOM_STEP, zoomAt, type Point, type Tool, type View } from '../domain/useCases/mapRules';
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
import { TokenAttackModal, type AttackTarget } from '@/modules/bestiary/ui/TokenAttackModal';
import { entryFromCatalogItem } from '@/modules/bestiary/domain/useCases/bestiaryRules';
import './maps.css';

interface Props {
  campaignId: string;
  role: TableRole;
  userId: string;
  system: GameSystem;
  /**
   * Encuentros PROPIOS del director (H5), ya con forma de `CatalogItem`. Llegan por parámetro y no de un
   * repositorio: `maps` no tiene por qué saber que existe el bestiario, igual que `EncounterMenu` no sabe de
   * dónde salen sus entradas.
   */
  extraEncounters?: CatalogItem[];
  /**
   * Una criatura que llega YA ELEGIDA desde el Bestiario: «Colocar» allí arma la colocación aquí, y el
   * director sólo tiene que pulsar dónde. Antes «Colocar» sólo cambiaba de pestaña y no colocaba nada —
   * «el colocar no funciona» (dueño, 2026-08-21).
   */
  armEncounter?: CatalogItem | null;
  /** Avisa de que ya se ha armado, para que el padre lo suelte y no se rearme solo al volver a la pestaña. */
  onArmed?: () => void;
  members: CampaignMember[];
  /** From the table snapshot (live). Players see this scene; the DM starts on it. */
  activeSceneId: string | null;
  charactersRepo: CharactersPort;
  /** The dice roller belongs to H6 and is hosted by the table; the scene only owns the button that opens it. */
  onOpenDice?: () => void;
  /**
   * Tirar de verdad. Lo trae la mesa, igual que se lo da al Bestiario: la escena no tiene repositorio de
   * tiradas ni tiene por qué tenerlo. Sin él, el botón ATACAR de un token no se ofrece.
   */
  onRoll?: (req: RollRequest & { campaignId?: string }) => Promise<unknown>;
  /**
   * Abrir un ataque cuerpo a cuerpo A LA ESPERA de que el jugador conteste (`.pen` columna 5). Lo trae la
   * mesa igual que `onRoll`: la escena no tiene repositorio de ataques ni tiene por qué tenerlo. Sin él,
   * un golpe cuerpo a cuerpo no se puede pedir y el botón ATACAR no se ofrece.
   */
  onOpenAttack?: (input: { sceneId: string | null; attackerTokenId: string; targetTokenId: string; attackerName: string; targetCharacterId: string; dice: number; request: RollRequest }) => Promise<unknown>;
  diceOpen?: boolean;
  repo?: MapsPort;
  vision?: VisionPort;
}

/** Gold, the second swatch of the persisted stroke palette (mapRules.STROKE_COLORS). */
const DEFAULT_STROKE: StrokeStyle = { color: STROKE_COLORS[1], width: 2 };

/** «Escena» tab: the DM prepares (scenes · background · walls · encounters), everyone plays on top (rolvium.pen Mesa/Escena). */
export function SceneTab({ campaignId, role, userId, system, members, activeSceneId, charactersRepo, onOpenDice, onRoll, onOpenAttack, diceOpen = false, extraEncounters, armEncounter, onArmed, repo = mapsRepo, vision = visionPort }: Props): JSX.Element {
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
  /** La criatura llegó ya elegida desde el Bestiario: se arma la colocación pero NO se abre el buscador. */
  const [armedFromBestiary, setArmedFromBestiary] = useState(false);
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
  useEffect(() => { if (tool !== 'encounter') { setEncounter(null); setArmedFromBestiary(false); } }, [tool]);
  /**
   * Armar lo que llega del Bestiario. Espera a que la escena exista: al llegar de otra pestaña este
   * componente monta con `live` a null y el efecto de `[live?.id]` limpia el encuentro justo después,
   * así que armar antes se perdía. Y hay que poner la herramienta en «encounter» o el efecto de `[tool]`
   * de arriba lo borra en el mismo commit.
   */
  useEffect(() => {
    if (!armEncounter || !live) return;
    setTool('encounter');
    setEncounter(armEncounter);
    // Sin abrir el buscador: la criatura ya viene elegida del Bestiario y el desplegable tapaba media
    // escena para preguntar algo que ya estaba contestado.
    setArmedFromBestiary(true);
    onArmed?.();
  }, [armEncounter, live?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Only Seleccionar owns a selection. Carrying it into another tool stacks «Segmento» / the token bar on top of
  // «Trazo» — all three float at the same spot over the canvas — and leaves Suprimir armed on an invisible target.
  useEffect(() => { if (tool !== 'select') { setSelectedWallId(null); setSelectedTokenIds([]); } }, [tool]);
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
  // Las 45 del manual (datos del paquete) MÁS los encuentros propios del director. Sin esto el desplegable
  // enseña sólo el libro y lo que el director se ha inventado no se puede colocar.
  const bestiary = useMemo(
    () => [...(system.catalogs['bestiary'] ?? []), ...(extraEncounters ?? [])],
    [system, extraEncounters],
  );
  const selectedTokens = st.tokens.filter(tk => selectedTokenIds.includes(tk.id));
  const selectedToken = selectedTokens.length === 1 ? selectedTokens[0]! : null;

  /**
   * ATACAR desde el token (`.pen` «6 · Toca el token de la criatura en el mapa y ataca con ella»).
   *
   * La criatura sale del bloque del que se colocó: del catálogo del sistema si es del manual
   * (`bestiaryRef`), o de los encuentros propios del director si tiene fila (`bestiaryEntryId`). El nombre
   * es el DEL TOKEN, porque el director renombra sus instancias.
   */
  const [attacking, setAttacking] = useState(false);
  const attackerItem = useMemo(() => {
    if (!selectedToken || selectedToken.characterId) return null;
    if (selectedToken.bestiaryEntryId) return (extraEncounters ?? []).find(i => i.data?.['entryId'] === selectedToken.bestiaryEntryId) ?? null;
    if (selectedToken.bestiaryRef) return (system.catalogs['bestiary'] ?? []).find(i => i.id === selectedToken.bestiaryRef) ?? null;
    return null;
  }, [selectedToken, extraEncounters, system]);
  const canAttack = isDm && !!onRoll && !!onOpenAttack && !!attackerItem && !!selectedToken;

  /** Los personajes de la escena con su distancia YA medida: «lo mide el mapa», dice el diseño. */
  const attackTargets = useMemo((): AttackTarget[] => {
    if (!selectedToken || !live) return [];
    const grid = live.grid.size;
    const from = tokenCenter(selectedToken, grid);
    const round1 = (n: number) => Math.round(n * 10) / 10;
    return st.tokens.filter(tk => tk.characterId && tk.id !== selectedToken.id).map(tk => {
      const cells = distanceCells(from, tokenCenter(tk, grid), grid);
      // `characterId!`: el filtro de arriba ya deja fuera los tokens que no son de un personaje.
      return { id: tk.id, name: tk.name, cells: round1(cells), metres: round1(cells * METRES_PER_CELL), characterId: tk.characterId! };
    });
  }, [selectedToken, st.tokens, live]);
  const selectedWall = st.walls.find(w => w.id === selectedWallId) ?? null;

  /** One definition of «borra lo que hay elegido», shared by Suprimir, the right-click menu and the token bar. */
  const deleteSelection = () => {
    if (!isDm) return;
    if (selectedWall) { run(st.removeWall(selectedWall.id)); setSelectedWallId(null); return; }
    if (selectedTokens.length) { selectedTokens.forEach(tk => run(st.removeToken(tk.id))); setSelectedTokenIds([]); }
  };

  if (status === 'loading') return <section className="tb-hoja tb-placeholder">{t('maps.loading')}</section>;
  if (status === 'error') return <section className="tb-hoja tb-placeholder">{t('maps.error')}</section>;

  // NOT `&& live`: the rail carries the only «+ Escena» there is since slice 3 took the scene header
  // away, so hiding it until a scene exists left the DM with no way to create the first one — the
  // «crea la primera escena» placeholder asked for exactly what it disabled (owner, 2026-08-19).
  const scenesRail = isDm && scenes ? (
    <ScenesMenu scenes={scenes} selectedId={selectedId} activeSceneId={activeSceneId} onSelect={setSelectedId}
      collapsed={railFolded} onToggleCollapsed={() => setRailFolded(f => !f)}
      onCreate={async name => { const sc = await repo.createScene({ campaignId, name, sortOrder: scenes.length }); setScenes(l => [...(l ?? []), sc]); setSelectedId(sc.id); }}
      onRename={(id, name) => patchScene(id, { name })}
      onActivate={id => repo.setActiveScene(campaignId, id)}
      onToggleVisible={(id, visiblePlayers) => patchScene(id, { visiblePlayers })}
      onRemove={async id => { await repo.removeScene(id); setScenes(l => { const n = (l ?? []).filter(sc => sc.id !== id); setSelectedId(cur => (cur === id ? n[0]?.id ?? null : cur)); return n; }); }} />
  ) : null;

  if (!live) {
    return (
      <section className="mp-root">
        <div className="mp-stage-row">
          {scenesRail}
          <div className="tb-hoja tb-placeholder mp-empty">
            <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-lg)' }}>map</span>
            <p>{isDm ? t('maps.noScenesDm') : t('maps.noScene')}</p>
          </div>
        </div>
      </section>
    );
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
            onAddWall={(a, b) => {
              // A door or a window drawn over a wall CUTS it instead of stacking on top of it (planOpening).
              // It also inherits whether the players could see that wall: otherwise their plan grows a gap
              // exactly where the doorway is.
              const plan = planOpening(st.walls, a, b, wallKind);
              run(st.addWall({ sceneId: live.id, campaignId, ...plan.opening, visiblePlayers: plan.split?.host.visiblePlayers ?? false, ...newWallOf(wallKind) }, plan.split));
            }}
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
            onDeleteSelection={deleteSelection}
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
          {/* Mismo aviso para una criatura armada. Sin él, quien llega del Bestiario ve la escena y no sabe
              que le falta pulsar en el mapa: la colocación quedaba armada y muda. */}
          {encounter && !pendingPc && (
            <div className="mp-placing" role="status">
              {t('maps.place.now', { name: ts(encounter.label) })}
              <button type="button" className="tb-btn tb-btn-xs" onClick={() => { setEncounter(null); setTool('select'); }}>{t('common.cancel')}</button>
            </div>
          )}
          {quickMenu && (
            <div className="mp-pop mp-quick" role="menu" aria-label={t('maps.quick.title')} style={{ left: quickMenu.at.x, top: quickMenu.at.y }}>
              <button type="button" role="menuitem" className="mp-menu-item" onClick={() => { setView(v => centerOn(v, quickMenu.scene, viewport())); setQuickMenu(null); }}>
                <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>my_location</span>{t('maps.quick.centerMe')}
              </button>
              <button type="button" role="menuitem" className="mp-menu-item" onClick={() => { st.focusPin(quickMenu.scene); setView(v => centerOn(v, quickMenu.scene, viewport())); setQuickMenu(null); }}>
                <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>location_on</span>{t('maps.quick.centerAll')}
              </button>
              <button type="button" role="menuitem" className="mp-menu-item" onClick={() => { setView(fitView(live, viewport())); setQuickMenu(null); }}>
                <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>fit_screen</span>{t('maps.controls.center')}
              </button>
              <button type="button" role="menuitem" className="mp-menu-item" onClick={() => { onOpenDice?.(); setQuickMenu(null); }}>
                <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>casino</span>{t('maps.action.dice')}
              </button>
              {isDm && (selectedWall || selectedTokens.length > 0) && (
                <button type="button" role="menuitem" className="mp-menu-item danger" onClick={() => { deleteSelection(); setQuickMenu(null); }}>
                  <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>delete</span>{t('common.delete')}
                </button>
              )}
            </div>
          )}
          {isDm && selectedTokens.length > 0 && (
            <div className="mp-tokbar" role="toolbar" aria-label={t('maps.token.selected')}>
              <span className="mp-tokbar-name">{selectedToken ? selectedToken.name : t('maps.token.many', { n: String(selectedTokens.length) })}</span>
              <button type="button" className="tb-btn tb-btn-xs" onClick={() => { const show = selectedTokens.some(tk => !tk.visible); selectedTokens.forEach(tk => run(st.patchToken(tk.id, { visible: show }))); }}>
                {selectedTokens.some(tk => !tk.visible) ? t('maps.token.show') : t('maps.token.hide')}
              </button>
              {canAttack && (
                <button type="button" className="tb-btn tb-btn-xs tb-btn-atk" onClick={() => setAttacking(true)}>
                  {t('bestiary.attack.button')}
                </button>
              )}
              <button type="button" className="tb-btn tb-btn-xs" onClick={deleteSelection}>{t('maps.token.remove')}</button>
            </div>
          )}
          {canAttack && attacking && (
            <TokenAttackModal entry={entryFromCatalogItem(attackerItem!, selectedToken!.name)} system={system}
                              targets={attackTargets} night={live?.lighting === 'night'}
                              onAttack={req => onRoll!({ ...req, campaignId })}
                              onOpenAttack={i => onOpenAttack!({
                                sceneId: live?.id ?? null, attackerTokenId: selectedToken!.id, attackerName: selectedToken!.name,
                                targetTokenId: i.targetTokenId, targetCharacterId: i.targetCharacterId, dice: i.dice, request: i.request,
                              })}
                              onClose={() => setAttacking(false)} />
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
          {isDm && tool === 'encounter' && !armedFromBestiary && (
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
