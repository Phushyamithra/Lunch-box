/**
 * Calorie and macro targets. Pure.
 *
 * Maintenance is an *estimate*: Mifflin–St Jeor BMR × an activity factor.
 * It is a starting point to calibrate against your weight trend and actual
 * intake, never a measurement. Targets only change when you save them.
 */

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'extra';
export type GoalMode = 'deficit' | 'maintenance' | 'recomp' | 'lean_bulk' | 'custom';

export const KCAL = { protein: 4, carbs: 4, fat: 9 } as const;
/** Rough energy in 1 kg of body-weight change (mixed tissue). */
export const KCAL_PER_KG = 7700;
export const DAYS_PER_MONTH = 30.4375;
/** Label energy vs 4/4/9 maths: differences within this are normal. */
export const ENERGY_TOLERANCE = 0.05;

export const ACTIVITY: Record<ActivityLevel, { factor: number; label: string; hint: string }> = {
  sedentary: { factor: 1.2, label: 'Sedentary', hint: 'Desk job, under ~5,000 steps, little training' },
  light: { factor: 1.375, label: 'Lightly active', hint: 'Training 1–3 days or ~7,000 steps' },
  moderate: { factor: 1.55, label: 'Moderately active', hint: 'Training 3–6 days, ~8,000–10,000 steps' },
  very: { factor: 1.725, label: 'Very active', hint: 'Hard training most days plus an active job' },
  extra: { factor: 1.9, label: 'Extremely active', hint: 'Physical labour plus daily hard training' },
};

export const MODES: Record<GoalMode, { label: string; emoji: string }> = {
  deficit: { label: 'Fat loss (deficit)', emoji: '🔥' },
  maintenance: { label: 'Maintenance', emoji: '⚖️' },
  recomp: { label: 'Body recomposition', emoji: '🔄' },
  lean_bulk: { label: 'Lean bulk', emoji: '💪' },
  custom: { label: 'Custom', emoji: '✏️' },
};

export interface Profile {
  sex: Sex;
  birth_year: number;
  height_cm: number;
  activity: ActivityLevel;
}

/** Mifflin–St Jeor (1990). */
export function bmr(p: { sex: Sex; age: number; height_cm: number; weight_kg: number }): number {
  return 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
}

/**
 * Activity level suggested from your own routine: training days in the
 * program and your steps target. Workouts are not counted as precise burns.
 */
export function suggestActivity(trainingDaysPerWeek: number, stepsTarget: number): { level: ActivityLevel; why: string } {
  const training = trainingDaysPerWeek >= 5 ? 2 : trainingDaysPerWeek >= 3 ? 1.5 : trainingDaysPerWeek >= 1 ? 1 : 0;
  const steps = stepsTarget >= 10000 ? 1 : stepsTarget >= 7000 ? 0.5 : 0;
  const score = training + steps;
  const level: ActivityLevel = score >= 3.5 ? 'very' : score >= 2 ? 'moderate' : score >= 0.5 ? 'light' : 'sedentary';
  return { level, why: `${trainingDaysPerWeek} training days a week and a ${stepsTarget.toLocaleString('en-IN')}-step target` };
}

export interface MacroTargets {
  kcal: number;
  protein_min: number;
  protein_max: number;
  protein_g: number;
  fat_min: number;
  fat_max: number;
  fat_g: number;
  carbs_g: number;
  fibre_g: number;
}

export interface Estimate {
  targets: MacroTargets;
  bmr: number;
  maintenance: number;
  /** kcal/day added (bulk) or removed (deficit). */
  adjustment: number;
  /** Step-by-step working, shown to you as-is. */
  working: string[];
}

const round = (v: number, to: number) => Math.round(v / to) * to;

/** Protein in g per kg of body weight, by goal (range, point). */
const PROTEIN_G_PER_KG: Record<GoalMode, [number, number]> = {
  deficit: [1.8, 2.2],
  maintenance: [1.4, 2.0],
  recomp: [1.8, 2.2],
  lean_bulk: [1.6, 2.2],
  custom: [1.6, 2.2],
};

/**
 * Suggested targets for a goal. `rateKgPerMonth` is the desired change:
 * positive for a bulk, negative for a deficit (ignored otherwise).
 */
export function estimateTargets(input: {
  profile: Profile;
  weight_kg: number;
  year: number;
  mode: GoalMode;
  rateKgPerMonth: number;
}): Estimate {
  const { profile, weight_kg, mode } = input;
  const age = input.year - profile.birth_year;
  const base = bmr({ sex: profile.sex, age, height_cm: profile.height_cm, weight_kg });
  const factor = ACTIVITY[profile.activity].factor;
  const maintenance = base * factor;
  const rate = mode === 'deficit' ? -Math.abs(input.rateKgPerMonth) : mode === 'lean_bulk' ? Math.abs(input.rateKgPerMonth) : 0;
  // Recomposition: a small deficit (~5%) while training and eating high protein.
  const adjustment = mode === 'recomp' ? -maintenance * 0.05 : (rate * KCAL_PER_KG) / DAYS_PER_MONTH;
  const kcal = round(maintenance + adjustment, 50);

  const [pLo, pHi] = PROTEIN_G_PER_KG[mode];
  const protein_min = round(pLo * weight_kg, 5);
  const protein_max = round(pHi * weight_kg, 5);
  const protein_g = round((protein_min + protein_max) / 2, 5);
  // Fat: 0.6–1.0 g/kg, point at ~25% of calories (kept inside the range).
  const fat_min = round(0.6 * weight_kg, 5);
  const fat_max = round(1.0 * weight_kg, 5);
  const fat_g = Math.min(fat_max, Math.max(fat_min, round((kcal * 0.25) / KCAL.fat, 5)));
  const carbs_g = Math.max(0, round((kcal - protein_g * KCAL.protein - fat_g * KCAL.fat) / KCAL.carbs, 5));
  const fibre_g = round((kcal / 1000) * 14, 1);

  const working = [
    `BMR (Mifflin–St Jeor): 10 × ${weight_kg.toFixed(1)} kg + 6.25 × ${profile.height_cm} cm − 5 × ${age} y ${profile.sex === 'male' ? '+ 5' : '− 161'} = ${Math.round(base)} kcal`,
    `Maintenance ≈ BMR × ${factor} (${ACTIVITY[profile.activity].label.toLowerCase()}) = ${Math.round(maintenance)} kcal. This is an estimate: your weight trend over 3–4 weeks is the real test.`,
    mode === 'recomp'
      ? `Recomposition: about 5% under maintenance (${Math.round(adjustment)} kcal/day).`
      : rate !== 0
        ? `${rate > 0 ? 'Gain' : 'Loss'} of ${Math.abs(rate)} kg/month × ${KCAL_PER_KG} kcal/kg ÷ ${DAYS_PER_MONTH} days ≈ ${rate > 0 ? '+' : '−'}${Math.abs(Math.round(adjustment))} kcal/day.`
        : 'No surplus or deficit.',
    `Target ≈ ${kcal} kcal (rounded to 50).`,
    `Protein ${pLo}–${pHi} g/kg → ${protein_min}–${protein_max} g, aim ${protein_g} g.`,
    `Fat 0.6–1.0 g/kg → ${fat_min}–${fat_max} g, aim ${fat_g} g (about ${Math.round(((fat_g * KCAL.fat) / kcal) * 100)}% of calories).`,
    `Carbs fill the rest: (${kcal} − ${protein_g} × 4 − ${fat_g} × 9) ÷ 4 ≈ ${carbs_g} g.`,
    `Fibre ≈ 14 g per 1,000 kcal → ${fibre_g} g.`,
  ];
  return { targets: { kcal, protein_min, protein_max, protein_g, fat_min, fat_max, fat_g, carbs_g, fibre_g }, bmr: base, maintenance, adjustment, working };
}

export interface Consistency {
  /** Energy from the aim points (4/4/9). */
  pointKcal: number;
  /** Lowest and highest energy the ranges allow (carbs fixed). */
  rangeKcal: [number, number];
  /** pointKcal − kcal. */
  gap: number;
  status: 'consistent' | 'within_ranges' | 'inconsistent';
  message: string;
  /** Carbs that would make the aim points add up exactly. */
  carbsForPoints: number;
}

/**
 * Do calories and macros agree? Exact agreement isn't expected (labels and
 * rounding differ), so within 5% is fine, and a calorie target the ranges
 * can reach is accepted as-is. Only a real mismatch is flagged, with the fix.
 */
export function checkConsistency(t: MacroTargets): Consistency {
  const energy = (p: number, f: number) => p * KCAL.protein + f * KCAL.fat + t.carbs_g * KCAL.carbs;
  const pointKcal = energy(t.protein_g, t.fat_g);
  const rangeKcal: [number, number] = [energy(t.protein_min, t.fat_min), energy(t.protein_max, t.fat_max)];
  const gap = pointKcal - t.kcal;
  const carbsForPoints = Math.max(0, Math.round((t.kcal - t.protein_g * KCAL.protein - t.fat_g * KCAL.fat) / KCAL.carbs));
  const within = t.kcal >= rangeKcal[0] && t.kcal <= rangeKcal[1];
  if (Math.abs(gap) <= t.kcal * 0.02) {
    return { pointKcal, rangeKcal, gap, carbsForPoints, status: 'consistent', message: `Macros add up to ${Math.round(pointKcal)} kcal, matching the target.` };
  }
  if (within || Math.abs(gap) <= t.kcal * ENERGY_TOLERANCE) {
    return {
      pointKcal,
      rangeKcal,
      gap,
      carbsForPoints,
      status: 'within_ranges',
      message: `${t.kcal} kcal sits inside what your ranges allow (${Math.round(rangeKcal[0])}–${Math.round(rangeKcal[1])} kcal). At the aim points the macros give ${Math.round(pointKcal)} kcal (${gap > 0 ? '+' : ''}${Math.round(gap)}); a normal day lands somewhere in the range.`,
    };
  }
  return {
    pointKcal,
    rangeKcal,
    gap,
    carbsForPoints,
    status: 'inconsistent',
    message: `Macros give ${Math.round(pointKcal)} kcal but the target is ${t.kcal} (${gap > 0 ? '+' : ''}${Math.round(gap)}). Carbs of about ${carbsForPoints} g would make them agree.`,
  };
}

export function validateTargets(t: MacroTargets): string | null {
  if (!(t.kcal >= 1000 && t.kcal <= 6000)) return 'Calories should be between 1,000 and 6,000.';
  if (t.protein_min > t.protein_max || t.protein_g < t.protein_min || t.protein_g > t.protein_max) return 'Protein aim must sit inside its range.';
  if (t.fat_min > t.fat_max || t.fat_g < t.fat_min || t.fat_g > t.fat_max) return 'Fat aim must sit inside its range.';
  if ([t.protein_min, t.fat_min, t.carbs_g, t.fibre_g].some((v) => !(v >= 0))) return 'Grams can’t be negative.';
  if (checkConsistency(t).status === 'inconsistent') return checkConsistency(t).message;
  return null;
}

const TARGET_KEYS = ['kcal', 'protein_min', 'protein_max', 'protein_g', 'fat_min', 'fat_max', 'fat_g', 'carbs_g', 'fibre_g'] as const;
/** Just the target numbers (drops ids, dates and anything else on a saved row). */
export const pickTargets = (t: MacroTargets): MacroTargets => Object.fromEntries(TARGET_KEYS.map((k) => [k, t[k]])) as unknown as MacroTargets;

/** Your existing lean-bulk plan, kept exactly as configured. */
export const LEAN_BULK_PRESET: MacroTargets & { rate: number } = {
  kcal: 2450,
  protein_min: 140,
  protein_max: 150,
  protein_g: 145,
  fat_min: 55,
  fat_max: 75,
  fat_g: 65,
  carbs_g: 295,
  fibre_g: 34,
  rate: 0.4,
};

/**
 * The weight-trend rules' suggestion, as a concrete change you can review:
 * −100 kcal takes fat first (down to its minimum), +100 kcal goes to carbs.
 */
export function adjustForTrend(current: MacroTargets, direction: 'down' | 'up', kcalStep = 100): { targets: MacroTargets; summary: string } {
  const t = pickTargets(current);
  if (direction === 'up') {
    const carbs = Math.round(kcalStep / KCAL.carbs);
    return { targets: { ...t, kcal: t.kcal + kcalStep, carbs_g: t.carbs_g + carbs }, summary: `+${kcalStep} kcal as carbs (+${carbs} g carbs)` };
  }
  const fatRoom = Math.max(0, t.fat_g - t.fat_min);
  const fatCut = Math.min(fatRoom, Math.round(kcalStep / KCAL.fat));
  const rest = kcalStep - fatCut * KCAL.fat;
  const carbCut = Math.max(0, Math.round(rest / KCAL.carbs));
  return {
    targets: { ...t, kcal: t.kcal - kcalStep, fat_g: t.fat_g - fatCut, carbs_g: Math.max(0, t.carbs_g - carbCut) },
    summary: `−${kcalStep} kcal: −${fatCut} g fat${carbCut ? `, −${carbCut} g carbs` : ''}`,
  };
}
