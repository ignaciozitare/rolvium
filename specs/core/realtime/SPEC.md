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

### Qué se puede creer de un eco (`postgres_changes`)
Un eco NO es la fila entera garantizada. Dos reglas, las dos con su fallo detrás y las dos en
`modules/maps/domain/useCases/liveRules.ts`:

1. **No hay orden.** Dos cambios seguidos sobre la misma fila pueden llegar al revés. `isStaleRow` descarta el
   que sea más viejo que lo que ya hay (reloj, o número de versión donde lo haya). Fallo del 2026-09-15: el
   mapa volvía al PNG anterior y las últimas pinceladas se esfumaban.

2. **Una columna grande puede NO VENIR.** Postgres guarda fuera de la fila los valores que pasan de ~2 KB
   (TOAST) y **no los repite en el registro de replicación si el `UPDATE` no los ha tocado**. El eco llega
   entero menos esa columna, el mapeo de infraestructura no puede distinguir «no vino» de «vacío», y lo
   convierte en `[]`.
   Medido el 2026-09-16 contra «test dungeon2»: guardar una pincelada de suelo actualiza las 53 salas
   excavadas de golpe —todas apuntan al mismo PNG— y **9 de los 53 ecos llegan sin `maps_rooms.points`**: los
   9 de mano alzada más gordos (1.796–3.800 bytes). Una sala rectangular ocupa 200 y no cruza el umbral nunca.
   Efecto: la sala se queda sin contorno y **desaparece de la pantalla** aunque en la base esté intacta —
   recargar la devuelve. `keepUnsentLists` lo corta: **un eco nunca vacía una lista que ya teníamos.**
   Vaciarla no es un cambio legítimo (una sala sin contorno no existe: se borra la fila, y eso llega como
   `DELETE`); una lista con contenido sigue mandando.

⚠️ **Al añadir una columna que pueda pasar de ~2 KB, o al escribir un `UPDATE` en lote que no la toque, dar
por hecho que NO llegará en el eco.** La regla 2 cubre las listas por su forma, no por su nombre, así que una
columna nueva que sea lista queda protegida sola; una que sea objeto o texto largo **no**, y hay que decidir
qué hacer con ella. Hoy la más cercana al umbral es `maps_drawings.data` (1.372 bytes medidos).

## Connections
Supabase Realtime (`campaign:{id}`); `identity` para el JWT del canal.

## Modelo de datos
Sin tablas propias. `campaigns.device_sessions` es informativa (ver `identity`).
