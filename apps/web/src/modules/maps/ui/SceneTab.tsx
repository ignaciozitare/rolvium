import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { CatalogItem, GameSystem, RollRequest, SheetData } from '@rolvium/core';
import { UserAvatar, useDialog } from '@rolvium/ui';
import type { CampaignMember, TableRole } from '@/modules/campaigns/domain/entities/Campaign';
import type { Character } from '@/modules/characters/domain/entities/Character';
import type { CharactersPort } from '@/modules/characters/domain/ports/CharactersPort';
import { characterAvatar } from '@/modules/characters/domain/useCases/characterRules';
import { sysT } from '@/modules/characters/domain/useCases/systemText';
import type { ImageAsset, Scene, ScenePatch, Wall, WallKind } from '../domain/entities/Scene';
import type { MapsPort } from '../domain/ports/MapsPort';
import type { VisionPort } from '../domain/ports/VisionPort';
import { brushRadius, canvasToScene, centerOn, DEFAULT_BRUSH, fitView, isBrush, isDraw, METRES_PER_CELL, newWallOf, planOpening, WALL_FLAGS, STROKE_COLORS, tokenFromBestiary, tokenGapCells, tokenFromCharacter, tokenPointAt, DEFAULT_TOKEN_CELLS, ZOOM_STEP, zoomAt, type Point, type Tool, type View } from '../domain/useCases/mapRules';
import { mapsRepo, visionPort } from '../container';
import { useScene } from './useScene';
import { MapCanvas, type StrokeStyle } from './MapCanvas';
import { Toolbar } from './Toolbar';
import { StrokeBar } from './StrokeBar';
import { SegmentBar } from './SegmentBar';
import { CanvasControls } from './CanvasControls';
import { LayersPanel } from './LayersPanel';
import { LightEditor } from './LightEditor';
import { MaskBrushBar } from './MaskBrushBar';
import { useMaskPainter } from './useMaskPainter';
import { DEFAULT_MASK_STRENGTH, newLightOf, type MaskDirection } from '../domain/useCases/layerRules';
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
  /**
   * La capa ACTIVA: donde se dibuja y se coloca (rebanada 7). Sólo el director tiene panel, así que un
   * jugador la deja siempre vacía y todo lo suyo cae en su capa natural, igual que antes de que existieran.
   */
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [layersOpen, setLayersOpen] = useState(true);
  /** La luz que se está retocando. Es pintura: seleccionarla no cambia nada para nadie. */
  const [selectedLightId, setSelectedLightId] = useState<string | null>(null);
  const [maskStrength, setMaskStrength] = useState(DEFAULT_MASK_STRENGTH);
  const [maskDir, setMaskDir] = useState<MaskDirection>('erase');
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
    closeOverlays('encounter');
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
  /**
   * Sobre el mapa sólo puede haber UNA cosa abierta a la vez. El dueño los vio abiertos a la vez al probar la
   * app —«Colocar encuentro» y «Fondo del mapa» tapándose— porque cada uno tenía su interruptor y ninguno
   * sabía de los demás. Abrir uno cierra los otros tres; cerrarlo no abre nada.
   *
   * El de encuentros no tiene interruptor propio: se abre por HERRAMIENTA (`tool === 'encounter'`), así que
   * cerrarlo es volver a `select`. Por eso está aquí y no en un `useState` más.
   *
   * Y sólo está ABIERTO si se ve: con la criatura ya elegida en el Bestiario (`armedFromBestiary`) no hay
   * panel ninguno —es la misma condición con la que se pinta el `EncounterMenu`—, sólo una colocación armada
   * y su aviso. Cerrarla ahí desarmaba en silencio el «pulsa dónde» que se acababa de arreglar («el colocar
   * no funciona», dueño 2026-08-21): bastaba con pulsar el botón derecho para centrar la vista antes de
   * soltar la criatura y ya no había criatura que soltar.
   *
   * El de ATACAR no se abre por la barra sino desde el token elegido, y por eso se le escapaba: con «Fondo
   * del mapa» abierto se puede elegir una criatura en el lienzo igual —el panel no lo tapa— y quedaban los
   * dos encima. Llama a esto desde su botón, no tiene bandera aquí porque nada más lo abre.
   */
  const encounterMenuOpen = tool === 'encounter' && !armedFromBestiary;
  const closeOverlays = (keep?: 'bg' | 'pc' | 'quick' | 'encounter') => {
    if (keep !== 'bg') setBgOpen(false);
    if (keep !== 'pc') setPcMenu(false);
    if (keep !== 'quick') setQuickMenu(null);
    if (keep !== 'encounter' && encounterMenuOpen) setTool(t => (t === 'encounter' ? 'select' : t));
  };
  const openBg = async () => {
    const next = !bgOpen;
    closeOverlays(next ? 'bg' : undefined);
    setBgOpen(next);
    if (next && images === null) setImages(await repo.listImages(campaignId).catch(() => []));
  };
  const openPcMenu = async () => {
    const next = !pcMenu;
    closeOverlays(next ? 'pc' : undefined);
    setPcMenu(next);
    if (next && pcs === null) setPcs((await charactersRepo.listByCampaign(campaignId).catch(() => [] as Character[])).filter(c => c.kind === 'pc'));
  };
  /**
   * Lo ancho que es el token de una ficha, en casillas. Lo dice el SISTEMA a partir de su tabla de tamaños
   * (Plenilunio, p.25: diminuto…enorme), porque la plataforma no sabe que un ogro es más grande que un gato.
   * Si la ficha no lo dice —las criaturas del bestiario no llevan tamaño en su bloque— manda el del mapa.
   */
  const cellsOfSheet = (sheet: SheetData | undefined): number =>
    (sheet ? system.engine.tokenCells?.(sheet) ?? null : null) ?? DEFAULT_TOKEN_CELLS;
  /**
   * Lo mismo para un encuentro. Un PNJ aliado lleva ficha de personaje dentro de su bloque (`creature.sheet`)
   * y de ahí sale su tamaño; una criatura del MANUAL no lleva ninguno —los bloques de la p.147 en adelante
   * imprimen Aguante y Destino, y el tamaño no— así que se queda con el del mapa. Anotado como deuda: darle
   * un tamaño a cada criatura pide leerse su descripción una por una, y es su propia tanda. Que conste que
   * para algunas el libro SÍ lo dice —la tabla de la p.25 pone de ejemplo «ogro» en Grande y «dragón» en
   * Enorme—, así que esto es un plazo, no una laguna de reglas. Lo que NO vale es despejarlo de
   * `Aguante − (Fortaleza + Voluntad)`: comprobado sobre las 57 entradas, falla en muchas y se sale del rango
   * legal (Fantasma −3, Paladín solar −4, Nathael −8). RULES.md §1.6.
   */
  const cellsOfEntry = (item: CatalogItem): number =>
    cellsOfSheet((item.data?.['creature'] as { sheet?: SheetData } | undefined)?.sheet);
  const centerCell = (): Point => {
    if (!live) return { x: 0, y: 0 };
    const vp = viewport();
    const c = vp.width && vp.height ? canvasToScene({ x: vp.width / 2, y: vp.height / 2 }, view) : { x: live.width / 2, y: live.height / 2 };
    return tokenPointAt(c, live.grid.size);
  };
  /** Same gesture as «Encuentro»: pick who, then click where. Placing blind in the middle of the view was a guess. */
  const pickPc = (c: Character) => { setPendingPc(c); setPcMenu(false); };
  const placePcAt = async (c: Character, at: Point) => {
    if (!live) return;
    setPendingPc(null);
    await st.addToken(tokenFromCharacter(c, members.find(m => m.userId === c.ownerId)?.avatarUrl, live.id, at, cellsOfSheet(c.data)));
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
    const round1 = (n: number) => Math.round(n * 10) / 10;
    return st.tokens.filter(tk => tk.characterId && tk.id !== selectedToken.id).map(tk => {
      // El HUECO entre los cuerpos, no entre los centros: el libro mide si pueden TOCARSE (RULES.md §5.3).
      const cells = tokenGapCells(selectedToken, tk, grid);
      // `characterId!`: el filtro de arriba ya deja fuera los tokens que no son de un personaje.
      return { id: tk.id, name: tk.name, cells: round1(cells), metres: round1(cells * METRES_PER_CELL), characterId: tk.characterId! };
    });
  }, [selectedToken, st.tokens, live]);
  const selectedWall = st.walls.find(w => w.id === selectedWallId) ?? null;
  const selectedLight = st.lights.find(l => l.id === selectedLightId) ?? null;
  /**
   * «Fondo del mapa» toca la CAPA DE TERRENO ACTIVA cuando hay una, y la escena cuando no. Es lo que hace que
   * «+ Capa de terreno» sirva de algo: sin esto la capa nacía vacía y no había manera de darle foto.
   */
  const bgLayer = st.layers.find(l => l.id === activeLayerId && l.kind === 'terrain') ?? null;
  /**
   * El pincel de transparencia pinta sobre un lienzo propio fuera de pantalla; la foto de la capa no se toca.
   * `useMemo` en las dependencias porque si no el hook se rehace en cada render y pierde lo pintado.
   */
  const maskDeps = useMemo(() => ({ saveMask: st.saveMask, clearMask: st.clearMask }), [st.saveMask, st.clearMask]);
  const mask = useMaskPainter(live, bgLayer, maskDeps);

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
        <Toolbar tool={tool} isDm={isDm} onChange={next => { closeOverlays(next === 'encounter' ? 'encounter' : undefined); setTool(next); }}
          onDice={() => onOpenDice?.()} diceOpen={diceOpen}
          {...(isDm ? { onPlacePc: () => void openPcMenu(), placePcOpen: pcMenu, onBackground: () => void openBg(), backgroundOpen: bgOpen } : {})} />
        <div className="mp-stage" ref={stageRef}>
          <MapCanvas scene={live} tokens={st.tokens} walls={st.walls} drawings={st.drawings} layers={st.layers} lights={st.lights} drags={st.drags} pin={st.pin} tool={tool} stroke={stroke} me={userId} isDm={isDm}
            playerView={playerView} showWalls={showWalls} fog={st.fog} brush={brush} wallKind={wallKind} view={view} onViewChange={setView} nameOf={nameOf}
            onCloseMenus={() => setQuickMenu(null)}
            onAddText={async at => {
              const text = await dialog.prompt(t('maps.text.prompt'));
              if (text?.trim()) run(st.addDrawing({ sceneId: live.id, campaignId, kind: 'text', data: { x: at.x, y: at.y, text: text.trim() }, color: stroke.color, width: stroke.width, layerId: activeLayerId }));
            }}
            onDragToken={st.dragToken} onMoveToken={(id, x, y) => run(st.moveToken(id, x, y))} onServerCorrection={st.serverCorrection} onDragBound={st.dragBound}
            onAddDrawing={(kind, data) => run(st.addDrawing({ sceneId: live.id, campaignId, kind, data, color: stroke.color, width: stroke.width, layerId: activeLayerId }))}
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
            selectedLightId={selectedLightId} onSelectLight={setSelectedLightId}
            maskLayerId={bgLayer?.id ?? null} maskPreview={mask.preview}
            onPaintMask={(from, to) => mask.paint(from, to, brushRadius(brush, live.grid.size), maskStrength, maskDir)}
            onPaintMaskEnd={() => run(mask.flush())}
            onPlaceLight={async at => {
              // Nace con lo que trae su tipo; el editor se abre solo para retocarla sin buscarla.
              const created = await st.addLight(newLightOf('torch', at, { id: live.id, campaignId }, activeLayerId));
              setSelectedLightId(created.id);
            }}
            onPin={pt => { st.focusPin(pt); setView(v => centerOn(v, pt, viewport())); }}
            placing={!!encounter || !!pendingPc}
            placingSize={pendingPc ? cellsOfSheet(pendingPc.data) : encounter ? cellsOfEntry(encounter) : DEFAULT_TOKEN_CELLS}
            onPlace={at => {
              if (pendingPc) { run(placePcAt(pendingPc, at)); return; }
              if (encounter) run(st.addToken(tokenFromBestiary(encounter, ts(encounter.label), campaignId, live.id, at, cellsOfEntry(encounter))));
            }}
            selectedTokenIds={selectedTokenIds} onSelectToken={id => setSelectedTokenIds(id ? [id] : [])} onMarquee={setSelectedTokenIds}
            selectedWallId={selectedWallId} onSelectWall={setSelectedWallId}
            onContextMenu={(at, pt) => { closeOverlays('quick'); setQuickMenu({ at, scene: pt }); }}
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
          {/*
            * El panel de capas es del DIRECTOR y desaparece con «ver como jugador»: la lente sirve para ver
            * lo que ve el otro, y un jugador no tiene capas. Flota sobre el mapa, como las demás barras
            * desde la rebanada 3 — una franja a lo ancho cuesta altura de mapa.
            */}
          {isDm && !playerView && (
            <LayersPanel layers={st.layers} activeId={activeLayerId} collapsed={!layersOpen} onCollapse={() => setLayersOpen(o => !o)}
              onActivate={l => setActiveLayerId(l.id)}
              onToggleVisible={l => run(st.patchLayer(l.id, { visible: !l.visible }))}
              onToggleLocked={l => run(st.patchLayer(l.id, { locked: !l.locked }))}
              onReorder={(l, dir) => run(st.reorderLayer(l.id, dir))}
              onAddTerrain={async () => {
                const name = await dialog.prompt(t('maps.layers.newName'));
                if (name?.trim()) { const created = await st.addTerrainLayer({ name: name.trim() }); if (created) setActiveLayerId(created.id); }
              }}
              onRemove={async l => {
                if (!(await dialog.confirm(t('maps.layers.deleteConfirm', { name: l.name || t('maps.layers.kind.terrain') })))) return;
                if (activeLayerId === l.id) setActiveLayerId(null);
                run(st.removeLayer(l.id));
              }} />
          )}
          {/* El pincel de transparencia necesita una capa de terreno donde pintar; si no la hay, se DICE. */}
          {isDm && !playerView && tool === 'mask' && (bgLayer
            ? <MaskBrushBar layerName={bgLayer.name || t('maps.layers.kind.terrain')} size={brush} onSize={setBrush}
                strength={maskStrength} onStrength={setMaskStrength} direction={maskDir} onDirection={setMaskDir}
                saving={mask.saving} onReset={() => run(mask.reset())} />
            : <p className="mp-mask-needs">{t('maps.mask.needsLayer')}</p>)}
          {isDm && !playerView && selectedLight && (
            <LightEditor light={selectedLight}
              onChange={patch => run(st.patchLight(selectedLight.id, patch))}
              onRemove={() => { setSelectedLightId(null); run(st.removeLight(selectedLight.id)); }} />
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
                <button type="button" className="tb-btn tb-btn-xs tb-btn-atk" onClick={() => { closeOverlays(); setAttacking(true); }}>
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
          {isDm && encounterMenuOpen && (
            <EncounterMenu entries={bestiary} labelOf={e => ts(e.label)} selectedId={encounter?.id ?? null} onSelect={setEncounter} onClose={() => setTool('select')} />
          )}
          {isDm && bgOpen && (
            <BackgroundPopover scene={live} layer={bgLayer} images={images}
              onColor={hex => run(patchScene(live.id, { bgColor: hex }))}
              onImage={url => run(bgLayer ? st.patchLayer(bgLayer.id, { imageUrl: url }) : patchScene(live.id, { bgImageUrl: url }))}
              onTransform={tr => run(bgLayer ? st.patchLayer(bgLayer.id, { transform: tr }) : patchScene(live.id, { bgTransform: tr }))}
              onUpload={async f => {
                const img = await repo.uploadImage(campaignId, f, f.name.replace(/\.[^.]+$/, ''));
                setImages(l => [img, ...(l ?? [])]);
                await (bgLayer ? st.patchLayer(bgLayer.id, { imageUrl: img.url }) : patchScene(live.id, { bgImageUrl: img.url }));
              }}
              onClose={() => setBgOpen(false)} />
          )}
          <CanvasControls isDm={isDm} showWalls={showWalls} playerView={playerView} scene={live}
            onFogMode={mode => run(patchScene(live.id, { fogMode: mode }))}
            onLighting={lighting => run(patchScene(live.id, { lighting }))}
            onSolidWalls={solidWalls => run(patchScene(live.id, { solidWalls }))}
            onZoomIn={() => setView(v => zoomAt(v, ZOOM_STEP, viewCenter()))} onZoomOut={() => setView(v => zoomAt(v, 1 / ZOOM_STEP, viewCenter()))}
            onCenter={() => setView(fitView(live, viewport()))} onToggleWalls={() => setShowWalls(w => !w)} onTogglePlayerView={() => setPlayerView(v => !v)} />
        </div>
      </div>
      {failed && <p className="mp-foot mp-foot-err" role="alert">{t('maps.saveFailed')}</p>}
      {!isDm && <p className="mp-foot tb-italic tb-dim">{t('maps.dmDecides')} {live.lighting === 'night' ? t('maps.playerFootNight', { m: String(live.nightRadiusM) }) : t('maps.playerFoot')}</p>}
    </section>
  );
}
