import type { LitLight, SceneVision } from '@rolvium/core';
import type { Drawing, Layer, Light, Scene, Token, Wall } from '../domain/entities/Scene';
import { cellsPath, initialsOf, openingGeometry, polygonPoints, polygonsPath, tokenCenter } from '../domain/useCases/mapRules';
import { conePath, flickerOf, lightRadiusPx, maskSrc, terrainLayers } from '../domain/useCases/layerRules';

/** Presentational SVG pieces of the canvas (no pointer logic) — see MapCanvas.tsx. */

/**
 * Luminance values of an SVG `<mask>`, NOT colours: white = fully opaque, black = fully transparent.
 * They are the only place in the app where pure white is correct — a design token would be off-white and
 * would leak a few per cent of fog into what should be plainly visible. `npm run audit` flags them as
 * `design:#fff` warnings; this is the justification.
 */
const MASK_SHOW = '#ffffff';
const MASK_HIDE = '#000000';

/**
 * El color de base y —si la escena NO tiene capas de terreno— la foto de fondo de siempre.
 * `imageHidden` es la regla de convivencia de la rebanada 7: con capas de terreno manda la capa y
 * `bgImageUrl` se ignora, porque la migración subió esa foto a una capa pero dejó la columna en su sitio.
 */
export function BackgroundLayer({ scene, clipId, imageHidden = false }: { scene: Scene; clipId: string; imageHidden?: boolean }): JSX.Element {
  const { width, height, bgColor, bgTransform: tr } = scene;
  const bgImageUrl = imageHidden ? null : scene.bgImageUrl;
  return (
    <g className="mp-layer-bg" clipPath={`url(#${clipId})`}>
      <rect x={0} y={0} width={width} height={height} fill={bgColor} data-testid="mp-bg" />
      {bgImageUrl && tr.mode !== 'custom' && (
        <image href={bgImageUrl} x={0} y={0} width={width} height={height} preserveAspectRatio={tr.mode === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'} data-testid="mp-bg-image" />
      )}
      {bgImageUrl && tr.mode === 'custom' && (
        <image href={bgImageUrl} x={tr.x} y={tr.y} width={width * tr.scale} height={height * tr.scale} preserveAspectRatio="xMinYMin meet" data-testid="mp-bg-image" />
      )}
    </g>
  );
}

export function GridLayer({ scene, patternId }: { scene: Scene; patternId: string }): JSX.Element | null {
  if (!scene.grid.visible) return null;
  const g = scene.grid.size;
  return (
    <>
      <defs><pattern id={patternId} width={g} height={g} patternUnits="userSpaceOnUse"><path d={`M ${g} 0 L 0 0 0 ${g}`} className="mp-grid-line" fill="none" /></pattern></defs>
      <rect x={0} y={0} width={scene.width} height={scene.height} fill={`url(#${patternId})`} data-testid="mp-grid" />
    </>
  );
}

export function DrawingShape({ d, draft = false }: { d: Pick<Drawing, 'kind' | 'data' | 'color' | 'width'> & { id?: string }; draft?: boolean }): JSX.Element | null {
  const data = d.data as Record<string, unknown>;
  const common = { stroke: d.color, strokeWidth: d.width, fill: 'none', className: `mp-drawing ${draft ? 'draft' : ''}`, 'data-drawing-id': d.id, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (d.kind) {
    case 'stroke': {
      const pts = (data.points as [number, number][]) ?? [];
      if (pts.length === 1) return <circle cx={pts[0]![0]} cy={pts[0]![1]} r={d.width / 2} fill={d.color} className={common.className} data-drawing-id={d.id} />;
      return <polyline points={pts.map(p => p.join(',')).join(' ')} {...common} />;
    }
    case 'line': return <line x1={data.x1 as number} y1={data.y1 as number} x2={data.x2 as number} y2={data.y2 as number} {...common} />;
    case 'rect': {
      const x1 = data.x1 as number, y1 = data.y1 as number, x2 = data.x2 as number, y2 = data.y2 as number;
      return <rect x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)} {...common} />;
    }
    case 'circle': return <circle cx={data.cx as number} cy={data.cy as number} r={data.r as number} {...common} />;
    case 'text': return <text x={data.x as number} y={data.y as number} fill={d.color} className="mp-drawing mp-drawing-text" data-drawing-id={d.id}>{String(data.text ?? '')}</text>;
    default: return null;
  }
}

interface TokenProps { token: Token; grid: number; override?: { x: number; y: number } | null; selected: boolean; movable: boolean; label: string; hiddenLabel: string; onPointerDown?: (e: React.PointerEvent<SVGGElement>) => void }
export function TokenGlyph({ token, grid, override, selected, movable, label, hiddenLabel, onPointerDown }: TokenProps): JSX.Element {
  const pos = override ?? token;
  const c = tokenCenter({ ...pos, size: token.size }, grid);
  const r = (token.size * grid) / 2 - 1.5;
  const clip = `mp-tok-${token.id}`;
  return (
    <g className={`mp-token ${token.visible ? '' : 'hidden'} ${selected ? 'selected' : ''} ${movable ? 'movable' : ''}`} transform={`translate(${c.x} ${c.y})`}
      data-token-id={token.id} role="img" aria-label={`${label}${token.visible ? '' : ` (${hiddenLabel})`}`} onPointerDown={onPointerDown} tabIndex={-1}>
      {token.imageUrl && <clipPath id={clip}><circle r={r - 1} /></clipPath>}
      <circle r={r} className="mp-token-fill" style={token.color ? { fill: token.color } : undefined} />
      {token.imageUrl
        ? <image href={token.imageUrl} x={-r} y={-r} width={r * 2} height={r * 2} clipPath={`url(#${clip})`} preserveAspectRatio="xMidYMid slice" />
        : <text className="mp-token-initials" textAnchor="middle" dominantBaseline="central" style={{ fontSize: Math.max(8, r * 0.85) }}>{initialsOf(token.name)}</text>}
      <circle r={r} className="mp-token-ring" style={token.color && token.visible ? { stroke: token.color } : undefined} />
      {selected && <circle r={r + 4} className="mp-token-sel" />}
      <text className="mp-token-name" y={r + 11} textAnchor="middle">{token.name}</text>
    </g>
  );
}

/**
 * A wall segment. `wall` is a plain gold line; a closed door adds a dark core between two jambs; an open one
 * keeps the threshold faint and swings its leaf out; a window is steel and never cuts sight
 * (rolvium.pen `uXK3T` · Muro / Puerta cerrada / Puerta abierta / Ventana).
 */
export function WallShape({ wall, selected = false, draft = null }: { wall: Wall; selected?: boolean; draft?: { x1: number; y1: number; x2: number; y2: number } | null }): JSX.Element {
  const line = draft ?? { x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 };
  const cls = `mp-wall ${wall.kind} ${wall.isOpen ? 'open' : ''} ${wall.visiblePlayers ? 'visible' : ''} ${selected ? 'selected' : ''}`;
  if (wall.kind === 'wall') return <line {...line} className={cls} data-wall-id={wall.id} data-wall-kind={wall.kind} />;
  const g = openingGeometry(line);
  return (
    <g className={`mp-opening ${wall.kind} ${wall.isOpen ? 'open' : ''} ${selected ? 'selected' : ''}`} data-wall-id={wall.id} data-wall-kind={wall.kind} data-open={wall.isOpen ? 'true' : 'false'}>
      <line {...line} className={cls} />
      {wall.kind === 'door' && !wall.isOpen && <line {...line} className="mp-wall-core" />}
      {wall.kind === 'door' && wall.isOpen && <line x1={g.leaf[0].x} y1={g.leaf[0].y} x2={g.leaf[1].x} y2={g.leaf[1].y} className="mp-wall-leaf" />}
      <line x1={g.jambA[0].x} y1={g.jambA[0].y} x2={g.jambA[1].x} y2={g.jambA[1].y} className="mp-wall-jamb" />
      <line x1={g.jambB[0].x} y1={g.jambB[0].y} x2={g.jambB[1].x} y2={g.jambB[1].y} className="mp-wall-jamb" />
    </g>
  );
}

interface FogProps { scene: Scene; fog: SceneVision; ids: { seen: string; lit: string; dim: string; unexplored: string } }

/**
 * Lo BORROSO que es el borde de la niebla, en px de escena.
 *
 * Existe por dos quejas del dueño el 2026-08-22, que resultaron ser la misma cosa:
 *  - «el borde de la niebla, a cuadros»: lo YA EXPLORADO se guarda por casillas, así que su contorno es una
 *    escalera de 27 px. Difuminarlo la deshace sin cambiar cómo se guarda.
 *  - «si es de noche que la visión sea más corta pero que no termine de manera abrupta, sino con un fade»:
 *    de noche la visión se recorta contra un círculo, y ese corte es una cuchillada.
 *
 * Por eso son DOS valores: de día el borde lo ponen los muros y sólo hay que quitarle la escalera a lo
 * explorado, así que basta un pelín; de noche el corte es el del alcance de la luz, que en el mundo real se
 * apaga poco a poco. Se difumina la MÁSCARA, no el mapa: lo que se ve sigue nítido, lo que se difumina es
 * dónde deja de verse.
 */
export const FOG_FEATHER = { day: 5, night: 22 } as const;
const fogFeather = (lighting: Scene['lighting']): number => (lighting === 'night' ? FOG_FEATHER.night : FOG_FEATHER.day);

/**
 * The masks the fog is painted with. Everything comes from the API — this only turns polygons and cells into SVG.
 *
 * `seen` = explored ∪ current vision (what exists at all for a player) · `lit` = current vision only (tokens) ·
 * `dim` = everything but the current vision (darkens the remembered part) · `unexplored` = the DM's blue veil.
 */
export function FogMasks({ scene, fog, ids }: FogProps): JSX.Element {
  const cells = cellsPath(fog.explored, scene.grid.size);
  const full = { x: 0, y: 0, width: scene.width, height: scene.height };
  const polys = fog.vision.map((poly, i) => <polygon key={i} points={polygonPoints(poly)} fill={MASK_SHOW} />);
  /**
   * Lo que alumbran las luces cuenta como VISTO, y sólo en niebla «visión» (§ 7.2). El servidor ya lo mandó
   * recortado contra tu línea de vista, así que sumarlo aquí es la regla del dueño tal cual: ves un punto si
   * tienes línea de vista Y (te queda dentro de tu alcance O lo alcanza una luz).
   *
   * En «manual» manda el pincel del director y en «off» ya se ve todo, así que ahí las luces siguen llegando
   * —hacen falta para recortar su resplandor contra los muros— pero no revelan nada por su cuenta.
   */
  const litParts = scene.fogMode === 'vision' ? polygonsPath((fog.lit ?? []).flatMap(l => l.parts)) : '';
  const feather = fogFeather(scene.lighting);
  const blurId = `${ids.seen}-feather`;
  const blur = `url(#${blurId})`;
  /**
   * Las máscaras se pintan con MARGEN (`-feather*3`) y no justo en el borde de la escena: un desenfoque sobre
   * un rectángulo que acaba en el filo se come su propio borde y deja el mapa con una orla apagada por los
   * cuatro lados. Con margen, el degradado sólo aparece donde de verdad hay un borde de niebla.
   */
  const pad = feather * 3;
  const wide = { x: -pad, y: -pad, width: scene.width + pad * 2, height: scene.height + pad * 2 };
  return (
    <>
      <filter id={blurId} x="-20%" y="-20%" width="140%" height="140%" filterUnits="objectBoundingBox">
        <feGaussianBlur stdDeviation={feather} />
      </filter>
      <mask id={ids.seen} maskUnits="userSpaceOnUse" {...full}>
        <rect {...wide} fill={MASK_HIDE} />
        <g filter={blur}>
          {cells && <path d={cells} fill={MASK_SHOW} />}
          {polys}
          {litParts && <path d={litParts} fill={MASK_SHOW} data-testid="mp-fog-lit" />}
        </g>
      </mask>
      <mask id={ids.lit} maskUnits="userSpaceOnUse" {...full}>
        <rect {...wide} fill={MASK_HIDE} />
        <g filter={blur}>
          {polys}
          {litParts && <path d={litParts} fill={MASK_SHOW} />}
        </g>
      </mask>
      <mask id={ids.dim} maskUnits="userSpaceOnUse" {...full}>
        <rect {...wide} fill={MASK_SHOW} />
        <g filter={blur}>
          {fog.vision.map((poly, i) => <polygon key={i} points={polygonPoints(poly)} fill={MASK_HIDE} />)}
          {litParts && <path d={litParts} fill={MASK_HIDE} />}
        </g>
      </mask>
      <mask id={ids.unexplored} maskUnits="userSpaceOnUse" {...full}>
        <rect {...wide} fill={MASK_SHOW} />
        <g filter={blur}>{cells && <path d={cells} fill={MASK_HIDE} />}</g>
      </mask>
    </>
  );
}

// ── Rebanada 7: capas de terreno con máscara, y luces de ambiente ────────────

/**
 * Las capas de TERRENO, de abajo arriba, cada una con su máscara del pincel de transparencia.
 *
 * **Regla de convivencia con el fondo de siempre**: si la escena tiene alguna capa de terreno, manda la capa
 * y `scene.bgImageUrl` se IGNORA. Está así porque la migración subió la foto de fondo de cada escena a una
 * capa de terreno pero no vació la columna — pintar las dos sería pintar la misma foto dos veces, y vaciarla
 * habría dejado las escenas en negro entre la migración y este despliegue. El color de base se pinta siempre:
 * es lo que se ve donde no llega ninguna foto.
 *
 * La máscara es un PNG con brochazos NEGROS semitransparentes sobre nada. Dentro de un `<mask>` de SVG el
 * valor es luminancia × alfa, así que va sobre un rectángulo BLANCO: donde no hay brochazo queda blanco (se
 * ve entero), un brochazo a fuerza máxima deja negro (no se ve) y a media, gris (translúcido). La foto
 * original no se toca en ningún momento — de ahí que siempre se pueda volver atrás.
 */
export function TerrainLayers({ scene, layers, clipId, preview = null }: { scene: Scene; layers: readonly Layer[]; clipId: string;
  /** La máscara EN VIVO de la capa que se está pintando: manda sobre la guardada hasta que ésta suba. */
  preview?: { layerId: string; href: string | null } | null }): JSX.Element {
  const terrain = terrainLayers(layers).filter(l => l.visible && l.imageUrl);
  return (
    <g className="mp-layer-terrain" clipPath={`url(#${clipId})`} data-testid="mp-terrain">
      {terrain.map(l => {
        const mask = preview && preview.layerId === l.id ? preview.href : maskSrc(l);
        const maskId = `mp-mask-${l.id}`;
        const tr = l.transform;
        const box = tr.mode === 'custom'
          ? { x: tr.x, y: tr.y, width: scene.width * tr.scale, height: scene.height * tr.scale, preserveAspectRatio: 'xMinYMin meet' }
          : { x: 0, y: 0, width: scene.width, height: scene.height, preserveAspectRatio: tr.mode === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet' };
        return (
          <g key={l.id} data-layer-id={l.id} data-testid="mp-terrain-layer">
            {mask && (
              <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={scene.width} height={scene.height}>
                <rect x={0} y={0} width={scene.width} height={scene.height} fill={MASK_SHOW} />
                <image href={mask} x={0} y={0} width={scene.width} height={scene.height} preserveAspectRatio="none" data-testid="mp-terrain-mask" />
              </mask>
            )}
            <image href={l.imageUrl!} {...box} {...(mask ? { mask: `url(#${maskId})` } : {})} />
          </g>
        );
      })}
    </g>
  );
}

/**
 * Las luces de ambiente. HOY SON PINTURA: no revelan niebla, no cambian lo que ve nadie y no entran en el
 * cálculo de visión del servidor. Lo único que hacen además de estar quietas es PARPADEAR, porque animar
 * también es pintar (dueño, 2026-08-31) — y el ritmo lo pone el tipo de luz, no un control aparte.
 *
 * El degradado va de opaco en el centro a transparente en el borde, y se compone en modo `screen` (en CSS)
 * para que sume luz en vez de tapar el mapa.
 */
/**
 * `lit` es lo que el servidor contestó que alumbra CADA luz, ya recortado contra los muros y contra lo que
 * este espectador alcanza a ver (§ 7.2). Tres casos, y los tres importan:
 *
 *  - `undefined` — todavía no ha contestado (o la escena no tiene ninguna luz que calcular): se pinta el
 *    resplandor entero, como antes. Es lo mismo que hace el resto del lienzo mientras no hay niebla: enseñar
 *    de más un instante es mejor que un parpadeo negro.
 *  - la luz SÍ está en la lista: su resplandor se recorta a lo que alumbra de verdad. Esto es lo que hace que
 *    una antorcha deje de iluminar al otro lado de la pared.
 *  - la luz NO está: no alumbra nada que este espectador pueda ver, así que no se pinta. Pintarla igual
 *    dejaría el resplandor flotando sobre la niebla, delatando que ahí hay una luz.
 */
/** La forma de una luz —cono, cuadrado o radio— como nodo de SVG. Se pinta dos veces: la luz y su máscara. */
function lightShape(l: Light, r: number, props: Record<string, unknown>): JSX.Element {
  if (l.shape === 'cone') return <path d={conePath(l, r)} {...props} />;
  if (l.shape === 'square') return <rect x={l.x - r} y={l.y - r} width={r * 2} height={r * 2} {...props} />;
  return <circle cx={l.x} cy={l.y} r={r} {...props} />;
}

/**
 * Lo BORROSO que es el borde de una luz, en px de escena. Existe por una queja del dueño (2026-08-31, sobre
 * un cono: «cuidado con los bordes del cono que no sean una línea dura»).
 *
 * Un borde de luz no es un canto: se apaga. Y desde § 7.2 el resplandor va RECORTADO —contra los muros y
 * contra lo que el que mira alcanza a ver—, y un recorte es por definición una tijera: sin difuminar, la
 * sombra de una pared y los dos lados del cono salían como rayas trazadas con regla.
 *
 * Se difumina la MÁSCARA y no la luz: el color no se ensucia, lo único que se suaviza es dónde deja de
 * llegar. Es la misma solución que la niebla usa desde la rebanada 2, y por el mismo motivo.
 *
 * Proporcional al alcance: una antorcha de dos metros con el difuminado de un foco de treinta no se vería.
 */
export const lightFeather = (radius: number): number => Math.max(5, radius * 0.13);

/**
 * ¿Esta luz GIRA? (§ 7.2). Sólo un cono: un radio ya alumbra en redondo y un cuadrado girando no dice nada.
 * `spinMs` es lo que tarda una vuelta entera; `0` es «quieta».
 */
export const spins = (l: Pick<Light, 'shape' | 'spinMs'>): boolean => l.shape === 'cone' && (l.spinMs ?? 0) > 0;

export function LightsLayer({ scene, lights, lit }: { scene: Scene; lights: readonly Light[]; lit?: readonly LitLight[] }): JSX.Element {
  const shown = lights.map(l => ({ light: l, parts: lit?.find(x => x.id === l.id)?.parts ?? null }))
    .filter(({ parts }) => !lit || parts !== null);
  /** La caja que ocupa una luz: su forma más el margen que necesita el desenfoque para no comerse su propio borde. */
  const boxOf = (l: Light): { r: number; f: number; pad: number } => {
    const r = lightRadiusPx(l, scene.grid);
    const f = lightFeather(r);
    return { r, f, pad: r * 1.6 + f * 4 };
  };
  return (
    <g className="mp-layer-lights" data-testid="mp-lights">
      <defs>
        {shown.map(({ light: l }) => {
          const { r } = boxOf(l);
          /**
           * El degradado va en COORDENADAS DE LA ESCENA y centrado en la luz, no en la caja de su forma
           * (dueño, 2026-09-01: «la luz brillante debería salir del vértice del cono, no aparecer en el centro
           * del mismo como ahora»). Por omisión un `radialGradient` se mide contra la caja del objeto, así que
           * en un cono el punto brillante caía en mitad del triángulo — a media pared, en vez de en la antorcha.
           */
          return (
            <radialGradient key={l.id} id={`mp-light-${l.id}`} gradientUnits="userSpaceOnUse" cx={l.x} cy={l.y} r={r}>
              <stop offset="0%" stopColor={l.color} stopOpacity={0.65} />
              <stop offset="55%" stopColor={l.color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={l.color} stopOpacity={0} />
            </radialGradient>
          );
        })}
        {shown.map(({ light: l }) => {
          const { f, pad } = boxOf(l);
          // La región del filtro va en px de escena y con el mismo margen que la máscara: un desenfoque que
          // acaba en el filo de su región se recorta a sí mismo y devuelve el canto que veníamos a quitar.
          return (
            <filter key={l.id} id={`mp-lightblur-${l.id}`} filterUnits="userSpaceOnUse"
              x={l.x - pad} y={l.y - pad} width={pad * 2} height={pad * 2}>
              <feGaussianBlur stdDeviation={f} />
            </filter>
          );
        })}
        {shown.filter(({ light: l }) => spins(l)).map(({ light: l }) => {
          const { r, pad } = boxOf(l);
          /**
           * LA VENTANA QUE GIRA (§ 7.2 «la luz que gira», petición del dueño: «como una sirena»).
           *
           * El servidor manda el CÍRCULO entero ya recortado contra los muros, y el barrido se hace aquí
           * rotando encima esta ventana con forma de cono. Es exacto, no un apaño: el recorte contra la
           * piedra es radial —cada rayo se corta en la primera pared—, así que «cono girado a θ, recortado»
           * es «círculo recortado ∩ sector de θ». Calcular las 24 rotaciones en el servidor costaría 24 veces
           * más en CADA petición de visión, y él ya se quejó de que «está todo lentísimo».
           *
           * `animateTransform` con `rotate ángulo cx cy` gira alrededor de la LUZ sin depender de dónde caiga
           * la caja del cono. Y el `begin` negativo saca la fase del reloj: todos en la mesa ven el haz
           * apuntando al mismo sitio, entren cuando entren.
           */
          return (
            <mask key={l.id} id={`mp-litspin-${l.id}`} maskUnits="userSpaceOnUse" x={l.x - pad} y={l.y - pad} width={pad * 2} height={pad * 2}>
              <g data-testid="mp-light-spin" data-spin-ms={l.spinMs}>
                <path d={conePath(l, r * 1.6)} fill={MASK_SHOW} />
                <animateTransform attributeName="transform" type="rotate" repeatCount="indefinite"
                  from={`0 ${l.x} ${l.y}`} to={`360 ${l.x} ${l.y}`} dur={`${l.spinMs}ms`} begin={`-${Date.now() % l.spinMs}ms`} />
              </g>
            </mask>
          );
        })}
        {shown.map(({ light: l, parts }) => {
          const { r, pad } = boxOf(l);
          const pool = parts
            ? <path d={polygonsPath(parts)} fill={MASK_SHOW} data-testid="mp-light-shape" />
            : lightShape(l, r, { fill: MASK_SHOW, 'data-testid': 'mp-light-shape' });
          return (
            <mask key={l.id} id={`mp-litmask-${l.id}`} maskUnits="userSpaceOnUse" x={l.x - pad} y={l.y - pad} width={pad * 2} height={pad * 2}>
              <g filter={`url(#mp-lightblur-${l.id})`}>
                {spins(l) ? <g mask={`url(#mp-litspin-${l.id})`}>{pool}</g> : pool}
              </g>
            </mask>
          );
        })}
      </defs>
      {shown.map(({ light: l }) => {
        const { pad } = boxOf(l);
        const rhythm = flickerOf(l);
        const style = rhythm
          ? ({ animationDuration: `${rhythm.periodMs}ms`, '--mp-flicker': String(rhythm.depth) } as React.CSSProperties)
          : undefined;
        /**
         * Lo que se PINTA es la caja entera, y la forma la pone la MÁSCARA — no al revés (dueño, 2026-09-01:
         * «las luces cónicas sigue teniendo el borde duro»).
         *
         * Antes se pintaba el cono y se le ponía encima su propia silueta difuminada. Multiplicar una forma por
         * su propio borde borroso no difumina nada: justo en el filo la máscara vale la mitad y fuera no hay
         * nada que pintar, así que el resultado saltaba de medio a cero de golpe — una raya, más tenue pero
         * raya. Pintando de sobra y dejando que la máscara sea la única que decide dónde acaba, el apagón
         * ocurre entero dentro de lo pintado y el borde sale como tiene que salir: apagándose.
         *
         * No se sale de su alcance por pintar de más: el degradado ya llega a cero en el radio de la luz.
         */
        return (
          <rect key={l.id} x={l.x - pad} y={l.y - pad} width={pad * 2} height={pad * 2}
            className={`mp-light ${rhythm ? (rhythm.sharp ? 'flicker-sharp' : 'flicker-soft') : ''}`}
            fill={`url(#mp-light-${l.id})`}
            style={style}
            mask={`url(#mp-litmask-${l.id})`}
            data-light-id={l.id}
            data-testid="mp-light" />
        );
      })}
    </g>
  );
}
