import { useTranslation } from '@rolvium/i18n';
import { FloatingPanel, OptionGroup, PanelHint, PanelSection, Slider } from '@rolvium/ui';
import type { Layer, Prop, SceneProp } from '../domain/entities/Scene';
import { panelOrder } from '../domain/useCases/layerRules';
import { DEFAULT_SOW_AREA, MIN_SCALE, randomRotation, SCALE_SLIDER_MAX, SOW_AREA_MAX, SOW_AREA_MIN, SOW_DENSITIES, type SowDensity } from '../domain/useCases/propRules';

export type PlantMode = 'one' | 'many';

export interface SowSettings {
  /** El radio del área de siembra, en casillas. */
  areaCells: number;
  density: SowDensity;
  randomRotation: boolean;
  randomScale: boolean;
}
export const DEFAULT_SOW: SowSettings = { areaCells: DEFAULT_SOW_AREA, density: 'mid', randomRotation: true, randomScale: false };

interface Props {
  /** La pieza del sello, o `null` sin ninguna elegida. */
  stamp: Prop | null;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  /** Abre el catálogo a pantalla completa. */
  onPick: () => void;
  /** Quita el sello (también lo hace Esc). */
  onDrop: () => void;
  /** La escala del sello, en vivo mientras se mueve; al soltar, `onScaleEnd` la apunta en la CATEGORÍA (§ 6.4). */
  scale: number;
  onScale: (scale: number) => void;
  onScaleEnd: () => void;
  rotation: number;
  onRotation: (deg: number) => void;
  /** El dado: un giro al azar. */
  onRandomRotation: () => void;
  /** Sin abrir el catálogo: recientes y favoritos, ya resueltos a piezas por quien lo monta. */
  quick: 'recent' | 'favorites';
  onQuick: (which: 'recent' | 'favorites') => void;
  quickProps: readonly Prop[];
  onQuickPick: (prop: Prop) => void;
  layers: readonly Layer[];
  layerId: string | null;
  onLayer: (layerId: string | null) => void;
  mode: PlantMode;
  onMode: (mode: PlantMode) => void;
  sow: SowSettings;
  onSow: (patch: Partial<SowSettings>) => void;
  /**
   * LA PIEZA COGIDA (§ 6.8, punto 7 — él: «*no puedo reescalar o girar el objeto que tengo seleccionado desde
   * el modal*»): con una plantada cogida, el primer bloque la enseña a ELLA y ESCALA y GIRO actúan sobre ella
   * en vivo; al soltar se guarda (y la escala se apunta en la CATEGORÍA de su pieza, como con las esquinas —
   * la ficha del objeto en la biblioteca NO se toca, § 6.4). `scale` es la
   * suya respecto a su pieza de biblioteca (o a su tamaño al cogerla, si ya no está en la biblioteca).
   * `isFavorite` es `null` cuando ya no hay pieza de biblioteca a la que marcar. Sin cogida, el bloque es el del sello.
   */
  picked?: { prop: SceneProp; scale: number; rotation: number; isFavorite: boolean | null } | null;
  onPickedScale?: (scale: number) => void;
  onPickedScaleEnd?: () => void;
  onPickedRotation?: (deg: number) => void;
  onPickedRotationEnd?: () => void;
  onPickedToggleFavorite?: () => void;
  /**
   * DE SU FAMILIA (§ 6.8, punto 9 — él: «*donde está la pieza cogida, quiero inmediatamente debajo un pequeño
   * recuadro donde pueda visualizar escroleando … de a tres líneas de 3 objetos de su familia*»). Las piezas del
   * mismo paquete que la cogida (`familyPackName` es su nombre, o «Sin clasificar»); vacío = sin bloque. Pinchar
   * otra la hace el sello, igual que la rejilla de «sin abrir el catálogo» — no toca la plantada.
   */
  family?: readonly Prop[];
  familyPackName?: string;
  onFamilyPick?: (prop: Prop) => void;
  onClose: () => void;
}

const KIND_KEY: Record<Layer['kind'], string> = { terrain: 'terrain', objects: 'objects', creatures: 'creatures', dm_notes: 'dmNotes' };

/**
 * EL PANEL DE PIEZA — «mientras plantas» (`rolvium.pen` · `lWBaU`, aprobado el 2026-09-11 tras ajustarlo al
 * Pincel y al Builder). Sale con el botón **Piezas** de la barra.
 *
 * Las cinco secciones de la lámina, en su orden: la pieza del sello (muestra sobre oscuro —el único negro del
 * panel, detrás del arte—, ELEGIR en sangre / SOLTAR con filo, ESCALA que se recuerda, GIRO con dado) · sin
 * abrir el catálogo (RECIENTES / FAVORITOS y la rejilla) · a qué capa va · cuántas planto (UNA / MUCHAS) · al
 * sembrar muchas (ÁREA, DENSIDAD, GIRO y TAMAÑO al azar, en botones de fila entera). Y el pie.
 *
 * S/1b · DE SU FAMILIA (§ 6.8, punto 9, `JHdTe`): con una pieza plantada cogida, debajo de «LA PIEZA COGIDA»
 * sale un recuadro con las de su mismo paquete, de a tres por fila y tres filas a la vista con scroll; pinchar
 * otra la hace el sello, sin tocar la ya plantada. Sin pieza cogida, o sin más piezas en su paquete, no sale.
 *
 * La barra alargada «Sello activo» (`NAAEV`) NO existe: la tumbó él («*está todo dentro del panel, no la
 * pongas*»), igual que la del Pincel. Todo lo del sello vive aquí.
 *
 * Misma familia que `BuilderPanel`, `BrushPanel` y `LightEditor`: carcasa, deslizadores y opciones de
 * `@rolvium/ui`; el módulo sólo pone dónde va y cuánto mide (`.mp-propspanel`, 220 de ancho como la lámina).
 */
export function PropsPanel({
  stamp, isFavorite, onToggleFavorite, onPick, onDrop, scale, onScale, onScaleEnd, rotation, onRotation, onRandomRotation,
  quick, onQuick, quickProps, onQuickPick, layers, layerId, onLayer, mode, onMode, sow, onSow,
  picked = null, onPickedScale, onPickedScaleEnd, onPickedRotation, onPickedRotationEnd, onPickedToggleFavorite,
  family = [], familyPackName = '', onFamilyPick, onClose,
}: Props): JSX.Element {
  const { t, locale } = useTranslation();
  const nameOf = (l: Layer): string => l.name || t(`maps.layers.kind.${KIND_KEY[l.kind]}`);
  // Con la coma del idioma de la app («1,5 ×»), no la del navegador.
  const fmtScale = (v: number): string => `${v.toLocaleString(locale, { maximumFractionDigits: 2 })} ×`;
  const cells = (n: number): string => (n === 1 ? t('maps.props.cell') : t('maps.props.cells', { n: n.toLocaleString(locale, { maximumFractionDigits: 1 }) }));
  // La capa de destino: `null` es «Objetos», su capa natural, que es lo que enseña el desplegable de serie.
  const objects = layers.find(l => l.kind === 'objects') ?? null;
  const layerValue = layerId ?? objects?.id ?? '';

  return (
    <FloatingPanel className="mp-propspanel" title={t('maps.props.title')} moveLabel={t('maps.props.move')}
      closeLabel={t('maps.props.close')} onClose={onClose}
      icon={<span className="mp-tool-img mp-props-icon" aria-hidden="true" style={{ maskImage: 'url(/icons/props-mask.svg)', WebkitMaskImage: 'url(/icons/props-mask.svg)' }} />}>

      {/* ── S/1 · LA PIEZA DEL SELLO — o LA PIEZA COGIDA (§ 6.8, punto 7), que manda mientras haya una ── */}
      <PanelSection label={t(picked ? 'maps.props.stamp.pickedLabel' : 'maps.props.stamp.label')} testId="mp-props-stamp">
        {/* LA FOTO ES EL BOTÓN (§ 6.8, punto 8): pincharla abre el catálogo, igual que ELEGIR. La cogida lleva marco oro. */}
        <button type="button" className={`mp-props-sample ${picked ? 'picked' : ''}`} data-testid="mp-props-sample" aria-label={t('maps.props.stamp.openCatalog')} onClick={onPick}>
          {picked
            ? <img src={picked.prop.imageUrl} alt="" style={{ transform: `rotate(${picked.rotation}deg)` }} />
            : stamp
              ? <img src={stamp.imageUrl} alt="" style={{ transform: `rotate(${rotation}deg)` }} />
              : <span className="material-symbols-outlined" aria-hidden="true">category</span>}
        </button>
        {picked ? (
          <div className="mp-props-name" data-testid="mp-props-picked">
            <span className="mp-props-name-t">{picked.prop.name}</span>
            {picked.isFavorite !== null && (
              <button type="button" className={`mp-props-star ${picked.isFavorite ? 'on' : ''}`} aria-pressed={picked.isFavorite}
                aria-label={t(picked.isFavorite ? 'maps.props.stamp.unfavorite' : 'maps.props.stamp.favorite')} onClick={onPickedToggleFavorite}>
                <span className="material-symbols-outlined" aria-hidden="true">{picked.isFavorite ? 'star' : 'star_border'}</span>
              </button>
            )}
          </div>
        ) : stamp ? (
          <div className="mp-props-name">
            <span className="mp-props-name-t">{stamp.name}</span>
            <button type="button" className={`mp-props-star ${isFavorite ? 'on' : ''}`} aria-pressed={isFavorite}
              aria-label={t(isFavorite ? 'maps.props.stamp.unfavorite' : 'maps.props.stamp.favorite')} onClick={onToggleFavorite}>
              <span className="material-symbols-outlined" aria-hidden="true">{isFavorite ? 'star' : 'star_border'}</span>
            </button>
          </div>
        ) : <PanelHint>{t('maps.props.stamp.none')}</PanelHint>}
        <div className="mp-props-row2">
          <button type="button" className="tb-btn tb-btn-xs tb-btn-blood" onClick={onPick}>{t('maps.props.stamp.pick')}</button>
          <button type="button" className="tb-btn tb-btn-xs" disabled={!stamp} onClick={onDrop}>{t('maps.props.stamp.drop')}</button>
        </div>
        {picked && (<>
          {/* ESCALA y GIRO de la COGIDA: en vivo mientras se mueve, y se guarda al soltar (§ 6.8, punto 7). */}
          <Slider label={t('maps.props.stamp.scale')} min={MIN_SCALE * 100} max={SCALE_SLIDER_MAX * 100} step={1}
            value={Math.round(Math.min(SCALE_SLIDER_MAX, picked.scale) * 100)} onChange={n => onPickedScale?.(n / 100)} onCommit={onPickedScaleEnd}
            valueText={fmtScale(picked.scale)} />
          <PanelHint>{t('maps.props.stamp.pickedHint')}</PanelHint>
          <div className="mp-props-rot">
            <Slider className="mp-props-rot-slider" label={t('maps.props.stamp.rotation')} min={0} max={355} step={5}
              value={picked.rotation} onChange={n => onPickedRotation?.(n)} onCommit={onPickedRotationEnd} valueText={`${picked.rotation}°`} />
            <button type="button" className="mp-props-dice" aria-label={t('maps.props.stamp.random')}
              onClick={() => { onPickedRotation?.(randomRotation(Math.random)); onPickedRotationEnd?.(); }}>
              <span className="material-symbols-outlined" aria-hidden="true">casino</span>
            </button>
          </div>
        </>)}
        {!picked && stamp && (<>
          {/* La ESCALA se recuerda POR CATEGORÍA (§ 6.4): mover va en vivo, y al soltar se apunta en la categoría
              de la pieza — NUNCA en la ficha del objeto de la biblioteca, que es de la herramienta y la ve todo
              el mundo. La regla vieja «por pieza» decía lo contrario: no la devuelvas. */}
          {/* En centésimas: una pieza de 1024 px nace a 0,05 y a saltos de 0,05 cada paso era una casilla entera. */}
          <Slider label={t('maps.props.stamp.scale')} min={MIN_SCALE * 100} max={SCALE_SLIDER_MAX * 100} step={1}
            value={Math.round(Math.min(SCALE_SLIDER_MAX, scale) * 100)} onChange={n => onScale(n / 100)} onCommit={onScaleEnd}
            valueText={fmtScale(scale)} />
          <PanelHint>{t('maps.props.stamp.scaleHint', { name: stamp.name.toLowerCase() })}</PanelHint>
          <div className="mp-props-rot">
            <Slider className="mp-props-rot-slider" label={t('maps.props.stamp.rotation')} min={0} max={355} step={5}
              value={rotation} onChange={onRotation} valueText={`${rotation}°`} />
            <button type="button" className="mp-props-dice" aria-label={t('maps.props.stamp.random')} onClick={onRandomRotation}>
              <span className="material-symbols-outlined" aria-hidden="true">casino</span>
            </button>
          </div>
        </>)}
      </PanelSection>

      {/* ── S/1b · DE SU FAMILIA (§ 6.8, punto 9) — sólo con una pieza cogida y compañía en su paquete ── */}
      {picked && family.length > 0 && (
        <PanelSection label={t('maps.props.family.label', { name: familyPackName })} testId="mp-props-family">
          <div className="mp-props-family-grid" role="list" data-testid="mp-props-family-grid">
            {family.map(p => (
              <button key={p.id} type="button" role="listitem" className={`mp-props-cell ${p.id === picked.prop.propId ? 'on' : ''}`}
                aria-label={t('maps.props.quick.use', { name: p.name })} aria-pressed={p.id === picked.prop.propId} onClick={() => onFamilyPick?.(p)}>
                <img src={p.imageUrl} alt="" />
              </button>
            ))}
          </div>
        </PanelSection>
      )}

      {/* ── S/2 · SIN ABRIR EL CATÁLOGO ── */}
      <PanelSection label={t('maps.props.quick.label')} testId="mp-props-quick">
        <OptionGroup ariaLabel={t('maps.props.quick.label')} look="chip" columns={2} caps value={quick} onChange={onQuick}
          options={[
            { value: 'recent', label: t('maps.props.quick.recent'), icon: <span className="material-symbols-outlined" aria-hidden="true">history</span> },
            { value: 'favorites', label: t('maps.props.quick.favorites'), icon: <span className="material-symbols-outlined" aria-hidden="true">star</span> },
          ]} />
        {quickProps.length === 0
          ? <PanelHint>{t(quick === 'recent' ? 'maps.props.quick.emptyRecent' : 'maps.props.quick.emptyFavorites')}</PanelHint>
          : (
            <div className="mp-props-grid" role="list" data-testid="mp-props-grid">
              {quickProps.map(p => (
                <button key={p.id} type="button" role="listitem" className={`mp-props-cell ${stamp?.id === p.id ? 'on' : ''}`}
                  aria-label={t('maps.props.quick.use', { name: p.name })} aria-pressed={stamp?.id === p.id} onClick={() => onQuickPick(p)}>
                  <img src={p.imageUrl} alt="" />
                </button>
              ))}
            </div>
          )}
      </PanelSection>

      {/* ── S/3 · A QUÉ CAPA VA ── */}
      <PanelSection label={t('maps.props.layer.label')}>
        <select className="mp-props-select" aria-label={t('maps.props.layer.label')} value={layerValue}
          onChange={e => onLayer(e.target.value === (objects?.id ?? '') ? null : e.target.value || null)}>
          {panelOrder(layers).map(l => <option key={l.id} value={l.id}>{nameOf(l)}</option>)}
          {layers.length === 0 && <option value="">{t('maps.layers.kind.objects')}</option>}
        </select>
      </PanelSection>

      {/* ── S/4 · CUÁNTAS PLANTO ── */}
      <PanelSection label={t('maps.props.count.label')}>
        <OptionGroup ariaLabel={t('maps.props.count.label')} look="chip" columns={2} caps value={mode} onChange={onMode}
          options={[
            { value: 'one', label: t('maps.props.count.one'), icon: <span className="material-symbols-outlined" aria-hidden="true">touch_app</span> },
            { value: 'many', label: t('maps.props.count.many'), icon: <span className="material-symbols-outlined" aria-hidden="true">grain</span> },
          ]} />
        <PanelHint>{t('maps.props.count.hint')}</PanelHint>
      </PanelSection>

      {/* ── S/5 · AL SEMBRAR MUCHAS ── sólo con MUCHAS, como en la lámina. */}
      {mode === 'many' && (
        <PanelSection label={t('maps.props.sow.label')} testId="mp-props-sow">
          <Slider label={t('maps.props.sow.area')} min={SOW_AREA_MIN * 2} max={SOW_AREA_MAX * 2} step={1}
            value={Math.round(sow.areaCells * 2)} onChange={n => onSow({ areaCells: n / 2 })} valueText={cells(sow.areaCells)} />
          <Slider label={t('maps.props.sow.density')} min={0} max={2} step={1} ticks={[0, 1, 2]}
            value={SOW_DENSITIES.indexOf(sow.density)} onChange={n => onSow({ density: SOW_DENSITIES[n] ?? 'mid' })}
            valueText={t(`maps.props.sow.${sow.density}`)} />
          <button type="button" className={`rv-option chip caps wide mp-props-toggle ${sow.randomRotation ? 'on' : ''}`} role="switch"
            aria-checked={sow.randomRotation} onClick={() => onSow({ randomRotation: !sow.randomRotation })}>
            <span className="material-symbols-outlined" aria-hidden="true">rotate_right</span>{t('maps.props.sow.randomRotation')}
          </button>
          <button type="button" className={`rv-option chip caps wide mp-props-toggle ${sow.randomScale ? 'on' : ''}`} role="switch"
            aria-checked={sow.randomScale} onClick={() => onSow({ randomScale: !sow.randomScale })}>
            <span className="material-symbols-outlined" aria-hidden="true">photo_size_select_small</span>{t('maps.props.sow.randomScale')}
          </button>
        </PanelSection>
      )}

      <PanelHint>{t(picked ? 'maps.props.pickedFoot' : 'maps.props.foot')}</PanelHint>
    </FloatingPanel>
  );
}
