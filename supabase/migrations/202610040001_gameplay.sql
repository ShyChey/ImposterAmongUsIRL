-- Run this migration in the Supabase SQL editor (or with the Supabase CLI).
-- It keeps the original tables and adds the state required for meetings and voting.
alter table public.players add column if not exists disconnected_at timestamptz;

alter table public.game_state add column if not exists meeting_ends_at timestamptz;
alter table public.game_state add column if not exists winner text;
alter table public.game_state add column if not exists discord_url text;
alter table public.game_state add column if not exists last_ejection_name text;
alter table public.game_state add column if not exists last_ejection_role text;

create table if not exists public.meeting_votes (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid not null references public.players(id) on delete cascade,
  target_id uuid references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (voter_id)
);

-- Supports the upsert used for each player's one active vote, even if this
-- table was created by an earlier partial setup.
create unique index if not exists meeting_votes_unique_voter_id
  on public.meeting_votes (voter_id);

-- Names are identities for a running lobby. The client also validates this for
-- a friendlier error, while this index closes races between simultaneous joins.
create unique index if not exists players_unique_name
  on public.players (name);

alter table public.meeting_votes enable row level security;
drop policy if exists "meeting votes are readable" on public.meeting_votes;
drop policy if exists "players can cast votes" on public.meeting_votes;
drop policy if exists "players can change votes" on public.meeting_votes;
drop policy if exists "votes can be cleared" on public.meeting_votes;
create policy "meeting votes are readable" on public.meeting_votes for select using (true);
create policy "players can cast votes" on public.meeting_votes for insert with check (true);
create policy "players can change votes" on public.meeting_votes for update using (true);
create policy "votes can be cleared" on public.meeting_votes for delete using (true);

do $$ begin
  alter publication supabase_realtime add table public.meeting_votes;
exception when duplicate_object then null;
end $$;
