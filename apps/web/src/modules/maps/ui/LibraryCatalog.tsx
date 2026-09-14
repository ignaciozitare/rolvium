import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { Modal, Slider, useDialog } from '@rolvium/ui';
import {
  countIn, hasBuiltIn, LIBRARY_DRAG_MIME, rangeIds, sectionsOf, toggleId,
  type LibraryGroup, type LibraryItem, type PlaceOf, type Shelf, type ShelfSort,
} from '../domain/useCases/libraryRules';

export interface LibraryCatalogProps<T extends LibraryItem> {
  /** El prefijo de las claves de texto: `maps.props.catalog` o `maps.textures.catalog`. Las dos caras llevan las mismas. */
  keys: string;
  /** El icono de la cabecera. */
  icon: ReactNode;
  /** `null` mientras se cargan: no es lo mismo «vacía» que «todavía no han llegado». */
  items: T[] | null;
  /** Los grupos del rail: paquetes de piezas o categorías de texturas, ya con su nombre en el idioma de la app. */
  groups: LibraryGroup[] | null;
  /** Las secciones DE SERIE (las categorías de piezas de la app); vacío si esta biblioteca no tiene. */
  builtIns: readonly string[];
  builtInLabel?: (key: string) => string;
  /** Dónde vive cada cosa: lo único que distingue una pieza de una textura para el catálogo. */
  placeOf: PlaceOf<T>;
  groupIcon: string;
  /**
   * ¿PUEDE ORDENAR LA BIBLIOTECA? Es un permiso del motor de roles (`manage_props` · `manage_textures`). Sin él
   * no salen ni «Subir», ni los tres puntos, ni marcar, ni «Nuevo paquete». Quien deniega de verdad es la base.
   */
  canManage: boolean;
  favorites: readonly string[];
  recents: readonly string[];
  onToggleFavorite: (item: T) => void;
  /** Elegir una: la hace el sello (piezas) o la pone (texturas). Cierra el catálogo quien recibe esto. */
  onPick: (item: T) => void;
  /** La miniatura de una baldosa: el arte de la pieza, o la textura repetida a su tamaño de baldosa. */
  renderThumb: (item: T) => ReactNode;
  /** Abrir la subida en lote, en el grupo que se esté mirando. Con ficheros si vienen arrastrados. */
  onUpload: (groupId: string | null, files?: File[]) => void;
  onRename: (item: T, name: string) => void;
  /** Mover a otro grupo. Con varias marcadas se llama una vez por cada una. */
  onMoveTo: (item: T, groupId: string | null) => void;
  /** Ya confirmado: quien recibe esto sólo tiene que borrarla. Con varias marcadas, una vez por cada una. */
  onRemove: (item: T) => void;
  /** Sólo las bibliotecas con grupos PROPIOS (paquetes): crear, renombrar y borrar. Las categorías cerradas no. */
  onNewGroup?: (name: string) => void;
  onRenameGroup?: (group: LibraryGroup, name: string) => void;
  onRemoveGroup?: (group: LibraryGroup) => void;
  /** Con qué estante se abre. De serie, el primer grupo; sin grupos, todo. */
  initialShelf?: Shelf;
  /** La pista del pie, si esta cara quiere otra que la de serie. */
  hint?: string;
  onClose: () => void;
}

const THUMB_MIN = 72;
const THUMB_MAX = 180;
const THUMB_DEFAULT = 118;

const shelfKey = (s: Shelf): string =>
  s.kind === 'pack' ? `pack:${s.id ?? 'none'}` : s.kind === 'category' ? `cat:${s.category}` : s.kind;

/** ¿Lo que se arrastra son baldosas de aquí (y no ficheros de fuera)? */
const esArrastreInterno = (e: React.DragEvent): boolean => {
  const types = e.dataTransfer?.types as ArrayLike<string> | undefined;
  return !!types && Array.from(types).includes(LIBRARY_DRAG_MIME);
};

/**
 * EL CATÁLOGO DE UNA BIBLIOTECA a pantalla completa (`rolvium.pen` · `w7sTC0`, aprobado el 2026-09-11; con los
 * tres puntos a la vista, la selección múltiple y el arrastre al grupo, aprobados el 2026-09-13 · § 6.8).
 *
 * UN SOLO COMPONENTE CON DOS CARAS (él, 2026-09-13: «*quiero el mismo de los objetos, usa el mismo componente*»):
 * las piezas lo montan con sus paquetes (`PropsCatalog`) y las texturas con sus categorías (`TextureCatalog`).
 * Lo que sabe cada cara —qué es un grupo, cómo se pinta una miniatura, dónde vive cada cosa— entra por props;
 * aquí sólo hay cabecera, barra, rail, rejilla, menús y selección.
 *
 * Se dibuja con los tokens de la APP (`--tx`, `--sf2`…) y no con los de la mesa, porque vive dentro del `Modal`
 * compartido. Lo elegido va en sangre, como en toda la mesa.
 */
export function LibraryCatalog<T extends LibraryItem>({
  keys, icon, items, groups, builtIns, builtInLabel, placeOf, groupIcon, canManage, favorites, recents, onToggleFavorite, onPick,
  renderThumb, onUpload, onRename, onMoveTo, onRemove, onNewGroup, onRenameGroup, onRemoveGroup, initialShelf, hint, onClose,
}: LibraryCatalogProps<T>): JSX.Element {
  const { t } = useTranslation();
  const dialog = useDialog();
  const k = (key: string, vars?: Record<string, string>): string => t(`${keys}.${key}`, vars);
  const [query, setQuery] = useState('');
  const [shelf, setShelf] = useState<Shelf>(() => initialShelf ?? (groups?.[0] ? { kind: 'pack', id: groups[0].id } : { kind: 'all' }));
  const [grouped, setGrouped] = useState(true);
  const [sort, setSort] = useState<ShelfSort>('name');
  const [thumb, setThumb] = useState(THUMB_DEFAULT);
  /** Qué baldosa o grupo tiene el menú abierto, y si dentro se está eligiendo destino. `sel` es el de la barra de selección. */
  const [menu, setMenu] = useState<{ kind: 'item' | 'group' | 'sel'; id: string; step: 'main' | 'move' } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  /** LA SELECCIÓN MÚLTIPLE (§ 6.8, punto 4): las marcadas, la última que se marcó (para Mayús) y el grupo bajo el arrastre. */
  const [selected, setSelected] = useState<string[]>([]);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);

  const ctx = useMemo(() => ({ favorites, recents }), [favorites, recents]);
  const all = items ?? [];
  const groupList = groups ?? [];
  const propios = !!onNewGroup;
  // Buscando se mira TODO («Buscar en todos…»): el estante sólo manda con el buscador vacío.
  const shelfNow: Shelf = query.trim() ? { kind: 'all' } : shelf;
  const sections = useMemo(() => sectionsOf(all, groupList, builtIns, shelfNow, query, sort, ctx, grouped, placeOf), [all, groupList, builtIns, shelfNow, query, sort, ctx, grouped, placeOf]);
  const shownCount = sections.reduce((n, s) => n + s.items.length, 0);
  const visibleIds = useMemo(() => sections.flatMap(s => s.items.map(i => i.id)), [sections]);
  const loose = countIn(all, { kind: 'pack', id: null }, ctx, placeOf);
  const deSerie = builtIns.length > 0 && hasBuiltIn(all, placeOf);
  /** Adónde va lo que se suba desde aquí: el grupo abierto, o «Sin clasificar» (o el primer grupo, si no hay sueltas). */
  const uploadGroup = shelf.kind === 'pack' ? shelf.id : propios ? null : groupList[0]?.id ?? null;
  const groupOf = (id: string | null): LibraryGroup | null => groupList.find(g => g.id === id) ?? null;
  const shelfTitle = (s: Shelf): string => {
    switch (s.kind) {
      case 'all': return k('all');
      case 'recent': return k('recent');
      case 'favorites': return k('favorites');
      case 'pack': return s.id === null ? k('unsorted') : groupOf(s.id)?.name ?? k('unsorted');
      case 'category': return builtInLabel?.(s.category) ?? s.category;
    }
  };
  const marcadas = useMemo(() => selected.map(id => all.find(i => i.id === id)).filter((i): i is T => !!i), [selected, all]);
  const limpiarSeleccion = (): void => { setSelected([]); setAnchor(null); };

  useEffect(() => {
    if (!menu) return;
    const fuera = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc); };
  }, [menu]);
  /**
   * Esc QUITA LA SELECCIÓN antes de que el modal se cierre: con algo marcado, una pulsación es para eso. Se
   * escucha en la fase de captura para llegar ANTES que el `Modal`, que cierra con la misma tecla.
   */
  useEffect(() => {
    if (!selected.length) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); limpiarSeleccion(); } };
    document.addEventListener('keydown', esc, true);
    return () => document.removeEventListener('keydown', esc, true);
  }, [selected.length]);

  const renombrar = async (item: T): Promise<void> => {
    setMenu(null);
    const nombre = await dialog.prompt(k('renamePrompt'), { defaultValue: item.name });
    const limpio = nombre?.trim();
    if (limpio && limpio !== item.name) onRename(item, limpio.slice(0, 80));
  };
  const borrar = async (item: T): Promise<void> => {
    setMenu(null);
    const ok = await dialog.confirm(k('removeConfirm', { name: item.name }), { danger: true, confirmLabel: t('common.delete'), cancelLabel: t('common.cancel') });
    if (ok) onRemove(item);
  };
  const borrarMarcadas = async (): Promise<void> => {
    setMenu(null);
    if (!marcadas.length) return;
    const ok = await dialog.confirm(k('removeManyConfirm', { n: String(marcadas.length) }), { danger: true, confirmLabel: t('common.delete'), cancelLabel: t('common.cancel') });
    if (!ok) return;
    marcadas.forEach(i => onRemove(i));
    limpiarSeleccion();
  };
  const moverMarcadas = (groupId: string | null): void => {
    setMenu(null);
    marcadas.filter(i => placeOf(i).group !== groupId).forEach(i => onMoveTo(i, groupId));
    limpiarSeleccion();
  };
  const nuevoGrupo = async (): Promise<void> => {
    const nombre = await dialog.prompt(k('newPackPrompt'));
    const limpio = nombre?.trim();
    if (limpio) onNewGroup?.(limpio.slice(0, 80));
  };
  const renombrarGrupo = async (group: LibraryGroup): Promise<void> => {
    setMenu(null);
    const nombre = await dialog.prompt(k('renamePackPrompt'), { defaultValue: group.name });
    const limpio = nombre?.trim();
    if (limpio && limpio !== group.name) onRenameGroup?.(group, limpio.slice(0, 80));
  };
  const borrarGrupo = async (group: LibraryGroup): Promise<void> => {
    setMenu(null);
    const ok = await dialog.confirm(k('deletePackConfirm', { name: group.name }), { danger: true, confirmLabel: t('common.delete'), cancelLabel: t('common.cancel') });
    if (!ok) return;
    if (shelf.kind === 'pack' && shelf.id === group.id) setShelf({ kind: 'pack', id: null });
    onRemoveGroup?.(group);
  };

  /**
   * PINCHAR UNA BALDOSA: Ctrl/Cmd la marca, Mayús coge el tramo desde la última marcada, y sin nada marcado la
   * elige. Con algo ya marcado, un clic normal marca o desmarca: mientras se ordena no se sale del catálogo.
   */
  const pinchar = (item: T, e: React.MouseEvent): void => {
    if (canManage && e.shiftKey) { setSelected(s => rangeIds(visibleIds, s, anchor, item.id)); setAnchor(item.id); return; }
    if (canManage && (e.ctrlKey || e.metaKey || selected.length)) { setSelected(s => toggleId(s, item.id)); setAnchor(item.id); return; }
    onPick(item);
  };
  const marcar = (item: T): void => { setSelected(s => toggleId(s, item.id)); setAnchor(item.id); };

  /** Arrastrar imágenes de FUERA sobre el catálogo → la subida en lote, ya con los ficheros y en el grupo abierto. */
  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    setDragging(false);
    if (!canManage || esArrastreInterno(e)) return;
    const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
    if (files.length) onUpload(uploadGroup, files);
  };
  /** Arrastrar baldosas: lo marcado, o sólo ésta si no está marcada. */
  const empezarArrastre = (item: T, e: React.DragEvent): void => {
    const ids = selected.includes(item.id) ? selected : [item.id];
    e.dataTransfer.setData(LIBRARY_DRAG_MIME, JSON.stringify(ids));
    e.dataTransfer.effectAllowed = 'move';
  };
  const soltarEnGrupo = (groupId: string | null, e: React.DragEvent): void => {
    e.preventDefault();
    setDropOn(null);
    let ids: string[] = [];
    try { ids = JSON.parse(e.dataTransfer.getData(LIBRARY_DRAG_MIME) || '[]') as string[]; } catch { ids = []; }
    const movidas = ids.map(id => all.find(i => i.id === id)).filter((i): i is T => !!i && placeOf(i).group !== groupId);
    movidas.forEach(i => onMoveTo(i, groupId));
    limpiarSeleccion();
  };
  const destino = (groupId: string | null): { onDragOver: (e: React.DragEvent) => void; onDragLeave: () => void; onDrop: (e: React.DragEvent) => void } | Record<string, never> =>
    canManage ? {
      onDragOver: (e: React.DragEvent) => { if (esArrastreInterno(e)) { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDropOn(groupId ?? 'none'); } },
      onDragLeave: () => setDropOn(cur => (cur === (groupId ?? 'none') ? null : cur)),
      onDrop: (e: React.DragEvent) => { if (esArrastreInterno(e)) { e.stopPropagation(); soltarEnGrupo(groupId, e); } },
    } : {};

  const railItem = (s: Shelf, label: string, icon: string, count: number | null, extra?: JSX.Element, groupId?: string | null): JSX.Element => {
    const on = shelfKey(shelfNow) === shelfKey(s) && !query.trim();
    const drop = groupId !== undefined && dropOn === (groupId ?? 'none');
    return (
      <div key={shelfKey(s)} className={`mp-propcat-railcell ${drop ? 'drop' : ''}`} {...(groupId !== undefined ? destino(groupId) : {})}>
        <button type="button" role="tab" aria-selected={on} className={`mp-propcat-rail-item ${on ? 'on' : ''}`} onClick={() => { setQuery(''); setShelf(s); }}>
          <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
          <span className="mp-propcat-rail-n">{label}</span>
          {count !== null && <span className="mp-propcat-rail-c">{count}</span>}
        </button>
        {extra}
      </div>
    );
  };
  const opcionesDestino = (actual: (g: string | null) => boolean, elegir: (g: string | null) => void): JSX.Element => (<>
    {groupList.map(g => (
      <button key={g.id} type="button" role="menuitemradio" aria-checked={actual(g.id)} className={`mp-texcat-mi ${actual(g.id) ? 'on' : ''}`} onClick={() => elegir(g.id)}>{g.name}</button>
    ))}
    {propios && (
      <button type="button" role="menuitemradio" aria-checked={actual(null)} className={`mp-texcat-mi ${actual(null) ? 'on' : ''}`} onClick={() => elegir(null)}>{k('unsorted')}</button>
    )}
  </>);

  const header = (
    <div className="mp-propcat-head">
      {icon}
      <span className="mp-propcat-title">{k('title')}</span>
      <span className="mp-propcat-crumb">· {shelfTitle(shelfNow)}</span>
    </div>
  );

  return (
    <Modal onClose={onClose} header={header} width={1280} noPadding>
      <div className={`mp-propcat ${dragging ? 'dragging' : ''}`} data-testid="mp-propcat" style={{ ['--mp-thumb' as string]: `${thumb}px` }}
        onDragOver={e => { if (canManage && !esArrastreInterno(e)) { e.preventDefault(); setDragging(true); } }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
        {/* ── LA BARRA ── */}
        <div className="mp-propcat-bar">
          <input className="mp-texcat-search mp-propcat-search" type="search" value={query} onChange={e => setQuery(e.target.value)}
            placeholder={k('search')} aria-label={k('search')} />
          {canManage && (
            <button type="button" className="mp-propcat-upload" onClick={() => onUpload(uploadGroup)}>
              <span className="material-symbols-outlined" aria-hidden="true">upload</span>{k('upload')}
            </button>
          )}
          <span className="mp-propcat-sp" />
          <label className="mp-propcat-sel">
            <span className="mp-propcat-sel-l">{k('group')}</span>
            <select value={grouped ? 'pack' : 'none'} onChange={e => setGrouped(e.target.value === 'pack')} aria-label={k('group')}>
              <option value="pack">{k('groupPack')}</option>
              <option value="none">{k('groupNone')}</option>
            </select>
          </label>
          <label className="mp-propcat-sel">
            <span className="mp-propcat-sel-l">{k('sort')}</span>
            <select value={sort} onChange={e => setSort(e.target.value as ShelfSort)} aria-label={k('sort')}>
              <option value="name">{k('sortName')}</option>
              <option value="recent">{k('sortRecent')}</option>
            </select>
          </label>
          {/* El tamaño de miniatura: el deslizador común, en fila, entre los dos iconos de la lámina. */}
          <div className="mp-propcat-thumb">
            <span className="material-symbols-outlined" aria-hidden="true">photo_size_select_small</span>
            <Slider className="mp-propcat-thumb-s" layout="inline" hideLabel label={k('thumb')} min={THUMB_MIN} max={THUMB_MAX} step={2}
              value={thumb} onChange={setThumb} valueText="" />
            <span className="material-symbols-outlined" aria-hidden="true">photo_size_select_large</span>
          </div>
        </div>

        <div className="mp-propcat-body">
          {/* ── EL RAIL DE GRUPOS ── cada grupo es también DESTINO del arrastre (§ 6.8, punto 4). */}
          <nav className="mp-propcat-rail" role="tablist" aria-label={k('rail')}>
            {railItem({ kind: 'all' }, k('all'), 'apps', all.length)}
            {railItem({ kind: 'recent' }, k('recent'), 'history', null)}
            {railItem({ kind: 'favorites' }, k('favorites'), 'star', countIn(all, { kind: 'favorites' }, ctx, placeOf))}
            <span className="mp-propcat-rail-label">{k('myPacks')}</span>
            {groupList.map(group => railItem({ kind: 'pack', id: group.id }, group.name, groupIcon, countIn(all, { kind: 'pack', id: group.id }, ctx, placeOf),
              canManage && propios ? (
                <>
                  <button type="button" className="mp-texcat-kebab mp-propcat-kebab" aria-haspopup="menu" aria-expanded={menu?.kind === 'group' && menu.id === group.id}
                    aria-label={k('packMenu', { name: group.name })}
                    onClick={() => setMenu(m => (m?.kind === 'group' && m.id === group.id ? null : { kind: 'group', id: group.id, step: 'main' }))}>
                    <span className="material-symbols-outlined" aria-hidden="true">more_vert</span>
                  </button>
                  {menu?.kind === 'group' && menu.id === group.id && (
                    <div className="mp-texcat-menu mp-propcat-menu" role="menu" ref={menuRef} aria-label={k('packMenu', { name: group.name })}>
                      <button type="button" role="menuitem" className="mp-texcat-mi" onClick={() => void renombrarGrupo(group)}>
                        <span className="material-symbols-outlined" aria-hidden="true">edit</span>{k('renamePack')}
                      </button>
                      <span className="mp-texcat-misep" aria-hidden="true" />
                      <button type="button" role="menuitem" className="mp-texcat-mi danger" onClick={() => void borrarGrupo(group)}>
                        <span className="material-symbols-outlined" aria-hidden="true">delete</span>{k('deletePack')}
                      </button>
                    </div>
                  )}
                </>
              ) : undefined, group.id))}
            {propios && (loose > 0 || groupList.length === 0) && railItem({ kind: 'pack', id: null }, k('unsorted'), 'folder_open', loose, undefined, null)}
            {deSerie && (<>
              <span className="mp-propcat-rail-label">{k('builtIn')}</span>
              {builtIns.map(c => railItem({ kind: 'category', category: c }, builtInLabel?.(c) ?? c, 'auto_awesome', countIn(all, { kind: 'category', category: c }, ctx, placeOf)))}
            </>)}
            <span className="mp-propcat-rail-push" />
            {canManage && propios && (
              <button type="button" className="mp-propcat-newpack" onClick={() => void nuevoGrupo()}>
                <span className="material-symbols-outlined" aria-hidden="true">create_new_folder</span>{k('newPack')}
              </button>
            )}
          </nav>

          {/* ── LA REJILLA ── */}
          <div className="mp-propcat-grid" data-testid="mp-propcat-grid">
            {/* LA BARRA DE SELECCIÓN (§ 6.8, punto 4): cuántas, MOVER A…, BORRAR, y quitar la selección. */}
            {selected.length > 0 && (
              <div className="mp-propcat-selbar" role="toolbar" aria-label={k(selected.length === 1 ? 'selectedOne' : 'selected', { n: String(selected.length) })} data-testid="mp-propcat-selbar">
                <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
                <span className="mp-propcat-selbar-n">{k(selected.length === 1 ? 'selectedOne' : 'selected', { n: String(selected.length) })}</span>
                <span className="mp-propcat-selbar-cell">
                  <button type="button" className="mp-propcat-selbar-btn blood" aria-haspopup="menu" aria-expanded={menu?.kind === 'sel'}
                    onClick={() => setMenu(m => (m?.kind === 'sel' ? null : { kind: 'sel', id: 'sel', step: 'move' }))}>
                    <span className="material-symbols-outlined" aria-hidden="true">drive_file_move</span>{k('moveTo')}
                  </button>
                  {menu?.kind === 'sel' && (
                    <div className="mp-texcat-menu mp-propcat-selmenu" role="menu" ref={menuRef} aria-label={k('moveTo')}>
                      {opcionesDestino(g => marcadas.length > 0 && marcadas.every(i => placeOf(i).group === g), moverMarcadas)}
                    </div>
                  )}
                </span>
                <button type="button" className="mp-propcat-selbar-btn danger" onClick={() => void borrarMarcadas()}>
                  <span className="material-symbols-outlined" aria-hidden="true">delete</span>{t('common.delete')}
                </button>
                <span className="mp-propcat-sp" />
                <span className="mp-propcat-selbar-hint">{k('selectionHint')}</span>
                <button type="button" className="mp-propcat-selbar-btn" onClick={limpiarSeleccion}>{k('clearSelection')}</button>
              </div>
            )}
            {items === null && <p className="mp-texcat-note">{t('common.loading')}</p>}
            {items !== null && all.length === 0 && <p className="mp-texcat-note">{k('emptyAll')}</p>}
            {items !== null && all.length > 0 && shownCount === 0 && <p className="mp-texcat-note">{k('empty')}</p>}
            {sections.map(sec => {
              const groupId = sec.group?.id ?? (sec.key === 'pack:none' ? null : undefined);
              const title = sec.group ? sec.group.name : sec.builtIn ? (builtInLabel?.(sec.builtIn) ?? sec.builtIn) : sec.key === 'pack:none' ? k('unsorted') : null;
              return (
                <section key={sec.key} className="mp-propcat-sec" aria-label={title ?? k('all')}>
                  {title && grouped && (
                    <h3 className="mp-propcat-sec-h">
                      {k(sec.items.length === 1 ? 'sectionOne' : 'section', { name: title, n: String(sec.items.length) })}
                    </h3>
                  )}
                  <div className="mp-propcat-tiles">
                    {/* Subir va DENTRO de la rejilla, la primera baldosa de la sección, como en la lámina. Sólo con permiso. */}
                    {canManage && groupId !== undefined && (
                      <button type="button" className="mp-propcat-tile mp-propcat-add" onClick={() => onUpload(groupId)}>
                        <span className="mp-propcat-view"><span className="material-symbols-outlined" aria-hidden="true">add_photo_alternate</span></span>
                        <span className="mp-propcat-n">{k('uploadTile')}</span>
                      </button>
                    )}
                    {sec.items.map(p => {
                      const on = selected.includes(p.id);
                      return (
                        <div key={p.id} className={`mp-propcat-cell ${on ? 'on' : ''}`} draggable={canManage} onDragStart={e => empezarArrastre(p, e)}>
                          <button type="button" className="mp-propcat-tile" onClick={e => pinchar(p, e)} aria-label={k('pick', { name: p.name })} title={p.name}>
                            <span className="mp-propcat-view">{renderThumb(p)}</span>
                            <span className="mp-propcat-n">
                              {/* El punto ORO marca las tuyas (las subidas); las de serie van sin punto. */}
                              {p.uploadedBy !== null && <span className="mp-texcat-dot" aria-hidden="true" />}
                              {p.name}
                            </span>
                          </button>
                          {/* MARCAR (§ 6.8, punto 4): el círculo arriba a la izquierda, siempre a la vista con permiso. */}
                          {canManage && (
                            <button type="button" className={`mp-propcat-mark ${on ? 'on' : ''}`} aria-pressed={on}
                              aria-label={k(on ? 'unmark' : 'mark', { name: p.name })} onClick={() => marcar(p)}>
                              <span className="material-symbols-outlined" aria-hidden="true">{on ? 'check_circle' : 'radio_button_unchecked'}</span>
                            </button>
                          )}
                          {/*
                            * LA ESTRELLA HABLA EN EL IDIOMA DE SU CARA: `k(...)`, no una clave fija de las
                            * piezas. Estaba clavada en `maps.props.stamp.favorite`, así que al pasar los
                            * objetos a masculino («Favorito») las TEXTURAS empezaron a decir «Favorito · Roca
                            * gris» con el estante de al lado diciendo «Favoritas».
                            */}
                          <button type="button" className={`mp-propcat-star ${favorites.includes(p.id) ? 'on' : ''}`} aria-pressed={favorites.includes(p.id)}
                            aria-label={k(favorites.includes(p.id) ? 'unfavorite' : 'favorite') + ` · ${p.name}`} onClick={() => onToggleFavorite(p)}>
                            <span className="material-symbols-outlined" aria-hidden="true">{favorites.includes(p.id) ? 'star' : 'star_border'}</span>
                          </button>
                          {/* LOS TRES PUNTOS, SIEMPRE A LA VISTA (§ 6.8, punto 3: «*nadie va a saber que existen*»). Sólo con permiso. */}
                          {canManage && (
                            <button type="button" className="mp-texcat-kebab" aria-haspopup="menu" aria-expanded={menu?.kind === 'item' && menu.id === p.id}
                              aria-label={k('menu', { name: p.name })}
                              onClick={() => setMenu(m => (m?.kind === 'item' && m.id === p.id ? null : { kind: 'item', id: p.id, step: 'main' }))}>
                              <span className="material-symbols-outlined" aria-hidden="true">more_vert</span>
                            </button>
                          )}
                          {menu?.kind === 'item' && menu.id === p.id && (
                            <div className="mp-texcat-menu" role="menu" ref={menuRef} aria-label={k('menu', { name: p.name })}>
                              {menu.step === 'main' ? (<>
                                <button type="button" role="menuitem" className="mp-texcat-mi" onClick={() => void renombrar(p)}>
                                  <span className="material-symbols-outlined" aria-hidden="true">edit</span>{k('rename')}
                                </button>
                                <button type="button" role="menuitem" className="mp-texcat-mi" onClick={() => setMenu({ kind: 'item', id: p.id, step: 'move' })}>
                                  <span className="material-symbols-outlined" aria-hidden="true">drive_file_move</span>{k('moveTo')}
                                </button>
                                <span className="mp-texcat-misep" aria-hidden="true" />
                                <button type="button" role="menuitem" className="mp-texcat-mi danger" onClick={() => void borrar(p)}>
                                  <span className="material-symbols-outlined" aria-hidden="true">delete</span>{t('common.delete')}
                                </button>
                              </>) : opcionesDestino(g => placeOf(p).group === g, g => { setMenu(null); if (placeOf(p).group !== g) onMoveTo(p, g); })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
            <p className="mp-texcat-count mp-propcat-count">{k('count', { n: String(shownCount) })}</p>
            <p className="mp-texcat-note"><span className="mp-texcat-dot" aria-hidden="true" />{k('legend')}</p>
            <p className="mp-texcat-hint">{hint ?? k('note')}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
