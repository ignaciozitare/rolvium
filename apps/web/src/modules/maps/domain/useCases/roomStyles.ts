import { orientRing, roomWalls, type BlockSegment, type RoomPart, type RoomRing, type RoomOpeningSpan, type RoomWall } from '@rolvium/core';
import type { Room, RoomOpening, RoomPreset, Scene } from '../entities/Scene';
import type { RoomSide } from './roomRules';

/**
 * LOS NUEVE PREAJUSTES DE MAZMORRA (`rolvium.pen` · frame `ePNCc` § «S/PREAJUSTES», aprobado por él).
 *
 * Un preajuste NO es una textura: es LA PAREJA DE TEXTURAS BASE DE GOLPE — la roca de la que está excavada la
 * mazmorra y el suelo que asoma por los agujeros. Rellena los dos huecos de la escena con un clic y no
 * bloquea nada: en cuanto él cambie una a mano, manda la suya.
 *
 * ⚠️ NINGÚN COLOR VIVE AQUÍ. Los nueve juegos están en `RolviumApp.css` (`--rm-*`), que es el único sitio
 * donde pueden vivir los valores concretos; esto sólo dice QUÉ variable usa cada preajuste y qué rasgos de
 * dibujo tiene. Así se retoca la paleta entera de la mazmorra sin abrir un solo componente.
 *
 * Los nombres son NUESTROS y en castellano (regla suya de no copiar la interfaz de la herramienta en la que
 * se basa); los rótulos viven en i18n, no aquí.
 */
export interface RoomStyle {
  key: RoomPreset;
  /** La roca: rellena TODO lo que no es sala. */
  rock: string;
  /** El suelo que se ve por el agujero. */
  floor: string;
  /** El canto del muro — el contorno de la unión, dibujado con grosor. */
  wall: string;
  /**
   * El RAYADO pegado al muro por fuera, si el estilo lo lleva. `null` = sin rayado.
   * Corrección suya del 2026-09-03: no son líneas de tiralíneas, son **trazos cortos, gruesos y desiguales**
   * apelotonados contra la pared. De ahí que el patrón lleve tres trazos de largos distintos y no uno.
   */
  hatch: string | null;
  /** La banda maciza justo por fuera del muro (los estilos «relleno» y «mapa antiguo»). `null` = sin banda. */
  band: string | null;
  /**
   * EL CONTORNO TIEMBLA. Sólo «Trazo a mano», que entró justo por esto: «*todos los trazos de todos los
   * estilos son realmente rectos, ninguno parece a mano alzada; al menos uno sí*» (dueño, 2026-09-03).
   */
  wobble: boolean;
}

const style = (key: RoomPreset, opts: { hatch?: boolean; band?: boolean; wobble?: boolean } = {}): RoomStyle => ({
  key,
  rock: `var(--rm-${key}-rock)`,
  floor: `var(--rm-${key}-floor)`,
  wall: `var(--rm-${key}-wall)`,
  hatch: opts.hatch ? `var(--rm-${key}-hatch)` : null,
  band: opts.band ? `var(--rm-${key}-band)` : null,
  wobble: opts.wobble ?? false,
});

/** En el orden del diseño: tres filas de tres. */
export const ROOM_STYLES: Record<RoomPreset, RoomStyle> = {
  hatch: style('hatch', { hatch: true }),
  module: style('module'),
  ancient: style('ancient', { band: true }),
  hatch_gray: style('hatch_gray', { hatch: true }),
  fill: style('fill', { hatch: true, band: true }),
  cavern: style('cavern'),
  hand: style('hand', { wobble: true }),
  simple: style('simple'),
  ink: style('ink'),
};

export const styleOf = (preset: RoomPreset): RoomStyle => ROOM_STYLES[preset] ?? ROOM_STYLES.hatch;

/**
 * LA ROCA Y EL SUELO QUE MANDAN EN ESTA ESCENA. El preajuste pone los dos; una foto suya, si la ha subido,
 * pisa al preajuste — que es exactamente lo que él pidió: el preajuste rellena, no bloquea.
 */
export interface SceneTextures { style: RoomStyle; rockUrl: string | null; floorUrl: string | null }
export const sceneTextures = (scene: Pick<Scene, 'roomPreset' | 'wallTextureUrl' | 'floorTextureUrl'>): SceneTextures => ({
  style: styleOf(scene.roomPreset),
  rockUrl: scene.wallTextureUrl,
  floorUrl: scene.floorTextureUrl,
});

/**
 * EL GROSOR DEL MURO EN PX. Se guarda en casillas y se pinta en px: así el muro se ve igual de grueso con la
 * rejilla en 15 que en 60, y no cambia de aspecto al acercar o alejar.
 */
export const wallWidthPx = (scene: Pick<Scene, 'wallThickness' | 'grid'>): number =>
  Math.max(2, (scene.wallThickness || 0.22) * scene.grid.size);

/**
 * LA SOMBRA HACIA ADENTRO, en px. «*Desde las caras interiores de cada muro quiero una pequeña sombra hacia
 * adentro para darle efecto chulo*» (dueño, 2026-09-04).
 *
 * Fija a un TERCIO DE CASILLA y no configurable (decisión mía, revisable): atada a la rejilla no cambia al
 * acercar o alejar, y un ajuste más en el panel no lo pidió nadie. Es PINTURA y nada más — no tapa, no
 * estorba, no entra en visión ni en luces.
 */
export const shadowDepthPx = (scene: Pick<Scene, 'grid'>): number => scene.grid.size / 3;

/**
 * EL LADO DE UN AZULEJO DE TEXTURA, EN PX (petición suya del 2026-09-04: «*necesito escalar la textura*»).
 *
 * 🔑 Una textura **se repite**, no se estira. Estirada de borde a borde del mapa —que es lo que hacía la
 * primera versión— una foto de mosaicos sale del tamaño del mapa entero, que es exactamente lo que él vio.
 * Se guarda en CASILLAS y se pinta en px, como el grosor del muro: así «dos casillas por azulejo» se ve igual
 * con la rejilla en 15 que en 60, y no cambia al acercar o alejar.
 */
export const tilePx = (cells: number, grid: number): number => Math.max(4, (cells || DEFAULT_TEXTURE_SCALE) * grid);

/** Un azulejo grande, que es lo que menos sorprende al subir una foto cualquiera. Espejo de la migración. */
export const DEFAULT_TEXTURE_SCALE = 4;

/**
 * EL SUELO QUE LE TOCA A UNA SALA. `floorUrl` a `null` no es «sin suelo»: es «esta sala no tiene uno PROPIO
 * todavía», y entonces manda el del mapa.
 *
 * 🐞 Aquí estaba su fallo del 2026-09-04: «*si no selecciono la textura del piso en el momento cero no la
 * carga*». Las salas dibujadas antes de subir la textura se quedaban con el color del preajuste para siempre,
 * porque el suelo se resolvía SÓLO contra lo congelado en la fila. El suelo propio llegará con el pincel de
 * la tanda siguiente; hasta entonces la textura del mapa vale para todas.
 */
export const floorUrlOf = (room: Pick<Room, 'floorUrl'>, scene: Pick<Scene, 'floorTextureUrl'>): string | null =>
  room.floorUrl ?? scene.floorTextureUrl;

/**
 * UN MURO DE RELLENO NO SE DIBUJA COMO FORMA: lo que se ve de él es el AGUJERO que deja en el suelo, y de eso
 * ya se encarga la máscara —su anillo se resta del hueco— más su contorno, que sale del motor como cualquier
 * otra pared. No hay nada que pintar aparte: si se pintara, se vería una mancha de roca con borde propio
 * flotando encima del mapa en vez de formar parte de él.
 */

// ── De las filas a la geometría ─────────────────────────────────────────────

/**
 * El anillo de una sala guardada, como lo quiere el motor de unión — Y SIEMPRE DANDO LA VUELTA AL MISMO LADO.
 *
 * 🔑 Enderezarlo aquí NO es cosmética, es lo que impide que se vea una cosa y tape otra. La máscara que abre
 * los agujeros en la roca mete todas las formas en un mismo camino SVG, y la regla de relleno de SVG cuenta
 * vueltas: dos anillos recorridos al revés se ANULAN donde se solapan, y ahí reaparecía un islote de roca
 * DENTRO de la habitación fundida. Un rectángulo y un círculo salen siempre bien orientados de `roomRules`,
 * pero un polígono y un trazo a pulso salen como él los haya dibujado — y basta con rodear una sala en el
 * sentido contrario para que pase.
 *
 * Se usa `orientRing` de `@rolvium/core`, el MISMO que endereza los anillos dentro de `roomOutline`, para que
 * el dibujo y el cálculo no puedan discrepar. `roomWalls` vuelve a enderezar por su cuenta: es idempotente.
 */
export const ringOf = (room: Pick<Room, 'points'>): RoomRing => orientRing(room.points.map(([x, y]) => ({ x, y })));
export const ringsOf = (rooms: readonly Room[]): RoomRing[] => rooms.map(ringOf);

/** Las que EXCAVAN. Son las que abren hueco y las únicas que llevan suelo: un muro no tiene suelo. */
export const dugRooms = (rooms: readonly Room[]): Room[] => rooms.filter(r => r.kind !== 'fill');
/** Las que RELLENAN: devuelven roca al hueco (un tabique, un pilar, corregir un borde). */
export const filledRooms = (rooms: readonly Room[]): Room[] => rooms.filter(r => r.kind === 'fill');

/**
 * Las formas del mapa **en el orden en que él las dibujó**, que es el que decide quién manda: la lista llega
 * de la base ordenada por `created_at` y aquí sólo se le pone el signo a cada una.
 */
export const partsOf = (rooms: readonly Room[]): RoomPart[] =>
  rooms.map(r => ({ ring: ringOf(r), dig: r.kind !== 'fill' }));

/**
 * Los lados que devuelve el motor de formas, convertidos en el anillo que se guarda. Los lados ya vienen en
 * orden dando la vuelta (lo garantizan `rectSides`, `circleSides`, `ringSides`), así que el anillo es la
 * primera punta de cada uno — cerrar es cosa de quien lo lea.
 */
export const ringFromSides = (sides: readonly RoomSide[]): [number, number][] => sides.map(s => [s.x1, s.y1]);

/** Los vanos guardados, como los quiere el motor. */
export const spansOf = (openings: readonly RoomOpening[]): RoomOpeningSpan[] =>
  openings.map(o => ({ x1: o.x1, y1: o.y1, x2: o.x2, y2: o.y2, kind: o.kind, isOpen: o.isOpen }));

/**
 * EL CONTORNO DE LAS SALAS DE ESTA ESCENA, CALCULADO UNA SOLA VEZ.
 *
 * Lo piden dos sitios a la vez y por motivos distintos: el LIENZO, para pintar el muro; y el FRENO del
 * arrastre, para saber contra qué choca una ficha. Fundir las formas cuesta comparar cada lado con todos los
 * demás —medido: ~21 ms con 60 salas— así que hacerlo dos veces por pintada sería pagarlo dos veces.
 *
 * La caché es de UNA entrada y va por identidad de las listas: en cuanto React entrega otras —porque una sala
 * cambió— se recalcula. No hay nada que invalidar a mano ni forma de que se quede vieja.
 */
let cacheSalas: { rooms: unknown; openings: unknown; walls: RoomWall[] } | null = null;
export function roomWallsOf(rooms: readonly Room[], openings: readonly RoomOpening[]): RoomWall[] {
  if (cacheSalas && cacheSalas.rooms === rooms && cacheSalas.openings === openings) return cacheSalas.walls;
  const walls = roomWalls(partsOf(rooms), spansOf(openings));
  cacheSalas = { rooms, openings, walls };
  return walls;
}

// ── Los caminos SVG ─────────────────────────────────────────────────────────

/** Un anillo, como camino SVG cerrado. Es la forma del AGUJERO que la sala abre en la roca. */
export const ringPath = (ring: RoomRing): string =>
  ring.length < 3 ? '' : `M ${ring.map(p => `${p.x} ${p.y}`).join(' L ')} Z`;

export const ringsPath = (rings: readonly RoomRing[]): string => rings.map(ringPath).filter(Boolean).join(' ');

/**
 * UN NÚMERO AL AZAR QUE SIEMPRE ES EL MISMO. El temblor del trazo a mano tiene que ser idéntico en cada
 * pintada: si cambiara, la pared vibraría sola cada vez que el mapa se repinta —y se repinta varias veces por
 * segundo mientras alguien arrastra una ficha—. Sale de las coordenadas, así que la misma pared tiembla
 * siempre igual y dos paredes distintas tiemblan distinto.
 */
function jitter(x: number, y: number, amount: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return (n - Math.floor(n) - 0.5) * 2 * amount;
}

/**
 * EL CONTORNO, COMO CAMINO. Con `wobble` cada punta se desplaza un pelín y el tramo se parte por la mitad con
 * otro tanto, que es lo que convierte una recta en un trazo de pulso sin dejar de ser la misma pared: la
 * geometría que calcula la visión NO se toca, sólo el dibujo.
 */
export function outlinePath(segments: readonly BlockSegment[], wobble = false, amount = 0): string {
  if (wobble && amount > 0) {
    return segments.map(([x1, y1, x2, y2]) => {
      const mx = (x1 + x2) / 2 + jitter(x1 + x2, y1 - y2, amount);
      const my = (y1 + y2) / 2 + jitter(y1 - y2, x1 + x2, amount);
      return `M ${x1 + jitter(x1, y1, amount)} ${y1 + jitter(y1, x1, amount)} Q ${mx} ${my} ${x2 + jitter(x2, y2, amount)} ${y2 + jitter(y2, x2, amount)}`;
    }).join(' ');
  }
  return segments.map(([x1, y1, x2, y2]) => `M ${x1} ${y1} L ${x2} ${y2}`).join(' ');
}
