-- ─────────────────────────────────────────────────────────────────────────────
-- photos (H13): la foto colocada en una ESCENA y la foto mandada por el CHAT, y quién puede LEER cada fichero
-- Spec: specs/modules/photos/SPEC.md § Rules & limits
--
--   maps_scene_props.photo_id  una foto colocada es una pieza más de la escena: se mueve, se escala, se gira,
--                              se copia y se borra con los mismos gestos («*redimensionar escalandolas desde sus
--                              nodos girarla etc, y moverla borrarla copiarla*»).
--   chat_messages.kind='photo' la foto mandada a una conversación. Sólo la manda el director («*solo yo*»).
--   photos_read                la política de LECTURA del bucket privado: la base decide quién ve cada fichero.
--
-- 🔑 «*solo se tienen que ver las fotos dentro de la escena en el area de juego si las pongo al costado los
-- jugadores no las ven solo el dm*». Cómo se cumple, y por qué así:
--   · La FILA de la foto colocada llega al jugador como la de cualquier pieza (misma RLS de siempre): sólo lleva
--     dónde está y qué tamaño tiene — sin nombre y sin enlace, que están vacíos a la fuerza (CHECK de abajo).
--     Tiene que llegarle: si la fila dejara de existir para él al sacarla del área de juego, el tiempo real no
--     le avisaría de que se ha ido (un UPDATE que ya no puede ver no se le manda) y la seguiría viendo.
--   · El FICHERO sólo se le firma mientras la foto TOCA el área de juego de una escena que ve, en una capa que
--     le llega. Fuera del área, no hay enlace que valga: la foto no viaja a su navegador.
--   · Lo que asoma a medias se recorta en pantalla, como el resto del mapa.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── ¿Toca un rectángulo girado el área de juego? ────────────────────────────
-- La pieza se guarda por su CENTRO (x, y), su huella (width × height) y su giro en grados, que es como la pinta
-- el lienzo (`rotate` alrededor del centro). El área de juego es el rectángulo del mapa: 0..ancho × 0..alto.
-- Prueba del eje separador con los cuatro ejes que importan (los dos del mapa y los dos de la pieza): si en
-- alguno no se solapan, no se tocan. Exacta, no la caja que envuelve la pieza: una foto girada cerca de una
-- esquina, fuera de verdad, no se le enseña a nadie. Tocar el borde justo no cuenta como dentro.
CREATE OR REPLACE FUNCTION public.maps_rect_touches_play_area(
  cx double precision, cy double precision, w double precision, h double precision,
  rotation_deg double precision, scene_w double precision, scene_h double precision
) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT abs(dx) < sw + (hw * abs(c) + hh * abs(s))
     AND abs(dy) < sh + (hw * abs(s) + hh * abs(c))
     AND abs(dx * c + dy * s) < hw + (sw * abs(c) + sh * abs(s))
     AND abs(dy * c - dx * s) < hh + (sw * abs(s) + sh * abs(c))
  FROM (
    SELECT cos(radians(rotation_deg)) AS c, sin(radians(rotation_deg)) AS s,
           w / 2 AS hw, h / 2 AS hh, scene_w / 2 AS sw, scene_h / 2 AS sh,
           scene_w / 2 - cx AS dx, scene_h / 2 - cy AS dy
  ) v;
$$;
REVOKE ALL ON FUNCTION public.maps_rect_touches_play_area(double precision, double precision, double precision,
  double precision, double precision, double precision, double precision) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.maps_rect_touches_play_area(double precision, double precision, double precision,
  double precision, double precision, double precision, double precision) TO authenticated, service_role;

-- ── La foto colocada en una escena ──────────────────────────────────────────
ALTER TABLE public.maps_scene_props ADD COLUMN IF NOT EXISTS photo_id uuid;

-- Clave COMPUESTA con la campaña, como la escena y su aventura: una foto sólo se coloca en SU campaña.
-- CASCADE: borrar la foto de la biblioteca la quita de todas las escenas (spec § Rules & limits).
ALTER TABLE public.maps_scene_props DROP CONSTRAINT IF EXISTS maps_scene_props_photo_fkey;
ALTER TABLE public.maps_scene_props
  ADD CONSTRAINT maps_scene_props_photo_fkey
  FOREIGN KEY (photo_id, campaign_id) REFERENCES public.photos_photos (id, campaign_id) ON DELETE CASCADE;

-- Una foto colocada NO es un objeto de la biblioteca de objetos, no lleva su nombre ni su enlace (el nombre
-- puede destripar y esta fila la lee el jugador), y no estorba ni la vista ni el paso: la visión del servidor
-- no tiene nada que saber de ella.
ALTER TABLE public.maps_scene_props DROP CONSTRAINT IF EXISTS maps_scene_props_photo_shape;
ALTER TABLE public.maps_scene_props
  ADD CONSTRAINT maps_scene_props_photo_shape CHECK (
    photo_id IS NULL
    OR (prop_id IS NULL AND name = '' AND image_url = '' AND NOT blocks_sight AND NOT blocks_move)
  );

CREATE INDEX IF NOT EXISTS maps_scene_props_photo_idx ON public.maps_scene_props (photo_id) WHERE photo_id IS NOT NULL;

-- La RLS de `maps_scene_props` NO cambia: la fila se ve como la de cualquier pieza (ver cabecera).

-- ── La foto mandada por el chat ─────────────────────────────────────────────
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS photo_id uuid;

-- SET NULL sólo en `photo_id` (la campaña del mensaje no se toca): borrar la foto deja el mensaje con su
-- «foto borrada», y la conversación no pierde el hilo. El UPDATE que hace la base aquí lo deja pasar el
-- cerrojo de mensajes inmutables, que sólo frena lo que llega de fuera (`pg_trigger_depth() > 1`).
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_photo_fkey;
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_photo_fkey
  FOREIGN KEY (photo_id, campaign_id) REFERENCES public.photos_photos (id, campaign_id) ON DELETE SET NULL (photo_id);

ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_kind_check;
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_kind_check CHECK (kind IN ('text', 'roll', 'roll_ref', 'photo'));

-- La forma de cada tipo, la de siempre más la foto. Una foto puede llevar pie (`body`) o no, y su `photo_id`
-- puede quedar vacío DESPUÉS, al borrarse; que llegue con foto al mandarse lo exige la política de abajo.
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_check;
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_check CHECK (
    (kind = 'text' AND body IS NOT NULL AND btrim(body) <> '' AND roll_request IS NULL AND roll_ref_id IS NULL AND photo_id IS NULL)
    OR (kind = 'roll' AND roll_kind IS NOT NULL AND roll_request IS NOT NULL AND roll_dice IS NOT NULL AND roll_result IS NOT NULL AND roll_ref_id IS NULL AND photo_id IS NULL)
    OR (kind = 'roll_ref' AND roll_ref_id IS NOT NULL AND roll_request IS NULL AND roll_dice IS NULL AND roll_result IS NULL AND photo_id IS NULL)
    OR (kind = 'photo' AND roll_request IS NULL AND roll_dice IS NULL AND roll_result IS NULL AND roll_ref_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS chat_messages_photo_idx ON public.chat_messages (photo_id) WHERE photo_id IS NOT NULL;

-- Mandar: lo de siempre, y una FOTO sólo el director de la campaña de la conversación, y sólo una foto de
-- ESA campaña. Un jugador que lo intente por la API se encuentra la puerta cerrada aquí, no sólo el botón
-- escondido en pantalla.
DROP POLICY IF EXISTS chat_messages_insert ON public.chat_messages;
CREATE POLICY chat_messages_insert ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND kind IN ('text', 'roll_ref', 'photo')
    AND public.is_chat_participant(conversation_id)
    -- Traer una tirada del Registro: sólo una que YA se pudiera ver (misma campaña que la conversación,
    -- y visible para quien la trae — pública, suya, o el director), nunca una ajena ni de otra campaña.
    AND (
      kind <> 'roll_ref'
      OR EXISTS (
        SELECT 1 FROM public.dice_rolls dr
        JOIN public.chat_conversations cv ON cv.id = chat_messages.conversation_id
        WHERE dr.id = chat_messages.roll_ref_id
          AND dr.campaign_id = cv.campaign_id
          AND (dr.visibility = 'table' OR dr.author_id = auth.uid() OR public.is_campaign_dm(dr.campaign_id))
      )
    )
    AND (
      kind <> 'photo'
      OR (
        chat_messages.photo_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.chat_conversations cv
          JOIN public.photos_photos p ON p.id = chat_messages.photo_id AND p.campaign_id = cv.campaign_id
          WHERE cv.id = chat_messages.conversation_id
            AND public.is_campaign_dm(cv.campaign_id)
        )
      )
    )
  );

-- ── Quién puede LEER un fichero del bucket privado ──────────────────────────
-- El director de la campaña (o un admin, de soporte) siempre. Un jugador, sólo lo que el director le ha
-- enseñado: una foto colocada en una escena que ve, en una capa que le llega y tocando el área de juego; o una
-- foto mandada a una conversación suya. Una foto de una aventura no se le enseña nunca por aquí.
CREATE OR REPLACE FUNCTION public.photos_can_read_object(object_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ids record;
BEGIN
  SELECT o.campaign_id, o.photo_id INTO ids FROM public.photos_object_ids(object_name) o;
  IF ids.campaign_id IS NULL THEN RETURN false; END IF;
  IF public.is_campaign_dm(ids.campaign_id) OR public.is_admin() THEN RETURN true; END IF;

  IF EXISTS (
    SELECT 1
    FROM public.maps_scene_props sp
    JOIN public.maps_scenes s ON s.id = sp.scene_id
    WHERE sp.photo_id = ids.photo_id
      AND sp.campaign_id = ids.campaign_id
      AND public.maps_scene_visible(sp.scene_id)
      AND public.maps_layer_sends_to_players(sp.layer_id)
      AND public.maps_rect_touches_play_area(sp.x, sp.y, sp.width, sp.height, sp.rotation, s.width, s.height)
  ) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.chat_messages m
    WHERE m.photo_id = ids.photo_id
      AND m.campaign_id = ids.campaign_id
      AND public.is_chat_participant(m.conversation_id)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.photos_can_read_object(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.photos_can_read_object(text) TO authenticated, service_role;

DROP POLICY IF EXISTS photos_read ON storage.objects;
CREATE POLICY photos_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'photos' AND public.photos_can_read_object(name));
