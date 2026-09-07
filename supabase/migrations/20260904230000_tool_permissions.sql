-- ============================================================================
-- PERMISOS DE HERRAMIENTA — un cajón nuevo, al lado de los de administración
-- ============================================================================
-- Petición suya del 2026-09-04, montando el menú de los tres puntos del
-- catálogo de texturas:
--
--   «*esto tiene que ser un permiso en el motor de permisos, no lo puede hacer
--    cualquiera; por ahora ponle el permiso al admin y los dms*»
--   «*cuidado con el tema roles, que tenemos un motor de roles y permisos en la
--    herramienta, ojo con cagarla aquí*»
--   «*cada permiso tiene que tener su item en permisos en el menú de admin, y
--    yo cuando cree una herramienta nueva pueda decidir qué rol la usa; los
--    permisos nunca serán por usuario*»
--
-- ── POR QUÉ UN CAJÓN NUEVO Y NO METERLO CON LOS TRES DE SIEMPRE ─────────────
-- Tenía razón en avisar: había una trampa, y estaba comprobada antes de tocar
-- nada. Quién ve la sección «Administración» se decide preguntando «¿tiene
-- ALGÚN permiso dentro de `permissions.admin`?» (`hasAnyAdminPermission`, usada
-- en el menú de arriba, en el menú de usuario y en la propia pantalla). Meter
-- aquí un permiso de herramienta y dárselo a los directores les habría puesto
-- «Administración» en el menú a todos — y al entrar, una pantalla VACÍA, porque
-- no tienen ninguna de las tres secciones.
--
-- Así que `permissions.admin` NO SE TOCA. Los permisos de herramienta viven en
-- `permissions.tools`, y el motor los lee con su propio ayudante. Lo que hoy
-- funciona sigue funcionando exactamente igual, byte a byte.
--
-- ── LAS TRES FAMILIAS, Y QUÉ SIGNIFICA CADA UNA ────────────────────────────
--   · `modules`  → qué SECCIONES de la app abre un rol.
--   · `admin`    → administrar la plataforma (usuarios, roles, ajustes).
--   · `tools`    → usar una capacidad concreta DENTRO de una herramienta.
--                  Cada una tiene su item propio en la pantalla de roles, y se
--                  concede POR ROL — nunca por usuario, que es como ya funciona
--                  todo el motor (un usuario tiene un rol; el rol lleva los
--                  permisos).
--
-- ⚠️ NO se rellena `tools` en las filas que ya existen, y es a propósito: el
-- trigger `roles_guard_system` prohíbe modificar los permisos del rol `admin`,
-- así que un relleno general reventaría la migración. La ausencia de la clave
-- significa «ninguno», y tanto el ayudante SQL como el tipo de TypeScript lo
-- tratan así.
-- ============================================================================

-- ── 1. La forma: `tools`, si está, es un objeto ─────────────────────────────
-- La comprobación de antes sólo exigía `modules` array y `admin` objeto, así
-- que una clave de más ya era legal. Se añade la suya para que no pueda entrar
-- con otra forma. Tolera que falte, que es el estado de todas las filas de hoy.
ALTER TABLE public.roles DROP CONSTRAINT IF EXISTS roles_permissions_shape;
ALTER TABLE public.roles ADD CONSTRAINT roles_permissions_shape CHECK (
  jsonb_typeof(permissions -> 'modules') = 'array'
  AND jsonb_typeof(permissions -> 'admin') = 'object'
  AND (permissions -> 'tools' IS NULL OR jsonb_typeof(permissions -> 'tools') = 'object')
);

-- ── 2. El ayudante, hermano de `has_permission` ─────────────────────────────
-- Mismo contrato: el admin lo tiene todo por definición, y el resto lo tiene si
-- su rol lo lleva. `SECURITY DEFINER` como los otros tres, para que la política
-- pueda mirar `roles` sin que el usuario tenga que poder leerla.
CREATE OR REPLACE FUNCTION public.has_tool(tool text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR COALESCE((
    SELECT (r.permissions -> 'tools' ->> tool)::boolean
    FROM public.users u JOIN public.roles r ON r.id = u.role_id
    WHERE u.id = auth.uid() AND u.active
  ), false)
$$;

-- ⚠️ HAY QUE REVOCAR DE `PUBLIC`, NO SÓLO DE `anon`. Es exactamente el agujero que ya se corrigió una vez
-- en `20260819020000_fix_function_grants.sql`: PostgreSQL concede EXECUTE a PUBLIC por defecto, así que un
-- `REVOKE … FROM anon` a secas no quita nada — la función se quedaría publicada en `/rest/v1/rpc/has_tool`
-- para cualquiera sin sesión, igual que estuvieron `is_admin` y `has_permission`.
-- Y por eso mismo hace falta el GRANT explícito: al quitar el de PUBLIC, `authenticated` se queda sin
-- ninguno, y las políticas de `maps_textures` (todas `TO authenticated`) dejarían de poder evaluarse.
REVOKE EXECUTE ON FUNCTION public.has_tool(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_tool(text) TO authenticated, service_role;

-- ── 3. El primero: gestionar el catálogo de texturas ────────────────────────
-- Se le da a `game_master`, que es «los dms» en el motor de roles. Al `admin`
-- NO se le escribe nada: lo tiene por `is_admin()`, y además el trigger prohíbe
-- tocar sus permisos.
UPDATE public.roles
SET permissions = jsonb_set(
      permissions,
      '{tools}',
      COALESCE(permissions -> 'tools', '{}'::jsonb) || '{"manage_textures": true}'::jsonb,
      true)
WHERE name = 'game_master';

-- ── 4. Y el catálogo pasa a exigirlo ────────────────────────────────────────
-- Antes: «sólo lo tuyo». Ahora: «sólo quien tenga el permiso», y eso incluye
-- SUBIR — decisión suya del 2026-09-04, preguntada con la pantalla delante:
-- ordenar el catálogo es cosa de admin y directores, y sin el permiso no salen
-- ni los tres puntos ni el botón de subir, ni siquiera sobre lo que subiste tú.
--
-- LEER no cambia: cualquiera con cuenta ve el catálogo y elige textura. Es lo
-- que hace que un jugador pueda seguir jugando en un mapa con texturas.
DROP POLICY IF EXISTS maps_textures_insert ON public.maps_textures;
CREATE POLICY maps_textures_insert ON public.maps_textures FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND public.has_tool('manage_textures'));

DROP POLICY IF EXISTS maps_textures_own_update ON public.maps_textures;
DROP POLICY IF EXISTS maps_textures_update ON public.maps_textures;
CREATE POLICY maps_textures_update ON public.maps_textures FOR UPDATE TO authenticated
  USING (public.has_tool('manage_textures'))
  WITH CHECK (public.has_tool('manage_textures'));

DROP POLICY IF EXISTS maps_textures_own_delete ON public.maps_textures;
DROP POLICY IF EXISTS maps_textures_delete ON public.maps_textures;
CREATE POLICY maps_textures_delete ON public.maps_textures FOR DELETE TO authenticated
  USING (public.has_tool('manage_textures'));

-- ── Y que la API se entere ──────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
