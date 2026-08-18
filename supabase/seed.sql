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
