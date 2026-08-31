import { useTranslation } from '@rolvium/i18n';
import { Tooltip } from '@rolvium/ui';
import { DM_TOOLS, PLAYER_TOOLS, TOOLS_NOT_YET, type Tool } from '../domain/useCases/mapRules';

const ICONS: Record<Tool, string> = { select: 'arrow_selector_tool', measure: 'straighten', pin: 'location_on', pencil: 'edit', line: 'horizontal_rule', rect: 'crop_square', circle: 'circle', text: 'title', erase: 'ink_eraser', wall: 'fence', reveal: 'visibility', hide: 'visibility_off', mask: 'opacity', light: 'wb_incandescent', encounter: 'swords' };

/** Actions that open a panel instead of changing the cursor: they are buttons, not tools. */
interface Action { id: 'dice' | 'placePc' | 'background'; icon: string; onClick: () => void; on?: boolean }

interface Props {
  tool: Tool;
  isDm: boolean;
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
        <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>{icon}</span>
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
  const label = (id: Tool) => (TOOLS_NOT_YET.includes(id) ? `${t(`maps.tool.${id}`)} · ${t('maps.tool.soon')}` : t(`maps.tool.${id}`));
  const tools = (ids: Tool[]) => ids.filter(x => p.isDm || PLAYER_TOOLS.includes(x)).map(id => (
    <Btn key={id} label={label(id)} icon={ICONS[id]} on={p.tool === id} dm={DM_TOOLS.includes(id)} disabled={TOOLS_NOT_YET.includes(id)}
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
