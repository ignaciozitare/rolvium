import { useEffect, useMemo, useState, type ComponentProps, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from '@rolvium/i18n';
import { Badge, Crescent, UserAvatar } from '@rolvium/ui';
import { useAuth } from '@/shared/hooks/useAuth';
import { SYSTEMS } from '@/systems/registry';
import type { TablePort } from '../domain/ports/TablePort';
import type { TableTab } from '../domain/entities/Table';
import { tableRepo } from '../container';
import { handOf, initialTabFor, isConnected, tabsFor } from '../domain/useCases/tableRules';
import { useTable } from './useTable';
import { SharedResourceBar } from './SharedResourceBar';
import type { CharactersPort } from '@/modules/characters/domain/ports/CharactersPort';
import type { RollsPort } from '@/modules/dice/domain/ports/RollsPort';
import type { RollLogPort } from '@/modules/dice/domain/ports/RollLogPort';
import { charactersRepo as defaultCharacters } from '@/modules/characters/container';
import { rollsPort as defaultRolls, rollLog as defaultRollLog } from '@/modules/dice/container';
import { SidePanel } from '@/modules/dice/ui/SidePanel';
import { DiceRoller } from '@/modules/dice/ui/DiceRoller';
import { SheetTab, CreateTab } from './tabs/SheetTab';
import { GroupTab } from './tabs/GroupTab';
import { SceneTab } from './tabs/SceneTab';
import { BestiaryTab } from '@/modules/bestiary/ui/BestiaryTab';
import { useBestiary } from '@/modules/bestiary/ui/useBestiary';
import { toCatalogItem } from '@/modules/bestiary/domain/useCases/bestiaryRules';
import type { CatalogItem } from '@rolvium/core';
import type { MapsPort } from '@/modules/maps/domain/ports/MapsPort';
import type { VisionPort } from '@/modules/maps/domain/ports/VisionPort';
import type { BestiaryPort } from '@/modules/bestiary/domain/ports/BestiaryPort';
import './table.css';

/** `/table/:id` — the live table, dressed with the campaign's game system (rolvium.pen Mesa/Plenilunio). */
export function TablePage({ repo = tableRepo, charactersRepo = defaultCharacters, rolls = defaultRolls, rollLog = defaultRollLog, maps, vision, bestiary }: { repo?: TablePort; charactersRepo?: CharactersPort; rolls?: RollsPort; rollLog?: RollLogPort; maps?: MapsPort; vision?: VisionPort; bestiary?: BestiaryPort }): JSX.Element {
  const { id = '' } = useParams();
  const { t, locale } = useTranslation();
  const { user } = useAuth();
  const { snap, system, status, patchResources } = useTable(id, repo);
  // `null` = todavía no ha elegido. El rol no se sabe hasta que carga la campaña, y cada uno aterriza en
  // un sitio distinto: el director no tiene ficha propia, así que empieza en la escena.
  const [chosenTab, setTab] = useState<TableTab | null>(null);
  const [rollerOpen, setRollerOpen] = useState(false);
  /** The shared-resource bar floats over the tab and can be folded away: on the scene it was eating map. */
  const [resOpen, setResOpen] = useState(true);
  /** Sheet the DM opened from «El grupo» (null = my own). */
  const [viewCharacterId, setViewCharacterId] = useState<string | null>(null);
  // La criatura que el Bestiario manda a colocar. Vive aquí y no en la escena porque el viaje cruza dos
  // pestañas: se elige en «Bestiario» y se coloca en «Escena».
  const [toPlace, setToPlace] = useState<CatalogItem | null>(null);

  // System fonts: load once per system (theme.fonts.url).
  useEffect(() => {
    const url = system?.theme.fonts?.url;
    if (!url || document.querySelector(`link[data-sys-font="${system?.id}"]`)) return;
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = url; link.dataset.sysFont = system?.id ?? ''; document.head.appendChild(link);
  }, [system]);

  const themeStyle = useMemo<CSSProperties>(() => {
    if (!system) return {};
    const vars: Record<string, string> = {};
    for (const [k, v] of Object.entries(system.theme.vars)) vars[`--sys-${k}`] = v;
    if (system.theme.backgroundImage) vars['--sys-bg-image'] = `url(${system.theme.backgroundImage})`;
    return vars as CSSProperties;
  }, [system]);

  if (status === 'loading') return <div className="tb-state">{t('common.loading')}</div>;
  if (status === 'not_member') return <TableNotice icon="lock" title={t('table.notMember')} />;
  if (status === 'system_not_installed') return <TableNotice icon="extension_off" title={t('table.systemNotInstalled')} />;
  if (status === 'error' || !snap || !system || !user) return <TableNotice icon="error" title={t('common.error')} />;

  const { campaign, members, presence, resources, activeSceneId } = snap;
  const role = campaign.myRole ?? 'player';
  const tab = chosenTab ?? initialTabFor(role);
  // La ficha de un jugador no es pestaña del director, pero se llega desde «El grupo» y se vuelve allí:
  // marcarla mientras tanto evita una barra sin nada encendido, que se lee como «no estoy en ningún sitio».
  const marked = tab === 'sheet' && viewCharacterId ? 'group' : tab;
  const sysInfo = SYSTEMS.find(s => s.id === campaign.systemId);
  const tabs = tabsFor(role);
  const dm = members.find(m => m.role === 'dm');
  const players = members.filter(m => m.role === 'player');
  // Shared-resource dice in hand travel with every roll as `<resourceId>Dice` (e.g. destinyDice).
  const rollOptions = Object.fromEntries((system.engine.sharedResources ?? []).map(d => [`${d.id}Dice`, handOf(resources[d.id], user.id)]));
  /**
   * La reserva compartida, tal y como la usa el desplegable de tirar (`.pen` «Mesa/Tiradas», columna 1:
   * fichas `0…5` y «quedan N en la mesa»). Coger los dados es lo mismo que hace la barra de la reserva
   * —el mismo `takeResource`/`returnResource`—: sólo cambia desde dónde se pulsa. Sólo se arma para quien
   * PUEDE coger de ella; al director no se le pinta esa parte porque el servidor se la rechazaría.
   */
  const poolDef = (system.engine.sharedResources ?? []).find(d => d.whoCanTake === 'all' || d.whoCanTake === role);
  const pool = poolDef ? {
    def: poolDef,
    left: resources[poolDef.id]?.value ?? 0,
    hand: handOf(resources[poolDef.id], user.id),
    setHand: async (n: number): Promise<boolean> => {
      const diff = n - handOf(resources[poolDef.id], user.id);
      if (diff === 0) return true;
      const r = diff > 0 ? await repo.takeResource(campaign.id, poolDef.id, diff) : await repo.returnResource(campaign.id, poolDef.id, -diff);
      if ('error' in r) return false;
      patchResources(poolDef.id, r.state);
      return true;
    },
  } : undefined;
  const sysT = (key: string) => { const dict = ((system.locales[locale] ?? system.locales.es) ?? {}) as Record<string, unknown>; const v = key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), dict); return typeof v === 'string' ? v : key; };

  return (
    <div className="tb-root" data-system={system.id} style={themeStyle}>
      {/* Rolvium bar (platform chrome, stays in platform theme) */}
      <div className="tb-rvbar">
        <div className="tb-rvbar-left">
          <Link to="/campaigns" className="tb-rvbar-back"><span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>arrow_back</span>{t('modules.campaigns')}</Link>
          <img src="/brand/mark.svg" alt="" width={22} height={22} />
          <strong className="tb-rvbar-name">{campaign.name}</strong>
          <Badge color="accent">{sysInfo ? t(sysInfo.nameKey) : campaign.systemId}</Badge>
        </div>
        <nav className="tb-tabs tb-tabs-bar" aria-label={t('table.tabs')}>
          {/* Pulsar «Ficha» vuelve SIEMPRE a la mía. Si no, el director que había abierto la de un jugador
              desde «El grupo» se quedaba con esa pegada a la pestaña para el resto de la sesión: pulsaba
              «Ficha» y seguía viendo a otro, sin decirle de quién era ni cómo salir (dueño, 2026-08-21). */}
          {tabs.map(tb => <button key={tb} type="button" className={`tb-rvtab ${marked === tb ? 'on' : ''}`} aria-pressed={marked === tb}
                                  onClick={() => { if (tb === 'sheet') setViewCharacterId(null); setTab(tb); }}>{t(`table.tab.${tb}`)}</button>)}
        </nav>
        <div className="tb-rvbar-right">
          {/* Who is at the table lives in the platform bar: it is the same on every tab and the table needs its height for the map. */}
          <ul className="tb-people tb-people-bar" aria-label={t('table.connected')}>
            {dm && <Person key={dm.userId} name={dm.name} avatarUrl={dm.avatarUrl} label={t('table.dm')} isDm connected={isConnected(presence, dm.userId)} me={dm.userId === user.id} size={26} />}
            {players.map(p => <Person key={p.userId} name={p.name} avatarUrl={p.avatarUrl} label={isConnected(presence, p.userId) ? p.name : t('table.absent')} connected={isConnected(presence, p.userId)} me={p.userId === user.id} size={26} />)}
          </ul>
          <span className="tb-rvbar-devices"><span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>devices</span>{t('table.devices', { n: String(presence.find(p => p.userId === user.id)?.devices ?? 1) })}</span>
          <UserAvatar user={{ name: user.name, avatarUrl: user.avatarUrl }} size={28} />
        </div>
      </div>

      {/* Themed table */}
      <div className="tb-table">
        <header className="tb-head">
          <div className="tb-head-left">
            <Crescent size={42} />
            <div>
              <div className="tb-sysname">{sysT(system.name).toUpperCase()}</div>
              <div className="tb-rotulo tb-dim">{campaign.name}</div>
            </div>
          </div>
          {(system.engine.sharedResources ?? []).length > 0 && (
            <div className={`tb-res-head ${resOpen ? '' : 'folded'}`}>
              {resOpen && (system.engine.sharedResources ?? []).map(def => (
                <div key={def.id} className="tb-res-wrap">
                  <SharedResourceBar def={def} state={resources[def.id]} role={role} userId={user.id} label={sysT(def.label)}
                    onTake={async () => { const r = await repo.takeResource(campaign.id, def.id, 1); if ('error' in r) return r.error; patchResources(def.id, r.state); return null; }}
                    onReturn={async () => { const r = await repo.returnResource(campaign.id, def.id, 1); if ('error' in r) return r.error; patchResources(def.id, r.state); return null; }}
                    onReset={async () => { const r = await repo.resetResource(campaign.id, def.id); if ('error' in r) return r.error; patchResources(def.id, r.state); return null; }} />
                </div>
              ))}
              <button type="button" className="tb-res-fold" aria-expanded={resOpen} aria-label={resOpen ? t('maps.reserve.hide') : t('maps.reserve.show')} onClick={() => setResOpen(o => !o)}>
                <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>{resOpen ? 'chevron_left' : 'chevron_right'}</span>
              </button>
            </div>
          )}
          <div className="tb-head-right">
            <span className={`tb-btn ${role === 'dm' ? 'tb-btn-gold' : 'tb-btn-solid'}`} aria-label={t('table.yourRole')}>{t(`table.role.${role}`)}</span>
          </div>
        </header>

        <div className="tb-body">
          <main className="tb-main">
            {tab === 'sheet' && <SheetTab campaignId={campaign.id} system={system} role={role} userId={user.id} repo={charactersRepo} rolls={rolls} rollOptions={rollOptions} {...(pool ? { pool } : {})} characterId={viewCharacterId} progressionEnabled={campaign.progressionEnabled} onOpenCreate={() => setTab('create')}
              {...(viewCharacterId ? { onBack: () => { setViewCharacterId(null); setTab('group'); } } : {})} />}
            {tab === 'create' && <CreateTab campaignId={campaign.id} system={system} role={role} repo={charactersRepo} onCancel={() => setTab('sheet')} onCreated={c => { setViewCharacterId(c.ownerId === user.id ? null : c.id); setTab('sheet'); }} />}
            {tab === 'group' && <GroupTab campaignId={campaign.id} system={system} members={members} repo={charactersRepo} onView={c => { setViewCharacterId(c.id); setTab('sheet'); }} />}
            {tab === 'scene' && <Scene campaignId={campaign.id} role={role} userId={user.id} system={system} members={members} activeSceneId={activeSceneId} charactersRepo={charactersRepo} repo={maps} vision={vision} onOpenDice={() => setRollerOpen(o => !o)} diceOpen={rollerOpen} armEncounter={toPlace} onArmed={() => setToPlace(null)} />}
            {tab === 'bestiary' && <BestiaryTab campaignId={campaign.id} system={system} onPlace={e => { setToPlace(toCatalogItem(e)); setTab('scene'); }} rolls={rolls} {...(bestiary ? { repo: bestiary } : {})} />}
          </main>
          <aside className="tb-side">
            <SidePanel campaignId={campaign.id} system={system} rollerOpen={rollerOpen} onToggleRoller={() => setRollerOpen(o => !o)} log={rollLog} />
          </aside>
        </div>
        {rollerOpen && <DiceRoller campaignId={campaign.id} rolls={rolls} onClose={() => setRollerOpen(false)} />}
      </div>
    </div>
  );
}

type SceneProps = ComponentProps<typeof SceneTab>;

/**
 * La escena, con los encuentros PROPIOS del director metidos en su desplegable además de las 45 del manual.
 *
 * Es un componente aparte y no dos líneas dentro de `TablePage` por una razón concreta: `useBestiary` es un
 * hook y `TablePage` tiene varios `return` tempranos (sin sesión, sin sistema, sin ser miembro) por delante.
 *
 * Un jugador no pasa por aquí: la RLS no le devolvería nada, pero además así no se hace la consulta.
 */
function Scene(props: SceneProps): JSX.Element {
  return props.role === 'dm' ? <DmScene {...props} /> : <SceneTab {...props} />;
}

function DmScene(props: SceneProps): JSX.Element {
  const { entries } = useBestiary({ campaignId: props.campaignId, system: props.system });
  // Sólo las propias: las del manual ya las trae la escena del catálogo del sistema, y duplicarlas
  // las enseñaría dos veces en el desplegable.
  const extra = useMemo(() => entries.filter(e => e.origin !== 'manual').map(toCatalogItem), [entries]);
  return <SceneTab {...props} extraEncounters={extra} />;
}

function Person({ name, avatarUrl, label, isDm = false, connected, me, size = 40 }: { name: string; avatarUrl: string | null; label: string; isDm?: boolean; connected: boolean; me: boolean; size?: number }): JSX.Element {
  return (
    // In the platform bar the written label is hidden to save height, which also takes it out of the accessibility
    // tree: «director» and «ausente» would stop being readable at all. The name carries them instead.
    <li className={`tb-person ${connected ? 'on' : 'off'} ${me ? 'me' : ''}`} title={name} aria-label={label === name ? name : `${name} · ${label}`}>
      <span className={`tb-halo ${isDm ? 'dm' : ''}`}><UserAvatar user={{ name, avatarUrl }} size={size} /></span>
      <span className="tb-person-label" aria-hidden>{label.toUpperCase()}</span>
    </li>
  );
}

function TableNotice({ icon, title }: { icon: string; title: string }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="tb-state">
      <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-lg)', color: 'var(--ac)' }}>{icon}</span>
      <h2>{title}</h2>
      <Link to="/campaigns" className="rv-nav-btn active" style={{ width: 'auto' }}>{t('common.back')}</Link>
    </div>
  );
}
