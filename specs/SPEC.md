# Rolvium — Spec index

Source of truth for functionality. Read the relevant spec before touching its area.

## Core
- [Auth](core/auth/SPEC.md) — login, session, profile
- [Roles & permissions](core/roles-permissions/SPEC.md) — roles, permission model, admin area
- [Testing](core/testing/SPEC.md) — suites, helpers, coverage rule
- [Imágenes](core/images/SPEC.md) — subida única y compresión a WebP en el navegador (avatares, tokens, fondos)
- [Game System port](core/game-system/SPEC.md) — contrato `GameSystem` que implementa cada sistema de juego
- [Realtime & event bus](core/realtime/SPEC.md) — canal por campaña, presencia, bus de la mesa

## Modules
Product hexagons (map in `ARCHITECTURE.md`):
- [identity (H1)](modules/identity/SPEC.md) — registro (abierto / por código), perfil, avatar, dispositivos, idioma
- [campaigns (H2)](modules/campaigns/SPEC.md) — crear/unirse, sistema anclado, invitaciones, opciones de mesa
- [table (H3)](modules/table/SPEC.md) — mesa en vivo, recursos compartidos, panel del director
- [characters (H4)](modules/characters/SPEC.md) — fichas PJ, generador, progresión, auditoría
- [bestiary (H5)](modules/bestiary/SPEC.md) — PNJ, monstruos, encuentros
- [dice (H6)](modules/dice/SPEC.md) — tiradas en servidor, lanzador flotante, visibilidad
- [maps (H7)](modules/maps/SPEC.md) — escenas, fondos, muros, niebla, tokens, dibujo, paredes sólidas, capas, luces que se recortan contra los muros, sonda de prueba (§ 7.3); constructor de salas y catálogo de texturas (rebanada 8); *penumbra bloqueada (§ 7.4); **rebanadas 9 y 10 construidas y probadas por él, sin mergear** (rama `feat/maps-pincel`): el pincel PINTA ENCIMA —se elige sobre qué y eso es el límite, la pintura se suma y NO cambia el mapa— y «A pulso» del Builder saca una banda del ancho elegido; **rebanada 6 · los objetos** (galería de piezas): diseño ajustado al Pincel y aprobado el 2026-09-11, la biblioteca es de la HERRAMIENTA —«lo que se sube sirve para todos»—; el § «Rebanada 6» está pendiente de reescribirse con eso; hoy sólo existe la parte de guardar, sin pantalla*; **§ 10B.4 · el borde roto de «A pulso»**: confirmado y construido el 2026-09-11 (sin mergear), sólo dibujando aquí; **§ «Las paredes no se recalculan en cada movimiento»** (la lentitud de las salas, 2026-09-11 noche): mismo resultado, sin comparar lo lejano, recordado por escena en el servidor y una vez por cambio en pantalla
- [chat (H8)](modules/chat/SPEC.md) — mesa, privados, susurros, adjuntos
- [journal (H9)](modules/journal/SPEC.md) — notas privadas, bitácora con versiones
- [adventures (H12)](modules/adventures/SPEC.md) — aventuras del director: documento, escenas y encuentros *(propuesto)*
- [system-plenilunio (HX)](modules/system-plenilunio/SPEC.md) — primer sistema de juego
- notifications (H11) — futuro, sin spec aún
