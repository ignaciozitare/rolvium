import { useTranslation } from '@rolvium/i18n';
import { Tooltip } from '@rolvium/ui';
import { DOOR_HINGES, DOOR_LEAVES, DOOR_SWINGS, ROOM_PRESETS, type DoorSettings, type RoomOpening, type RoomPreset, type Wall, type WallKind } from '../domain/entities/Scene';
import { DEFAULT_TEXTURE_SCALE, DEFAULT_WALL_THICKNESS, styleOf } from '../domain/useCases/roomStyles';
import { DOOR_COLORS, normalCellsAt, TOKEN_SCALE, WALL_KINDS, canOpen } from '../domain/useCases/mapRules';
import { BRUSH_MAX_CELLS, BRUSH_MIN_CELLS, BUILDER_MODES, DEFAULT_BRUSH_COLOR, BUILD_KINDS, ROOM_SHAPES, isOpeningKind, shapesFor, type BuildKind, type BuilderMode, type RoomShape } from '../domain/useCases/roomRules';
import { PaintColor } from './PaintColor';
import type { MapColor } from '../domain/entities/Scene';
import { useDragPanel } from './useDragPanel';

interface Props {
  /** En qué está trabajando: marcando sobre una foto o levantando salas aquí. Las dos conviven. */
  mode: BuilderMode;
  onMode: (mode: BuilderMode) => void;
  /** El muro que está cogido, o `null` mientras sólo se elige qué se va a dibujar. */
  wall: Wall | null;
  kind: WallKind;
  onKind: (kind: WallKind) => void;
  /**
   * QUÉ LEVANTA EL GESTO, y sólo en «Dibujar aquí»: excavar una sala, rellenar un muro, o abrir un vano.
   * En «sobre una foto» esta fila no existe — allí manda `kind`, que no se ha tocado.
   */
  buildKind?: BuildKind;
  onBuildKind?: (kind: BuildKind) => void;
  shape: RoomShape;
  onShape: (shape: RoomShape) => void;
  /** El candado. Cerrado (lo de siempre) se pega a la rejilla; abierto va libre. */
  snapGrid: boolean;
  onSnapGrid: (snap: boolean) => void;
  /** Los nodos en cadena: mover una punta se lleva las de al lado, así la figura no se abre. */
  chainNodes: boolean;
  onChainNodes: (chain: boolean) => void;
  /**
   * ── LO DE LA REBANADA 8, y SÓLO en «Dibujar aquí» ──
   * Marcando sobre una foto no hay nada que elegir: el suelo lo pone la foto. Por eso estas secciones
   * aparecen y desaparecen con el interruptor de modo, que es exactamente el sitio que el spec les guardaba.
   */
  preset?: RoomPreset;
  onPreset?: (preset: RoomPreset) => void;
  wallTextureUrl?: string | null;
  floorTextureUrl?: string | null;
  /** Subir una foto suya para una de las dos texturas base, o quitarla y volver al preajuste. */
  onTexture?: (which: 'wall' | 'floor') => void;
  onClearTexture?: (which: 'wall' | 'floor') => void;
  /** El grosor del muro, EN CASILLAS: así no cambia al acercar ni con otra rejilla. */
  thickness?: number;
  onThickness?: (cells: number) => void;
  /**
   * CUÁNTO MIDE UN AZULEJO de cada textura, en casillas (petición suya del 2026-09-04: «*tengo una textura de
   * mosaicos que quedan muy grandes*»). `onTextureScale` va EN VIVO mientras arrastra —el mapa y la muestra se
   * repintan a la vez, que es el «previo» que pidió— y `onTextureScaleEnd` es el que guarda, al soltar. Mismo
   * reparto que el pincel de transparencia: pintar es continuo, guardar es una vez.
   */
  wallScale?: number;
  floorScale?: number;
  onTextureScale?: (which: 'wall' | 'floor', cells: number) => void;
  onTextureScaleEnd?: () => void;
  /**
   * LA BARRITA DEL TAMAÑO DE LAS FICHAS DE LA ESCENA (specs § «La barrita del tamaño de las fichas»).
   * Mismo trato que las escalas de textura: `onTokenScale` va pintando el previo mientras arrastra —todas
   * las fichas encogen a la vez, que es lo que se quiere ver— y `onTokenScaleEnd` guarda al soltar, para no
   * escribir en la base una vez por píxel.
   */
  tokenScale?: number;
  onTokenScale?: (v: number) => void;
  onTokenScaleEnd?: () => void;
  /** Cuántos muros hay cogidos y si están atados entre sí (§ «EL GRUPO»). */
  groupCount?: number;
  grouped?: boolean;
  onGroup?: () => void;
  onUngroup?: () => void;
  onVisible?: (visible: boolean) => void;
  onToggleOpen?: () => void;
  onRemove?: () => void;
  /**
   * ── LAS PUERTAS, DE VERDAD ──
   * El VANO DE SALA cogido. Va aparte de `wall` porque vive en otra tabla (`maps_room_openings`), y su
   * ausencia era el fallo entero: una puerta dibujada en una sala no se podía ni abrir ni borrar. Se edita
   * con los mismos controles — sin el interruptor de esconder, que una sala ES el dibujo del mapa y se ve
   * siempre (§ «La puerta sigue la visibilidad de su muro»).
   */
  roomOpening?: RoomOpening | null;
  /**
   * Cambiar cómo es la puerta cogida: hojas, bisagra, lado y color. UNA sola función para las dos tablas —
   * quien la pasa sabe a cuál escribir. Configurarla nunca es obligatorio: esto sólo se toca si él quiere.
   */
  onDoor?: (patch: Partial<DoorSettings>) => void;
  /**
   * CÓMO SERÁ LA PRÓXIMA PUERTA, mientras no haya ninguna cogida (`rolvium.pen` · «PUERTA ELEGIDA»).
   * Corrección suya de concepto, 2026-09-07: los ajustes salen al ELEGIR puerta y la puerta nace ya así —
   * antes sólo se podían tocar después de dibujarla y cogerla, «*eso está como el culo*».
   */
  doorDraft?: DoorSettings;
  /** Abrir el catálogo para elegirle textura a la puerta cogida. Mismo catálogo que la pared y el suelo. */
  onDoorTexture?: () => void;

  /**
   * ── CON QUÉ SE PINTA LO QUE SE LEVANTA (rebanada 10 · B) ──
   * «*Lo de elegir textura y eso es una equivalencia, pero queda como muro o sala*» (suyo, 2026-09-10): no
   * aparece ninguna cosa nueva que elegir y no desaparece la elección de siempre. Lo que se añade es con qué
   * se pinta cada una — **el MURO con una textura del catálogo, la HABITACIÓN con un color**.
   *
   * Y va pegado a la forma que se dibuje, no al mapa: cambiarlo después no repinta lo ya levantado, igual que
   * el preajuste no repinta las salas.
   */
  shapeTextureUrl?: string | null;
  shapeTextureName?: string | null;
  shapeTextureCells?: number;
  onPickShapeTexture?: () => void;
  onClearShapeTexture?: () => void;
  /** `null` = manda el preajuste de la escena, que es lo que ha hecho siempre. */
  shapeColor?: string | null;
  onShapeColor?: (hex: string | null) => void;
  savedColors?: readonly MapColor[] | null;
  onSaveColor?: (hex: string) => void;
  /**
   * ── EL ANCHO DE LA BANDA (rebanada 10 · B) ──
   * Sólo con «A mano». De serie es **el grosor de muro que la escena ya tiene**, así que una escena existente
   * no cambia hasta que él lo toque. En CASILLAS, como todo lo que se mide en un mapa.
   */
  bandCells?: number;
  onBandCells?: (cells: number) => void;
  onClose: () => void;
}

/**
 * EL PANEL DE BUILDER v3 (`rolvium.pen` · `ePNCc` «modo + preajustes», `zpsjH` «modo SOBRE UNA FOTO`,
 * `CvkXT` «GRUPO cogido», `tS9zl` «VARIOS MUROS cogidos»).
 *
 * Es la orden del dueño del 2026-09-03: «*ya es hora que dejes esto maqueteado en el menú que va y que dejes
 * de agregar cosas en este*». Todo lo de Builder vive AQUÍ, y no colgado de la barra flotante vieja.
 *
 * Lo primero de todo es EN QUÉ ESTÁ TRABAJANDO, porque mezclar las dos maneras fue el fallo de la sesión
 * anterior: marcar muros encima de una foto y levantar salas aquí son cosas distintas y CONVIVEN.
 *
 * De la misma familia que `LightEditor`: flota sobre el mapa, se agarra por la cabecera y se aparta, y la X
 * lo cierra. No se queda con la tecla Escape a propósito — dibujando un polígono, Escape es para cancelar el
 * polígono, no para cerrar el panel.
 *
 * Desde la rebanada 8 lleva además «EL ESTILO DE LA MAZMORRA» —los nueve preajustes— y «LAS DOS TEXTURAS
 * BASE», que aparecen SÓLO con el interruptor en «Dibujar aquí»: marcando sobre una foto el suelo lo pone la
 * foto y esos controles no significarían nada. Era el sitio que el spec les guardaba.
 */
export function BuilderPanel({
  mode, onMode, wall, kind, onKind, buildKind = 'room', onBuildKind, shape, onShape, snapGrid, onSnapGrid, chainNodes, onChainNodes,
  preset = 'hatch', onPreset, wallTextureUrl = null, floorTextureUrl = null, onTexture, onClearTexture,
  thickness = DEFAULT_WALL_THICKNESS, onThickness,
  wallScale = DEFAULT_TEXTURE_SCALE, floorScale = DEFAULT_TEXTURE_SCALE, onTextureScale, onTextureScaleEnd,
  tokenScale = TOKEN_SCALE.def, onTokenScale, onTokenScaleEnd,
  groupCount = 0, grouped = false, onGroup, onUngroup, onVisible, onToggleOpen, onRemove, roomOpening = null, onDoor, onDoorTexture, doorDraft,
  shapeTextureUrl = null, shapeTextureName = null, shapeTextureCells = DEFAULT_TEXTURE_SCALE, onPickShapeTexture, onClearShapeTexture,
  shapeColor = null, onShapeColor, savedColors = null, onSaveColor,
  bandCells = DEFAULT_WALL_THICKNESS, onBandCells, onClose,
}: Props): JSX.Element {
  const { t, locale } = useTranslation();
  /** El número del panel, con la coma o el punto que toque según el idioma. */
  const cellsOfNormal = (v: number): string => new Intl.NumberFormat(locale).format(normalCellsAt(v));
  const { ref, style, handlers } = useDragPanel<HTMLDivElement>();
  const held = groupCount > 1 || !!wall || !!roomOpening;
  /**
   * Lo que se está levantando es un VANO: en «Dibujar aquí» lo dice `buildKind`, y sobre una foto, `kind`.
   *
   * 🔑 Con un vano elegido, TODO lo que es del muro y de la sala se va del panel (suyo, 2026-09-07 con la
   * pantalla delante: «*por qué dejas las opciones de muro en las opciones de puerta y ventana*»): ni la
   * forma, ni el estilo de la mazmorra, ni las dos texturas base, ni el grosor. Nada de eso lo cambia
   * dibujar una puerta, y ofrecerlo ahí es la misma mezcla que él ya paró una vez con los modos.
   */
  const construyeVano = mode === 'draw' ? isOpeningKind(buildKind) : kind !== 'wall';
  /**
   * LA PUERTA COGIDA, venga de donde venga. Al panel le da igual si es un muro suelto o un vano de sala:
   * los ajustes son los mismos y por eso las dos tablas llevan las mismas columnas.
   * Una VENTANA no entra: no se configura ni se abre — ya estaba bien y no se toca.
   */
  const cogida: (DoorSettings & { isOpen: boolean }) | null =
    wall?.kind === 'door' ? wall : roomOpening?.kind === 'door' ? roomOpening : null;
  /** Lo que se va a levantar es una PUERTA (no una ventana: una ventana no se configura, ni se abre). */
  const levantaPuerta = (mode === 'draw' ? buildKind : kind) === 'door';
  /**
   * La puerta que estos controles tocan: la COGIDA si hay una, y si no la que está a punto de dibujarse.
   * Un solo bloque para las dos cosas — es lo que él aprobó en el `.pen` y lo que evita dos sitios donde
   * decir lo mismo.
   *
   * ⚠️ EL BORRADOR SÓLO SALE CON LA MANO VACÍA. Con algo cogido que no es una puerta —una ventana de sala,
   * un muro—, `onDoor` escribe en ESA fila: así lo reparte `SceneTab`, y es lo correcto para una puerta
   * cogida. Enseñar ahí el borrador haría que el panel mintiera dos veces: pintaría los valores de la
   * próxima puerta y cada clic los escribiría en la ventana, sin tocar el borrador.
   */
  const nadaCogido = !wall && !roomOpening;
  const door: (DoorSettings & { isOpen?: boolean }) | null =
    cogida ?? (nadaCogido && levantaPuerta ? doorDraft ?? null : null);

  return (
    <div className="mp-builder" ref={ref} style={style}
      role="group" aria-label={t('maps.builder.title')}>
      <div className="mp-builder-head mp-drag" title={t('maps.builder.move')} {...handlers}>
        <span className="material-symbols-outlined mp-builder-grip" style={{ fontSize: 'var(--icon-xs)' }} aria-hidden="true">drag_indicator</span>
        {/*
          * SU icono, el de verdad, y de máscara igual que en la barra de herramientas: así lo tiñe el panel y
          * no se pierde sobre el papel claro. Un Material Symbol genérico aquí ya se lo tumbó una vez.
          */}
        <span className="mp-builder-icon" data-testid="mp-builder-icon" aria-hidden="true"
          style={{ maskImage: 'url(/icons/builder-mask.png)', WebkitMaskImage: 'url(/icons/builder-mask.png)' }} />
        <span className="mp-builder-title">{t('maps.builder.title')}</span>
        <Tooltip label={t('maps.builder.close')} placement="top">
          <button type="button" className="mp-layers-icon" aria-label={t('maps.builder.close')} onClick={onClose}>
            <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }}>close</span>
          </button>
        </Tooltip>
      </div>

      {/* ── EN QUÉ ESTOY TRABAJANDO · LAS DOS CONVIVEN ── */}
      <fieldset className="mp-builder-group">
        <legend className="tb-rotulo">{t('maps.builder.mode.label')}</legend>
        <div className="mp-builder-modes" role="radiogroup" aria-label={t('maps.builder.mode.label')}>
          {BUILDER_MODES.map(m => (
            <button key={m} type="button" role="radio" aria-checked={mode === m}
              className={`mp-builder-mode ${mode === m ? 'on' : ''}`} onClick={() => onMode(m)}>
              {m === 'photo' ? <MiniPhoto /> : <MiniRoom />}
              <span className="mp-builder-mode-t">{t(`maps.builder.mode.${m}`)}</span>
              <span className="mp-builder-mode-s">{t(`maps.builder.mode.${m}Sub`)}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* ── QUÉ LEVANTO · LO DE SIEMPRE, INTACTO ── */}
      <fieldset className="mp-builder-group">
        <legend className="tb-rotulo">{t(mode === 'draw' ? 'maps.room.build.label' : 'maps.builder.what.label')}</legend>
        {/*
          * Dibujando aquí son CUATRO y no tres: una sala excava el hueco y un muro lo rellena — «*los muros
          * serán relleno de esos huecos*» (dueño, 2026-09-04). Sobre una foto sigue habiendo tres, intactas.
          */}
        <div className="mp-builder-seg" role="radiogroup" aria-label={t('maps.wall.kindOf')}>
          {mode === 'draw'
            ? BUILD_KINDS.map(k => (
              <button key={k} type="button" role="radio" aria-checked={buildKind === k}
                className={`mp-builder-opt ${buildKind === k ? 'on' : ''}`} onClick={() => onBuildKind?.(k)}>
                {t(`maps.room.build.${k}`)}
              </button>
            ))
            : WALL_KINDS.map(k => (
              <button key={k} type="button" role="radio" aria-checked={kind === k}
                className={`mp-builder-opt ${kind === k ? 'on' : ''}`} onClick={() => onKind(k)}>
                {t(`maps.wall.kind.${k}`)}
              </button>
            ))}
        </div>
        <p className="mp-builder-hint">{t(mode === 'draw' ? 'maps.room.build.hint' : 'maps.builder.what.hint')}</p>
      </fieldset>

      {/*
        * ── CON QUÉ SE PINTA ── (`rolvium.pen` · `oi358` § «CON QUÉ SE PINTA», aprobado el 2026-09-10).
        *
        * 🔑 **No aparece ninguna cosa nueva que elegir**: se sigue eligiendo MURO o HABITACIÓN, que es lo que
        * se construye y como se guarda. Lo que se añade es con qué se pinta cada uno, y va PEGADO a esa
        * elección — «*lo de elegir textura y eso es una equivalencia, pero queda como muro o sala*».
        *
        * Con un VANO elegido no sale: una puerta ya tiene su propia textura, en su propio bloque.
        */}
      {mode === 'draw' && !construyeVano && (
        <fieldset className="mp-builder-group" data-testid="mp-shape-paint">
          <legend className="tb-rotulo">{t('maps.room.paintWith.label')}</legend>
          {buildKind === 'wall' ? (
            <div className="mp-builder-tex">
              <span className="tb-rotulo">{t('maps.room.paintWith.wall')}</span>
              <TextureSwatch url={shapeTextureUrl} cells={shapeTextureCells} fallback={styleOf(preset).rock} />
              <span className="mp-builder-tex-n">{shapeTextureUrl ? shapeTextureName ?? t('maps.room.textures.own') : t('maps.room.paintWith.none')}</span>
              <button type="button" className="tb-btn tb-btn-xs tb-btn-blood" onClick={() => onPickShapeTexture?.()}>
                {t(shapeTextureUrl ? 'maps.room.textures.change' : 'maps.room.textures.pick')}
              </button>
              {shapeTextureUrl && (
                <button type="button" className="tb-btn tb-btn-xs tb-btn-blood" onClick={() => onClearShapeTexture?.()}>
                  {t('maps.room.textures.remove')}
                </button>
              )}
            </div>
          ) : (
            <>
              {/*
                * El MISMO bloque de color que el Pincel, y sus mismos colores guardados por campaña: es una
                * sola paleta. `null` mientras él no elija —lo normal— deja mandar al preajuste, que es lo que
                * ha hecho siempre; por eso hay un botón para volver a él.
                */}
              <PaintColor value={shapeColor ?? DEFAULT_BRUSH_COLOR} onChange={hex => onShapeColor?.(hex)}
                savedColors={savedColors} onSave={hex => onSaveColor?.(hex)} />
              {shapeColor && (
                <div className="mp-builder-row">
                  <button type="button" className="tb-btn tb-btn-xs tb-btn-blood" onClick={() => onShapeColor?.(null)}>
                    {t('maps.room.paintWith.clear')}
                  </button>
                </div>
              )}
            </>
          )}
          <p className="mp-builder-hint">{t(buildKind === 'wall' ? 'maps.room.paintWith.wallHint' : 'maps.room.paintWith.roomHint')}</p>
        </fieldset>
      )}


      {/*
        * ── CÓMO SERÁ LA PUERTA ── (`rolvium.pen` · «PL/Builder · panel · PUERTA ELEGIDA», aprobado el
        * 2026-09-07). Va AQUÍ, justo debajo de «qué levanto», y no dentro de «lo que tengo cogido»: sale en
        * cuanto se elige PUERTA, y la puerta nace ya así. Con una cogida, edita esa.
        */}
      {door && onDoor && (
        <fieldset className="mp-builder-group mp-door-opts" data-testid="mp-door-opts">
          <legend className="tb-rotulo">{t('maps.door.section')}</legend>
          {!cogida && <p className="mp-builder-hint">{t('maps.door.draftHint')}</p>}
          {/*
            * Configurarla NUNCA es obligatorio (orden suya): nace de una hoja, colgada del extremo por donde
            * la dibujó y abriendo hacia un lado fijo. La bisagra y el lado son DOS interruptores y no un
            * menú de cuatro combinaciones: es lo mismo y se entiende sin leer.
            */}
            <div className="mp-builder-row" role="radiogroup" aria-label={t('maps.door.leaves')}>
              <span className="tb-rotulo">{t('maps.door.leaves')}</span>
              {DOOR_LEAVES.map(n => (
                <button key={n} type="button" role="radio" aria-checked={door.leaves === n}
                  className={`tb-btn tb-btn-xs ${door.leaves === n ? 'tb-btn-blood' : ''}`}
                  onClick={() => onDoor({ leaves: n })}>{t(n === 1 ? 'maps.door.leavesOne' : 'maps.door.leavesTwo')}</button>
              ))}
            </div>
            {/* La bisagra sólo se lee con UNA hoja: con dos, cada hoja cuelga ya de su propio extremo. */}
            {door.leaves === 1 && (
              <div className="mp-builder-row" role="radiogroup" aria-label={t('maps.door.hinge')}>
                <span className="tb-rotulo">{t('maps.door.hinge')}</span>
                {DOOR_HINGES.map(h => (
                  <button key={h} type="button" role="radio" aria-checked={door.hinge === h}
                    className={`tb-btn tb-btn-xs ${door.hinge === h ? 'tb-btn-blood' : ''}`}
                    onClick={() => onDoor({ hinge: h })}>{t(h === 'start' ? 'maps.door.hingeStart' : 'maps.door.hingeEnd')}</button>
                ))}
              </div>
            )}
            <div className="mp-builder-row" role="radiogroup" aria-label={t('maps.door.swing')}>
              <span className="tb-rotulo">{t('maps.door.swing')}</span>
              {DOOR_SWINGS.map(w => (
                <button key={w} type="button" role="radio" aria-checked={door.swing === w}
                  className={`tb-btn tb-btn-xs ${door.swing === w ? 'tb-btn-blood' : ''}`}
                  onClick={() => onDoor({ swing: w })}>{t(w === 'right' ? 'maps.door.swingA' : 'maps.door.swingB')}</button>
              ))}
            </div>
            {/*
              * LOS COLORES, EN REJILLA Y ORDENADOS (corrección suya del 2026-09-07: «*no puedes dejar todos
              * los colores desordenados*»). Filas fijas de cinco y por familias —maderas, metales y piedra,
              * tintes—, no una lista que se dobla sola por donde le cabe.
              *
              * El de la ESCENA es el primero y el de serie: por defecto todas iguales, y la de hierro del
              * jefe se cambia sola (elegido por él). `null` = el trazo del muro.
              */}
            <span className="tb-rotulo">{t('maps.door.color')}</span>
            <div className="mp-door-colors" role="radiogroup" aria-label={t('maps.door.color')}>
              <button type="button" role="radio" aria-checked={door.doorColor === null} aria-label={t('maps.door.colorScene')}
                className={`mp-swatch mp-swatch-scene ${door.doorColor === null ? 'on' : ''}`} onClick={() => onDoor({ doorColor: null })} />
              {DOOR_COLORS.map(c => (
                <button key={c} type="button" role="radio" aria-checked={door.doorColor === c} aria-label={t('maps.door.colorOwn', { hex: c })}
                  className={`mp-swatch ${door.doorColor === c ? 'on' : ''}`} style={{ background: c }} onClick={() => onDoor({ doorColor: c })} />
              ))}
            </div>
            {/*
              * LA TEXTURA, que manda sobre el color (suyo, 2026-09-07: «*te falta lo de la textura*»).
              * Sale del MISMO catálogo que la pared y el suelo — es de la herramienta, ya está hecho, y
              * duplicarlo para las puertas sería tener dos sitios donde subir una foto de madera.
              * El azulejo es de UNA casilla, que es más o menos lo que mide una puerta.
              */}
            <div className="mp-builder-row">
              <span className="tb-rotulo">{t('maps.door.texture')}</span>
              <TextureSwatch url={door.doorTextureUrl} cells={1} fallback={styleOf(preset).rock} />
              {/*
                * «Elegir», no «+ Subir» (suyo, 2026-09-07: «*el botón de la textura dice subir y eso está
                * mal*»). Y tiene razón: esto ABRE EL CATÁLOGO para escoger una que ya está. Subir una foto
                * nueva se hace dentro del catálogo, que es donde vive ese botón.
                */}
              <button type="button" className="tb-btn tb-btn-xs tb-btn-blood" onClick={() => onDoorTexture?.()}>
                {t(door.doorTextureUrl ? 'maps.door.textureChange' : 'maps.door.texturePick')}
              </button>
              {door.doorTextureUrl && (
                <button type="button" className="tb-btn tb-btn-xs tb-btn-blood" onClick={() => onDoor({ doorTextureUrl: null })}>
                  {t('maps.room.textures.remove')}
                </button>
              )}
            </div>
            <p className="mp-builder-hint">{t('maps.door.hint')}</p>
        </fieldset>
      )}

      {/*
        * ── CON QUÉ FORMA ── y NO con una puerta o una ventana (suyo, 2026-09-07 con la app delante:
        * «*dejaste como opciones el a mano, recta, círculo etc, en una puerta o ventana no tiene sentido*»).
        * Un vano es SIEMPRE un tramo recto de A a B: no hay forma que elegir, y ofrecerla prometía un gesto
        * que no existe. Vale para los dos modos: marcando sobre una foto tampoco tiene sentido un círculo.
        */}
      {!construyeVano && (
      <fieldset className="mp-builder-group">
        <legend className="tb-rotulo">{t('maps.room.shapeOf')}</legend>
        <div className="mp-builder-shapes" role="radiogroup" aria-label={t('maps.room.shapeOf')}>
          {/*
            * Dibujando aquí sólo salen las formas que PUEDEN levantar lo elegido: una raya no encierra nada,
            * así que no aparece con SALA (pega suya del 2026-09-04). Sobre una foto salen las seis, intactas.
            */}
          {(mode === 'draw' ? shapesFor(buildKind) : ROOM_SHAPES).map(s => (
            <button key={s} type="button" role="radio" aria-checked={shape === s}
              className={`mp-builder-opt ${shape === s ? 'on' : ''}`} onClick={() => onShape(s)}>
              {t(`maps.room.shape.${s}`)}
            </button>
          ))}
        </div>
        <p className="mp-builder-hint">{shapeHint(shape, t)}</p>
      </fieldset>
      )}

      {/*
        * ── EL ANCHO DE LA BANDA ── (`oi358` § «EL ANCHO DE LA BANDA · SÓLO CON «A MANO»»).
        *
        * «A mano» deja de dar una raya del grosor de la escena y da una BANDA del ancho que se elija. De serie
        * el ancho ES ese grosor, así que una escena existente no cambia hasta que él lo toque — y por eso este
        * número NO se guarda en ninguna parte: sale de la escena y vale para lo que dibuje ahora.
        *
        * Sólo con «A mano»: las otras formas ya encierran área por sí solas, y una recta marca un muro.
        */}
      {mode === 'draw' && !construyeVano && shape === 'segment' && (
        <fieldset className="mp-builder-group" data-testid="mp-band">
          <legend className="tb-rotulo">{t('maps.room.band.label')}</legend>
          <div className="mp-builder-thick">
            <span className="mp-builder-tex-n">{t('maps.room.band.short')}</span>
            <input type="range" min={BRUSH_MIN_CELLS} max={BRUSH_MAX_CELLS} step={0.02} value={bandCells}
              aria-label={t('maps.room.band.short')}
              onChange={e => onBandCells?.(Number(e.target.value))} />
            {/* Con la coma o el punto que toque, como el número de las fichas: «0.34» en español está mal. */}
            <span className="mp-builder-thick-v">{new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(bandCells)}</span>
          </div>
          <p className="mp-builder-hint">{t('maps.room.band.hint')}</p>
        </fieldset>
      )}

      {/*
        * ── EL ESTILO DE LA MAZMORRA ── Los nueve preajustes (`rolvium.pen` · `ePNCc` § S/PREAJUSTES).
        *
        * Un preajuste NO es una textura: son LAS DOS TEXTURAS BASE DE GOLPE — la roca de la que está excavada
        * la mazmorra y el suelo que asoma por los agujeros. Y no bloquea nada: en cuanto él suba una foto
        * suya, manda la suya.
        *
        * Sólo en «Dibujar aquí». Marcando sobre una foto el suelo lo pone la foto, y la mitad de estos
        * controles no significaría nada — que fue el fallo que él señaló: «estás mezclando estas dos opciones».
        */}
      {mode === 'draw' && !construyeVano && (
        <fieldset className="mp-builder-group">
          <legend className="tb-rotulo">{t('maps.room.preset.label')}</legend>
          <div className="mp-builder-presets" role="radiogroup" aria-label={t('maps.room.preset.label')}>
            {ROOM_PRESETS.map(k => (
              <button key={k} type="button" role="radio" aria-checked={preset === k}
                className={`mp-builder-preset ${preset === k ? 'on' : ''}`} onClick={() => onPreset?.(k)}
                data-testid={`mp-preset-${k}`}>
                <PresetMini preset={k} />
                <span className="mp-builder-preset-t">{t(`maps.room.preset.${k}`)}</span>
              </button>
            ))}
          </div>
          <p className="mp-builder-hint">{t('maps.room.preset.hint')}</p>
        </fieldset>
      )}

      {/*
        * ── LAS DOS TEXTURAS BASE Y EL GROSOR ── Son DE ESTA ESCENA, no de la campaña: «*una cripta y un
        * bosque no se parecen en nada*» (dueño, 2026-09-03). Cambiarlas NO repinta las salas ya levantadas:
        * cada una se llevó su suelo el día que se dibujó.
        */}
      {mode === 'draw' && !construyeVano && (
        <fieldset className="mp-builder-group">
          <legend className="tb-rotulo">{t('maps.room.textures.label')}</legend>
          <p className="mp-builder-hint">{t('maps.room.textures.hint')}</p>
          {([['wall', wallTextureUrl, wallScale], ['floor', floorTextureUrl, floorScale]] as const).map(([which, url, escala]) => (
            <div key={which} className="mp-builder-texblock">
              <div className="mp-builder-tex">
                <TextureSwatch url={url} cells={escala}
                  fallback={which === 'wall' ? styleOf(preset).rock : styleOf(preset).floor} />
                <span className="mp-builder-tex-n">{url ? t('maps.room.textures.own') : t(`maps.room.preset.${preset}`)}</span>
                {/*
                  * Rojo sangre = ACCIÓN (su corrección nº 3 del 2026-09-02). El negro es sólo lo seleccionado.
                  * 🐞 …y hasta el 2026-09-04 esto NO era rojo: la clase que había, `tb-btn-danger`, no existe
                  * en el CSS, así que estos botones caían al `tb-btn` de siempre —tinta sobre el panel— y
                  * dentro del catálogo, que se pinta oscuro, el texto salía invisible. Él lo vio antes que
                  * nadie: «*mira el botón que está mal*».
                  */}
                <button type="button" className="tb-btn tb-btn-xs tb-btn-blood" onClick={() => onTexture?.(which)}>
                  {t(url ? 'maps.room.textures.change' : 'maps.room.textures.pick')}
                </button>
                {url && (
                  <button type="button" className="tb-btn tb-btn-xs tb-btn-blood" onClick={() => onClearTexture?.(which)}>
                    {t('maps.room.textures.remove')}
                  </button>
                )}
              </div>
              {/*
                * EL AZULEJO. Sólo con una foto puesta: el preajuste pinta con color, y un color no se escala.
                * Arrastrar repinta el mapa Y la muestra en vivo; se guarda al soltar.
                */}
              {url && (
                <div className="mp-builder-thick">
                  <span className="mp-builder-tex-n">{t(`maps.room.tile.${which}`)}</span>
                  <input type="range" min={0.25} max={20} step={0.25} value={escala}
                    aria-label={t(`maps.room.tile.${which}`)}
                    onChange={e => onTextureScale?.(which, Number(e.target.value))}
                    onPointerUp={() => onTextureScaleEnd?.()}
                    onKeyUp={() => onTextureScaleEnd?.()}
                    onBlur={() => onTextureScaleEnd?.()} />
                  <span className="mp-builder-thick-v">{escala}</span>
                </div>
              )}
            </div>
          ))}
          <div className="mp-builder-thick">
            <span className="mp-builder-tex-n">{t('maps.room.thickness')}</span>
            <input type="range" min={0.08} max={0.6} step={0.02} value={thickness}
              aria-label={t('maps.room.thickness')}
              onChange={e => onThickness?.(Number(e.target.value))} />
            <span className="mp-builder-thick-v">{Math.round(thickness * 100)}</span>
          </div>
        </fieldset>
      )}

      {/*
        * ── EL TAMAÑO DE LAS FICHAS ── Encargo suyo del 2026-09-07: «*si dibujan pasillos pequeños los tokens
        * no pasarán… quiero reducir el tamaño*», y con su condición, «*que se mantenga la relación de
        * diminuto pequeño normal grande y enorme*». Por eso es UNA barrita para todos y no un tamaño por
        * ficha: multiplica por igual, así que la proporción del manual no se toca.
        *
        * VA FUERA DEL `builderMode`, al contrario que las texturas: las fichas están en los dos modos, y el
        * pasillo estrecho que lo motivó se puede dibujar tanto levantando salas como marcando muros.
        *
        * El número que se enseña NO es el multiplicador: es LO QUE OCUPA UNA FICHA NORMAL, en casillas. «×0,66»
        * no le dice nada a nadie; «1 casilla» contesta sola la pregunta de si pasa por el pasillo. Aprobado
        * así en `rolvium.pen` · «PL/Builder · panel · TAMAÑO DE LAS FICHAS».
        */}
      <fieldset className="mp-builder-group">
        <legend className="tb-rotulo">{t('maps.tokenScale.label')}</legend>
        <p className="mp-builder-hint">{t('maps.tokenScale.hint')}</p>
        <div className="mp-builder-thick">
          <span className="mp-builder-tex-n">{t('maps.tokenScale.short')}</span>
          {/*
            * LA MARCA DEL CENTRO, «como siempre», que la lámina aprobada pide para poder volver sin buscar.
            * Va con `list`/`<datalist>`, que es como el navegador dibuja una muesca en un deslizador — y NO
            * con estilos propios del carril: los otros deslizadores del panel son los nativos tal cual, y
            * pintarle un carril a medida sólo a éste lo dejaría desentonando al lado del grosor del muro.
            * Donde el navegador no dibuje la muesca no se pierde nada: el número sigue diciendo dónde está.
            */}
          <datalist id="mp-token-scale-ticks"><option value={TOKEN_SCALE.def} /></datalist>
          <input type="range" min={TOKEN_SCALE.min} max={TOKEN_SCALE.max} step={0.01} value={tokenScale}
            list="mp-token-scale-ticks"
            aria-label={t('maps.tokenScale.label')}
            aria-valuetext={t('maps.tokenScale.reading', { cells: cellsOfNormal(tokenScale) })}
            onChange={e => onTokenScale?.(Number(e.target.value))}
            onPointerUp={() => onTokenScaleEnd?.()}
            onKeyUp={() => onTokenScaleEnd?.()}
            onBlur={() => onTokenScaleEnd?.()} />
          <span className="mp-builder-thick-v">{cellsOfNormal(tokenScale)}</span>
        </div>
        <p className="mp-builder-hint">{t('maps.tokenScale.reading', { cells: cellsOfNormal(tokenScale) })}</p>
      </fieldset>

      {/*
        * ── EL CANDADO ── Aprobado por él el 2026-09-03 («*tira*») con sus tres condiciones: empieza cerrado,
        * vale para todo Builder y, abierto, las puntas se pegan a las puntas de otros muros.
        */}
      <fieldset className="mp-builder-group">
        <legend className="tb-rotulo">{t('maps.builder.snap.label')}</legend>
        <button type="button" className={`mp-builder-lock ${snapGrid ? 'on' : ''}`} aria-pressed={snapGrid}
          onClick={() => onSnapGrid(!snapGrid)}>
          <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }} aria-hidden="true">
            {snapGrid ? 'lock' : 'lock_open'}
          </span>
          {t(snapGrid ? 'maps.builder.snap.on' : 'maps.builder.snap.off')}
        </button>
        <p className="mp-builder-hint">{t(snapGrid ? 'maps.builder.snap.hintOn' : 'maps.builder.snap.hintOff')}</p>
      </fieldset>

      {/*
        * ── LOS NODOS, EN CADENA ── «*los nodos deberían ser como una cadena a menos que yo elija que no*»
        * (dueño, 2026-09-03). Va PUESTO por omisión, que es lo que él pidió, y al lado del candado porque las
        * dos cosas contestan a la misma pregunta: cómo se comporta una punta cuando la arrastras.
        */}
      <fieldset className="mp-builder-group">
        <legend className="tb-rotulo">{t('maps.builder.chain.label')}</legend>
        <button type="button" className={`mp-builder-lock ${chainNodes ? '' : 'on'}`} aria-pressed={chainNodes}
          onClick={() => onChainNodes(!chainNodes)}>
          <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }} aria-hidden="true">
            {chainNodes ? 'link' : 'link_off'}
          </span>
          {t(chainNodes ? 'maps.builder.chain.on' : 'maps.builder.chain.off')}
        </button>
        <p className="mp-builder-hint">{t(chainNodes ? 'maps.builder.chain.hintOn' : 'maps.builder.chain.hintOff')}</p>
      </fieldset>

      {/* ── LO QUE TENGO COGIDO ── el grupo, los muros sueltos, o el muro que se está editando ── */}
      {held && (
        <fieldset className="mp-builder-group">
          <legend className="tb-rotulo">{t('maps.group.held')}</legend>
          {groupCount > 1 && (
            <div className="mp-builder-row">
              <span className="mp-groupbar-n">{grouped ? t('maps.group.countGrouped', { n: String(groupCount) }) : t('maps.group.countLoose', { n: String(groupCount) })}</span>
              <button type="button" className="tb-btn tb-btn-xs tb-btn-blood" onClick={() => (grouped ? onUngroup?.() : onGroup?.())}>
                {grouped ? t('maps.group.ungroup') : t('maps.group.group')}
              </button>
            </div>
          )}
          {groupCount > 1 && <p className="mp-builder-hint">{grouped ? t('maps.group.hintGrouped') : t('maps.group.hintLoose')}</p>}
          {(wall || roomOpening) && (
            <div className="mp-builder-row">
              {/* Esconder es SÓLO de un muro suelto: una sala es el dibujo del mapa y se ve siempre. */}
              {wall && onVisible && (
                <label className="mp-light-check">
                  <input type="checkbox" checked={wall.visiblePlayers} onChange={e => onVisible(e.target.checked)} />
                  {t('maps.wall.visible')}
                </label>
              )}
              {onToggleOpen && canOpen(wall ?? roomOpening!) && (
                <button type="button" className="tb-btn tb-btn-xs" onClick={onToggleOpen}>{(wall ?? roomOpening!).isOpen ? t('maps.wall.close') : t('maps.wall.open')}</button>
              )}
              {onRemove && (
                <Tooltip label={t('maps.wall.remove')} placement="top">
                  <button type="button" className="mp-segbar-del" aria-label={t('maps.wall.remove')} onClick={onRemove}>
                    <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>delete</span>
                  </button>
                </Tooltip>
              )}
            </div>
          )}
          {/* El nodo por doble clic sólo tiene sentido con un muro cogido: es donde se puede pinchar su línea. */}
          {wall && <p className="mp-builder-hint">{t('maps.builder.nodeHint')}</p>}
        </fieldset>
      )}

      {/*
        * Cómo coger TODO, y siempre a la vista: dentro de «lo que tengo cogido» no serviría, porque esa
        * sección sólo aparece cuando ya has cogido algo (dueño: «no me deja seleccionar todos los nodos»).
        */}
      <p className="mp-builder-hint">{t('maps.builder.selectAll')}</p>

      <p className="mp-builder-note">
        <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-xs)' }} aria-hidden="true">info</span>
        {t(`maps.builder.note.${mode}`)}
      </p>
    </div>
  );
}

/**
 * La pista de abajo cambia con la forma: cada una se dibuja con un gesto distinto y decirlo aquí ahorra
 * tener que adivinarlo sobre el lienzo.
 */
function shapeHint(shape: RoomShape, t: (key: string) => string): string {
  if (shape === 'segment') return t('maps.room.chainHint');
  if (shape === 'line') return t('maps.room.lineHint');
  return shape === 'poly' ? t('maps.room.polyHint') : t('maps.room.dragHint');
}

/** Una foto de mapa con los muros marcados encima: la esquina de una sala ya dibujada por otro. */
function MiniPhoto(): JSX.Element {
  return (
    <svg className="mp-builder-mini" viewBox="0 0 44 30" aria-hidden="true">
      <rect className="mp-builder-mini-photo" x="0" y="0" width="44" height="30" />
      <g className="mp-builder-mini-mark">
        <line x1="7" y1="6" x2="30" y2="6" />
        <line x1="30" y1="6" x2="37" y2="13" />
        <line x1="37" y1="13" x2="37" y2="24" />
        <line x1="7" y1="6" x2="7" y2="24" />
        <line x1="7" y1="24" x2="20" y2="24" />
      </g>
    </svg>
  );
}

/** Una sala levantada aquí: los muros y la rejilla del suelo debajo. */
function MiniRoom(): JSX.Element {
  return (
    <svg className="mp-builder-mini" viewBox="0 0 44 30" aria-hidden="true">
      <rect className="mp-builder-mini-floor" x="7" y="6" width="30" height="18" />
      <g className="mp-builder-mini-grid">
        <line x1="17" y1="6" x2="17" y2="24" />
        <line x1="27" y1="6" x2="27" y2="24" />
        <line x1="7" y1="12" x2="37" y2="12" />
        <line x1="7" y1="18" x2="37" y2="18" />
      </g>
      <rect className="mp-builder-mini-wall" x="7" y="6" width="30" height="18" />
    </svg>
  );
}

/**
 * LA MINIATURA DE UN PREAJUSTE: **la esquina de una sala montada**, no un cuadrado de color.
 *
 * Segunda pasada del 2026-09-03, después de que él dijera que la primera rejilla era «*un adefesio*»: el muro
 * entra en L por arriba y por la izquierda, el suelo se sale por abajo y por la derecha, y lleva su rejilla.
 * Es lo que hace que se distinga de un vistazo un RAYADO de un RELLENO — que era justo lo que no se veía.
 */
function PresetMini({ preset }: { preset: RoomPreset }): JSX.Element {
  const st = styleOf(preset);
  const W = 88, H = 52, FX = 15, FY = 13;
  const hatchId = `mp-mini-hatch-${preset}`;
  // La L del muro: por el techo del suelo y por su costado izquierdo. El resto se sale del recuadro.
  const corner = `M ${FX} ${H} L ${FX} ${FY} L ${W} ${FY}`;
  const wobbly = `M ${FX} ${H} L ${FX - 1.4} ${FY + 12} L ${FX + 1.2} ${FY + 1} L ${FX + 13} ${FY - 1.3} L ${W} ${FY + 1.1}`;
  return (
    <svg className="mp-builder-preset-mini" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" preserveAspectRatio="none">
      {st.hatch && (
        <defs>
          <pattern id={hatchId} width={5} height={9} patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">
            <line x1={1} y1={0} x2={1} y2={5.5} stroke={st.hatch} strokeWidth={1.1} strokeLinecap="round" />
            <line x1={3} y1={3} x2={3} y2={8} stroke={st.hatch} strokeWidth={0.9} strokeLinecap="round" />
          </pattern>
        </defs>
      )}
      <rect x={0} y={0} width={W} height={H} fill={st.rock} />
      {st.hatch && <path d={corner} fill="none" stroke={`url(#${hatchId})`} strokeWidth={13} />}
      {st.band && <path d={corner} fill="none" stroke={st.band} strokeWidth={9} />}
      <rect x={FX} y={FY} width={W - FX} height={H - FY} fill={st.floor} />
      <g stroke="var(--rm-shadow)" strokeWidth={0.5} opacity={0.35}>
        {[26, 37, 48, 59, 70, 81].map(x => <line key={x} x1={x} y1={FY} x2={x} y2={H} />)}
        {[24, 35, 46].map(y => <line key={y} x1={FX} y1={y} x2={W} y2={y} />)}
      </g>
      <path d={st.wobble ? wobbly : corner} fill="none" stroke={st.wall} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * LA MUESTRA DE UNA TEXTURA — y es el «previo» que él pidió el 2026-09-04: «*tener un previo de cómo iría
 * quedando cuando la escale*».
 *
 * No enseña la foto: enseña **cuántos azulejos entran en una casilla**, que es lo único que hace falta decidir.
 * Por eso la muestra vale exactamente TRES CASILLAS de ancho y lleva la rejilla dibujada encima: con un
 * mosaico a 0,5 se ven seis por casilla y a 8 se ve un trozo de uno. Sin la rejilla detrás, un cuadrado con
 * una foto dentro no dice nada — que es lo que había antes.
 */
const SWATCH_CELLS = 3;
const SWATCH_W = 66;
function TextureSwatch({ url, cells, fallback }: { url: string | null; cells: number; fallback: string }): JSX.Element {
  const cellPx = SWATCH_W / SWATCH_CELLS;
  const tile = Math.max(2, cellPx * cells);
  return (
    <span className="mp-builder-tex-swatch" data-testid="mp-tex-swatch" aria-hidden="true"
      style={url
        ? { backgroundImage: `url(${url})`, backgroundSize: `${tile}px ${tile}px`, backgroundRepeat: 'repeat' }
        : { background: fallback }}>
      <span className="mp-builder-tex-grid" style={{ backgroundSize: `${cellPx}px ${cellPx}px` }} />
    </span>
  );
}
