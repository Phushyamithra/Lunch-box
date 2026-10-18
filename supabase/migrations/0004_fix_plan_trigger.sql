-- Fixes "record "new" has no field "meal_id"" when starting a plan.
--
-- The 0003 trigger function combined the table-name test and the column
-- reference in a single condition. PL/pgSQL plans that whole expression
-- at once, so on meal_plan_quotas (which has no meal_id) the reference
-- itself failed. Each table now has its own branch, so a column is only
-- touched for the table that has it.

create or replace function public.food_check_plan_ownership() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.plan_id is not null then
    if not exists (select 1 from public.meal_plans p where p.id = new.plan_id and p.user_id = new.user_id) then
      raise exception 'plan does not belong to this user';
    end if;
  end if;

  if tg_table_name = 'meal_plan_quotas' then
    if not exists (select 1 from public.food_categories c where c.id = new.category_id and c.user_id = new.user_id) then
      raise exception 'category does not belong to this user';
    end if;
  elsif tg_table_name = 'meal_plan_item_caps' then
    if not exists (select 1 from public.meals m where m.id = new.meal_id and m.user_id = new.user_id) then
      raise exception 'meal does not belong to this user';
    end if;
  end if;

  return new;
end $$;

-- Optional clean-up. Failed "Start plan" attempts before this fix left
-- empty plans behind: no quotas, no caps, no logs. The query below lists
-- them. They are hidden in the app; to remove them, run the DELETE too.
--
--   select id, name, created_at from public.meal_plans p
--   where not exists (select 1 from public.meal_plan_quotas q where q.plan_id = p.id)
--     and not exists (select 1 from public.meal_logs l where l.plan_id = p.id);
--
--   delete from public.meal_plans p
--   where not exists (select 1 from public.meal_plan_quotas q where q.plan_id = p.id)
--     and not exists (select 1 from public.meal_logs l where l.plan_id = p.id);
