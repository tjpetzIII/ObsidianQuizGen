-- Run this in your Supabase SQL editor to set up the database

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  repo_owner text,
  repo_name text,
  file_prefix text default 'LN',
  created_at timestamptz default now()
);

-- Quizzes
create table if not exists public.quizzes (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  source_files jsonb default '[]',
  hours_lookback integer not null default 24,
  status text not null default 'generating',
  error_message text,
  created_at timestamptz not null,
  generated_at timestamptz
);

-- Questions
create table if not exists public.questions (
  id uuid primary key,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_text text not null,
  question_type text not null,
  choices jsonb,
  correct_answer text not null,
  explanation text,
  source_file text,
  position integer not null default 0,
  created_at timestamptz default now()
);

-- Attempts
create table if not exists public.attempts (
  id uuid primary key,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'in_progress',
  score numeric,
  started_at timestamptz not null,
  completed_at timestamptz
);

-- Answers
create table if not exists public.answers (
  id uuid primary key,
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  user_answer text not null,
  is_correct boolean,
  ai_feedback text,
  grading_status text not null default 'pending',
  submitted_at timestamptz not null
);

-- Trigger: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.attempts enable row level security;
alter table public.answers enable row level security;

create policy "Users manage own profile" on public.profiles
  for all using (auth.uid() = id);

create policy "Users manage own quizzes" on public.quizzes
  for all using (auth.uid() = user_id);

create policy "Users read questions of own quizzes" on public.questions
  for select using (
    exists (select 1 from public.quizzes where id = quiz_id and user_id = auth.uid())
  );

create policy "Users manage own attempts" on public.attempts
  for all using (auth.uid() = user_id);

create policy "Users manage own answers" on public.answers
  for all using (
    exists (select 1 from public.attempts where id = attempt_id and user_id = auth.uid())
  );
