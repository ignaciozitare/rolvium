/**
 * LA FORMA DE UN BROCHAZO (rebanada 9 de maps — «el pincel»).
 *
 * Vive aquí y no en el navegador porque el pincel pinta en TRES sitios y uno de ellos, la niebla, se calcula
 * en el SERVIDOR: la máscara de una capa y la del suelo de una sala se estampan en un lienzo del navegador,
 * pero las casillas de la niebla las decide `apps/api`. Con la forma escrita dos veces, un día el pincel se
 * difuminaría en una capa y cortaría a filo en la niebla siendo el mismo mando. Es el mismo motivo por el que
 * `roomWalls` vive aquí y lo usan el lienzo y el servidor.
 *
 * Todo lo de este fichero es PURO y sin estado: el azar entra por parámetro.
 */

const clamp01 = (v: number): number => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

/** Cuántos vértices tiene el contorno de un brochazo roto. Bastantes para que no se lea como un polígono. */
export const ROUGH_POINTS = 28;

/**
 * Lo más que muerde el borde roto hacia dentro, en fracción del radio. Más deja el trazo tan comido que ya no
 * se lee como una pincelada.
 */
export const ROUGH_MAX_BITE = 0.5;

/**
 * EL CONTORNO DE UN BROCHAZO ROTO: un multiplicador del radio por vértice, dando la vuelta al círculo.
 *
 * 🔑 **Cada brochazo sale distinto** (orden suya: «*distinto cada vez*»), y por eso el azar entra por `rnd` en
 * vez de llamar aquí a `Math.random`: así la función es PURA y se puede probar. En la app se le pasa
 * `Math.random`; en un test, un azar sembrado.
 *
 * 🔑 **Y no hace falta guardar nada.** Lo que se persiste es el RESULTADO —el PNG de la máscara, o las
 * casillas de la niebla—, así que la forma queda cocida dentro y el azar muere aquí. El spec llegó a decir
 * que haría falta guardar una semilla por trazo; no es cierto, y está corregido allí.
 *
 * El contorno **nunca crece hacia fuera**, sólo muerde hacia dentro: si creciera, el brochazo se saldría del
 * radio que el director ve en el cursor y pintaría donde no apunta — y en una sala, del suelo.
 */
export function roughRadii(roughness: number, rnd: () => number, points = ROUGH_POINTS): number[] {
  const r = clamp01(roughness);
  if (r === 0) return Array.from({ length: points }, () => 1);
  const bite = r * ROUGH_MAX_BITE;
  const raw = Array.from({ length: points }, () => 1 - rnd() * bite);
  /*
   * Se suaviza con sus dos vecinos y CIRCULARMENTE, que es lo que hace que el borde parezca desgarrado y no
   * un serrucho de ruido: sin esto cada vértice salta contra el siguiente. Circular porque el último vértice
   * es vecino del primero — si no, se ve la costura por donde se cerró el contorno.
   */
  const at = (i: number): number => raw[((i % points) + points) % points]!;
  return raw.map((_, i) => (at(i - 1) + at(i) * 2 + at(i + 1)) / 4);
}

/**
 * EL CONTORNO ROTO, COMO PUNTOS. Los vértices se reparten a vueltas iguales alrededor del centro y cada uno
 * se acerca según su multiplicador. Vale igual para el lienzo (`moveTo`/`lineTo`) y para un `path` de SVG.
 */
export function roughOutline(cx: number, cy: number, r: number, radii: readonly number[]): { x: number; y: number }[] {
  return radii.map((k, i) => {
    const a = (2 * Math.PI * i) / radii.length;
    return { x: cx + Math.cos(a) * r * k, y: cy + Math.sin(a) * r * k };
  });
}

/**
 * HASTA DÓNDE LLEGA EL CONTORNO ROTO EN UN ÁNGULO CUALQUIERA, interpolando entre los dos vértices vecinos.
 *
 * El lienzo dibuja el polígono y ya está, pero la NIEBLA no dibuja: pregunta casilla a casilla «¿te pilla
 * esto?», y una casilla cae en cualquier ángulo. Circular por lo mismo que el suavizado de `roughRadii`: el
 * último vértice es vecino del primero.
 */
export function roughReach(radii: readonly number[], angle: number): number {
  const n = radii.length;
  if (n === 0) return 1;
  const t = ((((angle / (2 * Math.PI)) % 1) + 1) % 1) * n;
  const i = Math.floor(t);
  const a = radii[i % n]!, b = radii[(i + 1) % n]!;
  return a + (b - a) * (t - i);
}

/** Hasta dónde llega el disco opaco antes de empezar a desvanecerse. */
export const brushPlateau = (hardness: number): number => Math.min(0.98, clamp01(hardness));

/**
 * LA OPACIDAD DEL BROCHAZO A UNA DISTANCIA DEL CENTRO (`d` de 0 en el centro a 1 en el borde).
 *
 * Es el MISMO perfil que el degradado del lienzo, escrito como número porque la niebla no puede usar un
 * degradado: va por casillas y tiene que preguntar cuánto le toca a cada una. Los dos salen de aquí para que
 * no puedan discrepar — un pincel que se difumina en una capa y corta a filo en la niebla sería el mismo
 * mando haciendo dos cosas distintas.
 */
export function brushAlphaAt(d: number, strength: number, hardness: number): number {
  const alpha = clamp01(strength);
  const plateau = brushPlateau(hardness);
  if (d <= plateau) return alpha;
  if (d >= 1) return 0;
  return alpha * (1 - (d - plateau) / (1 - plateau));
}
