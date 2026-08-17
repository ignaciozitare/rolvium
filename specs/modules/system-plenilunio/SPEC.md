# System · Plenilunio (`packages/system-plenilunio`) — SPEC

## Purpose
Primer sistema instalado. Implementa el puerto `GameSystem` con las reglas de *Malefic Time: Plenilunio*
(NoSoloRol) validadas contra los ejemplos del manual. Who: consumido por la plataforma; nunca importa de ella.

## Reglas que implementa (engine)
- Características (7, 1–5; presets de creación 16/21/25/30 con máximos 5/5/6/10), especialidad por característica.
- Derivadas: Aguante = Fortaleza + Voluntad ± tamaño · Resistencia = Aguante×3 (hasta 30 casillas) · Fortuna máx = Destino (1–10).
- Dados d6: 1 fracaso · 2–3 fallo · 4–5 éxito · 6 triunfo; especialidad dobla triunfos; **reserva de Destino**
  (recurso compartido: 10 por defecto, hasta 5 por tirada, solo jugadores, solo el DJ reinicia; los dados de la
  reserva doblan siempre y un triunfo en ellos sube Destino +1 y recarga Fortuna; a Destino 10 ya no se puede usar).
- Retos (dificultad 1/2/3/5/6) y conflictos; grado de éxito/fallo; **revés** (sin éxitos y ≥1 fracaso); acciones
  prolongadas; armadura (protección; con ≥1 fracaso convierte tantos triunfos como la penalización en éxitos).
- Daño: éxitos 1, triunfos daño del arma (F+n o fijo), cancelación ordenada (triunfos los últimos, medio cancelado =
  daño sencillo); Resistencia y **niveles de salud** por múltiplos de Aguante (Sano · Magullado · Herido −1d ·
  Malherido −2d · Muerto); Fortuna reduce severidad; recuperación por estado (tiempo/dificultad).
- Fortuna: activar dones, reducir herida, recobrar aliento, elemento dramático, adelantarse; recarga al subir Destino,
  al añadir dados a la reserva, al empezar historia.
- Progresión: 20 px/característica hasta 5, 40 px de 5→6, 10 px especialidad nueva, 3 px cambiarla, 10 px por nivel de don o don nuevo.
- Acciones con icono: atacar con arma (⚔/◎, munición), activar don (⚡, 1 Fortuna).

## Datos del paquete
- `sheetSchema` (identidad, tirada, características+especialidades, estado, armadura, armas, dones, equipo, historia).
- Catálogos: armas (tabla p.97), armaduras (p.97), equipo, 27 dones (p.102+), especialidades por característica
  (p.21–22), bestiario base (Mutante, Solitario, Ogro, Chatarrero…), tamaños (p.25).
- `references`: clave → {página, título, resumen propio} para tooltips (características, dones, estados, reserva…).
- `theme`: papel gris `#dedcd5`, tinta `#131310`, oro `#8a7038`, sangre `#6e2418`, Cormorant Garamond, luna creciente,
  discos de salud en fases lunares, fondo `systems/plenilunio/fondo.png`. Variables `--sys-*` en el contenedor de la mesa.
- `generator`: Concepto → Características → Especialidades → Destino → Dones → Resumen (economía de puntos y canjes).
- `locales`: `es` completo; `en` pendiente.

## Rules & limits (licencia)
- Se implementan mecánicas; **no se reproducen textos del manual**: resúmenes propios, la página remite al ejemplar.
  Nombres de dones/armas se mantienen como valores de juego; revisar con NoSoloRol antes de publicar abiertamente.

## Modelo de datos
Sin tablas propias (todo en `jsonb` de `characters`/`bestiary` + `campaigns.shared_resources`).
