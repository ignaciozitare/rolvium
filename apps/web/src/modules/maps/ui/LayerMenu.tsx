import { useTranslation } from '@rolvium/i18n';
import type { Layer, LayerKind } from '../domain/entities/Scene';
import { panelOrder, resolveLayer, type ElementKind } from '../domain/useCases/layerRules';

const KIND_ICON: Record<LayerKind, string> = { terrain: 'layers', objects: 'category', creatures: 'groups', dm_notes: 'sticky_note_2' };
const KIND_KEY: Record<LayerKind, string> = { terrain: 'terrain', objects: 'objects', creatures: 'creatures', dm_notes: 'dmNotes' };
const ELEMENT_ICON: Record<ElementKind, string> = { token: 'person', drawing: 'draw', light: 'wb_incandescent', prop: 'category' };
/** Traer adelante · enviar atrás · traer al frente · enviar al fondo (rebanada 6, § 6.6). */
export type StackDir = 'forward' | 'backward' | 'front' | 'back';
const STACK_ICON: Record<StackDir, string> = { forward: 'flip_to_front', backward: 'flip_to_back', front: 'vertical_align_top', back: 'vertical_align_bottom' };
const STACK_DIRS: readonly StackDir[] = ['forward', 'backward', 'front', 'back'] as const;

interface Props {
  /** Dónde se pinchó, en px del lienzo. */
  at: { x: number; y: number };
  element: { kind: ElementKind; id: string; name: string; layerId: string | null };
  layers: Layer[];
  onPick: (layerId: string) => void;
  /**
   * Borrar el elemento desde aquí. OPCIONAL a propósito: hoy sólo lo pasa la LUZ (dueño, 2026-09-02: «si la
   * selecciono a la luz y toco la tecla suprimir o botón derecho eliminar la luz se tiene que borrar»). Las
   * fichas ya se borran con Suprimir y los trazos con la goma; si algún día se quiere aquí, se pasa y ya.
   */
  onRemove?: () => void;
  /**
   * ── SÓLO PARA UNA PIEZA PLANTADA (rebanada 6, § 6.6) ──
   * El orden de apilado ENTRE PIEZAS —«*mandarlo adelante y atrás como en cualquier programa … top layer, down
   * layer*»—, el estorbo con sus dos casillas, y duplicar. La capa la sigue decidiendo la lista de arriba.
   */
  onStack?: (dir: StackDir) => void;
  blocks?: { sight: boolean; move: boolean; onToggle: (which: 'sight' | 'move') => void };
  onDuplicate?: () => void;
  onClose: () => void;
}

/**
 * «Botón derecho sobre cualquier cosa → mándala a otra capa», petición literal del dueño
 * (rolvium.pen · «Menú mandar a capa»).
 *
 * Sale la lista ENTERA, notas del director incluida: mandar algo ahí es justamente cómo se esconde de la
 * mesa sin borrarlo. La capa donde está ahora se marca — y si nunca se movió, la marcada es su capa natural.
 */
export function LayerMenu({ at, element, layers, onPick, onRemove, onStack, blocks, onDuplicate, onClose }: Props): JSX.Element {
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
      {onStack && (
        <>
          <span className="mp-menu-sep" aria-hidden />
          <span className="tb-rotulo mp-layermenu-label">{t('maps.props.menu.order')}</span>
          {STACK_DIRS.map(dir => (
            <button key={dir} type="button" role="menuitem" className="mp-menu-item" onClick={() => { onStack(dir); onClose(); }}>
              <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>{STACK_ICON[dir]}</span>
              {t(`maps.props.menu.${dir}`)}
            </button>
          ))}
        </>
      )}
      {blocks && (
        <>
          <span className="mp-menu-sep" aria-hidden />
          <span className="tb-rotulo mp-layermenu-label">{t('maps.props.menu.blocks')}</span>
          {(['sight', 'move'] as const).map(which => {
            const on = which === 'sight' ? blocks.sight : blocks.move;
            return (
              <button key={which} type="button" role="menuitemcheckbox" aria-checked={on} className={`mp-menu-item ${on ? 'on' : ''}`}
                onClick={() => blocks.onToggle(which)}>
                <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>{which === 'sight' ? 'visibility_off' : 'block'}</span>
                {t(`maps.props.menu.${which === 'sight' ? 'blocksSight' : 'blocksMove'}`)}
                {on && <span className="material-symbols-outlined mp-layermenu-check" aria-hidden style={{ fontSize: 'var(--icon-xs)' }}>check</span>}
              </button>
            );
          })}
        </>
      )}
      {onDuplicate && (
        <>
          <span className="mp-menu-sep" aria-hidden />
          <button type="button" role="menuitem" className="mp-menu-item" onClick={() => { onDuplicate(); onClose(); }}>
            <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>content_copy</span>
            {t('maps.props.menu.duplicate')}
          </button>
        </>
      )}
      {onRemove && (
        <>
          <span className="mp-menu-sep" aria-hidden />
          <button type="button" role="menuitem" className="mp-menu-item danger" onClick={() => { onRemove(); onClose(); }}>
            <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 'var(--icon-sm)' }}>delete</span>
            {t(`maps.layers.remove.${element.kind}`)}
          </button>
        </>
      )}
    </div>
  );
}
