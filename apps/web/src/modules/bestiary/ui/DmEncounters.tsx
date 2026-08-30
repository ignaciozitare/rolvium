import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { CatalogItem, GameSystem, RollRequest } from '@rolvium/core';
import { sysT } from '@/modules/characters/domain/useCases/systemText';
import type { MapsPort } from '@/modules/maps/domain/ports/MapsPort';
import { mapsRepo } from '@/modules/maps/container';
import type { Scene, Token } from '@/modules/maps/domain/entities/Scene';
import { initialsOf, tokenGapCells, METRES_PER_CELL } from '@/modules/maps/domain/useCases/mapRules';
import { STAT_IDS } from '@rolvium/system-plenilunio';
import { DifficultyHold } from '@/modules/dice/ui/DifficultyHold';
import type { BestiaryEntry } from '../domain/entities/BestiaryEntry';
import { entryFromCatalogItem, gameValuesOf } from '../domain/useCases/bestiaryRules';
import { creatureRollRequest } from '../domain/useCases/creatureRoll';
import { TokenAttackModal, type AttackTarget } from './TokenAttackModal';
import './bestiary.css';

interface Props {
  system: GameSystem;
  maps?: MapsPort;
  campaignId: string;
  activeSceneId: string | null;
  /** Los encuentros PROPIOS del director, para resolver tokens con `bestiaryEntryId` (como en la escena). */
  extraEncounters: CatalogItem[];
  onRoll: (req: RollRequest) => Promise<unknown>;
  onOpenAttack: (input: { sceneId: string | null; attackerTokenId: string; targetTokenId: string; attackerName: string; targetCharacterId: string; dice: number; request: RollRequest }) => Promise<unknown>;
  /** «+ Añadir» lleva a la pestaña del Bestiario, que es donde se eligen criaturas nuevas. */
  onOpenBestiary?: () => void;
}

/**
 * «ENCUENTROS EN LA ESCENA · N» — la mitad de encuentros del panel del director (`rolvium.pen` columna 4,
 * `QWHSS`; corrección del dueño 2026-08-23: «te había pedido que aparezcan colapsados los encuentros de la
 * escena y puedas desplegarlos»).
 *
 * COLAPSADA por defecto, con el número. Cada fila: token con iniciales, nombre + lápiz, «Resistencia ·
 * protección · página», ATACAR (sangre) y flecha de desplegar — **al desplegar uno se cierra el anterior**.
 * Desplegado: las siete características en número grande y sus chips de «otras tiradas» (las SIETE,
 * decisión del dueño) con el mismo mantener-pulsado de la dificultad que las peticiones. El token que se
 * tira al mapa se añade solo: la lista lee los tokens vivos de la escena activa.
 */
export function DmEncounters({ system, maps = mapsRepo, campaignId, activeSceneId, extraEncounters, onRoll, onOpenAttack, onOpenBestiary }: Props): JSX.Element | null {
  const { t, locale } = useTranslation();
  const ts = useMemo(() => sysT(system, locale), [system, locale]);
  const [tokens, setTokens] = useState<Token[]>([]);
  /** La mesa sólo lleva el ID de la escena activa: la escena entera (hora, rejilla) se lee aquí. */
  const [scene, setScene] = useState<Scene | null>(null);
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null);
  const [attackingId, setAttackingId] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!activeSceneId) return;
    void maps.listTokens(activeSceneId).then(setTokens).catch(() => setTokens([]));
  }, [maps, activeSceneId]);

  useEffect(() => {
    if (!activeSceneId) { setTokens([]); setScene(null); return; }
    let live = true;
    reload();
    void maps.listScenes(campaignId)
      .then(list => { if (live) setScene(list.find(sc => sc.id === activeSceneId) ?? null); })
      .catch(() => undefined);
    // «El token que se tira al mapa se añade solo a la lista»: cualquier cambio de tokens recarga (son pocos).
    const off = maps.subscribe(activeSceneId, {
      onToken: () => { if (live) reload(); },
      onScene: c => { if (live && c.row) setScene(c.row); },
    });
    return () => { live = false; off(); };
  }, [maps, campaignId, activeSceneId, reload]);

  const creatures = useMemo(() => tokens.filter(tk => !tk.characterId && (tk.bestiaryRef || tk.bestiaryEntryId)), [tokens]);
  const night = scene?.lighting === 'night';

  const entryOf = useCallback((tk: Token): { entry: BestiaryEntry; blockName: string } | null => {
    const item = tk.bestiaryEntryId
      ? extraEncounters.find(i => i.data?.['entryId'] === tk.bestiaryEntryId) ?? null
      : tk.bestiaryRef ? (system.catalogs['bestiary'] ?? []).find(i => i.id === tk.bestiaryRef) ?? null : null;
    // El nombre del BLOQUE sale de la etiqueta del catálogo, no del token: el token puede llevar mote.
    return item ? { entry: entryFromCatalogItem(item, tk.name), blockName: ts(item.label) } : null;
  }, [extraEncounters, system, ts]);

  /** Los personajes de la escena con su distancia al ATACANTE ya medida en huecos entre cuerpos. */
  const targetsFor = useCallback((attacker: Token): AttackTarget[] => {
    if (!scene) return [];
    const round1 = (n: number) => Math.round(n * 10) / 10;
    return tokens.filter(tk => tk.characterId).map(tk => {
      const cells = tokenGapCells(attacker, tk, scene.grid.size);
      return { id: tk.id, name: tk.name, cells: round1(cells), metres: round1(cells * METRES_PER_CELL), characterId: tk.characterId! };
    });
  }, [tokens, scene]);

  if (!activeSceneId) return null;
  const attacking = attackingId ? creatures.find(tk => tk.id === attackingId) ?? null : null;
  const attackingEntry = attacking ? entryOf(attacking)?.entry ?? null : null;

  return (
    <div className="bs-enc">
      <button type="button" className="bs-enc-head" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span className="bs-enc-title">{t('bestiary.panel.title', { n: String(creatures.length) })}</span>
        <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }} aria-hidden="true">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {open && (
        <div className="bs-enc-body">
          {onOpenBestiary && (
            <button type="button" className="bs-enc-add" onClick={onOpenBestiary}>+ {t('bestiary.panel.add')}</button>
          )}
          {creatures.length === 0 && <p className="bs-enc-empty">{t('bestiary.panel.empty')}</p>}
          {creatures.map(tk => {
            const resolved = entryOf(tk);
            if (!resolved) return null;
            const { entry, blockName } = resolved;
            const vitals = gameValuesOf(entry, system.engine.derived);
            const resistance = typeof tk.state?.['resistance'] === 'number' ? (tk.state['resistance'] as number) : vitals.resistance;
            const expanded = expandedId === tk.id;
            return (
              <div key={tk.id} className="bs-enc-row">
                <div className="bs-enc-line">
                  <span className="bs-enc-tok" aria-hidden="true">{initialsOf(tk.name)}</span>
                  <span className="bs-enc-id">
                    {renaming?.id === tk.id ? (
                      <input className="bs-enc-input" value={renaming.draft} aria-label={t('bestiary.panel.rename')}
                             onChange={e => setRenaming({ id: tk.id, draft: e.target.value })} autoFocus />
                    ) : (
                      <span className="bs-enc-name">{tk.name}</span>
                    )}
                    {/* La línea de abajo CONSERVA el bloque original: así se sabe qué bicho es aunque tenga mote. */}
                    <span className="bs-enc-sub">
                      {tk.name === blockName ? '' : `${blockName} · `}
                      {t('bestiary.panel.sub', { resistance: String(resistance), protection: String(vitals.protection) })}
                      {entry.data.page ? ` · ${t('bestiary.attack.page', { n: String(entry.data.page) })}` : ''}
                    </span>
                  </span>
                  <button type="button" className="bs-enc-icon" aria-label={t('bestiary.panel.rename')}
                          onClick={() => {
                            if (renaming?.id === tk.id) {
                              const name = renaming.draft.trim();
                              if (name && name !== tk.name) {
                                void maps.updateToken(tk.id, { name });
                                setTokens(l => l.map(x => (x.id === tk.id ? { ...x, name } : x)));
                              }
                              setRenaming(null);
                            } else {
                              setRenaming({ id: tk.id, draft: tk.name });
                            }
                          }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }}>
                      {renaming?.id === tk.id ? 'check' : 'edit'}
                    </span>
                  </button>
                  <button type="button" className="bs-btn bs-btn-atk bs-enc-atk" onClick={() => setAttackingId(tk.id)}>
                    {t('bestiary.attack.button')}
                  </button>
                  <button type="button" className="bs-enc-icon" aria-label={t('bestiary.panel.expand', { name: tk.name })}
                          aria-expanded={expanded}
                          onClick={() => { setExpandedId(expanded ? null : tk.id); setMenuKey(null); }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }}>
                      {expanded ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                </div>
                {expanded && (
                  <div className="bs-enc-detail">
                    <div className="bs-enc-stats">
                      {STAT_IDS.map(stat => (
                        <span key={stat} className="bs-enc-stat">
                          <span className="bs-enc-stat-n">{entry.data.stats[stat] ?? '—'}</span>
                          <span className="bs-enc-stat-l">{ts(`sheet.stats.${stat}`).slice(0, 3)}</span>
                        </span>
                      ))}
                    </div>
                    <span className="dc-ask-label">{t('bestiary.panel.others')}</span>
                    <div className="dc-ask-stats" role="group" aria-label={t('bestiary.panel.others')}>
                      {STAT_IDS.map(stat => (
                        <DifficultyHold key={stat} label={ts(`sheet.stats.${stat}`)} ts={ts}
                                        open={menuKey === `${tk.id}:${stat}`}
                                        onOpen={o => setMenuKey(o ? `${tk.id}:${stat}` : null)}
                                        onPick={difficulty => {
                                          setMenuKey(null);
                                          void onRoll(creatureRollRequest(entry,
                                            { stat, specialty: false, difficulty, extraDice: 0, visibility: 'table', night },
                                            (sheet, action) => system.engine.poolFor(sheet, action),
                                            ts(`sheet.stats.${stat}`)));
                                        }} />
                      ))}
                    </div>
                    <p className="bs-enc-hint">{t('bestiary.panel.othersHint')}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {attacking && attackingEntry && scene && (
        <TokenAttackModal entry={attackingEntry} system={system} targets={targetsFor(attacking)} night={night}
                          onAttack={req => onRoll(req)}
                          onOpenAttack={i => onOpenAttack({
                            sceneId: activeSceneId, attackerTokenId: attacking.id, attackerName: attacking.name, ...i,
                          })}
                          onClose={() => setAttackingId(null)} />
      )}
    </div>
  );
}
