# Adventures (H12) — SPEC

## Purpose
Dentro de una campaña, el **director** escribe y gestiona **aventuras**: el guion de una historia
con su texto, sus escenas y sus encuentros. Es el sitio donde el DJ prepara la partida antes de
sentarse a la mesa, y desde donde salta a la escena que toca.

Hoy las escenas cuelgan directamente de la campaña y no hay dónde escribir nada: la preparación
vive fuera de Rolvium (un documento aparte) y la mesa sólo tiene el mapa.

**Estado: spec CERRADO por el dueño (2026-08-19). Nada construido.** Siguiente paso del flujo:
dba → scaffold → design (`.pen`) → dev → review → qa.

## Decisiones del dueño (2026-08-19)
1. **Toda campaña tiene aventuras.** No hay escenas sueltas: la migración crea una «Aventura 1»
   por campaña y le cuelga las escenas que ya existan. Una sola forma de organizarse.
2. **Las tablas de PNJ y encuentros son texto enriquecido en v1.** Se escriben y se leen dentro
   del documento, como en un manual impreso. Enlazarlas con entidades reales exige el **Bestiario
   (H5)**, que no está construido, y es otra rebanada.
3. **Sección propia en la cabecera de la plataforma**, no una pestaña más de la Mesa. Con **rail
   lateral** de aventuras (1, 2, 3…) a lo OneNote, y **abrible en ventana aparte** como la ficha
   de personaje.
4. **El editor guarda solo.** Sin botón de guardar.
5. **Todo el contenido vive en la BASE DE DATOS, nunca en el front.** Regla general del dueño, no
   sólo para aventuras: personajes, encuentros y aventuras son datos, no código. La intención a
   futuro es poder llegar a ellos desde fuera —un MCP, una sincronización con Drive, una IA que
   los lea—, y eso sólo funciona si la fuente es la base. Ver «Deuda que esto deja al descubierto».

## What the user can do

### El director
- **Ver la lista de aventuras** de la campaña, con su estado (borrador · en curso · terminada),
  cuántas escenas tiene y cuándo se tocó por última vez.
- **Crear una aventura**: nombre y poco más; el resto se escribe dentro.
- **Escribir la aventura** en un editor de texto con formato: títulos, párrafos, negrita/cursiva,
  listas, citas (para leer en voz alta), separadores, y **tablas**.
- **Meter una tabla de PNJ o de encuentro** desde el editor, con una plantilla ya montada:
  - *PNJ*: nombre · qué es · qué quiere · notas.
  - *Encuentro*: PNJ · cuántos · dificultad · notas.
- **Gestionar las escenas de la aventura**: crear, renombrar, reordenar, mover una escena a otra
  aventura, y abrirla en la mesa.
- **Marcar la aventura en curso** — es la que la mesa abre por defecto.
- **Archivar** una aventura (no se borra: se saca de en medio).

### El jugador
- **No ve las aventuras.** Es material del director. El jugador sigue viendo sólo la escena
  activa o marcada visible, igual que hoy.
- (Futuro, fuera de v1: que el DJ publique trozos de una aventura a la bitácora — eso es `journal` H9.)

## Rules & limits
- Sólo el **director de la campaña** (y un admin de plataforma) lee o escribe aventuras. El
  jugador no las lista ni por id.
- Una escena pertenece **siempre y sólo** a una aventura, de la misma campaña. Mover una escena
  entre aventuras es cambiar `adventure_id`, nunca duplicarla.
- Borrar una aventura **no borra sus escenas**: pide antes a dónde van, o se archiva.
- El documento es de **un solo autor a la vez** en v1: sin edición concurrente ni CRDT. Se guarda
  solo con retardo y se avisa de conflicto si otro director tocó lo mismo (comparando `updated_at`).
- Límites orientativos: 50 aventuras por campaña, 200 KB por documento.

## Modelo de datos

```
adventures_adventures
  id             uuid pk
  campaign_id    uuid not null → campaigns_campaigns(id) on delete cascade
  title          text not null (1..120)
  summary        text                       -- una línea, para la lista
  doc            jsonb not null default '{}'  -- el documento (ver abajo)
  status         text not null default 'draft' check in ('draft','running','done','archived')
  sort_order     int not null default 0
  created_by     uuid → users(id) on delete set null
  created_at / updated_at  timestamptz
```

```
maps_scenes
  + adventure_id uuid not null → adventures_adventures(id) on delete restrict
```

**Migración de lo que ya existe**: por cada campaña con escenas, crear
`adventures_adventures` («Aventura 1», status `running`) y poner su id en todas sus escenas.
Campañas sin escenas también reciben la suya, para que la regla «toda escena tiene aventura» no
tenga excepciones. La columna entra como nullable, se rellena, y luego se pone `NOT NULL`.

### El documento (`doc`)
JSON, no HTML: se pinta desde el cliente y nunca se inyecta como marcado (regla de XSS del
proyecto). Un árbol de bloques, cada uno con su `type`:

```
{ "v": 1, "blocks": [
  { "type": "heading", "level": 2, "text": [...] },
  { "type": "paragraph", "text": [...] },
  { "type": "quote", "text": [...] },              // para leer en voz alta
  { "type": "list", "ordered": false, "items": [[...], ...] },
  { "type": "divider" },
  { "type": "sceneRef", "sceneId": "uuid" },       // salta a la escena desde el texto
  { "type": "table", "kind": "npc" | "encounter" | "plain",
    "columns": ["PNJ", "N.º", "Notas"],
    "rows": [ { "cells": [[...], ...], "npcId": null } ] }
]}
```

- `text` es un array de tramos `{ "t": "…", "b": true, "i": true }` — negrita y cursiva y poco más.
- **`npcId` va en cada fila desde el día uno**, siempre `null` en v1. Es el hueco que el Bestiario
  (H5) rellenará sin tener que migrar ni un documento.
- `sceneRef` es lo que ata el texto a la mesa: en el editor se ve como un chip con el nombre de la
  escena y en lectura es un botón que la abre.

## RLS
- `SELECT` / `INSERT` / `UPDATE` / `DELETE`: `public.is_campaign_dm(campaign_id)`, más `public.is_admin()`.
- **Ninguna política para el jugador**: no es «filtrar campos», es que la fila entera no existe para él.
- `maps_scenes` no cambia de política: su acceso ya va por campaña, y la aventura es del DJ.

## Connections
| Con | Para qué |
|---|---|
| `campaigns` (H2) | de quién es la aventura, y quién es el director |
| `maps` (H7) | las escenas pasan a colgar de la aventura; `sceneRef` abre una desde el texto |
| `bestiary` (H5) | **futuro**: rellenar `npcId` y soltar un encuentro en la escena |
| `journal` (H9) | **futuro**: publicar un trozo de aventura a la bitácora de la mesa |

## Lo que NO entra en v1
- Enlazar PNJ de verdad (necesita H5) · soltar un encuentro en el mapa desde la tabla.
- Edición a la vez por dos directores · historial de versiones del documento.
- Imágenes dentro del documento · importar/exportar.
- Compartir la aventura con los jugadores.

## La pantalla (decidido por el dueño)
**Sección propia en la cabecera de la plataforma**, al lado de las que ya hay — no una pestaña más
de la Mesa: la barra de la mesa ya viene justa de ancho con seis pestañas y los rótulos no se
acortan.

Ruta `/campanas/:id/aventuras/:adventureId?`. Tres zonas, a lo OneNote:

```
┌─ cabecera de plataforma · «Aventuras» ────────────────────────────────────────┐
├──────────────┬────────────────────────────────────────────────────────────────┤
│ AVENTURAS  + │  Título de la aventura                    ● guardado · ⧉       │
│              │ ───────────────────────────────────────────────────────────── │
│ ▸ Aventura 1 │  El almacén de los muelles                                     │
│   Aventura 2 │  Llegan de noche y el portón está entornado…                   │
│   Aventura 3 │                                                                │
│              │  ╔═ ENCUENTRO ═══════════════════════════╗                     │
│ ── escenas ─ │  ║ PNJ        │ N.º │ Notas             ║                     │
│   El almacén │  ╚═══════════════════════════════════════╝                     │
│   Los muelles│                                                                │
│            + │  ▸ escena: El almacén        ← chip que la abre en la mesa    │
└──────────────┴────────────────────────────────────────────────────────────────┘
```

- **Rail izquierdo**: las aventuras de la campaña, y debajo las escenas de la abierta. El «+» de
  cada bloque crea. Plegable, como el rail de escenas de la mesa.
- **Cabecera del documento**: el título editable, el indicador de guardado y el botón de **abrir en
  ventana aparte** — el mismo patrón que «Abrir ficha aparte», y con la misma trampa ya conocida:
  la página suelta **no puede heredar `.tb-root`**, que lleva `height:100dvh; overflow:hidden` y
  la dejaría sin scroll (ver `sheet-standalone-scroll.test.tsx`).
- **Guarda solo**, con retardo, y `Cmd+S` fuerza. El indicador dice «guardando…» / «guardado» y la
  hora. Nada de botón.

## Deuda que esto deja al descubierto
La regla del dueño —**el contenido vive en la base, no en el front**— ya se cumple para
personajes, campañas, escenas y tiradas, y este spec la cumple para aventuras (`doc` es una
columna `jsonb`, no un fichero del bundle).

**Donde NO se cumple hoy es en los textos de reglas del sistema.** Los tooltips y las referencias
de Plenilunio viven en `packages/system-plenilunio/src/{references,locales}.ts` y se compilan
dentro del bundle del navegador: una errata obliga a tocar código y desplegar. Comprobado
(2026-08-19): no hay ninguna tabla de textos en las migraciones.

Eso es **su propia rebanada**, y hay que pensarla bien antes: mover las reglas a la base choca con
«el paquete del sistema es enchufable y se distribuye con sus reglas» (ARCHITECTURE.md), así que
lo más probable es un modelo mixto — el paquete trae los textos por defecto y la base guarda sólo
las **correcciones**, por sistema y por idioma. Anotado en el backlog, sin decidir.
