import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { Modal, OptionGroup, Tooltip, useDialog } from '@rolvium/ui';
import type { MapsPort, Scene } from '@/modules/maps';
import { mapsRepo as defaultMaps } from '@/modules/maps';
import { adventuresPort as defaultAdventures } from '../container';
import type { Adventure, AdventurePatch, AdventureStatus } from '../domain/entities/Adventure';
import type { AdventuresPort } from '../domain/ports/AdventuresPort';
import {
  canRemoveAdventure, moveInOrder, nextSortOrder, runningPatches, sceneDestinations, type OrderMove,
} from '../domain/useCases/adventureRules';
import { AdventureDocument } from './AdventureDocument';
import { RailMenu, type MenuRow } from './RailMenu';
import { useAdventureDoc } from './useAdventureDoc';
import './adventures.css';

type T = (k: string, p?: Record<string, string>) => string;

/** «1 escena» y no «1 escenas»: es lo primero que se lee de cada aventura en el carril. */
const sceneCountText = (t: T, n: number): string =>
  (n === 1 ? t('adventures.sceneCountOne') : t('adventures.sceneCount', { n: String(n) }));

/** El orden del carril. Estable: dos con el mismo sitio se quedan como estaban. */
const bySortOrder = <X extends { sortOrder: number }>(rows: readonly X[]): X[] => [...rows].sort((a, b) => a.sortOrder - b.sortOrder);

type Change = { id: string; patch: AdventurePatch };
type OpenMenu = { kind: 'adventure' | 'scene'; id: string; anchor: HTMLElement };

interface Props {
  campaignId: string;
  /** Abrir una escena en la mesa: lo hace `TablePage`, que se la abre al director SIN activarla (abrir ≠ activar). */
  onOpenScene: (sceneId: string) => void;
  adventures?: AdventuresPort;
  maps?: MapsPort;
}

/**
 * AVENTURAS (H12) — **pestaña de la mesa, y SÓLO del director** (orden suya, 2026-09-19: «*ponlo dentro me
 * cago en todo!*»). Diseño: `rolvium.pen` § 4 · `Mesa/Plenilunio · Director · AVENTURAS · sólo el director`, y
 * los controles del carril en sus tres láminas hermanas (aprobadas el 2026-09-21).
 *
 * Tres zonas, a lo OneNote: el carril con las aventuras de la campaña y, debajo, las escenas de la abierta;
 * el índice al lado; y el documento. Que el jugador no las vea no lo decide esta pantalla: no hay ninguna
 * política que le dé la fila (RLS), así que aunque llegara aquí no habría nada que enseñar.
 *
 * El director ORGANIZA, no sólo escribe (lo que paró el QA el 2026-09-20): marca cuál está en curso, ordena,
 * archiva y borra aventuras, y crea, renombra, ordena y cambia de aventura sus escenas.
 */
export function AdventuresTab({ campaignId, onOpenScene, adventures = defaultAdventures, maps = defaultMaps }: Props): JSX.Element {
  const { t } = useTranslation();
  const dialog = useDialog();
  /** TODAS, también las archivadas: el carril las enseña aparte, y borrar necesita saber cuántas quedan. */
  const [all, setAll] = useState<Adventure[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  /**
   * PLEGADO, como el carril de escenas de la mesa (spec del 19-08; dibujado y aprobado el 2026-09-22): se queda
   * en una columna con sólo el botón para volver a abrirlo, y el documento se lleva el ancho. Como el de la mesa,
   * no se recuerda: al volver a entrar sale abierto.
   */
  const [railFolded, setRailFolded] = useState(false);
  const [removing, setRemoving] = useState<{ adventure: Adventure; target: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const kebabs = useRef(new Map<string, HTMLButtonElement>());
  const doc = useAdventureDoc(openId, adventures);

  const fetchAll = useCallback(
    () => Promise.all([adventures.list(campaignId, { includeArchived: true }), maps.listScenes(campaignId)]),
    [adventures, maps, campaignId],
  );

  const reloadList = useCallback(() => {
    setStatus('loading');
    fetchAll()
      .then(([rows, sceneRows]) => {
        setAll(rows);
        setScenes(sceneRows);
        setStatus('ready');
        // La que está EN CURSO es la que se abre: es la que el director tiene entre manos.
        const active = rows.filter(a => a.status !== 'archived');
        setOpenId(current => current ?? active.find(a => a.status === 'running')?.id ?? active[0]?.id ?? null);
      })
      .catch(() => setStatus('error'));
  }, [fetchAll]);

  useEffect(() => { reloadList(); }, [reloadList]);

  /** Algo no entró: se dice, y el carril vuelve a enseñar lo que hay DE VERDAD en la base, sin parpadear. */
  const fail = useCallback(() => {
    setNotice(t('adventures.actionError'));
    fetchAll().then(([rows, sceneRows]) => { setAll(rows); setScenes(sceneRows); }).catch(() => {});
  }, [fetchAll, t]);

  // El carril y la cabecera tienen que decir lo mismo mientras se escribe el título.
  const shown = useMemo(
    () => all.map(a => (a.id === doc.adventure?.id ? { ...a, title: doc.adventure.title } : a)),
    [all, doc.adventure],
  );
  const active = useMemo(() => shown.filter(a => a.status !== 'archived'), [shown]);
  const archived = useMemo(() => shown.filter(a => a.status === 'archived'), [shown]);
  const mine = useMemo(() => scenes.filter(s => s.adventureId === openId), [scenes, openId]);
  const countOf = (id: string) => scenes.filter(s => s.adventureId === id).length;
  const numberOf = (id: string) => String(active.findIndex(a => a.id === id) + 1);
  const openAfter = (goneId: string, rows: readonly Adventure[]) => {
    const left = rows.filter(a => a.id !== goneId && a.status !== 'archived');
    return left.find(a => a.status === 'running')?.id ?? left[0]?.id ?? null;
  };

  /**
   * Aplica los cambios en pantalla y los manda. Los de la aventura ABIERTA pasan por su documento: cualquier
   * cambio de la fila mueve su marca de tiempo, y el texto se guarda contra ella (`useAdventureDoc`).
   */
  const commit = async (changes: readonly Change[]) => {
    if (changes.length === 0) return;
    setNotice(null);
    setAll(rows => bySortOrder(rows.map(a => changes.filter(c => c.id === a.id).reduce((acc, c) => ({ ...acc, ...c.patch }), a))));
    try {
      for (const c of changes) {
        if (c.id === openId) await doc.patch(c.patch);
        else await adventures.update(c.id, c.patch);
      }
    } catch { fail(); }
  };

  const setAdventureStatus = (id: string, next: AdventureStatus) => {
    if (next === 'running') void commit(runningPatches(all, id).map(p => ({ id: p.id, patch: { status: p.status } })));
    else void commit([{ id, patch: { status: next } }]);
  };
  const moveAdventure = (id: string, dir: 'up' | 'down') =>
    void commit(moveInOrder(active, id, dir).map((m: OrderMove) => ({ id: m.id, patch: { sortOrder: m.sortOrder } })));
  const archive = (id: string) => {
    if (id === openId) setOpenId(openAfter(id, all));
    void commit([{ id, patch: { status: 'archived' } }]);
  };
  const unarchive = (id: string) => void commit([{ id, patch: { status: 'draft', sortOrder: nextSortOrder(active) } }]);

  const create = async () => {
    setNotice(null);
    try {
      const created = await adventures.create(campaignId, t('adventures.newTitle', { n: String(active.length + 1) }), nextSortOrder(all));
      setAll(rows => [...rows, created]);
      setOpenId(created.id);
    } catch { fail(); }
  };

  /** Borrar de verdad. Con escenas, primero se llevan a `target`: la base no deja borrar una que aún las tiene. */
  const removeNow = async (id: string, target: string | null) => {
    setNotice(null);
    try {
      if (target) for (const s of scenes.filter(x => x.adventureId === id)) await maps.updateScene(s.id, { adventureId: target });
      await adventures.remove(id);
      setScenes(rows => rows.map(s => (s.adventureId === id && target ? { ...s, adventureId: target } : s)));
      if (id === openId) setOpenId(target ?? openAfter(id, all));
      setAll(rows => rows.filter(a => a.id !== id));
    } catch { fail(); }
  };

  const askRemove = async (adventure: Adventure) => {
    if (countOf(adventure.id) > 0) {
      const target = sceneDestinations(all, adventure.id).preferred;
      if (target) setRemoving({ adventure, target });
      return;
    }
    const ok = await dialog.confirm(t('adventures.remove.confirm'), {
      title: t('adventures.remove.title', { title: adventure.title }), danger: true, confirmLabel: t('common.delete'),
    });
    if (ok) await removeNow(adventure.id, null);
  };

  // ── Las escenas de la aventura abierta ──────────────────────────────────────────────────────────────────
  const patchScenes = async (moves: readonly { id: string; patch: Partial<Pick<Scene, 'name' | 'sortOrder' | 'adventureId'>> }[]) => {
    if (moves.length === 0) return;
    setNotice(null);
    setScenes(rows => bySortOrder(rows.map(s => moves.filter(m => m.id === s.id).reduce((acc, m) => ({ ...acc, ...m.patch }), s))));
    try { for (const m of moves) await maps.updateScene(m.id, m.patch); } catch { fail(); }
  };

  const createScene = async () => {
    if (!openId) return;
    const name = await dialog.prompt(t('maps.scenes.name'), { title: t('maps.scenes.new') });
    if (!name?.trim()) return;
    setNotice(null);
    try {
      const created = await maps.createScene({ campaignId, name: name.trim(), adventureId: openId, sortOrder: nextSortOrder(scenes) });
      setScenes(rows => [...rows, created]);
    } catch { fail(); }
  };

  const renameScene = async (scene: Scene) => {
    const name = await dialog.prompt(t('maps.scenes.name'), { title: t('maps.scenes.rename'), defaultValue: scene.name });
    if (name?.trim() && name.trim() !== scene.name) await patchScenes([{ id: scene.id, patch: { name: name.trim() } }]);
  };

  // ── Los menús ───────────────────────────────────────────────────────────────────────────────────────────
  const closeMenu = useCallback(() => setMenu(null), []);
  const toggleMenu = (kind: OpenMenu['kind'], id: string) => {
    const anchor = kebabs.current.get(`${kind}:${id}`);
    setMenu(m => (m?.kind === kind && m.id === id ? null : anchor ? { kind, id, anchor } : null));
  };
  const kebabRef = (key: string) => (el: HTMLButtonElement | null) => { if (el) kebabs.current.set(key, el); else kebabs.current.delete(key); };

  const adventureRows = (a: Adventure): MenuRow[] => {
    const removable = canRemoveAdventure(all);
    const remove: MenuRow = {
      key: 'remove', icon: 'delete', label: t('adventures.menu.remove'), danger: true, disabled: !removable,
      hint: removable ? undefined : t('adventures.menu.lastOne'), onSelect: () => { void askRemove(a); },
    };
    if (a.status === 'archived') {
      return [{ key: 'unarchive', icon: 'unarchive', label: t('adventures.menu.unarchive'), onSelect: () => unarchive(a.id) }, 'separator', remove];
    }
    const i = active.findIndex(x => x.id === a.id);
    return [
      {
        key: 'running', icon: 'flag', label: t('adventures.menu.running'), hint: t('adventures.menu.runningHint'),
        disabled: a.status === 'running', onSelect: () => setAdventureStatus(a.id, 'running'),
      },
      { key: 'up', icon: 'arrow_upward', label: t('adventures.menu.up'), disabled: i <= 0, onSelect: () => moveAdventure(a.id, 'up') },
      { key: 'down', icon: 'arrow_downward', label: t('adventures.menu.down'), disabled: i >= active.length - 1, onSelect: () => moveAdventure(a.id, 'down') },
      'separator',
      { key: 'archive', icon: 'inventory_2', label: t('adventures.menu.archive'), onSelect: () => archive(a.id) },
      remove,
    ];
  };

  const sceneRows = (s: Scene): MenuRow[] => {
    const i = mine.findIndex(x => x.id === s.id);
    const others = active.filter(a => a.id !== s.adventureId);
    const move = (dir: 'up' | 'down') => {
      void patchScenes(moveInOrder(mine, s.id, dir).map(m => ({ id: m.id, patch: { sortOrder: m.sortOrder } })));
    };
    return [
      { key: 'rename', icon: 'edit', label: t('maps.scenes.rename'), onSelect: () => { void renameScene(s); } },
      { key: 'up', icon: 'arrow_upward', label: t('adventures.menu.up'), disabled: i <= 0, onSelect: () => move('up') },
      { key: 'down', icon: 'arrow_downward', label: t('adventures.menu.down'), disabled: i >= mine.length - 1, onSelect: () => move('down') },
      'separator',
      {
        key: 'moveTo', icon: 'drive_file_move', label: t('adventures.sceneMenu.moveTo'), disabled: others.length === 0,
        hint: others.length === 0 ? t('adventures.sceneMenu.noOther') : undefined,
        submenu: {
          label: t('adventures.sceneMenu.moveToLabel'),
          entries: others.map(a => ({
            key: a.id, n: numberOf(a.id), label: a.title, sub: t(`adventures.status.${a.status}`),
            onSelect: () => { void patchScenes([{ id: s.id, patch: { adventureId: a.id } }]); },
          })),
        },
      },
    ];
  };

  if (status === 'loading') return <p className="av-state">{t('common.loading')}</p>;
  if (status === 'error') {
    return (
      <div className="av-state">
        <p>{t('adventures.loadError')}</p>
        <button type="button" className="av-link" onClick={reloadList}>{t('journal.retry')}</button>
      </div>
    );
  }

  const openRow = shown.find(a => a.id === openId);
  const menuAdventure = menu?.kind === 'adventure' ? shown.find(a => a.id === menu.id) : undefined;
  const menuScene = menu?.kind === 'scene' ? mine.find(s => s.id === menu.id) : undefined;

  const adventureItem = (a: Adventure, lead: JSX.Element) => {
    const on = a.id === openId;
    const key = `adventure:${a.id}`;
    return (
      <li key={a.id} className="av-rail-row">
        <button
          type="button" className={`av-rail-item${on ? ' on' : ''}${a.status === 'archived' ? ' archived' : ''}`}
          aria-current={on} onClick={() => setOpenId(a.id)}
        >
          {lead}
          <span className="av-rail-text">
            <span className="av-rail-title">{a.title}</span>
            <span className="av-rail-sub">{t(`adventures.status.${a.status}`)} · {sceneCountText(t, countOf(a.id))}</span>
          </span>
        </button>
        <button
          type="button" ref={kebabRef(key)} className={`av-kebab${on ? ' on' : ''}`}
          aria-haspopup="menu" aria-expanded={menu?.kind === 'adventure' && menu.id === a.id}
          aria-label={t('adventures.menu.for', { title: a.title })} onClick={() => toggleMenu('adventure', a.id)}
        >
          <span className="material-symbols-outlined" aria-hidden="true">more_vert</span>
        </button>
      </li>
    );
  };

  const fold = (folded: boolean) => { setMenu(null); setRailFolded(folded); };

  return (
    <div className="av-tab">
      {railFolded && (
        <nav className="av-rail folded" aria-label={t('adventures.rail')}>
          <Tooltip label={t('adventures.unfoldRail')} placement="right">
            <button type="button" className="av-rail-fold" aria-expanded={false} aria-label={t('adventures.unfoldRail')} onClick={() => fold(false)}>
              <span className="material-symbols-outlined" aria-hidden="true">left_panel_open</span>
            </button>
          </Tooltip>
        </nav>
      )}
      {!railFolded && (
      <nav className="av-rail" aria-label={t('adventures.rail')}>
        <div className="av-rail-head">
          <span className="av-rail-label">{t('adventures.title')}</span>
          <button type="button" className="av-rail-add" onClick={() => { void create(); }} aria-label={t('adventures.new')}>
            <span className="material-symbols-outlined" aria-hidden="true">add</span>
          </button>
          <Tooltip label={t('adventures.foldRail')}>
            <button type="button" className="av-rail-fold" aria-expanded aria-label={t('adventures.foldRail')} onClick={() => fold(true)}>
              <span className="material-symbols-outlined" aria-hidden="true">left_panel_close</span>
            </button>
          </Tooltip>
        </div>
        {notice && <p className="av-notice" role="alert">{notice}</p>}
        <ul className="av-rail-list">
          {active.map((a, i) => adventureItem(a, <span className="av-rail-n">{i + 1}</span>))}
        </ul>
        {archived.length > 0 && (
          <>
            <button type="button" className="av-rail-fold" aria-expanded={showArchived} onClick={() => setShowArchived(v => !v)}>
              <span className="material-symbols-outlined" aria-hidden="true">{showArchived ? 'keyboard_arrow_down' : 'chevron_right'}</span>
              {t('adventures.archived', { n: String(archived.length) })}
            </button>
            {showArchived && (
              <ul className="av-rail-list">
                {archived.map(a => adventureItem(a, <span className="material-symbols-outlined" aria-hidden="true">inventory_2</span>))}
              </ul>
            )}
          </>
        )}

        <div className="av-rail-head">
          <span className="av-rail-label">{t('adventures.scenesOf')}</span>
          {openId && (
            <button type="button" className="av-rail-add" onClick={() => { void createScene(); }} aria-label={t('adventures.newScene')}>
              <span className="material-symbols-outlined" aria-hidden="true">add</span>
            </button>
          )}
        </div>
        <ul className="av-rail-list">
          {mine.length === 0 && <li className="av-rail-empty">{t('adventures.noScenes')}</li>}
          {mine.map(scene => (
            <li key={scene.id} className="av-rail-row">
              <button type="button" className="av-rail-scene" onClick={() => onOpenScene(scene.id)}>
                <span className="material-symbols-outlined" aria-hidden="true">map</span>
                {scene.name}
              </button>
              <button
                type="button" ref={kebabRef(`scene:${scene.id}`)} className="av-kebab"
                aria-haspopup="menu" aria-expanded={menu?.kind === 'scene' && menu.id === scene.id}
                aria-label={t('adventures.sceneMenu.for', { name: scene.name })} onClick={() => toggleMenu('scene', scene.id)}
              >
                <span className="material-symbols-outlined" aria-hidden="true">more_vert</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      )}

      {menu && menuAdventure && (
        <RailMenu key={`a-${menu.id}`} anchor={menu.anchor} label={t('adventures.menu.label')} placement="right" rows={adventureRows(menuAdventure)} onClose={closeMenu} />
      )}
      {menu && menuScene && (
        <RailMenu key={`s-${menu.id}`} anchor={menu.anchor} label={t('adventures.sceneMenu.label')} placement="right" rows={sceneRows(menuScene)} onClose={closeMenu} />
      )}

      {openId === null
        ? <p className="av-state">{t('adventures.noneActive')}</p>
        : doc.load === 'ready' && doc.adventure
          ? (
            <AdventureDocument
              // El estado lo manda el carril: si un cambio no entra, el carril vuelve a lo que hay de verdad y la
              // cabecera con él.
              adventure={openRow ? { ...doc.adventure, status: openRow.status } : doc.adventure}
              doc={doc.doc} onChange={doc.edit}
              // También en la lista del carril: si no, al abrir otra volvía a salir el título viejo.
              onRename={title => { doc.rename(title); setAll(rows => rows.map(a => (a.id === openId ? { ...a, title } : a))); }}
              save={doc.save} savedAt={doc.savedAt} onReload={doc.reload} onForceSave={doc.flush}
              scenes={mine.map(s => ({ id: s.id, name: s.name }))} onOpenScene={onOpenScene}
              onOpenApart={() => window.open(`/adventures/${doc.adventure?.id ?? ''}`, '_blank', 'noopener')}
              onStatusChange={next => { if (openId) setAdventureStatus(openId, next); }}
            />
          )
          : <p className="av-state">{doc.load === 'loading' ? t('common.loading') : t('adventures.loadError')}</p>}

      {removing && (
        <Modal title={t('adventures.remove.title', { title: removing.adventure.title })} onClose={() => setRemoving(null)}>
          <div className="av-remove">
            <p>
              {countOf(removing.adventure.id) === 1
                ? t('adventures.remove.withSceneOne')
                : t('adventures.remove.withScenes', { n: String(countOf(removing.adventure.id)) })}
            </p>
            <span className="av-remove-label">{t('adventures.remove.moveTo')}</span>
            <OptionGroup
              ariaLabel={t('adventures.remove.moveTo')} look="outline" value={removing.target}
              onChange={target => setRemoving(r => (r ? { ...r, target } : r))}
              options={sceneDestinations(all, removing.adventure.id).options.map(a => ({
                value: a.id, wide: true,
                label: `${a.status === 'archived' ? '' : `${numberOf(a.id)} · `}${a.title}${a.status === 'running' ? ` · ${t('adventures.status.running')}` : ''}`,
              }))}
            />
            <div className="av-remove-foot">
              <button type="button" className="av-btn quiet" onClick={() => setRemoving(null)}>{t('common.cancel')}</button>
              <button
                type="button" className="av-btn on"
                onClick={() => { const { adventure, target } = removing; setRemoving(null); void removeNow(adventure.id, target); }}
              >
                <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                {t('adventures.remove.confirmMove')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
