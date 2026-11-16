-- Two splits side by side: the weekly split (program days 1–6, Mon–Sat)
-- and the rotating cycle (program days 11–15, Upper → Lower → Push → Pull
-- → Legs). program_mode picks the active one. Includes 0017, so it runs
-- whether or not 0017 was run first, and can be re-run.
--
-- A cycle imported by the previous version sat on days 1–5 (on top of the
-- weekly split); it moves to 11–15 here, with its sessions, day names and
-- finishers. Nothing is deleted. Re-import the weekly split's file to
-- bring its Mon–Fri days back.

alter table public.fitness_settings add column if not exists program_mode text not null default 'weekday';
alter table public.fitness_settings drop constraint if exists fitness_settings_program_mode_check;
alter table public.fitness_settings add constraint fitness_settings_program_mode_check check (program_mode in ('weekday', 'cycle'));
-- The cycle's own start (the weekly split keeps rotation_start for its V1 week).
alter table public.fitness_settings add column if not exists cycle_start date;

alter table public.program_slots drop constraint if exists program_slots_weekday_check;
alter table public.program_slots add constraint program_slots_weekday_check check (weekday between 1 and 6 or weekday between 11 and 15);
alter table public.program_slots drop constraint if exists program_slots_slot_check;
alter table public.program_slots add constraint program_slots_slot_check check (slot between 1 and 6);

alter table public.workout_sessions drop constraint if exists workout_sessions_program_weekday_check;
alter table public.workout_sessions add constraint workout_sessions_program_weekday_check check (program_weekday between 1 and 6 or program_weekday between 11 and 15);

alter table public.workout_sets drop constraint if exists workout_sets_slot_check;
alter table public.workout_sets add constraint workout_sets_slot_check check (slot between 1 and 41);

-- Move a cycle from days 1–5 to 11–15 (only for users whose cycle is active
-- and has never been moved: no cycle_start yet).
update public.workout_sessions s
   set program_weekday = s.program_weekday + 10
  from public.fitness_settings f
 where f.user_id = s.user_id and f.program_mode = 'cycle' and f.cycle_start is null
   and s.day >= f.rotation_start and s.program_weekday between 1 and 5;

update public.program_slots p
   set weekday = p.weekday + 10
  from public.fitness_settings f
 where f.user_id = p.user_id and f.program_mode = 'cycle' and f.cycle_start is null
   and p.weekday between 1 and 5
   and not exists (select 1 from public.program_slots q where q.user_id = p.user_id and q.weekday = p.weekday + 10 and q.slot = p.slot);

update public.fitness_settings
   set day_focus = coalesce((select jsonb_object_agg(case when key ~ '^[1-5]$' then (key::int + 10)::text else key end, value) from jsonb_each(day_focus)), '{}'::jsonb),
       finishers = coalesce((select jsonb_agg(jsonb_set(f, '{days}', coalesce((select jsonb_agg(case when d::int between 1 and 5 then d::int + 10 else d::int end) from jsonb_array_elements_text(f -> 'days') d), '[]'::jsonb))) from jsonb_array_elements(finishers) f), '[]'::jsonb),
       cycle_start = rotation_start
 where program_mode = 'cycle' and cycle_start is null;
