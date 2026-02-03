create extension if not exists pgcrypto;

create table if not exists public.leaderboard_scores (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  high_score integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.leaderboard_scores enable row level security;

create policy "Leaderboard read access" on public.leaderboard_scores
  for select
  using (true);

create or replace function public.upsert_high_score(
  p_username text,
  p_score integer
)
returns void
language plpgsql
as $$
begin
  insert into public.leaderboard_scores (username, high_score, updated_at)
  values (p_username, p_score, now())
  on conflict (username)
  do update set
    high_score = greatest(leaderboard_scores.high_score, excluded.high_score),
    updated_at = case
      when excluded.high_score > leaderboard_scores.high_score then now()
      else leaderboard_scores.updated_at
    end;
end;
$$;
