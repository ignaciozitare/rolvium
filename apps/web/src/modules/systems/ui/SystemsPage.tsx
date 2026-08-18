import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { AVAILABLE_LOCALES, useTranslation } from '@rolvium/i18n';
import type { GameSystem, SystemInfo } from '@rolvium/core';
import { Btn, Card, Crescent, PageHeader, StatusChip } from '@rolvium/ui';
import { SYSTEMS, systemRegistry } from '@/systems/registry';
import './systems.css';

/** `--sys-*` vars of a loaded package, for the card preview (same mapping the table applies). */
function previewVars(system: GameSystem): CSSProperties {
  return Object.fromEntries(Object.entries(system.theme.vars).map(([k, v]) => [`--sys-${k}`, v])) as CSSProperties;
}

/** Facts the card shows about an installed package (pure, testable). */
export function packageFacts(system: GameSystem): { sections: number; catalogs: number; items: number; steps: number; font: string; locales: string[] } {
  const lists = Object.values(system.catalogs);
  return {
    sections: system.sheetSchema.sections.length,
    catalogs: lists.length,
    items: lists.reduce((n, l) => n + l.length, 0),
    steps: system.generator.length,
    font: system.theme.fonts?.display ?? '',
    locales: Object.keys(system.locales),
  };
}

interface Props { systems?: SystemInfo[]; load?: (id: string) => Promise<GameSystem> }

/** `/systems` — installed packages + coming soon (rolvium.pen `Sistemas/Catálogo`). */
export function SystemsPage({ systems = SYSTEMS, load = id => systemRegistry.load(id) }: Props): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<Record<string, GameSystem | null>>({});

  useEffect(() => {
    let alive = true;
    void Promise.all(systems.filter(s => s.installed).map(async s => [s.id, await load(s.id).catch(() => null)] as const))
      .then(pairs => { if (alive) setLoaded(Object.fromEntries(pairs)); });
    return () => { alive = false; };
  }, [systems, load]);

  const installed = systems.filter(s => s.installed);
  const soon = systems.filter(s => !s.installed);
  const localeLabel = (id: string) => AVAILABLE_LOCALES.find(l => l.id === id)?.label ?? id;

  return (
    <div className="rv-systems-page">
      <PageHeader title={t('systems.page.title')} subtitle={t('systems.page.subtitle')} />
      <div className="rv-systems-grid">
        <div className="rv-systems-main">
          {installed.map(s => {
            const sys = loaded[s.id];
            const facts = sys ? packageFacts(sys) : null;
            return (
              <article key={s.id} className="rv-system-card" aria-label={t(s.nameKey)}>
                {sys && (
                  <div className="rv-system-preview" style={previewVars(sys)} aria-hidden="true">
                    <Crescent size={26} /><span className="rv-system-preview-name">{t(s.nameKey)}</span>
                  </div>
                )}
                <div className="rv-system-body">
                  <div className="rv-system-head">
                    <div><h2 className="rv-system-name">{t(s.nameKey)}</h2>
                      <p className="rv-system-sub">{s.publisher} · {t('systems.page.packageVersion', { version: sys?.version ?? s.version })}</p></div>
                    <StatusChip tone="green">{t('systems.page.installed')}</StatusChip>
                  </div>
                  <p className="rv-system-desc">{t(`systems.${s.id}.desc`)}</p>
                  {sys === null && <div className="rv-err" role="alert">{t('systems.page.loadError')}</div>}
                  {facts && (
                    <ul className="rv-system-facts" aria-label={t('systems.page.brings')}>
                      <li><span className="material-symbols-outlined">description</span>{t('systems.page.sheet', { sections: String(facts.sections) })}</li>
                      <li><span className="material-symbols-outlined">casino</span>{t('systems.page.engine')}</li>
                      <li><span className="material-symbols-outlined">menu_book</span>{t('systems.page.catalogs', { n: String(facts.catalogs), items: String(facts.items) })}</li>
                      <li><span className="material-symbols-outlined">person_add</span>{t('systems.page.generator', { steps: String(facts.steps) })}</li>
                      {facts.font && <li><span className="material-symbols-outlined">palette</span>{t('systems.page.theme', { font: facts.font })}</li>}
                      <li><span className="material-symbols-outlined">translate</span>{t('systems.page.locales', { list: facts.locales.map(localeLabel).join(' · ') })}</li>
                    </ul>
                  )}
                  <p className="rv-system-license"><span className="material-symbols-outlined">info</span>{t('systems.page.license')}</p>
                  <div className="rv-system-acts">
                    <Btn variant="primary" onClick={() => navigate('/campaigns')}>{t('systems.page.createWith', { name: t(s.nameKey) })}</Btn>
                    <span className="rv-system-rules" title={t('systems.page.rulesHint')}><span className="material-symbols-outlined">menu_book</span>{t('systems.page.rules')} · RULES.md</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <aside className="rv-systems-aside">
          {soon.map(s => (
            <Card key={s.id}>
              <article className="rv-system-soon" aria-label={t(s.nameKey)}>
                <div className="rv-system-head">
                  <div><h3 className="rv-system-name">{t(s.nameKey)}</h3><p className="rv-system-sub">{s.publisher}</p></div>
                  <StatusChip tone="gray">{t('systems.page.comingSoon')}</StatusChip>
                </div>
                <p className="rv-system-desc">{t(`systems.${s.id}.desc`)}</p>
              </article>
            </Card>
          ))}
          <Card>
            <h3 className="rv-aside-title">{t('systems.page.haveOne')}</h3>
            <p className="rv-aside-sub">{t('systems.page.haveOneDesc')}</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
