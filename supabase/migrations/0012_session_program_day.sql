-- Train any day's program on any day (e.g. Tuesday's Back + Biceps on a
-- Monday). workout_sessions.program_weekday = whose program was trained
-- (Mon = 1 … Sat = 6); null = the calendar day's own program, which is what
-- every existing session already means. Additive only.

alter table public.workout_sessions
  add column if not exists program_weekday smallint check (program_weekday between 1 and 6);
