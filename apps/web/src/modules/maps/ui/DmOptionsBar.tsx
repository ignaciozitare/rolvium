import { useTranslation } from '@rolvium/i18n';
import type { Scene, Wall } from '../domain/entities/Scene';
import { nightLabelM } from '../domain/useCases/mapRules';

interface Props {
  scene: Scene;
  walls: Wall[];
  hiddenTokens: number;
  /** «Niebla automática por visión»: on = `vision`, off = `manual`. The third mode (`off`) has no UI yet. */
  onFogMode: (mode: 'vision' | 'manual') => void;
  onLighting: (lighting: 'day' | 'night') => void;
}

/**
 * The DM's bar under the canvas (rolvium.pen `uXK3T` · «Opciones DJ»): automatic fog, scene light and the tally of
 * what the players cannot see. Only the DM changes the light, and it applies to everyone in the scene at once.
 */
export function DmOptionsBar({ scene, walls, hiddenTokens, onFogMode, onLighting }: Props): JSX.Element {
  const { t } = useTranslation();
  const auto = scene.fogMode === 'vision';
  const night = scene.lighting === 'night';
  const count = (kind: Wall['kind']) => walls.filter(w => w.kind === kind).length;
  return (
    <div className="mp-dmbar" role="group" aria-label={t('maps.dmOptions')}>
      <span className="mp-dm-tag">{t('maps.dmOnly')}</span>
      <label className="mp-check">
        <input type="checkbox" checked={auto} onChange={() => onFogMode(auto ? 'manual' : 'vision')} />
        {t('maps.fog.auto')}
      </label>
      <span className="mp-light" role="radiogroup" aria-label={t('maps.light.label')}>
        <span className="mp-light-label">{t('maps.light.label')}</span>
        <button type="button" role="radio" aria-checked={!night} className={`mp-seg ${night ? '' : 'on'}`} onClick={() => onLighting('day')}>{t('maps.light.day')}</button>
        <button type="button" role="radio" aria-checked={night} className={`mp-seg ${night ? 'on' : ''}`} onClick={() => onLighting('night')}>{t('maps.light.night', { m: nightLabelM(scene) })}</button>
      </span>
      <span className="mp-spacer" />
      <span className="mp-dm-count tb-italic tb-dim">
        {t('maps.dmCounts', { walls: String(count('wall')), doors: String(count('door')), windows: String(count('window')), hidden: String(hiddenTokens) })}
      </span>
    </div>
  );
}
