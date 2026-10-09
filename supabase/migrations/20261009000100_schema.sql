-- =============================================================================
-- Tilt — core schema
-- Tables, constraints, indexes and Row Level Security.
-- Game logic (RPC functions) lives in 20261009000200_game_engine.sql.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles — one row per *registered* user (anonymous players get none)
-- -----------------------------------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(btrim(display_name)) between 1 and 60),
  avatar_color  text not null default 'vermilion'
                check (avatar_color in ('vermilion', 'cobalt', 'lime', 'amber', 'teal', 'orchid')),
  locale        text not null default 'fr' check (locale in ('fr', 'en')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Create a profile for every non-anonymous user that signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;

  insert into public.profiles (id, display_name, locale)
  values (
    new.id,
    left(coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, 'joueur'), '@', 1)
    ), 60),
    case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'fr' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- An anonymous user that upgrades to a permanent account gets a profile too.
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
create trigger on_auth_user_upgraded after update of is_anonymous on auth.users
  for each row when (old.is_anonymous and not new.is_anonymous)
  execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- quizzes
-- -----------------------------------------------------------------------------

create table public.quizzes (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.profiles (id) on delete cascade,
  title             text not null default '' check (char_length(title) <= 120),
  description       text not null default '' check (char_length(description) <= 1000),
  language          text not null default 'fr' check (language ~ '^[a-z]{2}$'),
  category          text not null default 'general'
                    check (category in ('general', 'science', 'math', 'history', 'geography', 'languages',
                                        'arts', 'sport', 'tech', 'business', 'culture', 'other')),
  cover_color       text not null default 'vermilion'
                    check (cover_color in ('vermilion', 'cobalt', 'lime', 'amber', 'teal', 'orchid')),
  cover_pattern     text not null default 'stripes'
                    check (cover_pattern in ('stripes', 'dots', 'grid', 'waves', 'zigzag', 'checker')),
  cover_image_path  text check (cover_image_path is null or char_length(cover_image_path) <= 300),
  visibility        text not null default 'private' check (visibility in ('private', 'unlisted', 'public')),
  status            text not null default 'draft' check (status in ('draft', 'published')),
  forked_from       uuid references public.quizzes (id) on delete set null,
  question_count    integer not null default 0 check (question_count >= 0),
  play_count        integer not null default 0 check (play_count >= 0),
  version           integer not null default 1,
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- A quiz can only be listed publicly once it has been published.
  constraint quizzes_public_requires_published check (visibility <> 'public' or status = 'published'),
  constraint quizzes_published_requires_title check (status <> 'published' or char_length(btrim(title)) > 0)
);

create index quizzes_owner_updated_idx on public.quizzes (owner_id, updated_at desc);
create index quizzes_public_idx on public.quizzes (published_at desc)
  where visibility = 'public' and status = 'published';
create index quizzes_public_popular_idx on public.quizzes (play_count desc)
  where visibility = 'public' and status = 'published';
create index quizzes_title_trgm_idx on public.quizzes using gin (title extensions.gin_trgm_ops);

create trigger quizzes_touch before update on public.quizzes
  for each row execute function public.touch_updated_at();

create table public.quiz_tags (
  quiz_id  uuid not null references public.quizzes (id) on delete cascade,
  tag      text not null check (tag ~ '^[a-z0-9à-ÿ][a-z0-9à-ÿ-]{0,29}$'),
  primary key (quiz_id, tag)
);
create index quiz_tags_tag_idx on public.quiz_tags (tag);

create table public.favorites (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  quiz_id     uuid not null references public.quizzes (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, quiz_id)
);
create index favorites_quiz_idx on public.favorites (quiz_id);

-- -----------------------------------------------------------------------------
-- questions — `content` holds the type-specific payload (validated by the
-- question type registry in the app and by public.question_issues() in SQL).
-- -----------------------------------------------------------------------------

create table public.questions (
  id            uuid primary key default gen_random_uuid(),
  quiz_id       uuid not null references public.quizzes (id) on delete cascade,
  position      integer not null check (position >= 0),
  type          text not null check (type in ('quiz', 'true_false', 'text', 'poll')),
  prompt        text not null default '' check (char_length(prompt) <= 500),
  media         jsonb check (media is null or jsonb_typeof(media) = 'object'),
  time_limit_s  integer not null default 20 check (time_limit_s between 5 and 240),
  points        integer not null default 1000 check (points in (0, 1000, 2000)),
  content       jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint questions_position_unique unique (quiz_id, position) deferrable initially deferred
);

create trigger questions_touch before update on public.questions
  for each row execute function public.touch_updated_at();

-- Keep quizzes.question_count in sync.
create or replace function public.sync_question_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(new.quiz_id, old.quiz_id);
begin
  update public.quizzes q
     set question_count = (select count(*) from public.questions where quiz_id = target)
   where q.id = target;
  return null;
end;
$$;

create trigger questions_count_sync after insert or delete on public.questions
  for each row execute function public.sync_question_count();

-- -----------------------------------------------------------------------------
-- Live games
-- -----------------------------------------------------------------------------

create table public.game_sessions (
  id                 uuid primary key default gen_random_uuid(),
  quiz_id            uuid references public.quizzes (id) on delete set null,
  host_id            uuid not null references public.profiles (id) on delete cascade,
  quiz_title         text not null,
  pin                text not null check (pin ~ '^[0-9]{6}$'),
  state              text not null default 'LOBBY'
                     check (state in ('LOBBY', 'QUESTION_INTRO', 'QUESTION_ACTIVE', 'QUESTION_RESULTS',
                                      'LEADERBOARD', 'FINAL_RESULTS', 'FINISHED')),
  current_index      integer not null default -1,
  question_count     integer not null check (question_count > 0),
  phase_started_at   timestamptz not null default now(),
  question_deadline  timestamptz,
  max_players        integer not null default 200 check (max_players between 1 and 500),
  allow_late_join    boolean not null default true,
  locked             boolean not null default false,
  started_at         timestamptz,
  ended_at           timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint game_sessions_index_range check (current_index between -1 and question_count - 1),
  constraint game_sessions_active_has_deadline check (state <> 'QUESTION_ACTIVE' or question_deadline is not null)
);

-- A PIN is only reserved while its game is still running.
create unique index game_sessions_live_pin_idx on public.game_sessions (pin) where state <> 'FINISHED';
create index game_sessions_host_idx on public.game_sessions (host_id, created_at desc);
create index game_sessions_quiz_idx on public.game_sessions (quiz_id);

create trigger game_sessions_touch before update on public.game_sessions
  for each row execute function public.touch_updated_at();

-- Frozen copy of the quiz questions at launch time: editing a quiz never
-- alters a running game or the results of a past one.
create table public.game_questions (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid not null references public.game_sessions (id) on delete cascade,
  position            integer not null check (position >= 0),
  source_question_id  uuid references public.questions (id) on delete set null,
  type                text not null,
  prompt              text not null,
  media               jsonb,
  time_limit_s        integer not null,
  points              integer not null,
  content             jsonb not null,
  unique (session_id, position)
);

create table public.players (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.game_sessions (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  nickname          text not null check (char_length(nickname) between 1 and 24),
  avatar            text not null default 'vermilion'
                    check (avatar in ('vermilion', 'cobalt', 'lime', 'amber', 'teal', 'orchid')),
  status            text not null default 'active' check (status in ('active', 'left', 'kicked')),
  score             integer not null default 0,
  last_points       integer not null default 0,
  rank              integer,
  previous_rank     integer,
  streak            integer not null default 0,
  correct_count     integer not null default 0,
  joined_at         timestamptz not null default now(),
  unique (session_id, user_id)
);

create unique index players_nickname_idx on public.players (session_id, lower(nickname))
  where status <> 'kicked';
create index players_user_idx on public.players (user_id);

create table public.player_answers (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.game_sessions (id) on delete cascade,
  game_question_id  uuid not null references public.game_questions (id) on delete cascade,
  player_id         uuid not null references public.players (id) on delete cascade,
  answer            jsonb not null,
  is_correct        boolean,
  points            integer not null default 0 check (points >= 0),
  elapsed_ms        integer not null check (elapsed_ms >= 0),
  submitted_at      timestamptz not null default now(),
  -- The single guarantee against double answers, whatever the client does.
  constraint player_answers_once unique (game_question_id, player_id)
);

create index player_answers_session_idx on public.player_answers (session_id, game_question_id);

-- -----------------------------------------------------------------------------
-- Membership helpers (security definer to avoid recursive RLS)
-- -----------------------------------------------------------------------------

create or replace function public.is_session_host(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.game_sessions s
     where s.id = p_session_id and s.host_id = (select auth.uid())
  );
$$;

create or replace function public.is_session_player(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.players p
     where p.session_id = p_session_id
       and p.user_id = (select auth.uid())
       and p.status <> 'kicked'
  );
$$;

create or replace function public.can_read_quiz(p_quiz_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.quizzes q
     where q.id = p_quiz_id
       and (q.owner_id = (select auth.uid())
            or (q.status = 'published' and q.visibility in ('public', 'unlisted')))
  );
$$;

create or replace function public.owns_quiz(p_quiz_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.quizzes q where q.id = p_quiz_id and q.owner_id = (select auth.uid())
  );
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.quizzes        enable row level security;
alter table public.quiz_tags      enable row level security;
alter table public.favorites      enable row level security;
alter table public.questions      enable row level security;
alter table public.game_sessions  enable row level security;
alter table public.game_questions enable row level security;
alter table public.players        enable row level security;
alter table public.player_answers enable row level security;

-- Start from zero: nothing is reachable unless explicitly granted below.
revoke all on public.profiles, public.quizzes, public.quiz_tags, public.favorites, public.questions,
  public.game_sessions, public.game_questions, public.players, public.player_answers
  from anon, authenticated;

-- profiles: your own, plus authors of publicly listed quizzes (name only matters).
grant select on public.profiles to anon, authenticated;
grant update (display_name, avatar_color, locale) on public.profiles to authenticated;

create policy profiles_select on public.profiles for select to anon, authenticated
  using (
    id = (select auth.uid())
    or exists (select 1 from public.quizzes q
                where q.owner_id = profiles.id and q.visibility = 'public' and q.status = 'published')
  );
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- quizzes: owners do everything; others only read published public/unlisted ones.
grant select on public.quizzes to anon, authenticated;
grant insert (title, description, language, category, cover_color, cover_pattern, cover_image_path,
              visibility, status) on public.quizzes to authenticated;
grant update (title, description, language, category, cover_color, cover_pattern, cover_image_path,
              visibility, status, published_at) on public.quizzes to authenticated;
grant delete on public.quizzes to authenticated;

alter table public.quizzes alter column owner_id set default auth.uid();

create policy quizzes_select on public.quizzes for select to anon, authenticated
  using (
    owner_id = (select auth.uid())
    or (status = 'published' and visibility in ('public', 'unlisted'))
  );
create policy quizzes_insert_own on public.quizzes for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy quizzes_update_own on public.quizzes for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy quizzes_delete_own on public.quizzes for delete to authenticated
  using (owner_id = (select auth.uid()));

-- quiz_tags follow their quiz.
grant select on public.quiz_tags to anon, authenticated;
grant insert, delete on public.quiz_tags to authenticated;

create policy quiz_tags_select on public.quiz_tags for select to anon, authenticated
  using (public.can_read_quiz(quiz_id));
create policy quiz_tags_write on public.quiz_tags for insert to authenticated
  with check (public.owns_quiz(quiz_id));
create policy quiz_tags_delete on public.quiz_tags for delete to authenticated
  using (public.owns_quiz(quiz_id));

-- favorites: strictly personal.
grant select, insert, delete on public.favorites to authenticated;

create policy favorites_own on public.favorites for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.can_read_quiz(quiz_id));

alter table public.favorites alter column user_id set default auth.uid();

-- questions: readable with the quiz (answers included — players never read
-- this table, they get a sanitized question through get_player_view()).
grant select on public.questions to anon, authenticated;
grant insert, update, delete on public.questions to authenticated;

create policy questions_select on public.questions for select to anon, authenticated
  using (public.can_read_quiz(quiz_id));
create policy questions_insert on public.questions for insert to authenticated
  with check (public.owns_quiz(quiz_id));
create policy questions_update on public.questions for update to authenticated
  using (public.owns_quiz(quiz_id)) with check (public.owns_quiz(quiz_id));
create policy questions_delete on public.questions for delete to authenticated
  using (public.owns_quiz(quiz_id));

-- game_sessions: host and players of that session can read. All writes go
-- through security-definer RPCs that enforce the state machine.
grant select on public.game_sessions to authenticated;

create policy game_sessions_select on public.game_sessions for select to authenticated
  using (host_id = (select auth.uid()) or public.is_session_player(id));

-- The host may delete a game and its results (cascades to players & answers).
grant delete on public.game_sessions to authenticated;
create policy game_sessions_delete_host on public.game_sessions for delete to authenticated
  using (host_id = (select auth.uid()));

-- game_questions: host only (they contain the correct answers).
grant select on public.game_questions to authenticated;

create policy game_questions_select_host on public.game_questions for select to authenticated
  using (public.is_session_host(session_id));

-- players: everyone in the session sees the roster and scores.
grant select on public.players to authenticated;

create policy players_select on public.players for select to authenticated
  using (public.is_session_host(session_id) or public.is_session_player(session_id));

-- player_answers: host only. A player learns about their own answer through
-- get_player_view(), and only once the host has revealed the results.
grant select on public.player_answers to authenticated;

create policy player_answers_select_host on public.player_answers for select to authenticated
  using (public.is_session_host(session_id));

-- -----------------------------------------------------------------------------
-- Realtime
-- -----------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.game_sessions, public.players, public.player_answers;
  end if;
end;
$$;
