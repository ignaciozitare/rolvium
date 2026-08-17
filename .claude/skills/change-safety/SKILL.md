---
name: change-safety
description: Reglas de contención de alcance para CUALQUIER tarea de código, config, base de datos, UI o refactor. Se dispara al implementar un cambio para evitar reemplazar código que funciona, migrar consumidores no relacionados, o hacer limpieza/consolidación/refactor fuera de lo pedido.
---

# Change safety — limitarse a lo pedido

Regla general, no atada a ejemplos concretos. Un ejemplo que dé el usuario (una
tabla, un datepicker, un board) NO se convierte en política especial del proyecto.

## Antes de cambiar algo

1. Confirmá el pedido explícito y sus límites. Si no está claro el alcance,
   preguntá — no lo asumas amplio.
2. Inspeccioná el objetivo exacto y sus consumidores directos antes de escribir.
3. Identificá el comportamiento actual que DEBE quedar igual.
4. Buscá si ya existe un componente/servicio/caso de uso/helper/patrón antes de
   crear uno nuevo (para UI, ver la skill `ui-reuse`).
5. Listá el conjunto mínimo de archivos a modificar.

## Comportamiento por defecto

- Tratá las implementaciones existentes como intencionales hasta que la
  inspección demuestre lo contrario.
- Preferí un cambio pequeño y compatible antes que un reemplazo o rediseño.
- Reutilizar algo existente NO autoriza a migrar consumidores no relacionados.
- Extendé código compartido de forma retrocompatible, salvo aprobación explícita
  de un breaking change.

## Prohibido sin aprobación explícita del usuario

- limpieza oportunista ("ya que estoy");
- consolidación entre módulos;
- renombrados o movimientos de archivos masivos;
- reemplazar una implementación que funciona por otra distinta;
- cambiar comportamiento no relacionado "para mejorar la consistencia";
- borrar código legacy antes de verificar todos sus consumidores;
- reescrituras grandes cuando alcanza una edición focalizada;
- acciones de schema, migración, merge, deploy o producción.

## Expansión de alcance

Si el cambio pedido revela un problema mayor, **pará en el límite seguro y
reportalo por separado**. No expandas la tarea en silencio.

## Reporte final (obligatorio)

Cerrá cada implementación declarando:

- alcance pedido;
- archivos cambiados;
- qué reutilizaste / preservaste;
- comportamiento cambiado a propósito;
- comportamiento que dejaste intacto a propósito;
- tests corridos;
- deuda encontrada pero NO tocada (para decidir aparte).
