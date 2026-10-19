/**
 * What to train on a given day. Pure.
 *
 * You pick a variant per day (Mon V1, Tue V2, Fri V5…), any slot can use a
 * different variant ("mix"), a day can run one of your own workout cards
 * instead, and extra exercises can be added on the spot.
 *
 * Set slots: 1–5 program, 6 finishers, 7–20 custom card, 21–40 extras.
 */
import type { FinisherDef, ProgramSlot } from './muscles';
import { exerciseOptions } from './referenceImport';
import { isCompoundSlot, isoWeekday } from './rules';

export const FINISHER_SLOT = 6;
export const CUSTOM_SLOT_BASE = 7;
export const EXTRA_SLOT_BASE = 21;
export const MAX_CUSTOM_EXERCISES = 14;
export const MAX_EXTRAS = 20;

export interface CustomExercise {
  label: string;
  /** "Default / Fallback", like the reference file. */
  exercise: string;
  sets: number;
  reps?: string;
}
export interface CustomWorkout {
  id: string;
  name: string;
  weekday: number | null;
  exercises: CustomExercise[];
}
export interface DaySession {
  day: string;
  variant_index: number;
  slot_variants: Record<string, number>;
  custom_workout_id: string | null;
  extras: CustomExercise[];
}

export type PlanKind = 'program' | 'finisher' | 'custom' | 'extra';
export interface PlanItem {
  key: string;
  kind: PlanKind;
  slot: number;
  /** What the slot trains ("Upper Chest"); drives the muscle and swap warning. */
  title: string;
  options: string[];
  sets: number;
  repsHint?: string;
  compound: boolean;
  /** Variant in use, for program slots. */
  variantIndex: number | null;
  /** Counts toward "exercises done" (finishers and extras don't). */
  core: boolean;
}

/** Variants that have at least one exercise on this weekday. */
export function variantsFor(weekday: number, slots: ProgramSlot[]): number[] {
  const day = slots.filter((s) => s.weekday === weekday);
  return Array.from({ length: 7 }, (_, i) => i).filter((i) => day.some((s) => (s.variants[i] ?? '').trim()));
}

/**
 * Suggested variant for a day: the one after the last variant you trained on
 * this weekday (so each muscle group rotates on its own), else the program's
 * weekly rotation.
 */
export function suggestVariant(
  day: string,
  sessions: Pick<DaySession, 'day' | 'variant_index' | 'custom_workout_id'>[],
  slots: ProgramSlot[],
  rotationVariant: number,
): { index: number; reason: 'next' | 'rotation' } {
  const weekday = isoWeekday(day);
  const available = variantsFor(weekday, slots);
  if (available.length === 0) return { index: rotationVariant, reason: 'rotation' };
  const last = sessions
    .filter((s) => s.day < day && !s.custom_workout_id && isoWeekday(s.day) === weekday)
    .sort((a, b) => b.day.localeCompare(a.day))[0];
  if (last) {
    const next = available.find((i) => i > last.variant_index) ?? available[0];
    return { index: next, reason: 'next' };
  }
  return { index: available.includes(rotationVariant) ? rotationVariant : available[0], reason: 'rotation' };
}

export const variantForSlot = (session: Pick<DaySession, 'variant_index' | 'slot_variants'>, slot: number): number =>
  session.slot_variants[String(slot)] ?? session.variant_index;

/** Is any slot using a different variant from the day's pick? */
export const isMixed = (session: Pick<DaySession, 'variant_index' | 'slot_variants'>): boolean =>
  Object.values(session.slot_variants).some((v) => v !== session.variant_index);

/**
 * The day's exercise cards in order: program slots (or your own card), the
 * day's finishers, then any extras.
 */
export function buildDayPlan(input: {
  weekday: number;
  session: Pick<DaySession, 'variant_index' | 'slot_variants' | 'custom_workout_id' | 'extras'>;
  slots: ProgramSlot[];
  finishers: FinisherDef[];
  workouts: CustomWorkout[];
}): PlanItem[] {
  const { weekday, session, slots, finishers, workouts } = input;
  const custom = session.custom_workout_id ? workouts.find((w) => w.id === session.custom_workout_id) : undefined;
  const items: PlanItem[] = [];
  if (custom) {
    custom.exercises.slice(0, MAX_CUSTOM_EXERCISES).forEach((e, i) =>
      items.push({
        key: `custom-${custom.id}-${i}`,
        kind: 'custom',
        slot: CUSTOM_SLOT_BASE + i,
        title: e.label.trim() || e.exercise,
        options: exerciseOptions(e.exercise),
        sets: e.sets,
        repsHint: e.reps,
        compound: i < 2 && e.sets >= 3,
        variantIndex: null,
        core: true,
      }),
    );
  } else {
    for (const s of slots.filter((s) => s.weekday === weekday).sort((a, b) => a.slot - b.slot)) {
      const v = variantForSlot(session, s.slot);
      items.push({
        key: `slot-${s.slot}`,
        kind: 'program',
        slot: s.slot,
        title: s.label || `Slot ${s.slot}`,
        options: exerciseOptions(s.variants[v] ?? ''),
        sets: s.default_sets,
        compound: isCompoundSlot(s.slot, s.default_sets),
        variantIndex: v,
        core: true,
      });
    }
  }
  for (const f of finishers.filter((f) => f.days.includes(weekday))) {
    f.exercises.forEach((e, i) =>
      items.push({
        key: `fin-${f.name}-${i}`,
        kind: 'finisher',
        slot: FINISHER_SLOT,
        title: `${f.name} finisher`,
        options: exerciseOptions(e.name),
        sets: e.sets,
        repsHint: e.reps,
        compound: false,
        variantIndex: null,
        core: false,
      }),
    );
  }
  session.extras.slice(0, MAX_EXTRAS).forEach((e, i) =>
    items.push({
      key: `extra-${i}`,
      kind: 'extra',
      slot: EXTRA_SLOT_BASE + i,
      title: e.label.trim() || e.exercise,
      options: exerciseOptions(e.exercise),
      sets: e.sets,
      repsHint: e.reps,
      compound: false,
      variantIndex: null,
      core: false,
    }),
  );
  return items;
}

/** Sets logged against a plan item (finishers share slot 6, so match by name). */
export function setsForItem<T extends { slot: number; exercise: string }>(item: PlanItem, sets: T[]): T[] {
  const inSlot = sets.filter((s) => s.slot === item.slot);
  if (item.kind !== 'finisher') return inSlot;
  return inSlot.filter((s) => item.options.some((o) => o.toLowerCase() === s.exercise.toLowerCase()));
}

/** Progress over the day's core cards (program slots or your own card). */
export function dayProgress(plan: PlanItem[], sets: { slot: number; exercise: string }[]): { logged: number; planned: number; done: number; total: number } {
  let logged = 0;
  let planned = 0;
  let done = 0;
  const core = plan.filter((p) => p.core);
  for (const p of core) {
    const n = Math.min(p.sets, setsForItem(p, sets).length);
    logged += n;
    planned += p.sets;
    if (p.sets > 0 && n >= p.sets) done += 1;
  }
  return { logged, planned, done, total: core.length };
}

export function validateCustomWorkout(w: { name: string; exercises: CustomExercise[] }): string | null {
  if (!w.name.trim()) return 'Give the card a name.';
  if (w.name.trim().length > 60) return 'Keep the name under 60 characters.';
  const rows = w.exercises.filter((e) => e.exercise.trim());
  if (rows.length === 0) return 'Add at least one exercise.';
  if (rows.length > MAX_CUSTOM_EXERCISES) return `Up to ${MAX_CUSTOM_EXERCISES} exercises per card.`;
  if (rows.some((e) => !Number.isInteger(e.sets) || e.sets < 1 || e.sets > 10)) return 'Sets must be between 1 and 10.';
  return null;
}

/** Starts a custom card from a variant, so you only change what differs. */
export function workoutFromVariant(weekday: number, variant: number, slots: ProgramSlot[]): CustomExercise[] {
  return slots
    .filter((s) => s.weekday === weekday && (s.variants[variant] ?? '').trim())
    .sort((a, b) => a.slot - b.slot)
    .map((s) => ({ label: s.label, exercise: s.variants[variant], sets: s.default_sets }));
}
