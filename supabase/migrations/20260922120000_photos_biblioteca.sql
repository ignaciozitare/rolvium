-- ─────────────────────────────────────────────────────────────────────────────
-- photos (H13): la biblioteca de fotos de CADA campaña, sólo del director
-- Spec: specs/modules/photos/SPEC.md (cerrado con él el 2026-09-22)
--
--   photos_photos   una fila por foto: de qué campaña es, su nombre y su tamaño natural.
--   bucket `photos` PRIVADO: el fichero vive en `{campaign_id}/{photo_id}`, sin extensión.
--
-- «*las fotos estas viven dentro de la cmapaña no es para rolvium en general*»: cada foto es de UNA
-- campaña, al revés que la biblioteca de objetos y texturas, que es de la herramienta.
--
-- PRIVADO, y no como los otros buckets: `core/images` dice «nada sensible en una imagen» porque un fondo o
-- un retrato no lo son, pero la foto de una aventura puede ser un destripe. Quién puede LEER cada fichero lo
-- decide la base (siguiente migración: dentro del área de juego de una escena que ve, o mandada por el chat
-- a una conversación suya). Aquí sólo el director escribe.
--
-- La ruta no lleva extensión a propósito: así un jugador que tiene delante una foto colocada (sabe la
-- campaña y el id) puede pedir su enlace firmado sin poder leer esta tabla, que no le deja ver nada.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.photos_photos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid NOT NULL REFERENCES public.campaigns_campaigns(id) ON DELETE CASCADE,

  -- Nace con el nombre del fichero sin la extensión; se busca por él.
  name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),

  -- Tamaño natural, ya comprimido: lo que hace que colocarla en la escena respete sus proporciones.
  width        int  NOT NULL CHECK (width > 0),
  height       int  NOT NULL CHECK (height > 0),

  created_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- El destino de las claves compuestas de la escena y del chat: una foto sólo se usa en SU campaña.
  CONSTRAINT photos_id_campaign_key UNIQUE (id, campaign_id)
);

-- La biblioteca se lista de la más nueva a la más vieja.
CREATE INDEX IF NOT EXISTS photos_campaign_idx ON public.photos_photos (campaign_id, created_at DESC);

DROP TRIGGER IF EXISTS photos_touch ON public.photos_photos;
CREATE TRIGGER photos_touch BEFORE UPDATE ON public.photos_photos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── RLS: material del director ──────────────────────────────────────────────
-- Para un jugador la fila NO EXISTE. Lo que ve de una foto le llega por la escena o por el chat, nunca de
-- aquí: ni el nombre, que también puede destripar.
ALTER TABLE public.photos_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS photos_select ON public.photos_photos;
CREATE POLICY photos_select ON public.photos_photos
  FOR SELECT TO authenticated
  USING (public.is_campaign_dm(campaign_id) OR public.is_admin());

DROP POLICY IF EXISTS photos_write ON public.photos_photos;
CREATE POLICY photos_write ON public.photos_photos
  FOR ALL TO authenticated
  USING (public.is_campaign_dm(campaign_id) OR public.is_admin())
  WITH CHECK (public.is_campaign_dm(campaign_id) OR public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.photos_photos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photos_photos TO service_role;

-- ── El bucket, privado ──────────────────────────────────────────────────────
-- 1,5 MB: el mismo tope de salida que el compresor de `packages/ui` (`MAX_OUTPUT_BYTES`).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('photos', 'photos', false, 1572864, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── Leer el nombre de un fichero SIN que pueda romper nada ─────────────────
-- Las políticas de `storage.objects` se evalúan también sobre ficheros de OTROS buckets, y Postgres no
-- promete el orden de un AND: un `::uuid` suelto en la política lanzaría con el nombre de un avatar. Por eso
-- el nombre se valida aquí dentro y un nombre raro es, simplemente, «no».
CREATE OR REPLACE FUNCTION public.photos_object_ids(object_name text, OUT campaign_id uuid, OUT photo_id uuid)
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  uuid_re constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  parts text[] := string_to_array(object_name, '/');
BEGIN
  IF array_length(parts, 1) = 2 AND parts[1] ~ uuid_re AND parts[2] ~ uuid_re THEN
    campaign_id := parts[1]::uuid;
    photo_id := parts[2]::uuid;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.photos_object_ids(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.photos_object_ids(text) TO authenticated, service_role;

-- Escribir un fichero: el director de ESA campaña (o un admin, de soporte). Subirlo exige además que la fila
-- de la foto exista ya en esa campaña: nadie mete ficheros sueltos en el bucket.
CREATE OR REPLACE FUNCTION public.photos_can_write_object(object_name text, needs_row boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ids record;
BEGIN
  SELECT o.campaign_id, o.photo_id INTO ids FROM public.photos_object_ids(object_name) o;
  IF ids.campaign_id IS NULL THEN RETURN false; END IF;
  IF NOT (public.is_campaign_dm(ids.campaign_id) OR public.is_admin()) THEN RETURN false; END IF;
  RETURN NOT needs_row OR EXISTS (
    SELECT 1 FROM public.photos_photos p WHERE p.id = ids.photo_id AND p.campaign_id = ids.campaign_id);
END;
$$;
REVOKE ALL ON FUNCTION public.photos_can_write_object(text, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.photos_can_write_object(text, boolean) TO authenticated, service_role;

DROP POLICY IF EXISTS photos_dm_insert ON storage.objects;
CREATE POLICY photos_dm_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos' AND public.photos_can_write_object(name, true));
DROP POLICY IF EXISTS photos_dm_update ON storage.objects;
CREATE POLICY photos_dm_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'photos' AND public.photos_can_write_object(name, true))
  WITH CHECK (bucket_id = 'photos' AND public.photos_can_write_object(name, true));
-- Borrar no pide la fila: al borrar una foto se borra la fila y su fichero, y el orden no debe importar.
DROP POLICY IF EXISTS photos_dm_delete ON storage.objects;
CREATE POLICY photos_dm_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'photos' AND public.photos_can_write_object(name, false));

-- La política de LECTURA va en la migración siguiente: depende de las fotos colocadas en una escena y de
-- las mandadas por el chat, que todavía no existen aquí.
