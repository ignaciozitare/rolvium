import { useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { Tooltip } from '@rolvium/ui';
import type { Layer, LayerKind } from '../domain/entities/Scene';
import { panelOrder, terrainLayers, terrainOverweight } from '../domain/useCases/layerRules';

const KIND_ICON: Record<LayerKind, string> = { terrain: 'layers', objects: 'category', creatures: 'groups', dm_notes: 'sticky_note_2' };
const KIND_KEY: Record<LayerKind, string> = { terrain: 'terrain', objects: 'objects', creatures: 'creatures', dm_notes: 'dmNotes' };

interface Props {
  layers: Layer[];
  /** La capa donde se dibuja y se coloca. Sólo el director tiene panel, así que sólo él tiene activa. */
  activeId: string | null;
  onActivate: (layer: Layer) => void;
  onToggleVisible: (layer: Layer) => void;
  onToggleLocked: (layer: Layer) => void;
  onReorder: (layer: Layer, dir: 'up' | 'down') => void;
  /**
   * Soltar una capa de terreno encima de otra (dueño, 2026-08-31: «necesito poder arrastrar el orden de las
   * capas»). Convive con subir/bajar, no lo sustituye: los botones siguen siendo la vía precisa y la única
   * que funciona sin ratón.
   */
  onReorderTo: (id: string, targetId: string) => void;
  onAddTerrain: () => void;
  onRemove: (layer: Layer) => void;
  collapsed?: boolean;
  onCollapse?: () => void;
}

/**
 * El panel de capas, flotando sobre el mapa (rolvium.pen · «Escena · Director · capas y pincel de
 * transparencia»). Se lee de arriba abajo como en cualquier editor, al revés que el orden de pintado.
 *
 * Dos cosas que NO son lo que parecen, y por eso están comentadas aquí:
 *  · **El ojo es el de Photoshop**: apagar una capa la quita para TODOS, el director incluido. No es un
 *    interruptor de privacidad — por eso «Notas del director» es un tipo aparte y lleva su etiqueta.
 *  · **El candado sólo le afecta a él**: un jugador no selecciona nada, así que bloquear es una ayuda de
 *    edición, no un permiso.
 */
export function LayersPanel({ layers, activeId, onActivate, onToggleVisible, onToggleLocked, onReorder, onReorderTo, onAddTerrain, onRemove, collapsed = false, onCollapse }: Props): JSX.Element {
  const { t } = useTranslation();
  /** Sólo el TERRENO se ordena: las otras tres son fijas y su sitio lo pone el motor, no el director. */
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const endDrag = (): void => { setDragId(null); setOverId(null); };
  const rows = panelOrder(layers);
  const terrain = terrainLayers(layers);
  const active = layers.find(l => l.id === activeId) ?? null;
  const nameOf = (l: Layer): string => l.name || (l.kind === 'terrain' ? t('maps.layers.untitled', { n: String(terrain.findIndex(x => x.id === l.id) + 1) }) : t(`maps.layers.kind.${KIND_KEY[l.kind]}`));

  const head = (
    <div className="mp-layers-head">
      <span className="tb-rotulo">{t('maps.layers.title')}</span>
      {onCollapse && (
        <button type="button" className="mp-layers-icon" aria-label={t(collapsed ? 'maps.layers.expand' : 'maps.layers.collapse')} aria-expanded={!collapsed} onClick={onCollapse}>
          <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>{collapsed ? 'right_panel_open' : 'right_panel_close'}</span>
        </button>
      )}
    </div>
  );
  if (collapsed) return <aside className="mp-layers collapsed" aria-label={t('maps.layers.title')}>{head}</aside>;

  return (
    <aside className="mp-layers" aria-label={t('maps.layers.title')}>
      {head}
      {rows.length === 0 && <p className="mp-layers-empty tb-italic tb-dim">{t('maps.layers.empty')}</p>}
      <ul className="mp-layers-list">
        {rows.map(l => {
          const name = nameOf(l);
          const on = l.id === activeId;
          return (
            <li key={l.id} data-layer-id={l.id} data-layer-kind={l.kind}
              className={`mp-layer ${on ? 'on' : ''} ${l.visible ? '' : 'off'} ${l.kind === 'terrain' ? 'draggable' : ''} ${dragId === l.id ? 'dragging' : ''} ${overId === l.id ? 'over' : ''}`}
              draggable={l.kind === 'terrain'}
              onDragStart={e => { if (l.kind !== 'terrain') return; setDragId(l.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', l.id); }}
              onDragEnd={endDrag}
              onDragOver={e => { if (l.kind !== 'terrain' || !dragId || dragId === l.id) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOverId(l.id); }}
              onDragLeave={() => setOverId(o => (o === l.id ? null : o))}
              onDrop={e => { e.preventDefault(); if (l.kind === 'terrain' && dragId && dragId !== l.id) onReorderTo(dragId, l.id); endDrag(); }}>
              {l.kind === 'terrain' && (
                <span className="material-symbols-outlined mp-layer-grip" style={{ fontSize: 'var(--icon-xs)' }} aria-hidden="true" title={t('maps.layers.drag')}>drag_indicator</span>
              )}
              <button type="button" className="mp-layers-icon" aria-label={t(l.visible ? 'maps.layers.hide' : 'maps.layers.show', { name })} aria-pressed={l.visible}
                onClick={() => onToggleVisible(l)}>
                <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }}>{l.visible ? 'visibility' : 'visibility_off'}</span>
              </button>
              <button type="button" className="mp-layer-main" aria-pressed={on} aria-label={t('maps.layers.select', { name })} onClick={() => onActivate(l)}>
                {l.kind === 'terrain' && l.imageUrl
                  ? <img className="mp-layer-thumb" src={l.imageUrl} alt="" aria-hidden="true" />
                  : <span className="material-symbols-outlined mp-layer-kind" style={{ fontSize: 'var(--icon-xs)' }}>{KIND_ICON[l.kind]}</span>}
                <span className="mp-layer-name">
                  {name}
                  {l.kind === 'dm_notes' && <em className="mp-layer-private">{t('maps.layers.private')}</em>}
                </span>
              </button>
              {l.maskUrl && (
                <Tooltip label={t('maps.layers.hasMask')}>
                  <span className="material-symbols-outlined mp-layer-mask" style={{ fontSize: 'var(--icon-xs)' }} aria-label={t('maps.layers.hasMask')} role="img">brush</span>
                </Tooltip>
              )}
              <button type="button" className={`mp-layers-icon ${l.locked ? 'locked' : ''}`} aria-label={t(l.locked ? 'maps.layers.unlock' : 'maps.layers.lock', { name })} aria-pressed={l.locked}
                onClick={() => onToggleLocked(l)}>
                <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }}>{l.locked ? 'lock' : 'lock_open_right'}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {/*
        Subir, bajar y borrar sólo tienen sentido en el TERRENO: las otras tres son fijas —hay una y sólo una
        por escena, garantizado por la base de datos— y su sitio en la pila lo pone el motor, no el director.
      */}
      {active?.kind === 'terrain' && (
        <div className="mp-layer-actions">
          <span className="tb-rotulo mp-layer-actions-name">{nameOf(active)}</span>
          {(['up', 'down'] as const).map(dir => (
            <button key={dir} type="button" className="mp-layers-icon" aria-label={t(`maps.layers.${dir}`)}
              disabled={dir === 'up' ? terrain[terrain.length - 1]?.id === active.id : terrain[0]?.id === active.id}
              onClick={() => onReorder(active, dir)}>
              <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }}>{dir === 'up' ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}</span>
            </button>
          ))}
          <button type="button" className="mp-layers-icon" aria-label={t('maps.layers.delete')} onClick={() => onRemove(active)}>
            <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }}>delete</span>
          </button>
        </div>
      )}

      <button type="button" className="tb-btn tb-btn-xs mp-layers-add" onClick={onAddTerrain}>{t('maps.layers.addTerrain')}</button>

      {/* AVISA, no bloquea: «sin límite» fue elección del dueño a sabiendas de que muchas capas pesan. */}
      {terrainOverweight(layers) && (
        <p className="mp-layers-warn">
          <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }} aria-hidden="true">warning</span>
          {t('maps.layers.heavy', { n: String(terrain.length) })}
        </p>
      )}
    </aside>
  );
}
