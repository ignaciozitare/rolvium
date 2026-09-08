import { memo } from 'react';
import type { RoomWall } from '@rolvium/core';
import type { Room, RoomOpening, RoomPreset, Scene } from '../domain/entities/Scene';
import {
  dugRooms, filledRooms, floorUrlOf, outlinePath, ringOf, ringPath, ringsOf, roomWallsOf, shadowDepthPx,
  styleOf, tilePx, wallWidthPx,
} from '../domain/useCases/roomStyles';
import { doorColorOf, doorTextureOf, type Segment } from '../domain/useCases/mapRules';
import { DoorLeaves } from './canvasLayers';


/**
 * LAS SALAS, PINTADAS (specs/modules/maps/SPEC.md § «Cómo se levanta una sala»).
 *
 * LO QUE HAY QUE ENTENDER ANTES DE NADA — EL SUELO NO SE PONE ENCIMA: SE VE POR EL AGUJERO. La textura de PARED rellena la escena entera —es la
 * roca de la que está excavada la mazmorra— y cada sala ABRE UN HUECO por el que asoma el SUELO. Dibujar una
 * sala no añade suelo, quita pared. Si esto se pinta al revés, todo lo demás sale mal: se ven alfombras
 * flotando en el vacío en vez de una mazmorra.
 *
 * Por eso todo aquí son DOS MÁSCARAS y nada más:
 *   · `rock` — blanco en toda la escena, NEGRO en las salas → la roca, con sus agujeros.
 *   · `hole` — negro en toda la escena, BLANCO en las salas → el suelo, sólo por los agujeros.
 *
 * Y se hace con máscaras y no con un camino de relleno par-impar a propósito: par-impar hace un XOR, así que
 * dos salas SOLAPADAS se volverían roca justo donde se cruzan — el revés exacto de lo que él pidió. Una
 * máscara con N formas en blanco es su UNIÓN, se toquen o no, que es lo que hace falta.
 *
 * El muro no se pinta desde ninguna fila: es el CONTORNO DE LA UNIÓN, que calcula `roomWalls` en
 * `@rolvium/core` — el mismo que usa el servidor para la niebla y las colisiones. Una sola verdad, o la sala
 * taparía de una forma y se vería de otra.
 */

interface Props {
  scene: Scene;
  rooms: readonly Room[];
  openings: readonly RoomOpening[];
  /** El vano cogido con Seleccionar, para marcarlo como se marca un muro cogido. */
  selectedOpeningId?: string | null;
  /** Los ids de las máscaras, para que la rejilla pueda pedir la del agujero (ver `GridLayer`). */
  ids: RoomMaskIds;
}

export interface RoomMaskIds { rock: string; hole: string; hatch: string; blur: string; rockTile: string; floorTile: string }
export const roomMaskIds = (sceneId: string): RoomMaskIds => ({
  rock: `mp-room-rock-${sceneId}`,
  hole: `mp-room-hole-${sceneId}`,
  hatch: `mp-room-hatch-${sceneId}`,
  blur: `mp-room-blur-${sceneId}`,
  rockTile: `mp-room-rocktile-${sceneId}`,
  floorTile: `mp-room-floortile-${sceneId}`,
});

/**
 * Valores de LUMINANCIA de una máscara SVG, no colores: blanco = se ve, negro = no se ve. Es el mismo caso
 * justificado que ya tenía la niebla (`canvasLayers.tsx`): un token de diseño sería un blanco roto y dejaría
 * la roca traslúcida por todas partes.
 */
const MASK_SHOW = '#ffffff';
const MASK_HIDE = '#000000';

/**
 * EL MAPA SE PINTA COMO SE DIBUJA: capa a capa y en orden.
 *
 * 🐞 Su cabreo del 2026-09-04: «*el muro nuevo funciona como otro muro distinto del anterior, cuando pinto
 * una sala nueva no lo afecta*». Y tenía razón. El contorno ya respetaba el orden, pero **el suelo no**: se
 * agrupaba por textura y los muros se restaban TODOS al final, así que una sala dibujada encima de un muro
 * nunca conseguía enseñar su suelo — se veía el muro entero y la sala no aparecía.
 *
 * Aquí no hay grupos ni restas: se recorre la lista en el orden en que él dibujó, y cada forma pinta encima
 * de lo que hubiera. Una sala pinta su suelo; un muro vuelve a pintar roca. Lo último mandará siempre,
 * porque es literalmente lo último que se pinta.
 *
 * Lo que sí se hace es JUNTAR LAS SEGUIDAS que pintan lo mismo: un mapa normal son veinte salas con el mismo
 * suelo, y pintarlas de una en una serían veinte recortes y veinte rectángulos del tamaño del mapa. Juntar
 * sólo las CONSECUTIVAS es lo que mantiene el orden intacto.
 */
interface Capa { key: string; rock: boolean; preset: RoomPreset; url: string | null; d: string }

function capasDe(rooms: readonly Room[], scene: Pick<Scene, 'floorTextureUrl'>): Capa[] {
  const out: Capa[] = [];
  for (const r of rooms) {
    const d = ringPath(ringOf(r));
    if (!d) continue;
    const rock = r.kind === 'fill';
    // 🐞 La url se RESUELVE contra el mapa: una sala sin suelo propio usa el del mapa. Sin esto, las salas
    // dibujadas antes de subir la textura se quedaban con el color del preajuste para siempre.
    const url = rock ? null : floorUrlOf(r, scene);
    const key = rock ? 'rock' : `${r.floorPreset}|${url ?? ''}`;
    const last = out[out.length - 1];
    if (last && last.key === key) last.d += ` ${d}`;
    else out.push({ key, rock, preset: r.floorPreset, url, d });
  }
  return out;
}

/**
 * ⚡ ENVUELTA EN `memo`, Y NO ES UN CAPRICHO (suyo, 2026-09-07: «*la sombra dinámica en local va lentísima
 * cuando pruebo*»).
 *
 * Esta capa dibuja la mazmorra ENTERA: funde el contorno de todas las salas, le pone el temblor punto a
 * punto, monta las capas de suelo y encima la sombra de adentro —un desenfoque de SVG sobre todo el
 * contorno, dentro de una máscara—. Se repintaba en cada repintado del lienzo, y arrastrar una ficha repinta
 * ~60 veces por segundo: todo ese trabajo se rehacía en cada fotograma del arrastre para acabar dibujando
 * exactamente lo mismo que ya estaba en pantalla.
 *
 * Nada de lo que hay aquí depende de las fichas: sala, vano y escena. Con `memo` (y con las props estables
 * desde `MapCanvas`) React ni entra en el cuerpo, y el arrastre va suelto. No cambia ni un píxel de lo que
 * se ve.
 */
function RoomsLayerBase({ scene, rooms, openings, ids, selectedOpeningId = null }: Props): JSX.Element | null {
  /**
   * ⏱ EL CONTORNO SE CALCULA UNA VEZ POR CAMBIO, NO UNA VEZ POR PINTADA.
   *
   * Fundir las formas cuesta comparar cada lado con todos los demás, y el lienzo se repinta muchas veces por
   * segundo —cada refresco de niebla, cada tirón de una ficha—. Medido: con 60 salas son ~21 ms CADA VEZ, que
   * es exactamente la queja de «está todo lentísimo» esperando a repetirse. Con esto sólo se recalcula cuando
   * de verdad cambian las salas o sus vanos; arrastrar una ficha ya no lo toca.
   *
   * Los hooks van ANTES del `return` temprano a propósito: saltárselo en una escena sin salas cambiaría el
   * número de hooks entre pintadas, que es lo que React no permite.
   */
  const excavado = dugRooms(rooms);
  const walls = roomWallsOf(rooms, openings);
  if (excavado.length === 0) return null;
  const st = styleOf(scene.roomPreset);
  const width = wallWidthPx(scene);
  const shadow = shadowDepthPx(scene);
  const rockTile = tilePx(scene.wallTextureScale, scene.grid.size);
  const floorTile = tilePx(scene.floorTextureScale, scene.grid.size);
  // UNA sola lista, y se recorre dos veces con el MISMO índice: los patrones de `defs` y los rectángulos que
  // los usan se emparejan por ese índice, así que calcularla dos veces sería pedir que se descuadren.
  const capasPintadas = capasDe(rooms, scene);
  const full = { x: 0, y: 0, width: scene.width, height: scene.height };
  /**
   * EL VACÍO = lo EXCAVADO menos lo RELLENADO (suyo, 2026-09-04: «*los muros serán relleno de esos huecos*»).
   *
   * En la máscara se hace con dos capas de pintura y no con reglas de relleno: primero se pintan las salas en
   * blanco —que es su unión— y encima los muros en NEGRO, que se las comen. Es la resta, y sale exacta se
   * solapen como se solapen: el orden de pintado manda, no el recuento de vueltas.
   */
  /**
   * EL VACÍO SE PINTA EN ORDEN, capa a capa: cada sala en blanco y cada muro en NEGRO, en el orden en que él
   * los dibujó. Así excavar encima de un muro lo abre y levantar un muro encima de una sala la tapa — lo que
   * hace cualquier herramienta de dibujo. Agrupar «todas las salas y luego todos los muros» hacía que un
   * muro ganara siempre, dibujara él lo que dibujara después.
   */
  const siluetas = rooms
    .map(r => ({ d: ringPath(ringOf(r)), dig: r.kind !== 'fill', id: r.id }))
    .filter(c => c.d);
  /** El temblor del trazo a mano, proporcional al grosor: una pared gorda tiembla más que una fina. */
  const wobbleAmount = st.wobble ? Math.max(1.5, width * 0.35) : 0;
  const d = (kinds: (RoomWall['kind'])[], open: boolean | null): string =>
    outlinePath(walls.filter(w => kinds.includes(w.kind) && (open === null || w.isOpen === open)).map(w => w.seg), st.wobble, wobbleAmount);
  const solid = d(['wall'], null);
  const doorsClosed = d(['door'], false);
  const doorsOpen = d(['door'], true);
  const windows = d(['window'], null);
  /**
   * LAS PUERTAS DE SALA SE PINTAN COMO LAS DE MURO SUELTO (§ «Las puertas, de verdad»): la misma barra
   * hueca de ángulos rectos, con sus hojas, su bisagra y su lado. Decisión suya con la captura delante —
   * prefiere que cambien las que ya tiene a que convivan dos puertas distintas en el mismo mapa.
   *
   * El tramo se toma del CONTORNO ya resuelto, no de las coordenadas crudas del vano: así la puerta cae
   * exactamente sobre la pared aunque él haya movido la forma después de abrirla. `openingId` es lo que
   * permite volver de un tramo a la fila donde vive cómo es esa puerta.
   */
  const porId = new Map(openings.map(o => [o.id, o]));
  const sobreElContorno = walls
    .filter(w => w.kind === 'door' && w.openingId)
    .map(w => ({ seg: { x1: w.seg[0], y1: w.seg[1], x2: w.seg[2], y2: w.seg[3] }, o: porId.get(w.openingId!) }))
    .filter((x): x is { seg: Segment; o: RoomOpening } => !!x.o);
  /**
   * ⚠️ Y LAS QUE NO CAYERON EN EL CONTORNO SE PINTAN IGUAL, donde él las puso.
   *
   * 🐞 Ésta era «*no pone las puertas*» (2026-09-07): `roomWalls` sólo se queda con los vanos cuyas dos
   * puntas rozan un lado, así que una puerta a un pelo de la pared se guardaba y **no se dibujaba**. Y la
   * salida NO es exigirle que exista un muro —corrección suya: «*en el constructor de habitaciones no
   * funciona así*»—, es dibujarla igual. Sobre el contorno abre el hueco de verdad; fuera de él es sólo
   * dibujo, que es exactamente lo que él pidió al ponerla ahí.
   */
  const enContorno = new Set(sobreElContorno.map(x => x.o.id));
  const puertas = [
    ...sobreElContorno,
    ...openings.filter(o => o.kind === 'door' && !enContorno.has(o.id))
      .map(o => ({ seg: { x1: o.x1, y1: o.y1, x2: o.x2, y2: o.y2 }, o })),
  ];
  /** La roca y el canto se dibujan también bajo los vanos CERRADOS: una puerta cerrada sigue siendo pared. */
  const carved = [solid, doorsClosed, windows].filter(Boolean).join(' ');

  return (
    <g className="mp-layer-rooms" data-testid="mp-rooms">
      <defs>
        <mask id={ids.rock} maskUnits="userSpaceOnUse" {...full}>
          <rect {...full} fill={MASK_SHOW} />
          {siluetas.map(c => <path key={c.id} d={c.d} fill={c.dig ? MASK_HIDE : MASK_SHOW} />)}
        </mask>
        <mask id={ids.hole} maskUnits="userSpaceOnUse" {...full}>
          <rect {...full} fill={MASK_HIDE} />
          {siluetas.map(c => <path key={c.id} d={c.d} fill={c.dig ? MASK_SHOW : MASK_HIDE} />)}
        </mask>
        {st.hatch && (
          /*
           * EL RAYADO. Su corrección del 2026-09-03 mirando el primer intento: «*todos los trazos de todos
           * los estilos son realmente rectos, ninguno parece a mano alzada*». No son líneas de tiralíneas —
           * son trazos CORTOS, GRUESOS y DESIGUALES apelotonados contra el muro. De ahí los tres largos
           * distintos dentro del mismo azulejo y el giro, en vez de un rayado paralelo perfecto.
           */
          <pattern id={ids.hatch} width={width * 0.9} height={width * 1.8} patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">
            <line x1={width * 0.15} y1={0} x2={width * 0.15} y2={width * 1.05} stroke={st.hatch} strokeWidth={Math.max(1, width * 0.16)} strokeLinecap="round" />
            <line x1={width * 0.45} y1={width * 0.5} x2={width * 0.45} y2={width * 1.5} stroke={st.hatch} strokeWidth={Math.max(1, width * 0.13)} strokeLinecap="round" />
            <line x1={width * 0.72} y1={width * 0.2} x2={width * 0.72} y2={width * 0.85} stroke={st.hatch} strokeWidth={Math.max(1, width * 0.18)} strokeLinecap="round" />
          </pattern>
        )}
        {/*
          * ── LAS TEXTURAS SE REPITEN, NO SE ESTIRAN ── (petición suya del 2026-09-04).
          * Un `<image>` estirado de borde a borde del mapa convertía una foto de mosaicos en un mosaico del
          * tamaño del mapa entero. Un patrón en coordenadas de ESCENA la repite, y el lado del azulejo sale
          * de la escala en casillas: así se ve igual con cualquier rejilla y a cualquier zoom.
          */}
        {scene.wallTextureUrl && (
          <pattern id={ids.rockTile} patternUnits="userSpaceOnUse" width={rockTile} height={rockTile}>
            <image href={scene.wallTextureUrl} x={0} y={0} width={rockTile} height={rockTile} preserveAspectRatio="xMidYMid slice" />
          </pattern>
        )}
        {capasPintadas.map((c, i) => c.url && (
          <pattern key={i} id={`${ids.floorTile}-${i}`} patternUnits="userSpaceOnUse" width={floorTile} height={floorTile}>
            <image href={c.url} x={0} y={0} width={floorTile} height={floorTile} preserveAspectRatio="xMidYMid slice" />
          </pattern>
        ))}
        <filter id={ids.blur} x="-20%" y="-20%" width="140%" height="140%" filterUnits="objectBoundingBox">
          <feGaussianBlur stdDeviation={shadow * 0.45} />
        </filter>
      </defs>

      {/* ── LA ROCA — todo lo que NO es sala ── */}
      <g mask={`url(#${ids.rock})`}>
        <rect {...full} fill={st.rock} data-testid="mp-room-rock" />
        {scene.wallTextureUrl && (
          <rect {...full} fill={`url(#${ids.rockTile})`} data-testid="mp-room-rock-img" />
        )}
      </g>

      {/*
        * ── EL MAPA, CAPA A CAPA Y EN ORDEN ──
        * Una sala pinta su suelo por su agujero; un muro vuelve a pintar roca encima. Lo último que él
        * dibujó es lo último que se pinta, así que manda — como en cualquier herramienta de dibujo.
        */}
      {capasPintadas.map((c, i) => {
        const maskId = `${ids.hole}-c${i}`;
        const floor = styleOf(c.preset);
        return (
          <g key={i} data-testid={c.rock ? 'mp-room-refill' : 'mp-room-floor'}>
            <defs>
              <mask id={maskId} maskUnits="userSpaceOnUse" {...full}>
                <rect {...full} fill={MASK_HIDE} />
                <path d={c.d} fill={MASK_SHOW} />
              </mask>
            </defs>
            <g mask={`url(#${maskId})`}>
              <rect {...full} fill={c.rock ? st.rock : floor.floor} />
              {c.rock && scene.wallTextureUrl && <rect {...full} fill={`url(#${ids.rockTile})`} />}
              {!c.rock && c.url && <rect {...full} fill={`url(#${ids.floorTile}-${i})`} data-testid="mp-room-floor-img" />}
            </g>
          </g>
        );
      })}

      {/*
        * ── LA BANDA Y EL RAYADO, PEGADOS AL MURO POR FUERA ──
        * Se trazan centrados en el contorno y se recortan contra la ROCA, así que sólo se ve la mitad de
        * fuera: por dentro está el suelo, y ahí el rayado no pinta nada. Es lo que distingue de un vistazo
        * un «rayado» de un «relleno» — la razón por la que él tumbó la primera rejilla de miniaturas.
        */}
      {carved && (st.band || st.hatch) && (
        <g mask={`url(#${ids.rock})`} fill="none" strokeLinecap="butt" strokeLinejoin="round">
          {st.band && <path d={carved} stroke={st.band} strokeWidth={width * 3.2} data-testid="mp-room-band" />}
          {st.hatch && <path d={carved} stroke={`url(#${ids.hatch})`} strokeWidth={width * 4.4} data-testid="mp-room-hatch" />}
        </g>
      )}

      {/*
        * ── LA SOMBRA HACIA ADENTRO ── «*desde las caras interiores de cada muro quiero una pequeña sombra
        * hacia adentro para darle efecto chulo*» (dueño, 2026-09-04).
        *
        * Recortada contra el AGUJERO, así que sólo cae sobre el suelo: por fuera está la roca y ahí no se
        * vería. Y como sigue el contorno de la UNIÓN, en un tabique que ha desaparecido NO HAY SOMBRA — que
        * es justo lo que hace que dos salas fundidas se lean como una sola.
        *
        * Es PINTURA y nada más: no tapa, no estorba, no entra en el cálculo de visión ni en el de las luces.
        */}
      {carved && (
        <g mask={`url(#${ids.hole})`}>
          <path d={carved} fill="none" stroke="var(--rm-shadow)" strokeWidth={shadow * 2} strokeLinecap="round"
            filter={`url(#${ids.blur})`} data-testid="mp-room-shadow" />
        </g>
      )}

      {/* ── EL MURO: el contorno de la unión, con su grosor. ES el mapa, y por eso SE VE, sin interruptor. ── */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {carved && <path d={carved} stroke={st.wall} strokeWidth={width} data-testid="mp-room-wall" />}
        {/* Una ventana: mismo hueco en la pared, con su travesaño. Deja ver y no deja pasar, como la de siempre. */}
        {windows && <path d={windows} className="mp-room-window" strokeWidth={width * 0.45} data-testid="mp-room-window" />}
        {/*
          * LA PUERTA DE UNA SALA SE PINTA EXACTAMENTE IGUAL QUE LA DE UN MURO SUELTO. Sin grosor propio, sin
          * trazo propio y sin trocitos de otro color: las mismas reglas y los mismos estilos.
          *
          * Orden suya del 2026-09-07 después de tres intentos míos de afinarlo aquí: «*¿por qué no pones las
          * puertas anchas como en el modo foto? y te pedí que dejes los trozos de pared al costado*». El modo
          * foto le vale tal cual, así que aquí no se inventa nada — `DoorLeaves` ya trae de serie el grosor
          * (`DOOR_BAR_PX`), el trazo de `.mp-door-leaf` y los dos trocitos de muro de `.mp-door-stub`.
          */}
        <g className="mp-room-doors" data-testid="mp-room-doors" strokeLinejoin="miter">
          {puertas.map(({ seg, o }) => (
            <g key={o.id} className={`mp-opening door ${o.isOpen ? 'open' : ''} ${o.id === selectedOpeningId ? 'selected' : ''}`} data-opening-id={o.id} data-open={o.isOpen ? 'true' : 'false'}>
              <DoorLeaves seg={seg} door={o} color={doorColorOf(o, scene)} texture={doorTextureOf(o, scene)} />
            </g>
          ))}
        </g>
      </g>
    </g>
  );
}

export const RoomsLayer = memo(RoomsLayerBase);
RoomsLayer.displayName = 'RoomsLayer';
