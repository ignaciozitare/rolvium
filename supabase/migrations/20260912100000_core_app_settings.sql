-- ============================================================================
-- 🧲 LA BARRA SE ORDENA ARRASTRANDO, Y EL ORDEN LO PONE EL ADMIN PARA TODOS
-- (spec `specs/modules/maps/SPEC.md` § «La barra se ordena arrastrando…»,
-- confirmado por el dueño el 2026-09-12 con sus correcciones: «el orden lo pone
-- el admin y es para todos»).
--
-- UNA TABLA DE AJUSTES DE PLATAFORMA, y el orden de la barra es su primera fila.
--
--   1. POR QUÉ UNA TABLA NUEVA Y NO UNA COLUMNA. El orden es UNO para todo el
--      mundo —no es de una escena, ni de una campaña, ni de un usuario—, así
--      que no existe ninguna fila donde colgarlo. Y el permiso
--      `admin.manage_settings` existe desde el primer día (`roles.permissions`)
--      sin tener nada que administrar: esto es lo primero que administra.
--
--   2. CLAVE + VALOR, A PROPÓSITO. Un ajuste de plataforma por fila
--      (`key` = 'maps.toolbar_order', `value` = el orden por bloques). El
--      siguiente ajuste global que haga falta es otra fila, no otra migración.
--      La FORMA de cada valor la valida quien lo lee (un botón desconocido se
--      ignora, uno que falte cae en su sitio de serie): la base sólo garantiza
--      que hay UN valor por clave y quién puede tocarlo.
--
--   3. SIN FILA DE SERIE. Mientras el admin no arrastre nada, no hay fila y la
--      barra sale con el orden que él fijó el 31-ago, que vive en el código
--      (`mapRules`). Así ninguna instalación cambia de aspecto al migrar.
--
-- ACCESO: LEEN TODOS los usuarios con sesión (cada uno pinta la barra con ese
-- orden); ESCRIBE sólo quien tiene `admin.manage_settings`, a través del
-- ayudante `public.has_permission` — nunca se reimplementa el permiso aquí.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'maps.toolbar_order' y los que vengan: minúsculas, puntos y guiones bajos.
  key        text        NOT NULL UNIQUE,
  value      jsonb       NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Quién lo tocó por última vez; si esa cuenta se borra, el ajuste se queda.
  updated_by uuid        REFERENCES public.users(id) ON DELETE SET NULL
);

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_key_check;
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_key_check
  CHECK (key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$' AND length(key) <= 80);

DROP TRIGGER IF EXISTS app_settings_touch ON public.app_settings;
CREATE TRIGGER app_settings_touch
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Leen todos los que tienen sesión: la barra la pinta cada uno.
DROP POLICY IF EXISTS app_settings_select ON public.app_settings;
CREATE POLICY app_settings_select ON public.app_settings
  FOR SELECT TO authenticated
  USING (true);

-- Escribe sólo quien administra los ajustes de la plataforma.
DROP POLICY IF EXISTS app_settings_write ON public.app_settings;
CREATE POLICY app_settings_write ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_permission('manage_settings'))
  WITH CHECK (public.has_permission('manage_settings'));

COMMENT ON TABLE public.app_settings IS
  'Ajustes de plataforma, uno por fila (key/value). Primera fila: maps.toolbar_order — el orden de la barra de herramientas de la escena, que pone el admin para todos (dueño, 2026-09-12). Leen todos; escribe admin.manage_settings.';
COMMENT ON COLUMN public.app_settings.value IS
  'El valor del ajuste. Para maps.toolbar_order: {"play": [...], "draw": [...], "dm": [...]} con los ids de los BOTONES de cada bloque, en orden. La forma la valida quien lo lee.';

-- PostgREST cachea el esquema: sin esto la tabla nueva no existe para la API.
NOTIFY pgrst, 'reload schema';
