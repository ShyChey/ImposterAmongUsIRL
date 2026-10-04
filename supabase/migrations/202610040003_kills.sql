-- Per-imposter cooldowns and persistent reportable bodies.
alter table public.players add column if not exists kill_available_at timestamptz;
alter table public.players add column if not exists killed_at timestamptz;
alter table public.players add column if not exists death_kind text;
