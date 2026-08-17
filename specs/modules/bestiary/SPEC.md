# Bestiary (H5) — SPEC

## Purpose
El director tiene a mano PNJ, monstruos y encuentros con características completas (no solo un token), puede tirar
en su nombre y colocarlos en la escena. Who: **solo director** (los jugadores solo ven lo que hay en el mapa).

## What the user can do
- **Listado** por campaña con filtros Todos / Manual / Propios / PNJ con ficha y buscador; cada entrada: token,
  nombre, origen (MANUAL · PROPIO · PNJ·FICHA), notas, Resistencia·Protección, características clave, "N en escena",
  acciones **Tirar** (con visibilidad mesa/DJ/secreta), **Colocar**, menú (editar, duplicar, borrar, token PNG).
- Fuentes: criaturas del sistema (`catalogs.bestiary`), PNJ creados con el **generador** (tipo PNJ), **copias
  rápidas** con ajustes ("otro mutante"), PNJ con ficha completa (aliados) usando el mismo `<Sheet>` de `characters`.
- **Encuentros**: desde la escena, el botón Encuentro abre un desplegable con buscador y todas las entradas; colocar
  crea una **instancia** con su propia Resistencia/estado; los tokens colocados pueden estar ocultos a los jugadores.
- Token PNG propio por entrada (además del color+iniciales).

## Rules & limits
- Nada de este hexágono es visible por API a un jugador salvo los tokens visibles de la escena (vía `maps`).
- Instanciar no modifica la plantilla; borrar la plantilla no borra instancias ya colocadas.
- Las entradas "del manual" no reproducen texto del libro: solo valores de juego y resúmenes propios.

## Connections
`game-system` (bestiario base, engine para tirar), `characters` (Sheet, generador), `maps` (tokens/instancias),
`dice` (tiradas del DJ), `realtime`.

## Modelo de datos
> Pending — DBA. Propuesta: `bestiary_entries` (id, campaign_id nullable si viene del sistema, system_id, name, data
> jsonb, token_url, origin manual|custom|npc, notes); instancias en `maps.tokens` (`bestiary_entry_id`, `state` jsonb).
