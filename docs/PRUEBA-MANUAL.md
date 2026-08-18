# Prueba manual — todo junto (2026-08-19)

Guion para probar lo construido hasta hoy: `identity` · `campaigns` · `table` · `characters` · `dice` · `maps` (sin niebla).
Marca lo que falle y lo apuntamos al backlog de `WORK_STATE.md`.

## 0. Arrancar
```bash
cd ~/Documents/Developer/Rolvium
npm run db:start          # Docker debe estar abierto (a veces hay que abrir Docker dos veces)
npm run db:reset          # aplica las 10 migraciones + seed — ⚠ BORRA la base local (campañas incluidas).
                          # Con la base ya arrancada y al día, sáltate este paso.
npm run dev:api           # http://localhost:3001  (ya arreglado; antes fallaba el script)
npm run dev:web           # http://localhost:5173
```
Correo de prueba: **Mailpit** en http://127.0.0.1:54324 (confirmaciones y enlaces de recuperación).
Studio (ver tablas): http://127.0.0.1:54323.

Cuentas que el seed deja creadas (todas con contraseña **rolvium123**):

| Correo | Rol | Para qué |
|---|---|---|
| `admin@rolvium.local` | admin | el director de tus campañas |
| `jugador1@ejemplo.com` | player | Marta Ruiz («Marta») |
| `jugador2@ejemplo.com` | player | Nico Vega («Nix») |

Para probar director + jugador a la vez: una ventana normal (director) y otra de incógnito (jugador).

## 1. identity (H1)
- [ ] `/login` entra con el admin; el menú de usuario muestra «Cuenta».
- [ ] `/signup`: crear `jugador3@ejemplo.com` / `supersecret1`. Entra directo a `/campaigns`.
      (los otros dos jugadores ya existen en el seed; este alta es para probar el registro en sí)
- [ ] `/forgot` con ese correo → llega el enlace a Mailpit → abre `/reset` → cambiar contraseña → entra.
- [ ] `/account`: cambiar nombre y «nombre en las mesas», subir un avatar (recorte circular), cambiar idioma a English y volver,
      cambiar tema Oscuro/Claro/Sistema, ver «Sesiones y dispositivos» (la actual marcada) y cerrar otra sesión.
- [ ] Cerrar sesión y volver a entrar: idioma y tema guardados se aplican solos.

## 2. campaigns (H2)
- [ ] Como admin: crear campaña (asistente de 5 pasos, sistema Plenilunio) → aparece el código de invitación.
- [ ] «Gestionar» en la tarjeta: copiar enlace, regenerar código, próxima sesión, progresión abierta/cerrada, archivar (no archives todavía).
- [ ] Como jugador: `/join/<código>` → tarjeta con campaña, sistema, director y plazas → unirse → entra a la mesa.
- [ ] Código inválido (`ZZZZ-ZZZZ`) → «Ese código no vale», sin revelar si existe.
- [ ] `/systems`: ficha de Plenilunio (editor, versión, qué incluye) y los «pronto».

## 3. table (H3) + characters (H4)
- [ ] La mesa se ve con el aspecto de Plenilunio (papel, lunas) y la barra Rolvium arriba.
- [ ] **Scroll**: en «Crear personaje» se puede bajar hasta el final del paso y pulsar Siguiente *(era el fallo de ayer)*.
- [ ] Generador completo: concepto → características (presets 16/21/25/30, el contador no deja pasarse) → especialidades →
      Destino → dones → resumen → crear. Aparece en «Ficha».
- [ ] Ficha: editar campos, ver derivadas (Aguante, Resistencia, Fortuna máx) recalculadas al guardar, «Recibir daño» baja
      casillas y cambia el nivel de salud.
- [ ] `/characters`: mis personajes agrupados por campaña; «Ver ficha» abre `/characters/:id`; «Abrir en la mesa» va a la mesa.
- [ ] Director: pestaña «El grupo» lista los PJ; abre la ficha de otro en solo lectura y puede pasar a edición.
- [ ] «Mejorar»: con la progresión cerrada aparece bloqueada con motivo; el director la abre desde «Gestionar» y entonces se
      pueden gastar px (los px sólo los otorga el director).

## 4. dice (H6)
- [ ] Panel lateral «Registro»: al pulsar TIRAR en una característica aparece la tirada (autor, título, dados, grado).
- [ ] Los dados salen del servidor: la reserva de Destino se descuenta de tu mano al tirar; sin dados en mano, la tirada con
      Destino falla con aviso.
- [ ] Un triunfo en dados de Destino sube Destino y recarga Fortuna **en la ficha** (lo aplica el servidor).
- [ ] Lanzador flotante: se arrastra, pestañas Todos / Director / Secreta, filas d4…d100 y Fudge, modificador.
- [ ] Visibilidad: una tirada «Secreta» de un jugador la ve él y el director; otro jugador no.
- [ ] En dos navegadores a la vez: la tirada de uno aparece en el Registro del otro sin recargar.

## 5. maps (H7, sin niebla todavía)
- [ ] Director en «Escena»: crear escena, nombrarla, activarla para los jugadores.
- [ ] «Fondo»: color base, subir imagen a la biblioteca, elegirla, ajuste Cubrir/Encajar.
- [ ] Herramientas: mover, medir (distancia en casillas), pin (centra la vista del resto), lápiz/línea/caja/círculo, borrar.
- [ ] Director: muros (clic-clic), «Encuentro» coloca un token del bestiario del sistema (oculto), ocultar/mostrar y quitar token,
      «Ver como jugador».
- [ ] «Colocar PJ»: el token del personaje aparece y **el jugador puede arrastrar sólo el suyo** (el del otro no se mueve).
- [ ] En dos navegadores: el arrastre se ve en vivo y la posición final queda guardada al recargar.
- [ ] Si algo se deniega (mover token ajeno), sale el aviso «No se pudo guardar el cambio en el mapa».

## 6. Light / dark
Recorre con el interruptor de tema: `/login`, `/signup`, `/join/:code`, `/forgot`, `/reset`, `/account`, `/campaigns`
(+ modal Gestionar), `/systems`, `/characters`, `/characters/:id`, y la mesa (Ficha, El grupo, Escena, Mejorar, Crear personaje,
Registro, Lanzador). Busca texto invisible, blanco sobre blanco o negro sobre negro.

## Pendiente conocido (no es fallo)
Niebla de guerra y visión por muros (maps slice 2) · chat, notas y bitácora (pestañas «pronto») · bestiario propio (H5) ·
adjuntar tirada al chat · verificar una tirada desde los dados crudos · subir avatar/token desde la ficha.
