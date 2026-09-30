import { useEffect, useRef, useState } from 'react';

/**
 * Lo único que hace falta para poder PINTAR una foto: firmarle el enlace. Se declara aquí, con la forma
 * mínima, para que quien lo use no tenga que conocer el módulo de fotos — quien enchufa el de verdad es
 * siempre la pantalla que compone las dos cosas.
 */
export interface PhotoUrlSigner {
  urlsFor(campaignId: string, photoIds: readonly string[]): Promise<Record<string, string>>;
}

/**
 * LOS ENLACES FIRMADOS DE UNAS FOTOS (H13). Lo usan la ESCENA, para las puestas en el mapa, y el CHAT, para
 * las mandadas por un susurro: el problema es el mismo, así que vive aquí y no en ninguno de los dos módulos.
 *
 * El fichero de una foto vive en un bucket PRIVADO y su fila no lleva enlace (`image_url = ''`): quien puede
 * verla lo decide la base, y el enlace se firma aparte y caduca. Así que lo que se pinta no sale de la fila,
 * sale de aquí.
 *
 * Se firma **sólo lo que falta**: una foto ya firmada no se vuelve a pedir aunque la escena se repinte cien
 * veces durante un arrastre. Y lo que la base no deja leer —una foto entera fuera del área de juego, para un
 * jugador— simplemente no vuelve, y esa foto no se pinta: la pantalla no tiene que decidir nada.
 *
 * 🔴 ESTE EFECTO NO LLEVA LIMPIEZA, Y NO PUEDE LLEVARLA. Lo natural sería cancelar la petición al relanzarse,
 * y aquí eso es un fallo: poner una SEGUNDA foto cambia la lista de ids, relanza el efecto, y la cancelación
 * mataría la firma de la PRIMERA, que venía en camino — y como su id ya consta como «pedido», nadie volvería
 * a pedirla: esa foto no se pintaría jamás. Lo que impide que una firma tardía aterrice fuera de sitio es
 * `vivo`, que sólo mira el desmontaje. Hay una prueba que lo clava, para que nadie «arregle» esto.
 *
 * El disparador es la lista de ids POR VALOR (`idsKey`) y no `sceneProps`, que cambia de identidad en cada
 * fotograma de un arrastre: así el efecto no se relanza cien veces por gesto. Eso es rendimiento; la red de
 * seguridad es lo de arriba. (Medido el 2026-09-28 al revisar: las dos mitades por separado son inofensivas,
 * juntas son letales.)
 *
 * ⚠️ Los enlaces caducan a la hora y **aquí nadie los vuelve a firmar** (deuda ya anotada en `WORK_STATE.md`,
 * compartida con las miniaturas de la galería). En una mesa muy larga habría que recargar.
 */
export function usePhotoUrls(
  campaignId: string,
  photoIds: readonly string[],
  signer?: PhotoUrlSigner,
): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  /** Lo ya pedido (haya salido bien o mal): evita pedir en bucle lo que la base no deja leer. */
  const asked = useRef(new Set<string>());
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);

  /** Las mismas fotos en otro array son las MISMAS fotos: lo que manda es qué hay, no cuántas veces se repinta. */
  const idsKey = photoIds.join(',');

  // Cambiar de campaña vacía lo firmado: un enlace de otra campaña no sirve para nada aquí.
  useEffect(() => { asked.current = new Set(); setUrls({}); }, [campaignId]);

  useEffect(() => {
    if (!signer) return;
    const faltan = idsKey ? idsKey.split(',').filter(id => !asked.current.has(id)) : [];
    if (!faltan.length) return;
    for (const id of faltan) asked.current.add(id);
    void signer.urlsFor(campaignId, faltan)
      .then(nuevos => { if (vivo.current) setUrls(prev => ({ ...prev, ...nuevos })); })
      // Sin enlace no se pinta la foto, y ya está: una firma que falla no puede tumbar la escena.
      .catch(() => {});
  }, [campaignId, idsKey, signer]);

  /**
   * 🔑 SE DEVUELVE SÓLO LO QUE SE PUEDE ENSEÑAR AHORA, no todo lo que se firmó alguna vez. Un enlace firmado
   * vale una hora pase lo que pase, así que si esto devolviera el cajón entero, una foto que el director
   * retira del área de juego se le seguiría viendo al jugador hasta una hora. Lo que se guarda es una caché;
   * lo que sale es la respuesta a «qué toca pintar ahora mismo».
   */
  return Object.fromEntries(photoIds.map(id => [id, urls[id]]).filter((e): e is [string, string] => e[1] !== undefined));
}
