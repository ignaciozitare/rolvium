# System · Plenilunio (`packages/system-plenilunio`) — SPEC

## Purpose
Primer sistema instalado. Implementa el puerto `GameSystem` con las reglas de *Malefic Time: Plenilunio*
(NoSoloRol) validadas contra los ejemplos del manual. Who: consumido por la plataforma; nunca importa de ella.

## Reglas que implementa (engine)
Fuente de verdad: el manual. Digesto con páginas y decisiones «⚠ interpretación»: `packages/system-plenilunio/RULES.md`.
- Características (7; humanos 1–5; presets de creación p.21: 16/21/25/30 puntos con máximos **5/5/6/10**), una especialidad
  por característica (lista abierta p.21–22, 127 en catálogo); canjes: 1 punto → 2 especialidades extra (máx. 2 canjes),
  1 punto → 2 puntos de don, Destino 3 ± 2 (1–5).
- Derivadas: Aguante = Fortaleza + Voluntad ± tamaño (p.25) · **Resistencia máxima = Aguante × 3, siempre** (p.25,
  literal «Son iguales al triple del Aguante»; sin tope — la hoja impresa tiene 30 casillas) · **Resistencia
  recuperable descansando = Aguante × el factor del estado** (×3 sano/magullado, ×2 herido, ×1 malherido, p.101) ·
  Fortuna máx = Destino (p.90, tope duro literal: «nunca pueden llegar a ser mayores que la puntuación de Destino»).
  **Son DOS números y la ficha enseña los dos**: la pista de casillas la fija la creación y el estado de salud no la
  encoge; lo que el estado limita es hasta dónde te sube un descanso. Coinciden sano y magullado, y se separan al
  herirse. Se fundieron en uno el 2026-08-19 —leyendo el «pasan a ser» de la p.101 fuera de su epígrafe— y Karen,
  herida, enseñaba 12 casillas en vez de 18; corregido el 2026-08-21 contra el PDF (RULES.md §6.3).
- Dados d6 (p.82): 1 fracaso · 2–3 fallo · 4–5 éxito · 6 triunfo; especialidad dobla triunfos propios (p.83); en conflictos el
  rival también puede doblar (`oppositionSpecialty`, p.85); **reserva de Destino** (p.88–89: recurso compartido, 10 por
  defecto, hasta 5 por tirada, solo jugadores, solo el DJ reinicia; los dados de la reserva doblan siempre y un triunfo en
  ellos sube Destino +1 y recarga Fortuna; a Destino 10 ya no se puede usar).
- Retos (dificultad 1/2/3/5/6, p.84) y conflictos; grado de éxito/fallo 1/2/3/4+ (p.85); **revés** (sin éxitos y ≥1 fracaso, p.86);
  acciones prolongadas; armadura (protección; con ≥1 fracaso convierte tantos triunfos como la penalización en éxitos, p.98).
- Daño (p.97): éxitos 1, triunfos daño del arma (F+n o fijo), triunfo doblado 2× arma, cancelación ordenada (éxitos normales
  primero, triunfos los últimos, doblado cancelado a medias = daño sencillo del arma); Resistencia y **niveles de salud** por
  múltiplos de Aguante. **Seis niveles de salud, no cinco**: la tira de lunas trae Sano · Magullado · Herido −1d ·
  Malherido −2d · Muerto (p.99) y el sexto es **Inconsciente** (p.101, la lista continúa tras la ilustración de la
  p.100). Inconsciente no es una fase de luna —se puede estar Herido E Inconsciente— y **no se elige a mano**: lo
  calcula el motor al bajar de 0 de Resistencia (p.98) y la ficha lo saca como aviso bajo las lunas;
  Fortuna reduce severidad (1/nivel); recuperación por estado (1 día/1 semana/2 semanas, dif. 2/3/4, p.101).
- Ataque a distancia = reto contra la dificultad del alcance (corto 2 · medio 3 · largo 5 · muy largo 6, p.96); bonificación de
  arma solo cuerpo a cuerpo (p.97).
- Fortuna (p.89–90): activar dones (1), reducir herida, recobrar aliento (mitad de la Resistencia perdida), elemento dramático,
  adelantarse; recarga al subir Destino, al añadir dados a la reserva, al empezar historia.
- Progresión (p.91): 20 px/característica hasta 5, 40 px de 5→6 (tope con px: 6), 10 px especialidad nueva, 3 px cambiarla,
  10 px por nivel de don o don nuevo (máx. nivel 5).
- Acciones con icono: **cada arma ofrece SÓLO la suya** — atacar cuerpo a cuerpo (conflicto) o disparar (reto contra la
  dificultad del alcance), nunca las dos. Disparar **gasta un punto de cargador** (p.97: el arco, la ballesta y el
  tirachinas ponen «Cargador 1», y eso sólo tiene sentido si la unidad es un disparo); sin balas el botón sale apagado.
  **Recargar** es una acción aparte que no tira dados: mueve balas de la munición que llevas encima (`reserve`) al
  cargador (`ammo`). El cargador es de sólo lectura: lo mueven disparar y recargar, no la mano del jugador.
  Activar don (1 Fortuna).

## Datos del paquete
- `sheetSchema` (identidad, tirada, características+especialidades, estado, armadura, armas, dones, equipo, historia).
- **Bestiario**: **57 bloques** del manual copiados uno a uno — las **siete características, Aguante, Destino,
  protección natural, las especialidades del bloque, la línea impresa de capacidades y dones, y la página** de cada
  criatura, para que el director pueda coger un encuentro y tirar por él. Son los **45 en lista** más los **doce en
  caja** (los once personajes con nombre —Nathael, Luz, Soum, Nergal, Samael, Lucifer, Baal, Gabriel, Marduk, Adán y
  Luz-Malefic— y el Salteador), que además traen sus **ATAQUES con arma y daño ya calculados por el libro**: se
  copian, **no se recalculan** (RULES.md §8.0). Criaturas (Hambriento p.150, Ogro p.152, Fantasma p.149, Poseído p.149, Querubín p.155),
  sobrenaturales (Lunar p.120, Soldado de élite de los caídos p.124, Solar y Paladín solar p.132) y humanos
  hostiles (Carroñera p.74, Vagabundo p.69, Mafioso y Yihadista p.62, Dragón p.63, Pandillero latino p.61).
  El **Aguante impreso ya incluye el tamaño** y la Resistencia es Aguante × 3. Del **mutante** el libro sólo publica
  Fortaleza 3, Combate 3 y Voluntad 1: las demás quedan **sin valor**, no inventadas.
- **Capacidades** (p.107–108): las **quince** del libro como catálogo (`capabilities`, con `scored` y la hora en la
  que valen) y como dato en cada bloque, además de la línea impresa. Lo que aplica el motor: Piel gruesa → protección;
  Ira solar → daño del arma; Inmune al dolor → sin penalización por estado; Ancla terrenal → no muere, se queda
  malherida; Amparo de la noche · Aura · Aura sombría → **éxitos automáticos** que el director marca al tirar
  (`autoSuccessOptions`); Incorpóreo, Ponzoña y Deflagración → funciones puras (`incorporealStat`, `venomDamage`,
  `blastDice`/`blastDamage`). ⚠ Dos lecturas nuestras, declaradas en RULES.md §7.b.1: los éxitos automáticos
  **cuentan como acierto para el revés** y **hacen 1 punto de daño** cada uno.
- Catálogos: armas (tabla p.97), armaduras (p.98), equipo, 27 dones (p.102–107), especialidades por característica
  (p.21–22) y de criatura (37 propias, `creature.*`), 15 capacidades (p.107–108), bestiario (57 bloques), tamaños (p.25).
- `references`: clave → {página, título, resumen propio} para tooltips (características, dones, estados, reserva…).
- `theme`: papel gris `#dedcd5`, tinta `#131310`, oro `#8a7038`, sangre `#6e2418`, Cormorant Garamond, luna creciente,
  discos de salud en fases lunares, fondo `systems/plenilunio/fondo.png`. Variables `--sys-*` en el contenedor de la mesa.
- `generator`: Concepto → Características → Especialidades → Destino → Dones → Resumen (economía de puntos y canjes).
  **Cada tope se aplica AL ELEGIR, nunca sólo al pulsar «Continuar»** (`GeneratorStep.applyChange`): elegir y que no
  pase nada es el fallo que el dueño encontró tres veces seguidas el 2026-08-19. Y **sólo se capa la subida**: un
  borrador que ya venga fuera de norma —una ficha guardada, o bajar un canje después de repartirlo— tiene que dejarse
  reparar, o el aviso en rojo se queda sin un solo control vivo y sólo se sale con «Cancelar».
  - **Especialidades**: 1 por característica; cada canje compra 2 extra en dos características distintas → techo
    `1 + canjes` por característica y `2 × canjes` en total (RULES.md §1.3). Va en los dos pasos que listan las
    características, porque el campo `stat` arrastra sus desplegables a los dos.
  - **Destino**: 1–5 al crear (RULES.md §1.4, p. 88 literal). El campo de la ficha llega a 10 porque **el libro
    dice 1–10** (p. 88) y en juego el Destino sube hasta ese tope: es regla, no límite de validación.
  - **Dones**: un don no se repite (tiene UN nivel, 1–5, RULES.md §7). El canje de dones va a **máx. 2, el segundo
    con permiso del DJ** —calcado a especialidades, decisión del dueño 2026-08-19 tras verificar el PDF— y además lo
    frena lo que puedas pagar en puntos de creación (RULES.md §1.5). El contador del paso dice `total/gastados`, igual
    que los pasos de puntos.
  - Y los puntos de creación en rojo se avisan **antes** que el reparto de dones: si no, el mensaje manda al jugador a
    arreglar el control que no es.
- `locales`: `es` y `en` completos (nombres de dones/especialidades en inglés = traducción provisional).

## Rules & limits (licencia)
- Se implementan mecánicas; **no se reproducen textos del manual**: resúmenes propios, la página remite al ejemplar.
  Nombres de dones/armas se mantienen como valores de juego; revisar con NoSoloRol antes de publicar abiertamente.

## Modelo de datos
Sin tablas propias (todo en `jsonb` de `characters`/`bestiary` + `campaigns.shared_resources`).
