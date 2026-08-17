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
