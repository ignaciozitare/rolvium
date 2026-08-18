# Realtime & table event bus — SPEC

## Purpose
Que todos los dispositivos de una campaña vean lo mismo al instante: tiradas, fichas, tokens, niebla, chat,
presencia. Sin websockets propios (la API es serverless): Supabase Realtime, **un canal por campaña**.
Who: transversal; sin UI propia. Lo usan `table`, `characters`, `dice`, `maps`, `chat`, `journal`, `bestiary`.

## How it works
| Qué | Mecanismo |
|---|---|
| Tiradas, fichas, recursos compartidos, escena activa, miembros | `postgres_changes` (fila persistida = evento) |
| Mensajes de chat, versiones de bitácora | `postgres_changes` |
| Arrastre de tokens, trazo en curso, cursores en bitácora | `broadcast` a 20–30 Hz (efímero) |
| Posición final del token, trazo terminado | `UPDATE`/`INSERT` (persistido) |
| Pin de enfoque | `broadcast` |
| Presencia (quién está, en qué dispositivo, qué pestaña) | `presence` |
- Bus interno de la mesa (`packages/core/events.ts`): tipos `roll.created`, `sheet.patched`, `resource.changed`,
  `token.moved`, `fog.updated`, `message.created`, `pin.focused`, `scene.activated`. Cada hexágono publica los suyos y
  se suscribe a los que necesita; nunca importa el infra de otro.
- Un usuario puede tener varias sesiones (portátil + tablet); todas reciben los mismos eventos. No hay expulsión.
- La **ficha en ventana aparte** (`/table/:id/sheet/:charId`) es una sesión más del canal.

## Canales en uso (2026-08-18)
`campaign:{id}` (mesa: campaña, miembros, presencia) · `campaign-rolls:{id}` (dice) · `scene:{sceneId}` (maps: filas + broadcast
de arrastre y pin). El spec pedía un único canal por campaña; se dividió por volumen y por vida útil distinta (una escena se
cambia, la mesa no). Los **payloads** siguen siendo los tipos de `packages/core/events.ts`.

## Rules & limits
- Lo que un jugador no debe ver (muros, tokens ocultos, tiradas secretas, niebla ajena) se filtra **por RLS**: el
  canal solo entrega filas que la RLS permite. Nunca se filtra en el cliente.
- Reconexión: banner "Sin conexión con la mesa · reintentando"; los cambios locales se reencolan.
- Máximos orientativos por campaña: 8 jugadores, 20 escenas, 60 tokens/escena, 200 trazos/escena (punto de medir, no tope).

## Connections
Supabase Realtime (`campaign:{id}`); `identity` para el JWT del canal.

## Modelo de datos
Sin tablas propias. `campaigns.device_sessions` es informativa (ver `identity`).
