# Rolvium — Spec index

Source of truth for functionality. Read the relevant spec before touching its area.

## Core
- [Auth](core/auth/SPEC.md) — login, session, profile
- [Roles & permissions](core/roles-permissions/SPEC.md) — roles, permission model, admin area
- [Testing](core/testing/SPEC.md) — suites, helpers, coverage rule
- [Imágenes](core/images/SPEC.md) — subida única y compresión a WebP en el navegador (avatares, tokens, texturas,
  objetos, fondos); nivel de compresión por tipo, elegible en Admin → Ajustes
- [Game System port](core/game-system/SPEC.md) — contrato `GameSystem` que implementa cada sistema de juego
- [Realtime & event bus](core/realtime/SPEC.md) — canal por campaña, presencia, bus de la mesa
- [Errores al pintar](core/errors/SPEC.md) — la red que hace que un error estropee un trozo y no la mesa entera

## Modules
Product hexagons (map in `ARCHITECTURE.md`):
- [identity (H1)](modules/identity/SPEC.md) — registro (abierto / por código), perfil, avatar, dispositivos, idioma
- [campaigns (H2)](modules/campaigns/SPEC.md) — crear/unirse, sistema anclado, invitaciones, opciones de mesa
- [table (H3)](modules/table/SPEC.md) — mesa en vivo, recursos compartidos, panel del director
- [characters (H4)](modules/characters/SPEC.md) — fichas PJ, generador, progresión, auditoría
- [bestiary (H5)](modules/bestiary/SPEC.md) — PNJ, monstruos, encuentros
- [dice (H6)](modules/dice/SPEC.md) — tiradas en servidor, lanzador flotante, visibilidad
- [maps (H7)](modules/maps/SPEC.md) — escenas, fondos, muros, niebla, tokens, dibujo, paredes sólidas, capas, luces que se recortan contra los muros, sonda de prueba (§ 7.3); constructor de salas y catálogo de texturas (rebanada 8); *penumbra bloqueada (§ 7.4); **rebanadas 9 y 10 en producción desde el 2026-09-12 (v0.7.0)**: el pincel PINTA ENCIMA —se elige sobre qué y eso es el límite, la pintura se suma y NO cambia el mapa— y «A pulso» del Builder saca una banda del ancho elegido; **rebanada 6 · los objetos** (galería de piezas): **CONSTRUIDA ENTERA la noche del 2026-09-12→13** (rama `feat/maps-objetos`, sin mergear, ⏳ pendiente de que él la pruebe) sobre las láminas aprobadas el 2026-09-11 — la biblioteca es de la HERRAMIENTA en paquetes propios detrás de `manage_props`, catálogo a pantalla completa, subida en lote, el panel del sello (una / muchas), coger-mover-girar-escalar-copiar lo plantado, el menú del botón derecho con el orden de apilado, y las piezas que estorban cuentan en la visión del servidor; § «Rebanada 6» reescrito*; **§ 10B.4 · el borde roto de «A pulso»**: confirmado y construido el 2026-09-11, en producción, sólo dibujando aquí; **§ «Las paredes no se recalculan en cada movimiento»** (la lentitud de las salas, 2026-09-11 noche): mismo resultado, sin comparar lo lejano, recordado por escena en el servidor y una vez por cambio en pantalla; **§ «La línea de vista sólo mira lo que tiene al alcance»** (2026-09-12): rayos sólo a lo que está al alcance, rejilla de paredes, polígonos sin puntos de más, y en pantalla la mazmorra en su propio dibujo y el mapa tapado (no enmascarado) por donde el jugador no ve — todo a 60 fps con su «Dungeon»; **🦷 la ficha rodea las puntas** (2026-09-12, § «Rebanada 4 — Cómo se siente»): un borde dentado ya no la clava, y sigue sin cruzar jamás; **🧲 la barra se ordena arrastrando** (§ «La barra se ordena arrastrando…», 2026-09-12): sólo el admin, dentro de cada bloque, y el orden vale para todos — construida y revisada el 2026-09-12, **en producción (v0.7.0)**; **🔁 el Builder recuerda su modo** (2026-09-12, en este navegador, como la escena que mirabas); **🔄 las dos texturas base se giran** (2026-09-12, una barra de giro bajo la del azulejo, por escena; en producción); **🔪 § 6.9 · LA SILUETA** (2026-09-16): lo que estorba de un objeto sale del contorno de su PNG y no de un cuadrado —queja suya con dos capturas, maqueta aprobada con «está perfecto»—, se saca sola al subir dentro de la misma pasada que comprime la imagen, y los 149 ya subidos se hicieron de una vez con `scripts/gen-silhouettes.mjs`, **sin botón en la aplicación porque él lo paró**
- [chat (H8)](modules/chat/SPEC.md) — **SUSURROS** en pantalla (`chat` sólo por dentro): sin canal público, directorio de los jugadores de la campaña, conversaciones de uno a uno y de grupo, la pastilla que avisa y se contesta sin salir de la partida, tirar en privado sin rastro en el Registro y traer una tirada del Registro. *Spec cerrado con él el 2026-09-15; **construido entero ese mismo día y EN PRODUCCIÓN desde esa misma noche (v0.10.0)**, con las migraciones `chat_susurros` y `chat_susurros_harden` aplicadas al proyecto de producción. **Las pastillas tipo LinkedIn** (ventanitas de conversación sobre la mesa: nacen minimizadas, se despliegan, se cierran y avisan en sangre con un sonido) entraron el 2026-09-16 con la **v0.11.0**. ⏳ Pendiente: el botón para traer una tirada del Registro: el modelo de datos (`kind='roll_ref'`, con su RLS) ya lo soporta, pero la entrada en pantalla no estaba en el `.pen` aprobado y le toca su propio paso de diseño.*
- [journal (H9)](modules/journal/SPEC.md) — notas privadas, bitácora con versiones
- [adventures (H12)](modules/adventures/SPEC.md) — aventuras del director: documento, escenas y encuentros *(propuesto)*
- [system-plenilunio (HX)](modules/system-plenilunio/SPEC.md) — primer sistema de juego
- notifications (H11) — futuro, sin spec aún

---

## 📋 BACKLOG DE SPECS (orden suya, 2026-09-17)

> «*hazte un backlog de cosas que tengas que escribir el spec, por ejemplo el pincel, el builder, texturas,
> etc. … que entiendo que son subdominios de alguna parte, y vas escribiendo los specs*»

**Cómo se cierra**: cada vez que se toque uno de estos subdominios, **se escribe su spec entero** con las nueve
secciones de `CLAUDE.md` § «Specs» antes de dar la tarea por terminada. Nunca en lote.
`npm run audit` (chequeo `specs`) lo hace DURO para lo que la rama toque.

### Subdominios de `maps` — 16.363 líneas en un solo hexágono, el 64 % de todo el código de módulos

| Subdominio | Dónde vive hoy | Spec |
|---|---|---|
| **El pincel** | `BrushPanel` · `usePaintBrush` · `useMaskPainter` · `PaintColor` · `paintRules` | ⏳ |
| **El constructor** (muros, puertas, salas) | `BuilderPanel` · `roomRules` · `roomStyles` · `snapRules` | ⏳ |
| **Texturas** | `TextureCatalog` · `TextureUpload` · `libraryRules` | ⏳ |
| **Objetos** | `PropsPanel` · `PropsCatalog` · `PropsUpload` · `propRules` | ⏳ |
| **Capas y luces** | `LayersPanel` · `LayerMenu` · `LightEditor` · `layerRules` | ⏳ |
| **Escenas** (crear, activar, ordenar) | `ScenesMenu` · `mapRules` | ⏳ |
| **Fondo** | `BackgroundCatalog` · `BackgroundPopover` · `BackgroundUpload` · `backgroundRules` | ⏳ |
| **Niebla y visión** | calculada en la API; `useScene` la pide | ⏳ |
| **La barra de herramientas** | `Toolbar` · `toolbarRules` · `groupRules` | ⏳ |
| **El lienzo** (el motor de pintado) | `MapCanvas` · `canvasLayers` · `roomsLayer` | ⏳ |
| **La escena en vivo** | `useScene` · `liveRules` | ⏳ |

### 🚪 La puerta de cada módulo (`index.ts`) — orden suya, 2026-09-17

> «*hay que arreglar esto del index, ponlo en el backlog y ve corrigiéndolo de a poco, y procura no agregar
> cosas sin él*»

**Ningún módulo tenía `index.ts`.** Sin esa puerta, 98 importaciones entraban dentro de otro módulo. Se cierra
**según se toque cada uno**; lo nuevo nace ya con puerta — chequeo `module-index` en `npm run audit`, duro sólo
para un módulo nuevo sin puerta o una importación cruzada nueva (lo viejo mide como aviso y se cierra de a poco).

| Módulo | Importaciones que entraban por dentro | Su cara pública |
|---|---|---|
| ✅ `maps` | 12 + 1 en su `ui` | `container` · `Scene` (entidades) · `MapsPort` · `VisionPort` · `ToolbarOrderPort` · `mapRules` (reglas) · `SceneTab` — `apps/web/src/modules/maps/index.ts` |
| ✅ `table` | 1 | `TablePage` — `apps/web/src/modules/table/index.ts` |
| `characters` | 30 | `container` · `Character` · `CharactersPort` · `characterRules` · `systemText` · 3 páginas |
| `campaigns` | 17 | `container` · `Campaign` · `CampaignsPort` · `campaignRules` · `CampaignsPage` |
| `dice` | 14 + 7 en su `ui` | `container` · `Roll` · sus puertos · sus paneles |
| `bestiary` · `chat` | 3 + 4 · 2 + 2 | ⏳ |
| `auth` | 1 (entra en su **infra**) | ⏳ |

### Specs existentes por debajo del listón

Medido por `npm run audit`. Se cierran **según se toque cada módulo**.

| Spec | Líneas | Le faltan |
|---|---|---|
| `modules/journal` | 21 | casi todas |
| `core/testing` | ~40 | casi todas |
| `core/auth` | 30 | casi todas |
| `modules/campaigns` · `modules/characters` · `modules/identity` | 65-71 | la mayoría |
| `core/roles-permissions` · `core/game-system` · `core/images` · `core/realtime` | 51-91 | las secciones del molde |
| `modules/chat` · `modules/system-plenilunio` · `modules/adventures` · `modules/bestiary` · `modules/dice` | 93-425 | las secciones del molde |
| ✅ `modules/table` | 130 | **ninguna** — es la muestra del molde |
| ✅ `modules/maps` | 3.100 | **ninguna** — tiene ya el índice de «qué hay» |
