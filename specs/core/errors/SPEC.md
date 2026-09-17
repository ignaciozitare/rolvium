# Errores al pintar — la red de seguridad — SPEC

## Purpose

Que un error **al pintarse la pantalla** estropee **sólo el trozo afectado** y no tumbe la mesa entera.

Su frase, 2026-09-17: «*cualquier error al pintar te tumba la mesa entera en vez de estropear un trozo*».

**El fallo que lo destapó** (v0.12.2, § `core/realtime`): un eco de tiempo real llegaba sin la columna `data`
de un trazo, `DrawingShape` leía `data.points` sobre nada y lanzaba **durante el pintado**. Como no había ni un
`ErrorBoundary` en todo `apps/web`, React desmonta el árbol ENTERO ante un error de render no capturado: la
mesa se quedaba **en blanco**, con la partida en marcha y la base de datos intacta. Recargar lo arreglaba, que
es la parte que más desespera — parecía que se había perdido todo y no se había perdido nada.

Aquel caso ya está cortado en su origen. Esto es la red para **el siguiente**, que llegará: el fallo era de
una sola línea y la consecuencia fue total.

## Quién lo usa

Todo el mundo, y sin hacer nada: no es una función que se active, es una red que sólo se ve cuando algo falla.
**El director y los jugadores ven lo mismo.** No hay permisos de por medio.

## How it works

### Dónde va la red, de fuera hacia dentro

El valor está en el **radio de la explosión**: una sola red en la raíz convierte «página en blanco» en «página
con un mensaje», que es mejor pero sigue siendo perderlo todo. Las de dentro son las que salvan la partida.

| Red | Si revienta lo de dentro… | …esto sigue vivo |
|---|---|---|
| **La app entera** | último recurso | una página con aviso y un botón de recargar, en vez de blanco |
| **Cada pestaña de la mesa** (grupo · escena · ficha) | se cae esa pestaña | las otras pestañas y la navegación |
| **El mapa** | se cae el mapa | la barra de herramientas, los paneles y el resto de la mesa |
| **Cada panel flotante** | se cae ese panel | el mapa y los demás paneles |

### Qué ve él

En el hueco de lo roto, un aviso discreto y un botón para **reintentar**, que vuelve a montar ese trozo sin
recargar la página. Si al reintentar sigue roto —porque el dato malo sigue ahí—, recargar.

La forma exacta del aviso la fija el Design Agent en `rolvium.pen` y **la aprueba él con capturas** antes de
escribir una línea de UI. Se construye con lo que ya existe en `@rolvium/ui`; no se inventa una pieza nueva si
una existente sirve.

### Qué se registra

El error queda escrito en la consola del navegador (mensaje y pila), para poder diagnosticarlo. Nada más.

## Rules & limits

- 🔑 **La red NO puede ser la excusa para dejar de arreglar la causa.** Un trozo que se cae es un fallo, no un
  estado aceptable: cuando salte, se arregla lo que lo hizo saltar. La red sólo compra que la partida no se
  pierda mientras tanto.
- ⚠️ **No atrapa todo, y no debe venderse como que sí.** Una red de React coge lo que lanza **al pintarse**.
  **NO** coge: lo que falla dentro de un manejador de eventos (pulsar un botón), lo que falla en una promesa o
  en un `async`, ni lo que falla en el servidor. Esos caminos siguen necesitando su propio manejo de errores.
- Reintentar vuelve a montar el trozo desde cero. Lo que ese trozo tuviera sin guardar **se pierde** — igual
  que ahora, sólo que ahora se pierde la mesa entera.
- Un trozo caído **no** debe arrastrar a los de al lado: cada red es independiente.

## Out of scope (decidido con él, 2026-09-17)

- ❌ **Mandar los errores a un servicio externo de vigilancia** (Sentry o similar). Es otra cosa, con su coste
  y su decisión de privacidad. Si algún día se quiere, la red ya es el sitio natural donde engancharlo.
- ❌ Reintentos automáticos, cuentas de fallos, o apagar un trozo «que falla mucho». Complejidad sin caso.

## Modelo de datos

No lleva datos: no toca la base, no guarda nada y no viaja por la red. Sin migraciones.
