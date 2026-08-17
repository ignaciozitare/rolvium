# Rolvium — Spec index

Source of truth for functionality. Read the relevant spec before touching its area.

## Core
- [Auth](core/auth/SPEC.md) — login, session, profile
- [Roles & permissions](core/roles-permissions/SPEC.md) — roles, permission model, admin area
- [Testing](core/testing/SPEC.md) — suites, helpers, coverage rule
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
- [maps (H7)](modules/maps/SPEC.md) — escenas, fondos, muros, niebla, tokens, dibujo
- [chat (H8)](modules/chat/SPEC.md) — mesa, privados, susurros, adjuntos
- [journal (H9)](modules/journal/SPEC.md) — notas privadas, bitácora con versiones
- [system-plenilunio (HX)](modules/system-plenilunio/SPEC.md) — primer sistema de juego
- notifications (H11) — futuro, sin spec aún
