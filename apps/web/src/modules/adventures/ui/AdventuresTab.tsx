import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { MapsPort, Scene } from '@/modules/maps';
import { mapsRepo as defaultMaps } from '@/modules/maps';
import { adventuresPort as defaultAdventures } from '../container';
import type { Adventure } from '../domain/entities/Adventure';
import type { AdventuresPort } from '../domain/ports/AdventuresPort';
import { AdventureDocument } from './AdventureDocument';
import { useAdventureDoc } from './useAdventureDoc';
import './adventures.css';

/** «1 escena» y no «1 escenas»: es lo primero que se lee de cada aventura en el carril. */
const sceneCountText = (t: (k: string, p?: Record<string, string>) => string, n: number): string =>
  (n === 1 ? t('adventures.sceneCountOne') : t('adventures.sceneCount', { n: String(n) }));

interface Props {
  campaignId: string;
  /** Abrir una escena en la mesa: lo hace `TablePage`, que es quien sabe de escena activa. */
  onOpenScene: (sceneId: string) => void;
  adventures?: AdventuresPort;
  maps?: MapsPort;
}

/**
 * AVENTURAS (H12) — **pestaña de la mesa, y SÓLO del director** (orden suya, 2026-09-19: «*ponlo dentro me
 * cago en todo!*»). Diseño: `rolvium.pen` § 4 · `Mesa/Plenilunio · Director · AVENTURAS · sólo el director`.
 *
 * Tres zonas, a lo OneNote: el carril con las aventuras de la campaña y, debajo, las escenas de la abierta;
 * el índice al lado; y el documento. Que el jugador no las vea no lo decide esta pantalla: no hay ninguna
 * política que le dé la fila (RLS), así que aunque llegara aquí no habría nada que enseñar.
 */
export function AdventuresTab({ campaignId, onOpenScene, adventures = defaultAdventures, maps = defaultMaps }: Props): JSX.Element {
  const { t } = useTranslation();
  const [list, setList] = useState<Adventure[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const doc = useAdventureDoc(openId, adventures);

  const reloadList = useCallback(() => {
    setStatus('loading');
    Promise.all([adventures.list(campaignId), maps.listScenes(campaignId)])
      .then(([rows, sceneRows]) => {
        setList(rows);
        setScenes(sceneRows);
        setStatus('ready');
        // La que está EN CURSO es la que se abre: es la que el director tiene entre manos.
        setOpenId(current => current ?? rows.find(a => a.status === 'running')?.id ?? rows[0]?.id ?? null);
      })
      .catch(() => setStatus('error'));
  }, [adventures, maps, campaignId]);

  useEffect(() => { reloadList(); }, [reloadList]);

  const create = async () => {
    const created = await adventures.create(campaignId, t('adventures.newTitle', { n: String(list.length + 1) }));
    setList(rows => [...rows, created]);
    setOpenId(created.id);
  };

  const mine = useMemo(() => scenes.filter(s => s.adventureId === openId), [scenes, openId]);
  // El carril y la cabecera tienen que decir lo mismo mientras se escribe el título.
  const shown = doc.adventure ? list.map(a => (a.id === doc.adventure?.id ? doc.adventure : a)) : list;

  if (status === 'loading') return <p className="av-state">{t('common.loading')}</p>;
  if (status === 'error') {
    return (
      <div className="av-state">
        <p>{t('adventures.loadError')}</p>
        <button type="button" className="av-link" onClick={reloadList}>{t('journal.retry')}</button>
      </div>
    );
  }

  return (
    <div className="av-tab">
      <nav className="av-rail" aria-label={t('adventures.rail')}>
        <div className="av-rail-head">
          <span className="av-rail-label">{t('adventures.title')}</span>
          <button type="button" className="av-rail-add" onClick={() => { void create(); }} aria-label={t('adventures.new')}>
            <span className="material-symbols-outlined" aria-hidden="true">add</span>
          </button>
        </div>
        <ul className="av-rail-list">
          {shown.map((adventure, i) => (
            <li key={adventure.id}>
              <button
                type="button" className={`av-rail-item${adventure.id === openId ? ' on' : ''}`}
                aria-current={adventure.id === openId} onClick={() => setOpenId(adventure.id)}
              >
                <span className="av-rail-n">{i + 1}</span>
                <span className="av-rail-text">
                  <span className="av-rail-title">{adventure.title}</span>
                  <span className="av-rail-sub">
                    {t(`adventures.status.${adventure.status}`)} · {sceneCountText(t, scenes.filter(s => s.adventureId === adventure.id).length)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="av-rail-head">
          <span className="av-rail-label">{t('adventures.scenesOf')}</span>
        </div>
        <ul className="av-rail-list">
          {mine.length === 0 && <li className="av-rail-empty">{t('adventures.noScenes')}</li>}
          {mine.map(scene => (
            <li key={scene.id}>
              <button type="button" className="av-rail-scene" onClick={() => onOpenScene(scene.id)}>
                <span className="material-symbols-outlined" aria-hidden="true">map</span>
                {scene.name}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {doc.load === 'ready' && doc.adventure
        ? (
          <AdventureDocument
            adventure={doc.adventure} doc={doc.doc} onChange={doc.edit} onRename={doc.rename}
            save={doc.save} savedAt={doc.savedAt} onReload={doc.reload}
            scenes={mine.map(s => ({ id: s.id, name: s.name }))} onOpenScene={onOpenScene}
            onOpenApart={() => window.open(`/adventures/${doc.adventure?.id ?? ''}`, '_blank', 'noopener')}
          />
        )
        : <p className="av-state">{doc.load === 'loading' ? t('common.loading') : t('adventures.loadError')}</p>}
    </div>
  );
}
