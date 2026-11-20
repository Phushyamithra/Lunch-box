import type { Muscle } from './muscles';

/**
 * Common gym exercises, machines included, offered in every exercise picker
 * alongside your own program's exercises. Each one names the muscle it
 * mainly trains, so swaps and weekly coverage count it correctly even where
 * a keyword would mislead ("Reverse Pec Deck" is rear delts, "Nordic Curl"
 * is hamstrings).
 */
export const EXERCISE_LIBRARY: Record<Muscle, string[]> = {
  Chest: [
    'Incline Machine Chest Press',
    'Flat Machine Chest Press',
    'Decline Machine Chest Press',
    'Hammer Strength Incline Press',
    'Hammer Strength Chest Press',
    'Smith Machine Bench Press',
    'Smith Machine Incline Press',
    'Incline Barbell Bench',
    'Decline Barbell Bench',
    'Incline DB Press',
    'Pec Deck',
    'High-to-Low Cable Fly',
    'Low-to-High Cable Fly',
    'Seated Cable Fly',
    'Push-up',
  ],
  Back: [
    'Machine Lat Pulldown',
    'Single-Arm Cable Pulldown',
    'Straight-Arm Cable Pulldown',
    'Seated Machine Row',
    'Hammer Strength High Row',
    'Hammer Strength Low Row',
    'Chest-Supported T-Bar Row',
    'Pendlay Row',
    'Meadows Row',
    'Single-Arm Cable Row',
    'Cable Pullover',
    'Assisted Pull-up Machine',
    'Back Extension',
  ],
  Shoulders: [
    'Machine Shoulder Press',
    'Smith Machine Shoulder Press',
    'Landmine Press',
    'Machine Lateral Raise',
    'Cable Lateral Raise',
    'Cable Y-Raise',
    'Reverse Pec Deck',
    'Cable Rear Delt Fly',
    'Face Pull',
  ],
  Biceps: [
    'Cable Curl',
    'Bayesian Cable Curl',
    'Machine Preacher Curl',
    'Spider Curl',
    'Incline DB Curl',
    'Hammer Curl',
    'Rope Hammer Curl',
  ],
  Triceps: [
    'Cable Overhead Triceps Extension',
    'Single-Arm Cable Pushdown',
    'Rope Pushdown',
    'Machine Triceps Extension',
    'Machine Dip',
    'JM Press',
  ],
  Quads: [
    'Pendulum Squat',
    'Hack Squat',
    'Belt Squat',
    'V-Squat',
    'Smith Machine Squat',
    '45° Leg Press',
    'Horizontal Leg Press',
    'Leg Extension',
    'Single-Leg Leg Extension',
    'Sissy Squat',
    'Bulgarian Split Squat',
    'Walking Lunges',
  ],
  Hamstrings: ['Seated Leg Curl', 'Lying Leg Curl', 'Standing Single-Leg Curl', 'Nordic Curl', 'Romanian Deadlift', 'Stiff-Leg Deadlift', '45° Back Extension (hamstrings)'],
  Glutes: ['Hip Thrust Machine', 'Barbell Hip Thrust', 'Glute Kickback Machine', 'Cable Glute Kickback', 'Hip Abduction Machine', 'Glute Bridge'],
  Calves: ['Standing Calf Raise Machine', 'Seated Calf Raise', 'Leg Press Calf Raise', 'Smith Machine Calf Raise'],
  Abs: [
    'Machine Cable Crunch',
    'Kneeling Cable Crunch',
    'Ab Crunch Machine',
    'Hanging Leg Raise',
    "Captain's Chair Leg Raise",
    'Decline Crunch',
    'Cable Woodchopper',
    'Ab Wheel Rollout',
    'Pallof Press',
    'Plank',
  ],
  Forearms: ['Wrist Curl', 'Reverse Wrist Curl', 'Reverse Curl', "Farmer's Carry", 'Dead Hang', 'Wrist Roller'],
};

const BY_NAME = new Map<string, Muscle>(
  (Object.entries(EXERCISE_LIBRARY) as [Muscle, string[]][]).flatMap(([m, names]) => names.map((n) => [n.toLowerCase(), m] as [string, Muscle])),
);

/** The library's muscle for an exercise name (exact, case-insensitive), or null. */
export const libraryMuscle = (exercise: string): Muscle | null => BY_NAME.get(exercise.trim().toLowerCase()) ?? null;

/** Every library exercise, A–Z. */
export const LIBRARY_EXERCISES: string[] = [...BY_NAME.keys()].map((k) => Object.values(EXERCISE_LIBRARY).flat().find((n) => n.toLowerCase() === k)!).sort((a, b) => a.localeCompare(b));
