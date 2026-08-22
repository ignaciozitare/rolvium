# Bestiary (H5) — SPEC

## Purpose
El director tiene a mano PNJ, monstruos y encuentros con características completas (no solo un token), puede tirar
en su nombre y colocarlos en la escena. Who: **solo director** (los jugadores solo ven lo que hay en el mapa).

**Por qué manda ahora** (dueño, 2026-08-20: «tenemos que construir el bestiario asap»): el panel del director de
las tiradas no se puede construir sin él — sin encuentros con características no hay con qué atacar.

## What the user can do
- **Listado** por campaña con filtros Todos / Manual / Propios / PNJ con ficha y buscador; cada entrada: token,
  nombre, origen (MANUAL · PROPIO · PNJ·FICHA), notas, Resistencia·Protección, características clave, "N en escena",
  acciones **Tirar** (con visibilidad mesa/DJ/secreta), **Colocar**, menú (editar, duplicar, borrar, token PNG).
- Fuentes: criaturas del sistema (`catalogs.bestiary`), PNJ creados con el **generador** (tipo PNJ), **copias
  rápidas** con ajustes ("otro mutante"), PNJ con ficha completa (aliados) usando el mismo `<Sheet>` de `characters`.
- **Encuentros**: desde la escena, el botón Encuentro abre un desplegable con buscador y todas las entradas; colocar
  crea una **instancia** con su propia Resistencia/estado; los tokens colocados pueden estar ocultos a los jugadores.
- **Imagen propia por entrada** (además del color+iniciales): se sube desde la ficha del encuentro y se comprime a
  WebP en el navegador antes de subirla — ver [core/images](../../core/images/SPEC.md). El bucket `tokens` ya existe.

### Estado de construcción (2026-08-20, rama `feat/bestiario`)
**Construido**: tabla y RLS · especialidades y los 8 bloques que faltaban · dominio, puerto, repositorio y
contenedor · compresor de imágenes · catálogo a pantalla completa en la pestaña «Bestiario» de la mesa · ficha
de crear/editar · modal de la foto · claves i18n en es y en. 591 tests en verde, `audit` 0 hard, ambas apps
compilando. **Sin mergear**: falta Review + QA.

~~Pendiente: PNJ con ficha completa y encuentros propios en la escena~~ → **hechos**. El desplegable de la
escena une ahora las 57 del manual con los encuentros propios, y colocarlos crea una instancia enlazada a su
fila (`maps_tokens.bestiary_entry_id`, ON DELETE SET NULL). Los PNJ aliados abren el **mismo `<Sheet>`** que
un personaje jugador, con su ficha guardada en `data.sheet` de la entrada.

**Dos decisiones de esa ficha de PNJ, para que no se relean como despistes:**
- **No se guarda sola**, al revés que la de un PJ. Es una ventana que el director abre y cierra: un guardado
  automático dentro de un modal le deja sin saber si lo que tocó quedó guardado. Hay botón, y el botón avisa
  cuando hay cambios sin guardar.
- **Los números de un PNJ salen de su ficha**, no de `Aguante × 3`. Quien sabe leerla es el motor del sistema
  (`engine.derived`), así que entra por parámetro: el dominio del bestiario no conoce el esquema de fichas de
  ningún sistema. Si se calculara como una criatura, todos los PNJ saldrían con Resistencia 0.

### Lo que las fichas del catálogo hacen HOY, y lo que no (QA, 2026-08-20)
El listado promete cuatro acciones por entrada. Dos hacen lo que dicen y dos son un atajo, y conviene que esté
escrito para que nadie lo lea como que está terminado:

| Acción | Hoy |
|---|---|
| **Colocar** | ✅ **Cerrado el 2026-08-21.** Lleva a la escena **con la criatura ya elegida**: sólo falta pulsar dónde. Antes sólo cambiaba de pestaña y había que volver a buscarla en el desplegable — «el colocar no funciona» (dueño). El aviso «Coloca a X: haz clic en el mapa» lo dice, y el buscador NO se abre, que ya sobra. |
| **Editar / Duplicar** | ✅ Hace lo que dice. Del manual duplica; de las propias edita. |
| **Ver foto** | ✅ Hace lo que dice. |
| **Tirar** | ✅ **Cerrado el 2026-08-21.** Tira EN NOMBRE de la criatura: se elige característica (sólo las que el manual publica de ese bloque) **o uno de los ataques que imprime su caja**, se ve cuántos dados salen antes de tirar, se marca su especialidad y **las capacidades que podrían aplicar** (con la casilla «es de noche»), se elige dificultad y quién lo ve (mesa / DJ / secreta). La **Deflagración** se tira aparte, tecleando los metros. |

### «Tirar en su nombre» — cómo quedó (2026-08-21)
Era la cabecera del spec y lo que justificó meter las especialidades como dato. Hasta el 2026-08-21 el botón
abría el **lanzador libre**, que tiraba dados sueltos y tiraba la criatura a la basura; el dueño lo rechazó
(«no lo que establecimos»). Construido en `ui/CreatureRollPopover.tsx` + `domain/useCases/creatureRoll.ts`,
diseño en el `.pen` «Bestiario/Tirar por una criatura · popover».

- **No duplica la matemática de dados.** Arma la forma de ficha que el motor del sistema ya sabe leer y
  delega en `engine.poolFor`. Las reglas viven en el paquete del sistema y sólo ahí — con las reglas manda
  el manual (regla del dueño, 2026-08-17).
- **Sin penalización por heridas**: una criatura lleva Resistencia, no estado de salud, y el libro no le
  resta dados por estar dañada. Restárselos sería inventarse una regla.
- **Nunca coge dados de la Reserva de Destino**: la reserva es de la mesa, de los jugadores (p.88). Si el
  director le robara dados al grupo sin que se viera, sería un agujero de juego, no un detalle.
- **Un PNJ aliado tira con SU ficha de personaje**, con sus dones, su armadura y su penalización por heridas.
- **Una característica ausente no se ofrece**: el manual deja bloques sin publicar entera (el mutante), y
  ausente no es 0.
- El Registro lo titula **«{criatura} · {característica}»**, ya traducido, porque el nombre es texto libre
  del director y no existe en ningún diccionario: el Registro es acta de lo que pasó, no plantilla.

### Los ataques y las capacidades del bloque (2026-08-21, tanda 3)
Diseño aprobado en el `.pen` «Bestiario/Tirar por una criatura · popover» y su gemelo «· Deflagración».

- **Los ATAQUES que imprime la caja** (Baal: «Espada oriental 9, daño 10») salen como una fila propia,
  «¿CON QUÉ ATACA?», con «a mano» delante. Elegir uno tira **los dados del ataque**, no los de la
  característica: la diferencia con su Combate entra como la bonificación del arma que el motor ya sabe
  sumar, y el daño impreso viaja tal cual. **Se copian, no se recalculan** (RULES.md §8.0).
- **La casilla «es de noche»** va en la propia tirada, no en la escena (decisión del dueño, 2026-08-21):
  meterla en la escena pedía migración y diseño nuevo del mapa. Sólo sale si alguna de las capacidades de
  esa criatura depende de la hora.
- **Las capacidades que podrían aplicar** las decide el motor (`autoSuccessOptions`) según la característica
  y la hora, y **las marca el director**, como la especialidad: el motor no puede saber si la tirada es
  «para intimidar o liderar», que es lo que pide el Aura (p.107). Suman **éxitos automáticos**, que no son
  dados y por eso se pintan en oro y fuera del contador. Lo marcado que deja de encajar deja de contar.
- **La Deflagración** es un ataque APARTE: no se tira con ninguna característica —los dados salen de su
  puntuación, uno menos por metro—, se resuelve como reto a dificultad 1 y su desglose del Registro **calla**
  en vez de decir «3 Combate», que sería mentira. Los metros los teclea el director; cuando existan los
  ataques sobre el mapa, la distancia saldrá de ahí.
- **Sólo hay versión oscura**: dentro de una campaña manda el tema del sistema (el papel de Plenilunio), no
  el claro/oscuro de la app.

### La foto de la entrada (2026-08-21)
Se pinta con `object-fit: contain`, **nunca `cover`**: una foto que no fuera cuadrada salía recortada y el
director veía media criatura. El fichero subido está intacto — el compresor escala por el lado largo y
respeta la proporción —, así que el recorte era sólo al pintarla. La caja mantiene su alto para que la
rejilla no se descuadre; lo que sobra enseña el papel.

### Atacar CON el token de una criatura (2026-08-21, `.pen` columna 6)
El botón **ATACAR** sale en la barra del token cuando el director selecciona una criatura (nunca sobre un PJ),
y abre `ui/TokenAttackModal.tsx`, portado 1:1 de `Modal/Atacar con el token`.

- **No hay lista que crezca**: se ataca desde el bicho que se está mirando, así que da igual cuántas criaturas
  haya en la escena. Es la idea del diseño, literal.
- **La distancia la mide el mapa** (1 casilla = 1,5 m) y de ahí sale todo: cuerpo a cuerpo hasta 3 m (dos
  casillas, ⚠ lectura nuestra: el libro no juega en rejilla), y más allá el alcance con su dificultad
  (`rangeForMetres`, p.95–96). Pasado el muy largo el botón se apaga: no se le puede disparar.
- **Los dados los pone el director**, con su ataque impreso o su Combate como punto de partida: el libro le
  deja repartir el Combate entre varios ataques y defensas del turno (p.94).
- **¿CON QUÉ ATACA? (2026-08-22, pedido del dueño)**: si el bloque imprime **varios ataques**, una fila de
  chips para elegir — un chip por ataque impreso (nombre · dados · daño) más **A MANO** (su Combate a secas,
  daño de Fortaleza p.97). El elegido manda: sus dados son la base del contador y su daño viaja con la
  tirada. Con un solo ataque impreso (o ninguno) la fila no sale. Dibujado en el `.pen` (ejemplo Soum).
  Selección en **rojo sangre**, como todo el circuito de atacar (decisión del dueño, 2026-08-22).
- **Regla p.95** («sin ellas simplemente no se puede atacar a distancia»): a distancia se apagan los ataques
  de c/c; el dato vive en `CreatureAttack.ranged`. ⚠ **Hueco de datos anotado**: ningún bloque copiado lleva
  aún sus armas de fuego (el libro las imprime con bonificación y daño en los bloques humanos — rifle
  automático, escopeta galga…); mientras dure, A MANO sigue valiendo a distancia para no dejar a las
  criaturas del catálogo sin disparo. La pasada de datos con el PDF delante va con la tanda del panel.
- **El daño**: el impreso de su caja si la tiene; si no, sin armas, que el libro paga con su Fortaleza (p.97).
- **La criatura sale del bloque del que se colocó el token**: del catálogo si es del manual (`bestiaryRef`), de
  la fila del director si es propia (`bestiaryEntryId`). El nombre es el DEL TOKEN.
- **La hora sale del mapa, no de una pregunta**: la escena ya tiene interruptor de día/noche
  (`scene.lighting`), y hay criaturas que cambian con él (dueño, 2026-08-21). El modal ofrece las
  capacidades que podrían aplicar al Combate según esa hora —de noche el Amparo de la noche, de día
  ninguna nocturna— y las marca el director, como la especialidad. En el desplegable del Bestiario sí hay
  casilla de noche, porque allí no hay escena de la que leerla.
- **Cuerpo a cuerpo NO tira aquí** (2026-08-21): es un conflicto (p.93) y los dados de enfrente son los que
  el jugador gaste en defenderse, así que el ataque se queda **a la espera**, al jugador le salta el aviso
  (columna 5 del `.pen`) y la tirada sale cuando conteste. El modal lo dice antes de pulsar, para que el
  director no se quede esperando una tirada que no va a salir todavía. Un disparo sí sale en el acto, con
  su dificultad, porque es un reto y ahí no hay que preguntarle a nadie. El cómo está en
  [specs/modules/dice/SPEC.md](../dice/SPEC.md) § «El aviso que le salta al jugador».
- ⚠ **El daño SIGUE sin aplicarse solo**: el número lo calcula el motor, pero quien recibe el golpe lo
  teclea en «Recibir daño» de su ficha. Ya existe la respuesta del jugador, pero **el `.pen` no diseña
  dónde sale ese número**: hay que dibujarlo antes de construirlo.

### Las copias viejas heredan lo que no tenían (2026-08-21)
Una copia de un bloque del manual guarda sus valores el día que se duplica, así que las hechas ANTES de que
existieran las capacidades y los ataques salían mudas — «Aamel (2)» sin casilla de noche ni capacidades, visto
por el dueño. `withManualFallback` las rellena desde el bloque que dice `sourceRef`, y **sólo lo que falta**:
si la copia trae lo suyo, manda la copia.

**Lo que sigue siendo H6 y NO está aquí**: el panel del director completo —pedir tirada a los jugadores
(mantener pulsada una característica y elegir dificultad sin soltar), la lista de encuentros de la escena y
el botón ATACAR—. El `.pen` lo tiene diseñado en `Panel/Director`.

- **«N en escena»** estaba en el diseño y **se ha quitado del código**: necesita los tokens de la escena activa,
  que esta pestaña no carga. Mejor no tenerlo que tener un contador que nunca se pinta.
- **Un PNJ aliado no se puede duplicar** todavía: su ficha no ofrece «Duplicar». Los encuentros sí.
- **Exportar el token a PNG** no existe. El dueño ya cambió ese rótulo del `.pen` a «SUBIR IMAGEN (WEBP)», así
  que la línea del spec que lo pedía puede estar simplemente vieja.

### Alcance de esta tanda (dueño, 2026-08-20)
**El hexágono entero de una vez**, no una rebanada: listado + encuentros propios (crear, editar, duplicar, borrar)
+ **imagen por entrada** (obliga a construir el compresor de [core/images](../../core/images/SPEC.md), que hoy no
existe) + **PNJ aliados con ficha completa** + instancias en escena + **las especialidades como dato**.

### Estado real (2026-08-20)
Lo único que hay hoy es el **bestiario base del sistema** (`catalogs.bestiary`), que sí está completo: los **37
bloques del manual** con sus siete características, Aguante, Destino, protección natural y página (RULES.md §8).
Eso es la semilla; todo lo demás está por construir.

## Las especialidades de las criaturas
El ogro tiene «Garrote» en Combate y el hambriento «Mordisco». Hoy **no son dato**: por eso el motor no puede
doblarles los triunfos aunque ya sepa hacerlo (`engine.ts`, `specialty: boolean`, p.83).

- **Pasan a ser dato de la entrada**, por característica: `data.specialties = { combat: ['ogre.club'], … }`.
- **El director la elige al tirar** (decisión del dueño): al tirar por el ogro ve las especialidades de esa criatura
  y marca la que aplica; entonces sus triunfos cuentan doble. **No se aplica sola** por característica — el garrote
  no sirve para esquivar.
- Son ~200 nombres que **no** están en la lista de especialidades de jugador (`SPECIALTY_ITEMS`), así que llevan
  **claves i18n propias** en es y en: `catalog.creatureSpecialties.{criatura}.{id}`.
- En los encuentros **propios** el director las escribe él (texto libre, sin clave i18n).

> ✅ **DESBLOQUEADO (2026-08-20).** El manual está en `~/Documents/Developer/Rolvium context/PlenilunioEbook.pdf`
> (fuera del repo, **desfase +2**: libro p.N = PDF p.N+2). Las especialidades **no estaban perdidas en la prosa**:
> el propio bloque de características imprime **una especialidad por característica** (Ogro → Fortaleza 8
> «Derribar paredes», Combate 4 «Garrote»…), y `-` cuando no la hay. Extraídas las de los 37 bloques con
> `pdftotext -layout`; tabla en `scratchpad/especialidades-criaturas.md`, lista para bajar a `catalogs.ts`.
> El mutante no lleva ninguna: el libro no imprime bloque suyo.

## Completar el bestiario del sistema contra el manual
Leyendo el PDF para sacar las especialidades aparecieron **8 bloques que el catálogo no tiene**, todos con sus
siete características y su Aguante, en el mismo formato que los demás: **Azelías** (lugarteniente solar, p.132),
**Silhouette** (p.57), **Big Dima** (p.59), **Hermana de las Trece Lunas** (p.67), **Jacobista** (p.67),
**George** (cocinero caníbal, p.68), **Diane** (carroñera, p.74) y **Allen Dallas «el Americano»** (p.74).

El comentario del catálogo («los 37 bloques completos, contados uno a uno sobre el PDF») **es incorrecto**: son 45.
**Y los 45 tampoco eran todos**: el libro imprime otros doce en cajas de lunas —los once personajes con nombre y el
Salteador—, bajados al catálogo el 2026-08-21 con sus especialidades, sus capacidades como dato y sus ATAQUES
(RULES.md §8.0). El catálogo tiene **57**.
Entran en esta tanda (decisión del dueño, 2026-08-20), junto con las especialidades, porque es el mismo fichero y
el mismo momento — separarlo obliga a releer el manual otra vez. Valores en `scratchpad/especialidades-criaturas.md`.

Dos atribuciones mal puestas que se descubren al añadirlos, y que **no son error de valores**:
- `cannibalCook` (p.69) es **Will**: el manual imprime TRES cocineros caníbales (Maggie p.68, George p.68, Will p.69).
- `scavenger` (p.74) es **Kharla**: son DOS carroñeras (Kharla y Diane).
Renombrarlos es cosmético y va aparte; sus valores de juego son correctos tal y como están.

## Rules & limits
- Nada de este hexágono es visible por API a un jugador salvo los tokens visibles de la escena (vía `maps`).
- Instanciar no modifica la plantilla; borrar la plantilla no borra instancias ya colocadas.
- Las entradas "del manual" no reproducen texto del libro: solo valores de juego y resúmenes propios.
- **Ámbito de un encuentro propio** (decisión del dueño): al crearlo hay una casilla **«guardar para todas mis
  campañas»**. Sin marcar → vive solo en esa campaña. Marcada → el director lo ve en cualquier campaña que dirija.
  Se puede cambiar después editando la entrada.
- Las entradas del manual **no se editan ni se borran**: para cambiar una, se duplica y se edita la copia.
- Una instancia colocada guarda **su propia Resistencia** y su estado; dos ogros en escena se hieren por separado.
- La Resistencia de una entrada es Aguante × 3 (p.25) y **no se teclea**: se calcula, como en cualquier personaje.
- El mutante y cualquier bloque incompleto conservan características **sin valor** («—»): no se inventan.

## Connections
`game-system` (bestiario base, engine para tirar), `characters` (Sheet, generador), `maps` (tokens/instancias),
`dice` (tiradas del DJ), `realtime`, [core/images](../../core/images/SPEC.md) (token de la entrada).

## Out of scope
- Importar bestiarios de fuera (JSON, compendios de otras herramientas).
- Que un jugador vea la ficha de una criatura, ni siquiera de un aliado.
- IA de comportamiento o turnos automáticos.
- Limpieza de imágenes huérfanas en el bucket (ver core/images).

## Modelo de datos
Migración: `supabase/migrations/20260820000000_bestiary.sql`. Una sola tabla nueva.

**`bestiary_entries` — los encuentros PROPIOS del director.** Guarda lo que el director inventa: copias
ajustadas de una criatura del manual («otro mutante»), PNJ suyos y aliados con ficha completa. De cada uno
guarda el nombre, sus características y valores de juego, las notas, la imagen del token si la tiene, y de
qué criatura del manual se copió (para conservar la referencia a la página del libro).

**Las criaturas del manual NO están en esta tabla**: son datos del paquete del sistema de juego, en el código.
Meter las 57 en la base duplicaría 57 filas por campaña sin ganar nada, y sobre sus valores manda el manual.
El listado une las dos fuentes: el catálogo alimenta el filtro «Manual» y la tabla los filtros «Propios» y «PNJ».

**Las criaturas colocadas en escena tampoco están aquí.** Una instancia es un token del mapa (`maps_tokens`),
que ya tenía un hueco libre para guardar su propio estado; ahí vive la Resistencia de ESE ogro concreto. La
migración sólo le añade el enlace a la plantilla. Ese enlace **se rompe con cuidado**: si el director borra la
plantilla, los tokens ya colocados siguen en la escena con su nombre y su Resistencia, como pide la regla de
arriba — no desaparecen de la mesa a mitad de partida.

**«Guardar para todas mis campañas»** se resuelve dejando la campaña **en blanco**: sin campaña, la entrada es
del director y la ve en todas; con campaña, vive sólo en esa. Cambiar la casilla después es editar ese dato.

### Quién lee y quién escribe
**Sólo el director, y sólo lo suyo.** Un jugador no puede leer ninguna fila de esta tabla, ni siquiera la de un
PNJ aliado de su propio grupo. La condición es doble a propósito: hay que ser el dueño de la entrada **y**,
si cuelga de una campaña, seguir siendo su director — así una entrada no sobrevive a que la dirección de la
campaña cambie de manos. Lo único que llega al jugador es el token visible en la escena, que se rige por las
reglas de `maps` y no se han tocado.

### Comprobado
- `supabase migration up --local` aplicada limpia.
- `supabase db lint --local --level error` → **sin resultados**.
- `npm run audit` → **0 hard**, 9 warn, todos preexistentes (maps, dice, UserMenu — ninguno de esta tanda).
- Contra la base: RLS activada, dos políticas, ambas `TO authenticated` y ninguna `TO anon`.
- Foto de los advisors de producción ANTES de esta rama: 0 críticos, 21 WARN (ver `WORK_STATE.md`).
