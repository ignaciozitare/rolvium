import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { Modal, Slider, useDialog } from '@rolvium/ui';
import type { Prop, PropPack } from '../domain/entities/Scene';
import { countIn, hasAppProps, PROP_CATEGORIES, sectionsOf, type PropShelf, type PropSort } from '../domain/useCases/propRules';

interface Props {
  /** `null` mientras se cargan: no es lo mismo «vacía» que «todavía no han llegado». */
  props: Prop[] | null;
  packs: PropPack[] | null;
  /**
   * ¿PUEDE ORDENAR LA BIBLIOTECA? Es el permiso `manage_props` del motor de roles («*por permisos, como las
   * texturas*»). Sin él no salen ni «Subir piezas», ni los tres puntos, ni «Nuevo paquete». Quien deniega de
   * verdad es la base, con `has_tool('manage_props')` en las políticas.
   */
  canManage: boolean;
  favorites: readonly string[];
  recents: readonly string[];
  onToggleFavorite: (prop: Prop) => void;
  /** Elegir una la hace el sello y cierra el catálogo: eso lo hace quien recibe esto. */
  onPick: (prop: Prop) => void;
  /** Abrir la subida en lote, en el paquete que se esté mirando. Con ficheros si vienen arrastrados. */
  onUpload: (packId: string | null, files?: File[]) => void;
  onRename: (prop: Prop, name: string) => void;
  onMoveTo: (prop: Prop, packId: string | null) => void;
  /** Ya confirmado: quien recibe esto sólo tiene que borrarla. */
  onRemove: (prop: Prop) => void;
  onNewPack: (name: string) => void;
  onRenamePack: (pack: PropPack, name: string) => void;
  onRemovePack: (pack: PropPack) => void;
  /** Con qué estante se abre. De serie, el primer paquete; sin paquetes, todo. */
  initialShelf?: PropShelf;
  onClose: () => void;
}

const THUMB_MIN = 72;
const THUMB_MAX = 180;
const THUMB_DEFAULT = 118;

const shelfKey = (s: PropShelf): string =>
  s.kind === 'pack' ? `pack:${s.id ?? 'none'}` : s.kind === 'category' ? `cat:${s.category}` : s.kind;

/**
 * EL CATÁLOGO DE PIEZAS a pantalla completa (`rolvium.pen` · `w7sTC0`, aprobado el 2026-09-11).
 *
 * Cabecera (icono · «Piezas» · el estante abierto · X), la barra (buscador · SUBIR PIEZAS · AGRUPAR · ORDENAR
 * · tamaño de miniatura), el rail de paquetes a la izquierda (Recientes · Favoritos · MIS PAQUETES · DE SERIE ·
 * ROLVIUM · NUEVO PAQUETE) y la rejilla por secciones con la leyenda y la nota al pie. Todo literal de la lámina.
 *
 * 🔑 LA BIBLIOTECA ES DE LA HERRAMIENTA (él, 2026-09-11: «*lo que se sube sirve para todos*») y va en PAQUETES
 * propios (2026-09-09), no en las seis categorías de agosto: ésas sólo valen para las piezas de serie, que hoy
 * no existen, así que su bloque del rail no se pinta hasta que haya alguna.
 *
 * Se dibuja con los tokens de la APP (`--tx`, `--sf2`…) y no con los de la mesa, porque vive dentro del `Modal`
 * compartido, igual que el catálogo de texturas. Lo elegido va en sangre, como en toda la mesa.
 */
export function PropsCatalog({
  props, packs, canManage, favorites, recents, onToggleFavorite, onPick, onUpload, onRename, onMoveTo, onRemove,
  onNewPack, onRenamePack, onRemovePack, initialShelf, onClose,
}: Props): JSX.Element {
  const { t } = useTranslation();
  const dialog = useDialog();
  const [query, setQuery] = useState('');
  const [shelf, setShelf] = useState<PropShelf>(() => initialShelf ?? (packs?.[0] ? { kind: 'pack', id: packs[0].id } : { kind: 'all' }));
  const [grouped, setGrouped] = useState(true);
  const [sort, setSort] = useState<PropSort>('name');
  const [thumb, setThumb] = useState(THUMB_DEFAULT);
  /** Qué pieza o paquete tiene el menú abierto, y si dentro se está eligiendo paquete de destino. */
  const [menu, setMenu] = useState<{ kind: 'prop' | 'pack'; id: string; step: 'main' | 'move' } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const ctx = useMemo(() => ({ favorites, recents }), [favorites, recents]);
  const all = props ?? [];
  const packList = packs ?? [];
  // Buscando se mira TODO («Buscar en todos los paquetes…»): el estante sólo manda con el buscador vacío.
  const shelfNow: PropShelf = query.trim() ? { kind: 'all' } : shelf;
  const sections = useMemo(() => sectionsOf(all, packList, shelfNow, query, sort, ctx, grouped), [all, packList, shelfNow, query, sort, ctx, grouped]);
  const shownCount = sections.reduce((n, s) => n + s.props.length, 0);
  const loose = countIn(all, { kind: 'pack', id: null }, ctx);
  const deSerie = hasAppProps(all);
  /** Adónde va lo que se suba desde aquí: el paquete abierto, o «Sin clasificar». */
  const uploadPack = shelf.kind === 'pack' ? shelf.id : null;
  const packOf = (id: string | null): PropPack | null => packList.find(k => k.id === id) ?? null;
  const shelfTitle = (s: PropShelf): string => {
    switch (s.kind) {
      case 'all': return t('maps.props.catalog.all');
      case 'recent': return t('maps.props.catalog.recent');
      case 'favorites': return t('maps.props.catalog.favorites');
      case 'pack': return s.id === null ? t('maps.props.catalog.unsorted') : packOf(s.id)?.name ?? t('maps.props.catalog.unsorted');
      case 'category': return t(`maps.props.catalog.cat.${s.category}`);
    }
  };

  useEffect(() => {
    if (!menu) return;
    const fuera = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc); };
  }, [menu]);

  const renombrar = async (prop: Prop): Promise<void> => {
    setMenu(null);
    const nombre = await dialog.prompt(t('maps.props.catalog.renamePrompt'), { defaultValue: prop.name });
    const limpio = nombre?.trim();
    if (limpio && limpio !== prop.name) onRename(prop, limpio.slice(0, 80));
  };
  const borrar = async (prop: Prop): Promise<void> => {
    setMenu(null);
    const ok = await dialog.confirm(t('maps.props.catalog.removeConfirm', { name: prop.name }), {
      danger: true, confirmLabel: t('common.delete'), cancelLabel: t('common.cancel'),
    });
    if (ok) onRemove(prop);
  };
  const nuevoPaquete = async (): Promise<void> => {
    const nombre = await dialog.prompt(t('maps.props.catalog.newPackPrompt'));
    const limpio = nombre?.trim();
    if (limpio) onNewPack(limpio.slice(0, 80));
  };
  const renombrarPaquete = async (pack: PropPack): Promise<void> => {
    setMenu(null);
    const nombre = await dialog.prompt(t('maps.props.catalog.renamePackPrompt'), { defaultValue: pack.name });
    const limpio = nombre?.trim();
    if (limpio && limpio !== pack.name) onRenamePack(pack, limpio.slice(0, 80));
  };
  const borrarPaquete = async (pack: PropPack): Promise<void> => {
    setMenu(null);
    const ok = await dialog.confirm(t('maps.props.catalog.deletePackConfirm', { name: pack.name }), {
      danger: true, confirmLabel: t('common.delete'), cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    if (shelf.kind === 'pack' && shelf.id === pack.id) setShelf({ kind: 'pack', id: null });
    onRemovePack(pack);
  };

  /** Arrastrar imágenes sobre el catálogo → la subida en lote, ya con los ficheros y en el paquete abierto. */
  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    setDragging(false);
    if (!canManage) return;
    const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
    if (files.length) onUpload(uploadPack, files);
  };

  const railItem = (s: PropShelf, label: string, icon: string, count: number | null, extra?: JSX.Element): JSX.Element => {
    const on = shelfKey(shelfNow) === shelfKey(s) && !query.trim();
    return (
      <div key={shelfKey(s)} className="mp-propcat-railcell">
        <button type="button" role="tab" aria-selected={on} className={`mp-propcat-rail-item ${on ? 'on' : ''}`} onClick={() => { setQuery(''); setShelf(s); }}>
          <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
          <span className="mp-propcat-rail-n">{label}</span>
          {count !== null && <span className="mp-propcat-rail-c">{count}</span>}
        </button>
        {extra}
      </div>
    );
  };

  const header = (
    <div className="mp-propcat-head">
      <span className="mp-tool-img mp-propcat-head-icon" aria-hidden="true" style={{ maskImage: 'url(/icons/props-mask.svg)', WebkitMaskImage: 'url(/icons/props-mask.svg)' }} />
      <span className="mp-propcat-title">{t('maps.props.catalog.title')}</span>
      <span className="mp-propcat-crumb">· {shelfTitle(shelfNow)}</span>
    </div>
  );

  return (
    <Modal onClose={onClose} header={header} width={1280} noPadding>
      <div className={`mp-propcat ${dragging ? 'dragging' : ''}`} data-testid="mp-propcat" style={{ ['--mp-thumb' as string]: `${thumb}px` }}
        onDragOver={e => { if (canManage) { e.preventDefault(); setDragging(true); } }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
        {/* ── LA BARRA ── */}
        <div className="mp-propcat-bar">
          <input className="mp-texcat-search mp-propcat-search" type="search" value={query} onChange={e => setQuery(e.target.value)}
            placeholder={t('maps.props.catalog.search')} aria-label={t('maps.props.catalog.search')} />
          {canManage && (
            <button type="button" className="mp-propcat-upload" onClick={() => onUpload(uploadPack)}>
              <span className="material-symbols-outlined" aria-hidden="true">upload</span>{t('maps.props.catalog.upload')}
            </button>
          )}
          <span className="mp-propcat-sp" />
          <label className="mp-propcat-sel">
            <span className="mp-propcat-sel-l">{t('maps.props.catalog.group')}</span>
            <select value={grouped ? 'pack' : 'none'} onChange={e => setGrouped(e.target.value === 'pack')} aria-label={t('maps.props.catalog.group')}>
              <option value="pack">{t('maps.props.catalog.groupPack')}</option>
              <option value="none">{t('maps.props.catalog.groupNone')}</option>
            </select>
          </label>
          <label className="mp-propcat-sel">
            <span className="mp-propcat-sel-l">{t('maps.props.catalog.sort')}</span>
            <select value={sort} onChange={e => setSort(e.target.value as PropSort)} aria-label={t('maps.props.catalog.sort')}>
              <option value="name">{t('maps.props.catalog.sortName')}</option>
              <option value="recent">{t('maps.props.catalog.sortRecent')}</option>
            </select>
          </label>
          {/* El tamaño de miniatura: el deslizador común, en fila, entre los dos iconos de la lámina. */}
          <div className="mp-propcat-thumb">
            <span className="material-symbols-outlined" aria-hidden="true">photo_size_select_small</span>
            <Slider className="mp-propcat-thumb-s" layout="inline" hideLabel label={t('maps.props.catalog.thumb')} min={THUMB_MIN} max={THUMB_MAX} step={2}
              value={thumb} onChange={setThumb} valueText="" />
            <span className="material-symbols-outlined" aria-hidden="true">photo_size_select_large</span>
          </div>
        </div>

        <div className="mp-propcat-body">
          {/* ── EL RAIL DE PAQUETES ── */}
          <nav className="mp-propcat-rail" role="tablist" aria-label={t('maps.props.catalog.rail')}>
            {railItem({ kind: 'all' }, t('maps.props.catalog.all'), 'apps', all.length)}
            {railItem({ kind: 'recent' }, t('maps.props.catalog.recent'), 'history', null)}
            {railItem({ kind: 'favorites' }, t('maps.props.catalog.favorites'), 'star', countIn(all, { kind: 'favorites' }, ctx))}
            <span className="mp-propcat-rail-label">{t('maps.props.catalog.myPacks')}</span>
            {packList.map(pack => railItem({ kind: 'pack', id: pack.id }, pack.name, 'folder', countIn(all, { kind: 'pack', id: pack.id }, ctx),
              canManage ? (
                <>
                  <button type="button" className="mp-texcat-kebab mp-propcat-kebab" aria-haspopup="menu" aria-expanded={menu?.kind === 'pack' && menu.id === pack.id}
                    aria-label={t('maps.props.catalog.packMenu', { name: pack.name })}
                    onClick={() => setMenu(m => (m?.kind === 'pack' && m.id === pack.id ? null : { kind: 'pack', id: pack.id, step: 'main' }))}>
                    <span className="material-symbols-outlined" aria-hidden="true">more_vert</span>
                  </button>
                  {menu?.kind === 'pack' && menu.id === pack.id && (
                    <div className="mp-texcat-menu mp-propcat-menu" role="menu" ref={menuRef} aria-label={t('maps.props.catalog.packMenu', { name: pack.name })}>
                      <button type="button" role="menuitem" className="mp-texcat-mi" onClick={() => void renombrarPaquete(pack)}>
                        <span className="material-symbols-outlined" aria-hidden="true">edit</span>{t('maps.props.catalog.renamePack')}
                      </button>
                      <span className="mp-texcat-misep" aria-hidden="true" />
                      <button type="button" role="menuitem" className="mp-texcat-mi danger" onClick={() => void borrarPaquete(pack)}>
                        <span className="material-symbols-outlined" aria-hidden="true">delete</span>{t('maps.props.catalog.deletePack')}
                      </button>
                    </div>
                  )}
                </>
              ) : undefined))}
            {(loose > 0 || packList.length === 0) && railItem({ kind: 'pack', id: null }, t('maps.props.catalog.unsorted'), 'folder_open', loose)}
            {deSerie && (<>
              <span className="mp-propcat-rail-label">{t('maps.props.catalog.builtIn')}</span>
              {PROP_CATEGORIES.map(c => railItem({ kind: 'category', category: c }, t(`maps.props.catalog.cat.${c}`), 'auto_awesome', countIn(all, { kind: 'category', category: c }, ctx)))}
            </>)}
            <span className="mp-propcat-rail-push" />
            {canManage && (
              <button type="button" className="mp-propcat-newpack" onClick={() => void nuevoPaquete()}>
                <span className="material-symbols-outlined" aria-hidden="true">create_new_folder</span>{t('maps.props.catalog.newPack')}
              </button>
            )}
          </nav>

          {/* ── LA REJILLA ── */}
          <div className="mp-propcat-grid" data-testid="mp-propcat-grid">
            {props === null && <p className="mp-texcat-note">{t('common.loading')}</p>}
            {props !== null && all.length === 0 && <p className="mp-texcat-note">{t('maps.props.catalog.emptyAll')}</p>}
            {props !== null && all.length > 0 && shownCount === 0 && <p className="mp-texcat-note">{t('maps.props.catalog.empty')}</p>}
            {sections.map(sec => {
              const packId = sec.pack?.id ?? (sec.key === 'pack:none' ? null : undefined);
              const title = sec.pack ? sec.pack.name : sec.category ? t(`maps.props.catalog.cat.${sec.category}`) : sec.key === 'pack:none' ? t('maps.props.catalog.unsorted') : null;
              return (
                <section key={sec.key} className="mp-propcat-sec" aria-label={title ?? t('maps.props.catalog.all')}>
                  {title && grouped && (
                    <h3 className="mp-propcat-sec-h">
                      {t(sec.props.length === 1 ? 'maps.props.catalog.sectionOne' : 'maps.props.catalog.section', { name: title, n: String(sec.props.length) })}
                    </h3>
                  )}
                  <div className="mp-propcat-tiles">
                    {/* Subir va DENTRO de la rejilla, la primera baldosa de la sección, como en la lámina. Sólo con permiso. */}
                    {canManage && packId !== undefined && (
                      <button type="button" className="mp-propcat-tile mp-propcat-add" onClick={() => onUpload(packId)}>
                        <span className="mp-propcat-view"><span className="material-symbols-outlined" aria-hidden="true">add_photo_alternate</span></span>
                        <span className="mp-propcat-n">{t('maps.props.catalog.uploadTile')}</span>
                      </button>
                    )}
                    {sec.props.map(p => (
                      <div key={p.id} className="mp-propcat-cell">
                        <button type="button" className="mp-propcat-tile" onClick={() => onPick(p)} aria-label={t('maps.props.catalog.pick', { name: p.name })} title={p.name}>
                          <span className="mp-propcat-view"><img src={p.imageUrl} alt="" loading="lazy" /></span>
                          <span className="mp-propcat-n">
                            {/* El punto ORO marca las tuyas (las subidas); las de serie van sin punto. */}
                            {p.uploadedBy !== null && <span className="mp-texcat-dot" aria-hidden="true" />}
                            {p.name}
                          </span>
                        </button>
                        <button type="button" className={`mp-propcat-star ${favorites.includes(p.id) ? 'on' : ''}`} aria-pressed={favorites.includes(p.id)}
                          aria-label={t(favorites.includes(p.id) ? 'maps.props.stamp.unfavorite' : 'maps.props.stamp.favorite') + ` · ${p.name}`} onClick={() => onToggleFavorite(p)}>
                          <span className="material-symbols-outlined" aria-hidden="true">{favorites.includes(p.id) ? 'star' : 'star_border'}</span>
                        </button>
                        {canManage && (
                          <button type="button" className="mp-texcat-kebab" aria-haspopup="menu" aria-expanded={menu?.kind === 'prop' && menu.id === p.id}
                            aria-label={t('maps.props.catalog.menu', { name: p.name })}
                            onClick={() => setMenu(m => (m?.kind === 'prop' && m.id === p.id ? null : { kind: 'prop', id: p.id, step: 'main' }))}>
                            <span className="material-symbols-outlined" aria-hidden="true">more_vert</span>
                          </button>
                        )}
                        {menu?.kind === 'prop' && menu.id === p.id && (
                          <div className="mp-texcat-menu" role="menu" ref={menuRef} aria-label={t('maps.props.catalog.menu', { name: p.name })}>
                            {menu.step === 'main' ? (<>
                              <button type="button" role="menuitem" className="mp-texcat-mi" onClick={() => void renombrar(p)}>
                                <span className="material-symbols-outlined" aria-hidden="true">edit</span>{t('maps.props.catalog.rename')}
                              </button>
                              <button type="button" role="menuitem" className="mp-texcat-mi" onClick={() => setMenu({ kind: 'prop', id: p.id, step: 'move' })}>
                                <span className="material-symbols-outlined" aria-hidden="true">drive_file_move</span>{t('maps.props.catalog.moveTo')}
                              </button>
                              <span className="mp-texcat-misep" aria-hidden="true" />
                              <button type="button" role="menuitem" className="mp-texcat-mi danger" onClick={() => void borrar(p)}>
                                <span className="material-symbols-outlined" aria-hidden="true">delete</span>{t('common.delete')}
                              </button>
                            </>) : (<>
                              {packList.map(k => (
                                <button key={k.id} type="button" role="menuitemradio" aria-checked={p.packId === k.id} className={`mp-texcat-mi ${p.packId === k.id ? 'on' : ''}`}
                                  onClick={() => { setMenu(null); if (p.packId !== k.id) onMoveTo(p, k.id); }}>{k.name}</button>
                              ))}
                              <button type="button" role="menuitemradio" aria-checked={p.packId === null} className={`mp-texcat-mi ${p.packId === null ? 'on' : ''}`}
                                onClick={() => { setMenu(null); if (p.packId !== null) onMoveTo(p, null); }}>{t('maps.props.catalog.unsorted')}</button>
                            </>)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
            <p className="mp-texcat-count mp-propcat-count">{t('maps.props.catalog.count', { n: String(shownCount) })}</p>
            <p className="mp-texcat-note"><span className="mp-texcat-dot" aria-hidden="true" />{t('maps.props.catalog.legend')}</p>
            <p className="mp-texcat-hint">{t('maps.props.catalog.note')}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
