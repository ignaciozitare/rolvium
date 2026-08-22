# Reglas de *Malefic Time: Plenilunio* — digesto de referencia

**Propósito.** Resumen estructurado, en palabras propias, de las mecánicas que implementa
`packages/system-plenilunio`. Cada sección remite a la página impresa del manual (NoSoloRol).
Solo se copian *valores de juego* (números, tablas, nombres de dones/armas/armaduras/especialidades/tamaños,
costes); nunca párrafos del libro.

> **El manual manda; ante duda, este archivo se corrige contra el libro.**
> Lo marcado con «⚠ interpretación» es una decisión nuestra donde el manual calla o es ambiguo.

---

## 1. Creación de personaje (pp. 18–25)

### 1.1 Concepto (p. 18–19)
Frase corta sin efecto mecánico; guía el resto de la creación.

### 1.2 Características (p. 20–21)
Siete: **Fortaleza, Combate, Voluntad, Astucia, Sutileza, Presencia, Cultura**.
Humanos: 1–5. Excepcionales: 6. Seres míticos: 7 o más.
Reparto inicial estándar: 21 puntos, mín. 1 y máx. 5 por característica.
Tabla de repartos (p. 21):

| Reparto             | Puntos | Máximo |
|---------------------|--------|--------|
| Supervivientes      | 16     | 5      |
| Precursores         | 21     | 5      |
| Héroes legendarios  | 25     | 6      |
| Seres míticos       | 30     | 10     |

### 1.3 Especialidades (p. 21–23)
Descriptor asociado a una característica; lista abierta. Cada personaje empieza con **una por característica**.
Canje: 1 punto de característica → 2 especialidades extra **en dos características distintas**.
Un segundo canje solo con permiso del DJ (máx. 2 canjes).
- **No es interpretación, se deduce del libro** (verificado contra el PDF, p.23): cada canje reparte sus 2 extra en
  DOS características distintas, así que por característica el techo es **1 + nº de canjes** (máx. 3 con los dos
  canjes) y el total es **11** (7 + 2×2). Es lo que aplica el generador, al elegir.
- Lo que el libro da como **consejo al DJ y no como regla**: «debería pensárselo muy bien antes de permitir que un
  personaje tenga más de dos especialidades en la misma característica, especialmente en Combate». No se codifica.

Lista del manual (por característica):
- **Fortaleza (19):** Acrobacias, Atletismo, Bebedor, Buceador, Cargar, Ciclismo, Danza, Derribar puertas, Equilibrio, Escapismo, Esprintar, Mantenerse despierto, Montar, Nadar, Parkour, Saltar, Trepar, Vigor, Zafarse.
- **Combate (21):** Arcos, Armas arrojadizas, Armas contundentes, Armas cortas, Armas improvisadas, Armas pesadas, Artes marciales, Ballestas, Bastones, Escopetas, Escudos, Espadas, Hachas, Lanzas, Lucha libre, Mazas, Navajas y cuchillos, Pelea sucia, Redes, Rifles, Subfusiles.
- **Voluntad (18):** Adivinación, Autoestima, Concentración, Constancia, Fanatismo, Fe, Hipnosis, Inocencia, Integridad, Intuición, Mantener fachada, Meditación, Paciencia, Perseverancia, Resistir dolor, Ritos, Templanza, Valor.
- **Astucia (21):** Anticipación, Buscar, Callejeo, Carpintería, Cocinar, Conducir, Detectar mentiras, Enigmas, Entrenar animales, Herrería, Investigar, Moverse a ciegas, Orientación, Percepción, Pilotar, Sentido del peligro, Sentido del tiempo, Sueño ligero, Supervivencia, Vigilancia, Vista penetrante.
- **Sutileza (16):** Actuación teatral, Camuflaje, Chantaje, Disfrazarse, Disimular, Emboscar, Esconderse, Fingir, Imitar, Juegos de azar, Maña, Moverse en silencio, Ocultar, Regatear, Seguir, Ventriloquía.
- **Presencia (16):** Cantar, Charlatanería, Cortesía, Empatía, Erotismo, Humor, Inspirar, Interrogación, Intimidar, Liderazgo, Mímica, Negociar, Poesía, Seducción, Tortura, Trato con animales.
- **Cultura (16):** Arte, Ciencias, Historia, Humanidades, Idiomas, Informática, Leyendas, Medicina, Nueva York, Ocultismo, Primeros auxilios, Psicología, Religión, Tácticas, Tecnología, Teoría de la conspiración.

### 1.4 Destino inicial (p. 23; p. 88)
Empieza en **3**. Canjes: +1 Destino por cada punto de característica gastado (máx. +2 → 5);
−1 Destino devuelve 1 punto de característica; un segundo −1 solo con permiso del DJ (mín. 1).
Rango inicial efectivo: **1–5** — p. 88, literal: «cada personaje jugador comenzará el juego con una
puntuación de Destino entre 1 y 5».
- **No es interpretación, el libro lo dice** (p. 88): «El Destino puede adoptar puntuaciones entre 1 y 10», y
  el 10 es el final del camino («la puntuación llega a 10 puntos y el destino queda totalmente revelado»).
  Así que el **10 de la ficha es la regla del libro**, no un límite de validación inventado: en juego el
  Destino sube por progresión (y cada subida da 1 punto de don, p. 89) hasta ese tope. Al **crear**, 1–5.

### 1.5 Dones en creación (p. 23–25; detalle p. 102+)
Puntos de don iniciales = **Destino**. Se reparten libremente entre dones (nivel máx. inicial **5**).
Canje: 1 punto de característica → **2 puntos de don**. **Máx. 2 canjes**, el segundo con permiso del DJ.
- ⚠ interpretación **decidida por el dueño (2026-08-19)**, verificada contra el PDF. El libro (p.25) dice
  «Puede gastarse **un punto** de característica para recibir dos puntos de dones adicionales» y no añade
  cláusula de límite; la sección hermana de especialidades (p.23) sí es explícita: «solo se puede gastar un
  único punto de característica de este modo», y un segundo sólo si el DJ lo permite. Se lee **calcado a
  especialidades**: un canje, dos con permiso del DJ.
- El segundo canje **asume** ese permiso, igual que ya lo asume `MAX_SPECIALTY_TRADES`. El interruptor real del
  director es una **opción de campaña** y es su propia rebanada (migración + RLS + spec); cuando exista
  gobernará los dos canjes, no sólo éste.
- El tope rige **las dos** lecturas de la regla: el presupuesto de creación (`budgetOf`) y los puntos de don
  de la ficha viva (`derived`). Por eso `MAX_GIFT_TRADES` vive en `catalogs.ts` y no en `generator.ts`
  (`engine.ts` no puede importar del generador sin ciclo). Cuando sólo lo aplicaba el generador, una ficha
  guardada con más canjes enseñaba puntos de don inflados para siempre — hallazgo del QA, 2026-08-19.
  Decisión del dueño: **capar también en `derived`**, no indultar las fichas viejas.
Cada vez que sube el Destino se recibe **1 punto de don** nuevo (p. 89).
- Además del tope de 2, frena lo que puedas **pagar**: no se canjean puntos de característica que no tienes.
  El generador veta en los dos sitios, y ambos topes capan sólo la SUBIDA (un borrador ya pasado se repara).
- ⚠ interpretación: **un don no se repite**; un don tiene UN nivel (1–5, §7), así que dos filas del mismo don
  serían un nivel por encima del tope por la puerta de atrás. Para tener más, se sube el nivel.

### 1.6 Últimos cálculos (p. 25)
- **Aguante** = Fortaleza + Voluntad ± modificador de tamaño.
- **Resistencia** = **3 × Aguante, siempre** (p. 25, literal: «Son iguales al triple del Aguante»). Es el tamaño
  de la PISTA, y se fija al crear el personaje: la hoja impresa tiene hueco para 30 casillas y «sombrea los puntos
  sobrantes y deja los cuadrados en blanco correspondientes a tu Resistencia». Karen, con Aguante 7, tiene 21.
  El estado de salud **no encoge la pista**: lo que limita es **cuánto recuperas descansando** (§6.3).
  - ⚠ interpretación: la regla es 3×Aguante sin tope; no aplicamos tope de 30 (un héroe legendario 6+6 tiene 36).
  - Cómo se leen las casillas (p. 25, literal): «sombrea los puntos sobrantes y deja los cuadrados en blanco
    correspondientes a tu Resistencia **para poder tacharlos durante el juego**». En la hoja impresa hay tres
    estados: *sombreado* = casilla que no tienes (de las 30 impresas, las que pasan de tu Resistencia),
    *en blanco* = Resistencia disponible, *tachado* = daño recibido.
  - ⚠ interpretación (ficha digital): pintamos exactamente `resistanceMax` casillas, así que el estado
    *sombreado* no existe — no hay sobrantes que sombrear. Quedan los otros dos: **en blanco = lo que te
    queda**, **marcada (bordó) = daño**, y el daño se marca por delante, de izquierda a derecha, como se
    tacha en papel. Pulsar la última marcada la devuelve.
- **Fortuna máxima** = Destino; se empieza con la Fortuna al máximo (p. 25: mismo texto de sombrear los
  excedentes y dejar en blanco tantas casillas como el Destino). En la ficha digital la Fortuna es un
  `counter`, no `boxes`, así que la lectura de casillas no le aplica hoy.

Tamaños (p. 25):

| Tamaño   | Estatura | Peso  | Aguante | Ejemplo        |
|----------|----------|-------|---------|----------------|
| Diminuto | 50 cm    | 2 kg  | −2      | gato, bebé     |
| Pequeño  | 90 cm    | 20 kg | −1      | perro, niño    |
| Mediano  | 1,7 m    | 70 kg | 0       | humano, alado  |
| Grande   | 4 m      | 1 t   | +1      | ogro           |
| Enorme   | 8 m      | 9 t   | +2      | dragón         |

⚠ Interpretación (mapa): el libro da estaturas y un modificador de Aguante, **no** huellas en casillas. La
casilla del mapa mide 1,5 m, así que la huella literal sería estatura ÷ 1,5 (mediano 1,13). A eso se le aplica
el aumento de LEGIBILIDAD que pidió el dueño el 2026-08-21 —«un 50% más para tamaño normal»—, que fija el
mediano en **1,5 casillas** y multiplica a todos por igual (×1,33) para conservar las proporciones del libro.
Redondeado al cuarto de casilla: **diminuto 0,5 · pequeño 0,75 · mediano 1,5 · grande 3,5 · enorme 7**.
Los bloques de criatura **no imprimen el tamaño** (el ogro de la p.152 trae Aguante y Destino y nada más), así
que un token del bestiario se queda con el tamaño por defecto del mapa hasta que se les dé uno. Ojo, que eso
no es lo mismo que decir que el libro calla: la propia tabla de arriba pone de ejemplo **ogro** en Grande y
**dragón** en Enorme, y la aritmética lo confirma —el ogro imprime Aguante 10 con Fortaleza 8 y Voluntad 1,
o sea el +1 de Grande. Darle su tamaño a cada una de las 45 criaturas es leerse su descripción una por una,
y es su propia tanda; hasta entonces el valor por defecto es una decisión de PLAZO, no de reglas.

⚠ **Y NO se puede automatizar despejando** `Aguante − (Fortaleza + Voluntad)`. Comprobado sobre las 57
entradas del catálogo el 2026-08-22: sale bien en el ogro (+1) pero **falla en muchas**, y no siempre dentro
del rango legal −2…+2 — Fantasma **−3**, Paladín solar **−4**, Nathael **−8**, Marduk y Adán −1, Charlatán
iluminati +2, Jacobita y Nergal +1. Los bloques imprimen el Aguante como dato suelto y no siempre cuadra con
sus características. Quien lo automatice le pondrá tamaños inventados a media lista: hay que leerse el libro.

### 1.7 Equipo inicial (p. 25)
Sin tabla de precios; se pacta con el DJ. Orientación: ropa + muda; bolsa/mochila; un arma acorde a la especialidad
de Combate (arma de fuego/arco: 20–40 proyectiles; o 3–4 granadas); segunda arma si Combate ≥ 4; libros/portátil si
Cultura ≥ 3; herramientas del oficio si procede.

---

## 2. Mecánica básica (pp. 82–87)

### 2.1 Tirada (p. 82)
Se tiran tantos d6 como la característica implicada, siempre **enfrentados** a los dados del DJ (dificultad o
característica rival). Resultados: **1 fracaso · 2–3 fallo · 4–5 éxito · 6 triunfo**. Normalmente fracaso = fallo y
triunfo = éxito; solo algunas reglas distinguen fracasos/triunfos.

**No existe la tirada en el vacío.** Literal, p. 82: «Todas las acciones de Plenilunio se resuelven mediante
**tiradas opuestas** de grupos de dados de seis caras… el director lanzará un número de dados determinado por la
dificultad de la acción, si se trata de un reto, o por la característica del personaje que se enfrente al del
jugador, si se trata de un conflicto». Esos son los dados del otro lado del «vs» en el registro.

⚠ **Y el libro quiere que no se distingan** (p. 85, literal): «Como todas las acciones requieren tiradas opuestas,
Luis no sabe si el director de juego tira los dados porque hay otro personaje o porque es la dificultad de la
acción». Consecuencia para la ficha: el registro enseña los dos grupos y **no etiqueta** si el de la derecha es una
dificultad o un rival.

### 2.2 Especialidad (p. 83)
Si el DJ la considera aplicable, **cada triunfo propio vale 2 éxitos**. El DJ puede permitir aplicar la especialidad de
otra característica.

### 2.3 Retos y dificultad (p. 84)
Reto = obstáculo sin rival. El DJ tira los dados de dificultad y sus éxitos cancelan los del jugador. Los triunfos de la
dificultad valen 1 éxito (la dificultad no tiene especialidad).

| Dificultad  | Dados |
|-------------|-------|
| Fácil       | 1     |
| Media       | 2     |
| Difícil     | 3     |
| Muy difícil | 5     |
| Épica       | 6     |

Empate → resultado **ambiguo** (logra otra cosa, o lo logra con complicación, o la mitad).

### 2.4 Grado de éxito / fallo (p. 85)
Grado = diferencia de éxitos. Etiquetas propias:

| Diferencia | Éxito                                   | Fallo                                     |
|-----------:|-----------------------------------------|-------------------------------------------|
| 1          | Lo logra a duras penas / tarda más      | Falla por muy poco                        |
| 2          | Lo logra                                | Falla                                     |
| 3          | Lo logra rápido o con ventaja           | Falla y pierde tiempo o sufre desventaja  |
| 4+         | Absoluto: récord + consecuencia positiva| Absoluto: situación peligrosa / daño      |

Los triunfos son siempre los **últimos éxitos en cancelarse**; los triunfos de la oposición también cancelan primero
éxitos normales.

### 2.5 Conflictos (p. 85)
Dos personajes tiran su característica (misma o distinta, decide el DJ); el rival **sí** puede aplicar su especialidad
(sus triunfos valen 2). Se compara como en 2.4. Empates: se mantienen si tienen sentido; si no, se repite la tirada.

### 2.6 Revés (p. 86)
Ningún éxito ni triunfo en la tirada **y** al menos un fracaso → además de fallar, ocurre una circunstancia adversa.
- ⚠ interpretación: los dados de Destino añadidos cuentan como parte de la tirada a estos efectos.

### 2.7 Reglas avanzadas (p. 86–87)
- **Acciones prolongadas** (p. 86): el DJ fija éxitos a acumular; los éxitos netos de cada tirada se suman; un revés
  borra lo acumulado.
- **Acciones conjuntas** (p. 87): coordina quien tenga la característica más alta; cada ayudante con característica
  ≥ mitad de la del coordinador añade +1 dado.
- **Herramientas** (p. 87): herramienta adecuada +1 dado, excelente +2; no acumulables (vale la mejor).
  Literal: «se asume que el personaje que realiza la acción cuenta con las herramientas mínimas necesarias…
  Si el personaje cuenta con herramientas adecuadas o de más calidad, **añade uno o dos dados**», y «la
  bonificación por herramientas **no se acumula** si el personaje utiliza varias herramientas al mismo tiempo.
  En ese caso **se añaden solo los dados que añada la mejor herramienta**».

### 2.8 Techo de los dados extra — ⚠ interpretación (p. 87, p. 96, p. 101)
**El libro NO da un máximo global de dados extra**, así que el techo de la app se construye caso por caso con lo
que sí escribe (orden del dueño, 2026-08-21; antes no había techo ninguno y se llegaba a 30 dados con Combate 4):

| Caso | Techo | Dónde |
|---|---|---|
| **Herramientas y accesorios** — el caso normal | **2** | p. 87 «añade uno o dos dados», y no se acumulan. Los accesorios de las armas a distancia (miras láser, telescópicas) son lo mismo: p. 96 dice que dan dados extra y no pone número. |
| **Atención médica**, antes de una tirada de recuperación | **4** | p. 101: «el grado de éxito que obtenga [el médico] se convierte en dados extra… en su próxima tirada de recuperación», y la tabla de grados de la p. 85 llega hasta **4** («de forma absoluta»). La tirada de recuperación es de **Fortaleza**. |

**NO gastan de este techo**, porque no son «lo que se añade a mano»: la **bonificación del arma** cuerpo a cuerpo
(p. 87/97, 1–2 dados, y «tres o más» las excepcionales de la p. 157) la pone el motor aparte, y los **dados de la
reserva de Destino** (§3.2) van en su propio grupo.

Lo mismo vale para el **ataque impreso de un bloque de bestiario** («Mandoble 11»), que es Combate más la
bonificación de su arma (p. 97): su diferencia con el Combate viaja como bonificación del arma y no como dado
extra, en las dos vías —tirar en su nombre y atacar desde su token del mapa—. El caso que lo prueba es
**Malefic a dos manos** (p. 163): el libro le da «bonificación +4», y Luz-Malefic ataca con 10 teniendo Combate 6.
Metido en los dados extra, el techo de dos se lo comería y tiraría 8.

⚠ Interpretación: el techo de la atención médica se aplica a **cualquier** tirada de Fortaleza, porque la app aún
no distingue la tirada de recuperación de las demás. Peca de generoso ahí, y es preferible a dejar fuera el único
caso del libro que pasa de dos.

⚠ **Lo que queda fuera a propósito**: las **acciones conjuntas** (p. 87, +1 dado por ayudante) tienen un tope que
depende de cuántos apoyen, y el libro lo deja expresamente «en manos de la lógica de la situación y, en última
instancia, en la decisión del director de juego». La app no modela la acción conjunta todavía; cuando la modele,
su techo saldrá de ahí y no de esta tabla.

**Es un TECHO y nada más**: un `extraDice` NEGATIVO —tirar con menos dados de los que se tienen— es legítimo y no
se toca. Es como el director reparte su Combate entre los ataques y defensas de su turno (p. 94).

---

## 3. Destino, reserva y Fortuna (pp. 88–90)

### 3.1 Puntuación de Destino (p. 88)
De **1 a 10**. PJ empiezan 1–5. Al llegar a 10 el destino se cumple: última aventura del personaje.

### 3.2 Reserva de dados de destino (p. 88–89)
- La aventura tiene una reserva compartida (**10 por defecto**; 5 o más según la aventura). Solo los jugadores la usan; el DJ no.
- Un jugador puede coger **hasta 5 dados** por acción; los usados se agotan hasta la siguiente aventura.
- Los dados de reserva funcionan como dados normales pero **sus triunfos siempre valen 2 éxitos**.
- Si sale **algún triunfo** en dados de reserva: **Destino +1** inmediato y **Fortuna = nuevo Destino**.
- La reserva puede crecer por algunos dones o por giros de trama (+2/+3 dados).
- Con **Destino 10** ya no se puede usar la reserva (p. 90).

### 3.3 Fortuna (p. 89–90)
**Máximo = Destino**, y es un tope duro, literal (p. 90): «los puntos de Fortuna de un personaje **nunca pueden
llegar a ser mayores que la puntuación de Destino** del personaje». No hay tope propio de 10: el 10 es de Destino
(§3.1) y la Fortuna lo hereda. Se empieza cada aventura al máximo. Usos:
1. **Activar un don**: 1 punto.
2. **Reducir la severidad de una herida**: 1 punto por nivel de herida reducido (se pierde Resistencia igualmente).
3. **Recobrar el aliento**: 1 punto → recupera la mitad de la Resistencia perdida.
   - ⚠ interpretación: mitad redondeada hacia abajo.
4. **Elemento dramático**: 1 punto (el DJ puede pedir 2–3).
5. **Adelantarse** en el orden de actuación: 1 punto.

Recuperación de Fortuna: al subir Destino (se iguala al nuevo Destino); +1 por cada dado que un giro de trama añada
a la reserva (no por dones); al empezar historia (completa). Nunca supera el Destino.
Al alcanzar Destino 10 se recarga por última vez.

---

## 4. Experiencia (pp. 90–91)
Al acabar la aventura: 1–10 px (dificultad 1/3/5 · éxito 1/3 · idea genial 1 · interpretación 1).
Costes (p. 91):

| Mejora                                             | Coste |
|----------------------------------------------------|-------|
| +1 característica, hasta 5                         | 20 px |
| Característica de 5 a 6                            | 40 px |
| Nueva especialidad                                 | 10 px |
| Cambiar una especialidad por otra                  | 3 px  |
| Nuevo don a nivel 1 / +1 nivel de don (máx. 5)     | 10 px |

- ⚠ interpretación: el manual no da coste por encima de 6 → con px el tope es **6** aunque el reparto de creación
  permita más (seres míticos hasta 10).

---

## 5. Combate (pp. 92–97)

### 5.1 Turnos y orden (p. 92–93)
Orden por **Destino** descendente; empate: PJ antes que PNJ; entre PJ, mayor Combate; si persiste, decide el DJ.
1 Fortuna → adelantar el turno (el nuevo orden se mantiene).

### 5.2 Cuerpo a cuerpo (p. 93–95)
Conflicto Combate vs Combate. El defensor elige cuántos dados de Combate gasta en defenderse; los gastados se restan de
su siguiente turno (puede tomar dados solo de su siguiente turno). Ataques/defensas múltiples: se reparten los dados.
Los éxitos con que el ganador supera al rival calculan el daño.
- Armas c/c: **bonificación** +1/+2 dados a Combate (excepcionales +3). Armas de fuego usadas c/c: +1. Arcos/ballestas c/c: sin bonificación.
- La bonificación se suma antes de repartir dados.

### 5.3 A distancia (p. 95–96)
Reto de Combate contra la dificultad del alcance (no un conflicto). Las armas a distancia no dan dados extra
(sí accesorios como miras).

**Qué es cada cosa, con las palabras del libro**: cuerpo a cuerpo es estar «a solo unos pasos de distancia,
lo suficientemente cerca **como para tocarse**» (p.92); a distancia es estar «separados lo suficiente como
para **no poder tocarse** rápidamente (**a más de tres pasos**)» (p.95). El libro mide entre los PERSONAJES
— si pueden tocarse — así que en el mapa la distancia que decide es el **hueco entre los cuerpos de los
tokens (borde a borde)**, no entre sus centros: dos tokens pegados están a 0, mida lo que mida cada cuerpo.
⚠ interpretación sólo en el cambio de unidad: un paso ≈ 1 m → el límite del cuerpo a cuerpo son 3 m (dos
casillas de 1,5 m). Medirlo de centro a centro castigaba a los cuerpos grandes — con tokens de 1,5 casillas,
la misma separación visual que antes era cuerpo a cuerpo salía «a corta distancia» (regresión del
2026-08-22, cazada por el dueño al atacar con el Lunar pegado a Karen).

| Alcance                | Dificultad |
|------------------------|------------|
| Corto (hasta 20 m)     | Media (2)  |
| Medio (hasta 50 m)     | Difícil (3)|
| Largo (hasta 200 m)    | Muy difícil (5) |
| Muy largo (hasta 800 m)| Épica (6)  |

Ponerse a cubierto: reto de Combate o Astucia (la mayor) a dificultad 1/2/3/5 según cobertura; si tiene éxito, la
dificultad de dispararle recibe **+2 dados**.

### 5.4 Otras acciones (p. 96–97)
Acciones menores en el turno si queda ≥1 dado; hablar/dar pasos: gratis.

### 5.5 Armas (p. 97)
Bonificación solo en alcance c/c. «F+n» = Fortaleza + n.

| Arma                     | Bonif. | Daño | Alcance   | Cargador |
|--------------------------|--------|------|-----------|----------|
| Sin armas                | –      | F    | C/C       | –        |
| Nudilleras               | –      | F+1  | C/C       | –        |
| Cuchillo                 | –      | F+1  | C/C       | –        |
| Bate                     | +1     | F+1  | C/C       | –        |
| Espada, lanza            | +1     | F+2  | C/C       | –        |
| Maza, hacha              | –      | F+3  | C/C       | –        |
| Bastón                   | +1     | F+1  | C/C       | –        |
| Espadón                  | +2     | F+3  | C/C       | –        |
| Hacha o maza a dos manos | +1     | F+4  | C/C       | –        |
| Arco compuesto           | –      | F+3  | Largo     | 1        |
| Ballesta                 | –      | 5    | Medio     | 1        |
| Tirachinas               | –      | F+1  | Medio     | 1        |
| Pistola de 9 mm          | +1     | 6    | Medio     | 15       |
| Revólver magnum .44      | +1     | 7    | Medio     | 6        |
| Subfusil                 | +1     | 8    | Medio     | 30       |
| Escopeta galga 10        | +1     | 10   | Medio     | 5        |
| Escopeta galga 12        | +1     | 9    | Medio     | 5        |
| Rifle de asalto          | +1     | 8    | Largo     | 30       |
| Rifle de francotirador   | –      | 10   | Muy largo | 15       |
| Granadas                 | –      | 8    | Corto     | 1        |

### 5.6 Daño (p. 97)
1. Cancelar éxitos uno a uno: **primero éxitos normales, después triunfos**. Un triunfo doblado (especialidad, dados de
   Destino) puede cancelarse **a medias**.
2. Lo que queda: **cada éxito = 1 daño; cada triunfo = daño del arma**; triunfo doblado = **2 × daño del arma**;
   triunfo doblado cancelado a medias = **1 × daño del arma**.
   - ⚠ interpretación: implementamos «unidades»: éxito = 1 unidad (daño 1); triunfo simple = 1 unidad (daño arma);
     triunfo doblado = 2 unidades (daño arma cada una). La oposición cancela unidades de éxito primero y luego de triunfo.
     El orden entre triunfos simples y doblados es irrelevante para el total.
3. **Protección** (armadura, piel gruesa, Manto de protección…) se resta del daño total; ≤0 → sin daño.

### 5.7 Armaduras (p. 97–98)

| Armadura              | Protección | Penalización |
|-----------------------|------------|--------------|
| Chaqueta de cuero     | 1          | 1            |
| Armadura de cuero     | 2          | 1            |
| Armadura pectoral     | 3          | 1            |
| Pieles                | 3          | 2            |
| Camisa de malla       | 5          | 3            |
| Chaleco antibalas     | 6          | 2            |
| Escudo pequeño        | 1          | –            |
| Escudo grande         | 2          | 1            |
| Escudo antidisturbios | 3          | 2            |

Penalización: en acciones físicas de coordinación/agilidad, **si la tirada tiene ≥1 fracaso**, tantos triunfos como la
penalización pasan a ser éxitos normales (si son menos, todos); un triunfo doblado pasa a éxito sencillo.

---

## 6. Salud (pp. 98–101)

### 6.1 Resistencia y heridas (p. 98)
Todo daño resta Resistencia. Resistencia 0 = al límite; **un punto más → inconsciente** (§6.2: la p. 101 lo
cuenta distinto y ahí está anotada la contradicción).
Si el daño de un golpe ≥ Aguante, además produce herida:

| Daño en un golpe   | Niveles de salud perdidos |
|--------------------|---------------------------|
| < Aguante          | 0                         |
| ≥ 1 × Aguante      | 1 (leve)                  |
| ≥ 2 × Aguante      | 2 (grave)                 |
| ≥ 3 × Aguante      | 3 (crítica)               |
| ≥ 4 × Aguante      | 4 → muerto (mortal)       |

Fortuna: 1 punto por nivel de severidad que se quiera reducir (§3.3).

### 6.2 Niveles de salud (p. 98–101) — son SEIS, y el sexto es Inconsciente
La tira de lunas de la hoja tiene **cinco** fases: **Sano · Magullado** (sin penalización) **· Herido** (−1 dado)
**· Malherido** (−2 dados) **· Muerto**. Perder todos los niveles = muerte.

Pero el libro anuncia «los personajes de Plenilunio tienen **seis niveles básicos de salud**» (p. 99) y en esa
página sólo caben cinco: **p. 100 es una ilustración a página completa y la lista continúa en la p. 101** con el
sexto, literal:

> «**Inconsciente:** El personaje ha perdido todos sus puntos de Resistencia por el daño acumulado durante un
> combate o por otras fuentes de daño, y queda inconsciente e indefenso en el suelo.»

O sea que **Inconsciente no es una rareza ni un añadido nuestro: es el sexto nivel del manual**. Lo que no es, es
una **fase de luna**: no va en la tira sano→muerto (que la hoja oficial dibuja con cinco) ni sustituye a ninguna —
se puede estar Herido **e** Inconsciente a la vez. Es un estado que **arrastra la Resistencia**, no las heridas.

⚠ **Contradicción del libro, sin resolver** (no inventamos cuál gana):
- **p. 98**: «Cuando lleguen a 0, el personaje está al límite de sus fuerzas: **si pierde un punto más**, caerá
  inconsciente.» → a 0 sigue consciente; cae al siguiente punto.
- **p. 101**: «ha perdido **todos** sus puntos de Resistencia … y queda inconsciente.» → a 0 ya está inconsciente.

**El motor sigue la de p. 98** (`applyDamage`: cae cuando el daño neto deja la Resistencia **por debajo** de 0), que
es la más explícita de las dos y la única que distingue «al límite» de «en el suelo». Por eso el estado se
**guarda** (`unconscious`) en vez de deducirse de `resistance === 0`: a 0 hay que recordar si se llegó al límite o
se pasó de él. Lo levanta `rest` (§6.3).

⚠ Interpretación (ficha digital): **no se elige a mano**. Es una consecuencia que calculan las reglas, como el
cargador de un arma, así que la ficha no ofrece desplegable: sale como **aviso** bajo las lunas cuando toca.

### 6.3 Recuperación (p. 101)
- Tras la escena, con descanso/elipsis: Resistencia al máximo si Sano/Magullado; si Herido, hasta **2 × Aguante**;
  si Malherido, hasta **1 × Aguante**.
- **Son DOS números distintos, y no se pueden confundir en uno.** El manual los da en dos sitios y con dos verbos:

  | Número | Dónde lo dice | Qué es |
  |--------|---------------|--------|
  | **Resistencia máxima** = 3 × Aguante | p. 25, creación | El tamaño de la PISTA. «Son iguales al triple del Aguante… deja los cuadrados en blanco correspondientes a tu Resistencia para poder tacharlos durante el juego.» Se fija al crear el personaje y **no cambia** con la salud. |
  | **Resistencia recuperable descansando** = ×3 / ×2 / ×1 el Aguante | p. 101, «RECUPERACIÓN» | Hasta dónde te sube **descansar**, según el estado. «Si se encuentra herido, **su salud se recupera** a dos tercios de su Resistencia»; malherido, «a un tercio de su Resistencia». |

  | Estado                | Pista (casillas) | Recuperable descansando |
  |-----------------------|------------------|-------------------------|
  | Sano · Magullado      | 3 × Aguante      | 3 × Aguante (todo)      |
  | Herido                | 3 × Aguante      | 2 × Aguante             |
  | Malherido             | 3 × Aguante      | 1 × Aguante             |

  Aguante 6: la pista son **18 casillas siempre**; descansando llegas a 18 sana, 12 herida, 6 malherida.

  ⚠ Interpretación: la frase de p. 101 dice, literalmente, «sus puntos de Resistencia máximos **pasan a ser** el
  doble de su Aguante, **en lugar del triple habitual**», y leída suelta parece encoger la pista. Se lee como el
  **tope de esa recuperación** y no como el tamaño de la pista, por tres razones: (a) está sólo bajo el epígrafe
  «RECUPERACIÓN» y el sujeto de la frase es *se recupera*; (b) «dos tercios de su Resistencia» sólo tiene sentido
  si «su Resistencia» sigue siendo el triple del Aguante; (c) la p. 25 fija las casillas **al crear el personaje**,
  y el libro no manda en ningún sitio borrar casillas ya dibujadas. El 2026-08-19 se leyó al revés —se fundieron
  los dos números en uno— y Karen, herida, enseñaba 12 casillas en vez de 18. **Corregido el 2026-08-21 contra el
  PDF, por orden del dueño: «el manual pdf manda».**

  ⚠ Interpretación: se capa la **subida**, nunca la bajada — una ficha puede llevar más Resistencia de la que
  le devolvería un descanso, y esos puntos son suyos (descansar no QUITA Resistencia ya marcada).
- **Recobrar el aliento** (p. 89, 1 Fortuna) cura «la mitad de los puntos de Resistencia perdidos»: lo perdido se
  mide contra la **pista** (3 × Aguante), no contra el recuperable — no es descansar, y el libro no le pone el
  tope del estado de salud (§6.2).
- Heridas: reposo + tirada de Fortaleza; éxito = +1 nivel de salud; fallo = igual; **revés = −1 nivel** (Malherido → muere).

| Estado     | Tiempo      | Dificultad |
|------------|-------------|------------|
| Magullado  | 1 día       | 2          |
| Herido     | 1 semana    | 3          |
| Malherido  | 2 semanas   | 4          |

Sin reposar: +1 dado de dificultad; actividad peligrosa/insalubre: +2. Atención médica: tirada de Cultura del médico a
la misma dificultad; su grado de éxito = dados extra en la próxima tirada de recuperación.

---

## 7. Dones (pp. 102–107)
Todos cuestan **1 Fortuna** al activarse. Nivel 1–5. Puntuación de don = «éxitos automáticos» o dados de tirada según el don.
Resumen propio (27 dones):

| Don | Resumen (propio) |
|-----|------------------|
| Alegoría de la realidad | Ilusiones visuales estáticas de tamaño humano sin tirada; conflicto don vs Astucia de quien mire para descreerlas; extras/mantener cuestan Fortuna. |
| Defensa de acero | Tantos dados de defensa como nivel contra cada ataque c/c recibido ese turno (no se reparten); 1 Fortuna por turno; nunca al atacar. |
| Fundirse con las sombras | +nivel éxitos automáticos al esconderse/moverse sin ser visto; o conflicto don vs Astucia en situaciones imposibles; resiste detección sobrenatural. |
| Furia de titán | +nivel éxitos automáticos en Fortaleza de fuerza/resistencia; proezas imposibles con tirada del don. |
| Gesto aciago | Daño a distancia por contacto visual: conflicto don vs Voluntad; daño del «arma» = Voluntad del atacante. |
| Golpe certero | +nivel éxitos automáticos en un ataque c/c (repartibles, ≥1 dado por blanco); ataques místicos usando el don en vez de Combate. |
| Guardián de la Palabra | +nivel éxitos automáticos en Presencia de liderazgo/convencer; retorcido: conflicto don vs Voluntad para inducir trance. |
| Hilos del espíritu | Prueba enfrentada don vs Voluntad para infundir una emoción; +nivel éxitos en Astucia para leer emociones. |
| Lengua de las bestias | +nivel éxitos automáticos tratando animales; comunicación real usando el don como Presencia. |
| Limpieza espiritual | Sobre otro: tirada del don; cada éxito permite repetir un fracaso futuro; cada triunfo devuelve 1 Fortuna; anula Palabra de condenación éxito por éxito. |
| Manantial interior | +nivel éxitos automáticos en tiradas de recuperación; regenerar miembros como acción prolongada (2/4/6 éxitos, 1 tirada/día a dif. 3). |
| Mano inmaterial | Telequinesia con contacto visual: el nivel sustituye a Fortaleza o Combate en esas acciones. |
| Manos curativas | Tirada del don a la dificultad de recuperación del objetivo (1 si Sano); cada éxito +3 Resistencia (hasta el máximo de su estado); cada triunfo +1 nivel de salud. |
| Manto de protección | Protección = **2 × nivel** contra el daño hasta tu siguiente turno. |
| Movimientos felinos | +nivel éxitos automáticos en Fortaleza de agilidad/equilibrio (nunca Combate); proezas imposibles con tirada del don. |
| Mudar la piel | Transformarse en un animal concreto cuya característica más alta ≤ nivel; conserva Voluntad, Astucia y Cultura. |
| Ojos del tiempo | Ver el pasado: tirada del don a dif. 1/2/3/4/5 (minutos/días/meses/años/siglos). Ver el futuro: dif. 3, los éxitos se añaden como dados a la reserva de destino. |
| Palabra de condenación | Conflicto don vs Voluntad; el margen son triunfos que la víctima deberá repetir; cada triunfo le quita 1 Fortuna. |
| Puerta ignota | Cruzar una puerta y salir por otra: tirada del don a dif. 2/3/4/5 según familiaridad; pasajero extra = +1 Fortuna y +1 dificultad. |
| Revelar debilidad | Tras impactar: tirada del don a dif. 2; cada éxito +1 al daño del arma; con ≥1 triunfo ignora la armadura. |
| Separación espiritual | Viaje astral inmaterial; el nivel sustituye a Fortaleza/Combate frente a seres inmateriales; el daño pasa al cuerpo. |
| Robo de vida | Conflicto don vs Voluntad con contacto visual; cada éxito roba 1 Resistencia, cada triunfo tantos como la Voluntad del atacante; recupera los niveles de salud que la víctima pierda. |
| Serendipia | +nivel éxitos automáticos en Astucia para buscar lo oculto; forzar hallazgos con tirada del don a dif. del DJ. |
| Telaraña del conocimiento | +nivel éxitos automáticos en Cultura de saberes; datos privados con tirada del don a dif. 5/4/3/2 según cuánta gente lo sepa. |
| Trance del destino | Involuntario, lo lleva el DJ; al terminar, tirada del don a dif. 2: cada éxito +1 Fortuna, cada triunfo +1 dado a la reserva de destino. |
| Ver las señales | +nivel éxitos automáticos en Astucia de percepción; tirada del don para ver lo oculto por magia (vs don rival o Voluntad). |
| Voz interior | Telepatía con contacto visual (más lejos con vínculo); si el objetivo resiste, conflicto don vs Voluntad. |

---

## 7.b Capacidades (pp. 107–108) — COMPLETADO CONTRA EL PDF, 2026-08-21

> Aquí sólo había **una lista de nombres entre paréntesis**, sin una sola regla. Es el ejemplo de lo que el
> dueño llamó «mirarlo por arriba». Transcritas ahora del PDF, una a una.

Son **poderes innatos de las criaturas no humanas**: «no requieren activarse ni involucran gasto de Fortuna.
Simplemente pueden usarse a voluntad». Las marcadas con **\*** tienen puntuación, como los dones; las demás
son todo o nada.

| Capacidad | Regla (del libro) | Motor |
|---|---|---|
| **Alado** | Alas y capacidad innata de volar. | — narrativa |
| **Aura\*** | **Sólo de día.** Añade tantos **éxitos automáticos** como su puntuación a **cualquier tirada de Presencia** que la criatura haga **para intimidar o liderar**. | ✅ `autoSuccessOptions` |
| **Aura sombría\*** | **Sólo de noche.** Añade tantos **éxitos automáticos** como su puntuación a **cualquier tirada de Sutileza** para **esconderse, moverse en silencio o pasar desapercibida**. | ✅ `autoSuccessOptions` |
| **Amparo de la noche\*** | **De noche** añade tantos **éxitos automáticos** como su puntuación **a su total de Combate cada turno**. Si divide sus dados de Combate entre varios ataques o defensas, **debe dividir igualmente esos éxitos automáticos**. | ✅ `autoSuccessOptions` (el reparto lo hace el director) |
| **Disfraz terrenal** | Disimula su naturaleza sobrenatural y parece **totalmente humana**. Se pone y se quita a voluntad. | — narrativa |
| **Piel de humano** | Disimula su aspecto, pero **un examen superficial la delata**: conserva cuernos, escamas u otros rasgos. En la distancia puede confundirse con un humano. | — narrativa |
| **Ira solar\*** | Incendia los objetos que lleva en las manos (normalmente el filo del arma). **Añade la puntuación de esta capacidad al daño del arma.** | ✅ `attackDamage(o, daño, iraSolar)` |
| **Ponzoña\*** | Inocula veneno por dientes o garras. **Cualquier ataque de la criatura que tenga éxito inyecta el veneno.** Resistirlo es un **conflicto entre la Fortaleza de la víctima y la puntuación de Ponzoña**. Si vence la criatura, **cada éxito = 1 punto de daño y cada triunfo = tantos puntos como la Ponzoña**. | ✅ `venomDamage` (ataque APARTE del principal) |
| **Piel gruesa\*** | Piel excepcionalmente dura: **cuenta como armadura natural cuya protección es igual a la puntuación**. | ✅ `protection` del bloque |
| **Hambre inhumana** | Come sin saciarse; su olfato la guía hacia nuevas fuentes de alimento y **le permite descubrirlas aunque estén ocultas o escondidas**. | — narrativa |
| **Ancla terrenal** | Su existencia está atada al mundo físico. **No puede ser destruida hasta que sea liberada del ancla.** Mientras el ancla exista, **cualquier resultado que la deje en nivel de salud muerto se trata como otro nivel malherido**, del que se recupera con el tiempo de forma normal. | ✅ `applyDamage` |
| **Incorpóreo** | Carece de cuerpo físico. **No se la puede atacar físicamente** y sólo interactúan con ella otros seres inmateriales. **Usa la Voluntad de la criatura en lugar de su Fortaleza o su Combate** para cualquier pugna entre seres inmateriales. | ✅ `incorporealStat` · `canBeAttackedPhysically` |
| **Inmune al dolor** | Sus niveles de salud sirven **sólo** para saber cuándo muere o es destruida: **no sufre penalización de dados por los estados** (p. 99). | ✅ `derived` |
| **Deflagración\*** | Explosión de llamas sobrenaturales. Radio de **1 metro por punto**. Los que están junto a la criatura reciben un ataque con **tantos dados como la puntuación**, **−1 dado por cada metro de distancia**. Se resuelve como **reto de dificultad 1**, y el DJ puede permitir **ponerse a cubierto** como en los ataques a distancia (p. 096). **Cada éxito = 1 punto de daño; cada triunfo = tantos puntos como la puntuación.** | ✅ `blastDice` · `blastDamage` |
| **Visión en la oscuridad** | Ve en la oscuridad más absoluta como si fuera de día. | — narrativa |

⚠ **«Aura sobrenatural»** aparece en el bloque de Nathael (p. 49) y **no está en la lista de p. 107–108**. Sin
resolver: puede ser el mismo «Aura\*» con otro nombre, o una capacidad que el libro no llegó a listar.

⚠ Las criaturas también llevan **DONES** normales (§7), no sólo capacidades: el fantasma tiene «Mano
inmaterial 3», Soum «Defensa de acero 3, Golpe certero 4, Movimientos felinos 5». Se leen del §7 y cuestan
Fortuna como a cualquiera.

### 7.b.1 Cómo entran en el motor (decidido con el dueño, 2026-08-21) — CONSTRUIDO el 2026-08-21

**Día y noche**: la app no sabe la hora en ninguna parte, y cuatro capacidades dependen de ella. El dueño
eligió **casilla «es de noche» en la propia tirada**, al lado de la de especialidad — no dato de la escena,
que obligaría a migración y a diseño nuevo del mapa. Lo marca el director tirada a tirada.

**Deflagración**: entra **a mano** (elección del dueño). El director teclea a cuántos metros está la víctima
y el motor saca los dados; cuando existan los ataques sobre el mapa, la distancia saldrá de ahí.

| Capacidad | Dónde entra | Regla exacta |
|---|---|---|
| **Piel gruesa\*** | ✅ ya está | `protection` del bloque |
| **Ira solar\*** | `attackDamage` | Suma la puntuación al **daño del arma**, **encima** del daño impreso del ataque (probado con Gabriel, §8.0) |
| **Amparo de la noche\*** | éxitos automáticos | De noche, +N al **total de Combate** cada turno; si reparte los dados entre varios ataques o defensas, reparte también los éxitos |
| **Aura\*** | éxitos automáticos | **De día**, +N a **Presencia** cuando la tirada es **para intimidar o liderar** |
| **Aura sombría\*** | éxitos automáticos | **De noche**, +N a **Sutileza** para **esconderse, moverse en silencio o pasar desapercibida** |
| **Inmune al dolor** | `derived` | Penalización de dados por estado = **0** |
| **Ancla terrenal** | `applyDamage` | Cualquier resultado que la dejaría **muerta** cuenta como **otro malherido** |
| **Incorpóreo** | característica de la pugna | Usa **Voluntad** en lugar de Fortaleza o Combate en pugnas entre seres inmateriales; **no se la puede atacar físicamente** |
| **Ponzoña\*** | ataque **aparte** | Todo ataque suyo con éxito inocula: conflicto **Fortaleza de la víctima vs Ponzoña**; si vence la criatura, éxito = 1 daño y triunfo = la puntuación de Ponzoña |
| **Deflagración\*** | ataque **aparte** | Radio 1 m por punto; dados = puntuación **− 1 por metro**; **reto a dificultad 1**; se puede uno cubrir (p.96); éxito = 1 daño, triunfo = la puntuación |

**Los éxitos automáticos eran mecánica nueva en el motor** —`resolveAction` sólo contaba dados— y ya está:
`ResolveInput.autoSuccesses` se suma a `ownHits`, viaja en las opciones de la tirada (`autoSuccesses` +
`autoSuccessFrom`, la capacidad que los da) y sale en el desglose del Registro con su nombre y la p.107.

⚠ **Interpretación nuestra, el libro no lo dice**: los éxitos automáticos **también cuentan para el revés**
(§2.6). Un revés es «ni un solo acierto y al menos un fracaso»; con Amparo de la noche 5 la criatura SÍ
acierta, así que no puede sufrir un revés al mismo tiempo. Si el dueño lo lee al revés, se cambia en un sitio.

⚠ **Interpretación nuestra, el libro no lo dice**: un **éxito automático hace 1 punto de daño**, como cualquier
otro éxito (§5.6). Dejarlos fuera del daño sería peor: una criatura que gana el ataque gracias a ellos haría
menos daño del que dice su diferencia.

⚠ **Las capacidades no se aplican solas**, igual que las especialidades (§2.2): el director ve las que podrían
aplicar según la característica y la casilla de noche, y marca la que corresponde. `autoSuccessOptions(caps,
característica, esDeNoche)` es quien devuelve esa lista. «Aura» pide además que la tirada sea *para intimidar o
liderar*, y eso no lo puede saber el motor.

**Lo que queda de esta tabla, y NO es del motor**: la casilla «es de noche» y los metros de la Deflagración son
pantalla (`bestiary/ui/CreatureRollPopover.tsx`), y esa tanda va por el Design Agent porque es cambio visible.

---

## 8. Bestiario — bloques del manual, copiados uno a uno
El libro imprime cada criatura con sus **siete características, su Aguante y su Destino**, y a veces
**capacidades** (§7, p. 107–108). El paquete los copia tal cual: el director tiene que poder coger un encuentro y
tirar por él. Nada de lo que hay aquí es invención nuestra.

Dos cosas que se leen mal si no se avisan:
- **El Aguante impreso ya trae el modificador de tamaño.** El ogro tiene Fortaleza 8 y Voluntad 1 —que suman 9— y
  Aguante 10, porque es Grande (p. 25). Por eso el bloque se copia, no se recalcula.
- **La protección de una criatura no es una armadura**, es una capacidad: «**Piel gruesa\*:** cuenta como una armadura
  natural cuya protección es igual a la puntuación de esta capacidad» (p. 108).
- Resistencia = Aguante × 3 (§1.6), como en cualquier personaje.

> **Verificación completa contra el PDF, 2026-08-21** (a petición del dueño: «si no sabías de los daños
> puede que las fichas de los encuentros estén mal»). Se comprobaron los **45 bloques** uno a uno.
> Las **siete características, el Aguante y el Destino de todos** estaban **bien**. Fallaron dos líneas de
> capacidades —`lunar` y `fallenElite`— porque en el PDF **envuelven a una segunda línea** («…Piel de /
> humano, Amparo de la noche N.») y se copiaron cortadas. Corregido.
>
> ✅ **Los doce que faltaban YA ESTÁN en el catálogo** (2026-08-21): `BESTIARY` tiene **57** bloques — los 45
> en lista de §8.1–8.4 y los doce en caja del §8.0. Las tablas de §8.1–8.3 siguen siendo sólo los 45 en lista;
> los doce se leen en el §8.0.

**El daño de una criatura SÍ está en el libro** (verificado en el PDF, 2026-08-21). Los bloques no traen
línea de arma porque no hace falta: un zarpazo, un mordisco o un puñetazo es un **ataque sin armas**, y la
tabla de armas (p. 97) le da **Daño: F** — la Fortaleza del atacante. El libro lo usa así en su propio
ejemplo, literal (p. 97): «comprueba el daño que hace con **sus manos desnudas** y ve que es igual a **su
puntuación en Fortaleza** (3 puntos) por cada triunfo». Un ogro pega **8** por triunfo; un hambriento, 3.

⚠ **«Garrote», «Mordisco», «Uñas y dientes» son ESPECIALIDADES de Combate, no armas.** Van en la columna de
especialidad del bloque, junto a la puntuación. Asignarles una línea de la tabla de armas sería inventarse
un dato que el libro no da: el director puede hacerlo a mano si quiere, pero por defecto es sin armas.

**Capacidades que tocan al combate o al daño** (p. 107–108), y qué hace hoy el motor:
| Capacidad | Lo que dice el libro | Motor |
|---|---|---|
| Piel gruesa\* | «armadura natural cuya protección es igual a la puntuación» | ✅ `protection` del bloque |
| Ira solar\* | «Añade la puntuación de esta capacidad al **daño del arma**» | ✅ `attackDamage` |
| Ponzoña\* | Todo ataque con éxito inocula veneno: conflicto Fortaleza de la víctima vs Ponzoña; si vence la criatura, éxito = 1 daño y triunfo = puntuación de Ponzoña | ✅ `venomDamage` (ataque APARTE del principal) |
| Amparo de la noche\* | De noche, «añade tantos éxitos automáticos como su puntuación a su total de Combate cada turno»; si reparte dados, reparte también los éxitos | ✅ `autoSuccessOptions` + `autoSuccesses` |
| Deflagración\* | Explosión de radio 1 m por punto; tantos dados como la puntuación, −1 por metro; reto a dificultad 1, se puede uno cubrir; éxito = 1 daño, triunfo = puntuación | ✅ `blastDice` · `blastDamage` (cubrirse, no: la regla no existe en el código) |
| Incorpóreo | No se la puede atacar físicamente; usa **Voluntad** en lugar de Fortaleza o Combate frente a otros seres inmateriales | ✅ `incorporealStat` |
| Inmune al dolor | Sus niveles de salud sólo dicen cuándo muere: **no sufre penalización de dados** por estado (p. 99) | ✅ `derived` |
| Ancla terrenal | Mientras exista el ancla, cualquier resultado que la deje muerta cuenta como otro nivel malherido | ✅ `applyDamage` |
| Alado · Visión en la oscuridad · Aura\* · Aura sombría\* · Disfraz terrenal · Piel de humano · Hambre inhumana | Sin efecto mecánico sobre el daño | — narrativas o fuera de combate |

### 8.0 Los bloques EN CAJA — leídos del PDF uno a uno (2026-08-21) — YA EN EL CATÁLOGO

El bestiario del §8.1–8.3 se copió **sólo de los bloques en lista** (los de «Fortaleza 8 / Combate 4 / …»).
El libro trae **otro tipo de bloque, en cajas de lunas**, para los personajes con nombre, y **no se copió
ninguno**. Aquí están **los once**, leídos página a página **como imagen** (el `pdftotext` no sirve para
estas cajas), más el **Salteador**, que es un bloque en lista que faltaba.

**Página impresa = página del PDF − 2.** Páginas del PDF con caja: `51 · 73 · 74 · 122 · 125 · 127 · 128 ·
136 · 138 · 141 · 144`. El Salteador está en el PDF 211.

#### Las siete características, el Aguante y el Destino

| id propuesto | Personaje | p. | For | Com | Vol | Ast | Sut | Pre | Cul | Ag | Des |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `nathael` | **Nathael**, regente solar de Nueva York | 49 | 7 | 7 | 5 | 4 | 2 | 7 | 4 | 4 | 4 |
| `luz` | **Luz** (niña), avatar de la Luna | 71 | 2 | 4 | 4 | 3 | 2 | 2 | 3 | 6 | 6 |
| `soum` | **Soum**, katana elegida | 72 | 4 | 5 | 4 | 4 | 3 | 3 | 4 | 8 | 10 |
| `nergal` | **Nergal**, príncipe de París | 120 | 6 | 8 | 5 | 4 | 2 | 7 | 4 | 12 | 6 |
| `samael` | **Samael**, el Príncipe de la Guerra | 123 | 8 | 9 | 4 | 5 | 2 | 3 | 5 | 12 | 9 |
| `lucifer` | **Lucifer**, el primer rebelde | 125 | 8 | 9 | 5 | 4 | 4 | 3 | 7 | 13 | 9 |
| `baal` | **Baal**, príncipe lunar | 126 | 7 | 8 | 5 | 4 | 5 | 3 | 8 | 12 | 9 |
| `gabriel` | **Gabriel**, el arcángel | 134 | 7 | 9 | 4 | 3 | 5 | 5 | 5 | 11 | 8 |
| `marduk` | **Marduk**, el arcángel Miguel | 136 | 8 | 10 | 4 | 3 | 3 | 6 | 6 | 11 | 8 |
| `adam` | **Adán**, Satán el acusador | 139 | 6 | 4 | 6 | 6 | 6 | 6 | 6 | 11 | 8 |
| `luzMalefic` | **Luz-Malefic**, la decimotercera | 142 | 4 | 6 | 5 | 4 | 3 | 2 | 3 | 9 | 8 |
| `highwayman` | **Salteador**, pandillero de Nueva York | 209 | 2 | 2 | 2 | 2 | 3 | 2 | 2 | 4 | 1 |

⚠ **Nathael imprime Aguante 4** aunque su Fortaleza 7 + Voluntad 5 dan 12, y es el único de los doce que se
desvía tanto (los demás cuadran, o fallan por uno). Se copia lo impreso, como todo el bestiario —el Aguante del
bloque manda sobre la cuenta (§8)—, pero **queda anotado**: si algún día se vuelve a abrir el PDF, esta es la
línea que hay que mirar (p.49). Sin volver a abrirlo no se toca: inventar un 12 sería corregirle el libro.

⚠ **Gabriel**: su caja está impresa al pie de la **ilustración a página completa (p.134)**, que **no lleva
nombre**; su texto es la p.135 y no lleva caja. Es el único candidato de todo el pliego (pp.131–135) y sus
valores encajan como lugarteniente de Marduk (Com 9 contra 10, Aura 5 contra 6). **Atribución nuestra**, no
un rótulo del libro.

⚠ **Luz tiene DOS versiones**, y el propio libro lo dice en la p.71: la niña (p.71) y la adulta tras recibir
la espada Malefic (p.142).

#### Las especialidades de cada caja

| id | Fortaleza | Combate | Voluntad | Astucia | Sutileza | Presencia | Cultura |
|---|---|---|---|---|---|---|---|
| `nathael` | Vuelo ✱ | Espadas | Perseverar | Vista penetrante | Actuación | Intimidar | Religión |
| `luz` | Acrobacias | Espada samurai ✱ | Intuición | Sentido del peligro | Esconderse | Inspirar | Ocultismo |
| `soum` | Acrobacias · Equilibrio · Trepar | Cuchillos · Espadas | Meditación | Anticipación | Emboscar | Seducción | Leyendas |
| `nergal` | Vigor | Armas contundentes | Perseverar | Vista penetrante | Actuación | Intimidar | Religión |
| `samael` | Vigor | Martillo de guerra ✱ | Resistir dolor | Anticipación | Acechar | Inspirar | Leyendas |
| `lucifer` | Resistir dolor | Espadas | Valor | Vista penetrante | Emboscar | Liderazgo | Leyendas |
| `baal` | Vigor | Espadas samuráis ✱ | Ritos | Detectar mentiras | Esconderse | Liderazgo | Ocultismo |
| `gabriel` | Recorrer distancias ✱ | Espada y escudo ✱ | Constancia | Percepción | Emboscar | Seducción | Historia |
| `marduk` | Vigor | Sables ✱ | Templanza | Anticipación | Acechar | Inspirar | Historia |
| `adam` | Vigor | Cuchillos | Mantener fachada | Vista penetrante | Chantaje | Charlatanería | Psicología |
| `luzMalefic` | Acrobacias | Espadas | Templanza | Moverse a ciegas | Acechar | Inspirar | Ocultismo |
| `highwayman` | Conducir | Armas contundentes | Perseverar | Supervivencia | Emboscar | Interrogación | Tecnología |

✱ = nombre que **no existe** todavía en `CREATURE_SPECIALTY_ITEMS`; hay que darle clave `creature.*` y
etiqueta en es y en. Son **siete**: `vuelo`, `espadaSamurai`, `martilloDeGuerra`, `espadasSamurais`,
`recorrerDistancias`, `espadaYEscudo`, `sables`. Las demás reutilizan claves que ya existen —
«Cuchillos» es `creature.cuchillos` (no `combat.knives`, que se llama «Navajas y cuchillos»), «Actuación»
es `subtlety.acting`, «Perseverar» es `will.perseverance`.

⚠ Erratas del libro copiadas tal cual en la lectura, y corregidas al escribir la etiqueta: Luz-Malefic dice
«Inpirar» (por Inspirar) y el Salteador «Perserverar» (por Perseverar).

#### Los ATAQUES — el dato que faltaba

Las cajas traen un apartado `ATAQUES` con **el arma, su puntuación de ataque y su daño YA calculados**.

| id | Ataques |
|---|---|
| `nathael` | Espada flamígera **9** (daño **11**) |
| `luz` | Katana **5** (daño **4**) |
| `soum` | Katana de las Trece Lunas **6** (daño **7**) · cuchillo tantō **5** (daño **5**) |
| `nergal` | Martillo de guerra **10** (daño **10**) |
| `samael` | Martillo de guerra **11** (daño **11**) |
| `lucifer` | Mandoble **11** (daño **12**) |
| `baal` | Espada oriental **9** (daño **10**) |
| `gabriel` | Espada **10** (daño **9**) · **escudo (protección 5)** |
| `marduk` | Sables negros **11** (daño **11**) |
| `adam` | Navaja **4** (daño **7**) |
| `luzMalefic` | Malefic **8/10** (daño **8/10**) *(ver p.163)* |
| `highwayman` | — ninguno impreso: «Puedes elegir las armas que llevan de la tabla de la página 097» |

**Se copian, NO se recalculan.** La cuenta del libro es «Combate + bonificación del arma» y «Fortaleza +
daño del arma» (§5.5–5.6), pero **no cuadra siempre**: Nergal tiene Fortaleza 6 y su martillo hace 10, no 9;
Lucifer tiene Fortaleza 8 y su mandoble hace 12, no 11. Recalcularlos sería corregirle el libro.

**El escudo de Gabriel no es un ataque**: es **protección 5**, y va al campo `protection` del bloque.

**Malefic, la espada soberana (p.163)** — es lo que explica el «8/10»: «una espada a una mano que da
bonificación a Combate **+2** y hace daño **Fortaleza+4**, pero activando un mecanismo del pomo (y **gastando
un punto de Fortuna**) se convierte en una espada a dos manos con bonificación **+4** y daño
**Fortaleza+6**». Luz adulta tiene For 4 y Com 6 → **8 (daño 8)** a una mano y **10 (daño 10)** a dos.
Cuadra exacto. Van como **dos ataques** en el bloque, y el de dos manos cuesta 1 de Fortuna.

**La Ira solar NO está sumada en el daño impreso.** Gabriel tiene Ira solar 3 y su espada hace 9, que es
exactamente Fortaleza 7 + 2 de una espada de la tabla. Luego la capacidad **suma encima** del daño del
ataque, no está dentro.

#### Capacidades y dones de cada caja

La línea se llama `CAPACIDADES` en Nathael, `DONES` en Luz, Soum, Adán y Luz-Malefic, y `DONES Y
CAPACIDADES` en el resto: **mezcla las dos cosas** (§7 dones · §7.b capacidades).

| id | Capacidades (§7.b) | Dones (§7) |
|---|---|---|
| `nathael` | Alado · **Aura sobrenatural 5** · Disfraz terrenal · Ira solar 5 | — |
| `luz` | — | Golpe certero 3 · Separación espiritual 1 · Trance del destino 2 |
| `soum` | — | Defensa de acero 3 · Golpe certero 4 · Movimientos felinos 5 |
| `nergal` | Alado · Aura sombría 3 · Disfraz terrenal · Amparo de la noche 4 | — |
| `samael` | Alado · Aura sombría 5 · Piel de humano | Furia de titán 8 |
| `lucifer` | Alado · Aura sombría 5 · Piel de humano · Amparo de la noche 5 | — |
| `baal` | Alado · Aura sombría 5 · Piel de humano · Amparo de la noche 3 · Deflagración 5 | — |
| `gabriel` | Alado · Aura 5 · Disfraz terrenal · Ira solar 3 | Guardián de la Palabra 5 · Manto de protección 5 |
| `marduk` | Alado · Aura 6 · Ira solar 6 | Guardián de la Palabra 4 |
| `adam` | — | Alegoría de la realidad 9 |
| `luzMalefic` | — | Golpe certero 5 · Trance del destino 5 |
| `highwayman` | — | — |

⚠ **Los dones de las cajas pasan de 5**, que es el tope de un personaje jugador (§7): Furia de titán **8**,
Alegoría de la realidad **9**. No es un fallo de lectura: son seres míticos, como las características por
encima de 6 (§1.2). El catálogo no debe caparlos.

⚠ **Adán, «Especial»** (literal del libro): «Adán es inmune a las enfermedades, al hambre y a la sed».
No es una capacidad de la lista; va a las notas de la entrada.

✅ **«Aura sobrenatural 5» de Nathael → se trata como «Aura 5»** (decisión del dueño, 2026-08-21). El nombre
no está en la lista de pp.107–108, pero Nathael es un solar y **todos** los demás solares del libro (Solar,
Paladín, Aamel, Azelías, Gabriel, Marduk) llevan «Aura N». **Lectura nuestra, no del libro** — queda escrito
aquí para que se pueda deshacer.

### 8.1 Criaturas
| Criatura | For | Com | Vol | Ast | Sut | Pre | Cul | Aguante | Destino | Prot. | Capacidades | p. |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| Hambriento | 3 | 3 | 1 | 4 | 0 | 0 | 0 | 4 | 0 | – | Hambre inhumana | 150 |
| Ogro | 8 | 4 | 1 | 3 | 1 | 1 | 0 | 10 | 0 | 3 | Piel gruesa 3 | 152 |
| Fantasma aparecido | 0 | 0 | 3 | 2 | 2 | 1 | 3 | 0 | 10 | – | Ancla terrenal, Incorpóreo, Mano inmaterial 3 | 149 |
| Poseído | 2 | 2 | 2 | 2 | 0 | 0 | 0 | 4 | 0 | – | Inmune al dolor | 149 |
| Querubín | 2 | 2 | 2 | 1 | 3 | 0 | 0 | 3 | 0 | – | Ponzoña 3, Visión en la oscuridad | 155 |
| Arpía | 4 | 3 | 1 | 4 | 4 | 0 | 0 | 5 | 2 | – | Alado, Visión en la oscuridad | 147 |

### 8.2 Sobrenaturales
| Criatura | For | Com | Vol | Ast | Sut | Pre | Cul | Aguante | Destino | Capacidades | p. |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| Lunar | 7 | 6 | 3 | 4 | 3 | 2 | 3 | 10 | 7 | Alado, Aura sombría 2, Piel de humano, **Amparo de la noche 2** | 120 |
| Soldado de élite de los caídos | 7 | 7 | 4 | 4 | 3 | 3 | 4 | 11 | 8 | Alado, Aura sombría 3, Piel de humano, **Amparo de la noche 3** | 124 |
| Solar | 6 | 7 | 4 | 3 | 2 | 3 | 3 | 10 | 7 | Alado, Aura 2, Disfraz terrenal, Ira solar 2 | 132 |
| Paladín solar | 6 | 8 | 5 | 3 | 2 | 4 | 4 | 7 | 8 | Alado, Aura 3, Disfraz terrenal, Ira solar 3 | 132 |
| Aamel (lugarteniente solar) | 6 | 8 | 5 | 4 | 3 | 4 | 5 | 11 | 8 | Alado, Aura 3, Disfraz terrenal, Ira solar 2 | 132 |
| Azelías (lugarteniente solar) | 6 | 7 | 4 | 3 | 5 | 5 | 5 | 10 | 8 | Alado, Aura 2, Disfraz terrenal, Ira solar 3 | 132 |

### 8.3 Humanos y figuras de la ambientación
Los bloques de los capítulos de ambientación (pp. 44–74). Sirven de encuentro tal cual.

| Bloque | For | Com | Vol | Ast | Sut | Pre | Cul | Aguante | Destino | p. |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Carroñera | 3 | 3 | 3 | 2 | 2 | 3 | 2 | 6 | 1 | 74 |
| Vagabundo amable | 2 | 1 | 3 | 3 | 1 | 4 | 3 | 5 | 4 | 69 |
| Mafioso | 2 | 3 | 1 | 3 | 1 | 3 | 2 | 3 | 1 | 62 |
| Yihadista | 2 | 3 | 3 | 2 | 3 | 2 | 2 | 5 | 2 | 62 |
| Dragón | 3 | 2 | 3 | 2 | 1 | 2 | 1 | 6 | 1 | 63 |
| Pandillero latino | 3 | 2 | 2 | 3 | 1 | 2 | 1 | 5 | 1 | 61 |
| Paramilitar | 3 | 3 | 1 | 3 | 1 | 2 | 2 | 4 | 2 | 61 |
| Buscador del nuevo Edén | 2 | 1 | 2 | 2 | 3 | 2 | 2 | 4 | 1 | 61 |
| Miembro de un kibutz | 1 | 1 | 2 | 2 | 3 | 3 | 2 | 3 | 2 | 61 |
| Mártir del Paraíso | 2 | 2 | 2 | 3 | 3 | 2 | 2 | 4 | 2 | 57 |
| Internauta ocultista | 2 | 1 | 2 | 2 | 3 | 2 | 3 | 4 | 1 | 59 |
| Miembro de la banda de Big Dima | 3 | 4 | 2 | 3 | 1 | 2 | 3 | 5 | 1 | 59 |
| Seguidor de la Iglesia del Nuevo Orden | 2 | 1 | 3 | 2 | 2 | 2 | 3 | 5 | 1 | 59 |
| Charlatán de los Illuminati | 2 | 1 | 1 | 3 | 3 | 3 | 3 | 5 | 1 | 63 |
| Soldado Miyamoto | 2 | 3 | 2 | 3 | 2 | 2 | 1 | 4 | 1 | 64 |
| Matón de Pequeño Tokio | 3 | 3 | 2 | 2 | 3 | 1 | 1 | 5 | 2 | 65 |
| Cocinero caníbal | 2 | 3 | 1 | 3 | 2 | 1 | 1 | 3 | 7 | 69 |
| Maggie (cocinera caníbal) | 2 | 1 | 3 | 3 | 3 | 3 | 1 | 5 | 7 | 68 |
| El bobo de la flauta | 4 | 1 | 3 | 1 | 2 | 1 | 4 | 7 | 4 | 69 |
| Ramírez | 4 | 4 | 2 | 4 | 2 | 2 | 2 | 6 | 2 | 69 |
| Jellybean | 2 | 1 | 2 | 2 | 2 | 3 | 4 | 4 | 3 | 74 |
| Hermes | 1 | 1 | 3 | 3 | 2 | 2 | 4 | 4 | 4 | 67 |
| Judith | 2 | 1 | 3 | 3 | 1 | 4 | 3 | 5 | 4 | 67 |
| Henry Putnam | 1 | 2 | 4 | 3 | 4 | 3 | 2 | 5 | 8 | 44 |
| Dorcy | 2 | 1 | 3 | 1 | 3 | 3 | 1 | 5 | 6 | 44 |
| Silhouette (mimo peligroso) | 3 | 3 | 1 | 2 | 2 | 2 | 1 | 4 | 1 | 57 |
| Big Dima (jefe mafioso) | 4 | 4 | 3 | 4 | 3 | 3 | 4 | 7 | 7 | 59 |
| Hermana de las Trece Lunas | 4 | 5 | 3 | 4 | 4 | 2 | 3 | 7 | 4 | 67 |
| Jacobista | 2 | 2 | 3 | 1 | 2 | 3 | 2 | 6 | 1 | 67 |
| George (cocinero caníbal) | 3 | 3 | 1 | 3 | 2 | 2 | 1 | 4 | 7 | 68 |
| Diane (carroñera) | 2 | 3 | 3 | 3 | 3 | 2 | 2 | 5 | 2 | 74 |
| Allen Dallas «el Americano» | 2 | 1 | 3 | 3 | 4 | 1 | 5 | 5 | 7 | 74 |

⚠ La Hermana de las Trece Lunas trae capacidades, cosa rara en un bloque humano: **Defensa de acero 2** y
**Movimientos felinos 2**.

### 8.4 El mutante — lo único que el libro publica
Sale en dos ejemplos, no en un bloque: **Fortaleza 3 y Voluntad 1 → Aguante 4** y protección 2 por su piel curtida
(p. 98), y **Combate 3** (p. 94). **Las otras cuatro características no están escritas en ninguna parte**, así que el
paquete las deja SIN VALOR en vez de inventarlas: la ficha pinta «—» y el director tira con lo que hay.

**Cobertura**: son los **45 bloques en lista** que imprime el manual (los que traen las siete características y el
Aguante en columna). Con los **doce del §8.0** —los once en caja y el Salteador, bajados al catálogo el
2026-08-21— `BESTIARY` suma **57**.

⚠ Corregido el 2026-08-20: antes decía 37 «contados uno a uno sobre el PDF», y faltaban **ocho**. Aparecieron al
releer el libro para sacar las especialidades. Dos de los que ya estaban tenían además el nombre engañoso, aunque
sus valores eran correctos: `cannibalCook` (p. 69) es **Will** —el manual imprime TRES cocineros: Maggie p. 68,
George p. 68 y Will p. 69— y `scavenger` (p. 74) es **Kharla**, que tiene compañera, Diane.

⚠ Fuera del catálogo, y anotado: «Solitario» y «Chatarrero», que venían del prototipo y **no eran bloques del
manual**. En su lugar entran Carroñera (p. 74) y Vagabundo amable (p. 69), que sí lo son. `scavenger` conserva su
identificador —lo usan los tokens ya colocados— y pasa a ser la Carroñera del libro.

### 8.5 Las especialidades de los bloques
El manual imprime **una especialidad por característica dentro del propio bloque**, a la derecha de su puntuación,
y un guion donde no la hay (que suele coincidir con puntuación 0). El ogro (p. 152):

```
Fortaleza  8   Derribar paredes
Combate    4   Garrote
Voluntad   1   Constancia
Cultura    0   -
```

Un bloque puede traer **dos** en la misma característica (Hermana de las Trece Lunas: «Acrobacias, Equilibrio»).
Cuentan como especialidad normal: **doblan los triunfos** de esa tirada (§3, p. 83), y es el director quien marca
cuál aplica —no se aplican solas por característica, porque el garrote no sirve para esquivar.

De los **133 nombres distintos** que usa el bestiario, **104 ya existen** en la lista de especialidades de jugador y
reutilizan su clave; sólo **30** son propias de criatura (Garrote, Mordisco, Picado de garras, Uñas y dientes…).
El **mutante no tiene ninguna**: el libro no le imprime bloque (§8.4).

---

## 9. Mapa página → clave `references.ts`
stats 20 · specialty 83 · roll 82 · difficulty 84 · degree 85 · setback 86 · destinyPool 88 · destiny 88 ·
fortune 89 · xp 91 · ranged 96 · weapons 97 · damage 97 · armours 98 · endurance 98 · resistance 98 · health 99 ·
recovery 101 · gifts 102 · size 25 · bestiary 107 · melee 93 · tools 87.
