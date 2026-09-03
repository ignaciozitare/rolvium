import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Wall } from '../domain/entities/Scene';
import { DRAWING_MINE, fakeMapsRepo, fakeVisionPort, LAYER_FLOOR, LAYER_MOSS, LAYER_OBJECTS, LIGHT_TORCH, PLAYER_USER, SCENE_WAREHOUSE, TOKEN_KAREN, WALL_1 } from '../../../../tests/helpers/fakes';
import { newLightOf } from '../domain/useCases/layerRules';
import { useScene } from './useScene';

/**
 * El ciclo COMPLETO del arrastre con paredes sólidas, que ningún test ataba (fallo del 2026-08-22):
 * corrección del servidor → qué se pinta → QUÉ SE LE PREGUNTA al servidor en el tick siguiente. Sin ese
 * último eslabón, ningún doble podía fallar: el fallo estaba en preguntar por la posición ya corregida.
 *
 * El muro del doble está en x = 12 y contesta SÓLO cuando recorta, como el servidor real. A este navegador
 * no le llega ningún muro (en una escena real, 16 de 16 ocultos), así que su freno propio es `libre`: cada
 * `tick` reproduce el contrato de MapCanvas — pintar `corrección ?? libre`, preguntar por el deseo.
 */
const WALL_X = 12;
/** El dedo, al otro lado del muro. TOKEN_KAREN vive en (10, 11). */
const LIBRE = { x: 14, y: 11 };

const seed = () => ({
  repo: fakeMapsRepo({ tokens: [TOKEN_KAREN] }),
  vision: fakeVisionPort({}, at => (at.x > WALL_X ? { x: WALL_X, y: at.y } : null)),
});

let now = 1_000_000;
beforeEach(() => { now = 1_000_000; vi.spyOn(Date, 'now').mockImplementation(() => now); });
afterEach(() => { vi.restoreAllMocks(); });

type Hook = { current: ReturnType<typeof useScene> };

async function mount(repo: ReturnType<typeof fakeMapsRepo>, vision: ReturnType<typeof fakeVisionPort>) {
  const { result } = renderHook(() => useScene(repo, SCENE_WAREHOUSE, PLAYER_USER.id, vision));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  await waitFor(() => expect(result.current.fog).not.toBeNull());
  return result;
}

/** Un pointermove como los de MapCanvas: obedecer al servidor si ha hablado, y si no, el freno propio (= libre). */
async function tick(result: Hook, libre: { x: number; y: number }) {
  now += 150; // pasa el throttle de visión (140 ms) y el del broadcast (50 ms)
  const server = result.current.serverCorrection(TOKEN_KAREN.id);
  const pos = server ?? libre;
  await act(async () => { result.current.dragToken(TOKEN_KAREN.id, pos.x, pos.y, libre); });
  return pos;
}

describe('useScene · paredes sólidas, el ciclo entero', () => {
  it('la corrección no oscila: se pregunta por el deseo y el token se queda a este lado del muro', async () => {
    const { repo, vision } = seed();
    const result = await mount(repo, vision);

    const t1 = await tick(result, LIBRE);
    expect(t1).toEqual(LIBRE); // el servidor aún no ha hablado: se pinta libre
    const t2 = await tick(result, LIBRE);
    expect(t2).toEqual({ x: WALL_X, y: LIBRE.y }); // recortó: se obedece
    const t3 = await tick(result, LIBRE);
    expect(t3).toEqual({ x: WALL_X, y: LIBRE.y }); // y NO oscila: con el fallo, aquí volvía a `libre`

    // al servidor se le preguntó SIEMPRE por el deseo del dedo, nunca por su propia corrección
    expect(vision.calls.filter(c => c.at).map(c => c.at!.x)).toEqual([LIBRE.x, LIBRE.x, LIBRE.x]);
    // y a la mesa se le cuenta dónde está el token DE VERDAD, no el deseo
    expect(repo.broadcasts.flatMap(b => (b.event.type === 'token.moved' ? [b.event.x] : []))).toEqual([LIBRE.x, WALL_X, WALL_X]);
    // el ancla del barrido: primer tick SIN `from` (manda la posición guardada); después, la última CONTESTADA
    const froms = vision.calls.filter(c => c.at).map(c => (c.at as { from?: { x: number } }).from?.x);
    expect(froms).toEqual([undefined, WALL_X, WALL_X]);
    // y el disco libre queda expuesto para que el lienzo no pinte más allá: pegado al muro, holgura 0
    expect(result.current.dragBound(TOKEN_KAREN.id)).toEqual({ x: WALL_X, y: LIBRE.y, clearance: 0 });
  });

  it('soltar el token limpia la corrección: no clava el arrastre siguiente en el sitio viejo', async () => {
    const { repo, vision } = seed();
    const result = await mount(repo, vision);

    await tick(result, LIBRE);
    expect(result.current.serverCorrection(TOKEN_KAREN.id)).toEqual({ x: WALL_X, y: LIBRE.y });
    await act(async () => { await result.current.moveToken(TOKEN_KAREN.id, WALL_X, LIBRE.y); });
    expect(result.current.serverCorrection(TOKEN_KAREN.id)).toBeNull();
    expect(result.current.dragBound(TOKEN_KAREN.id)).toBeNull();
    // y la posición final se persiste donde se soltó
    expect(repo.tokenUpdates.at(-1)).toEqual({ id: TOKEN_KAREN.id, patch: { x: WALL_X, y: LIBRE.y } });
  });
});

/**
 * Capas y luces (rebanada 7). Lo que se prueba aquí, y no en el dominio, es la CONVIVENCIA con lo que ya
 * había: que cargarlas no rompe el resto, que el borrado espeja lo que hace la base de datos, y —lo más
 * importante— que NADA de esto pide visión de nuevo: una capa es composición y una luz es pintura.
 */
/**
 * La puerta que se dibuja de un tirón sobre DOS muros seguidos (dueño, 2026-09-01: «ahí está la puerta abierta
 * y no puede ver»). `planOpening` planea los dos cortes; lo que se ata aquí es que `addWall` los APLICA los
 * dos: si sólo se aplicase el primero, el otro muro seguiría macizo tapando el vano.
 */
describe('useScene · una abertura parte TODOS los muros que pisa', () => {
  const solid = (id: string, y1: number, y2: number): Wall =>
    ({ ...WALL_1, id, sceneId: SCENE_WAREHOUSE.id, x1: 621, y1, x2: 621, y2 });

  it('se crean los trozos que sobran de cada muro y salen los dos anfitriones', async () => {
    const a = solid('w-a', 405, 513), b = solid('w-b', 513, 540);
    const repo = fakeMapsRepo({ tokens: [TOKEN_KAREN], walls: [a, b] });
    const result = await mount(repo, fakeVisionPort({}));
    await waitFor(() => expect(result.current.walls).toHaveLength(2));

    const door = { sceneId: SCENE_WAREHOUSE.id, campaignId: SCENE_WAREHOUSE.campaignId, x1: 621, y1: 432, x2: 621, y2: 540, visiblePlayers: false, kind: 'door' as const, blocksSight: true, blocksMove: true, isOpen: false };
    await act(async () => {
      await result.current.addWall(door, [
        { host: a, pieces: [{ x1: 621, y1: 405, x2: 621, y2: 432 }] },
        { host: b, pieces: [] },
      ]);
    });

    const ids = result.current.walls.map(w => w.id);
    expect(ids).not.toContain('w-a');
    expect(ids).not.toContain('w-b');
    // el trozo que sobra del primero + la puerta; del segundo no sobra nada
    expect(result.current.walls).toHaveLength(2);
    expect(result.current.walls.filter(w => w.kind === 'wall')).toEqual([expect.objectContaining({ y1: 405, y2: 432, blocksSight: true })]);
    expect(result.current.walls.filter(w => w.kind === 'door')).toHaveLength(1);
    expect(repo.walls.map(w => w.id)).toEqual(ids);
  });
});

/**
 * 🏗 UNA SALA ENTERA DE GOLPE (§ «Rebanada 8»). Lo que se ata aquí es lo que el dueño pidió con nombre el
 * 2026-09-03: que la niebla funcione igual con lo levantado en Builder. Sale gratis porque son muros normales
 * —sin tabla propia, sin marca propia— pero «sale gratis» es justo lo que se rompe sin que nadie se entere.
 */
describe('useScene · Builder levanta la sala de una vez', () => {
  const lado = (x1: number, y1: number, x2: number, y2: number) =>
    ({ sceneId: SCENE_WAREHOUSE.id, campaignId: SCENE_WAREHOUSE.campaignId, x1, y1, x2, y2, visiblePlayers: false, kind: 'wall' as const, blocksSight: true, blocksMove: true, isOpen: false });
  const sala = [lado(0, 0, 270, 0), lado(270, 0, 270, 189), lado(270, 189, 0, 189), lado(0, 189, 0, 0)];

  it('los cuatro lados acaban en la base y en la pantalla, opacos', async () => {
    const repo = fakeMapsRepo({ tokens: [TOKEN_KAREN] });
    const result = await mount(repo, fakeVisionPort({}));
    await act(async () => { await result.current.addRoom(sala); });

    expect(result.current.walls).toHaveLength(4);
    expect(repo.walls).toHaveLength(4);
    for (const w of result.current.walls) {
      expect(w.blocksSight).toBe(true);
      expect(w.blocksMove).toBe(true);
      expect(w.kind).toBe('wall');
    }
  });

  /** La visión se calcula en el servidor: si nadie se lo cuenta, la sala nueva no tapa nada hasta el refresco. */
  it('avisa al servidor de que la visión ha cambiado', async () => {
    const vision = fakeVisionPort({});
    const result = await mount(fakeMapsRepo({ tokens: [TOKEN_KAREN] }), vision);
    const antes = vision.calls.length;
    await act(async () => { await result.current.addRoom(sala); });
    await waitFor(() => expect(vision.calls.length).toBeGreaterThan(antes));
  });

  /**
   * 🔒 O la sala entera o nada. Escribiendo muro a muro, si fallaba el enésimo se quedaban puestos los
   * anteriores: la sala quedaba ABIERTA, la visión se colaba por el hueco y lo único que avisaba era el
   * banner genérico de error. Ahora es una sola escritura, así que no hay estado intermedio que se quede.
   */
  it('si la escritura falla, no queda media sala abierta', async () => {
    const repo = fakeMapsRepo({ tokens: [TOKEN_KAREN] });
    repo.addWalls = async () => { throw new Error('sin conexión'); };
    const result = await mount(repo, fakeVisionPort({}));
    await act(async () => { await expect(result.current.addRoom(sala)).rejects.toThrow('sin conexión'); });
    expect(repo.walls).toHaveLength(0);
    expect(result.current.walls).toHaveLength(0);
  });

  /**
   * 🧩 EL GRUPO (§ «EL GRUPO»), pedido por él el 2026-09-03 sobre una foto de mapa: los once muros del círculo
   * son UNA cosa. Aquí se ata que nacen atados — de ahí sale que un clic los coja todos.
   */
  it('los muros de un gesto nacen atados entre sí, con el mismo grupo', async () => {
    const repo = fakeMapsRepo({ tokens: [TOKEN_KAREN] });
    const result = await mount(repo, fakeVisionPort({}));
    await act(async () => { await result.current.addRoom(sala); });
    const grupos = new Set(repo.walls.map(w => w.groupId));
    expect(grupos.size).toBe(1);
    expect([...grupos][0]).toBeTruthy();
  });

  it('dos gestos son dos grupos distintos: no se contagian', async () => {
    const repo = fakeMapsRepo({ tokens: [TOKEN_KAREN] });
    const result = await mount(repo, fakeVisionPort({}));
    await act(async () => { await result.current.addRoom(sala); });
    await act(async () => { await result.current.addRoom(sala.map(s => ({ ...s, x1: s.x1 + 400, x2: s.x2 + 400 }))); });
    expect(new Set(repo.walls.map(w => w.groupId)).size).toBe(2);
  });

  /** 🔒 Su elección: sin agrupar a mano, todo lo que lleva meses marcando se quedaba fuera del invento. */
  it('agrupa a mano muros que ya estaban sueltos, y los suelta otra vez', async () => {
    const repo = fakeMapsRepo({ tokens: [TOKEN_KAREN] });
    const result = await mount(repo, fakeVisionPort({}));
    await act(async () => { await result.current.addWall(sala[0]!); await result.current.addWall(sala[1]!); });
    const ids = repo.walls.map(w => w.id);
    let grupo: string | null = null;
    await act(async () => { grupo = await result.current.groupWalls(ids); });
    expect(grupo).toBeTruthy();
    expect(repo.walls.every(w => w.groupId === grupo)).toBe(true);
    expect(repo.wallGroupings[0]).toEqual({ ids, groupId: grupo });

    await act(async () => { await result.current.ungroupWalls(grupo!); });
    expect(repo.walls.every(w => w.groupId === null)).toBe(true);
  });

  it('un muro solo no forma grupo: hacen falta dos', async () => {
    const repo = fakeMapsRepo({ tokens: [TOKEN_KAREN] });
    const result = await mount(repo, fakeVisionPort({}));
    await act(async () => { await result.current.addWall(sala[0]!); });
    let grupo: string | null = 'x';
    await act(async () => { grupo = await result.current.groupWalls([repo.walls[0]!.id]); });
    expect(grupo).toBeNull();
    expect(repo.wallGroupings).toHaveLength(0);
  });

  /** 🔒 Mover o estirar el grupo va en UNA escritura: a medio mover queda la forma rota y se cuela la visión. */
  it('mueve el grupo entero de una vez, y avisa a la visión', async () => {
    const repo = fakeMapsRepo({ tokens: [TOKEN_KAREN] });
    const vision = fakeVisionPort({});
    const result = await mount(repo, vision);
    await act(async () => { await result.current.addRoom(sala); });
    const antes = vision.calls.length;
    const movidos = repo.walls.map(w => ({ ...w, x1: w.x1 + 50, x2: w.x2 + 50 }));
    await act(async () => { await result.current.transformWalls(movidos); });
    expect(repo.wallBatchMoves).toHaveLength(1);
    expect(repo.wallBatchMoves[0]).toHaveLength(4);
    expect(repo.walls[0]!.x1).toBe(sala[0]!.x1 + 50);
    expect(result.current.walls[0]!.x1).toBe(sala[0]!.x1 + 50);
    await waitFor(() => expect(vision.calls.length).toBeGreaterThan(antes));
  });

  /** 🔒 «no me deja borrarlos». Suprimir con el grupo cogido lo borra ENTERO, y en una sola escritura. */
  it('borra el grupo entero de una vez, y avisa a la visión', async () => {
    const repo = fakeMapsRepo({ tokens: [TOKEN_KAREN] });
    const vision = fakeVisionPort({});
    const result = await mount(repo, vision);
    await act(async () => { await result.current.addRoom(sala); });
    const ids = repo.walls.map(w => w.id);
    const antes = vision.calls.length;
    await act(async () => { await result.current.removeWalls(ids); });
    expect(repo.wallBatchRemoves).toEqual([ids]);
    expect(repo.walls).toHaveLength(0);
    expect(result.current.walls).toHaveLength(0);
    await waitFor(() => expect(vision.calls.length).toBeGreaterThan(antes));
  });

  /** Un gesto demasiado pequeño llega aquí como lista vacía: no se escribe nada ni se molesta al servidor. */
  it('una sala vacía no escribe nada', async () => {
    const repo = fakeMapsRepo({ tokens: [TOKEN_KAREN] });
    const result = await mount(repo, fakeVisionPort({}));
    await act(async () => { await result.current.addRoom([]); });
    expect(repo.walls).toHaveLength(0);
    expect(result.current.walls).toHaveLength(0);
  });
});

/**
 * LA MEMORIA DE LA SONDA (§ 7.3), decisión cerrada del dueño: «que quede en memoria, si es sólo para probar».
 * El servidor contesta lo que se ve DESDE EL PUNTO —no una memoria— y quien la acumula es esta pantalla,
 * que la tira al quitar la sonda. **Nada de esto se escribe en la base.**
 */
describe('useScene · la sonda de prueba acumula su memoria aquí, y la tira al quitarla', () => {
  /** El doble contesta una casilla por punto, que es lo justo para ver si se van uniendo. */
  const mountProbe = async (probe: { x: number; y: number } | null, vision = fakeVisionPort()) => {
    const repo = fakeMapsRepo({ tokens: [TOKEN_KAREN] });
    const { result, rerender } = renderHook(({ p }: { p: { x: number; y: number } | null }) => useScene(repo, SCENE_WAREHOUSE, PLAYER_USER.id, vision, p), { initialProps: { p: probe } });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await waitFor(() => expect(result.current.fog).not.toBeNull());
    return { result, rerender, vision };
  };

  it('moverla UNE lo que se ve en cada punto, en vez de reemplazarlo', async () => {
    const { result, rerender } = await mountProbe({ x: 10, y: 10 });
    await waitFor(() => expect(result.current.fog!.explored).toEqual([[10, 10]]));
    rerender({ p: { x: 20, y: 20 } });
    await waitFor(() => expect(result.current.fog!.explored).toEqual([[10, 10], [20, 20]]));
    rerender({ p: { x: 30, y: 30 } });
    await waitFor(() => expect(result.current.fog!.explored).toEqual([[10, 10], [20, 20], [30, 30]]));
  });

  /**
   * 🐞 EL PIN DE «si le hago click ya activa todo como si hubiera pasado» (dueño, 2026-09-02, con la sonda
   * puesta y el mapa a oscuras, correcto, hasta que tocaba un token).
   *
   * Cualquier OTRA pregunta de visión —arrastrar un token, el pincel— se hace sin decir que la sonda está
   * puesta, y al director el servidor le contesta «todo lo explorado por TODOS». Esa respuesta se pintaba
   * encima y le borraba la vista de la sonda de un plumazo.
   *
   * El fallo llevaba ahí desde que existe la sonda. Lo destapó arreglar el pincel de niebla: hasta entonces
   * su campaña no tenía jugadores, «lo explorado por todos» venía VACÍO, y pisar la niebla con nada no se
   * notaba. El doble de aquí contesta un 2×2 sin sonda y una casilla con ella, que es justo la diferencia.
   */
  it('con la sonda puesta, arrastrar un token NO le pisa la vista', async () => {
    const { result, vision } = await mountProbe({ x: 10, y: 10 });
    await waitFor(() => expect(result.current.fog!.explored).toEqual([[10, 10]]));
    await act(async () => { result.current.dragToken(TOKEN_KAREN.id, 100, 100, { x: 100, y: 100 }); });
    await waitFor(() => expect(vision.calls.some(c => c.at && !c.probe)).toBe(true));
    expect(result.current.fog!.explored).toEqual([[10, 10]]);
  });

  it('con la sonda puesta, el pincel tampoco le pisa la vista', async () => {
    const { result } = await mountProbe({ x: 10, y: 10 });
    await waitFor(() => expect(result.current.fog!.explored).toEqual([[10, 10]]));
    await act(async () => { await result.current.paintFog({ x: 50, y: 50, radius: 30 }, 'reveal'); });
    expect(result.current.fog!.explored).toEqual([[10, 10]]);
    await act(async () => { await result.current.paintAllFog('reveal'); });
    expect(result.current.fog!.explored).toEqual([[10, 10]]);
  });

  /** Y sin sonda todo sigue exactamente como estaba: quien pinta la niebla es la respuesta que llega. */
  it('sin sonda, arrastrar un token SÍ actualiza la niebla, como siempre', async () => {
    const { result } = await mountProbe(null);
    await act(async () => { result.current.dragToken(TOKEN_KAREN.id, 100, 100, { x: 100, y: 100 }); });
    await waitFor(() => expect(result.current.fog!.explored.length).toBeGreaterThan(1));
  });

  it('quitarla TIRA la memoria: no se queda nada colgado de la sesión anterior', async () => {
    const { result, rerender } = await mountProbe({ x: 10, y: 10 });
    await waitFor(() => expect(result.current.fog!.explored).toEqual([[10, 10]]));
    rerender({ p: null });                       // se apaga «ver como jugador»
    await waitFor(() => expect(result.current.fog!.explored).not.toEqual([[10, 10]]));
    rerender({ p: { x: 40, y: 40 } });           // se vuelve a encender: empieza de cero
    await waitFor(() => expect(result.current.fog!.explored).toEqual([[40, 40]]));
  });

  /**
   * EL FRENO. Arrastrar la sonda pide la visión al servidor, y un `pointermove` dispara ~60 veces por segundo.
   * Sin freno se le mandaban 60 peticiones por segundo, llegaban tarde y desordenadas, y en pantalla la niebla
   * parecía no seguir a la sonda (dueño, 2026-09-01). Va al mismo ritmo que arrastrar una ficha: ~7 Hz.
   */
  it('arrastrarla NO manda una petición por cada píxel: va frenada como la ficha de un jugador', async () => {
    const vision = fakeVisionPort();
    const { rerender } = await mountProbe({ x: 0, y: 0 }, vision);
    const antes = vision.calls.filter(c => c.probe).length;
    // 20 posiciones seguidas, como un arrastre real.
    for (let i = 1; i <= 20; i++) rerender({ p: { x: i, y: i } });
    await waitFor(() => expect(vision.calls.filter(c => c.probe).length).toBeGreaterThan(antes));
    expect(vision.calls.filter(c => c.probe).length - antes).toBeLessThan(20);
  });

  it('y aun así la ÚLTIMA posición siempre se pregunta: soltar no deja la niebla una posición atrás', async () => {
    const vision = fakeVisionPort();
    const { rerender } = await mountProbe({ x: 0, y: 0 }, vision);
    for (let i = 1; i <= 8; i++) rerender({ p: { x: i * 10, y: 0 } });
    await waitFor(() => expect(vision.calls.filter(c => c.probe).some(c => c.probe!.x === 80)).toBe(true));
  });

  it('sin sonda no se toca nada: lo explorado es lo que conteste el servidor', async () => {
    const { result } = await mountProbe(null);
    expect(result.current.fog!.explored).toEqual(fakeVisionPort().state.explored);
  });
});

describe('useScene — capas y luces', () => {
  const seedLayers = () => fakeMapsRepo({ tokens: [TOKEN_KAREN], layers: [LAYER_OBJECTS, LAYER_FLOOR, LAYER_MOSS], lights: [LIGHT_TORCH], drawings: [{ ...DRAWING_MINE, layerId: LAYER_MOSS.id }] });

  it('carga capas y luces con el resto de la escena', async () => {
    const repo = seedLayers();
    const r = await mount(repo, fakeVisionPort());
    expect(r.current.layers.map(l => l.id)).toEqual(['ly-obj', 'ly-floor', 'ly-moss']);
    expect(r.current.lights.map(l => l.id)).toEqual(['li-torch']);
  });

  it('la capa nueva de terreno se coloca encima de las que ya hay', async () => {
    const repo = seedLayers();
    const r = await mount(repo, fakeVisionPort());
    await act(async () => { await r.current.addTerrainLayer({ name: 'Niebla baja' }); });
    const created = repo.layers.at(-1)!;
    expect(created).toMatchObject({ kind: 'terrain', name: 'Niebla baja', sortOrder: 2 });
    expect(r.current.layers.some(l => l.id === created.id)).toBe(true);
  });

  /**
   * Espeja el ON DELETE de la migración: los dibujos y las luces de esa capa se van con ella, pero las
   * FICHAS vuelven a su capa natural. Perder el personaje de un jugador por borrar una capa decorativa
   * sería un desastre silencioso.
   */
  it('borrar una capa se lleva sus dibujos y sus luces, pero no sus fichas', async () => {
    const repo = fakeMapsRepo({
      tokens: [{ ...TOKEN_KAREN, layerId: LAYER_MOSS.id }], layers: [LAYER_OBJECTS, LAYER_MOSS],
      lights: [{ ...LIGHT_TORCH, layerId: LAYER_MOSS.id }], drawings: [{ ...DRAWING_MINE, layerId: LAYER_MOSS.id }],
    });
    const r = await mount(repo, fakeVisionPort());
    await act(async () => { await r.current.removeLayer(LAYER_MOSS.id); });
    expect(r.current.layers.map(l => l.id)).toEqual(['ly-obj']);
    expect(r.current.drawings).toHaveLength(0);
    expect(r.current.lights).toHaveLength(0);
    expect(r.current.tokens[0]).toMatchObject({ id: TOKEN_KAREN.id, layerId: null });
  });

  it('reordenar escribe sólo las dos filas que cambian de sitio', async () => {
    const repo = seedLayers();
    const r = await mount(repo, fakeVisionPort());
    await act(async () => { await r.current.reorderLayer(LAYER_MOSS.id, 'down'); });
    expect(repo.layerUpdates).toEqual([{ id: 'ly-moss', patch: { sortOrder: 0 } }, { id: 'ly-floor', patch: { sortOrder: 1 } }]);
    // Tras el intercambio, «Musgo» es la de más abajo: bajarla otra vez no escribe nada — no se promete un
    // movimiento que no pasa.
    repo.layerUpdates.length = 0;
    await act(async () => { await r.current.reorderLayer(LAYER_MOSS.id, 'down'); });
    expect(repo.layerUpdates).toEqual([]);
  });

  it('guardar la máscara sube la versión, y quitarla deja la capa entera', async () => {
    const repo = seedLayers();
    const r = await mount(repo, fakeVisionPort());
    const moss = r.current.layers.find(l => l.id === LAYER_MOSS.id)!;
    const before = moss.maskVersion;
    await act(async () => { await r.current.saveMask(moss, new Blob(['x'])); });
    expect(repo.masksSaved).toEqual([{ layerId: 'ly-moss', bytes: 1 }]);
    expect(r.current.layers.find(l => l.id === LAYER_MOSS.id)!.maskVersion).toBe(before + 1);
    await act(async () => { await r.current.clearMask(moss); });
    expect(r.current.layers.find(l => l.id === LAYER_MOSS.id)!.maskUrl).toBeNull();
  });

  it('las luces se ponen, se retocan y se quitan', async () => {
    const repo = seedLayers();
    const r = await mount(repo, fakeVisionPort());
    await act(async () => { await r.current.addLight(newLightOf('fire', { x: 100, y: 200 }, SCENE_WAREHOUSE)); });
    const fire = repo.lights.at(-1)!;
    expect(fire).toMatchObject({ kind: 'fire', x: 100, y: 200, flicker: true, castsShadow: true });
    await act(async () => { await r.current.patchLight(fire.id, { flicker: false }); });
    expect(r.current.lights.find(l => l.id === fire.id)!.flicker).toBe(false);
    await act(async () => { await r.current.removeLight(fire.id); });
    expect(r.current.lights.some(l => l.id === fire.id)).toBe(false);
  });

  /**
   * ESTE ES EL DÍA que anunciaba la versión anterior de este test («si un día una luz ilumina de verdad,
   * esto tendrá que cambiar A PROPÓSITO»). Desde § 7.2 una luz alumbra y se recorta contra los muros, así
   * que mover una, cambiarle el alcance o la forma, o apagarle la sombra, cambia lo que se ve y hay que
   * volver a preguntar. Lo que NO vuelve a preguntar es la pintura pura: el color y el parpadeo.
   */
  it('cambiar la GEOMETRÍA de una luz vuelve a pedir la visión', async () => {
    const repo = seedLayers();
    const vision = fakeVisionPort();
    const r = await mount(repo, vision);
    const before = vision.calls.length;
    await act(async () => { await r.current.patchLight(LIGHT_TORCH.id, { rangeM: 12 }); });
    await waitFor(() => expect(vision.calls.length).toBeGreaterThan(before));
  });

  it('su color y su parpadeo NO la piden: eso es pintura y no cambia lo que se ve', async () => {
    const repo = seedLayers();
    const vision = fakeVisionPort();
    const r = await mount(repo, vision);
    const before = vision.calls.length;
    await act(async () => { await r.current.patchLight(LIGHT_TORCH.id, { color: '#c9a84c', flicker: false }); });
    // La consulta va en un `setTimeout(0)`: hay que dejar pasar el turno para poder afirmar que NO llega.
    await act(async () => { await new Promise(res => setTimeout(res, 0)); });
    expect(vision.calls.length).toBe(before);
  });

  it('apagar la capa donde vive una luz también la pide: la capa apagada apaga la luz', async () => {
    const repo = seedLayers();
    const vision = fakeVisionPort();
    const r = await mount(repo, vision);
    const before = vision.calls.length;
    await act(async () => { await r.current.patchLayer(LAYER_MOSS.id, { visible: false }); });
    await waitFor(() => expect(vision.calls.length).toBeGreaterThan(before));
  });

  /** Y nada de esto avisa a la mesa por su cuenta: el cambio de la fila ya viaja por el canal en vivo. */
  it('ninguno de esos cambios emite un aviso suelto a la mesa', async () => {
    const repo = seedLayers();
    const r = await mount(repo, fakeVisionPort());
    await act(async () => {
      await r.current.addTerrainLayer();
      await r.current.addLight(newLightOf('torch', { x: 1, y: 2 }, SCENE_WAREHOUSE));
    });
    expect(repo.broadcasts).toEqual([]);
  });

  /** Y llegan por realtime como todo lo demás, sin recargar la escena. */
  it('una capa que cambia en otro navegador llega por el canal de la escena', async () => {
    const repo = seedLayers();
    const r = await mount(repo, fakeVisionPort());
    act(() => { repo.emit('sc-1', { layer: { type: 'UPDATE', id: LAYER_MOSS.id, row: { ...LAYER_MOSS, visible: false } } }); });
    expect(r.current.layers.find(l => l.id === LAYER_MOSS.id)!.visible).toBe(false);
    act(() => { repo.emit('sc-1', { light: { type: 'DELETE', id: LIGHT_TORCH.id, row: null } }); });
    expect(r.current.lights).toHaveLength(0);
  });
});
