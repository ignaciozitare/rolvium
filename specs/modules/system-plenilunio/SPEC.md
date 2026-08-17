# System · Plenilunio (`packages/system-plenilunio`) — SPEC

## Purpose
Primer sistema instalado. Implementa el puerto `GameSystem` con las reglas de *Malefic Time: Plenilunio*
(NoSoloRol) validadas contra los ejemplos del manual. Who: consumido por la plataforma; nunca importa de ella.

## Reglas que implementa (engine)
Fuente de verdad: el manual. Digesto con páginas y decisiones «⚠ interpretación»: `packages/system-plenilunio/RULES.md`.
- Características (7; humanos 1–5; presets de creación p.21: 16/21/25/30 puntos con máximos **5/5/6/10**), una especialidad
  por característica (lista abierta p.21–22, 127 en catálogo); canjes: 1 punto → 2 especialidades extra (máx. 2 canjes),
  1 punto → 2 puntos de don, Destino 3 ± 2 (1–5).
- Derivadas: Aguante = Fortaleza + Voluntad ± tamaño (p.25) · Resistencia = Aguante×3 (sin tope; la hoja impresa tiene 30 casillas) ·
  Fortuna máx = Destino (1–10) · Resistencia recuperable descansando ×3/×2/×1 según estado (p.101).
- Dados d6 (p.82): 1 fracaso · 2–3 fallo · 4–5 éxito · 6 triunfo; especialidad dobla triunfos propios (p.83); en conflictos el
  rival también puede doblar (`oppositionSpecialty`, p.85); **reserva de Destino** (p.88–89: recurso compartido, 10 por
  defecto, hasta 5 por tirada, solo jugadores, solo el DJ reinicia; los dados de la reserva doblan siempre y un triunfo en
  ellos sube Destino +1 y recarga Fortuna; a Destino 10 ya no se puede usar).
- Retos (dificultad 1/2/3/5/6, p.84) y conflictos; grado de éxito/fallo 1/2/3/4+ (p.85); **revés** (sin éxitos y ≥1 fracaso, p.86);
  acciones prolongadas; armadura (protección; con ≥1 fracaso convierte tantos triunfos como la penalización en éxitos, p.98).
- Daño (p.97): éxitos 1, triunfos daño del arma (F+n o fijo), triunfo doblado 2× arma, cancelación ordenada (éxitos normales
  primero, triunfos los últimos, doblado cancelado a medias = daño sencillo del arma); Resistencia y **niveles de salud** por
  múltiplos de Aguante (Sano · Magullado · Herido −1d · Malherido −2d · Muerto; Inconsciente al bajar de 0 Resistencia, p.98–99);
  Fortuna reduce severidad (1/nivel); recuperación por estado (1 día/1 semana/2 semanas, dif. 2/3/4, p.101).
- Ataque a distancia = reto contra la dificultad del alcance (corto 2 · medio 3 · largo 5 · muy largo 6, p.96); bonificación de
  arma solo cuerpo a cuerpo (p.97).
- Fortuna (p.89–90): activar dones (1), reducir herida, recobrar aliento (mitad de la Resistencia perdida), elemento dramático,
  adelantarse; recarga al subir Destino, al añadir dados a la reserva, al empezar historia.
- Progresión (p.91): 20 px/característica hasta 5, 40 px de 5→6 (tope con px: 6), 10 px especialidad nueva, 3 px cambiarla,
  10 px por nivel de don o don nuevo (máx. nivel 5).
- Acciones con icono: atacar con arma (⚔/◎, munición), activar don (⚡, 1 Fortuna).

## Datos del paquete
- `sheetSchema` (identidad, tirada, características+especialidades, estado, armadura, armas, dones, equipo, historia).
- Catálogos: armas (tabla p.97), armaduras (p.98), equipo, 27 dones (p.102–107), especialidades por característica
  (p.21–22), bestiario base (Mutante p.100 y Ogro p.152 del manual; Solitario y Chatarrero son plantillas del prototipo), tamaños (p.25).
- `references`: clave → {página, título, resumen propio} para tooltips (características, dones, estados, reserva…).
- `theme`: papel gris `#dedcd5`, tinta `#131310`, oro `#8a7038`, sangre `#6e2418`, Cormorant Garamond, luna creciente,
  discos de salud en fases lunares, fondo `systems/plenilunio/fondo.png`. Variables `--sys-*` en el contenedor de la mesa.
- `generator`: Concepto → Características → Especialidades → Destino → Dones → Resumen (economía de puntos y canjes).
- `locales`: `es` y `en` completos (nombres de dones/especialidades en inglés = traducción provisional).

## Rules & limits (licencia)
- Se implementan mecánicas; **no se reproducen textos del manual**: resúmenes propios, la página remite al ejemplar.
  Nombres de dones/armas se mantienen como valores de juego; revisar con NoSoloRol antes de publicar abiertamente.

## Modelo de datos
Sin tablas propias (todo en `jsonb` de `characters`/`bestiary` + `campaigns.shared_resources`).
