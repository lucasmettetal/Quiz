-- =============================================================================
-- Tilt — game engine & quiz RPCs
--
-- The database is the single authority for a live game:
--   * state transitions follow the machine mirrored in
--     src/features/game/engine/stateMachine.ts
--   * answer correctness and score are computed here, with server time
--     (formula mirrored in src/features/game/engine/scoring.ts)
--   * players never read answers or other players' submissions directly.
--
-- Errors are raised with a stable machine code as message (e.g. 'PIN_NOT_FOUND')
-- that the app maps to a human message (src/lib/errors.ts).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Pure helpers (mirrored in TypeScript, parity-tested in tests/db)
-- -----------------------------------------------------------------------------

-- score = points × speedFactor, speedFactor goes linearly from 1 (instant) to
-- 0.5 (at the buzzer). Wrong / ungraded answers score 0.
create or replace function public.compute_question_score(
  p_points integer, p_time_limit_ms integer, p_elapsed_ms integer, p_is_correct boolean
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_is_correct is not true or p_points <= 0 or p_time_limit_ms <= 0 then 0
    else round(
      p_points * (1 - 0.5 * least(greatest(p_elapsed_ms, 0)::numeric / p_time_limit_ms, 1))
    )::integer
  end;
$$;

create or replace function public.normalize_text_answer(p_value text, p_case_sensitive boolean default false)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_case_sensitive
    then regexp_replace(btrim(coalesce(p_value, '')), '\s+', ' ', 'g')
    else lower(regexp_replace(btrim(coalesce(p_value, '')), '\s+', ' ', 'g'))
  end;
$$;

-- Returns the list of problems that make a question unplayable (empty = OK).
-- Codes match src/features/questions/validation.ts.
create or replace function public.question_issues(p_type text, p_prompt text, p_content jsonb)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  issues text[] := '{}';
  opts jsonb := coalesce(p_content -> 'options', '[]'::jsonb);
  n integer;
begin
  if btrim(coalesce(p_prompt, '')) = '' then
    issues := array_append(issues, 'prompt_empty');
  end if;

  case p_type
    when 'quiz', 'poll' then
      n := case when jsonb_typeof(opts) = 'array' then jsonb_array_length(opts) else 0 end;
      if n < 2 or n > 6 then
        issues := array_append(issues, 'options_count');
      end if;
      if exists (select 1 from jsonb_array_elements(case when jsonb_typeof(opts) = 'array' then opts else '[]' end) o
                  where btrim(coalesce(o ->> 'text', '')) = '') then
        issues := array_append(issues, 'option_empty');
      end if;
      if p_type = 'quiz' and not exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(opts) = 'array' then opts else '[]' end) o
         where (o ->> 'correct')::boolean is true) then
        issues := array_append(issues, 'no_correct');
      end if;
    when 'true_false' then
      if jsonb_typeof(p_content -> 'correct') is distinct from 'boolean' then
        issues := array_append(issues, 'no_correct');
      end if;
    when 'text' then
      if not exists (select 1 from jsonb_array_elements_text(coalesce(p_content -> 'accepted', '[]'::jsonb)) a
                      where btrim(a) <> '') then
        issues := array_append(issues, 'accepted_empty');
      end if;
    else
      issues := array_append(issues, 'unknown_type');
  end case;

  return issues;
end;
$$;

-- Checks that an answer payload has the right shape for the question.
create or replace function public.answer_is_well_formed(p_type text, p_content jsonb, p_answer jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  ids jsonb := p_answer -> 'optionIds';
begin
  case p_type
    when 'quiz', 'poll' then
      if jsonb_typeof(ids) <> 'array' or jsonb_array_length(ids) = 0 then
        return false;
      end if;
      if p_type = 'poll' and jsonb_array_length(ids) <> 1 then
        return false;
      end if;
      -- every selected id must exist, no duplicates
      return (select count(distinct x) = jsonb_array_length(ids)
                     and bool_and(exists (select 1 from jsonb_array_elements(p_content -> 'options') o
                                           where o ->> 'id' = x))
                from jsonb_array_elements_text(ids) x);
    when 'true_false' then
      return jsonb_typeof(p_answer -> 'value') = 'boolean';
    when 'text' then
      return jsonb_typeof(p_answer -> 'text') = 'string'
         and char_length(p_answer ->> 'text') between 1 and 200;
    else
      return false;
  end case;
end;
$$;

-- true / false for graded types, null for ungraded ones (poll).
create or replace function public.evaluate_answer(p_type text, p_content jsonb, p_answer jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  case_sensitive boolean := coalesce((p_content ->> 'caseSensitive')::boolean, false);
begin
  case p_type
    when 'quiz' then
      -- exact set match between selected and correct options
      return (
        select coalesce(array_agg(x order by x), '{}')
          from jsonb_array_elements_text(p_answer -> 'optionIds') x
      ) = (
        select coalesce(array_agg(o ->> 'id' order by o ->> 'id'), '{}')
          from jsonb_array_elements(p_content -> 'options') o
         where (o ->> 'correct')::boolean is true
      );
    when 'true_false' then
      return (p_answer ->> 'value')::boolean = (p_content ->> 'correct')::boolean;
    when 'text' then
      return exists (
        select 1 from jsonb_array_elements_text(coalesce(p_content -> 'accepted', '[]'::jsonb)) a
         where btrim(a) <> ''
           and public.normalize_text_answer(a, case_sensitive)
             = public.normalize_text_answer(p_answer ->> 'text', case_sensitive)
      );
    when 'poll' then
      return null;
    else
      return false;
  end case;
end;
$$;

-- What a player may see of a question while it is being played.
create or replace function public.public_question_content(p_type text, p_content jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case p_type
    when 'quiz' then jsonb_build_object(
      'options', coalesce((select jsonb_agg(jsonb_build_object('id', o ->> 'id', 'text', o ->> 'text') order by ord)
                             from jsonb_array_elements(p_content -> 'options') with ordinality t(o, ord)), '[]'),
      'multi', (select count(*) > 1 from jsonb_array_elements(p_content -> 'options') o
                 where (o ->> 'correct')::boolean is true))
    when 'poll' then jsonb_build_object(
      'options', coalesce((select jsonb_agg(jsonb_build_object('id', o ->> 'id', 'text', o ->> 'text') order by ord)
                             from jsonb_array_elements(p_content -> 'options') with ordinality t(o, ord)), '[]'))
    else '{}'::jsonb
  end;
$$;

-- The correct answer, revealed once the question is closed.
create or replace function public.question_solution(p_type text, p_content jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case p_type
    when 'quiz' then jsonb_build_object(
      'optionIds', coalesce((select jsonb_agg(o ->> 'id') from jsonb_array_elements(p_content -> 'options') o
                              where (o ->> 'correct')::boolean is true), '[]'))
    when 'true_false' then jsonb_build_object('value', p_content -> 'correct')
    when 'text' then jsonb_build_object('accepted', coalesce(p_content -> 'accepted', '[]'))
    else '{}'::jsonb
  end;
$$;

create or replace function public.raise_app_error(p_code text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception '%', p_code using errcode = 'P0001', hint = 'tilt';
end;
$$;

create or replace function public.require_profile()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid) then
    perform public.raise_app_error('NOT_AUTHENTICATED');
  end if;
  return uid;
end;
$$;

-- -----------------------------------------------------------------------------
-- Quiz authoring
-- -----------------------------------------------------------------------------

-- Atomically sync a quiz and its full ordered question list (autosave).
-- Optimistic concurrency: the caller sends the version it last saw.
create or replace function public.save_quiz(
  p_quiz_id uuid, p_expected_version integer, p_quiz jsonb, p_questions jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_profile();
  q public.quizzes;
begin
  select * into q from public.quizzes where id = p_quiz_id for update;
  if not found or q.owner_id <> uid then
    perform public.raise_app_error('QUIZ_NOT_FOUND');
  end if;
  if q.version <> p_expected_version then
    perform public.raise_app_error('VERSION_CONFLICT');
  end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) > 100 then
    perform public.raise_app_error('INVALID_PAYLOAD');
  end if;

  update public.quizzes set
    title            = coalesce(p_quiz ->> 'title', title),
    description      = coalesce(p_quiz ->> 'description', description),
    language         = coalesce(p_quiz ->> 'language', language),
    category         = coalesce(p_quiz ->> 'category', category),
    cover_color      = coalesce(p_quiz ->> 'cover_color', cover_color),
    cover_pattern    = coalesce(p_quiz ->> 'cover_pattern', cover_pattern),
    cover_image_path = case when p_quiz ? 'cover_image_path' then p_quiz ->> 'cover_image_path' else cover_image_path end,
    version          = version + 1
  where id = p_quiz_id;

  delete from public.questions
   where quiz_id = p_quiz_id
     and id not in (select (e ->> 'id')::uuid from jsonb_array_elements(p_questions) e);

  insert into public.questions (id, quiz_id, position, type, prompt, media, time_limit_s, points, content)
  select (e ->> 'id')::uuid,
         p_quiz_id,
         (ord - 1)::integer,
         e ->> 'type',
         coalesce(e ->> 'prompt', ''),
         case when jsonb_typeof(e -> 'media') = 'object' then e -> 'media' else null end,
         coalesce((e ->> 'time_limit_s')::integer, 20),
         coalesce((e ->> 'points')::integer, 1000),
         coalesce(e -> 'content', '{}'::jsonb)
    from jsonb_array_elements(p_questions) with ordinality as t(e, ord)
  on conflict (id) do update set
    position     = excluded.position,
    type         = excluded.type,
    prompt       = excluded.prompt,
    media        = excluded.media,
    time_limit_s = excluded.time_limit_s,
    points       = excluded.points,
    content      = excluded.content
  where public.questions.quiz_id = p_quiz_id;

  if p_quiz ? 'tags' then
    delete from public.quiz_tags where quiz_id = p_quiz_id;
    insert into public.quiz_tags (quiz_id, tag)
    select distinct p_quiz_id, lower(btrim(t))
      from jsonb_array_elements_text(p_quiz -> 'tags') t
     where btrim(t) <> ''
     limit 8;
  end if;

  return q.version + 1;
end;
$$;

-- Publish (validates every question) or change visibility.
create or replace function public.publish_quiz(p_quiz_id uuid, p_visibility text)
returns public.quizzes
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_profile();
  q public.quizzes;
begin
  select * into q from public.quizzes where id = p_quiz_id for update;
  if not found or q.owner_id <> uid then
    perform public.raise_app_error('QUIZ_NOT_FOUND');
  end if;
  if p_visibility not in ('private', 'unlisted', 'public') then
    perform public.raise_app_error('INVALID_PAYLOAD');
  end if;
  if btrim(q.title) = '' then
    perform public.raise_app_error('QUIZ_TITLE_MISSING');
  end if;
  if not exists (select 1 from public.questions where quiz_id = p_quiz_id) then
    perform public.raise_app_error('QUIZ_EMPTY');
  end if;
  if exists (select 1 from public.questions
              where quiz_id = p_quiz_id and cardinality(public.question_issues(type, prompt, content)) > 0) then
    perform public.raise_app_error('QUIZ_INVALID');
  end if;

  update public.quizzes
     set status = 'published',
         visibility = p_visibility,
         published_at = coalesce(published_at, now())
   where id = p_quiz_id
  returning * into q;
  return q;
end;
$$;

create or replace function public.duplicate_quiz(p_quiz_id uuid, p_title text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_profile();
  src public.quizzes;
  new_id uuid;
begin
  select * into src from public.quizzes where id = p_quiz_id;
  if not found or not (src.owner_id = uid or (src.status = 'published' and src.visibility in ('public', 'unlisted'))) then
    perform public.raise_app_error('QUIZ_NOT_FOUND');
  end if;

  insert into public.quizzes (owner_id, title, description, language, category, cover_color, cover_pattern,
                              cover_image_path, forked_from)
  values (uid, left(coalesce(nullif(btrim(p_title), ''), src.title), 120), src.description, src.language,
          src.category, src.cover_color, src.cover_pattern, src.cover_image_path, src.id)
  returning id into new_id;

  insert into public.questions (quiz_id, position, type, prompt, media, time_limit_s, points, content)
  select new_id, position, type, prompt, media, time_limit_s, points, content
    from public.questions where quiz_id = src.id;

  insert into public.quiz_tags (quiz_id, tag)
  select new_id, tag from public.quiz_tags where quiz_id = src.id;

  return new_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Game lifecycle
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

-- Callable before signing in: tells the join screen whether a PIN is valid.
create or replace function public.find_session(p_pin text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.game_sessions;
  active_players integer;
begin
  select * into s from public.game_sessions
   where pin = btrim(p_pin) and state <> 'FINISHED'
   order by created_at desc limit 1;
  if not found then
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

create or replace function public.join_session(p_pin text, p_nickname text, p_avatar text default 'vermilion')
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

  -- Reconnection: same browser identity → same player.
  select * into p from public.players where session_id = s.id and user_id = uid;
  if found then
    if p.status = 'kicked' then
      perform public.raise_app_error('KICKED');
    end if;
    if p.status = 'left' then
      update public.players set status = 'active' where id = p.id returning * into p;
    end if;
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
    insert into public.players (session_id, user_id, nickname, avatar, rank)
    values (s.id, uid, nick, av,
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

create or replace function public.leave_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.players set status = 'left'
   where session_id = p_session_id and user_id = auth.uid() and status = 'active';
end;
$$;

create or replace function public.kick_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid uuid;
begin
  select session_id into sid from public.players where id = p_player_id;
  if sid is null or not public.is_session_host(sid) then
    perform public.raise_app_error('NOT_AUTHORIZED');
  end if;
  update public.players set status = 'kicked', rank = null where id = p_player_id;
end;
$$;

create or replace function public.set_session_locked(p_session_id uuid, p_locked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_session_host(p_session_id) then
    perform public.raise_app_error('NOT_AUTHORIZED');
  end if;
  update public.game_sessions set locked = p_locked where id = p_session_id and state <> 'FINISHED';
end;
$$;

-- Internal: close the current question, credit points, recompute ranks.
create or replace function public.close_current_question(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.game_sessions;
  gq public.game_questions;
begin
  select * into s from public.game_sessions where id = p_session_id;
  select * into gq from public.game_questions where session_id = s.id and position = s.current_index;

  update public.players p set
    last_points   = coalesce(x.points, 0),
    score         = p.score + coalesce(x.points, 0),
    correct_count = p.correct_count + case when x.is_correct then 1 else 0 end,
    streak        = case
                      when x.is_correct then p.streak + 1
                      when gq.type = 'poll' then p.streak
                      else 0
                    end
  from (
    select pl.id, a.points, a.is_correct
      from public.players pl
      left join public.player_answers a on a.player_id = pl.id and a.game_question_id = gq.id
     where pl.session_id = s.id and pl.status <> 'kicked'
  ) x
  where p.id = x.id;

  update public.players p set
    previous_rank = p.rank,
    rank = r.rnk
  from (
    select id, rank() over (order by score desc)::integer as rnk
      from public.players where session_id = s.id and status <> 'kicked'
  ) r
  where p.id = r.id;

  update public.game_sessions
     set state = 'QUESTION_RESULTS', phase_started_at = now()
   where id = s.id;
end;
$$;

-- The host's single "next" action. Idempotent: if the game is no longer in
-- p_from_state (double click, second tab, retry), nothing happens.
create or replace function public.host_advance(p_session_id uuid, p_from_state text)
returns public.game_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.game_sessions;
  gq public.game_questions;
begin
  select * into s from public.game_sessions where id = p_session_id for update;
  if not found or s.host_id <> auth.uid() then
    perform public.raise_app_error('NOT_AUTHORIZED');
  end if;
  if s.state <> p_from_state then
    return s;
  end if;

  case s.state
    when 'LOBBY' then
      if not exists (select 1 from public.players where session_id = s.id and status = 'active') then
        perform public.raise_app_error('NO_PLAYERS');
      end if;
      update public.game_sessions
         set state = 'QUESTION_INTRO', current_index = 0, started_at = now(), phase_started_at = now()
       where id = s.id;
      update public.quizzes set play_count = play_count + 1 where id = s.quiz_id;

    when 'QUESTION_INTRO' then
      select * into gq from public.game_questions where session_id = s.id and position = s.current_index;
      update public.game_sessions
         set state = 'QUESTION_ACTIVE', phase_started_at = now(),
             question_deadline = now() + make_interval(secs => gq.time_limit_s)
       where id = s.id;

    when 'QUESTION_ACTIVE' then
      perform public.close_current_question(s.id);

    when 'QUESTION_RESULTS' then
      if s.current_index >= s.question_count - 1 then
        update public.game_sessions
           set state = 'FINAL_RESULTS', phase_started_at = now(), ended_at = now()
         where id = s.id;
      else
        update public.game_sessions set state = 'LEADERBOARD', phase_started_at = now() where id = s.id;
      end if;

    when 'LEADERBOARD' then
      update public.game_sessions
         set state = 'QUESTION_INTRO', current_index = s.current_index + 1,
             phase_started_at = now(), question_deadline = null
       where id = s.id;

    when 'FINAL_RESULTS' then
      update public.game_sessions set state = 'FINISHED', phase_started_at = now() where id = s.id;

    else
      perform public.raise_app_error('GAME_FINISHED');
  end case;

  select * into s from public.game_sessions where id = p_session_id;
  return s;
end;
$$;

-- Ends a game from any state (abort, or close after the podium).
create or replace function public.host_end_game(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_session_host(p_session_id) then
    perform public.raise_app_error('NOT_AUTHORIZED');
  end if;
  update public.game_sessions
     set state = 'FINISHED', phase_started_at = now(), ended_at = coalesce(ended_at, now())
   where id = p_session_id and state <> 'FINISHED';
end;
$$;

-- A player answers the current question. Server time decides speed; the
-- unique constraint guarantees a single answer per player and question.
create or replace function public.submit_answer(p_session_id uuid, p_game_question_id uuid, p_answer jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.players;
  s public.game_sessions;
  gq public.game_questions;
  elapsed integer;
  correct boolean;
  pts integer;
  inserted uuid;
  grace constant interval := interval '1500 milliseconds';  -- network latency allowance
begin
  select * into p from public.players where session_id = p_session_id and user_id = auth.uid();
  if not found or p.status = 'left' then
    perform public.raise_app_error('NOT_IN_GAME');
  end if;
  if p.status = 'kicked' then
    perform public.raise_app_error('KICKED');
  end if;

  -- Serialize submissions of a session so the "everyone answered" check is exact.
  select * into s from public.game_sessions where id = p_session_id for update;
  select * into gq from public.game_questions where id = p_game_question_id and session_id = p_session_id;

  if exists (select 1 from public.player_answers where game_question_id = p_game_question_id and player_id = p.id) then
    perform public.raise_app_error('ALREADY_ANSWERED');
  end if;
  if not found or s.state <> 'QUESTION_ACTIVE' or gq.position <> s.current_index then
    perform public.raise_app_error('QUESTION_CLOSED');
  end if;
  if now() > s.question_deadline + grace then
    perform public.raise_app_error('TIME_UP');
  end if;
  if not public.answer_is_well_formed(gq.type, gq.content, p_answer) then
    perform public.raise_app_error('INVALID_ANSWER');
  end if;

  elapsed := greatest(0, floor(extract(epoch from (least(now(), s.question_deadline) - s.phase_started_at)) * 1000))::integer;
  correct := public.evaluate_answer(gq.type, gq.content, p_answer);
  pts := public.compute_question_score(gq.points, gq.time_limit_s * 1000, elapsed, correct);

  insert into public.player_answers (session_id, game_question_id, player_id, answer, is_correct, points, elapsed_ms)
  values (s.id, gq.id, p.id, p_answer, correct, pts, elapsed)
  on conflict (game_question_id, player_id) do nothing
  returning id into inserted;

  if inserted is null then
    perform public.raise_app_error('ALREADY_ANSWERED');
  end if;

  -- Everyone still in the game has answered: close the question right away.
  if (select count(*) from public.player_answers a
        join public.players pl on pl.id = a.player_id and pl.status = 'active'
       where a.game_question_id = gq.id)
     >= (select count(*) from public.players where session_id = s.id and status = 'active') then
    perform public.close_current_question(s.id);
  end if;

  return jsonb_build_object('accepted', true, 'elapsed_ms', elapsed);
end;
$$;

-- Everything a player's screen needs, filtered for what they may know now.
-- Called on join, refresh, reconnection and after every realtime change.
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
      'id', p.id, 'nickname', p.nickname, 'avatar', p.avatar, 'status', p.status,
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

-- Lets clients align their countdowns on the database clock.
create or replace function public.server_time()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now();
$$;

-- -----------------------------------------------------------------------------
-- Privileges: deny by default, expose only the public API.
-- -----------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.compute_question_score(integer, integer, integer, boolean),
  public.normalize_text_answer(text, boolean),
  public.question_issues(text, text, jsonb),
  public.find_session(text),
  public.server_time()
to anon, authenticated;

grant execute on function
  public.save_quiz(uuid, integer, jsonb, jsonb),
  public.publish_quiz(uuid, text),
  public.duplicate_quiz(uuid, text),
  public.create_game_session(uuid, jsonb),
  public.join_session(text, text, text),
  public.leave_session(uuid),
  public.kick_player(uuid),
  public.set_session_locked(uuid, boolean),
  public.host_advance(uuid, text),
  public.host_end_game(uuid),
  public.submit_answer(uuid, uuid, jsonb),
  public.get_player_view(uuid)
to authenticated;

-- RLS policies call these helpers.
grant execute on function
  public.is_session_host(uuid),
  public.is_session_player(uuid),
  public.can_read_quiz(uuid),
  public.owns_quiz(uuid)
to anon, authenticated;
