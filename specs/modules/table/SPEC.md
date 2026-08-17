# Table (H3) — SPEC

## Purpose
La sesión en vivo. Al entrar en una campaña la mesa se **viste con el sistema** (papel, tipografía, lunas en
Plenilunio) y reúne ficha, escena, dados, chat, notas y el panel del director. Who: miembros de la campaña.

## What the user can do
- **Barra Rolvium** (fina, arriba): ← Campañas, nombre de campaña, chip de sistema, dispositivos conectados, avisos, avatar.
- **Cabecera de la mesa**: nombre del sistema + campaña/sesión; **conectados** (avatar del director con borde oro,
  jugadores con **halo verde si están conectados**, atenuados si ausentes; el propio marcado); rol (JUGADOR/DIRECTOR);
  *Abrir ficha aparte* (jugador).
- **Recursos compartidos** centrados bajo la cabecera (p.ej. Reserva de Destino: lunas grandes, cogidas "en tu mano",
  Devolver; **Reiniciar solo director**; el director no coge dados).
- **Pestañas**: jugador → Ficha · Escena · Mejorar · Crear personaje; director → Ficha · El grupo · Escena · Bestiario ·
  Mejorar · Crear personaje.
- **Lateral (272 px)**: botón **Lanzador de dados** (abre/cierra un modal flotante arrastrable) y panel con Registro ·
  Chat · Notas · Bitácora.
- **Panel del director "El grupo"**: cada jugador con avatar, personaje, barra de Resistencia (x/máx, color por tramo),
  estado de salud, Destino·Fortuna, *Ver ficha* (abre en lectura con "volver al grupo"), y **registro de cambios de
  fichas** (auditoría). Todo lo exclusivo del DJ lleva la etiqueta "SOLO DIRECTOR · los jugadores no ven este panel".
- Ficha en ventana aparte: `/table/:id/sheet/:charId`, misma sincronía, indicador "sincronizada con la mesa".

## Rules & limits
- Recursos compartidos: descuento **atómico en servidor** (`UPDATE … WHERE pool >= n`); si dos piden el último, uno
  recibe error ("alguien cogió el último justo antes que tú"). Solo el DJ reinicia. Un personaje que ha llegado al
  máximo del recurso (Destino 10) no puede coger; la UI lo bloquea y explica.
- La vista de director nunca se expone por API a un jugador; filtrado en servidor.
- Estados vacíos: sin escena activa, sin ficha, reserva agotada, sin conexión — todos diseñados en el `.pen`.

## Connections
`campaigns` (membresía/rol), `game-system` (theme, sharedResources), `characters`, `bestiary`, `dice`, `maps`, `chat`,
`journal`, `realtime` (presence).

## Modelo de datos
> Pending — DBA. Estado de recursos en `campaigns.shared_resources` (jsonb, update solo DJ/API); presencia vía Realtime;
> `character_audit` vive en `characters`.
