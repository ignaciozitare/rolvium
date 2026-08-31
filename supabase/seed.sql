-- ============================================================================
-- Rolvium — LOCAL seed (runs on `supabase start` / `supabase db reset` ONLY;
-- never pushed to a remote project). Creates a dev admin you can log in with:
--   email:    admin@rolvium.local
--   password: rolvium123
-- ============================================================================
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data,
  email_confirmed_at, created_at, updated_at, is_sso_user, is_anonymous,
  -- GoTrue scans these as NOT NULL strings; NULL breaks password login.
  confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token
) VALUES (
  '00000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'admin@rolvium.local', crypt('rolvium123', gen_salt('bf')),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('name', 'Game Master Root', 'role_id', (SELECT id FROM public.roles WHERE name = 'admin')),
  now(), now(), now(), false, false,
  '', '', '', '', '', '', '', ''
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
VALUES (
  gen_random_uuid(), '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'email',
  '{"sub":"00000000-0000-4000-8000-000000000001","email":"admin@rolvium.local"}'::jsonb, now(), now(), now()
) ON CONFLICT DO NOTHING;

-- Belt and braces: the trigger already sets role_id from metadata, but make sure.
UPDATE public.users SET role_id = (SELECT id FROM public.roles WHERE name = 'admin')
WHERE email = 'admin@rolvium.local';

-- ============================================================================
-- Dev players, so the owner can test DM + player side by side without going
-- through /signup every reset. Same password as the admin: rolvium123.
--   jugador1@ejemplo.com  ·  Marta Ruiz  (alias «Marta»)
--   jugador2@ejemplo.com  ·  Nico Vega   (alias «Nix»)
-- They are NOT joined to any campaign on purpose: joining by invite code is
-- itself part of the manual test (docs/PRUEBA-MANUAL.md §2).
-- ============================================================================
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT * FROM (VALUES
      ('00000000-0000-4000-8000-000000000002'::uuid, 'jugador1@ejemplo.com', 'Marta Ruiz', 'Marta'),
      ('00000000-0000-4000-8000-000000000003'::uuid, 'jugador2@ejemplo.com', 'Nico Vega',  'Nix')
    ) AS t(id, email, name, alias)
  LOOP
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      raw_app_meta_data, raw_user_meta_data,
      email_confirmed_at, created_at, updated_at, is_sso_user, is_anonymous,
      -- GoTrue scans these as NOT NULL strings; NULL breaks password login.
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      p.id, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', p.email, crypt('rolvium123', gen_salt('bf')),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', p.name, 'alias', p.alias, 'locale', 'es'),
      now(), now(), now(), false, false,
      '', '', '', '', '', '', '', ''
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), p.id, p.id::text, 'email',
      jsonb_build_object('sub', p.id::text, 'email', p.email), now(), now(), now()
    ) ON CONFLICT DO NOTHING;
    -- `public.users` is filled by handle_new_auth_user() from the metadata above
    -- (name, alias, locale, role). Never UPDATE it here: on a re-seed over an
    -- existing volume that would stomp whatever the dev changed in /account.
  END LOOP;
END $$;

-- ============================================================================
-- DATOS DE PRUEBA DEL DUEÑO — se rehacen SOLOS en cada `db:reset`.
--
-- Por qué existe este bloque: el 31-ago-2026, a las 00:58, un `npm run db:reset`
-- se llevó por delante la campaña, el personaje Karen Sinclair, el bestiario y
-- el mapa con sus paredes. Sólo vivían en la base local y no había copia. La
-- regla de «usar `supabase migration up --local`, nunca `db reset`» estaba
-- escrita en WORK_STATE.md y se saltó igualmente.
--
-- La lección: una regla que depende de que alguien se acuerde, no es una regla.
-- Todo lo que esté AQUÍ vuelve solo, se resetee la base las veces que se resetee.
-- Si creas algo en la app que quieras conservar, cópialo a este fichero.
--
-- Las imágenes NO están aquí: siguen vivas en el volumen de Storage, que un
-- `db:reset` no toca (por eso sobrevivieron). Lo que se rehace abajo son las
-- filas de `storage.objects` que apuntan a esos ficheros.
-- ============================================================================

-- ── Las imágenes que sobrevivieron al borrado, devueltas a su sitio ──────────
-- `version` es el último tramo de la ruta física del fichero en el volumen
-- (`/mnt/stub/stub/<bucket>/<name>/<version>`): sin ese valor exacto Storage no
-- encuentra el fichero aunque la fila exista.
INSERT INTO storage.objects (bucket_id, name, owner, owner_id, version, metadata) VALUES
  ('tokens', '00000000-0000-4000-8000-000000000001/bestiary/7d73d4a3-b94f-4e9a-a461-470b84c7e3d8/04031595-a107-49c6-bbca-7d4e483eff20.webp',
   '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '819025e4-3f04-4129-8a07-a5e85906b666',
   '{"eTag":"\"2899e8e0cb990272793e78e47c83fe70\"","size":41662,"mimetype":"image/webp","cacheControl":"max-age=3600","contentLength":41662,"httpStatusCode":200}'::jsonb),
  ('tokens', '00000000-0000-4000-8000-000000000001/bestiary/325705e8-9d00-4443-a7d9-8c4286d78296/057083a0-aec1-43b2-9dc0-d031994cb527.webp',
   '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '3e648c36-f5a4-4e65-bd5e-cb817bcd58eb',
   '{"eTag":"\"ac3455f4c13cfe1321288b67f0e33099\"","size":53260,"mimetype":"image/webp","cacheControl":"max-age=3600","contentLength":53260,"httpStatusCode":200}'::jsonb),
  ('tokens', '00000000-0000-4000-8000-000000000001/bestiary/a27c344e-76b3-4ce9-99e3-476ff312e4a9/5d9186ec-f4bb-4472-8ffe-606efa93cbee.webp',
   '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'a649dc61-1bb7-40c4-896b-f9fcf35bc751',
   '{"eTag":"\"aa05abf42137a32a2af619775f78c68d\"","size":27960,"mimetype":"image/webp","cacheControl":"max-age=3600","contentLength":27960,"httpStatusCode":200}'::jsonb),
  ('tokens', '00000000-0000-4000-8000-000000000001/bestiary/2e4c6d2c-d82e-4865-8c29-6fd0b5b201ff/71de3a9f-0cc3-419b-bf06-a9b3b799adfd.webp',
   '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '2862ee3c-9ab1-44dc-a7eb-93e37705a432',
   '{"eTag":"\"b1feb1fb73c69ccf74422768fb7bfddd\"","size":52426,"mimetype":"image/webp","cacheControl":"max-age=3600","contentLength":52426,"httpStatusCode":200}'::jsonb),
  ('backgrounds', '8f506705-e348-415c-82a9-5a37e2c0ce51/0b039873-f3e1-49d2-a6c8-77586c52bc76.png',
   '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '365e6552-ef10-4053-902a-1b36cf8cd39f',
   '{"eTag":"\"9be585f513ffe0525d5addc24471ce1b\"","size":2326234,"mimetype":"image/png","cacheControl":"max-age=3600","contentLength":2326234,"httpStatusCode":200}'::jsonb),
  ('backgrounds', '8f506705-e348-415c-82a9-5a37e2c0ce51/430b31a0-4cb3-4312-a32a-8434064acd98.png',
   '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'ad0c1ef0-68a4-4c53-a393-e07f1c212814',
   '{"eTag":"\"6475cad13466d6ecca4c02d2abfd7ff8\"","size":2423395,"mimetype":"image/png","cacheControl":"max-age=3600","contentLength":2423395,"httpStatusCode":200}'::jsonb),
  ('backgrounds', '8f506705-e348-415c-82a9-5a37e2c0ce51/57cc8932-ec2d-441c-b9a2-087dcf24dfc4.png',
   '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '71993322-ac58-4f03-83c2-0fe8e427c487',
   '{"eTag":"\"489ced45cef1ab49618e800fe1e74136\"","size":2507407,"mimetype":"image/png","cacheControl":"max-age=3600","contentLength":2507407,"httpStatusCode":200}'::jsonb)
ON CONFLICT (bucket_id, name) DO NOTHING;

-- ── La campaña (mismo id que la que se perdió) ──────────────────────────────
INSERT INTO public.campaigns_campaigns (id, name, description, system_id, system_version, dm_id, locale)
VALUES ('8f506705-e348-415c-82a9-5a37e2c0ce51', 'Plenilunio · pruebas',
        'Campaña de pruebas del dueño. La rehace el seed: no la borres a mano esperando que desaparezca.',
        'plenilunio', '0.2.0', '00000000-0000-4000-8000-000000000001', 'es')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.campaigns_members (campaign_id, user_id, role) VALUES
  ('8f506705-e348-415c-82a9-5a37e2c0ce51', '00000000-0000-4000-8000-000000000001', 'dm'),
  ('8f506705-e348-415c-82a9-5a37e2c0ce51', '00000000-0000-4000-8000-000000000002', 'player')
ON CONFLICT (campaign_id, user_id) DO NOTHING;

-- ── Karen Sinclair (mismo id que la que se perdió) ──────────────────────────
-- Ficha comprobada contra el esquema del sistema: `validateSheet` 0 fallos y el
-- presupuesto de creación cuadrado (25/25 puntos, 3/3 de dones, preset legendario).
INSERT INTO public.characters (id, campaign_id, owner_id, kind, name, concept, health, data, created_by)
VALUES ('3af4f238-25ad-4cf1-a264-09d7586019d8', '8f506705-e348-415c-82a9-5a37e2c0ce51',
        '00000000-0000-4000-8000-000000000002', 'pc', 'Karen Sinclair',
        'Superviviente con más cicatrices que balas', 'healthy',
        '{"name":"Karen Sinclair","player":"Marta Ruiz","concept":"Superviviente con más cicatrices que balas","avatar":"","size":"medium","difficulty":"2","useSpecialty":"no","useArmour":"no","extraDice":0,"fortitude":{"value":6,"specialties":["fortitude.carrying"]},"combat":{"value":4,"specialties":["combat.improvisedWeapons"]},"will":{"value":3,"specialties":["will.courage"]},"cunning":{"value":4,"specialties":["cunning.dangerSense"]},"subtlety":{"value":3,"specialties":["subtlety.concealment"]},"presence":{"value":3,"specialties":["presence.empathy"]},"culture":{"value":2,"specialties":["culture.humanities"]},"resistance":18,"health":"healthy","unconscious":"no","destiny":3,"fortune":3,"xp":0,"weapons":[{"id":"magnum44","ammo":6,"reserve":12},{"id":"knuckles","ammo":null}],"gifts":[{"id":"steelDefense","level":2},{"id":"preciseStrike","level":1}],"equipment":[{"id":"portableTorch"},{"id":"rope15m"},{"id":"improvisedFirstAidKit"},{"id":"looseAmmo"}],"armour":"bulletproofVest","story":"Llegó a la casa con el depósito vacío y sin intención de quedarse. Sigue ahí.","preset":"legendary","specialtyTrade":0,"giftTrade":0}'::jsonb, '00000000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

UPDATE public.campaigns_members SET character_id = '3af4f238-25ad-4cf1-a264-09d7586019d8'
WHERE campaign_id = '8f506705-e348-415c-82a9-5a37e2c0ce51'
  AND user_id = '00000000-0000-4000-8000-000000000002' AND character_id IS NULL;

-- ── Bestiario: los cuatro PNJs cuyas imágenes sobrevivieron ─────────────────
-- El id de cada entrada sale de la RUTA de su imagen en Storage, así que vuelven
-- con su id original y su retrato puesto. Los nombres son descriptivos de lo que
-- se ve en cada imagen (los originales se perdieron): renómbralos a tu gusto.
INSERT INTO public.bestiary_entries (id, campaign_id, owner_id, system_id, origin, name, data, token_url, notes) VALUES
  ('7d73d4a3-b94f-4e9a-a461-470b84c7e3d8', '8f506705-e348-415c-82a9-5a37e2c0ce51', '00000000-0000-4000-8000-000000000001',
   'plenilunio', 'custom', 'Centinela de la muralla', '{"stats":{"fortitude":3,"combat":3,"will":1,"cunning":3,"subtlety":1,"presence":2,"culture":2},"endurance":4,"destiny":2,"protection":0,"abilities":[],"capabilities":[],"attacks":[],"page":61,"resistance":12,"specialties":{"fortitude":["fortitude.athletics"],"combat":["combat.heavyWeapons"],"will":["will.courage"],"cunning":["cunning.lightSleep"],"subtlety":["subtlety.camouflage"],"presence":["presence.interrogation"],"culture":["culture.tactics"]},"notes":"catalog.bestiary.paramilitary.notes"}'::jsonb,
   'http://127.0.0.1:54321/storage/v1/object/public/tokens/00000000-0000-4000-8000-000000000001/bestiary/7d73d4a3-b94f-4e9a-a461-470b84c7e3d8/04031595-a107-49c6-bbca-7d4e483eff20.webp',
   'Bloque de Paramilitar (p.61). Nombre puesto por la imagen.'),
  ('325705e8-9d00-4443-a7d9-8c4286d78296', '8f506705-e348-415c-82a9-5a37e2c0ce51', '00000000-0000-4000-8000-000000000001',
   'plenilunio', 'custom', 'Paladín del sol', '{"stats":{"fortitude":6,"combat":8,"will":5,"cunning":3,"subtlety":2,"presence":4,"culture":4},"endurance":7,"destiny":8,"protection":0,"abilities":["Alado","Aura 3","Disfraz terrenal","Ira solar 3"],"capabilities":[{"id":"winged"},{"id":"aura","level":3},{"id":"earthlyDisguise"},{"id":"solarWrath","level":3}],"attacks":[],"page":132,"resistance":21,"specialties":{"fortitude":["fortitude.vigour"],"combat":["creature.lanzaYEspada"],"will":["will.fanaticism"],"cunning":["cunning.lieDetection"],"subtlety":["creature.acechar"],"presence":["presence.interrogation"],"culture":["culture.religion"]},"notes":"catalog.bestiary.solarPaladin.notes"}'::jsonb,
   'http://127.0.0.1:54321/storage/v1/object/public/tokens/00000000-0000-4000-8000-000000000001/bestiary/325705e8-9d00-4443-a7d9-8c4286d78296/057083a0-aec1-43b2-9dc0-d031994cb527.webp',
   'Bloque de Paladín solar (p.132). La armadura de la imagen lleva soles: encaja.'),
  ('a27c344e-76b3-4ce9-99e3-476ff312e4a9', '8f506705-e348-415c-82a9-5a37e2c0ce51', '00000000-0000-4000-8000-000000000001',
   'plenilunio', 'custom', 'Capitán joven', '{"stats":{"fortitude":3,"combat":3,"will":3,"cunning":2,"subtlety":2,"presence":3,"culture":2},"endurance":6,"destiny":1,"protection":0,"abilities":[],"capabilities":[],"attacks":[{"label":"catalog.weapons.crossbow","attack":3,"damage":5,"ranged":true}],"page":74,"resistance":18,"specialties":{"fortitude":["fortitude.carrying"],"combat":["combat.crossbows"],"will":["will.constancy"],"cunning":["cunning.searching"],"subtlety":["subtlety.dissembling"],"presence":["presence.negotiation"],"culture":["culture.languages"]},"notes":"catalog.bestiary.scavenger.notes"}'::jsonb,
   'http://127.0.0.1:54321/storage/v1/object/public/tokens/00000000-0000-4000-8000-000000000001/bestiary/a27c344e-76b3-4ce9-99e3-476ff312e4a9/5d9186ec-f4bb-4472-8ffe-606efa93cbee.webp',
   'Bloque de Carroñero (p.74). Nombre puesto por la imagen.'),
  ('2e4c6d2c-d82e-4865-8c29-6fd0b5b201ff', '8f506705-e348-415c-82a9-5a37e2c0ce51', '00000000-0000-4000-8000-000000000001',
   'plenilunio', 'custom', 'Puerta que grita', '{"stats":{"fortitude":2,"combat":2,"will":2,"cunning":2,"subtlety":0,"presence":0,"culture":0},"endurance":4,"destiny":0,"protection":0,"abilities":["Inmune al dolor"],"capabilities":[{"id":"painImmune"}],"attacks":[],"page":149,"resistance":12,"specialties":{"fortitude":["creature.mantenerseDePie"],"combat":["creature.tijeras"],"will":["creature.dominarCuerpo"],"cunning":["cunning.movingBlind"]},"notes":"catalog.bestiary.possessed.notes"}'::jsonb,
   'http://127.0.0.1:54321/storage/v1/object/public/tokens/00000000-0000-4000-8000-000000000001/bestiary/2e4c6d2c-d82e-4865-8c29-6fd0b5b201ff/71de3a9f-0cc3-419b-bf06-a9b3b799adfd.webp',
   'Bloque de Poseído (p.149). Nombre puesto por la imagen.')
ON CONFLICT (id) DO NOTHING;

-- ── La escena: dos salas, una puerta entre ellas, y luz de verdad ───────────
-- `lighting = 'night'` y `solid_walls` encendido a propósito: es el escenario
-- donde se ve si las luces se recortan contra los muros (§ 7.2 de la spec).
INSERT INTO public.maps_scenes (id, campaign_id, name, width, height, lighting, solid_walls, fog_mode, visible_players, created_by)
VALUES ('1d0c9f2a-6b74-4f1e-9a30-2c5e8b4470aa', '8f506705-e348-415c-82a9-5a37e2c0ce51', 'Las dos salas', 1600, 1000, 'night', true, 'vision', true, '00000000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

UPDATE public.campaigns_campaigns SET active_scene_id = '1d0c9f2a-6b74-4f1e-9a30-2c5e8b4470aa'
WHERE id = '8f506705-e348-415c-82a9-5a37e2c0ce51' AND active_scene_id IS NULL;

-- Las tres capas fijas (Objetos, Criaturas, Notas del director) las crea sola la
-- escena, por el disparador `maps_scenes_seed_layers`, y un índice único impide
-- repetirlas. Aquí va SÓLO la de terreno, que es la que lleva la foto de suelo.
INSERT INTO public.maps_layers (id, scene_id, campaign_id, kind, name, sort_order, image_url)
VALUES ('2a1b0c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d', '1d0c9f2a-6b74-4f1e-9a30-2c5e8b4470aa', '8f506705-e348-415c-82a9-5a37e2c0ce51', 'terrain', 'Suelo', 0,
        'http://127.0.0.1:54321/storage/v1/object/public/backgrounds/8f506705-e348-415c-82a9-5a37e2c0ce51/0b039873-f3e1-49d2-a6c8-77586c52bc76.png')
ON CONFLICT (id) DO NOTHING;

-- Paredes, luces, fichas y fotos no tienen id fijo, así que un segundo pase del
-- seed sobre el mismo volumen las duplicaría. El guardia mira si la escena ya
-- tiene paredes: si las tiene, este bloque entero no se ejecuta.
DO $seed$
DECLARE
  l_objects   uuid;
  l_creatures uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.maps_walls WHERE scene_id = '1d0c9f2a-6b74-4f1e-9a30-2c5e8b4470aa') THEN RETURN; END IF;

  SELECT id INTO l_objects   FROM public.maps_layers WHERE scene_id = '1d0c9f2a-6b74-4f1e-9a30-2c5e8b4470aa' AND kind = 'objects';
  SELECT id INTO l_creatures FROM public.maps_layers WHERE scene_id = '1d0c9f2a-6b74-4f1e-9a30-2c5e8b4470aa' AND kind = 'creatures';

  -- Cuatro muros exteriores, un tabique partido en dos y UNA PUERTA en medio: es
  -- justo lo que hace falta para ver que la luz de una sala no se cuela en la otra.
  INSERT INTO public.maps_walls (scene_id, campaign_id, x1, y1, x2, y2, kind, blocks_sight, blocks_move, visible_players) VALUES
    ('1d0c9f2a-6b74-4f1e-9a30-2c5e8b4470aa', '8f506705-e348-415c-82a9-5a37e2c0ce51',  200, 150, 1100, 150, 'wall', true, true, true),
    ('1d0c9f2a-6b74-4f1e-9a30-2c5e8b4470aa', '8f506705-e348-415c-82a9-5a37e2c0ce51', 1100, 150, 1100, 700, 'wall', true, true, true),
    ('1d0c9f2a-6b74-4f1e-9a30-2c5e8b4470aa', '8f506705-e348-415c-82a9-5a37e2c0ce51', 1100, 700,  200, 700, 'wall', true, true, true),
    ('1d0c9f2a-6b74-4f1e-9a30-2c5e8b4470aa', '8f506705-e348-415c-82a9-5a37e2c0ce51',  200, 700,  200, 150, 'wall', true, true, true),
    ('1d0c9f2a-6b74-4f1e-9a30-2c5e8b4470aa', '8f506705-e348-415c-82a9-5a37e2c0ce51',  640, 150,  640, 380, 'wall', true, true, true),
    ('1d0c9f2a-6b74-4f1e-9a30-2c5e8b4470aa', '8f506705-e348-415c-82a9-5a37e2c0ce51',  640, 380,  640, 460, 'door', true, true, true),
    ('1d0c9f2a-6b74-4f1e-9a30-2c5e8b4470aa', '8f506705-e348-415c-82a9-5a37e2c0ce51',  640, 460,  640, 700, 'wall', true, true, true);

  -- Una antorcha que parpadea en la sala de la izquierda y un farol en cono en la
  -- de la derecha, apuntando hacia la puerta.
  INSERT INTO public.maps_lights (scene_id, campaign_id, layer_id, shape, kind, x, y, rotation, cone_angle, flicker, range_m, casts_shadow) VALUES
    ('1d0c9f2a-6b74-4f1e-9a30-2c5e8b4470aa', '8f506705-e348-415c-82a9-5a37e2c0ce51', l_objects, 'radius', 'torch',   400, 420,   0, 60, true,  6, true),
    ('1d0c9f2a-6b74-4f1e-9a30-2c5e8b4470aa', '8f506705-e348-415c-82a9-5a37e2c0ce51', l_objects, 'cone',   'lantern', 950, 420, 180, 70, false, 9, true);

  -- Karen en la sala de la izquierda y el centinela al otro lado de la puerta.
  INSERT INTO public.maps_tokens (scene_id, campaign_id, layer_id, character_id, name, x, y, size, visible, controlled_by) VALUES
    ('1d0c9f2a-6b74-4f1e-9a30-2c5e8b4470aa', '8f506705-e348-415c-82a9-5a37e2c0ce51', l_creatures, '3af4f238-25ad-4cf1-a264-09d7586019d8',
     'Karen Sinclair', 350, 500, 1, true, '00000000-0000-4000-8000-000000000002');

  INSERT INTO public.maps_tokens (scene_id, campaign_id, layer_id, bestiary_entry_id, name, image_url, x, y, size, visible) VALUES
    ('1d0c9f2a-6b74-4f1e-9a30-2c5e8b4470aa', '8f506705-e348-415c-82a9-5a37e2c0ce51', l_creatures, '7d73d4a3-b94f-4e9a-a461-470b84c7e3d8',
     'Centinela de la muralla', 'http://127.0.0.1:54321/storage/v1/object/public/tokens/00000000-0000-4000-8000-000000000001/bestiary/7d73d4a3-b94f-4e9a-a461-470b84c7e3d8/04031595-a107-49c6-bbca-7d4e483eff20.webp',
     900, 550, 1, true);

  -- Las tres fotos recuperadas, de vuelta en la biblioteca de fondos.
  INSERT INTO public.maps_images (campaign_id, name, url, uploaded_by) VALUES
    ('8f506705-e348-415c-82a9-5a37e2c0ce51', 'Fondo 1', 'http://127.0.0.1:54321/storage/v1/object/public/backgrounds/8f506705-e348-415c-82a9-5a37e2c0ce51/0b039873-f3e1-49d2-a6c8-77586c52bc76.png', '00000000-0000-4000-8000-000000000001'),
    ('8f506705-e348-415c-82a9-5a37e2c0ce51', 'Fondo 2', 'http://127.0.0.1:54321/storage/v1/object/public/backgrounds/8f506705-e348-415c-82a9-5a37e2c0ce51/430b31a0-4cb3-4312-a32a-8434064acd98.png', '00000000-0000-4000-8000-000000000001'),
    ('8f506705-e348-415c-82a9-5a37e2c0ce51', 'Fondo 3', 'http://127.0.0.1:54321/storage/v1/object/public/backgrounds/8f506705-e348-415c-82a9-5a37e2c0ce51/57cc8932-ec2d-441c-b9a2-087dcf24dfc4.png', '00000000-0000-4000-8000-000000000001');
END
$seed$;
