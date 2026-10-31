-- Gym timer: when a session started and how long it took. Additive only;
-- past sessions simply have no time. `duration_sec` is null while running,
-- so an open session survives the app being closed.

alter table public.workout_sessions
  add column if not exists started_at   timestamptz,
  add column if not exists duration_sec integer check (duration_sec is null or duration_sec between 0 and 86400);
