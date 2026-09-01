-- ============================================================================
-- DOS PERSONAJES DE PRUEBA — encargo del dueño (2026-09-01)
-- «Crea dos personajes pj de prueba para poder probar en el local y producción
--  y no los borres a menos que te lo pida explícitamente.»
-- ============================================================================
-- 🚫 NO BORRAR estas dos filas. Sólo el dueño puede pedirlo, y por escrito.
--
-- Por qué una migración y no un `seed.sql`: el seed sólo corre en local, y hacen
-- falta también en producción. Así existen en las dos bases, por el mismo camino
-- y con rastro de cuándo entraron.
--
-- Las hojas NO se inventan: se copian de un PJ que ya existe y es válido en esa
-- misma base, y sólo se cambia el texto. En el segundo se INTERCAMBIAN valores
-- entre características (combate↔voluntad, astucia↔presencia) conservando cada
-- especialidad con SU característica: la suma no cambia, así que el presupuesto
-- del sistema sigue cuadrando y la hoja sigue siendo válida.
--
-- Idempotente: si ya están (por nombre y campaña), no hace nada. Se puede volver
-- a aplicar sin duplicar a nadie.
-- ============================================================================

WITH base AS (
  SELECT * FROM public.characters WHERE kind = 'pc' ORDER BY created_at LIMIT 1
)
INSERT INTO public.characters (campaign_id, owner_id, kind, name, concept, data, derived, health, xp, created_by)
SELECT b.campaign_id, b.owner_id, 'pc', p.nombre, p.concepto,
       b.data || jsonb_build_object(
                   'name', p.nombre, 'concept', p.concepto, 'player', 'PRUEBA',
                   'story', 'Personaje de PRUEBA de Rolvium. No borrar salvo que el dueño lo pida.')
              || CASE WHEN p.intercambia THEN jsonb_build_object(
                   'combat',   jsonb_build_object('value', (b.data->'will'->>'value')::int,     'specialties', b.data->'combat'->'specialties'),
                   'will',     jsonb_build_object('value', (b.data->'combat'->>'value')::int,   'specialties', b.data->'will'->'specialties'),
                   'cunning',  jsonb_build_object('value', (b.data->'presence'->>'value')::int, 'specialties', b.data->'cunning'->'specialties'),
                   'presence', jsonb_build_object('value', (b.data->'cunning'->>'value')::int,  'specialties', b.data->'presence'->'specialties'))
                 ELSE '{}'::jsonb END,
       b.derived, COALESCE(b.health, 'healthy'), 0, b.created_by
FROM base b
CROSS JOIN (VALUES
  ('Elías Vane',  'Cartógrafo que dibuja lo que no debería existir',        false),
  ('Nix Corbeau', 'Ladrona de azoteas que le debe favores a media ciudad',  true)
) AS p(nombre, concepto, intercambia)
WHERE NOT EXISTS (
  SELECT 1 FROM public.characters c WHERE c.campaign_id = b.campaign_id AND c.name = p.nombre
);
