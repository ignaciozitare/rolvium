# Identity (H1) — SPEC
> Extiende `specs/core/auth` y `specs/core/roles-permissions` (que siguen siendo la base). Aquí va lo nuevo.

## Purpose
Que cualquiera pueda entrar a Rolvium por su cuenta o por invitación, tener un perfil visible en las mesas y usar
varios dispositivos a la vez. Who: todos. Admin gestiona usuarios/roles como hasta ahora.

## What the user can do
- **Registro**: (a) abierto (`/signup`) con correo + contraseña + nombre en la mesa + idioma; (b) **con código de
  invitación** (`LUNA-4F7K`, tecleado en `/join` o enlace `/join/LUNA-4F7K`): la tarjeta muestra campaña, sistema,
  director y plazas libres; al crear la cuenta entra directo a esa mesa (o a la pantalla de crear personaje cuando
  exista `characters`). Si ya tiene cuenta, desde la misma pantalla puede entrar con el código («Iniciar sesión con
  el código»): hace login y se une.
- **Recuperar contraseña** (`/forgot`): correo → enlace por e-mail → `/reset` (nueva contraseña con la sesión de
  recuperación) → `/campaigns`.
- **Perfil** (`/account`): nombre, nombre en las mesas (alias), correo (solo lectura; cambiarlo queda fuera de v1),
  **avatar** (subida PNG/JPG/WebP, recorte circular en cliente, ≤ 2 MB; fallback iniciales + color), idioma (es/en),
  tema de la plataforma (oscuro/claro/sistema). Dentro de una mesa manda el tema del sistema de juego.
- **Contraseña y acceso** (`/account`): cambiar contraseña (nueva + repetir, mínimo 8).
- **Dispositivos** (`/account`): ver sesiones abiertas (dispositivo/navegador deducidos del user-agent, última
  actividad, «esta sesión»), cerrar una. Cerrar «esta sesión» = logout.
- Login existente: correo + contraseña, «recordarme», olvidé mi contraseña. Fuera de alcance v1: OAuth, MFA, cambio
  de correo, notificaciones (la pestaña aparece como «pronto»).
- Roles de plataforma: `admin`, `game_master` (puede crear campañas), `player` (por defecto al registrarse). El rol
  **en la mesa** (`dm`/`player`) vive en `campaigns`, no aquí.

## Flows
1. `/login` → entrar → `/campaigns`.
2. `/join/:code` sin sesión → la app pide la vista previa a la API (`GET /invites/:code`, pública, sin token; la API
   consulta con service role) → tarjeta de invitación + formulario de registro → `signUp` (nombre, idioma en los
   metadatos) → sesión → `join_campaign_by_code(code)` → `/table/:id`. Con sesión ya iniciada, `/join/:code` sólo
   muestra la tarjeta y el botón «Unirme» (mismo RPC). Código no válido → tarjeta de error genérica y el formulario
   sigue disponible como registro abierto.
3. `/signup` → cuenta → `/campaigns`. Si el proyecto tiene confirmación por correo activada, se muestra «revisa tu
   correo» en vez de entrar; el enlace de confirmación vuelve a `/join/:code` (si había código) o a `/campaigns`.
4. `/forgot` → «si el correo existe, te hemos enviado un enlace» (misma respuesta exista o no) → enlace → `/reset`.
5. `/account` → secciones Perfil / Contraseña y acceso / Dispositivos / Idioma y tema (Notificaciones: pronto).
   Guardar perfil → `users` (name, alias) → se refresca el usuario del contexto. Idioma y tema se guardan al hacer
   clic y se aplican al momento; al iniciar sesión se aplican las preferencias guardadas.
6. Cambiar avatar → recorte → subir a Storage `avatars/{uid}/avatar.png` → `users.avatar_url` (con `?v=` para
   invalidar caché) → se refleja en conectados y tokens (fallback de personajes sin imagen). Quitar avatar → null.

## Rules & limits
- Un código inválido/caducado/lleno → error explícito («Ese código no vale») sin revelar si la campaña existe; la
  vista previa nunca devuelve el id de la campaña ni el nombre del director completo más allá de lo que ve el DM.
- El avatar de cuenta es el **valor por defecto del avatar de cada personaje** del usuario que no tenga uno propio.
- Nadie puede cerrar sesiones de otro salvo admin. Cerrar «esta sesión» = logout. Cerrar otra sesión invalida su
  refresco: ese dispositivo cae en cuanto caduca su token de acceso (≤ 1 h).
- Idioma: toda cadena de UI pasa por i18n; el idioma se guarda en el perfil y se aplica al entrar.
- El usuario sólo puede modificar de su fila `name`, `alias`, `avatar_url`, `locale`, `theme_pref` (el trigger
  existente bloquea `role_id`/`active`/`email`).

## Connections
`campaigns` (códigos, membresía al registrarse — RPCs `campaign_invite_preview` vía API y `join_campaign_by_code`),
`characters` (fallback de avatar), `realtime` (presence usa alias+avatar). Storage bucket `avatars` (2 MB, recorte en
cliente). API `GET /invites/:code`.

## Modelo de datos
- **`public.users`** (existente) gana `alias` (nombre en las mesas; opcional, si está vacío se usa `name`), `locale`
  (`es`|`en`, por defecto `es`) y `theme_pref` (`dark`|`light`|`system`, por defecto `system`). El trigger que crea el
  perfil al registrarse copia `name`, `alias` y `locale` de los metadatos del alta. Acceso: como hasta ahora (todos
  los autenticados leen; cada uno actualiza sólo su fila y sólo los campos cosméticos; `manage_users` todo).
- **Sesiones**: no se duplica ninguna tabla — se leen las sesiones reales de Supabase Auth (`auth.sessions`) mediante
  dos funciones seguras: `identity_my_sessions()` (id, user-agent, ip, creada, última actividad, «es la actual»)
  y `identity_revoke_session(id)` (borra la sesión y sus tokens de refresco). Ambas actúan **sólo sobre el usuario
  autenticado**; nadie puede listar ni cerrar sesiones ajenas.
- **Storage `avatars`**: bucket público de lectura (las URLs se comparten en mesas), 2 MB, sólo imágenes
  (png/jpeg/webp). Cada usuario sólo puede subir/reemplazar/borrar dentro de su carpeta `{uid}/`.
- Vista previa de invitación: sin tabla nueva; `campaign_invite_preview(code)` de `campaigns`, ejecutada por la API
  con service role. La API sólo devuelve nombre de campaña, sistema, nombre del director y plazas libres.
- Migración: `supabase/migrations/20260818000000_identity_profile_sessions_avatars.sql`.
