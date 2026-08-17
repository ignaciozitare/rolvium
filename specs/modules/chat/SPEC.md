# Chat (H8) — SPEC

## Purpose
Hablar sin salir de la mesa: canal de mesa, privados y susurros del director, con tiradas adjuntas.
Who: miembros de la campaña.

## What the user can do
- Pestaña **Chat** del lateral: canales **Mesa** (todos), **privados** (jugador↔jugador, jugador↔director) y
  **susurros del director** a un jugador (se muestran en oro itálico).
- Mensajes con avatar, nombre y hora; **adjuntar una tirada** (chip con resumen: "Astucia · 1—2 · fallo con revés").
- Historial persistente por campaña; el chat no sabe qué sistema se juega.

## Rules & limits
- Un privado solo lo leen emisor y destinatario (RLS). Los susurros son mensajes privados con `from_dm=true`.
- Sin edición ni borrado en v1 (auditoría simple). Fuera de alcance: voz/vídeo (Discord), reacciones, hilos.

## Connections
`dice` (adjunto), `identity` (alias/avatar), `realtime` (`postgres_changes`), `table` (eventos por bus, no acoplamiento).

## Modelo de datos
> Pending — DBA. Propuesta: `messages` (id, campaign_id, author_id, recipient_id nullable = mesa, text, roll_id
> nullable, from_dm bool, at).
