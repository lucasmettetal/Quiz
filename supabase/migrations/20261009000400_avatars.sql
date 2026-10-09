-- =============================================================================
-- Tilt — modular avatars
--
-- An avatar is a small JSON config (parts + colors) rendered as SVG by the
-- app (src/features/avatars). Nothing is stored as an image.
--
-- Additive and backward compatible:
--   * new nullable `avatar_config` columns: old rows keep working (the app
--     derives a deterministic avatar from the nickname / display name);
--   * `profiles.avatar_color` and `players.avatar` stay as the accent color.
-- =============================================================================

-- Keeps only well-formed keys: short lowercase identifiers, plus a seed and a
-- version. Unknown part ids are allowed (newer clients may know more parts);
-- the app falls back to a default part for anything it can't draw.
-- When unlockable parts become real, this is where ownership will be checked.
create or replace function public.sanitize_avatar(p_config jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_config is null or jsonb_typeof(p_config) <> 'object' then null
    else (
      select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
        from jsonb_each(p_config)
       where (key in ('head', 'eyes', 'mouth', 'top', 'accessory', 'pattern', 'primary', 'secondary')
              and jsonb_typeof(value) = 'string' and (value #>> '{}') ~ '^[a-z0-9_-]{1,32}$')
          or (key = 'seed' and jsonb_typeof(value) = 'string' and char_length(value #>> '{}') <= 64)
          or (key = 'v' and jsonb_typeof(value) = 'number')
    )
  end;
$$;

alter table public.profiles
  add column if not exists avatar_config jsonb
  check (avatar_config is null or (jsonb_typeof(avatar_config) = 'object' and pg_column_size(avatar_config) <= 2048));

alter table public.players
  add column if not exists avatar_config jsonb
  check (avatar_config is null or (jsonb_typeof(avatar_config) = 'object' and pg_column_size(avatar_config) <= 2048));

-- Creators edit their own avatar (column-level grant, like the other profile fields).
grant update (avatar_config) on public.profiles to authenticated;

create or replace function public.sanitize_profile_avatar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.avatar_config := public.sanitize_avatar(new.avatar_config);
  return new;
end;
$$;

create trigger profiles_sanitize_avatar before insert or update of avatar_config on public.profiles
  for each row execute function public.sanitize_profile_avatar();

-- -----------------------------------------------------------------------------
-- join_session gains an optional avatar config (old 3-argument calls still work
-- through the default value).
-- -----------------------------------------------------------------------------

drop function if exists public.join_session(text, text, text);

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

  select * into s from public.game_sessions
   where pin = btrim(p_pin) and state <> 'FINISHED'
   order by created_at desc limit 1
   for update;
  if not found then
    perform public.raise_app_error('PIN_NOT_FOUND');
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

revoke execute on function public.join_session(text, text, text, jsonb) from public, anon;
grant execute on function public.join_session(text, text, text, jsonb) to authenticated;
-- Pure helper, called by the profile trigger with the caller's rights.
revoke execute on function public.sanitize_avatar(jsonb) from public, anon;
grant execute on function public.sanitize_avatar(jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Player view: expose the player's own avatar config.
-- -----------------------------------------------------------------------------

create or replace function public.get_player_view(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p public.players;
  s public.game_sessions;
  gq public.game_questions;
  a public.player_answers;
  revealed boolean;
  player_total integer;
begin
  select * into p from public.players where session_id = p_session_id and user_id = auth.uid();
  if not found then
    perform public.raise_app_error('NOT_IN_GAME');
  end if;
  select * into s from public.game_sessions where id = p_session_id;
  select count(*) into player_total from public.players where session_id = s.id and status = 'active';

  revealed := s.state in ('QUESTION_RESULTS', 'LEADERBOARD', 'FINAL_RESULTS', 'FINISHED');

  if s.current_index >= 0 then
    select * into gq from public.game_questions where session_id = s.id and position = s.current_index;
    select * into a from public.player_answers where game_question_id = gq.id and player_id = p.id;
  end if;

  return jsonb_build_object(
    'server_now', now(),
    'session', jsonb_build_object(
      'id', s.id, 'state', s.state, 'quiz_title', s.quiz_title, 'pin', s.pin,
      'current_index', s.current_index, 'question_count', s.question_count,
      'phase_started_at', s.phase_started_at, 'question_deadline', s.question_deadline
    ),
    'player', jsonb_build_object(
      'id', p.id, 'nickname', p.nickname, 'avatar', p.avatar, 'avatar_config', p.avatar_config, 'status', p.status,
      'score', p.score, 'last_points', p.last_points, 'rank', p.rank, 'previous_rank', p.previous_rank,
      'streak', p.streak, 'correct_count', p.correct_count
    ),
    'player_count', player_total,
    'question', case when gq.id is null then null else jsonb_build_object(
      'id', gq.id, 'position', gq.position, 'type', gq.type, 'prompt', gq.prompt, 'media', gq.media,
      'time_limit_s', gq.time_limit_s, 'points', gq.points,
      'content', public.public_question_content(gq.type, gq.content),
      'solution', case when revealed then public.question_solution(gq.type, gq.content) end
    ) end,
    'answer', case when a.id is null then null else jsonb_build_object(
      'answer', a.answer,
      'is_correct', case when revealed then a.is_correct end,
      'points', case when revealed then a.points end
    ) end
  );
end;
$$;
