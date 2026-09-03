/** Events published on the table event bus (one channel per campaign). Hexagons subscribe; nobody imports another hexagon's infra. */
export type TableEvent =
  | { type: 'roll.created'; campaignId: string; rollId: string; authorId: string }
  | { type: 'sheet.patched'; campaignId: string; characterId: string; fields: string[] }
  | { type: 'resource.changed'; campaignId: string; resourceId: string; value: number }
  | { type: 'token.moved'; campaignId: string; sceneId: string; tokenId: string; x: number; y: number; final: boolean }
  | { type: 'fog.updated'; campaignId: string; sceneId: string; userId: string }
  /**
   * «Los muros de esta escena han cambiado de dueño: vuelve a pedirlos.»
   *
   * TIENE que viajar por BROADCAST y no por el aviso de fila. Los avisos de fila aplican la RLS de cada
   * suscriptor, así que al pasar un muro a oculto el jugador NO recibe nada —la fila nueva ya no le pertenece—
   * y se queda con la copia vieja, dibujando una pared que ya no debería ver. El sentido de ESCONDER no
   * llegaba nunca (cazado por el review, 2026-09-03). El broadcast no filtra, así que cruza en los dos.
   *
   * Y no se puede sustituir por `fog.updated`: la respuesta de visión no lleva muros, y ocultar un muro no
   * cambia una sola línea de vista — lo que cambia es lo que el jugador tiene DERECHO a que le manden.
   */
  | { type: 'walls.updated'; campaignId: string; sceneId: string; userId: string }
  | { type: 'message.created'; campaignId: string; messageId: string }
  | { type: 'pin.focused'; campaignId: string; sceneId: string; x: number; y: number; by: string }
  | { type: 'scene.activated'; campaignId: string; sceneId: string };

export type TableEventType = TableEvent['type'];
export type TableEventHandler<T extends TableEventType = TableEventType> = (e: Extract<TableEvent, { type: T }>) => void;

/** Minimal in-memory bus; the realtime adapter bridges it to Supabase channels. */
export function createTableBus() {
  type AnyHandler = (e: TableEvent) => void;
  const handlers = new Map<TableEventType, Set<AnyHandler>>();
  return {
    on<T extends TableEventType>(type: T, h: TableEventHandler<T>): () => void {
      const set = handlers.get(type) ?? new Set<AnyHandler>();
      const fn = h as unknown as AnyHandler;
      set.add(fn);
      handlers.set(type, set);
      return () => { set.delete(fn); };
    },
    emit(e: TableEvent): void {
      handlers.get(e.type)?.forEach(h => h(e));
    },
  };
}
export type TableBus = ReturnType<typeof createTableBus>;
