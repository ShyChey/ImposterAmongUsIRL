-- Shared, timed outcome screens for meetings and completed games.
alter table public.game_state add column if not exists vote_summary jsonb;
alter table public.game_state add column if not exists results_ends_at timestamptz;
