# La mesa (H3) — SPEC

> **Este spec está escrito para RECONSTRUIR el módulo desde cero**, no como diario de decisiones. Es la primera
> pieza escrita con el molde de nueve secciones que manda `CLAUDE.md` § «Specs» desde el 2026-09-17.

## Propósito

La sesión en vivo: el sitio donde se juega. Al entrar en una campaña la mesa **se viste con el sistema de
juego** (papel, tipografías, lunas en Plenilunio) y reúne en una sola pantalla la ficha, la escena, los dados,
el chat, las notas y el panel del director.

**Quién lo usa:** los miembros de la campaña, y sólo ellos. Hay dos papeles con vistas distintas —**director**
(uno por campaña, el que la creó) y **jugador**—, y lo que ve uno no se le sirve nunca al otro.

## Qué puede hacer el usuario

**Cualquier miembro**
- Entrar en la mesa de una campaña de la que es miembro (`/table/:id`).
- Ver **quién está conectado**: el director con borde dorado, los jugadores con halo verde si están, atenuados
  si no; el suyo propio marcado. Y en cuántos aparatos está él mismo conectado.
- Moverse entre **pestañas**. Jugador: Ficha · Escena · Crear personaje. Director: Ficha · El grupo · Escena ·
  Bestiario · Crear personaje.
- Abrir y cerrar el **lanzador de dados**, que es un panel flotante que se arrastra.
- Usar el **lateral**: Registro de tiradas · Chat · Notas · Bitácora. Y plegarlo para ganar sitio.
- **Coger y devolver** recursos compartidos del sistema (en Plenilunio, la Reserva de Destino).
- Abrir **su ficha en una ventana aparte** (`/table/:id/sheet/:charId`), sincronizada con la mesa.

**Sólo el director**
- Ver el panel **«El grupo»**: cada jugador con su personaje, su resistencia, su estado de salud, sus recursos,
  y el **registro de cambios** de las fichas.
- Ver la ficha de cualquier jugador en modo lectura.
- **Reiniciar** un recurso compartido.
- Todo lo de la pestaña Escena que lleva permiso (ver § Permisos).

## Pantallas

| Pantalla / parte | Qué es | Lámina |
|---|---|---|
| La mesa | El caparazón entero: barra Rolvium, cabecera, pestañas, cuerpo y lateral | `rolvium.pen` § 4 · LA MESA |
| Barra Rolvium | Fina, arriba: ← Campañas · nombre · chip de sistema · aparatos · avisos · avatar | § 4 · LA MESA |
| Cabecera de la mesa | Sistema + campaña · conectados · papel (JUGADOR/DIRECTOR) · abrir ficha aparte | § 4 · LA MESA |
| Recursos compartidos | Centrados bajo la cabecera. En Plenilunio: lunas grandes, «en tu mano», Devolver | § 4 · LA MESA |
| Lateral (272 px) | Lanzador de dados + Registro · Chat · Notas · Bitácora | § 4 · LA MESA |
| El grupo (director) | Un jugador por fila, con la etiqueta «SOLO DIRECTOR» | § 4 · LA MESA |
| Ficha en ventana aparte | `/table/:id/sheet/:charId`, con el aviso «sincronizada con la mesa» | § 4 · LA MESA |
| Estados vacíos y de error | Sin escena activa · sin ficha · reserva agotada · sin conexión | § 11 · ESTADOS VACÍOS Y ERRORES |

⚠️ **Pendiente**: los nombres exactos de cada lámina de la § 4 se rellenan la próxima vez que el `.pen` esté
abierto (el 2026-09-17 no era accesible al escribir esto). La sección y el contenido sí están confirmados.

## Reglas y límites

- **Un director por campaña.** El papel se da una sola vez, automáticamente, al crearla; todo el que entra
  después entra como jugador, y **no hay forma en la app de nombrar a otro**. La base no lo prohíbe con una
  restricción, pero nada puede crear un segundo.
- **La vista del director no se le sirve nunca a un jugador**: el filtrado es de servidor, no de pantalla.
- Los recursos compartidos se descuentan **de forma atómica en el servidor** (`UPDATE … WHERE pool >= n`, con
  bloqueo de fila). Si dos piden el último, uno recibe un error y se le dice.
- Un personaje **que ya está al máximo** de un recurso no puede coger más; se bloquea y se explica por qué.
- **Sólo el director reinicia** un recurso. El director **no coge dados**.
- **«Mejorar» NO es una pestaña**: es un botón dentro de la ficha (dueño, 2026-08-20). Ver § Decisiones.

## Estados y errores

| Estado | Cuándo | Qué ve él |
|---|---|---|
| Cargando | Mientras se pide la campaña y el sistema | «Cargando…» a pantalla completa |
| No eres miembro | Entra en una campaña a la que no pertenece | Candado + «No eres miembro de esta campaña» |
| Sistema no instalado | La campaña usa un sistema que no está en el registro | Icono de extensión + el aviso |
| Error | Falla la carga, o falta campaña/sistema/usuario | Icono de error + «Ha habido un error» |
| Sin escena activa | El director no ha activado ninguna | «El director aún no ha activado ninguna escena» |
| Reserva agotada | Se han gastado todos los dados de la aventura | Se dice, y se aclara que sólo el director reinicia |
| Un trozo roto | Algo revienta al pintarse dentro de una pestaña | La red del § `core/errors`: se cae ese trozo y no la mesa |

## Permisos

| Acción | Quién | Clave del motor de roles |
|---|---|---|
| Entrar en la mesa | Miembro de la campaña | — (membresía, por RLS) |
| Ver «El grupo» y las fichas ajenas | Director | — (papel `dm` de la campaña) |
| Reiniciar un recurso compartido | Director | — (comprobado en la función de base) |
| Subir y ordenar texturas del mapa | Director con permiso | `manage_textures` |
| Subir y ordenar objetos del mapa | Director con permiso | `manage_props` |
| Ordenar la barra de herramientas para todos | Admin | `manage_settings` |

Los permisos se resuelven **en el caparazón** (`usePermissions`) y bajan por parámetro: `maps` no tiene por qué
saber cómo se leen los roles.

## Modelo de datos

**Sin tablas propias.** El estado de los recursos compartidos vive en
`campaigns_campaigns.shared_resources` (jsonb `{ id: { value, max, hands: { userId: n } } }`).
Migración: `20260817130000_table_shared_resources.sql`.

Los jugadores **no escriben esa columna directamente**: pasan por funciones `SECURITY DEFINER` atómicas, con
bloqueo de fila.

| Función | Qué hace | Errores |
|---|---|---|
| `table_take_resource(cid, rid, n)` | Coger n del recurso (el máximo por tirada sale del propio recurso) | `pool_empty` · `per_take_max` · `not_member` |
| `table_return_resource` | Devolver lo que tiene en la mano | — |
| `table_reset_resource` | Reiniciar (sólo director) | `forbidden` |
| `table_spend_hand` | Consumir los dados al tirar (**sólo `service_role`**: lo llama la API) | — |

**Tiempo real:** `campaigns_campaigns` y `campaigns_members` están en la publicación; la presencia va por el
canal `campaign:{id}`.

## Fuera de alcance

- **Más de un director por campaña.** No se construye mientras él no lo pida: hoy la campaña es de quien la
  crea (ver § Reglas).
- **Claro/oscuro dentro de la mesa.** No existe: manda el tema del sistema (`--sys-*`). Los colores de la app
  (`--tx`, `--sf`…) **no se usan por debajo de `.tb-table`**.
- Voz y vídeo. Nunca se ha pedido.

## Decisiones

- **«Mejorar» no es una pestaña** (dueño, 2026-08-20). Mejorar es algo que le haces a la ficha que estás
  mirando, no un sitio aparte al que ir; como pestaña te sacaba de la ficha para volver a cargarla al lado.
  Es un botón dentro de la ficha, al lado de «Editar» y «Abrir ficha aparte», y abre el panel encima.
- **El descuento de recursos es de servidor y atómico** desde el principio: con dos jugadores pidiendo el
  último dado a la vez, cualquier cosa hecha en el navegador se lo daría a los dos.
- **La mesa se viste con el sistema, no con la marca.** Todo lo que hay debajo de `.tb-table` usa sólo
  `--sys-*`, y por eso un sistema nuevo se ve distinto sin tocar una línea de este módulo.
- **El director no coge dados** de la reserva: la reserva es de los jugadores.
