import { parseReference, type ParsedReference } from './referenceImport';

/**
 * The classic Mon–Sat split (Chest + Triceps, Back + Biceps, Legs: quad,
 * Shoulders + Arms, Chest + Shoulders, Legs: posterior), five slots a day
 * with seven variants each (default / fallback), plus its Abs and Forearms
 * finishers. Kept in the app so it can be loaded without the old reference
 * file. Training tables only: no targets, dates or body numbers.
 */
export const CLASSIC_WEEKLY_MD = `# PART 2 — TRAINING

## MONDAY — CHEST + TRICEPS
**3 / 3 / 2 / 3 / 2 = 13 sets** · finisher: Abs

| # | Target | Sets | This week |
|---|---|---|---|
| 1 | Mid Chest | 3 | |
| 2 | Upper Chest | 3 | |
| 3 | Chest Isolation | 2 | |
| 4 | Triceps Compound | 3 | |
| 5 | Triceps Isolation | 2 | |

<details><summary><b>Variant bank — Monday</b></summary>

| # | V1 | V2 | V3 | V4 | V5 | V6 | V7 |
|---|----|----|----|----|----|----|-----|
| 1 | Barbell Bench / DB Bench | DB Bench / Flat Barbell | Machine Chest Press / Wide Chest Press | Flat DB Press / Barbell Bench | Wide Chest Press / Machine Press | Decline Barbell / Flat DB Press | Barbell Bench / Wide Chest Press |
| 2 | Incline DB Press / Incline Barbell | Incline Barbell / Decline Barbell | Incline DB Fly / Low-High Cable | Incline Barbell / Machine Chest | Incline DB Press / Incline Cable Fly | Incline DB Press / Incline Barbell | Machine Chest Press / Incline Barbell |
| 3 | Pec-Dec Fly / Cable Fly | Cable Crossover / Pec-Dec | Cable Fly / Pec-Dec | Pec-Dec / Low-High Cable | Cable Crossover / DB Fly | Pec-Dec / High-Low Cable | Low-High Cable / Pec-Dec |
| 4 | Close-Grip Bench / Dips | Skullcrushers / Overhead DB Ext | Dips / Close-Grip Bench | Skullcrushers / Dips | Overhead DB Ext / Close-Grip Bench | Close-Grip Bench / Skullcrushers | Parallel Bar Dips / Close-Grip Bench |
| 5 | Rope Pressdown / V-Bar | V-Bar / Rope Pressdown | Overhead DB Ext / Skullcrushers | Cable Rope Pressdown / V-Bar | Skullcrushers / V-Bar | Rope Pressdown / Overhead DB Ext | V-Bar / Skullcrushers |

</details>

---

## TUESDAY — BACK + BICEPS
**3 / 3 / 3 / 2 / 2 = 13 sets** · finisher: Forearms (see grip note)
*Back gets the highest volume — largest muscle, tolerates the most.*

| # | Target | Sets | This week |
|---|---|---|---|
| 1 | Vertical Pull | 3 | |
| 2 | Row — Thickness | 3 | |
| 3 | Upper Back | 3 | |
| 4 | Rear Delt | 2 | |
| 5 | Biceps | 2 | |

<details><summary><b>Variant bank — Tuesday</b></summary>

| # | V1 | V2 | V3 | V4 | V5 | V6 | V7 |
|---|----|----|----|----|----|----|-----|
| 1 | Pull-ups / Wide Lat Pulldown | Lat Pulldown / Chin-ups | Chin-ups / Close-Grip Lat Pull | Neutral-Grip Pull-ups / Lat Pulldown | Barbell Deadlift / Romanian DL | Wide Lat Pulldown / Pull-ups | Neutral Pull-ups / Lat Pulldown |
| 2 | Bent-Over Barbell Row / T-Bar | Single-Arm DB Row / Meadows Row | Barbell Row / DB Bent-Over Row | Rack Pulls / Deadlift | T-Bar Row / Single-Arm Cable Row | Seated Cable Row Wide / Barbell Row | Single-Arm DB Row / T-Bar Row |
| 3 | T-Bar Row / Machine Row | Seated Cable Row / Chest-Supported Row | Machine Row / Cable Row | Chest-Supported Row / Machine Row | Lat Pulldown / Pull-ups | Chest-Supported Row / Cable Row | Barbell Row / Seated Machine Row |
| 4 | Face Pulls / Rear Delt Fly | Cable Face Pull / Barbell Shrugs | DB Rear Delt Fly / Upright Row | Cable Face Pull / DB Shrugs | DB Rear Delt Fly / Face Pulls | Face Pulls / DB Shrugs | Rear Delt Cable Fly / Barbell Shrugs |
| 5 | EZ-Bar Curl / DB Hammer | Preacher Curl / Incline DB Curl | Hammer Curl / EZ-Bar Cable | Incline 50° Curl / Machine Preacher | Cable Biceps Curl / DB Curl | EZ-Bar Cable Curl / Alt DB Curl | Barbell Curl / Preacher DB Curl |

</details>

---

## WEDNESDAY — LEGS: QUAD DOMINANT
**3 / 3 / 3 / 2 / 2 = 13 sets** · finisher: Abs

| # | Target | Sets | This week |
|---|---|---|---|
| 1 | Squat Compound | 3 | |
| 2 | Quad | 3 | |
| 3 | Hamstring | 3 | |
| 4 | Unilateral | 2 | |
| 5 | Calves | 2 | |

<details><summary><b>Variant bank — Wednesday</b></summary>

| # | V1 | V2 | V3 | V4 | V5 | V6 | V7 |
|---|----|----|----|----|----|----|-----|
| 1 | Barbell Squat / Leg Press | Front Squat / Goblet Squat | Leg Press / Barbell Squat | Hack Squat / Front Squat | Barbell Squat / Goblet Squat | DB Sumo Squat / Leg Press | Front Squat / Smith Squat |
| 2 | Leg Extension / Hack Squat | Hack Squat / Leg Press | Leg Extension / Front Squat | DB Goblet Squat / Leg Press | Front Squat / Leg Press | Leg Extension / Single-Leg Ext | Leg Press / Hack Squat |
| 3 | Romanian DL / Lying Leg Curl | Lying Leg Curl / Romanian DL | Single-Leg RDL / Good Mornings | Romanian DL / Cable Ham Curl | Glute Ham Raise / Romanian DL | Seated Leg Curl / Lying Leg Curl | Romanian DL / Barbell Deadlift |
| 4 | Walking Lunges / Bulgarian Split | DB Lunges / Step-ups | Bulgarian Split / Walking Lunges | DB Step-ups / Bulgarians | Walking Lunges / Reverse Lunge | Bulgarians / Lunges | Step-ups / Reverse Lunge |
| 5 | Standing Calf / Seated Calf | Seated Calf / Standing Calf | Calf Press / Standing Calf | Donkey Calf / Standing Calf | Standing Calf / Seated Calf | Standing Calf / Donkey Calf | Calf Press / Seated Calf |

</details>

---

## THURSDAY — SHOULDERS + ARMS
**3 / 3 / 2 / 2 / 2 = 12 sets** · finisher: Forearms

| # | Target | Sets | This week |
|---|---|---|---|
| 1 | Front Delt | 3 | |
| 2 | Side Delt | 3 | |
| 3 | Biceps Mass | 2 | |
| 4 | Triceps | 2 | |
| 5 | Biceps Iso / Forearm | 2 | |

<details><summary><b>Variant bank — Thursday</b></summary>

| # | V1 | V2 | V3 | V4 | V5 | V6 | V7 |
|---|----|----|----|----|----|----|-----|
| 1 | Military Press / Arnold | DB Shoulder Press / Machine | Arnold Press / Standing DB | Machine Shoulder Press / Arnold | Standing Barbell Press / DB | Seated DB Arnold / Military | Machine Shoulder / DB Seated |
| 2 | DB Lateral / Cable Lateral | Cable Lateral / Plate Raise | Machine Lateral / DB Lateral | DB Front Raise / Lateral | Upright Row / DB Lateral | Cable Lateral / Upright Row | DB Lateral / Machine Lateral |
| 3 | EZ-Bar Curl / DB Hammer | Incline 50° Curl / DB Hammer | Barbell Curl / EZ-Bar Cable | EZ-Bar Cable Curl / DB Curl | Incline 50° Curl / DB Hammer | Barbell Curl / Cable Curl | Machine Preacher / EZ-Bar Cable |
| 4 | Rope Pressdown / Skullcrushers | Skullcrushers / Overhead DB | Parallel Dips / Close-Grip | Overhead DB Ext / Rope | Bench Dips / Parallel Dips | Close-Grip Bench / Dips | Rope Pressdown / V-Bar |
| 5 | Preacher Curl / Incline DB | Concentration / Machine Preacher | V-Bar / Rope Pressdown | Reverse Curl / Wrist Roller | Skullcrushers / Overhead DB | Spider Curl / Preacher DB | Wrist Roller / Reverse Curl |

</details>

---

## FRIDAY — CHEST + SHOULDERS
**3 / 2 / 3 / 2 / 2 = 12 sets** · finisher: Abs
*Different angles from Monday — upper chest and isolation emphasis.*

| # | Target | Sets | This week |
|---|---|---|---|
| 1 | Chest Compound | 3 | |
| 2 | Chest Isolation | 2 | |
| 3 | Front Delt | 3 | |
| 4 | Side Delt | 2 | |
| 5 | Rear Delt | 2 | |

<details><summary><b>Variant bank — Friday</b></summary>

| # | V1 | V2 | V3 | V4 | V5 | V6 | V7 |
|---|----|----|----|----|----|----|-----|
| 1 | Incline Barbell / Incline DB | Machine Chest Press / Wide Chest | Incline Barbell / Flat DB | Flat Barbell / DB Press | Wide Chest Press / Machine | Incline DB / Incline Barbell | DB Bench / Flat Barbell |
| 2 | Pec-Dec / Cable Fly | Low-High Cable / Incline DB Fly | Cable Crossover / Pec-Dec | Cable Fly / High-Low Cable | Incline DB Fly / Low-High Cable | Pec-Dec / Cable Crossover | Low-High Cable / Pec-Dec |
| 3 | Military Press / Arnold | DB Shoulder Press / Machine | Arnold Press / DB Arnold | Machine Shoulder Press / DB | Standing Barbell Press / Arnold | Seated DB Arnold / Military | Machine Shoulder / DB Seated |
| 4 | DB Lateral / Cable Lateral | Cable Lateral / Plate Raise | Machine Lateral / DB Lateral | DB Front Raise / Lateral | Upright Row / DB Lateral | Cable Lateral / Upright Row | Machine Lateral / Cable Lateral |
| 5 | Face Pulls / Rear Delt Fly | DB Rear Delt Fly / Upright Row | Rear Delt Cable Fly / Face Pull | Barbell Shrugs / Face Pulls | Reverse Pec-Dec / Face Pull | DB Rear Delt Fly / Shrugs | Face Pulls / DB Rear Delt Fly |

</details>

---

## SATURDAY — LEGS: POSTERIOR CHAIN
**3 / 3 / 3 / 2 / 2 = 13 sets** · finisher: Forearms

| # | Target | Sets | This week |
|---|---|---|---|
| 1 | Hip Hinge | 3 | |
| 2 | Glutes | 3 | |
| 3 | Hamstring Iso | 3 | |
| 4 | Quad Secondary | 2 | |
| 5 | Calves | 2 | |

<details><summary><b>Variant bank — Saturday</b></summary>

| # | V1 | V2 | V3 | V4 | V5 | V6 | V7 |
|---|----|----|----|----|----|----|-----|
| 1 | Romanian DL / Straight-Leg DL | Sumo Deadlift / Conventional | Barbell Deadlift / Romanian DL | Romanian DL / Stiff-Leg | Sumo Deadlift / Conventional | Romanian DL / Cable Pull-Through | Barbell Deadlift / Romanian DL |
| 2 | Hip Thrust / Glute Bridge | Cable Hip Thrust / Glute Bridge | Hip Thrust / Cable Pull-Through | Glute Bridge / Hip Thrust | Hip Thrust / DB Sumo Squat | Glute Bridge / Hip Thrust | Cable Hip Thrust / Glute Bridge |
| 3 | Lying Leg Curl / Seated Curl | Glute Ham Raise / Lying Curl | Seated Curl / Glute Ham Raise | Cable Ham Curl / Lying Curl | Lying Leg Curl / Romanian DL | Glute Ham Raise / Seated Curl | Lying Curl / Seated Curl |
| 4 | Barbell Squat / Leg Press | Hack Squat / Leg Press | Leg Press / DB Sumo Squat | Bulgarian Split / Walking Lunges | Front Squat / Goblet Squat | Single-Leg RDL / Bulgarian | Walking Lunges / Step-ups |
| 5 | Donkey Calf / Standing Calf | Single-Leg RDL / Good Mornings | Standing Calf / Calf Press | Donkey Calf / Seated Calf | Seated Calf / Standing Calf | Calf Press / Donkey Calf | Standing Calf / Donkey Calf |

</details>

---

## FINISHERS

### Abs — Mon / Wed / Fri (~8 sets, ~24/week)

| Exercise | Sets | Reps |
|---|---|---|
| Weighted Cable Crunch | 3 | 10–15 |
| Hanging Leg Raise (weighted if possible) | 3 | 10–15 |
| Weighted Decline Crunch | 2 | 12–15 |


### Forearms — Tue / Thu / Sat

| Exercise | Sets | Reps / Duration |
|---|---|---|
| Wrist Roller | 2 | To failure |
| Reverse Barbell Curl | 2 | 12–15 |
| Farmer's Carry / Plate Pinch | 2 | 30–40 sec |
`;

/** The classic split, parsed for import. It never changes targets or the phase start. */
export function classicWeekly(): ParsedReference {
  const parsed = parseReference(CLASSIC_WEEKLY_MD);
  return { ...parsed, baselineDate: null, stepsTarget: null, phaseMonths: null };
}

/**
 * The current rotating split (Upper → Lower → Push → Pull → Legs, any
 * weekday), five or six slots a day with six variants each, plus its Abs and
 * Forearms finishers. Tables only, as above.
 */
export const ROTATING_CYCLE_MD = `## THE ROTATION

| Order | Day | Focus | Sets | Finisher |
|-----|-------|------|------|----------|
| 1 | **Upper** | Chest + Back + Shoulders + Arms (lighter, frequency top-up) | 14 | Abs |
| 2 | **Lower** | Quads + Hamstrings + Glutes + Calves (secondary leg day) | 12 | Forearms |
| 3 | **Push** | Chest + Shoulders + Triceps (the heavy chest day) | 16 | Abs |
| 4 | **Pull** | Back + Biceps + Forearms (the heavy back day) | 15 | — *(forearm slot built in)* |
| 5 | **Legs** | Full lower body — quads, hams, glutes, calves (the heavy leg day) | 14 | Abs |

# PART 2 — TRAINING

## DAY 1 — UPPER
**3 / 3 / 2 / 2 / 2 / 2 = 14 sets** · finisher: Abs

| # | Target | Sets | This cycle |
|---|---|---|---|
| 1 | Chest (incline-biased) | 3 | |
| 2 | Back — Row | 3 | |
| 3 | Shoulder Press | 2 | |
| 4 | Back — Vertical / Pull-up skill work | 2 | |
| 5 | Biceps | 2 | |
| 6 | Triceps | 2 | |

<details><summary><b>Variant bank — Upper</b></summary>

| # | V1 | V2 | V3 | V4 | V5 | V6 |
|---|----|----|----|----|----|-----|
| 1 | Incline DB Press / Incline Barbell | Incline Barbell / Incline DB Press | Machine Chest Press / Wide Chest Press | Incline DB Fly / Low-High Cable | Wide Chest Press / Machine Chest Press | Decline Barbell / DB Bench |
| 2 | Seated Cable Row / Chest-Supported Row | Chest-Supported Row / Machine Row | Single-Arm DB Row / Landmine Row | Machine Row / Cable Row | Landmine Row / Barbell Row | Cable Row / Chest-Supported Row |
| 3 | DB Shoulder Press / Machine Shoulder Press | Arnold Press / Military Press | Machine Shoulder Press / DB Shoulder Press | Military Press / Arnold Press | Standing DB Press / Arnold Press | Seated DB Arnold / Machine Shoulder |
| 4 | **Bodyweight Pull-ups** / Assisted Pull-ups (8–12 reps, technique focus — no added load here) | Lat Pulldown (wide) / Pull-ups | Neutral-Grip Pull-ups / Lat Pulldown | Lat Pulldown / Chin-ups | Chin-ups / Lat Pulldown | Assisted Pull-ups / Lat Pulldown |
| 5 | EZ-Bar Curl / DB Hammer | Preacher Curl / Incline DB Curl | Hammer Curl / EZ-Bar Cable | Incline 50° Curl / Machine Preacher | Cable Biceps Curl / DB Curl | EZ-Bar Cable Curl / DB Curl |
| 6 | Rope Pressdown / Skullcrushers | Skullcrushers / Overhead DB Ext | Parallel Dips / Close-Grip Bench | V-Bar Pressdown / Dips | Overhead DB Ext / Rope | Close-Grip Bench / Dips |

</details>

## DAY 2 — LOWER
**3 / 3 / 2 / 2 / 2 = 12 sets** · finisher: Forearms

| # | Target | Sets | This cycle |
|---|---|---|---|
| 1 | Quad Compound | 3 | |
| 2 | Hamstring | 3 | |
| 3 | Unilateral | 2 | |
| 4 | Glutes / Posterior | 2 | |
| 5 | Calves | 2 | |

<details><summary><b>Variant bank — Lower</b></summary>

| # | V1 | V2 | V3 | V4 | V5 | V6 |
|---|----|----|----|----|----|-----|
| 1 | Front Squat / Goblet Squat | Hack Squat / Leg Press | Leg Press / Front Squat | DB Sumo Squat / Leg Press | Front Squat / Goblet Squat | Hack Squat / Barbell Squat |
| 2 | Romanian DL / Lying Leg Curl | Lying Leg Curl / Romanian DL | Single-Leg RDL / Good Mornings | Romanian DL / Cable Ham Curl | Glute Ham Raise / Romanian DL | Seated Leg Curl / Lying Leg Curl |
| 3 | Walking Lunges / Bulgarian Split | DB Lunges / Step-ups | Bulgarian Split / Walking Lunges | DB Step-ups / Bulgarians | Walking Lunges / Reverse Lunge | Single RDL / Good Morning |
| 4 | Hip Thrust / Glute Bridge | Cable Hip Thrust / Glute Bridge | Hip Thrust / Cable Pull-Through | Glute Bridge / Hip Thrust | Hip Thrust / DB Sumo Squat | Glute Bridge / Cable Thrust |
| 5 | Standing Calf / Seated Calf | Seated Calf / Standing Calf | Calf Press / Standing Calf | Donkey Calf / Standing Calf | Standing Calf / Seated Calf | Calf Press / Donkey Calf |

</details>

## DAY 3 — PUSH
**3 / 3 / 2 / 3 / 2 / 3 = 16 sets** · finisher: Abs

| # | Target | Sets | This cycle |
|---|---|---|---|
| 1 | Mid Chest | 3 | |
| 2 | Upper Chest / Fly | 3 | |
| 3 | Chest Isolation | 2 | |
| 4 | Front Delt | 3 | |
| 5 | Side Delt | 2 | |
| 6 | Triceps | 3 | |

<details><summary><b>Variant bank — Push</b></summary>

| # | V1 | V2 | V3 | V4 | V5 | V6 |
|---|----|----|----|----|----|-----|
| 1 | Barbell Bench / DB Press | DB Bench / Barbell | Incline Barbell / Decline | Decline Barbell / DB | Weighted Push-ups / DB | Wide Chest Press / Barbell |
| 2 | Incline DB / Barbell | Low-to-High Cable / Pec-Dec | Machine Chest Press / Push-ups | Flat DB Fly / Pec-Dec | Chest Press Machine / Barbell | Incline DB Fly / Cable |
| 3 | Pec-Dec Fly / Cable | Incline Hammer / DB | DB Fly / Cable | Push-ups / Machine Press | Cable Crossover / DB Fly | Flat DB Press / Decline |
| 4 | Military Press / Arnold | DB Shoulder Press / Machine | Arnold Press / Military | Machine Shoulder Press / DB | Upright Row / Lateral Raise | Standing DB Press / Arnold |
| 5 | Lateral Raise / Front Raise | Cable Lateral / Plate Raise | Machine Lateral / DB | DB Front Raise / Lateral | DB Arnold Press / Military | Cable Lateral / Upright Row |
| 6 | Rope Pressdown / Skullcrushers | V-Bar Pressdown / DB Ext | Dips / Close-Grip Bench | Skullcrushers / Kickbacks | Overhead DB Ext / Rope | Close-Grip Bench / Dips |

</details>

## DAY 4 — PULL
**3 / 3 / 3 / 2 / 2 / 2 = 15 sets** · finisher: *(forearm slot built in — no separate finisher needed)*

| # | Target | Sets | This cycle |
|---|---|---|---|
| 1 | Vertical Pull — **weighted pull-ups** | 3 | |
| 2 | Row — Thickness | 3 | |
| 3 | Upper Back | 3 | |
| 4 | Delts / Traps | 2 | |
| 5 | Biceps | 2 | |
| 6 | Lower Arm / Forearm | 2 | |

<details><summary><b>Variant bank — Pull</b></summary>

| # | V1 | V2 | V3 | V4 | V5 | V6 |
|---|----|----|----|----|----|-----|
| 1 | **Weighted Pull-ups** / Lat Pulldown | Chin-ups / Close Lat Pull | Lat Pulldown / Pull-ups | Rack Pulls / Deadlift | Deadlift / Romanian DL | Neutral Pull-ups / Lat Pull |
| 2 | Machine Row / Cable Row | Single DB Row / Landmine Row | Barbell Row / DB Row | Seated Cable Row / DB Row | Lat Pulldown / Pull-ups | Barbell Row / DB Row |
| 3 | Landmine Row / High Row (bench-rigged) | High Row (bench-rigged) / Meadows Row | Cable Row / Machine Row | Lat Pulldown (Neutral) / Chin | Machine Row / High Row (bench-rigged) | Chest Supported Row / Cable |
| 4 | Face Pulls / Rear Delt Fly | Barbell Shrugs / Upright Row | Rear Delt Cable Fly / Face Pull | Face Pulls / DB Shrugs | DB Rear Delt Fly / Face Pull | Face Pulls / DB Shrugs |
| 5 | EZ-Bar Curl / DB Curl | Preacher Curl / Concentration | Hammer Curl / EZ-Bar | Incline DB Curl / Preacher | Cable Biceps Curl / DB Curl | EZ-Bar Cable Curl / DB Curl |
| 6 | Hammer Curl / Cable Hammer | Reverse Curl / Wrist Roller | DB Biceps Curl / Cable | Spider Curl / Barbell | Preacher DB Curl / Machine | Wrist Roller / Reverse Curl |

</details>

## DAY 5 — LEGS
**3 / 3 / 2 / 2 / 2 / 2 = 14 sets** · finisher: Abs

| # | Target | Sets | This cycle |
|---|---|---|---|
| 1 | Compound | 3 | |
| 2 | Quads / Hams | 3 | |
| 3 | Isolation | 2 | |
| 4 | Unilateral | 2 | |
| 5 | Posterior | 2 | |
| 6 | Calves | 2 | |

<details><summary><b>Variant bank — Legs</b></summary>

| # | V1 | V2 | V3 | V4 | V5 | V6 |
|---|----|----|----|----|----|-----|
| 1 | Barbell Squat / Leg Press | Front Squat / Goblet | Sumo Deadlift / Conv. DL | Leg Press / Hack Squat | Barbell Squat / Goblet | Hack Squat / Barbell |
| 2 | Romanian DL / Leg Curl | Hack Squat / Leg Press | Leg Extension / Goblet | DB Sumo Squat / Barbell | Front Squat / Leg Press | DB Sumo Squat / Leg Press |
| 3 | Leg Extension / Goblet | Lying Leg Curl / Romanian DL | Front Squat / Back Squat | Glute Ham Raise / Leg Curl | Romanian DL / Glute Ham | Standing Calf / Seated |
| 4 | Walking Lunges / Bulgarians | DB Lunges / Leg Press | Romanian DL / Cable Curl | Bulgarian Split / Lunges | Walking Lunges / Bulgarians | Single RDL / Good Morning |
| 5 | Hip Thrust / Glute Bridge | Seated Calf / Standing | Glute Bridge / Hip Thrust | Leg Curl / Cable Pull | Leg Extension / Hack Squat | Glute Bridge / Cable Thrust |
| 6 | Standing Calf / Seated | Single RDL / Good Morning | Calf Press / Standing | Donkey Calf / Standing | Seated Leg Curl / Lying | Lunges / Step-ups |

</details>

## FINISHERS

### Abs — after Upper / Push / Legs (3 of 5 days)

| Exercise | Sets | Reps |
|---|---|---|
| Weighted Cable Crunch | 3 | 10–15 |
| Hanging Leg Raise (weighted if possible) | 3 | 10–15 |
| Weighted Decline Crunch | 2 | 12–15 |

### Forearms — after Lower (Pull already has a built-in forearm slot)

| Exercise | Sets | Reps / Duration |
|---|---|---|
| Wrist Roller | 2 | To failure |
| Reverse Barbell Curl | 2 | 12–15 |
| Farmer's Carry / Plate Pinch | 2 | 30–40 sec |
`;

/** The rotating split, parsed for import. It never changes targets or the phase start. */
export function rotatingCycle(): ParsedReference {
  const parsed = parseReference(ROTATING_CYCLE_MD);
  return { ...parsed, baselineDate: null, stepsTarget: null, phaseMonths: null };
}
