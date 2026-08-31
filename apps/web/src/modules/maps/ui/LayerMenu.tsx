import { useTranslation } from '@rolvium/i18n';
import type { Layer, LayerKind } from '../domain/entities/Scene';
import { panelOrder, resolveLayer, type ElementKind } from '../domain/useCases/layerRules';

const KIND_ICON: Record<LayerKind, string> = { terrain: 'layers', objects: 'category', creatures: 'groups', dm_notes: 'sticky_note_2' };
const KIND_KEY: Record<LayerKind, string> = { terrain: 'terrain', objects: 'objects', creatures: 'creatures', dm_notes: 'dmNotes' };
const ELEMENT_ICON: Record<ElementKind, string> = { token: 'person', drawing: 'draw', light: 'wb_incandescent' };

interface Props {
  /** Dónde se pinchó, en px del lienzo. */
  at: { x: number; y: number };
  element: { kind: ElementKind; id: string; name: string; layerId: string | null };
  layers: Layer[];
  onPick: (layerId: string) => void;
  onClose: () => void;
}

/**
 * «Botón derecho sobre cualquier cosa → mándala a otra capa», petición literal del dueño
 * (rolvium.pen · «Menú mandar a capa»).
 *
 * Sale la lista ENTERA, notas del director incluida: mandar algo ahí es justamente cómo se esconde de la
 * mesa sin borrarlo. La capa donde está ahora se marca — y si nunca se movió, la marcada es su capa natural.
 */
export function LayerMenu({ at, element, layers, onPick, onClose }: Props): JSX.Element {
  const { t } = useTranslation();
  const current = resolveLayer(layers, element.layerId, element.kind);
  const nameOf = (l: Layer): string => l.name || t(`maps.layers.kind.${KIND_KEY[l.kind]}`);
  return (
    <div className="mp-pop mp-layermenu" role="menu" aria-label={t('maps.layers.sendTo')} style={{ left: at.x, top: at.y }} onMouseLeave={onClose}>
      <div className="mp-layermenu-head">
        <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-xs)' }}>{ELEMENT_ICON[element.kind]}</span>
        <span className="mp-layermenu-name">{element.name || t(`maps.layers.element.${element.kind}`)}</span>
      </div>
      <span className="tb-rotulo mp-layermenu-label">{t('maps.layers.sendTo')}</span>
      {panelOrder(layers).map(l => (
        <button key={l.id} type="button" role="menuitem" className={`mp-menu-item ${current?.id === l.id ? 'on' : ''}`} onClick={() => { onPick(l.id); onClose(); }}>
          <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>{KIND_ICON[l.kind]}</span>
          {nameOf(l)}
          {current?.id === l.id && <span className="material-symbols-outlined mp-layermenu-check" aria-hidden style={{ fontSize: 'var(--icon-xs)' }}>check</span>}
        </button>
      ))}
    </div>
  );
}
