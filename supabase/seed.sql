-- =============================================================================
-- DEVELOPMENT DATA ONLY — loaded by `supabase db reset` on a local stack.
-- Never run against production: it creates a demo account with a known password.
--
--   e-mail:   demo@tilt.dev
--   password: tilt-demo-2026
-- =============================================================================

do $$
declare
  demo uuid := '0b1c0de0-0000-4000-8000-000000000001';
  q_capitals uuid := '0b1c0de0-0000-4000-8000-0000000000a1';
  q_space uuid := '0b1c0de0-0000-4000-8000-0000000000a2';
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', demo, 'authenticated', 'authenticated', 'demo@tilt.dev',
          extensions.crypt('tilt-demo-2026', extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', '{"display_name":"Démo Tilt"}', now(), now(), '', '', '', '')
  on conflict (id) do nothing;

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), demo, demo::text, jsonb_build_object('sub', demo::text, 'email', 'demo@tilt.dev'), 'email', now(), now(), now())
  on conflict do nothing;

  insert into public.quizzes (id, owner_id, title, description, language, category, cover_color, cover_pattern)
  values
    (q_capitals, demo, 'Capitales d’Europe', 'Dix minutes pour faire le tour du continent.', 'fr', 'geography', 'cobalt', 'dots'),
    (q_space, demo, 'Le système solaire', 'Planètes, lunes et records.', 'fr', 'science', 'orchid', 'waves')
  on conflict (id) do nothing;

  insert into public.questions (quiz_id, position, type, prompt, time_limit_s, points, content) values
    (q_capitals, 0, 'quiz', 'Quelle est la capitale du Portugal ?', 20, 1000,
      '{"options":[{"id":"o1","text":"Porto","correct":false},{"id":"o2","text":"Lisbonne","correct":true},{"id":"o3","text":"Madrid","correct":false},{"id":"o4","text":"Faro","correct":false}]}'),
    (q_capitals, 1, 'true_false', 'Berne est la capitale de la Suisse.', 15, 1000, '{"correct":true}'),
    (q_capitals, 2, 'text', 'Capitale de la Norvège ?', 30, 2000, '{"accepted":["Oslo"]}'),
    (q_capitals, 3, 'quiz', 'Lesquelles sont des capitales baltes ?', 25, 1000,
      '{"options":[{"id":"o1","text":"Riga","correct":true},{"id":"o2","text":"Vilnius","correct":true},{"id":"o3","text":"Gdańsk","correct":false},{"id":"o4","text":"Tallinn","correct":true}]}'),
    (q_capitals, 4, 'poll', 'Quelle capitale aimeriez-vous visiter ?', 15, 0,
      '{"options":[{"id":"o1","text":"Rome"},{"id":"o2","text":"Prague"},{"id":"o3","text":"Copenhague"}]}'),
    (q_space, 0, 'quiz', 'Quelle est la plus grande planète ?', 20, 1000,
      '{"options":[{"id":"o1","text":"Saturne","correct":false},{"id":"o2","text":"Jupiter","correct":true}]}'),
    (q_space, 1, 'true_false', 'Vénus tourne dans le sens inverse des autres planètes.', 20, 1000, '{"correct":true}')
  on conflict do nothing;

  update public.quizzes set status = 'published', visibility = 'public', published_at = now() where id = q_capitals;
end;
$$;
