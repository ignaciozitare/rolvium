import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { Modal, useDialog } from '@rolvium/ui';
import { TEXTURE_CATEGORIES, type Texture, type TextureCategory } from '../domain/entities/Scene';

/**
 * EL CATÁLOGO DE TEXTURAS (`rolvium.pen`, frame `sO0GV` «PL/Catálogo de texturas»).
 *
 * Encargo suyo del 2026-09-04, literal: «*el botón de cambiar debería abrir un catálogo donde estén
 * CLASIFICADAS como en el catálogo de objetos que ya tenemos diseñado*».
 *
 * 🔑 UNA TEXTURA NO ES UN FONDO, y esa es la razón de que esto exista (él, mirando el modal viejo: «*los
 * fondos de las escenas que subí antes y las texturas no son lo mismo; los fondos sí son por campaña —yo
 * subo un mapa que dibujé y lo pongo aquí— pero las texturas son de un catálogo de texturas, no lo
 * mezcles*»). Un fondo es de LA CAMPAÑA (`ImageAsset`); una textura es de LA HERRAMIENTA: se sube una vez y
 * sirve en todos los mapas de todas las campañas. Antes esto abría la biblioteca de fondos de la campaña, sin
 * buscador ni categorías, y por eso «seguía sin ver el catálogo».
 *
 * Se dibuja con los tokens de la APP (`--tx`, `--sf2`, `--ac`…) y no con los de la mesa (`--sys-*`), porque
 * vive dentro del `Modal` compartido, que se pinta sobre `--sf`. El modal viejo mezclaba los dos y por eso su
 * texto y su botón «+ Subir» salían en tinta negra sobre fondo oscuro: invisibles.
 */

/** Cuántas casillas de ancho enseña la miniatura. Es la regla que hace que `tileCells` se VEA. */
const PREVIEW_CELLS = 4;

interface Props {
  /** Para cuál de las dos texturas base se está eligiendo. Sólo cambia el título. */
  /**
   * Para qué se está eligiendo: la pared de la sala, su suelo, una PUERTA (desde el 2026-09-07) o —desde la
   * rebanada 10— EL PINCEL. Sólo cambia el título y la pista del modal: el catálogo es el mismo, que es todo
   * el sentido de que sea de la herramienta y no de una campaña.
   */
  which: 'wall' | 'floor' | 'door' | 'brush' | 'shape';
  /** `null` mientras se cargan: no es lo mismo «no hay ninguna» que «todavía no han llegado». */
  textures: Texture[] | null;
  /**
   * ¿PUEDE ORDENAR EL CATÁLOGO? Es el permiso `manage_textures` del motor de roles, no «es tuya» (orden suya
   * del 2026-09-04: «*esto tiene que ser un permiso en el motor de permisos, no lo puede hacer cualquiera*»).
   * Sin él no salen ni los tres puntos ni el botón de subir, ni siquiera sobre lo que subió uno mismo.
   *
   * Esconder los botones no protege nada: quien deniega de verdad es la base, con `has_tool('manage_textures')`
   * en las políticas de INSERT, UPDATE y DELETE de `maps_textures`.
   */
  canManage: boolean;
  /** Elegir una copia además su tamaño de azulejo a la escena — eso lo hace quien recibe esto. */
  onPick: (texture: Texture) => void;
  /** Subir una nueva. Llega la categoría que tenga elegida: subir a ciegas es cómo se pierde una textura. */
  onUpload: (category: TextureCategory) => void;
  /** Renombrar y reclasificar, las otras dos opciones del menú de los tres puntos. */
  onUpdate: (texture: Texture, patch: { name?: string; category?: TextureCategory }) => void;
  /** Ya confirmado por el usuario: quien recibe esto sólo tiene que borrarla. */
  onRemove: (texture: Texture) => void;
  onClose: () => void;
}

/** «Todas» no es una categoría de la base: es el filtro apagado. */
type Filter = TextureCategory | 'all';
const FILTERS: Filter[] = ['all', ...TEXTURE_CATEGORIES];

export function TextureCatalog({ which, textures, canManage, onPick, onUpload, onUpdate, onRemove, onClose }: Props): JSX.Element {
  const { t } = useTranslation();
  const dialog = useDialog();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  /** Qué textura tiene el menú abierto, y si dentro se está eligiendo categoría. */
  const [menu, setMenu] = useState<{ id: string; step: 'main' | 'cat' } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (textures ?? []).filter(x =>
      (filter === 'all' || x.category === filter) && (!q || x.name.toLowerCase().includes(q)));
  }, [textures, filter, query]);

  /**
   * Subir con «todas» puesto tiene que ir a algún sitio, y `misc` es ese sitio: es lo que significa «varios».
   * Con una categoría elegida se sube ahí, que es lo que él pidió.
   */
  const destino: TextureCategory = filter === 'all' ? 'misc' : filter;

  /**
   * Borrar pregunta antes (él, 2026-09-04: «*tengo que poder borrar las texturas si quiero, con un modal de
   * confirmación*»). Los rótulos van traducidos desde aquí porque los del diálogo compartido están en inglés
   * por omisión — y una textura borrada no se recupera.
   */
  useEffect(() => {
    if (!menu) return;
    const fuera = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc); };
  }, [menu]);

  const renombrar = async (texture: Texture): Promise<void> => {
    setMenu(null);
    const nombre = await dialog.prompt(t('maps.room.catalog.renamePrompt'), { defaultValue: texture.name });
    const limpio = nombre?.trim();
    // Sin nombre no se guarda: una textura sin nombre no se vuelve a encontrar en el buscador.
    if (limpio && limpio !== texture.name) onUpdate(texture, { name: limpio });
  };

  const clasificar = (texture: Texture, category: TextureCategory): void => {
    setMenu(null);
    if (category !== texture.category) onUpdate(texture, { category });
  };

  const borrar = async (texture: Texture): Promise<void> => {
    setMenu(null);
    const ok = await dialog.confirm(t('maps.room.catalog.removeConfirm', { name: texture.name }), {
      danger: true, confirmLabel: t('common.delete'), cancelLabel: t('common.cancel'),
    });
    if (ok) onRemove(texture);
  };

  return (
    <Modal onClose={onClose} title={t(`maps.room.catalog.${which}`)} width={620}>
      <div className="mp-texcat-wrap">
        <input className="mp-texcat-search" type="search" value={query} onChange={e => setQuery(e.target.value)}
          placeholder={t('maps.room.catalog.search')} aria-label={t('maps.room.catalog.search')} />

        <div className="mp-texcat-cats" role="radiogroup" aria-label={t('maps.room.catalog.categories')}>
          {FILTERS.map(c => (
            <button key={c} type="button" role="radio" aria-checked={filter === c}
              className={`mp-texcat-cat ${filter === c ? 'on' : ''}`} onClick={() => setFilter(c)}>
              {t(`maps.room.catalog.cat.${c}`)}
            </button>
          ))}
        </div>

        <p className="mp-texcat-count">{t('maps.room.catalog.count', { n: String(shown.length) })}</p>

        <div className="mp-texcat" data-testid="mp-texcat">
          {/*
            * Subir va DENTRO de la rejilla, como en el diseño: es una pieza más, la primera. Y sólo con el
            * permiso: desde el 2026-09-04 añadir al catálogo también es cosa de admin y directores.
            */}
          {canManage && (
          <button type="button" className="mp-texcat-item mp-texcat-add" onClick={() => onUpload(destino)}>
            <span className="mp-texcat-mini mp-texcat-mini-add">
              <span className="material-symbols-outlined" aria-hidden="true">add_photo_alternate</span>
            </span>
            <span className="mp-texcat-n">{t('maps.room.catalog.uploadTo', { cat: t(`maps.room.catalog.cat.${destino}`) })}</span>
          </button>
          )}

          {shown.map(tex => (
            <div key={tex.id} className="mp-texcat-cell">
              <button type="button" className="mp-texcat-item" onClick={() => onPick(tex)} title={tex.name}>
                {/*
                  * La miniatura se REPITE al tamaño que la textura recuerda, no estirada: es la única forma de
                  * ver si un mosaico va a quedar diminuto o gigante antes de ponerlo (su queja del 2026-09-04,
                  * «*tengo una textura de mosaicos que quedan muy grandes*»).
                  */}
                <span className="mp-texcat-mini" style={{
                  backgroundImage: `url(${tex.url})`,
                  backgroundSize: `${(tex.tileCells / PREVIEW_CELLS) * 100}% auto`,
                }} />
                <span className="mp-texcat-n">
                  {/*
                    * El punto marca las que trae Rolvium (sin dueño). Es sólo INFORMACIÓN de dónde salió cada
                    * una: desde que borrar pasó a ser un permiso, quien lo tiene borra cualquiera, con punto
                    * o sin él. Ya no dice quién puede tocarla.
                    */}
                  {!tex.uploadedBy && <span className="mp-texcat-dot" aria-hidden="true" />}
                  {tex.name}
                </span>
              </button>
              {/*
                * LOS TRES PUNTOS (petición suya del 2026-09-04). Antes había un botón suelto de borrar; ahora
                * las tres cosas que se pueden hacer con una textura viven detrás del mismo gesto, y las tres
                * detrás del mismo permiso.
                */}
              {canManage && (
                <button type="button" className="mp-texcat-kebab" aria-haspopup="menu"
                  aria-expanded={menu?.id === tex.id}
                  aria-label={t('maps.room.catalog.menu', { name: tex.name })}
                  onClick={() => setMenu(m => (m?.id === tex.id ? null : { id: tex.id, step: 'main' }))}>
                  <span className="material-symbols-outlined" aria-hidden="true">more_vert</span>
                </button>
              )}
              {menu?.id === tex.id && (
                <div className="mp-texcat-menu" role="menu" ref={menuRef}
                  aria-label={t('maps.room.catalog.menu', { name: tex.name })}>
                  {menu.step === 'main' ? (<>
                    <button type="button" role="menuitem" className="mp-texcat-mi" onClick={() => void renombrar(tex)}>
                      <span className="material-symbols-outlined" aria-hidden="true">edit</span>
                      {t('maps.room.catalog.rename')}
                    </button>
                    {/* Clasificar abre las categorías AQUÍ MISMO, sin otro diálogo: «que te deje elegir ahí mismo». */}
                    <button type="button" role="menuitem" className="mp-texcat-mi"
                      onClick={() => setMenu({ id: tex.id, step: 'cat' })}>
                      <span className="material-symbols-outlined" aria-hidden="true">label</span>
                      {t('maps.room.catalog.categorize')}
                    </button>
                    <span className="mp-texcat-misep" aria-hidden="true" />
                    <button type="button" role="menuitem" className="mp-texcat-mi danger" onClick={() => void borrar(tex)}>
                      <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                      {t('common.delete')}
                    </button>
                  </>) : TEXTURE_CATEGORIES.map(c => (
                    <button key={c} type="button" role="menuitemradio" aria-checked={tex.category === c}
                      className={`mp-texcat-mi ${tex.category === c ? 'on' : ''}`} onClick={() => clasificar(tex, c)}>
                      {t(`maps.room.catalog.cat.${c}`)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {textures === null && <p className="mp-texcat-note">{t('common.loading')}</p>}
        {textures !== null && !shown.length && <p className="mp-texcat-note">{t('maps.room.catalog.empty')}</p>}

        <p className="mp-texcat-note">
          <span className="mp-texcat-dot" aria-hidden="true" />{t('maps.room.catalog.legend')}
        </p>
        {/*
          * La pista dice QUÉ pasa al elegir una, y eso cambia con `which`: para una PUERTA no se pone «como
          * textura base de esta escena, con su tamaño de baldosa» —va a la puerta, y el azulejo es de una
          * casilla siempre—. Dejar la de siempre sería el mismo fallo que él ya cazó con el botón que decía
          * «subir» sin subir nada (2026-09-07).
          */}
        <p className="mp-texcat-hint">{t(which === 'door' ? 'maps.room.catalog.doorHint' : which === 'brush' ? 'maps.room.catalog.brushHint' : which === 'shape' ? 'maps.room.catalog.shapeHint' : 'maps.room.catalog.hint')}</p>
      </div>
    </Modal>
  );
}
