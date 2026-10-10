-- A killed body may trigger one meeting only.  Once a meeting begins, bodies
-- from the prior round are cleared and cannot be reported again.
alter table public.players
  add column if not exists body_reported_at timestamptz;
