/**
 * Un ataque cuerpo a cuerpo que está esperando a que el jugador conteste (`dice_attacks`).
 *
 * El manual lo resuelve como un CONFLICTO (p.93): los dados de enfrente no son una dificultad que ponga el
 * director, son los que el atacado decida gastar en defenderse. Por eso la tirada no sale en el momento —
 * se guarda la intención, le SALTA el aviso al jugador, y sólo cuando contesta se tira.
 */
export interface PendingAttack {
  id: string;
  campaignId: string;
  /** Copiado al abrirlo, no leído del token: «te ataca un ogro» tiene que decirse aunque el token ya no esté. */
  attackerName: string;
  /**
   * `null` = fila del ESPEJO (un PJ atacando a una criatura; contesta el DIRECTOR, no este aviso). La RLS
   * deja leerla al dueño del atacante y al director, así que `listPending` las trae — el aviso de la
   * columna 5 las salta sin marcarlas, que para eso no son suyas.
   */
  targetCharacterId: string | null;
  /** Dados que pone el atacante. El director los reparte entre sus ataques del turno (p.94). */
  dice: number;
  /**
   * La característica con la que se ataca, y por tanto con la que se defiende: cuerpo a cuerpo es Combate
   * contra Combate (RULES.md §5.2). `null` en un ataque que no la llevara guardada, y entonces el aviso
   * calla el nombre en vez de inventarse uno.
   */
  stat: string | null;
  createdAt: string;
}

/** Lo que hace falta para abrir un ataque: la petición ya armada por el sistema, sin oposición. */
export interface OpenAttackInput {
  campaignId: string;
  sceneId?: string | null;
  attackerTokenId?: string | null;
  targetTokenId?: string | null;
  attackerName: string;
  targetCharacterId: string;
  dice: number;
  request: import('@rolvium/core').RollRequest;
}
