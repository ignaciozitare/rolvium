import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { CatalogItem, GameSystem, RollRequest, SheetData } from '@rolvium/core';
import { Modal, UserAvatar, useDialog } from '@rolvium/ui';
import type { CampaignMember, TableRole } from '@/modules/campaigns/domain/entities/Campaign';
import type { Character } from '@/modules/characters/domain/entities/Character';
import type { CharactersPort } from '@/modules/characters/domain/ports/CharactersPort';
import { characterAvatar } from '@/modules/characters/domain/useCases/characterRules';
import { sysT } from '@/modules/characters/domain/useCases/systemText';
import { DEFAULT_DOOR } from '../domain/entities/Scene';
import type { DoorSettings, ImageAsset, Scene, ScenePatch, Texture, TextureCategory, Wall, WallKind } from '../domain/entities/Scene';
import type { MapsPort } from '../domain/ports/MapsPort';
import type { VisionPort } from '../domain/ports/VisionPort';
import { brushRadius, canvasToScene, centerOn, DEFAULT_BRUSH, fitView, isBrush, isDraw, METRES_PER_CELL, newWallOf, planOpening, WALL_FLAGS, STROKE_COLORS, tokenFromBestiary, tokenGapCells, tokensScaledIn, tokenAnchorShift, tokenPointStored, tokenSizeIn, tokenFromCharacter, tokenPointAt, DEFAULT_TOKEN_CELLS, ZOOM_STEP, zoomAt, type Point, type Tool, type View } from '../domain/useCases/mapRules';
import { mapsRepo, visionPort } from '../container';
import { useScene } from './useScene';
import { MapCanvas, type StrokeStyle } from './MapCanvas';
import { Toolbar } from './Toolbar';
import { StrokeBar } from './StrokeBar';
import { BuilderPanel } from './BuilderPanel';
import { TextureCatalog } from './TextureCatalog';
import { defaultShapeFor, isOpeningKind, shapesFor, wallStripe, type BuildKind, type BuilderMode, type RoomShape } from '../domain/useCases/roomRules';
import { DEFAULT_TEXTURE_SCALE, snapSpanToOutline, wallWidthPx } from '../domain/useCases/roomStyles';
import { CanvasControls } from './CanvasControls';
import { LayersPanel } from './LayersPanel';
import { LightEditor } from './LightEditor';
import { MaskBrushBar } from './MaskBrushBar';
import { LayerMenu } from './LayerMenu';
import { useMaskPainter } from './useMaskPainter';
import { clampMaskSize, DEFAULT_MASK_HARDNESS, DEFAULT_MASK_SIZE, DEFAULT_MASK_STRENGTH, newLightOf, type ElementKind, type MaskDirection } from '../domain/useCases/layerRules';
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
   * ¿PUEDE ORDENAR EL CATÁLOGO DE TEXTURAS? Es el permiso `manage_textures` del motor de roles, y llega por
   * parámetro a propósito: `maps` no tiene por qué saber cómo se leen los permisos, igual que no sabe de
   * dónde salen los encuentros. Quien lo resuelve es el caparazón de la mesa.
   *
   * OBLIGATORIA, no opcional: un permiso que se olvida y por omisión vale `false` deja al dueño sin sus
   * botones sin que nadie se entere. Así el compilador obliga a decidirlo en cada sitio.
   */
  canManageTextures: boolean;
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
/** Cuánto se queda en pantalla el aviso de «el gesto no levantó nada». Lo justo para leerlo sin estorbar. */
const AVISO_MS = 2600;

/** «Escena» tab: the DM prepares (scenes · background · walls · encounters), everyone plays on top (rolvium.pen Mesa/Escena). */
export function SceneTab({ campaignId, role, userId, system, canManageTextures: puedeOrdenarTexturas, members, activeSceneId, charactersRepo, onOpenDice, onRoll, onOpenAttack, diceOpen = false, extraEncounters, armEncounter, onArmed, repo = mapsRepo, vision = visionPort }: Props): JSX.Element {
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
  /** Con qué forma levanta Builder. Arranca en `segment`: el Builder de siempre, sin sorpresas (§ «Rebanada 8»). */
  const [wallShape, setWallShape] = useState<RoomShape>('segment');
  /**
   * EN QUÉ ESTÁ TRABAJANDO (diseño v3). Arranca en «sobre una foto», que es lo que él lleva haciendo: marcar
   * los muros encima de un mapa hecho con otra herramienta.
   *
   * Vive en la pantalla y NO en la escena, igual que el velo del director: hoy sólo decide qué ofrece el
   * panel, no cambia ni un dato de la partida. El día que traiga preajustes y texturas —tabla de habitaciones,
   * migración y DBA de por medio— se mirará si tiene que guardarse.
   */
  const [builderMode, setBuilderMode] = useState<BuilderMode>('photo');
  /**
   * QUÉ LEVANTA EL GESTO dibujando aquí: excavar una sala, rellenar un muro, o abrir un vano. Sólo cuenta en
   * «Dibujar aquí»; sobre una foto manda `wallKind`, que no se ha tocado.
   */
  const [buildKind, setBuildKind] = useState<BuildKind>('room');
  /**
   * EL CANDADO DE LA REJILLA. Arranca ABIERTO por orden suya del 2026-09-03: «*el pegado a la rejilla debería
   * estar desactivado por defecto*». Se le había propuesto lo contrario —empezar cerrado, para no cambiarle
   * nada— y probándolo decidió al revés: marcando muros sobre una foto, la rejilla no le sirve de nada porque
   * los muros de la foto no caen en múltiplos de nada.
   *
   * Abierto NO es «libre a secas»: las puntas siguen pegándose a las puntas de otros muros cercanos, o
   * quedarían rendijas por las que se cuela la visión (`snapRules`).
   */
  const [snapGrid, setSnapGrid] = useState(false);
  /**
   * LOS NODOS EN CADENA (dueño, 2026-09-03: «*los nodos deberían ser como una cadena a menos que yo elija que
   * no*»). Arranca PUESTO, que es lo que pidió: mover una punta se lleva las que estaban en ese mismo sitio,
   * así que arrastrar el nodo de una sala no la abre.
   */
  const [chainNodes, setChainNodes] = useState(true);
  /**
   * SI EL PANEL DE BUILDER ESTÁ ABIERTO. Es un estado propio y no «¿la herramienta es Builder?» porque
   * Seleccionar y Builder VIVEN JUNTAS (dueño, 2026-09-03): pasar a Seleccionar para mover algo no puede
   * cerrarle el panel con el que está trabajando. Lo cierra la X, o irse a cualquier otra herramienta.
   */
  /**
   * EL AVISO DE QUE EL GESTO NO LEVANTÓ NADA (dueño, 2026-09-04, eligiendo bajar el mínimo de una sala: «*un
   * clic sin arrastrar sigue sin dibujar nada, y ahí sí te avisa en pantalla*»).
   *
   * Antes esto pasaba EN SILENCIO y era lo peor del fallo: se arrastraba corto, no aparecía nada, y no había
   * forma de saber si el mínimo, el candado o la app estaban rotos. Se borra solo, como el alfiler.
   */
  const [avisoCorto, setAvisoCorto] = useState<'short' | 'snap' | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [railFolded, setRailFolded] = useState(false);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  /** EL GRUPO (§ «EL GRUPO»): los muros cogidos como una pieza. Es otra cosa que el muro suelto que se edita. */
  const [selectedWallIds, setSelectedWallIds] = useState<string[]>([]);
  /**
   * EL VANO DE SALA COGIDO (§ «Las puertas, de verdad»). Va aparte del muro porque es otra tabla, y existe
   * para que el panel pueda enseñar cómo es esa puerta y su papelera: hasta hoy un vano de sala, una vez
   * dibujado, no se podía ni abrir ni borrar.
   */
  const [selectedRoomOpeningId, setSelectedRoomOpeningId] = useState<string | null>(null);
  /**
   * CÓMO SERÁ LA PRÓXIMA PUERTA (`rolvium.pen` · «PL/Builder · panel · PUERTA ELEGIDA», aprobado el
   * 2026-09-07). Corrección suya, y de concepto: «*sólo me deja poner las propiedades de la puerta una vez
   * creada, eso está como el culo*». Los ajustes salen al elegir PUERTA y la puerta **nace ya así**, como el
   * estilo de la mazmorra decide cómo nace una sala. Cogiendo una ya puesta, los mismos controles la editan.
   *
   * No se guarda en la base: es la mano con la que se dibuja, no un dato de la escena — igual que el color
   * del pincel de trazos. Al recargar vuelve a los valores de fábrica, que es lo que él espera.
   */
  const [doorDraft, setDoorDraft] = useState<DoorSettings>(DEFAULT_DOOR);
  const [quickMenu, setQuickMenu] = useState<{ at: Point; scene: Point } | null>(null);
  /**
   * El velo gris del director, encendido o apagado. Vive AQUÍ y no en la escena a propósito: es una
   * preferencia de su pantalla, no un ajuste de la partida — no se guarda, no viaja y al recargar vuelve
   * puesto. Un jugador no se entera de nada (dueño, 2026-09-02).
   */
  const [fogVeil, setFogVeil] = useState(true);
  /** El trazo elegido: un texto, una línea, una caja, un círculo o un garabato (dueño, 2026-09-02). */
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  /**
   * VARIOS TRAZOS COGIDOS con el área (dueño, 2026-09-03: «*el arrastrar y seleccionar no funciona con las
   * formas simples de líneas, texto, círculo y cuadrado*»). Se mueven juntos y Suprimir los borra juntos.
   */
  const [selectedDrawingIds, setSelectedDrawingIds] = useState<string[]>([]);
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
  /**
   * LA SONDA DE PRUEBA (§ 7.3): dónde está puesta, en px de escena. Va atada a «ver como jugador» — encenderlo
   * la suelta, apagarlo se la lleva (dueño, 2026-09-01: «me debería dejar poner un token donde quiera para
   * probar»). No es una ficha: no se guarda, no la ve nadie y no sale en ninguna lista.
   */
  const [probe, setProbe] = useState<Point | null>(null);
  const st = useScene(repo, scene, userId, vision, probe);
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
  /**
   * El pincel de transparencia lleva SU tamaño, continuo y en casillas, y su dureza. No comparte el `brush`
   * de la niebla a propósito: allí son cuatro discos y aquí el dueño lo pidió gradual, así que compartirlo
   * habría dejado la niebla con un tamaño que ninguno de sus discos puede representar.
   */
  const [maskSizeCells, setMaskSizeCells] = useState(DEFAULT_MASK_SIZE);
  const [maskHardness, setMaskHardness] = useState(DEFAULT_MASK_HARDNESS);
  /** «Botón derecho sobre cualquier cosa → mándala a otra capa». */
  const [layerMenu, setLayerMenu] = useState<{ at: Point; element: { kind: ElementKind; id: string; name: string; layerId: string | null } } | null>(null);
  /**
   * EL PREVIO EN VIVO DE LA ESCALA DE TEXTURA (petición suya del 2026-09-04: «*tener un previo de cómo iría
   * quedando cuando la escale*»). Mientras arrastra el deslizador el mapa se repinta con este valor **sin
   * escribir en la base**; al soltar se guarda UNA vez. Mismo reparto que el pincel de transparencia: pintar
   * es continuo, guardar es una vez.
   */
  const [texDraft, setTexDraft] = useState<{ wallTextureScale?: number; floorTextureScale?: number; tokenScale?: number } | null>(null);
  const live = st.scene;
  /** Lo que se PINTA: la escena de verdad más el borrador de la escala que él esté arrastrando ahora mismo. */
  const shown = live && texDraft ? { ...live, ...texDraft } : live;
  const viewport = () => ({ width: stageRef.current?.clientWidth ?? 0, height: stageRef.current?.clientHeight ?? 0 });
  const viewCenter = (): Point => { const vp = viewport(); return { x: vp.width / 2, y: vp.height / 2 }; };

  /**
   * Al cambiar de escena la sonda SE VA, y con ella «ver como jugador» (§ 7.3: «se va al apagar la sonda, al
   * cambiar de escena o al recargar»). Dejarla puesta la plantaría en las coordenadas de la escena anterior,
   * que en la nueva no significan nada.
   */
  useEffect(() => { if (live) setView(fitView(live, viewport())); setSelectedTokenIds([]); setEncounter(null); setProbe(null); setPlayerView(false); }, [live?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Whoever accepts the pin centres on it — including the one who dropped it, which is what «enfoque» means.
  useEffect(() => { if (st.pin) setView(v => centerOn(v, st.pin!, viewport())); }, [st.pin]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tool !== 'encounter') { setEncounter(null); setArmedFromBestiary(false); } }, [tool]);
  /**
   * El aviso de «no se levantó nada» se retira solo: es una explicación de lo que acaba de pasar, no un
   * estado. Se rearma en cada gesto fallido porque el estado cambia de `null` a valor otra vez.
   */
  useEffect(() => {
    if (!avisoCorto) return;
    const id = window.setTimeout(() => setAvisoCorto(null), AVISO_MS);
    return () => window.clearTimeout(id);
  }, [avisoCorto]);
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
  /**
   * La selección es de Seleccionar y de BUILDER, que viven juntas (dueño, 2026-09-03: «*si tengo una
   * herramienta y selecciono la herramienta de selección no tiene que cerrar los modales abiertos, viven
   * juntas, porque si quiero mover algo no indica que deje de trabajar con un muro*»). Llevarla a cualquier
   * OTRA herramienta sí la suelta: apilaba la barra del token sobre «Trazo» —las dos flotan en el mismo
   * sitio— y dejaba a Suprimir apuntando a algo que no se ve.
   */
  useEffect(() => { if (tool !== 'select' && tool !== 'wall') { setSelectedWallId(null); setSelectedTokenIds([]); setSelectedDrawingIds([]); } }, [tool]);
  useEffect(() => { if (live) { setPendingPc(null); setPcMenu(false); } }, [live?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const nameOf = useCallback((uid: string) => members.find(m => m.userId === uid)?.name ?? uid, [members]);
  const patchScene = useCallback(async (id: string, patch: ScenePatch) => {
    setScenes(l => l?.map(s => (s.id === id ? { ...s, ...patch } : s)) ?? l);
    await repo.updateScene(id, patch);
  }, [repo]);
  /**
   * SUBIR UNA DE LAS DOS TEXTURAS BASE (rebanada 8). Va por el camino de siempre —el bucket de fondos de la
   * campaña— y no por uno nuevo: una textura de pared es una imagen de campaña como cualquier otra, y así
   * queda además en su biblioteca para reusarla en otro mapa.
   *
   * Cambiar la textura NO repinta las salas ya levantadas: cada una se llevó su suelo el día que se dibujó.
   */
  const texInput = useRef<HTMLInputElement | null>(null);
  /**
   * EL CATÁLOGO DE TEXTURAS (petición suya del 2026-09-04): «*las texturas se tienen que alimentar de un
   * catálogo, no que si quieres cambiarla sólo te permita subirlas… ¿quedarán infinitas texturas?*». Tenía
   * razón: con sólo «subir», reusar una foto obligaba a subirla otra vez y la biblioteca crecía sin fin.
   *
   * ⚠️ Y la primera respuesta a eso fue MALA: se reusó la biblioteca de fondos de la campaña, «que una
   * textura no deja de ser una imagen». No lo es, y él lo paró en cuanto lo vio (2026-09-04): «*los fondos de
   * las escenas que subí antes y las texturas no son lo mismo; los fondos sí son por campaña —yo subo un mapa
   * que dibujé y lo pongo aquí— pero las texturas son de un catálogo de texturas, no lo mezcles*». Hoy son
   * dos cosas separadas: `images` es de ESTA campaña, `textures` es de la herramienta entera.
   */
  /**
   * Para qué se está eligiendo textura. `door` entró el 2026-09-07 («*te falta lo de la textura*»): la
   * puerta bebe del MISMO catálogo que la pared y el suelo, que es de la herramienta y ya está hecho.
   */
  const [texPicker, setTexPicker] = useState<'wall' | 'floor' | 'door' | null>(null);
  /**
   * EL CATÁLOGO DE TEXTURAS, y ya NO la biblioteca de fondos de la campaña (él, 2026-09-04: «*los fondos de
   * las escenas que subí antes y las texturas no son lo mismo… las texturas son de un catálogo de texturas,
   * no lo mezcles*»). Van aparte de `images` a propósito: `images` es de ESTA campaña, esto es de la
   * herramienta entera.
   */
  const [textures, setTextures] = useState<Texture[] | null>(null);
  const [texUploadCat, setTexUploadCat] = useState<TextureCategory>('misc');
  /**
   * ELEGIR UNA TEXTURA copia además SU TAMAÑO DE BALDOSA a la escena (§ «El catálogo de texturas»). Un mosaico
   * fino y unas losas grandes no quieren la misma escala, y hacerle mover el deslizador cada vez sería
   * repetirle un trabajo que ya hizo una vez, al subirla.
   */
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
  /**
   * ⭐ LAS FICHAS, YA VISTAS POR LA LENTE DE LA ESCENA. **Todo lo de esta pantalla usa ESTA lista**, nunca la
   * cruda: el mapa, la selección y la distancia de un ataque. Si algo se saltara la lente, su cuenta saldría
   * con el tamaño sin escalar y la ficha chocaría donde no se la ve.
   *
   * La barrita del tamaño (`scene.tokenScale`) no reescribe nada en la base: es esto, y sólo esto.
   */
  const fichas = useMemo(
    () => (shown ? tokensScaledIn(st.tokens, shown) : st.tokens),
    [st.tokens, shown],
  );

  /**
   * ⭐ LA FRONTERA ENTRE LAS DOS CUENTAS, Y ESTÁ ENTERA AQUÍ.
   *
   * `x`/`y` guardan la ESQUINA de la ficha, así que al encogerla la lente corre esa esquina media diferencia
   * de tamaño para que el CENTRO no se mueva (`tokenAnchorShift`). Consecuencia: el lienzo trabaja en la
   * cuenta de la ficha ENCOGIDA, mientras que la base, el servidor y el resto de la app hablan en la cuenta
   * de la ficha DE VERDAD.
   *
   * ⚠️ Todo lo que cruce por aquí hay que traducirlo, en los dos sentidos, y por eso está junto y no repartido:
   *  · lo que SALE hacia el servidor o la base (arrastrar, soltar) se deshace el corrimiento;
   *  · lo que ENTRA del servidor (su corrección, el disco libre) y de los demás jugadores (`drags`) se aplica.
   * Con la barrita en el centro `d` vale 0 y esto es la identidad exacta: ni una escena de hoy cambia.
   */
  const corrimiento = useCallback((id: string): number => {
    const cruda = st.tokens.find(t => t.id === id);
    return cruda && shown ? tokenAnchorShift(cruda.size, shown.tokenScale) : 0;
  }, [st.tokens, shown]);
  /** De la esquina que se VE a la que se GUARDA. */
  const aGuardar = useCallback((id: string, x: number, y: number): Point => {
    const cruda = st.tokens.find(t => t.id === id);
    return cruda && shown ? tokenPointStored({ x, y }, cruda.size, shown.tokenScale) : { x, y };
  }, [st.tokens, shown]);
  /** Y de la guardada a la que se VE, para lo que llega de fuera. */
  const aPintar = useCallback((id: string, x: number, y: number): Point => {
    const d = corrimiento(id);
    return { x: x + d, y: y + d };
  }, [corrimiento]);
  /** Las posiciones que otros jugadores están arrastrando ahora mismo, traídas a la cuenta del lienzo. */
  const drags = useMemo(() => {
    if (!shown || (shown.tokenScale || 1) === 1) return st.drags;
    return Object.fromEntries(Object.entries(st.drags).map(([id, d]) => [id, { ...d, ...aPintar(id, d.x, d.y) }]));
  }, [st.drags, shown, aPintar]);
  const selectedTokens = fichas.filter(tk => selectedTokenIds.includes(tk.id));
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
    return fichas.filter(tk => tk.characterId && tk.id !== selectedToken.id).map(tk => {
      // El HUECO entre los cuerpos, no entre los centros: el libro mide si pueden TOCARSE (RULES.md §5.3).
      const cells = tokenGapCells(selectedToken, tk, grid);
      // `characterId!`: el filtro de arriba ya deja fuera los tokens que no son de un personaje.
      return { id: tk.id, name: tk.name, cells: round1(cells), metres: round1(cells * METRES_PER_CELL), characterId: tk.characterId! };
    });
  }, [selectedToken, fichas, live]);
  const selectedWall = st.walls.find(w => w.id === selectedWallId) ?? null;
  const selectedRoomOpening = st.roomOpenings.find(o => o.id === selectedRoomOpeningId) ?? null;

  /**
   * La textura de la PUERTA va a la puerta cogida si hay una, y a la escena si no — el mismo reparto que el
   * color, que él eligió: por defecto todas iguales, y la de hierro del jefe se cambia sola. Y no copia
   * `tileCells`: el azulejo de una puerta es de UNA casilla, porque una puerta mide más o menos eso.
   */
  const aplicarTexturaPuerta = useCallback((url: string | null) => {
    if (selectedWall) { run(st.patchWall(selectedWall.id, { doorTextureUrl: url })); return; }
    if (selectedRoomOpening) { run(st.patchRoomOpening(selectedRoomOpening.id, { doorTextureUrl: url })); return; }
    // Sin nada cogido, la textura es la de la PRÓXIMA puerta: la que se está a punto de dibujar.
    setDoorDraft(d => ({ ...d, doorTextureUrl: url }));
  }, [selectedWall, selectedRoomOpening, run, st]);
  const aplicarTextura = useCallback((tex: Texture) => {
    if (!live || !texPicker) return;
    if (texPicker === 'door') { aplicarTexturaPuerta(tex.url); setTexPicker(null); return; }
    run(patchScene(live.id, texPicker === 'wall'
      ? { wallTextureUrl: tex.url, wallTextureScale: tex.tileCells }
      : { floorTextureUrl: tex.url, floorTextureScale: tex.tileCells }));
    setTexPicker(null);
  }, [live, texPicker, run, patchScene, aplicarTexturaPuerta]);
  const pickTexture = useCallback(async (which: 'wall' | 'floor' | 'door') => {
    setTexPicker(which);
    if (textures === null) setTextures(await repo.listTextures().catch(() => []));
  }, [textures, repo]);
  /**
   * EL BOTÓN DE ENSEÑARLE LOS MUROS A LOS JUGADORES (petición suya, 2026-09-03).
   *
   * El estado SALE DE LOS MUROS —«¿están todos visibles?»— y no de una columna nueva en la escena: él ya puede
   * marcar un muro suelto desde el panel de Builder, así que un interruptor guardado aparte se contradiría con
   * lo que se ve en cuanto lo hiciera. Sin muros no se ofrece: no hay nada que enseñar ni que esconder, y un
   * botón que no hace nada sólo sirve para dudar de si funciona.
   *
   * Va en un objeto que se esparce sobre `CanvasControls` para no repetir la condición en dos propiedades.
   */
  const wallsToPlayers = st.walls.length === 0 ? {} : {
    wallsToPlayers: st.walls.every(w => w.visiblePlayers),
    onWallsToPlayers: (visible: boolean) => run(st.setAllWallsVisible(visible)),
  };
  /**
   * ¿Lo cogido está ATADO? Sólo si TODOS comparten el mismo grupo. Media selección atada y media suelta se
   * ofrece como «agrupar», que es lo único que tiene sentido hacer con ella.
   */
  const grupoCogido = ((): string | null => {
    const cogidos = st.walls.filter(w => selectedWallIds.includes(w.id));
    const g = cogidos[0]?.groupId ?? null;
    return g && cogidos.length > 1 && cogidos.every(w => w.groupId === g) ? g : null;
  })();
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
  const removeLight = (id: string) => { setSelectedLightId(cur => (cur === id ? null : cur)); run(st.removeLight(id)); };
  const removeDrawing = (id: string) => { setSelectedDrawingId(cur => (cur === id ? null : cur)); run(st.eraseDrawing(id)); };
  const deleteSelection = () => {
    if (!isDm) return;
    // La LUZ va primero porque elegirla suelta lo demás: si hay una elegida, es LO elegido (dueño, 2026-09-02).
    if (selectedLight) { removeLight(selectedLight.id); return; }
    // Varios trazos cogidos con el área se borran juntos; uno solo sigue por su camino de siempre.
    if (selectedDrawingIds.length > 1) { selectedDrawingIds.forEach(id => removeDrawing(id)); setSelectedDrawingIds([]); return; }
    if (selectedDrawingId) { removeDrawing(selectedDrawingId); return; }
    // EL GRUPO antes que el muro suelto: si hay una pieza cogida, ESO es lo elegido y se borra entera.
    if (selectedWallIds.length > 1) { run(st.removeWalls(selectedWallIds)); setSelectedWallIds([]); return; }
    if (selectedWall) { run(st.removeWall(selectedWall.id)); setSelectedWallId(null); return; }
    // El vano de sala: `removeRoomOpening` existía desde la rebanada 8 y no la llamaba nadie.
    if (selectedRoomOpening) { run(st.removeRoomOpening(selectedRoomOpening.id)); setSelectedRoomOpeningId(null); return; }
    if (selectedTokens.length) { selectedTokens.forEach(tk => run(st.removeToken(tk.id))); setSelectedTokenIds([]); }
  };

  /**
   * CTRL+Z / CMD+Z para deshacer, y con MAYÚSCULAS para rehacer (§ «Rebanada 8»). Petición suya del
   * 2026-08-19, reclamada el 2026-09-03: «*el deshacer y el inverso no funciona*».
   *
   * Sólo el director: los muros y las salas son suyos, y un jugador no tiene nada que deshacer aquí. Y no
   * dispara mientras se escribe en un campo, o Ctrl+Z dentro del nombre de una escena borraría un muro.
   */
  useEffect(() => {
    if (!isDm) return undefined;
    const escribiendo = (el: EventTarget | null): boolean =>
      !!(el as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]');
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z' || escribiendo(e.target)) return;
      e.preventDefault();
      void (e.shiftKey ? st.history.redo() : st.history.undo());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDm, st.history]);

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

  const hiddenCount = fichas.filter(tk => !tk.visible).length;
  const bgName = live.bgImageUrl ? (images?.find(i => i.url === live.bgImageUrl)?.name ?? live.bgImageUrl.split('/').pop() ?? '') : t('maps.noBackground');
  return (
    <section className="mp-root">
      <div className="mp-stage-row">
        {scenesRail}
        {/*
          * Pasar a SELECCIONAR no cierra nada: es la otra mitad de Builder, no una salida. Cualquier otra
          * herramienta sí recoge los paneles, que flotan sobre el mismo mapa.
          */}
        <Toolbar tool={tool} isDm={isDm} playerView={playerView} onChange={next => {
            if (next !== 'select') closeOverlays(next === 'encounter' ? 'encounter' : undefined);
            if (next === 'wall') setBuilderOpen(true);
            else if (next !== 'select') setBuilderOpen(false);
            setTool(next);
          }}
          onDice={() => onOpenDice?.()} diceOpen={diceOpen}
          {...(isDm ? { onPlacePc: () => void openPcMenu(), placePcOpen: pcMenu, onBackground: () => void openBg(), backgroundOpen: bgOpen } : {})} />
        <div className="mp-stage" ref={stageRef}>
          {/* El lienzo pinta `shown`: la escena más el borrador de la escala que él esté arrastrando ahora. */}
          <MapCanvas scene={shown!} tokens={fichas} walls={st.walls} drawings={st.drawings} layers={st.layers} lights={st.lights} drags={drags} pin={st.pin} tool={tool} stroke={stroke} me={userId} isDm={isDm}
            playerView={playerView} probe={probe} onProbeMove={setProbe} showWalls={showWalls} fog={st.fog} brush={brush} wallKind={wallKind} wallShape={wallShape} snapGrid={snapGrid} chainNodes={chainNodes} view={view} onViewChange={setView} nameOf={nameOf}
            onCloseMenus={() => setQuickMenu(null)}
            onAddText={async at => {
              const text = await dialog.prompt(t('maps.text.prompt'));
              if (text?.trim()) run(st.addDrawing({ sceneId: live.id, campaignId, kind: 'text', data: { x: at.x, y: at.y, text: text.trim() }, color: stroke.color, width: stroke.width, layerId: activeLayerId }));
            }}
            onDragToken={(id, x, y, desired) => { const g = aGuardar(id, x, y); st.dragToken(id, g.x, g.y, aGuardar(id, desired.x, desired.y)); }}
            onMoveToken={(id, x, y) => { const g = aGuardar(id, x, y); run(st.moveToken(id, g.x, g.y)); }}
            onServerCorrection={id => { const c = st.serverCorrection(id); return c && aPintar(id, c.x, c.y); }}
            onDragBound={id => { const b = st.dragBound(id); return b && { ...b, ...aPintar(id, b.x, b.y) }; }}
            onAddDrawing={(kind, data) => run(st.addDrawing({ sceneId: live.id, campaignId, kind, data, color: stroke.color, width: stroke.width, layerId: activeLayerId }))}
            onErase={id => run(st.eraseDrawing(id))}
            onAddWall={(a, b) => {
              /**
               * DIBUJANDO AQUÍ, UNA RAYA NO ES UN MURO MARCADO — es geometría de la mazmorra (dueño,
               * 2026-09-04). Según lo que tenga elegido:
               *  · Puerta / Ventana → un VANO anotado sobre el contorno. No parte ninguna fila porque no hay
               *    fila: el muro de una sala es su contorno.
               *  · lo demás → un MURO DE RELLENO, o sea la raya con el grosor de la escena. Una raya no
               *    encierra nada y sola no podría tapar.
               */
              if (builderMode === 'draw') {
                if (isOpeningKind(buildKind)) {
                  /**
                   * ⚠️ AQUÍ NO SE EXIGE QUE HAYA UN MURO. Corrección suya del 2026-09-07: «*me estás pidiendo
                   * que exista un muro para poner la puerta cuando en el caso del constructor de habitaciones
                   * no funciona así*». En el constructor no hay filas de muro — la pared es el CONTORNO de lo
                   * excavado— así que negarse era traer aquí la regla del modo foto, donde sí hay un muro que
                   * recortar. Se pone donde él la puso y punto.
                   *
                   * Lo único que se conserva es el IMÁN: si hay una pared a mano, el trazo se clava en ella,
                   * que es lo que hace que la puerta se vea metida en el muro en vez de a un pelo de él. La
                   * tolerancia es el grosor del muro que se ve, porque es a lo que él apunta.
                   */
                  const crudo = { x1: a.x, y1: a.y, x2: b.x, y2: b.y, kind: buildKind, isOpen: false };
                  const vano = snapSpanToOutline(st.rooms, crudo, Math.max(live.grid.size / 2, wallWidthPx(live))) ?? crudo;
                  run(st.addRoomOpening({ ...vano, ...(buildKind === 'door' ? doorDraft : {}) }));
                } else {
                  const tira = wallStripe(a, b, wallWidthPx(live), live.grid.size);
                  if (tira.length) run(st.addRoomShape('rect', tira, 'fill'));
                  else setAvisoCorto(snapGrid ? 'snap' : 'short');
                }
                return;
              }
              // A door or a window drawn over a wall CUTS it instead of stacking on top of it (planOpening).
              // It also inherits whether the players could see that wall: otherwise their plan grows a gap
              // exactly where the doorway is.
              const plan = planOpening(st.walls, a, b, wallKind);
              run(st.addWall({ sceneId: live.id, campaignId, ...plan.opening, visiblePlayers: plan.splits[0]?.host.visiblePlayers ?? false, ...newWallOf(wallKind), ...(wallKind === 'door' ? doorDraft : {}) }, plan.splits));
            }}
            rooms={st.rooms} roomOpenings={st.roomOpenings} builderMode={builderMode} buildKind={buildKind}
            onTooSmall={locked => setAvisoCorto(locked ? 'snap' : 'short')}
            onAddRoomShape={(shape, points) => {
              // Una SALA excava y un MURO rellena: la misma forma con el signo cambiado (dueño, 2026-09-04).
              run(st.addRoomShape(shape, points, buildKind === 'wall' ? 'fill' : 'room'));
            }}
            onAddRoom={sides => {
              // Una sala son MUROS de los de siempre (§ «Rebanada 8»): opacos, y ocultos al jugador como
              // cualquier muro nuevo. Las puertas las abre él después, con el mismo disco.
              run(st.addRoom(sides.map(sd => ({ sceneId: live.id, campaignId, ...sd, visiblePlayers: false, ...newWallOf('wall') }))));
            }}
            onToggleWall={(w: Wall) => run(st.patchWall(w.id, { isOpen: !w.isOpen }))}
            onPaintFog={(at, op) => run(st.paintFog(at, op))}
            selectedLightId={selectedLightId} onSelectLight={setSelectedLightId}
            onMoveLight={(id, at) => run(st.patchLight(id, at))}
            selectedDrawingId={selectedDrawingId} onSelectDrawing={setSelectedDrawingId}
            selectedDrawingIds={selectedDrawingIds} onSelectDrawings={setSelectedDrawingIds}
            onMoveDrawing={(id, data) => run(st.moveDrawing(id, data))}
            onMoveDrawings={batch => batch.forEach(b => run(st.moveDrawing(b.id, b.data)))}
            fogVeil={fogVeil}
            maskLayerId={bgLayer?.id ?? null} maskPreview={mask.preview}
            onPaintMask={(from, to) => mask.paint(from, to, brushRadius(maskSizeCells, live.grid.size), maskStrength, maskDir, maskHardness)}
            onPaintMaskEnd={() => run(mask.flush())}
            onPlaceLight={async at => {
              // Nace con lo que trae su tipo; el editor se abre solo para retocarla sin buscarla.
              const created = await st.addLight(newLightOf('torch', at, { id: live.id, campaignId }, activeLayerId));
              setSelectedLightId(created.id);
            }}
            onPin={pt => { st.focusPin(pt); setView(v => centerOn(v, pt, viewport())); }}
            placing={!!encounter || !!pendingPc}
            // El tamaño con el que se COLOCA va por la lente, como todo lo demás. `placingSize` sólo sirve
            // para pasar de dónde hace clic (el CENTRO) a lo que se guarda (la esquina), y esa cuenta resta
            // medio cuerpo: si restara el tamaño sin encoger, la ficha caería descentrada del clic justo lo
            // que la barrita le quita —media casilla larga en un ENORME—. Lo que se GUARDA sigue siendo el
            // tamaño crudo de su ficha (`cellsOfSheet` / `cellsOfEntry` en `onPlace`): la lente no escribe.
            placingSize={tokenSizeIn({ size: pendingPc ? cellsOfSheet(pendingPc.data) : encounter ? cellsOfEntry(encounter) : DEFAULT_TOKEN_CELLS }, shown!)}
            onPlace={at => {
              if (pendingPc) { run(placePcAt(pendingPc, at)); return; }
              if (encounter) run(st.addToken(tokenFromBestiary(encounter, ts(encounter.label), campaignId, live.id, at, cellsOfEntry(encounter))));
            }}
            selectedTokenIds={selectedTokenIds} onSelectToken={id => setSelectedTokenIds(id ? [id] : [])} onMarquee={setSelectedTokenIds}
            selectedWallId={selectedWallId} onSelectWall={setSelectedWallId}
            selectedWallIds={selectedWallIds} onSelectWalls={setSelectedWallIds}
            selectedRoomOpeningId={selectedRoomOpeningId} onSelectRoomOpening={setSelectedRoomOpeningId}
            onToggleRoomOpening={o => run(st.toggleRoomOpening(o.id, !o.isOpen))}
            onTransformWalls={batch => {
              const byId = new Map(batch.map(b => [b.id, b]));
              run(st.transformWalls(st.walls.filter(w => byId.has(w.id)).map(w => ({ ...w, ...byId.get(w.id)! }))));
            }}
            onContextMenu={(at, pt) => { closeOverlays('quick'); setLayerMenu(null); setQuickMenu({ at, scene: pt }); }}
            onElementMenu={(at, element) => { closeOverlays('quick'); setQuickMenu(null); setLayerMenu({ at, element }); }}
            onDeleteSelection={deleteSelection}
            onMoveWall={(id, at) => run(st.patchWallGeometry(id, at))}
            /*
             * AÑADIR UN NODO: doble clic sobre la línea de un muro lo parte en dos por ahí (dueño,
             * 2026-09-03). Dentro de un grupo el PRIMER doble clic sigue entrando al muro suelto, como
             * hasta ahora, y es el siguiente el que pone el nodo — su decisión: «primero entra, luego el nodo».
             */
            onSplitWall={(id, at) => { const w = st.walls.find(x => x.id === id); if (w) run(st.splitWall(w, at)); }} />
          {isDm && (
            <div className="mp-dmtag" role="group" aria-label={t('maps.dmOptions')}>
              <span className="mp-dm-tag">{t('maps.dmOnly')}</span>
              <span className="tb-italic">{t('maps.dmCounts', { walls: String(st.walls.filter(w => w.kind === 'wall').length), doors: String(st.walls.filter(w => w.kind === 'door').length), windows: String(st.walls.filter(w => w.kind === 'window').length), hidden: String(hiddenCount) })} · {bgName}</span>
            </div>
          )}
          <span className={`mp-canvas-label ${isDm && playerView ? 'probe' : ''}`}>{isDm && playerView
            ? probe
              ? `${t('maps.probe.banner')} · ${t('maps.probe.note')}`
              : t('maps.probe.place')
            : isDm && !playerView
            ? `${t('maps.dmView')}${live.fogMode === 'vision' ? ` · ${t('maps.fog.byVision')}` : ''}${isBrush(tool) ? ` · ${t(`maps.brush.${tool}`)}` : ''}`
              : `${t('maps.playerVision', { name: live.name })}${live.lighting === 'night' ? ` · ${t('maps.light.night', { m: String(live.nightRadiusM) })}` : ''}`}</span>
          {/*
            * El pincel de niebla NO se ofrece viendo como jugador (dueño, 2026-09-02: «directamente no
            * funciona el ocultar o revelar»). Y no es que se rompiera: el lienzo lo ignora desde siempre en
            * ese modo —`if (!dmSight) return`, igual que Muro y Luz—, porque «ver como jugador» le quita al
            * director sus privilegios y pintar la niebla es uno. Lo que estaba mal era OFRECERLO: la barra
            * salía, se pintaba con ella y no pasaba nada.
            */}
          {(isDraw(tool) || (isDm && !playerView && isBrush(tool))) && (
            <StrokeBar value={stroke} onChange={setStroke} onClearMine={() => run(st.clearMine())} onClearAll={isDm ? () => run(st.clearAll()) : undefined}
              tool={tool}
              {...(isDm && !playerView && isBrush(tool) ? { brush, onBrush: setBrush, onRevealAll: () => run(st.paintAllFog('reveal')), onHideAll: () => run(st.paintAllFog('hide')) } : {})} />
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
              onReorderTo={(id, targetId) => run(st.reorderLayerTo(id, targetId))}
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
            ? <MaskBrushBar layerName={bgLayer.name || t('maps.layers.kind.terrain')} size={maskSizeCells} onSize={n => setMaskSizeCells(clampMaskSize(n))}
                strength={maskStrength} onStrength={setMaskStrength} hardness={maskHardness} onHardness={setMaskHardness}
                direction={maskDir} onDirection={setMaskDir}
                saving={mask.saving} onReset={() => run(mask.reset())} />
            : <p className="mp-mask-needs">{t('maps.mask.needsLayer')}</p>)}
          {isDm && !playerView && selectedLight && (
            <LightEditor light={selectedLight}
              onChange={patch => run(st.patchLight(selectedLight.id, patch))}
              onRemove={() => removeLight(selectedLight.id)}
              onClose={() => setSelectedLightId(null)} />
          )}
          {/*
            * EL PANEL DE BUILDER v3, y ya no la barra flotante vieja — orden suya del 2026-09-03: «*ya es hora
            * que dejes esto maqueteado en el menú que va y que dejes de agregar cosas en este*».
            */}
          {isDm && (builderOpen || selectedWall || selectedRoomOpening || selectedWallIds.length > 1) && (<>
            {/*
              * El selector de fichero: escondido, lo dispara «Subir» DENTRO del catálogo. Sube al catálogo de
              * la herramienta —no a la biblioteca de fondos de la campaña— y en la categoría que él tuviera
              * elegida, que es la que llega en `texUploadCat`.
              */}
            <input type="file" accept="image/*" ref={texInput} hidden data-testid="mp-room-texture-input"
              onChange={async e => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f || !texPicker) return;
                const nueva = await repo.addTexture(
                  { name: f.name.replace(/\.[^.]+$/, ''), category: texUploadCat, tileCells: DEFAULT_TEXTURE_SCALE },
                  f, campaignId);
                setTextures(l => [nueva, ...(l ?? [])]);
                aplicarTextura(nueva);
              }} />
            <BuilderPanel mode={builderMode} onMode={setBuilderMode}
              wall={selectedWall} kind={selectedWall ? selectedWall.kind : wallKind}
              buildKind={buildKind}
              onBuildKind={k => {
                setTool('wall');
                setBuildKind(k);
                // Si la forma que tenía elegida no puede levantar lo nuevo —una raya no hace una sala—, se
                // cae sola a una que sí. Dejarla puesta sería prometer un gesto que no iba a hacer nada.
                if (!shapesFor(k).includes(wallShape)) setWallShape(defaultShapeFor(k));
              }}
              onKind={k => {
                // Elegir QUÉ se levanta es elegir dibujar: la herramienta pasa a Builder sola. Sin esto, con
                // Seleccionar activo tocabas «Puerta» y seguías seleccionando — «*es super anti intuitivo*»
                // (dueño, 2026-09-04).
                setTool('wall');
                if (selectedWall) run(st.patchWall(selectedWall.id, { kind: k, ...WALL_FLAGS[k] }));
                else setWallKind(k);
                // Y lo mismo que con `buildKind`: un vano es un tramo recto, así que la forma se cae a una
                // que sirva. Sin esto quedaba un «círculo» elegido para una puerta, que no hace nada.
                // (Las tres clases de muro son también `BuildKind`, así que `k` vale tal cual.)
                if (!shapesFor(k).includes(wallShape)) setWallShape(defaultShapeFor(k));
              }}
              shape={wallShape} onShape={s => { setTool('wall'); setWallShape(s); }}
              snapGrid={snapGrid} onSnapGrid={setSnapGrid}
              chainNodes={chainNodes} onChainNodes={setChainNodes}
              preset={live.roomPreset} onPreset={k => run(patchScene(live.id, { roomPreset: k }))}
              wallTextureUrl={live.wallTextureUrl} floorTextureUrl={live.floorTextureUrl}
              onTexture={which => void pickTexture(which)}
              onClearTexture={which => run(patchScene(live.id, which === 'wall' ? { wallTextureUrl: null } : { floorTextureUrl: null }))}
              thickness={live.wallThickness} onThickness={v => run(patchScene(live.id, { wallThickness: v }))}
              wallScale={shown!.wallTextureScale} floorScale={shown!.floorTextureScale}
              onTextureScale={(which, cells) => setTexDraft(d => ({ ...d, [which === 'wall' ? 'wallTextureScale' : 'floorTextureScale']: cells }))}
              onTextureScaleEnd={() => {
                // Se guarda lo que quedó en pantalla, y sólo si de verdad cambió algo.
                if (texDraft) run(patchScene(live.id, texDraft));
                setTexDraft(null);
              }}
              // La barrita del tamaño va por el MISMO borrador que las escalas de textura, y por el mismo
              // motivo: mientras arrastra, `shown` lleva el valor de pantalla y TODAS las fichas encogen a la
              // vez —el previo que él quiere ver—; al soltar se escribe UNA sola vez.
              tokenScale={shown!.tokenScale}
              onTokenScale={v => setTexDraft(d => ({ ...d, tokenScale: v }))}
              onTokenScaleEnd={() => {
                if (texDraft) run(patchScene(live.id, texDraft));
                setTexDraft(null);
              }}
              groupCount={selectedWallIds.length} grouped={grupoCogido !== null}
              onGroup={() => run(st.groupWalls(selectedWallIds))}
              onUngroup={() => { if (grupoCogido) { run(st.ungroupWalls(grupoCogido)); setSelectedWallIds([]); } }}
              // Cerrar el panel es salir de Builder: vuelve a Seleccionar y suelta lo que hubiera cogido.
              onClose={() => { setBuilderOpen(false); setTool('select'); setSelectedWallId(null); setSelectedWallIds([]); setSelectedRoomOpeningId(null); }}
              /*
               * Con una puerta COGIDA, `onDoor` la edita a ella; sin nada cogido, cambia el borrador — el
               * mismo control para las dos cosas, que es lo que él aprobó en el `.pen`.
               */
              doorDraft={doorDraft}
              {...(!selectedWall && !selectedRoomOpening ? {
                /*
                 * Tocar un ajuste ARMA la herramienta, como ya hacían «qué levanto» y «con qué forma»
                 * (dueño, 2026-09-07: «*si selecciono una herramienta dentro de un modal quede el foco en
                 * la herramienta, me tengo que volver a hacer click o sencillamente no funciona*»). Elegir
                 * cómo será la puerta ES decir que vas a dibujar una.
                 */
                onDoor: (patch: Partial<DoorSettings>) => { setTool('wall'); setDoorDraft(d => ({ ...d, ...patch })); },
                onDoorTexture: () => { setTool('wall'); void pickTexture('door'); },
              } : {})}
              {...(selectedWall ? {
                onVisible: (v: boolean) => run(st.patchWall(selectedWall.id, { visiblePlayers: v })),
                onToggleOpen: () => run(st.patchWall(selectedWall.id, { isOpen: !selectedWall.isOpen })),
                onRemove: () => { run(st.removeWall(selectedWall.id)); setSelectedWallId(null); },
                onDoor: (patch) => run(st.patchWall(selectedWall.id, patch)),
                onDoorTexture: () => void pickTexture('door'),
              } : {})}
              /*
               * EL VANO DE SALA usa los MISMOS controles del panel: abrir, borrar y los ajustes de puerta. Sin
               * `onVisible`, que en una sala no hay nada que esconder — la sala ES el dibujo del mapa.
               */
              roomOpening={selectedRoomOpening}
              {...(selectedRoomOpening ? {
                onToggleOpen: () => run(st.toggleRoomOpening(selectedRoomOpening.id, !selectedRoomOpening.isOpen)),
                onRemove: () => { run(st.removeRoomOpening(selectedRoomOpening.id)); setSelectedRoomOpeningId(null); },
                onDoor: (patch) => run(st.patchRoomOpening(selectedRoomOpening.id, patch)),
                onDoorTexture: () => void pickTexture('door'),
              } : {})} />
            {texPicker && (
              <TextureCatalog which={texPicker} textures={textures} canManage={puedeOrdenarTexturas}
                onClose={() => setTexPicker(null)}
                onPick={aplicarTextura}
                onUpload={cat => { setTexUploadCat(cat); texInput.current?.click(); }}
                onUpdate={async (tex, patch) => {
                  await repo.updateTexture(tex.id, patch);
                  setTextures(l => (l ?? []).map(x => (x.id === tex.id ? { ...x, ...patch } : x)));
                }}
                onRemove={async tex => {
                  // Ya viene confirmado por él: el catálogo enseña el modal antes de llamar aquí.
                  await repo.removeTexture(tex.id);
                  setTextures(l => (l ?? []).filter(x => x.id !== tex.id));
                }} />
            )}
          </>)}
          {avisoCorto && (
            <div className="mp-placing" role="status">
              {t(avisoCorto === 'snap' ? 'maps.room.tooSmallSnap' : 'maps.room.tooSmall')}
            </div>
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
          {layerMenu && (
            <LayerMenu at={layerMenu.at} element={layerMenu.element} layers={st.layers}
              {...(layerMenu.element.kind === 'light' ? { onRemove: () => removeLight(layerMenu.element.id) } : {})}
              {...(layerMenu.element.kind === 'drawing' ? { onRemove: () => removeDrawing(layerMenu.element.id) } : {})}
              onPick={layerId => {
                const { kind, id } = layerMenu.element;
                if (kind === 'token') run(st.patchToken(id, { layerId }));
                else if (kind === 'light') run(st.patchLight(id, { layerId }));
                else run(st.patchDrawingLayer(id, layerId));
              }}
              onClose={() => setLayerMenu(null)} />
          )}
          {quickMenu && (
            <div className="mp-pop mp-quick" role="menu" aria-label={t('maps.quick.title')} style={{ left: quickMenu.at.x, top: quickMenu.at.y }}>
              {/*
                * «Seleccionar» ARRIBA DEL TODO (dueño, 2026-09-02: «al botón derecho agrégale como primera
                * opción la de seleccionar»). Es la vuelta a casa: se dibuja o se pinta con una herramienta y
                * se quiere volver a poder coger cosas sin ir hasta la barra. Se marca cuando ya lo está, para
                * que no parezca que no hizo nada.
                */}
              <button type="button" role="menuitem" className={`mp-menu-item ${tool === 'select' ? 'on' : ''}`}
                onClick={() => { closeOverlays(); setTool('select'); setQuickMenu(null); }}>
                <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>arrow_selector_tool</span>{t('maps.tool.select')}
              </button>
              <span className="mp-menu-sep" aria-hidden />
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
                const placed = fichas.some(tk => tk.characterId === c.id);
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
            fogVeil={fogVeil} onToggleFogVeil={() => setFogVeil(v => !v)}
            {...wallsToPlayers}
            onLighting={lighting => run(patchScene(live.id, { lighting }))}
            onSolidWalls={solidWalls => run(patchScene(live.id, { solidWalls }))}
            onZoomIn={() => setView(v => zoomAt(v, ZOOM_STEP, viewCenter()))} onZoomOut={() => setView(v => zoomAt(v, 1 / ZOOM_STEP, viewCenter()))}
            onCenter={() => setView(fitView(live, viewport()))} onToggleWalls={() => setShowWalls(w => !w)}
            onTogglePlayerView={() => {
              /**
               * Encender «ver como jugador» NO coloca la sonda: la pone ÉL, con un clic donde quiera (dueño,
               * 2026-09-02: «déjame poner el token donde quiera, no lo pongas automáticamente en el centro,
               * si no la prueba es una mierda»). Antes caía en mitad de lo que se estuviera mirando y desde
               * ahí tocaba arrastrarla, que con el mapa alejado es un viaje — y el sitio que importa para
               * probar casi nunca es el centro de la pantalla.
               *
               * Apagarlo se la lleva, y con ella la memoria que llevaba acumulada (§ 7.3). Nada se guarda.
               */
              const next = !playerView;
              setPlayerView(next);
              setProbe(null);
              // Y con Seleccionar en la mano: si se entrase con el Lápiz puesto, el clic que tiene que poner
              // la sonda se lo llevaría el lápiz y parecería que el modo no hace nada.
              if (next) setTool('select');
            }} />
        </div>
      </div>
      {failed && <p className="mp-foot mp-foot-err" role="alert">{t('maps.saveFailed')}</p>}
      {!isDm && <p className="mp-foot tb-italic tb-dim">{t('maps.dmDecides')} {live.lighting === 'night' ? t('maps.playerFootNight', { m: String(live.nightRadiusM) }) : t('maps.playerFoot')}</p>}
    </section>
  );
}
