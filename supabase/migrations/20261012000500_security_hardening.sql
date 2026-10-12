-- =============================================================================
-- Tiltt — security hardening (audit of 2026-10-12)
--
--   1. Publication state only changes through publish_quiz() (validated).
--   2. Size limits on question payloads and media restricted to the storage
--      bucket or Kahoot's image CDN (no arbitrary third-party trackers).
--   3. PIN lookups need an identity and are rate-limited per user, so live
--      games cannot be enumerated by brute force.
--   4. A host may only keep a bounded number of live games (no PIN exhaustion).
--
-- Additive: new constraints are NOT VALID so existing rows never block the
-- migration; they apply to every new insert / update.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Publication state: no direct writes (publish_quiz validates the quiz).
-- -----------------------------------------------------------------------------

revoke insert, update on public.quizzes from authenticated;
grant insert (title, description, language, category, cover_color, cover_pattern, cover_image_path)
  on public.quizzes to authenticated;
grant update (title, description, language, category, cover_color, cover_pattern, cover_image_path)
  on public.quizzes to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Payload size and media origin
-- -----------------------------------------------------------------------------

-- A media path is either an object of the quiz-media bucket ("<user id>/<file>")
-- or an image imported from Kahoot's CDN.
create or replace function public.is_allowed_media_path(p_path text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_path is null
      or (char_length(p_path) <= 500
          and (p_path ~ '^[0-9a-f-]{36}/[^/]+$'
               or p_path ~ '^https://([a-z0-9-]+\.)*kahoot\.it/[^\s"''<>]+$'));
$$;

alter table public.questions
  add constraint questions_content_size check (pg_column_size(content) <= 32768) not valid,
  add constraint questions_media_size check (media is null or pg_column_size(media) <= 2048) not valid,
  add constraint questions_media_path check (media is null or public.is_allowed_media_path(media ->> 'path')) not valid;

alter table public.quizzes
  add constraint quizzes_cover_image_path check (public.is_allowed_media_path(cover_image_path)) not valid;

-- -----------------------------------------------------------------------------
-- 3. Rate limit for PIN lookups
-- -----------------------------------------------------------------------------

-- Failed lookups per user. Never readable by clients (RLS on, no grants).
create table public.pin_lookup_misses (
  user_id  uuid not null,
  at       timestamptz not null default now()
);
create index pin_lookup_misses_user_idx on public.pin_lookup_misses (user_id, at);
alter table public.pin_lookup_misses enable row level security;
revoke all on public.pin_lookup_misses from anon, authenticated;

-- Raises RATE_LIMITED once a user has missed too many PINs recently.
create or replace function public.check_pin_rate_limit(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.pin_lookup_misses where user_id = p_uid and at < now() - interval '10 minutes';
  if (select count(*) from public.pin_lookup_misses where user_id = p_uid) >= 20 then
    perform public.raise_app_error('RATE_LIMITED');
  end if;
end;
$$;

-- Now requires an identity (players sign in anonymously first) and records
-- misses. No longer `stable`: it writes the miss log.
create or replace function public.find_session(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  s public.game_sessions;
  active_players integer;
begin
  if uid is null then
    perform public.raise_app_error('NOT_AUTHENTICATED');
  end if;
  perform public.check_pin_rate_limit(uid);

  select * into s from public.game_sessions
   where pin = btrim(p_pin) and state <> 'FINISHED'
   order by created_at desc limit 1;
  if not found then
    insert into public.pin_lookup_misses (user_id) values (uid);
    return null;
  end if;

  select count(*) into active_players from public.players where session_id = s.id and status = 'active';

  return jsonb_build_object(
    'session_id', s.id,
    'quiz_title', s.quiz_title,
    'state', s.state,
    'reason', case
      when s.state = 'FINAL_RESULTS' then 'GAME_FINISHED'
      when s.locked then 'GAME_LOCKED'
      when s.state <> 'LOBBY' and not s.allow_late_join then 'GAME_STARTED'
      when active_players >= s.max_players then 'GAME_FULL'
      else null
    end
  );
end;
$$;

revoke execute on function public.find_session(text) from public, anon;
grant execute on function public.find_session(text) to authenticated;

-- An unknown PIN now returns NULL instead of raising: raising would roll back
-- the miss we record, and the rate limit could be bypassed through this call.
-- The app maps a NULL row to PIN_NOT_FOUND.
create or replace function public.join_session(
  p_pin text,
  p_nickname text,
  p_avatar text default 'vermilion',
  p_avatar_config jsonb default null
)
returns public.players
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  s public.game_sessions;
  p public.players;
  nick text := left(regexp_replace(btrim(coalesce(p_nickname, '')), '\s+', ' ', 'g'), 24);
  av text := case when p_avatar in ('vermilion', 'cobalt', 'lime', 'amber', 'teal', 'orchid') then p_avatar else 'vermilion' end;
  cfg jsonb := public.sanitize_avatar(p_avatar_config);
begin
  if uid is null then
    perform public.raise_app_error('NOT_AUTHENTICATED');
  end if;
  if nick = '' then
    perform public.raise_app_error('NICKNAME_INVALID');
  end if;
  perform public.check_pin_rate_limit(uid);

  select * into s from public.game_sessions
   where pin = btrim(p_pin) and state <> 'FINISHED'
   order by created_at desc limit 1
   for update;
  if not found then
    insert into public.pin_lookup_misses (user_id) values (uid);
    return null;
  end if;
  if s.state = 'FINAL_RESULTS' then
    perform public.raise_app_error('GAME_FINISHED');
  end if;

  -- Reconnection: same browser identity → same player (avatar may be refreshed).
  select * into p from public.players where session_id = s.id and user_id = uid;
  if found then
    if p.status = 'kicked' then
      perform public.raise_app_error('KICKED');
    end if;
    update public.players
       set status = 'active',
           avatar_config = coalesce(cfg, avatar_config),
           avatar = case when cfg is not null then av else avatar end
     where id = p.id
    returning * into p;
    return p;
  end if;

  if s.locked then
    perform public.raise_app_error('GAME_LOCKED');
  end if;
  if s.state <> 'LOBBY' and not s.allow_late_join then
    perform public.raise_app_error('GAME_STARTED');
  end if;
  if (select count(*) from public.players where session_id = s.id and status = 'active') >= s.max_players then
    perform public.raise_app_error('GAME_FULL');
  end if;

  begin
    insert into public.players (session_id, user_id, nickname, avatar, avatar_config, rank)
    values (s.id, uid, nick, av, cfg,
            case when s.current_index >= 0
              then (select count(*) + 1 from public.players where session_id = s.id and status <> 'kicked' and score > 0)
            end)
    returning * into p;
  exception when unique_violation then
    perform public.raise_app_error('NICKNAME_TAKEN');
  end;

  return p;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Bounded number of live games per host
-- -----------------------------------------------------------------------------

create or replace function public.create_game_session(p_quiz_id uuid, p_options jsonb default '{}'::jsonb)
returns public.game_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_profile();
  q public.quizzes;
  s public.game_sessions;
  new_pin text;
  attempts integer := 0;
begin
  select * into q from public.quizzes where id = p_quiz_id;
  if not found or not (q.owner_id = uid or (q.status = 'published' and q.visibility in ('public', 'unlisted'))) then
    perform public.raise_app_error('QUIZ_NOT_FOUND');
  end if;
  if not exists (select 1 from public.questions where quiz_id = q.id) then
    perform public.raise_app_error('QUIZ_EMPTY');
  end if;
  if exists (select 1 from public.questions
              where quiz_id = q.id and cardinality(public.question_issues(type, prompt, content)) > 0) then
    perform public.raise_app_error('QUIZ_INVALID');
  end if;

  -- Release PINs of games abandoned for a long time.
  update public.game_sessions
     set state = 'FINISHED', ended_at = coalesce(ended_at, now())
   where state <> 'FINISHED' and updated_at < now() - interval '12 hours';

  -- A host never needs dozens of simultaneous games; this keeps one account
  -- from reserving the PIN space.
  if (select count(*) from public.game_sessions where host_id = uid and state <> 'FINISHED') >= 10 then
    perform public.raise_app_error('TOO_MANY_GAMES');
  end if;

  loop
    attempts := attempts + 1;
    new_pin := (100000 + floor(random() * 900000))::integer::text;
    begin
      insert into public.game_sessions (quiz_id, host_id, quiz_title, pin, question_count, max_players, allow_late_join)
      values (
        q.id, uid, coalesce(nullif(btrim(q.title), ''), 'Quiz'), new_pin,
        (select count(*) from public.questions where quiz_id = q.id),
        least(greatest(coalesce((p_options ->> 'max_players')::integer, 200), 1), 500),
        coalesce((p_options ->> 'allow_late_join')::boolean, true)
      )
      returning * into s;
      exit;
    exception when unique_violation then
      if attempts >= 20 then
        perform public.raise_app_error('PIN_EXHAUSTED');
      end if;
    end;
  end loop;

  insert into public.game_questions (session_id, position, source_question_id, type, prompt, media,
                                     time_limit_s, points, content)
  select s.id, row_number() over (order by position) - 1, id, type, prompt, media, time_limit_s, points, content
    from public.questions where quiz_id = q.id;

  return s;
end;
$$;

-- Internal helpers: never callable through the API.
revoke execute on function public.check_pin_rate_limit(uuid) from public, anon, authenticated;
-- is_allowed_media_path stays executable: CHECK constraints call it with the caller's rights.
