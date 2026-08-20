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
escena une ahora las 45 del manual con los encuentros propios, y colocarlos crea una instancia enlazada a su
fila (`maps_tokens.bestiary_entry_id`, ON DELETE SET NULL). Los PNJ aliados abren el **mismo `<Sheet>`** que
un personaje jugador, con su ficha guardada en `data.sheet` de la entrada.

**Dos decisiones de esa ficha de PNJ, para que no se relean como despistes:**
- **No se guarda sola**, al revés que la de un PJ. Es una ventana que el director abre y cierra: un guardado
  automático dentro de un modal le deja sin saber si lo que tocó quedó guardado. Hay botón, y el botón avisa
  cuando hay cambios sin guardar.
- **Los números de un PNJ salen de su ficha**, no de `Aguante × 3`. Quien sabe leerla es el motor del sistema
  (`engine.derived`), así que entra por parámetro: el dominio del bestiario no conoce el esquema de fichas de
  ningún sistema. Si se calculara como una criatura, todos los PNJ saldrían con Resistencia 0.

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
Meter las 45 en la base duplicaría 45 filas por campaña sin ganar nada, y sobre sus valores manda el manual.
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
