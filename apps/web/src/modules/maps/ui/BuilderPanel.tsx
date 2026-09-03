import { useTranslation } from '@rolvium/i18n';
import { Tooltip } from '@rolvium/ui';
import type { Wall, WallKind } from '../domain/entities/Scene';
import { WALL_KINDS, canOpen } from '../domain/useCases/mapRules';
import { BUILDER_MODES, ROOM_SHAPES, type BuilderMode, type RoomShape } from '../domain/useCases/roomRules';
import { useDragPanel } from './useDragPanel';

interface Props {
  /** En qué está trabajando: marcando sobre una foto o levantando salas aquí. Las dos conviven. */
  mode: BuilderMode;
  onMode: (mode: BuilderMode) => void;
  /** El muro que está cogido, o `null` mientras sólo se elige qué se va a dibujar. */
  wall: Wall | null;
  kind: WallKind;
  onKind: (kind: WallKind) => void;
  shape: RoomShape;
  onShape: (shape: RoomShape) => void;
  /** El candado. Cerrado (lo de siempre) se pega a la rejilla; abierto va libre. */
  snapGrid: boolean;
  onSnapGrid: (snap: boolean) => void;
  /** Los nodos en cadena: mover una punta se lleva las de al lado, así la figura no se abre. */
  chainNodes: boolean;
  onChainNodes: (chain: boolean) => void;
  /** Cuántos muros hay cogidos y si están atados entre sí (§ «EL GRUPO»). */
  groupCount?: number;
  grouped?: boolean;
  onGroup?: () => void;
  onUngroup?: () => void;
  onVisible?: (visible: boolean) => void;
  onToggleOpen?: () => void;
  onRemove?: () => void;
  onClose: () => void;
}

/**
 * EL PANEL DE BUILDER v3 (`rolvium.pen` · `ePNCc` «modo + preajustes», `zpsjH` «modo SOBRE UNA FOTO`,
 * `CvkXT` «GRUPO cogido», `tS9zl` «VARIOS MUROS cogidos»).
 *
 * Es la orden del dueño del 2026-09-03: «*ya es hora que dejes esto maqueteado en el menú que va y que dejes
 * de agregar cosas en este*». Todo lo de Builder vive AQUÍ, y no colgado de la barra flotante vieja.
 *
 * Lo primero de todo es EN QUÉ ESTÁ TRABAJANDO, porque mezclar las dos maneras fue el fallo de la sesión
 * anterior: marcar muros encima de una foto y levantar salas aquí son cosas distintas y CONVIVEN.
 *
 * De la misma familia que `LightEditor`: flota sobre el mapa, se agarra por la cabecera y se aparta, y la X
 * lo cierra. No se queda con la tecla Escape a propósito — dibujando un polígono, Escape es para cancelar el
 * polígono, no para cerrar el panel.
 *
 * PENDIENTE, y a propósito: «ESTILO DE LA MAZMORRA» (los preajustes) y las dos texturas base.
 * Piden tabla de habitaciones, migración y DBA antes de una línea de código; el interruptor de modo de arriba
 * es el sitio donde entrarán.
 */
export function BuilderPanel({
  mode, onMode, wall, kind, onKind, shape, onShape, snapGrid, onSnapGrid, chainNodes, onChainNodes,
  groupCount = 0, grouped = false, onGroup, onUngroup, onVisible, onToggleOpen, onRemove, onClose,
}: Props): JSX.Element {
  const { t } = useTranslation();
  const { ref, style, handlers } = useDragPanel<HTMLDivElement>();
  const held = groupCount > 1 || !!wall;

  return (
    <div className="mp-builder" ref={ref} style={style}
      role="group" aria-label={t('maps.builder.title')}>
      <div className="mp-builder-head mp-drag" title={t('maps.builder.move')} {...handlers}>
        <span className="material-symbols-outlined mp-builder-grip" style={{ fontSize: 'var(--icon-xs)' }} aria-hidden="true">drag_indicator</span>
        {/*
          * SU icono, el de verdad, y de máscara igual que en la barra de herramientas: así lo tiñe el panel y
          * no se pierde sobre el papel claro. Un Material Symbol genérico aquí ya se lo tumbó una vez.
          */}
        <span className="mp-builder-icon" data-testid="mp-builder-icon" aria-hidden="true"
          style={{ maskImage: 'url(/icons/builder-mask.png)', WebkitMaskImage: 'url(/icons/builder-mask.png)' }} />
        <span className="mp-builder-title">{t('maps.builder.title')}</span>
        <Tooltip label={t('maps.builder.close')} placement="top">
          <button type="button" className="mp-layers-icon" aria-label={t('maps.builder.close')} onClick={onClose}>
            <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }}>close</span>
          </button>
        </Tooltip>
      </div>

      {/* ── EN QUÉ ESTOY TRABAJANDO · LAS DOS CONVIVEN ── */}
      <fieldset className="mp-builder-group">
        <legend className="tb-rotulo">{t('maps.builder.mode.label')}</legend>
        <div className="mp-builder-modes" role="radiogroup" aria-label={t('maps.builder.mode.label')}>
          {BUILDER_MODES.map(m => (
            <button key={m} type="button" role="radio" aria-checked={mode === m}
              className={`mp-builder-mode ${mode === m ? 'on' : ''}`} onClick={() => onMode(m)}>
              {m === 'photo' ? <MiniPhoto /> : <MiniRoom />}
              <span className="mp-builder-mode-t">{t(`maps.builder.mode.${m}`)}</span>
              <span className="mp-builder-mode-s">{t(`maps.builder.mode.${m}Sub`)}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* ── QUÉ LEVANTO · LO DE SIEMPRE, INTACTO ── */}
      <fieldset className="mp-builder-group">
        <legend className="tb-rotulo">{t('maps.builder.what.label')}</legend>
        <div className="mp-builder-seg" role="radiogroup" aria-label={t('maps.wall.kindOf')}>
          {WALL_KINDS.map(k => (
            <button key={k} type="button" role="radio" aria-checked={kind === k}
              className={`mp-builder-opt ${kind === k ? 'on' : ''}`} onClick={() => onKind(k)}>
              {t(`maps.wall.kind.${k}`)}
            </button>
          ))}
        </div>
        <p className="mp-builder-hint">{t('maps.builder.what.hint')}</p>
      </fieldset>

      {/* ── CON QUÉ FORMA ── */}
      <fieldset className="mp-builder-group">
        <legend className="tb-rotulo">{t('maps.room.shapeOf')}</legend>
        <div className="mp-builder-shapes" role="radiogroup" aria-label={t('maps.room.shapeOf')}>
          {ROOM_SHAPES.map(s => (
            <button key={s} type="button" role="radio" aria-checked={shape === s}
              className={`mp-builder-opt ${shape === s ? 'on' : ''}`} onClick={() => onShape(s)}>
              {t(`maps.room.shape.${s}`)}
            </button>
          ))}
        </div>
        <p className="mp-builder-hint">{shapeHint(shape, t)}</p>
      </fieldset>

      {/*
        * ── EL CANDADO ── Aprobado por él el 2026-09-03 («*tira*») con sus tres condiciones: empieza cerrado,
        * vale para todo Builder y, abierto, las puntas se pegan a las puntas de otros muros.
        */}
      <fieldset className="mp-builder-group">
        <legend className="tb-rotulo">{t('maps.builder.snap.label')}</legend>
        <button type="button" className={`mp-builder-lock ${snapGrid ? 'on' : ''}`} aria-pressed={snapGrid}
          onClick={() => onSnapGrid(!snapGrid)}>
          <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }} aria-hidden="true">
            {snapGrid ? 'lock' : 'lock_open'}
          </span>
          {t(snapGrid ? 'maps.builder.snap.on' : 'maps.builder.snap.off')}
        </button>
        <p className="mp-builder-hint">{t(snapGrid ? 'maps.builder.snap.hintOn' : 'maps.builder.snap.hintOff')}</p>
      </fieldset>

      {/*
        * ── LOS NODOS, EN CADENA ── «*los nodos deberían ser como una cadena a menos que yo elija que no*»
        * (dueño, 2026-09-03). Va PUESTO por omisión, que es lo que él pidió, y al lado del candado porque las
        * dos cosas contestan a la misma pregunta: cómo se comporta una punta cuando la arrastras.
        */}
      <fieldset className="mp-builder-group">
        <legend className="tb-rotulo">{t('maps.builder.chain.label')}</legend>
        <button type="button" className={`mp-builder-lock ${chainNodes ? '' : 'on'}`} aria-pressed={chainNodes}
          onClick={() => onChainNodes(!chainNodes)}>
          <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }} aria-hidden="true">
            {chainNodes ? 'link' : 'link_off'}
          </span>
          {t(chainNodes ? 'maps.builder.chain.on' : 'maps.builder.chain.off')}
        </button>
        <p className="mp-builder-hint">{t(chainNodes ? 'maps.builder.chain.hintOn' : 'maps.builder.chain.hintOff')}</p>
      </fieldset>

      {/* ── LO QUE TENGO COGIDO ── el grupo, los muros sueltos, o el muro que se está editando ── */}
      {held && (
        <fieldset className="mp-builder-group">
          <legend className="tb-rotulo">{t('maps.group.held')}</legend>
          {groupCount > 1 && (
            <div className="mp-builder-row">
              <span className="mp-groupbar-n">{grouped ? t('maps.group.countGrouped', { n: String(groupCount) }) : t('maps.group.countLoose', { n: String(groupCount) })}</span>
              <button type="button" className="tb-btn tb-btn-xs tb-btn-danger" onClick={() => (grouped ? onUngroup?.() : onGroup?.())}>
                {grouped ? t('maps.group.ungroup') : t('maps.group.group')}
              </button>
            </div>
          )}
          {groupCount > 1 && <p className="mp-builder-hint">{grouped ? t('maps.group.hintGrouped') : t('maps.group.hintLoose')}</p>}
          {wall && (
            <div className="mp-builder-row">
              {onVisible && (
                <label className="mp-light-check">
                  <input type="checkbox" checked={wall.visiblePlayers} onChange={e => onVisible(e.target.checked)} />
                  {t('maps.wall.visible')}
                </label>
              )}
              {onToggleOpen && canOpen(wall) && (
                <button type="button" className="tb-btn tb-btn-xs" onClick={onToggleOpen}>{wall.isOpen ? t('maps.wall.close') : t('maps.wall.open')}</button>
              )}
              {onRemove && (
                <Tooltip label={t('maps.wall.remove')} placement="top">
                  <button type="button" className="mp-segbar-del" aria-label={t('maps.wall.remove')} onClick={onRemove}>
                    <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>delete</span>
                  </button>
                </Tooltip>
              )}
            </div>
          )}
          {/* El nodo por doble clic sólo tiene sentido con un muro cogido: es donde se puede pinchar su línea. */}
          {wall && <p className="mp-builder-hint">{t('maps.builder.nodeHint')}</p>}
        </fieldset>
      )}

      {/*
        * Cómo coger TODO, y siempre a la vista: dentro de «lo que tengo cogido» no serviría, porque esa
        * sección sólo aparece cuando ya has cogido algo (dueño: «no me deja seleccionar todos los nodos»).
        */}
      <p className="mp-builder-hint">{t('maps.builder.selectAll')}</p>

      <p className="mp-builder-note">
        <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }} aria-hidden="true">info</span>
        {t(`maps.builder.note.${mode}`)}
      </p>
    </div>
  );
}

/**
 * La pista de abajo cambia con la forma: cada una se dibuja con un gesto distinto y decirlo aquí ahorra
 * tener que adivinarlo sobre el lienzo.
 */
function shapeHint(shape: RoomShape, t: (key: string) => string): string {
  if (shape === 'segment') return t('maps.room.chainHint');
  if (shape === 'line') return t('maps.room.lineHint');
  return shape === 'poly' ? t('maps.room.polyHint') : t('maps.room.dragHint');
}

/** Una foto de mapa con los muros marcados encima: la esquina de una sala ya dibujada por otro. */
function MiniPhoto(): JSX.Element {
  return (
    <svg className="mp-builder-mini" viewBox="0 0 44 30" aria-hidden="true">
      <rect className="mp-builder-mini-photo" x="0" y="0" width="44" height="30" />
      <g className="mp-builder-mini-mark">
        <line x1="7" y1="6" x2="30" y2="6" />
        <line x1="30" y1="6" x2="37" y2="13" />
        <line x1="37" y1="13" x2="37" y2="24" />
        <line x1="7" y1="6" x2="7" y2="24" />
        <line x1="7" y1="24" x2="20" y2="24" />
      </g>
    </svg>
  );
}

/** Una sala levantada aquí: los muros y la rejilla del suelo debajo. */
function MiniRoom(): JSX.Element {
  return (
    <svg className="mp-builder-mini" viewBox="0 0 44 30" aria-hidden="true">
      <rect className="mp-builder-mini-floor" x="7" y="6" width="30" height="18" />
      <g className="mp-builder-mini-grid">
        <line x1="17" y1="6" x2="17" y2="24" />
        <line x1="27" y1="6" x2="27" y2="24" />
        <line x1="7" y1="12" x2="37" y2="12" />
        <line x1="7" y1="18" x2="37" y2="18" />
      </g>
      <rect className="mp-builder-mini-wall" x="7" y="6" width="30" height="18" />
    </svg>
  );
}
