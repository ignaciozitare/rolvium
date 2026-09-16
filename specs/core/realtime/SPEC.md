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
   recargar la devuelve.

   Y medido el 2026-09-17, el mismo fallo en los TRAZOS es peor: **un trazo a pulso de 400 puntos pierde
   `data` en el eco** (uno de 200 llega entero), y el camino existe hoy — arrastrar un trazo a otra capa hace
   `update({ layer_id })`, que no toca `data`. Ahí no se pierde un trazo: `DrawingShape` leía `data.points`
   sobre nada y reventaba AL PINTAR, y como **no hay ni un ErrorBoundary en la app**, React tira el árbol
   entero y **la mesa se queda en blanco**.

   `keepUnsent` lo corta con dos reglas, las dos imposibles como cambio legítimo:
   **(a) un eco nunca VACÍA una lista que ya teníamos** —una sala sin contorno no existe: se borra la fila, y
   eso llega como `DELETE`—; **(b) un eco nunca convierte en `undefined` algo que teníamos** — `undefined` no
   es un valor: por REST siempre vienen todas las columnas pedidas, y una vacía llega como `null`, que sí es
   un valor y sí manda (quitar una silueta tiene que seguir funcionando).

⚠️ **LO QUE ESTO EXIGE AL ESCRIBIR UN MAPEADOR: no inventes un valor por defecto para una columna que pueda
pasar de ~2 KB.** Un `?? null` o un `?? {}` convierte «no vino» en un valor y **tapa la ausencia justo donde
`keepUnsent` tiene que verla**. Por eso `mapDrawingRow.data` y `mapScenePropRow.silhouette` van a pelo, con su
comentario al lado. Por REST no cambia nada: la columna siempre viene.

⚠️ **Al añadir una columna que pueda pasar de ~2 KB, o al escribir un `UPDATE` en lote que no la toque, dar
por hecho que NO llegará en el eco.**

🧹 **Deuda conocida, NO tocada**: no hay ni un `ErrorBoundary` en `apps/web`, así que **cualquier** error al
pintar —no sólo éste— tumba la mesa entera en vez de un trozo. `DrawingShape` lleva ya su red local, pero eso
es un parche de un sitio, no la solución. Decisión aparte.

## Connections
Supabase Realtime (`campaign:{id}`); `identity` para el JWT del canal.

## Modelo de datos
Sin tablas propias. `campaigns.device_sessions` es informativa (ver `identity`).
