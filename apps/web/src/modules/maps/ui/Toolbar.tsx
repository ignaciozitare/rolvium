import { useTranslation } from '@rolvium/i18n';
import { Tooltip } from '@rolvium/ui';
import { DM_TOOLS, PLAYER_TOOLS, TOOLS_NOT_YET, type Tool } from '../domain/useCases/mapRules';

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
const ICONS: Record<Tool, string> = { select: 'arrow_selector_tool', measure: 'straighten', pin: 'location_on', pencil: 'edit', line: 'horizontal_rule', rect: 'crop_square', circle: 'circle', text: 'title', erase: 'ink_eraser', wall: '/icons/builder-mask.png', reveal: 'visibility', hide: 'visibility_off', mask: 'opacity', light: 'wb_incandescent', encounter: 'swords' };
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
  const tools = (ids: Tool[]) => ids.filter(x => p.isDm || PLAYER_TOOLS.includes(x)).map(id => (
    <Btn key={id} label={label(id)} icon={ICONS[id]} on={p.tool === id} dm={DM_TOOLS.includes(id)} disabled={TOOLS_NOT_YET.includes(id) || dormida(id)}
      onClick={() => p.onChange(p.tool === id ? 'select' : id)} />
  ));
  const actions = (list: Action[]) => list.map(a => (
    <Btn key={a.id} label={t(`maps.action.${a.id}`)} icon={a.icon} on={!!a.on} dm={a.id !== 'dice'} onClick={a.onClick} />
  ));

  /**
   * The two DM panels are kept apart because the owner's order interleaves them with the tools: «Imágenes»
   * belongs with what BUILDS the scene, «Colocar PJ» with what starts the game.
   */
  const bgPanel: Action[] = p.onBackground ? [{ id: 'background', icon: 'image', onClick: p.onBackground, ...(p.backgroundOpen !== undefined ? { on: p.backgroundOpen } : {}) }] : [];
  const placePcPanel: Action[] = p.onPlacePc ? [{ id: 'placePc', icon: 'person_add', onClick: p.onPlacePc, ...(p.placePcOpen !== undefined ? { on: p.placePcOpen } : {}) }] : [];

  return (
    <div className="mp-toolbar" role="toolbar" aria-label={t('maps.toolbar')} aria-orientation="vertical">
      <div className="mp-tool-group">
        {actions([{ id: 'dice', icon: 'casino', onClick: p.onDice, ...(p.diceOpen !== undefined ? { on: p.diceOpen } : {}) }])}
        {tools(['select', 'measure', 'pin'])}
      </div>
      <div className="mp-tool-group">
        {tools(['pencil', 'line', 'rect', 'circle', 'text', 'erase'])}
      </div>
      {p.isDm && (
        <div className="mp-tool-group dm">
          {tools(['light', 'wall'])}
          {actions(bgPanel)}
          {tools(['mask'])}
          <span className="mp-tool-sep" aria-hidden />
          {tools(['reveal', 'hide'])}
          <span className="mp-tool-sep" aria-hidden />
          {tools(['encounter'])}
          {actions(placePcPanel)}
        </div>
      )}
    </div>
  );
}
