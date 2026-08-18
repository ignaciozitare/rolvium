import { useTranslation } from '@rolvium/i18n';

interface Props { onZoomIn: () => void; onZoomOut: () => void; onCenter: () => void; isDm: boolean; showWalls: boolean; onToggleWalls: () => void; playerView: boolean; onTogglePlayerView: () => void }

function Ctl({ icon, label, onClick, on }: { icon: string; label: string; onClick: () => void; on?: boolean }): JSX.Element {
  return (
    <button type="button" className={`mp-ctl ${on ? 'on' : ''}`} aria-label={label} title={label} aria-pressed={on} onClick={onClick}>
      <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>{icon}</span>
    </button>
  );
}

/** Bottom-right canvas controls: zoom in/out/centre; DM adds walls toggle + «ver como jugador». */
export function CanvasControls(p: Props): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="mp-controls" role="group" aria-label={t('maps.controls.label')}>
      <Ctl icon="zoom_in" label={t('maps.controls.zoomIn')} onClick={p.onZoomIn} />
      <Ctl icon="zoom_out" label={t('maps.controls.zoomOut')} onClick={p.onZoomOut} />
      <Ctl icon="center_focus_strong" label={t('maps.controls.center')} onClick={p.onCenter} />
      {p.isDm && <Ctl icon={p.showWalls ? 'visibility' : 'visibility_off'} label={t('maps.controls.walls')} onClick={p.onToggleWalls} on={p.showWalls} />}
      {p.isDm && <Ctl icon="layers" label={t('maps.controls.playerView')} onClick={p.onTogglePlayerView} on={p.playerView} />}
    </div>
  );
}
