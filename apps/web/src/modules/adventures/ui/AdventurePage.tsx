import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from '@rolvium/i18n';
import type { GameSystem } from '@rolvium/core';
import { systemRegistry } from '@/systems/registry';
import { systemThemeStyle, useSystemFonts } from '@/shared/lib/systemTheme';
import { campaignsRepo as defaultCampaigns, type CampaignsPort } from '@/modules/campaigns';
import { mapsRepo as defaultMaps, type MapsPort, type Scene } from '@/modules/maps';
import '@/modules/table/ui/table.css';
import { adventuresPort as defaultAdventures } from '../container';
import type { AdventuresPort } from '../domain/ports/AdventuresPort';
import { AdventureDocument } from './AdventureDocument';
import { useAdventureDoc } from './useAdventureDoc';
import './adventures.css';

interface Props { adventures?: AdventuresPort; maps?: MapsPort; campaigns?: CampaignsPort }

/**
 * `/adventures/:id` — LA AVENTURA EN SU PROPIA VENTANA, la que abre el botón ABRIR APARTE.
 * Diseño: `rolvium.pen` § 4 · `Aventuras/Aventura en ventana aparte`.
 *
 * ⚠️ **`tb-root-page`, no `tb-root` a secas**: la página suelta viste con el papel del sistema pero NO puede
 * heredar `height:100dvh; overflow:hidden`, o se queda sin scroll. Es la misma trampa que ya se pagó con la
 * ficha de personaje (`sheet-standalone-scroll.test.tsx`), y por eso está escrita en el spec.
 */
export function AdventurePage({ adventures = defaultAdventures, maps = defaultMaps, campaigns = defaultCampaigns }: Props): JSX.Element {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const doc = useAdventureDoc(id || null, adventures);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [campaignName, setCampaignName] = useState('');
  const [system, setSystem] = useState<GameSystem | null>(null);

  const campaignId = doc.adventure?.campaignId ?? null;
  useEffect(() => {
    if (!campaignId) return undefined;
    let alive = true;
    void maps.listScenes(campaignId).then(rows => { if (alive) setScenes(rows); }).catch(() => {});
    void campaigns.getById(campaignId).then(async c => {
      if (!alive || !c) return;
      setCampaignName(c.name);
      // Si el sistema no está instalado, la ventana se sigue leyendo: se queda con el papel de serie.
      try { const loaded = await systemRegistry.load(c.systemId); if (alive) setSystem(loaded); } catch { /* sin vestir */ }
    }).catch(() => {});
    return () => { alive = false; };
  }, [campaignId, maps, campaigns]);

  useSystemFonts(system);
  const themeStyle = useMemo(() => systemThemeStyle(system), [system]);

  if (doc.load === 'loading') return <div className="tb-state">{t('common.loading')}</div>;
  if (doc.load === 'not_found') return <div className="tb-state"><h2>{t('adventures.notFound')}</h2></div>;
  if (doc.load === 'error' || !doc.adventure) return <div className="tb-state"><h2>{t('common.error')}</h2></div>;

  const mine = scenes.filter(s => s.adventureId === doc.adventure?.id);

  return (
    <div className="tb-root tb-root-page" {...(system ? { 'data-system': system.id } : {})} style={themeStyle}>
      <div className="tb-rvbar">
        <div className="tb-rvbar-left">
          <Link to={`/table/${doc.adventure.campaignId}`} className="tb-rvbar-back">
            <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>arrow_back</span>
            {t('adventures.backToTable')}
          </Link>
          <img src="/brand/mark.svg" alt="" width={22} height={22} />
          <strong className="tb-rvbar-name">
            {t('adventures.one')} · {doc.adventure.title}{campaignName ? ` · ${campaignName}` : ''}
          </strong>
        </div>
      </div>
      <div className="av-window">
        <AdventureDocument
          adventure={doc.adventure} doc={doc.doc} onChange={doc.edit} onRename={doc.rename}
          save={doc.save} savedAt={doc.savedAt} onReload={doc.reload}
          scenes={mine.map(s => ({ id: s.id, name: s.name }))}
          // La mesa está en la OTRA ventana: al pinchar una escena se abre allí, no aquí.
          onOpenScene={sceneId => window.open(`/table/${doc.adventure?.campaignId ?? ''}?scene=${sceneId}`, '_blank', 'noopener')}
        />
      </div>
    </div>
  );
}
