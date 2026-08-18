import { useTranslation } from '@rolvium/i18n';
import { DM_TOOLS, PLAYER_TOOLS, TOOLS_NOT_YET, type Tool } from '../domain/useCases/mapRules';

const ICONS: Record<Tool, string> = { move: 'open_with', measure: 'straighten', pin: 'location_on', pencil: 'edit', line: 'horizontal_rule', rect: 'crop_square', circle: 'circle', erase: 'ink_eraser', wall: 'fence', reveal: 'visibility', hide: 'visibility_off', encounter: 'swords' };
const GROUPS: Tool[][] = [['move', 'measure', 'pin'], ['pencil', 'line', 'rect', 'circle', 'erase']];

function ToolButton({ id, current, onChange }: { id: Tool; current: Tool; onChange: (t: Tool) => void }): JSX.Element {
  const { t } = useTranslation();
  const soon = TOOLS_NOT_YET.includes(id);
  const label = soon ? `${t(`maps.tool.${id}`)} · ${t('maps.tool.soon')}` : t(`maps.tool.${id}`);
  return (
    <button type="button" className={`mp-tool ${current === id ? 'on' : ''} ${DM_TOOLS.includes(id) ? 'dm' : ''}`} aria-pressed={current === id} aria-label={label} title={label} disabled={soon} onClick={() => onChange(id)}>
      <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>{ICONS[id]}</span>
    </button>
  );
}

interface Props { tool: Tool; isDm: boolean; onChange: (tool: Tool) => void }

/** Vertical icon toolbar (design: Mover · Medir · Pin | Lápiz · Línea · Caja · Círculo · Borrar | DM: Muro · Revelar · Ocultar · Encuentro). */
export function Toolbar({ tool, isDm, onChange }: Props): JSX.Element {
  const { t } = useTranslation();
  const groups = isDm ? [...GROUPS, DM_TOOLS] : GROUPS;
  return (
    <div className="mp-toolbar" role="toolbar" aria-label={t('maps.toolbar')} aria-orientation="vertical">
      {groups.map((g, i) => (
        <div key={i} className={`mp-tool-group ${g === DM_TOOLS ? 'dm' : ''}`}>
          {g.filter(x => isDm || PLAYER_TOOLS.includes(x)).map(id => <ToolButton key={id} id={id} current={tool} onChange={onChange} />)}
        </div>
      ))}
    </div>
  );
}
