/**
 * Muscles, emojis and swap options for the workout logger. Pure.
 *
 * Each exercise's muscle comes from where it sits in your own program (the
 * slot target, e.g. "Upper Chest" → Chest). Exercises typed in by hand fall
 * back to keyword matching. Weekly coverage compares logged working sets
 * per muscle with what the program plans for the days so far.
 */
import { exerciseOptions } from './referenceImport';

export type Muscle =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Biceps'
  | 'Triceps'
  | 'Quads'
  | 'Hamstrings'
  | 'Glutes'
  | 'Calves'
  | 'Abs'
  | 'Forearms';

export const MUSCLES: Muscle[] = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs', 'Forearms'];

export const MUSCLE_EMOJI: Record<Muscle, string> = {
  Chest: '🫁',
  Back: '🪽',
  Shoulders: '🥥',
  Biceps: '💪',
  Triceps: '🦾',
  Quads: '🦵',
  Hamstrings: '🍗',
  Glutes: '🍑',
  Calves: '🦶',
  Abs: '🍫',
  Forearms: '✊',
};

/** Slot targets from the reference ("Mid Chest", "Row — Thickness", …). Order matters. */
const TARGET_RULES: [RegExp, Muscle][] = [
  [/triceps/i, 'Triceps'],
  [/biceps/i, 'Biceps'],
  [/forearm|grip/i, 'Forearms'],
  [/chest|pec/i, 'Chest'],
  [/delt|shoulder/i, 'Shoulders'],
  [/calf|calves/i, 'Calves'],
  [/glute/i, 'Glutes'],
  [/hamstring|hinge|posterior/i, 'Hamstrings'],
  [/\b(pull|rows?|back|lats?)\b/i, 'Back'],
  [/quad|squat|unilateral|leg/i, 'Quads'],
  [/abs|core/i, 'Abs'],
];

/** Exercise names typed by hand. Specific patterns first ("leg curl" before "curl"). */
const EXERCISE_RULES: [RegExp, Muscle][] = [
  [/wrist|reverse (barbell )?curl|plate pinch|farmer/i, 'Forearms'],
  [/leg curl|ham curl|glute ham|romanian|\brdl\b|good morning|stiff-leg|straight-leg|deadlift|pull-through/i, 'Hamstrings'],
  [/hip thrust|glute bridge|kickback/i, 'Glutes'],
  [/calf/i, 'Calves'],
  [/crunch|leg raise|plank|sit-up|ab wheel/i, 'Abs'],
  [/skull|pressdown|pushdown|tricep|\bdips?\b|close-grip|overhead (db )?ext|v-bar|\brope\b/i, 'Triceps'],
  [/curl|preacher|hammer/i, 'Biceps'],
  [/squat|leg press|lunge|step-up|leg ext|bulgarian/i, 'Quads'],
  [/upright row|lateral|shoulder press|military|arnold|front raise|face pull|rear delt|plate raise|overhead press/i, 'Shoulders'],
  [/bench|chest press|\bfly\b|\bpec\b|crossover|push-up/i, 'Chest'],
  [/pulldown|pull-ups?\b|\bchin-?ups?\b|\brows?\b|pullover|rack pull|shrug/i, 'Back'],
];

export function muscleForTarget(label: string): Muscle | null {
  return TARGET_RULES.find(([re]) => re.test(label))?.[1] ?? null;
}

export function guessMuscle(exercise: string): Muscle | null {
  return EXERCISE_RULES.find(([re]) => re.test(exercise))?.[1] ?? null;
}

export interface ProgramSlot {
  weekday: number;
  slot: number;
  label: string;
  default_sets: number;
  variants: string[];
}
export interface FinisherDef {
  name: string;
  days: number[];
  exercises: { name: string; sets: number; reps: string }[];
}

const keyOf = (s: string) => s.trim().toLowerCase();

/**
 * exercise (lower-case) → muscle, voted by every slot the exercise appears
 * in across your program (most frequent target wins), plus finishers.
 */
export function buildMuscleMap(slots: ProgramSlot[], finishers: FinisherDef[]): Map<string, Muscle> {
  const votes = new Map<string, Map<Muscle, number>>();
  const vote = (name: string, muscle: Muscle | null) => {
    if (!muscle || !name.trim()) return;
    const v = votes.get(keyOf(name)) ?? new Map<Muscle, number>();
    v.set(muscle, (v.get(muscle) ?? 0) + 1);
    votes.set(keyOf(name), v);
  };
  for (const s of slots) {
    const muscle = muscleForTarget(s.label);
    for (const variant of s.variants) for (const name of exerciseOptions(variant)) vote(name, muscle);
  }
  for (const f of finishers) {
    const muscle = muscleForTarget(f.name);
    for (const e of f.exercises) for (const name of exerciseOptions(e.name)) vote(name, muscle);
  }
  return new Map(
    [...votes].map(([name, v]) => {
      const ranked = [...v].sort((a, b) => b[1] - a[1]);
      const tied = ranked.filter(([, n]) => n === ranked[0][1]).map(([m]) => m);
      // On a tie, let the exercise name decide (deadlift → hamstrings).
      const guess = guessMuscle(name);
      return [name, guess && tied.includes(guess) ? guess : ranked[0][0]];
    }),
  );
}

export function muscleOf(exercise: string, map: Map<string, Muscle>): Muscle | null {
  return map.get(keyOf(exercise)) ?? guessMuscle(exercise);
}

// ---------- Emojis ----------

const EMOJI_RULES: [RegExp, string][] = [
  [/treadmill|walk(?!ing lunge)/i, '🚶'],
  [/farmer/i, '🧳'],
  [/wrist|reverse (barbell )?curl|plate pinch/i, '✊'],
  [/leg curl|ham curl|glute ham/i, '🦵'],
  [/hip thrust|glute bridge|pull-through/i, '🍑'],
  [/calf/i, '🦶'],
  [/crunch|leg raise|plank/i, '🔥'],
  [/skull/i, '💀'],
  [/\bdips?\b/i, '🤸'],
  [/pressdown|pushdown|\brope\b|v-bar|overhead (db )?ext/i, '🔽'],
  [/curl|preacher|hammer/i, '💪'],
  [/face pull|rear delt/i, '🎯'],
  [/shrug/i, '🤷'],
  [/upright row|lateral|front raise|plate raise/i, '🙆'],
  [/shoulder press|military|arnold|overhead press/i, '🙌'],
  [/pulldown|pull-ups?\b|\bchin-?ups?\b/i, '🧗'],
  [/\brows?\b/i, '🚣'],
  [/deadlift|romanian|\brdl\b|good morning|stiff-leg|straight-leg|rack pull/i, '🏋️'],
  [/lunge|step-up|bulgarian/i, '🚶'],
  [/squat|leg press|leg ext/i, '🦵'],
  [/\bfly\b|crossover|\bpec\b/i, '🦋'],
  [/bench|chest press|press/i, '🏋️'],
];

export function exerciseEmoji(exercise: string): string {
  return EMOJI_RULES.find(([re]) => re.test(exercise))?.[1] ?? '🏋️';
}

// ---------- Swap options ----------

export interface SwapGroup {
  label: string;
  options: string[];
}

/**
 * Choices for a slot when a machine is taken, most relevant first: this
 * week's default and fallback, the same slot in other weeks, then anything
 * in your program that trains the same muscle.
 */
export function swapOptions(slot: ProgramSlot, variantIndex: number, allSlots: ProgramSlot[], map: Map<string, Muscle>): SwapGroup[] {
  const seen = new Set<string>();
  const take = (names: string[]) =>
    names.filter((n) => {
      const k = keyOf(n);
      if (!n.trim() || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  const muscle = muscleForTarget(slot.label);
  const thisWeek = take(exerciseOptions(slot.variants[variantIndex] ?? ''));
  const otherWeeks = take(slot.variants.flatMap(exerciseOptions)).sort();
  const sameMuscle = muscle
    ? take(allSlots.flatMap((s) => s.variants.flatMap(exerciseOptions)).filter((n) => muscleOf(n, map) === muscle)).sort()
    : [];
  return [
    { label: 'This week', options: thisWeek },
    { label: 'Same slot, other weeks', options: otherWeeks },
    { label: `Other ${muscle ?? 'similar'} exercises`, options: sameMuscle },
  ].filter((g) => g.options.length > 0);
}

/** Does swapping to `exercise` change which muscle this slot trains? */
export function swapWarning(slotLabel: string, exercise: string, map: Map<string, Muscle>): { from: Muscle; to: Muscle | null } | null {
  const from = muscleForTarget(slotLabel);
  const to = muscleOf(exercise, map);
  if (!from || to === from) return null;
  return { from, to };
}

// ---------- Weekly coverage ----------

export interface MuscleCoverage {
  muscle: Muscle;
  /** Working sets planned for the whole week. */
  planned: number;
  /** Planned for the training days up to and including today (not away). */
  expectedSoFar: number;
  done: number;
  status: 'on_track' | 'behind' | 'ahead' | 'not_started';
}

export interface LoggedSet {
  exercise: string;
  day: string;
  slot: number;
}

/**
 * Sets per muscle this week vs the program. `trainingDaysSoFar` are the
 * weekdays (1–6) up to today that are not away.
 */
export function weeklyCoverage(
  slots: ProgramSlot[],
  finishers: FinisherDef[],
  logged: LoggedSet[],
  trainingDaysSoFar: number[],
  map: Map<string, Muscle>,
): MuscleCoverage[] {
  const planned = new Map<Muscle, number>();
  const expected = new Map<Muscle, number>();
  const add = (m: Map<Muscle, number>, muscle: Muscle | null, n: number) => muscle && m.set(muscle, (m.get(muscle) ?? 0) + n);
  for (const s of slots) {
    if (s.weekday < 1 || s.weekday > 6 || !s.variants.some(Boolean)) continue;
    const muscle = muscleForTarget(s.label);
    add(planned, muscle, s.default_sets);
    if (trainingDaysSoFar.includes(s.weekday)) add(expected, muscle, s.default_sets);
  }
  for (const f of finishers) {
    const muscle = muscleForTarget(f.name);
    const perDay = f.exercises.reduce((a, e) => a + e.sets, 0);
    add(planned, muscle, perDay * f.days.length);
    add(expected, muscle, perDay * f.days.filter((d) => trainingDaysSoFar.includes(d)).length);
  }
  const done = new Map<Muscle, number>();
  for (const set of logged) add(done, muscleOf(set.exercise, map), 1);

  return MUSCLES.filter((m) => (planned.get(m) ?? 0) > 0 || (done.get(m) ?? 0) > 0).map((muscle) => {
    const p = planned.get(muscle) ?? 0;
    const e = expected.get(muscle) ?? 0;
    const d = done.get(muscle) ?? 0;
    const status: MuscleCoverage['status'] =
      e === 0 ? (d > 0 ? 'ahead' : 'not_started') : d >= e ? (d > e ? 'ahead' : 'on_track') : 'behind';
    return { muscle, planned: p, expectedSoFar: e, done: d, status };
  });
}
