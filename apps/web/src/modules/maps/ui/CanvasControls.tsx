import { useTranslation } from '@rolvium/i18n';
import type { Scene } from '../domain/entities/Scene';
import { nightLabelM } from '../domain/useCases/mapRules';

interface Props {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenter: () => void;
  isDm: boolean;
  showWalls: boolean;
  onToggleWalls: () => void;
  playerView: boolean;
  onTogglePlayerView: () => void;
  /** DM scene switches that used to sit on a full-width bar under the canvas. */
  scene?: Scene;
  onFogMode?: (mode: 'vision' | 'manual') => void;
  onLighting?: (lighting: 'day' | 'night') => void;
}

function Ctl({ icon, label, onClick, on }: { icon: string; label: string; onClick: () => void; on?: boolean }): JSX.Element {
  return (
    <button type="button" className={`mp-ctl ${on ? 'on' : ''}`} aria-label={label} title={label} aria-pressed={on} onClick={onClick}>
      <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>{icon}</span>
    </button>
  );
}

/**
 * Bottom-right stack over the canvas: zoom in/out/centre, and for the DM the walls toggle, «ver como jugador» and —
 * above those — the two scene switches, light and automatic fog. They were a full-width bar under the map; as icons
 * here they cost no height, which is the whole point (specs/modules/maps/SPEC.md § «Rebanada 3»).
 */
export function CanvasControls(p: Props): JSX.Element {
  const { t } = useTranslation();
  const night = p.scene?.lighting === 'night';
  const auto = p.scene?.fogMode === 'vision';
  return (
    <div className="mp-controls" role="group" aria-label={t('maps.controls.label')}>
      {p.isDm && p.scene && p.onLighting && (
        <Ctl icon={night ? 'dark_mode' : 'light_mode'} on={night}
          label={night ? t('maps.light.night', { m: nightLabelM(p.scene) }) : t('maps.light.day')}
          onClick={() => p.onLighting?.(night ? 'day' : 'night')} />
      )}
      {p.isDm && p.scene && p.onFogMode && (
        <Ctl icon={auto ? 'cloud' : 'cloud_off'} on={auto} label={t('maps.fog.auto')} onClick={() => p.onFogMode?.(auto ? 'manual' : 'vision')} />
      )}
      {p.isDm && <span className="mp-ctl-sep" aria-hidden />}
      <Ctl icon="zoom_in" label={t('maps.controls.zoomIn')} onClick={p.onZoomIn} />
      <Ctl icon="zoom_out" label={t('maps.controls.zoomOut')} onClick={p.onZoomOut} />
      <Ctl icon="center_focus_strong" label={t('maps.controls.center')} onClick={p.onCenter} />
      {p.isDm && <Ctl icon={p.showWalls ? 'visibility' : 'visibility_off'} label={t('maps.controls.walls')} onClick={p.onToggleWalls} on={p.showWalls} />}
      {p.isDm && <Ctl icon="layers" label={t('maps.controls.playerView')} onClick={p.onTogglePlayerView} on={p.playerView} />}
    </div>
  );
}
