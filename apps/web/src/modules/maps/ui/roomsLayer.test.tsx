import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as core from '@rolvium/core';
import { DEFAULT_DOOR } from '../domain/entities/Scene';
import type { Room, RoomOpening, Scene } from '../domain/entities/Scene';
import * as styles from '../domain/useCases/roomStyles';
import { RoomsLayer, roomMaskIds } from './roomsLayer';
import { DOOR_BAR_PX } from '../domain/useCases/mapRules';

/**
 * LO QUE SE PINTA CUANDO SE LEVANTA UNA SALA (§ «Cómo se levanta una sala»).
 *
 * El invariante que sujetan estos tests, y que si se rompe lo rompe TODO: **el suelo no se pone encima, se ve
 * por el AGUJERO**. La roca cubre la escena entera y cada sala abre un hueco. Pintado al revés se verían
 * alfombras flotando en el vacío en vez de una mazmorra.
 */

const SCENE: Scene = {
  id: 'sc-1', campaignId: 'c1', name: 'Cripta', width: 600, height: 400, bgColor: '#111111', bgImageUrl: null,
  bgTransform: { mode: 'cover', x: 0, y: 0, scale: 1 }, grid: { size: 30, visible: true }, fogMode: 'vision',
  lighting: 'day', nightRadiusM: 10, solidWalls: false, sortOrder: 0, visiblePlayers: false, doorColor: null, doorTextureUrl: null, tokenScale: 1,
  brushTip: 'soft', brushSize: 1.2, brushStrength: 0.6, brushHardness: 0.4, brushRoughness: 0.5,
  roomPreset: 'hatch', wallTextureUrl: null, floorTextureUrl: null, wallThickness: 0.22, wallTextureScale: 4, floorTextureScale: 4,
  createdAt: '', updatedAt: '',
};

const room = (id: string, x1: number, y1: number, x2: number, y2: number, over: Partial<Room> = {}): Room => ({
  id, sceneId: 'sc-1', campaignId: 'c1', kind: 'room', shape: 'rect',
  points: [[x1, y1], [x2, y1], [x2, y2], [x1, y2]],
  floorPreset: 'hatch', floorUrl: null, floorMaskUrl: null, createdAt: '2026-09-04T10:00:00Z', updatedAt: '', ...over,
});

const mount = (rooms: Room[], openings: RoomOpening[] = [], scene: Scene = SCENE, floorPreview: { roomId: string; href: string | null } | null = null) =>
  render(<svg><RoomsLayer scene={scene} rooms={rooms} openings={openings} ids={roomMaskIds(scene.id)} floorPreview={floorPreview} /></svg>);

describe('<RoomsLayer> — la roca, el agujero y el muro', () => {
  it('sin salas no pinta NADA: una escena de siempre no cambia ni un píxel', () => {
    mount([]);
    expect(screen.queryByTestId('mp-rooms')).not.toBeInTheDocument();
  });

  it('pinta la roca en toda la escena, el suelo por el agujero y el muro del contorno', () => {
    mount([room('r1', 60, 60, 300, 300)]);
    const rock = screen.getByTestId('mp-room-rock');
    // La roca cubre la escena ENTERA: es lo que se agujerea, no lo que se dibuja alrededor de la sala.
    expect(rock).toHaveAttribute('width', '600');
    expect(rock).toHaveAttribute('height', '400');
    expect(screen.getByTestId('mp-room-floor')).toBeInTheDocument();
    expect(screen.getByTestId('mp-room-wall')).toBeInTheDocument();
    expect(screen.getByTestId('mp-room-shadow')).toBeInTheDocument();
    /**
     * ⚡ Y SIGUE SIENDO UN DESENFOQUE DE VERDAD. Esta capa se envolvió en `memo` el 2026-09-07 porque el
     * `filter` del navegador se estaba rasterizando en cada fotograma del arrastre («*la sombra dinámica en
     * local va lentísima*»), y él avisó: «*ojo con romper la sombra*». Esto es el guardián: si alguien
     * arregla el rendimiento quitándole el desenfoque, o dejándola fuera de la máscara del agujero, salta.
     */
    const sombra = screen.getByTestId('mp-room-shadow');
    expect(sombra.getAttribute('filter')).toMatch(/^url\(#mp-room-blur-/);
    expect(Number(sombra.getAttribute('stroke-width'))).toBeGreaterThan(0);
    expect(sombra.closest('g')!.getAttribute('mask')).toMatch(/^url\(#/);
  });

  /**
   * Las dos máscaras son el mecanismo entero. Con un relleno par-impar, dos salas SOLAPADAS se volverían roca
   * justo donde se cruzan — el revés exacto de lo que él pidió.
   */
  it('el agujero es una MÁSCARA, y la rejilla puede pedirla por su id', () => {
    const { container } = mount([room('r1', 60, 60, 300, 300)]);
    const ids = roomMaskIds('sc-1');
    expect(container.querySelector(`#${ids.rock}`)).not.toBeNull();
    expect(container.querySelector(`#${ids.hole}`)).not.toBeNull();
  });

  it('DOS SALAS PEGADAS: el muro compartido no se dibuja — se leen como una sola', () => {
    const { container } = mount([room('r1', 60, 60, 300, 300), room('r2', 300, 60, 540, 300)]);
    const d = screen.getByTestId('mp-room-wall').getAttribute('d') ?? '';
    // El tabique en x = 300 no está en el camino del muro; el contorno de fuera, sí.
    expect(d).not.toMatch(/M 300 60 L 300 300|M 300 300 L 300 60/);
    expect(d).toContain('60 60');
    expect(container.querySelectorAll('[data-testid="mp-room-floor"]')).toHaveLength(1);
  });

  it('una sala con OTRO suelo se pinta en su propio grupo: cada una se quedó con el suyo', () => {
    mount([room('r1', 60, 60, 300, 300), room('r2', 330, 60, 540, 300, { floorPreset: 'ink' })]);
    expect(screen.getAllByTestId('mp-room-floor')).toHaveLength(2);
  });

  /**
   * Cada suelo tiene que ir por su propia máscara. La clave del grupo lleva dentro la URL de una foto suya, y
   * un id de SVG no admite casi ningún carácter: limpiándola, dos fotos distintas podían quedar con el mismo
   * id y las dos salas acababan pintándose con el suelo de la otra.
   */
  it('dos suelos con fotos que se parecen NO comparten máscara', () => {
    const { container } = mount([
      room('r1', 60, 60, 300, 300, { floorUrl: 'https://x/roca.1.png' }),
      room('r2', 330, 60, 540, 300, { floorUrl: 'https://x/roca1.png' }),
    ]);
    const grupos = screen.getAllByTestId('mp-room-floor');
    expect(grupos).toHaveLength(2);
    const ids = grupos.map(g => g.querySelector('mask')?.getAttribute('id'));
    expect(new Set(ids).size).toBe(2);
    expect(ids.every(Boolean)).toBe(true);
    // Y cada grupo pinta SU foto, no la del vecino. Las texturas van por PATRÓN, porque se repiten en
    // azulejos en vez de estirarse (su petición del 2026-09-04): la foto vive dentro del patrón.
    expect([...container.querySelectorAll('pattern image')].map(i => i.getAttribute('href')))
      // En el ORDEN EN QUE ÉL LAS DIBUJÓ: la última pintada es la que manda, como en cualquier herramienta
      // de dibujo. (Antes se pintaban del revés para que mandase la más vieja; su corrección del 2026-09-04
      // sobre los muros —«cuando pinto una sala nueva no lo afecta»— tumbó esa regla, y con razón.)
      .toEqual(['https://x/roca.1.png', 'https://x/roca1.png']);
  });

  it('el rayado y la banda sólo aparecen en los estilos que los llevan', () => {
    mount([room('r1', 60, 60, 300, 300)]);                                   // «Rayado clásico»
    expect(screen.getByTestId('mp-room-hatch')).toBeInTheDocument();
    expect(screen.queryByTestId('mp-room-band')).not.toBeInTheDocument();
    mount([room('r1', 60, 60, 300, 300)], [], { ...SCENE, roomPreset: 'simple' });
    expect(screen.queryAllByTestId('mp-room-hatch')).toHaveLength(1);        // sólo el del primer montaje
  });

  it('una foto suya para la roca se pinta encima del color del preajuste', () => {
    const { container } = mount([room('r1', 60, 60, 300, 300)], [], { ...SCENE, wallTextureUrl: 'https://x/roca.png' });
    expect(screen.getByTestId('mp-room-rock-img')).toBeInTheDocument();
    expect(container.querySelector('pattern image')).toHaveAttribute('href', 'https://x/roca.png');
  });
});

/**
 * ── LAS TEXTURAS SE REPITEN Y SE ESCALAN ──
 *
 * Su fallo del 2026-09-04 probando el constructor: «*tengo una textura de mosaicos que quedan muy grandes*».
 * La textura se pintaba como UNA COPIA ESTIRADA de borde a borde del mapa, que es lo correcto para una foto
 * de fondo y lo peor posible para un azulejo: un mosaico de 40 px salía del tamaño del mapa entero.
 */
describe('<RoomsLayer> las texturas son azulejos que se repiten', () => {
  it('la roca se pinta con un PATRÓN del tamaño que diga la escala, no con una copia estirada', () => {
    const { container } = mount([room('r1', 60, 60, 300, 300)], [],
      { ...SCENE, wallTextureUrl: 'https://x/roca.png', wallTextureScale: 2 });
    const pat = container.querySelector(`[id="${roomMaskIds('sc-1').rockTile}"]`)!;
    // 2 casillas de 30 px = un azulejo de 60 px, en coordenadas de ESCENA (no del zoom ni de la pantalla).
    expect(pat).toHaveAttribute('width', '60');
    expect(pat).toHaveAttribute('height', '60');
    expect(pat).toHaveAttribute('patternUnits', 'userSpaceOnUse');
  });

  it('cambiar la escala cambia el azulejo, y la rejilla no importa: van en CASILLAS', () => {
    const grande = mount([room('r1', 60, 60, 300, 300)], [],
      { ...SCENE, wallTextureUrl: 'https://x/roca.png', wallTextureScale: 8 });
    const roca = (c: HTMLElement) => c.querySelector(`[id="${roomMaskIds('sc-1').rockTile}"]`);
    expect(roca(grande.container)).toHaveAttribute('width', '240');
    const otraRejilla = mount([room('r1', 60, 60, 300, 300)], [],
      { ...SCENE, grid: { size: 60, visible: true }, wallTextureUrl: 'https://x/roca.png', wallTextureScale: 2 });
    // Misma escala en casillas, rejilla del doble → azulejo del doble. Se ve igual de grande en el mapa.
    expect(roca(otraRejilla.container)).toHaveAttribute('width', '120');
  });

  /**
   * 🐞 SU FALLO: «*si no selecciono la textura del piso en el momento cero no la carga*».
   *
   * Una sala sin suelo PROPIO usa el del mapa. Antes se resolvía sólo contra lo congelado en la fila, así que
   * las salas dibujadas antes de subir la textura se quedaban con el color del preajuste para siempre.
   */
  it('una sala dibujada ANTES de subir la textura la coge igual', () => {
    const { container } = mount([room('r1', 60, 60, 300, 300, { floorUrl: null })], [],
      { ...SCENE, floorTextureUrl: 'https://x/mosaico.png' });
    expect(screen.getByTestId('mp-room-floor-img')).toBeInTheDocument();
    expect(container.querySelector(`[id^="${roomMaskIds('sc-1').floorTile}"] image`)).toHaveAttribute('href', 'https://x/mosaico.png');
  });

  it('pero una sala CON suelo propio se queda con el suyo', () => {
    const { container } = mount([room('r1', 60, 60, 300, 300, { floorUrl: 'https://x/suyo.png' })], [],
      { ...SCENE, floorTextureUrl: 'https://x/mosaico.png' });
    expect(container.querySelector(`[id^="${roomMaskIds('sc-1').floorTile}"] image`)).toHaveAttribute('href', 'https://x/suyo.png');
  });
});

describe('<RoomsLayer> resto', () => {

  /**
   * 🐞 DOS SALAS DIBUJADAS EN SENTIDOS CONTRARIOS SE SIGUEN FUNDIENDO EN EL DIBUJO.
   *
   * Un rectángulo y un círculo salen siempre bien orientados del motor de formas, pero un POLÍGONO y un
   * TRAZO A PULSO salen como él haya movido la mano: rodear la segunda sala al revés basta.
   *
   * Y la máscara mete todas las formas en un mismo camino SVG, cuya regla de relleno cuenta vueltas: dos
   * anillos al revés se ANULAN donde se solapan. Sin enderezarlos, en la mitad compartida reaparecía un
   * islote de ROCA dentro de la habitación fundida — se veía de una forma y tapaba de otra, que es justo lo
   * que el motor único viene a evitar.
   */
  it('un polígono rodeado al revés se funde igual: nada de roca dentro de lo fundido', () => {
    const derecho = room('r1', 60, 60, 300, 300);
    const alRevés: Room = {
      ...room('r2', 180, 180, 420, 420),
      shape: 'poly',
      points: [...room('r2', 180, 180, 420, 420).points].reverse(),
    };
    const { container } = mount([derecho, alRevés]);
    // Cada forma se pinta en SU capa, para que el orden de dibujo mande; lo que se comprueba aquí es que las
    // dos van enderezadas al mismo lado, que es lo que impide que se anulen donde se cruzan.
    const capas = [...container.querySelectorAll(`#${roomMaskIds('sc-1').hole} path`)];
    const anillos = capas.map(c => vuelta((c.getAttribute('d') ?? '').replace('M ', '')));
    expect(anillos).toHaveLength(2);
    expect(new Set(anillos.map(Math.sign)).size).toBe(1);
    // Y el tabique interior tampoco se dibuja como muro: se leen como una sola habitación.
    expect(screen.getByTestId('mp-room-wall').getAttribute('d') ?? '').not.toMatch(/M 300 180 L 300 300/);
  });
});

/** Hacia qué lado da la vuelta un anillo escrito como camino SVG. El SIGNO es lo único que importa. */
function vuelta(sub: string): number {
  const n = sub.replace('Z', '').trim().split(/\s*L\s*|\s+/).map(Number).filter(v => !Number.isNaN(v));
  let t = 0;
  for (let i = 0; i < n.length; i += 2) {
    const x1 = n[i]!, y1 = n[i + 1]!, x2 = n[(i + 2) % n.length]!, y2 = n[(i + 3) % n.length]!;
    t += x1 * y2 - x2 * y1;
  }
  return t / 2;
}

describe('<RoomsLayer> — los vanos, anotados sobre el contorno', () => {
  const opening = (over: Partial<RoomOpening> = {}): RoomOpening => ({
    id: 'o1', sceneId: 'sc-1', campaignId: 'c1', x1: 300, y1: 150, x2: 300, y2: 210, kind: 'door', isOpen: false, ...DEFAULT_DOOR, ...over,
  });

  /** El vano cae sobre el lado derecho de la sala (x = 300), de y 150 a y 210. */
  const hoja = (i = 0) => screen.getByTestId('mp-room-doors').querySelector(`[data-opening-id="o1"] [data-leaf="${i}"]`);
  /** Las esquinas de una hoja, como pares `[x, y]` — en tuplas para que indexarlas siga siendo un número. */
  const puntos = (el: Element): [number, number][] =>
    el.getAttribute('points')!.split(' ').map(p => { const [x, y] = p.split(',').map(Number); return [x!, y!]; });

  it('una puerta CERRADA se dibuja como la barra hueca, tumbada en el hueco, y sigue siendo pared', () => {
    mount([room('r1', 60, 60, 300, 300)], [opening()]);
    const q = hoja()!;
    expect(q).toBeInTheDocument();
    expect(screen.getByTestId('mp-room-doors').querySelector('[data-opening-id="o1"]')!.getAttribute('data-open')).toBe('false');
    /**
     * Cerrada la barra va A LO LARGO del muro, pero SIN pegarse a él: deja un trocito de muro a cada lado
     * (suyo, 2026-09-07). Así que cae DENTRO del vano (150→210), no de punta a punta.
     */
    const ys = q.getAttribute('points')!.split(' ').map(p => Number(p.split(',')[1]));
    expect(Math.min(...ys)).toBeGreaterThan(150);
    expect(Math.max(...ys)).toBeLessThan(210);
    // Y los dos trocitos están pintados, uno por lado.
    expect(screen.getByTestId('mp-room-doors').querySelectorAll('[data-opening-id="o1"] .mp-door-stub')).toHaveLength(2);
    // Una hoja: un solo polígono.
    expect(hoja(1)).toBeNull();
  });

  /**
   * LA DE SALA SE PINTA IGUAL QUE LA DE UN MURO SUELTO, y este test está para que nadie vuelva a afinarla
   * sólo aquí. Se probaron tres variantes propias —a lo ancho de la roca, a dos tercios, y con el trazo
   * encogido— y él las tumbó las tres mirándolas: «*¿por qué no pones las puertas anchas como en el modo
   * foto? y te pedí que dejes los trozos de pared al costado*» (2026-09-07). El modo foto le vale tal cual.
   */
  const anchoHoja = (): number => { const xs = puntos(hoja()!).map(([x]) => x); return Math.max(...xs) - Math.min(...xs); };

  it('la hoja va al ancho del modo foto, no a uno propio de las salas', () => {
    mount([room('r1', 60, 60, 300, 300)], [opening()]);
    expect(anchoHoja()).toBeCloseTo(DOOR_BAR_PX, 1);
  });

  it('los dos trocitos de pared de los costados se pintan, y con el mismo estilo que en un muro suelto', () => {
    mount([room('r1', 60, 60, 300, 300)], [opening()]);
    const trocitos = screen.getByTestId('mp-room-doors').querySelectorAll<SVGElement>('[data-opening-id="o1"] .mp-door-stub');
    expect(trocitos).toHaveLength(2);
    // Sin estilo propio encima: mandan `.mp-door-stub` y `.mp-door-leaf`, que son los del modo foto.
    expect(trocitos[0]!.getAttribute('style')).toBeNull();
    expect(hoja()!.getAttribute('style')).toBeNull();
  });

  it('abierta, la hoja gira 90° desde su bisagra y ahí ya no hay muro', () => {
    mount([room('r1', 60, 60, 300, 300)], [opening({ isOpen: true })]);
    const q = hoja()!;
    expect(screen.getByTestId('mp-room-doors').querySelector('[data-opening-id="o1"]')!.getAttribute('data-open')).toBe('true');
    // Girada, la hoja ya NO recorre el vano: arranca en la bisagra (y = 150) y se sale del muro en x.
    const pts = puntos(q);
    expect(Math.max(...pts.map(p => p[1]))).toBeLessThan(210);
    // Sale perpendicular lo que mide la hoja: el vano (60) menos los dos trocitos de muro, así que menos.
    const ancho = Math.max(...pts.map(p => p[0])) - Math.min(...pts.map(p => p[0]));
    expect(ancho).toBeGreaterThan(0);
    expect(ancho).toBeLessThan(60);
    // El tramo del vano no está en el camino de la roca: por ahí se pasa y se ve.
    expect(screen.getByTestId('mp-room-wall').getAttribute('d') ?? '').not.toContain('M 300 150 L 300 210');
  });

  it('DOS hojas se parten por la mitad, y abiertas giran las dos', () => {
    mount([room('r1', 60, 60, 300, 300)], [opening({ leaves: 2 })]);
    const largo = (i: number) => {
      const pts = puntos(hoja(i)!);
      return Math.max(...pts.map(p => p[1])) - Math.min(...pts.map(p => p[1]));
    };
    // Media hoja cada una: lo que mide la puerta (el vano menos los dos trocitos), partido por dos.
    expect(largo(0)).toBeCloseTo(largo(1), 1);
    expect(largo(0)).toBeGreaterThan(0);
    expect(largo(0) + largo(1)).toBeLessThan(60);
  });

  it('el color propio de la puerta manda sobre el de la escena, y RELLENA', () => {
    mount([room('r1', 60, 60, 300, 300)], [opening({ doorColor: '#8b1a1a' })]);
    const estilo = hoja()!.getAttribute('style')!;
    expect(estilo).toContain('8b1a1a');
    expect(estilo).toContain('fill');
  });

  it('una puerta de sala también acepta textura, y la textura manda sobre el color', () => {
    mount([room('r1', 60, 60, 300, 300)], [opening({ doorColor: '#8b1a1a', doorTextureUrl: 'https://x/roble.png' })]);
    expect(hoja()!.getAttribute('style')).toContain('url(#');
    expect(hoja()!.getAttribute('data-textured')).toBe('true');
  });

  it('una ventana lleva su travesaño', () => {
    mount([room('r1', 60, 60, 300, 300)], [opening({ kind: 'window' })]);
    expect(screen.getByTestId('mp-room-window')).toBeInTheDocument();
  });

  /**
   * ⚠️ Y LA QUE NO CAYÓ EN EL CONTORNO SE PINTA IGUAL, DONDE ÉL LA PUSO.
   *
   * 🐞 Ésta era «*no pone las puertas*» (2026-09-07): `roomWalls` sólo anota los vanos cuyas DOS puntas
   * rozan un lado del contorno, así que una puerta puesta a mano a un pelo de la pared se guardaba y **no
   * se dibujaba**. Y la salida NO es exigirle que exista un muro —corrección suya: «*en el constructor de
   * habitaciones no funciona así*»—, es dibujarla igual.
   *
   * Estos tres tests son el pin: sin la rama de `roomsLayer` la primera no aparece, y sin el `Set` de las
   * que sí cayeron en el contorno la tercera saldría pintada dos veces.
   */
  /** En mitad del suelo de la sala (60,60)-(300,300): no roza ningún lado. */
  const suelta = (over: Partial<RoomOpening> = {}): RoomOpening =>
    opening({ id: 'o2', x1: 150, y1: 150, x2: 210, y2: 150, ...over });
  const vano = (id: string) => screen.getByTestId('mp-room-doors').querySelectorAll(`[data-opening-id="${id}"]`);

  it('una puerta que NO cae en el contorno se dibuja igual, y donde él la puso', () => {
    mount([room('r1', 60, 60, 300, 300)], [suelta()]);
    expect(vano('o2')).toHaveLength(1);
    const q = screen.getByTestId('mp-room-doors').querySelector('[data-opening-id="o2"] [data-leaf="0"]')!;
    // Su sitio es el suyo, no el de ninguna pared: la barra va a lo largo del trazo (x 150→210) y su
    // grosor cae en perpendicular, repartido a los dos lados de y = 150.
    const pts = q.getAttribute('points')!.split(' ').map(p => p.split(',').map(Number) as [number, number]);
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    expect(Math.min(...xs)).toBeGreaterThan(150);
    expect(Math.max(...xs)).toBeLessThan(210);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(DOOR_BAR_PX, 1);
    // Y con sus dos trocitos de muro, exactamente igual que una que sí cayó en el contorno.
    expect(screen.getByTestId('mp-room-doors').querySelectorAll('[data-opening-id="o2"] .mp-door-stub')).toHaveLength(2);
  });

  it('la que sí cae en el contorno se pinta UNA vez, no dos', () => {
    mount([room('r1', 60, 60, 300, 300)], [opening()]);
    expect(vano('o1')).toHaveLength(1);
  });

  it('una VENTANA fuera del contorno no se dibuja: el repesque es sólo de puertas', () => {
    mount([room('r1', 60, 60, 300, 300)], [suelta({ kind: 'window' })]);
    expect(vano('o2')).toHaveLength(0);
  });
});

/**
 * ⏱ EL CONTORNO SE CALCULA UNA VEZ POR CAMBIO, NO UNA VEZ POR PINTADA.
 *
 * Este test existe por un número medido: fundir 60 salas cuesta ~21 ms, y el lienzo se repinta muchas veces
 * por segundo —cada refresco de niebla, cada tirón de una ficha—. Sin memorizar, eso es la queja de «está
 * todo lentísimo» esperando a repetirse, y es un fallo que NO se ve en una escena de prueba con dos salas:
 * sólo aparece cuando el mapa ya está montado y él está jugando.
 */
describe('<RoomsLayer> el motor no se dispara en cada pintada', () => {
  it('repintar sin tocar las salas NO vuelve a fundirlas; cambiarlas, sí', () => {
    const spy = vi.spyOn(core, 'roomWalls');
    const rooms = [room('r1', 60, 60, 300, 300)];
    const openings: RoomOpening[] = [];
    const view = render(<svg><RoomsLayer scene={SCENE} rooms={rooms} openings={openings} ids={roomMaskIds('sc-1')} /></svg>);
    const tras = spy.mock.calls.length;
    expect(tras).toBeGreaterThan(0);

    // Mismas salas, otra pintada (aquí cambia la escena, que es lo que pasa al mover la niebla).
    view.rerender(<svg><RoomsLayer scene={{ ...SCENE }} rooms={rooms} openings={openings} ids={roomMaskIds('sc-1')} /></svg>);
    expect(spy.mock.calls).toHaveLength(tras);

    // Y una sala nueva sí obliga a recalcular: si no, la pared no aparecería.
    view.rerender(<svg><RoomsLayer scene={SCENE} rooms={[...rooms, room('r2', 400, 60, 560, 300)]} openings={openings} ids={roomMaskIds('sc-1')} /></svg>);
    expect(spy.mock.calls.length).toBeGreaterThan(tras);
    spy.mockRestore();
  });
});

/**
 * ── LOS MUROS SON RELLENO ──
 *
 * Suyo, 2026-09-04: «*hoy tomamos como que las habitaciones son huecos en el muro, entonces los muros serán
 * relleno de esos huecos*». En el dibujo eso son dos capas de pintura sobre la misma máscara: la sala en
 * blanco, el muro en negro encima. La resta sale exacta se solapen como se solapen.
 */
describe('<RoomsLayer> un muro devuelve roca al hueco', () => {
  const fill = (id: string, x1: number, y1: number, x2: number, y2: number): Room =>
    ({ ...room(id, x1, y1, x2, y2), kind: 'fill' });

  it('el relleno se resta del hueco en las dos máscaras', () => {
    const { container } = mount([room('r1', 60, 60, 300, 300), fill('f1', 120, 120, 180, 180)]);
    const ids = roomMaskIds('sc-1');
    const hueco = container.querySelector(`[id="${ids.hole}"]`)!;
    // Dentro del hueco: primero la sala en blanco, después el muro en NEGRO — el orden ES la resta.
    const rellenos = [...hueco.querySelectorAll('path')].map(p => p.getAttribute('fill'));
    expect(rellenos).toEqual(['#ffffff', '#000000']);
    // Y en la roca, al revés: el muro vuelve a ser roca.
    const roca = container.querySelector(`[id="${ids.rock}"]`)!;
    expect([...roca.querySelectorAll('path')].map(p => p.getAttribute('fill'))).toEqual(['#000000', '#ffffff']);
  });

  it('el muro aporta su contorno: la pared que deja alrededor se dibuja', () => {
    mount([room('r1', 60, 60, 300, 300), fill('f1', 120, 120, 180, 180)]);
    const d = screen.getByTestId('mp-room-wall').getAttribute('d') ?? '';
    // Los cuatro lados del pilar son pared: vacío por fuera, roca por dentro.
    expect(d).toContain('M 120 120 L 180 120');
    expect(d).toContain('M 180 180 L 120 180');
    // Y el contorno de la sala sigue estando.
    expect(d).toContain('60 60');
  });

  it('una escena que SÓLO tiene muros no pinta nada: sin excavar no hay mapa', () => {
    mount([fill('f1', 60, 60, 300, 300)]);
    expect(screen.queryByTestId('mp-rooms')).not.toBeInTheDocument();
  });
});

/**
 * 🐞 EL FALLO QUE ÉL CAZÓ EL 2026-09-04: «*el muro nuevo funciona como otro muro distinto del anterior,
 * cuando pinto una sala nueva no lo afecta*».
 *
 * El CONTORNO ya respetaba el orden, pero el SUELO no: se agrupaba por textura y los muros se restaban todos
 * al final, así que una sala dibujada encima de un muro nunca llegaba a enseñar su suelo. Se veía el muro
 * entero y la sala no aparecía — exactamente lo que él describió.
 */
describe('<RoomsLayer> lo último dibujado es lo último pintado', () => {
  const fill2 = (id: string, x1: number, y1: number, x2: number, y2: number): Room =>
    ({ ...room(id, x1, y1, x2, y2), kind: 'fill' });

  it('una sala dibujada DESPUÉS de un muro se pinta encima de él', () => {
    const capas = () => screen.getAllByTestId(/mp-room-(floor|refill)/);
    mount([room('r1', 60, 60, 420, 420), fill2('f1', 120, 120, 240, 240), room('r2', 150, 150, 210, 210)]);
    // Tres capas, y en el orden en que las dibujó: suelo · roca · suelo. La última manda sobre lo de debajo.
    expect(capas().map(c => c.getAttribute('data-testid')))
      .toEqual(['mp-room-floor', 'mp-room-refill', 'mp-room-floor']);
  });

  it('y un muro dibujado DESPUÉS de la sala la tapa', () => {
    mount([room('r1', 60, 60, 420, 420), fill2('f1', 120, 120, 240, 240)]);
    expect(screen.getAllByTestId(/mp-room-(floor|refill)/).map(c => c.getAttribute('data-testid')))
      .toEqual(['mp-room-floor', 'mp-room-refill']);
  });

  /** Las seguidas que pintan lo mismo se juntan: veinte salas del mismo suelo son UNA capa, no veinte. */
  it('las salas seguidas con el mismo suelo se pintan de una vez', () => {
    mount([room('r1', 60, 60, 200, 200), room('r2', 220, 60, 360, 200), room('r3', 380, 60, 520, 200)]);
    expect(screen.getAllByTestId('mp-room-floor')).toHaveLength(1);
  });
});

/**
 * ⚡ EL ARREGLO DEL RENDIMIENTO (suyo, 2026-09-07: «*la sombra dinámica en local va lentísima cuando
 * pruebo*»). Arrastrar una ficha repinta el lienzo ~60 veces por segundo, y esta capa se repintaba con él
 * aunque nada de lo que dibuja dependa de las fichas: en cada fotograma se volvía a recorrer el contorno
 * entero de la mazmorra —el temblor punto a punto, los caminos, las capas de suelo— y a reconciliar todo ese
 * árbol de SVG. Con `memo`, y con las props estables desde `MapCanvas`, React ni entra.
 *
 * OJO CON LO QUE ESTE TEST TIENE QUE MIRAR. La primera versión comprobaba que el nodo del DOM fuera el mismo
 * (`toBe`) — y eso pasa SIEMPRE, con `memo` y sin él: React reutiliza el nodo cuando los atributos no
 * cambian. O sea que el guardián no guardaba nada; quitando el `memo` seguía verde (review, 2026-09-07). Lo
 * que de verdad distingue es si el CUERPO del componente se ha ejecutado, y eso se ve espiando una función
 * que el cuerpo llama sí o sí.
 */
describe('<RoomsLayer> — no se repinta de balde', () => {
  it('con las MISMAS props React NI ENTRA en el cuerpo: es lo que salva el desenfoque de la sombra', () => {
    const rooms = [room('r1', 60, 60, 300, 300)];
    const openings: RoomOpening[] = [];
    const ids = roomMaskIds(SCENE.id);
    const { rerender } = render(<svg><RoomsLayer scene={SCENE} rooms={rooms} openings={openings} ids={ids} /></svg>);
    const antes = screen.getByTestId('mp-room-shadow');
    // `roomWallsOf` es lo primero que hace el cuerpo. Si se llama otra vez, el cuerpo se ha vuelto a ejecutar.
    const spy = vi.spyOn(styles, 'roomWallsOf');
    // Mismísimas referencias: es el caso real, con `useMemo` sujetando las props en `MapCanvas`.
    rerender(<svg><RoomsLayer scene={SCENE} rooms={rooms} openings={openings} ids={ids} /></svg>);
    expect(spy).not.toHaveBeenCalled();
    // Y el nodo sigue siendo el mismo, claro: nadie lo ha tocado.
    expect(screen.getByTestId('mp-room-shadow')).toBe(antes);
    spy.mockRestore();
  });

  it('pero si cambia una sala SÍ se repinta: el `memo` no puede dejarla obsoleta', () => {
    const ids = roomMaskIds(SCENE.id);
    const { rerender } = render(<svg><RoomsLayer scene={SCENE} rooms={[room('r1', 60, 60, 300, 300)]} openings={[]} ids={ids} /></svg>);
    const antes = screen.getByTestId('mp-room-wall').getAttribute('d');
    rerender(<svg><RoomsLayer scene={SCENE} rooms={[room('r1', 60, 60, 200, 200)]} openings={[]} ids={ids} /></svg>);
    expect(screen.getByTestId('mp-room-wall').getAttribute('d')).not.toBe(antes);
  });
});

/**
 * ── EL PINCEL SOBRE EL SUELO DE UNA SALA (rebanada 9) ──
 *
 * El PNG es negro donde se ha pintado y transparente donde no, así que puesto ENCIMA del contorno blanco de
 * la máscara tapa justo lo pintado y por ahí asoma lo que haya debajo. La textura del constructor no se toca:
 * se puede volver atrás siempre.
 */
describe('<RoomsLayer> el pincel sobre el suelo de una sala', () => {
  it('una sala sin pintar no lleva ninguna máscara de pincel', () => {
    mount([room('a', 0, 0, 100, 100)]);
    expect(screen.queryByTestId('mp-room-floor-mask')).not.toBeInTheDocument();
  });

  it('una sala pintada mete su PNG en la máscara de su suelo, con la fecha pegada', () => {
    mount([room('a', 0, 0, 100, 100, { floorMaskUrl: 'https://x/m.png', updatedAt: 't7' })]);
    const img = screen.getByTestId('mp-room-floor-mask');
    expect(img).toHaveAttribute('href', 'https://x/m.png?v=t7');
  });

  /**
   * 🔑 UNA SALA PINTADA NO SE JUNTA CON NADIE. Juntar las seguidas que pintan lo mismo es lo que evita
   * veinte recortes del tamaño del mapa, pero una máscara es SUYA: metida en un grupo se aplicaría también al
   * suelo de las vecinas y aparecerían agujeros en salas que nadie tocó.
   */
  it('la sala pintada se separa de sus vecinas, que sin ella irían en un solo grupo', () => {
    const iguales = [room('a', 0, 0, 100, 100), room('b', 200, 0, 300, 100)];
    mount(iguales);
    expect(screen.getAllByTestId('mp-room-floor')).toHaveLength(1);
    document.body.innerHTML = '';
    mount([{ ...iguales[0]!, floorMaskUrl: 'https://x/m.png', updatedAt: 't2' }, iguales[1]!]);
    expect(screen.getAllByTestId('mp-room-floor')).toHaveLength(2);
    expect(screen.getAllByTestId('mp-room-floor-mask')).toHaveLength(1);
  });

  /** Mientras se arrastra manda la máscara EN VIVO: sin esto el pincel no se vería hasta soltar el ratón. */
  it('la previa en vivo manda sobre la guardada, y sólo en la sala que se está pintando', () => {
    const salas = [room('a', 0, 0, 100, 100, { floorMaskUrl: 'https://x/vieja.png', updatedAt: 't1' }), room('b', 200, 0, 300, 100)];
    mount(salas, [], SCENE, { roomId: 'a', href: 'data:image/png;base64,ENVIVO' });
    const imgs = screen.getAllByTestId('mp-room-floor-mask');
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toHaveAttribute('href', 'data:image/png;base64,ENVIVO');
  });

  /** Y una previa VACÍA es «acabo de restaurarla»: tiene que borrar la guardada, no dejarla asomar. */
  it('una previa vacía deja el suelo entero aunque haya una máscara guardada', () => {
    mount([room('a', 0, 0, 100, 100, { floorMaskUrl: 'https://x/vieja.png', updatedAt: 't1' })], [], SCENE, { roomId: 'a', href: null });
    expect(screen.queryByTestId('mp-room-floor-mask')).not.toBeInTheDocument();
  });
});
