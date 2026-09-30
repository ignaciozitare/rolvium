/**
 * LO QUE RECUERDA LA PANTALLA DE LA MESA entre visitas. Hoy sólo el ancho del carril lateral.
 *
 * Es una preferencia de SU pantalla, no un dato de la partida: el mismo usuario en un portátil de 13" y en un
 * monitor grande no quiere el mismo carril, y nadie más tiene por qué heredarlo. Por eso vive en el navegador
 * y no en la base — igual que `ViewMemoryPort` en `maps`.
 */
export interface LayoutMemoryPort {
  /** El ancho guardado en px, o `null` si nunca lo tocó: entonces manda el de serie. */
  sideWidth(): number | null;
  rememberSideWidth(px: number): void;
}
