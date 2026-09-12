import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { Tooltip } from '@rolvium/ui';
import { DM_TOOLS, DRAW_TOOLS, PLAYER_TOOLS, TOOLS_NOT_YET, type Tool } from '../domain/useCases/mapRules';
import { moveToolbarItem, resolvedToolbarOrder, TOOLBAR_SEP, type ToolbarBlock, type ToolbarOrder } from '../domain/useCases/toolbarRules';

/**
 * «Builder» no usa un icono de Material: usa el DIBUJO DEL DUEÑO (`apps/web/public/icons/builder.png`, sacado
 * de su «walls doors and windows.png», al que se le quitó el fondo). Se reconoce porque empieza por `/`.
 *
 * Lo que se PINTA es `builder-mask.png`, no el dibujo original (dueño, 2026-09-01: «el icono se ve muy
 * claro respecto a los otros»). El motivo, medido: el dibujo son trazos finos y muy suavizados —de sus 16 384
 * píxeles sólo 725 son opacos del todo—, así que al encogerlo a `--icon-sm` el navegador promedia trazo con
 * transparencia y **la máscara no pasaba de 152 sobre 255**: el icono nunca llegaba a teñirse del color del
 * botón, y al lado de un Material Symbol —que a ese tamaño sí llega a 255— se veía descolorido.
 * `builder-mask.png` es SU MISMO dibujo con el alfa engordado 2 px y las medias tintas levantadas, que a
 * tamaño real lo deja en 252. **El original no se ha tocado** y sigue en la carpeta.
 */
const ICONS: Record<Tool, string> = { select: 'arrow_selector_tool', measure: 'straighten', pin: 'location_on', pencil: 'edit', line: 'horizontal_rule', rect: 'crop_square', circle: 'circle', text: 'title', erase: 'ink_eraser', wall: '/icons/builder-mask.png', reveal: 'visibility', hide: 'visibility_off', mask: 'brush', light: 'wb_incandescent', encounter: 'swords' };
const esImagen = (icon: string): boolean => icon.startsWith('/');

/** Actions that open a panel instead of changing the cursor: they are buttons, not tools. */
interface Action { id: 'dice' | 'placePc' | 'background'; icon: string; onClick: () => void; on?: boolean }

interface Props {
  tool: Tool;
  isDm: boolean;
  /**
   * «Ver como jugador» puesto. Las herramientas del director se enseñan APAGADAS, no se esconden: ese modo
   * ya les quitaba el efecto en el lienzo (`if (!dmSight) return` en Muro, Luz y el pincel de niebla), pero
   * la barra las seguía ofreciendo — se pintaba con ellas y no pasaba nada, que es peor que no poder
   * (dueño, 2026-09-02: «directamente no funciona el ocultar o revelar»). Apagadas y no escondidas para que
   * la barra no baile de sitio al entrar y salir del modo.
   */
  playerView?: boolean;
  onChange: (tool: Tool) => void;
  /** «Lanzador de dados» — the first button of all (specs/modules/maps/SPEC.md § «Rebanada 3»). */
  onDice: () => void;
  diceOpen?: boolean;
  /** DM panels that used to live in the scene header, which no longer exists. */
  onPlacePc?: () => void;
  placePcOpen?: boolean;
  onBackground?: () => void;
  backgroundOpen?: boolean;
  /**
   * 🧲 EL ORDEN QUE PUSO EL ADMIN PARA TODOS (spec § «La barra se ordena arrastrando, y el orden lo pone el admin
   * para todos», 2026-09-12). Ausente o `null` = el de serie. Se sanea aquí contra el de serie: un botón desconocido
   * se ignora y uno que falte cae en su sitio.
   */
  order?: ToolbarOrder | null;
  /** Sólo quien administra los ajustes de la plataforma arrastra. Para los demás la barra es la de siempre. */
  canReorder?: boolean;
  /** Al soltar: el bloque y su lista nueva de botones (las rayas `sep` del director van dentro). */
  onReorder?: (block: ToolbarBlock, next: string[]) => void;
}

function Btn({ label, icon, on, dm, disabled, onClick }: { label: string; icon: string; on: boolean; dm?: boolean; disabled?: boolean; onClick: () => void }): JSX.Element {
  return (
    <Tooltip label={label}>
      <button type="button" className={`mp-tool ${on ? 'on' : ''} ${dm ? 'dm' : ''}`} aria-pressed={on} aria-label={label} disabled={disabled} onClick={onClick}>
        {esImagen(icon)
          /*
           * Va de MÁSCARA y no de `<img>`: el color lo pone el botón (`currentColor`), así que se tiñe solo
           * cuando la herramienta está seleccionada —fondo negro, icono claro— igual que todos sus vecinos.
           * Con un `<img>` el dibujo, que es oscuro, desaparecería sobre el negro justo al elegirlo.
           */
          ? <span className="mp-tool-img" data-testid="mp-tool-img" style={{ maskImage: `url(${icon})`, WebkitMaskImage: `url(${icon})` }} />
          : <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>{icon}</span>}
      </button>
    </Tooltip>
  );
}

/**
 * LAS SEIS DE DIBUJAR, EN UN SOLO ICONO (dueño, 2026-09-03: «*quiero que todas estas sean un solo icono y
 * cuando hagas click despliegue al lado un menú con las opciones de dibujo libre, para ahorrar espacio en la
 * barra de herramientas*»). Seis botones ocupaban seis alturas de barra sobre un mapa que quiere todo el
 * alto que le den.
 *
 * El icono ENSEÑA LA HERRAMIENTA PUESTA: con Lápiz activo se ve el lápiz, no un icono genérico. Si no, no
 * habría forma de saber con qué estás dibujando sin abrir el menú.
 *
 * El menú va `fixed` y medido sobre el botón: la barra tiene `overflow:auto`, así que uno absoluto se
 * recortaría contra ella — el mismo motivo por el que los paneles se pasan a `fixed` al agarrarlos.
 */
function DrawTools({ tool, label, onChange }: { tool: Tool; label: (id: Tool) => string; onChange: (t: Tool) => void }): JSX.Element {
  const { t } = useTranslation();
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const activa = DRAW_TOOLS.includes(tool) ? tool : null;

  useEffect(() => {
    if (!at) return undefined;
    const fuera = (e: Event): void => { if (!box.current?.contains(e.target as Node)) setAt(null); };
    const tecla = (e: KeyboardEvent): void => { if (e.key === 'Escape') setAt(null); };
    window.addEventListener('pointerdown', fuera);
    window.addEventListener('keydown', tecla);
    return () => { window.removeEventListener('pointerdown', fuera); window.removeEventListener('keydown', tecla); };
  }, [at]);

  const abrir = (e: React.MouseEvent<HTMLButtonElement>): void => {
    if (at) { setAt(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    // Al lado, pegado a su derecha y a su misma altura: es donde él lo pidió, «al lado».
    setAt({ x: r.right + 4, y: r.top });
  };

  return (
    <div className="mp-drawtools" ref={box}>
      <Tooltip label={t('maps.tool.draw')}>
        <button type="button" className={`mp-tool ${activa ? 'on' : ''}`} aria-haspopup="menu" aria-expanded={!!at}
          aria-label={t('maps.tool.draw')} onClick={abrir}>
          <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>{activa ? ICONS[activa] : 'draw'}</span>
        </button>
      </Tooltip>
      {at && (
        <div className="mp-pop mp-drawmenu" role="menu" aria-label={t('maps.tool.draw')} style={{ position: 'fixed', left: at.x, top: at.y }}>
          {DRAW_TOOLS.map(id => (
            <button key={id} type="button" role="menuitemradio" aria-checked={tool === id}
              className={`mp-menu-item ${tool === id ? 'on' : ''}`}
              onClick={() => { onChange(tool === id ? 'select' : id); setAt(null); }}>
              <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>{ICONS[id]}</span>
              {label(id)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The single vertical bar of the scene, in three labelled blocks (rolvium.pen · «Escena · Director»):
 *
 *   play    Dados · Seleccionar · Medir · Pin        — what you touch while playing
 *   canvas  Lápiz · Línea · Caja · Círculo · Borrar  — drawing on the map
 *   dm      Luces · Muro · Imágenes · Pincel ‖ Revelar · Ocultar ‖ Encuentro · Colocar PJ
 *
 * The DM order is the owner's, fixed on 2026-08-31: «ponlo arriba de los muros y ventanas, y debajo de muros
 * y ventanas el de imágenes… le demos coherencia al orden». The criterion is to group first what BUILDS the
 * scene, then the fog, then the game. «Piezas» opens this block in `rolvium.pen` but is not here yet: it needs
 * the props gallery (slice 6), and a button that opens nothing is worse than no button.
 *
 * The blocks are separated by rules, not by written labels: labels made the bar wide enough to eat map. What
 * changes the cursor and what opens a panel still must not look alike, so the DM panels sit behind their own rule.
 * A player never gets the DM block at all.
 * Panning is NOT here: it is a modifier (space bar or middle button), so it works from every tool.
 */
export function Toolbar(p: Props): JSX.Element {
  const { t } = useTranslation();
  const dormida = (id: Tool): boolean => !!p.playerView && DM_TOOLS.includes(id);
  const label = (id: Tool) => (TOOLS_NOT_YET.includes(id)
    ? `${t(`maps.tool.${id}`)} · ${t('maps.tool.soon')}`
    : dormida(id) ? `${t(`maps.tool.${id}`)} · ${t('maps.tool.notInPlayerView')}` : t(`maps.tool.${id}`));
  const herramienta = (id: Tool): JSX.Element | null => (p.isDm || PLAYER_TOOLS.includes(id)
    ? <Btn label={label(id)} icon={ICONS[id]} on={p.tool === id} dm={DM_TOOLS.includes(id)} disabled={TOOLS_NOT_YET.includes(id) || dormida(id)} onClick={() => p.onChange(p.tool === id ? 'select' : id)} />
    : null);
  const accion = (a: Action): JSX.Element => <Btn label={t(`maps.action.${a.id}`)} icon={a.icon} on={!!a.on} dm={a.id !== 'dice'} onClick={a.onClick} />;

  /**
   * 🧲 EL ORDEN LO PONE EL ADMIN PARA TODOS (spec § «La barra se ordena arrastrando…», 2026-09-12). Cada bloque se
   * pinta desde su lista —la guardada, saneada contra la de serie en `toolbarRules`— y el orden es de BOTONES: los
   * de panel (Dados, Fondo del mapa, Colocar PJ) van intercalados con las herramientas porque así lo ordenó él el
   * 31-ago («Imágenes» con lo que CONSTRUYE la escena, «Colocar PJ» con lo que arranca la partida), y las dos rayas
   * de dentro del bloque del director viajan en la lista como ítems `sep` que no se arrastran.
   */
  const orden = resolvedToolbarOrder(p.order);
  const pieza = (id: string): JSX.Element | null => {
    switch (id) {
      case TOOLBAR_SEP: return <span className="mp-tool-sep" aria-hidden />;
      case 'dice': return accion({ id: 'dice', icon: 'casino', onClick: p.onDice, ...(p.diceOpen !== undefined ? { on: p.diceOpen } : {}) });
      case 'draw': return <DrawTools tool={p.tool} label={label} onChange={p.onChange} />;
      case 'background': return p.onBackground ? accion({ id: 'background', icon: 'image', onClick: p.onBackground, ...(p.backgroundOpen !== undefined ? { on: p.backgroundOpen } : {}) }) : null;
      case 'placePc': return p.onPlacePc ? accion({ id: 'placePc', icon: 'person_add', onClick: p.onPlacePc, ...(p.placePcOpen !== undefined ? { on: p.placePcOpen } : {}) }) : null;
      default: return id in ICONS ? herramienta(id as Tool) : null;
    }
  };

  /**
   * ARRASTRAR PARA ORDENAR — sólo con `canReorder` (quien administra los ajustes). Arrastre nativo del navegador,
   * el mismo que las capas de terreno del panel de capas: un clic sin mover sigue siendo un clic, y las señas son
   * las mismas (`.dragging` = el hueco que deja el botón levantado · `.over` = la raya oro sobre el botón ANTES del
   * cual va a caer). Un botón NUNCA cambia de bloque —los bloques son lo que ve cada rol—: soltarlo sobre otro
   * bloque no hace nada. Soltarlo sobre el fondo de su bloque lo manda al final. Una raya ni se arrastra ni recibe.
   */
  const [drag, setDrag] = useState<{ block: ToolbarBlock; id: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const endDrag = (): void => { setDrag(null); setOver(null); };
  const movible = (block: ToolbarBlock, id: string): boolean =>
    !!p.canReorder && id !== TOOLBAR_SEP && orden[block].filter(x => x !== TOOLBAR_SEP).length > 1;
  const soltar = (block: ToolbarBlock, before: string | null): void => {
    if (drag && drag.block === block) {
      const next = moveToolbarItem(orden[block], drag.id, before);
      if (next !== orden[block]) p.onReorder?.(block, [...next]);
    }
    endDrag();
  };
  const bloque = (block: ToolbarBlock, clase = ''): JSX.Element => (
    <div className={`mp-tool-group ${clase}`.trim()}
      onDragOver={e => { if (drag && drag.block === block) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(null); } }}
      onDrop={e => { e.preventDefault(); soltar(block, null); }}>
      {orden[block].map((id, i) => {
        const el = pieza(id);
        if (!el) return null;
        const mueve = movible(block, id);
        const levantado = !!drag && drag.block === block && drag.id === id;
        const destino = !!drag && drag.block === block && drag.id !== id && id !== TOOLBAR_SEP;
        return (
          <div key={`${id}-${i}`} data-tool-id={id} draggable={mueve}
            className={`mp-slot${mueve ? ' draggable' : ''}${levantado ? ' dragging' : ''}${destino && over === id ? ' over' : ''}`}
            onDragStart={e => { if (!mueve) return; setDrag({ block, id }); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); }}
            onDragEnd={endDrag}
            onDragOver={e => { if (!drag || drag.block !== block) return; e.stopPropagation(); if (!destino) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(id); }}
            onDragLeave={() => { if (over === id) setOver(null); }}
            onDrop={e => { e.preventDefault(); e.stopPropagation(); if (destino) soltar(block, id); else endDrag(); }}>
            {el}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="mp-toolbar" role="toolbar" aria-label={t('maps.toolbar')} aria-orientation="vertical">
      {bloque('play')}
      {bloque('draw')}
      {p.isDm && bloque('dm', 'dm')}
    </div>
  );
}
