import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from '@rolvium/i18n';
import type { GameSystem } from '@rolvium/core';
import { systemRegistry } from '@/systems/registry';
import { systemThemeStyle, useSystemFonts } from '@/shared/lib/systemTheme';
import { campaignsRepo as defaultCampaigns, type CampaignsPort } from '@/modules/campaigns';
import { mapsRepo as defaultMaps, type MapsPort, type Scene } from '@/modules/maps';
import { rollsPort as defaultRolls, type RollsPort } from '@/modules/dice';
import type { BestiaryPort } from '@/modules/bestiary';
import '@/modules/table/ui/table.css';
import { adventuresPort as defaultAdventures } from '../container';
import type { AdventuresPort } from '../domain/ports/AdventuresPort';
import { AdventureDocument } from './AdventureDocument';
import { AdventureNpcs } from './AdventureNpcs';
import { useAdventureDoc } from './useAdventureDoc';
import './adventures.css';

interface Props {
  adventures?: AdventuresPort;
  maps?: MapsPort;
  campaigns?: CampaignsPort;
  /** La ventana suelta no tiene mesa que se lo inyecte: lo coge del contenedor de `dice`, y se puede sustituir. */
  rolls?: RollsPort;
  bestiary?: BestiaryPort;
}

/**
 * `/adventures/:id` — LA AVENTURA EN SU PROPIA VENTANA, la que abre el botón ABRIR APARTE.
 * Diseño: `rolvium.pen` § 4 · `Aventuras/Aventura en ventana aparte`.
 *
 * ⚠️ **`tb-root-page`, no `tb-root` a secas**: la página suelta viste con el papel del sistema pero NO puede
 * heredar `height:100dvh; overflow:hidden`, o se queda sin scroll. Es la misma trampa que ya se pagó con la
 * ficha de personaje (`sheet-standalone-scroll.test.tsx`), y por eso está escrita en el spec.
 */
export function AdventurePage({ adventures = defaultAdventures, maps = defaultMaps, campaigns = defaultCampaigns, rolls = defaultRolls, bestiary }: Props): JSX.Element {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const doc = useAdventureDoc(id || null, adventures);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [campaignName, setCampaignName] = useState('');
  const [system, setSystem] = useState<GameSystem | null>(null);
  /**
   * ¿Ya sabemos SI hay sistema? No es lo mismo que tenerlo: «todavía no ha contestado» y «no está instalado»
   * pintan cosas distintas, y hay que decidirlo ANTES de pintar el cuaderno. Si el sistema llegara después, el
   * cuaderno cambiaría de envoltorio (con Bestiario / sin él) y React lo desmontaría y volvería a montarlo
   * entero, perdiendo el cursor y el índice abierto por debajo de los pies del director. Cazado por la prueba
   * del índice de esta misma página al construir el punto 2 (2026-09-22).
   */
  const [systemKnown, setSystemKnown] = useState(false);

  const campaignId = doc.adventure?.campaignId ?? null;
  useEffect(() => {
    if (!campaignId) return undefined;
    let alive = true;
    void maps.listScenes(campaignId).then(rows => { if (alive) setScenes(rows); }).catch(() => {});
    void (async () => {
      try {
        const c = await campaigns.getById(campaignId);
        if (!alive || !c) return;
        setCampaignName(c.name);
        // Si el sistema no está instalado, la ventana se sigue leyendo: se queda con el papel de serie.
        const loaded = await systemRegistry.load(c.systemId);
        if (alive) setSystem(loaded);
      } catch { /* sin vestir */ } finally {
        // Pase lo que pase: la aventura se lee. Sin esto, una campaña que no contesta dejaría la ventana en
        // «Cargando…» para siempre, y lo que el director quiere es su texto.
        if (alive) setSystemKnown(true);
      }
    })();
    return () => { alive = false; };
  }, [campaignId, maps, campaigns]);

  useSystemFonts(system);
  const themeStyle = useMemo(() => systemThemeStyle(system), [system]);

  if (doc.load === 'loading') return <div className="tb-state">{t('common.loading')}</div>;
  if (doc.load === 'not_found') return <div className="tb-state"><h2>{t('adventures.notFound')}</h2></div>;
  if (doc.load === 'error' || !doc.adventure) return <div className="tb-state"><h2>{t('common.error')}</h2></div>;
  if (!systemKnown) return <div className="tb-state">{t('common.loading')}</div>;

  const mine = scenes.filter(s => s.adventureId === doc.adventure?.id);

  /** El cuaderno, con o sin lo que aporta el Bestiario. Igual que en la pestaña de la mesa. */
  const notebook = (npc: Partial<React.ComponentProps<typeof AdventureDocument>>) => (
    <AdventureDocument
      adventure={doc.adventure!} doc={doc.doc} onChange={doc.edit} onRename={doc.rename}
      save={doc.save} savedAt={doc.savedAt} onReload={doc.reload} onForceSave={doc.flush}
      scenes={mine.map(s => ({ id: s.id, name: s.name }))}
      // La mesa está en la OTRA ventana: al pinchar una escena se abre allí, no aquí.
      onOpenScene={sceneId => window.open(`/table/${doc.adventure?.campaignId ?? ''}?scene=${sceneId}`, '_blank', 'noopener')}
      {...npc}
    />
  );

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
        {/*
          * EL MISMO CUADERNO QUE LA PESTAÑA, y con el mismo Bestiario en sus filas (2026-09-22): mientras el
          * sistema todavía no ha cargado —o no está instalado— la aventura se lee igual, con las tablas a mano.
          */}
        {system && campaignId
          ? (
            <AdventureNpcs campaignId={campaignId} system={system}
                           onRoll={req => rolls.roll({ ...req, campaignId })} {...(bestiary ? { repo: bestiary } : {})}>
              {npc => notebook({ npcs: npc.npcs, npcLook: npc.look, onOpenNpc: npc.openNpc, onRollNpc: npc.rollNpc })}
            </AdventureNpcs>
          )
          : notebook({})}
      </div>
    </div>
  );
}
