-- The original game_state status constraint only permits the first three
-- states. Meetings now use an outcome screen and games use an end screen.
alter table public.game_state drop constraint if exists game_state_status_check;

alter table public.game_state
  add constraint game_state_status_check
  check (status in ('lobby', 'playing', 'meeting', 'meeting_results', 'ended'));
