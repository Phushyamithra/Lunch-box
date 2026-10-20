# GOALS_PLAN.md — Phase 5

## Audit (2026-10-19)

- **Extension achievements:** these were one-time timestamps (`days_goal`,
  `balance`, `nutrition_champion`, `category_*`). They were imported, kept
  verbatim, into `food_settings.legacy_achievements`. They have no cycles.
- **Meal plans:** completions already live in `meal_plans.completed_at`
  (quota met or forced).
- **The reference file's goals** were scattered as rules, not stored:
  - train 6 days;
  - weigh in 3 mornings or evenings a week;
  - incline cardio 2–3 times a week;
  - 10k steps;
  - waist every fortnight;
  - a gain rate of 0.2–0.6 kg a month;
  - monthly photos in natural light;
  - the check-in timeline (baseline, first check, end of bulk, mini-cut,
    end state).
- **No conflicts with stored data.** Nothing existing is changed;
  migration `0014_goals.sql` only adds tables.

## Design

- **Progress is derived, never stored.** Each cycle (day, week or month)
  is measured from the logs every time, so editing or archiving a goal
  can't erase history.
- **Target changes are dated versions.** A change applies from that day,
  and earlier cycles keep their own target.
- **Neutral cycles:**
  - away periods;
  - the first cycle, if the goal started partway through it;
  - cycles with no data (such as steps not entered).

  These never count as missed and never break a streak.
- **Manual check-ins:** these are for things the app can't see, like photos
  in natural light. There is one per cycle, and a soft delete lets you undo.
- **Metrics:**
  - Fitness: sessions, weigh-in days, waist, cardio, step days, gain rate
    in band, weekly average reaching a weight, key lift reaching a weight.
  - Nutrition: fully logged days, days on calories, days at the protein
    minimum.
  - Meal prep: meals logged.
  - Manual check-ins.
- **Suggested goals** come from the reference routine and start at the
  phase start, so past weeks show right away.

## Stages

1. **Done:** the engine (`goals/engine.ts`, tested), migration 0014, and
   the Goals page:
   - cards with this cycle's progress, history dots, streaks and best run;
   - check-ins;
   - new and edit dialogs, with versioned targets and archive or restore;
   - suggestions from your plan.
2. **Done — Timeline** (`goals/timeline.ts`, tested; Goals → Timeline):
   - "Lay out your phase" adds editable checkpoints from Fitness settings:
     baseline (marked done once weighed), first real check, end of bulk,
     mini-cut, end state. Long-range dates are approximate.
   - Monthly reviews are derived: past ones carry the gain reading at
     that date, and only the next one shows ahead. The next waist check
     comes from the interval.
   - Your own checkpoints (planned, approximate, mark done) and
     achievements; removing archives them.
   - Coming up / So far, with All / Plan / Wins filters. It also shows:
   - meal-plan completions;
   - extension achievements carried over;
   - one-off goals reached;
   - best streaks.
3. **Done — Integration** (`goals/digest.ts`, tested):
   - **Home:** the Goals card shows goals met this cycle, the best live
     streak and the next dated item. A "Goals" strip (also on Fitness →
     Today) lists:
     - check-ins near the end of their cycle (tap to tick);
     - checkpoints due today or passed in the last 14 days (tap to mark
       done);
     - counted goals that can no longer be met this cycle.
   - **Markdown report:** a new Part 5 — Goals covers the cycles met or
     missed in the period, streaks, the timeline in the period and what's
     coming. It's a fifth checkbox.
   - **Backup:** goals aren't in the nutrition backup, which stays
     nutrition-only. A goals backup can come with the Phase 7 app-wide
     backup.
