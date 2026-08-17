# Identity (H1) — SPEC
> Extiende `specs/core/auth` y `specs/core/roles-permissions` (que siguen siendo la base). Aquí va lo nuevo.

## Purpose
Que cualquiera pueda entrar a Rolvium por su cuenta o por invitación, tener un perfil visible en las mesas y usar
varios dispositivos a la vez. Who: todos. Admin gestiona usuarios/roles como hasta ahora.

## What the user can do
- **Registro**: (a) abierto con correo + contraseña + nombre en la mesa + idioma; (b) **con código de invitación**
  (`LUNA-4F7K` o enlace `/join/LUNA-4F7K`): la tarjeta muestra campaña, sistema, director y plazas; al crear la cuenta
  entra directo a esa mesa (o a la pantalla de crear personaje si no tiene).
- **Perfil**: nombre, nombre en las mesas (alias), correo, **avatar** (subida PNG/JPG, recorte circular; fallback
  iniciales + color), idioma (es/en), tema de la plataforma (oscuro/claro/sistema). Dentro de una mesa manda el tema
  del sistema de juego.
- **Dispositivos**: ver sesiones abiertas (dispositivo, navegador, última actividad, "esta sesión"), cerrar una.
- Login existente: correo + contraseña, "recordarme", olvidé mi contraseña (fuera de alcance v1: OAuth, MFA).
- Roles de plataforma: `admin`, `game_master` (puede crear campañas), `player` (por defecto). El rol **en la mesa**
  (`dm`/`player`) vive en `campaigns`, no aquí.

## Flows
1. `/login` → entrar → `/campaigns`. 2. `/join/:code` sin sesión → registro con código → cuenta → miembro de la
campaña → mesa. 3. `/account` → pestañas Perfil / Contraseña y acceso / Dispositivos / Idioma y tema / Notificaciones.
4. Cambiar avatar → subir → recorte → `avatar_url` → se refleja en conectados y tokens (fallback de personajes sin imagen).

## Rules & limits
- Un código inválido/caducado/lleno → error explícito ("Ese código no vale") sin revelar si la campaña existe.
- El avatar de cuenta es el **valor por defecto del avatar de cada personaje** del usuario que no tenga uno propio.
- Nadie puede cerrar sesiones de otro salvo admin. Cerrar "esta sesión" = logout.
- Idioma: toda cadena de UI pasa por i18n; el idioma se guarda en el perfil y se aplica al entrar.

## Connections
`campaigns` (códigos, membresía al registrarse), `characters` (fallback de avatar), `realtime` (presence usa alias+avatar).
Storage bucket `avatars` (límite 2 MB, recorte en cliente).

## Modelo de datos
> Pending — DBA. Propuesta: `users` + `avatar_url`, `alias`, `locale`, `theme_pref`; `device_sessions`
> (`user_id`, `device`, `user_agent`, `last_seen`) informativa; invitaciones en `campaigns`.
