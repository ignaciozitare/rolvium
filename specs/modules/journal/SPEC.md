# Journal (H9) — SPEC

## Purpose
Apuntes: cada uno los suyos (privados) y una bitácora común de la campaña con historial. Who: todos.

## What the user can do
- **Notas** (privadas por usuario y campaña): editor de texto enriquecido básico (negrita, cursiva, listas, títulos),
  guardado automático ("guardado hace 12 s"). Nadie más las ve, tampoco el director.
- **Bitácora** (compartida): un documento por campaña; todos leen y escriben; presencia "Laura está editando…";
  **historial de versiones** con autor y fecha, ver y restaurar; guardado con debounce.

## Rules & limits
- Notas: RLS `user_id = auth.uid()`. Bitácora: miembros de la campaña.
- Historial: una versión por guardado significativo (debounce), autor obligatorio.

## Connections
`realtime` (broadcast de cursores/presencia, update con debounce), `identity`.

## Modelo de datos
> Pending — DBA. Propuesta: `notes` (campaign_id, user_id, content jsonb, updated_at); `logbook` (campaign_id,
> content jsonb, version, author_id, updated_at); `logbook_versions` (histórico).
