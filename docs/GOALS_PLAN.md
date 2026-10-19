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
2. **Timeline:** dated checkpoints generated from the phase (baseline, first
   check, monthly reviews, end of bulk, mini-cut, end state), plus your own
   milestones. It also shows:
   - meal-plan completions;
   - extension achievements carried over;
   - one-off goals reached;
   - best streaks.
3. **Integration:**
   - goals on Home and in Today's "due" list;
   - a goals section in the Markdown report;
   - goals in the nutrition backup.
