import type { DietDay } from './rules';

/**
 * The Diet card's tag, worked out from the day's food log instead of by eye.
 * Pure.
 *
 * Calories against the day's target decide the band; protein has to reach
 * its minimum for a day to count as on track:
 *
 *   within ±10%, protein at least the minimum  → On track       (on_plan)
 *   within ±10%, protein short                  → Protein short  (under)
 *   10–25% under                                → Below target   (under)
 *   10–25% over                                 → Slightly above (over)
 *   more than 25% under                         → Way below      (way_off)
 *   more than 25% over                          → Way above      (way_off)
 *
 * Event / travel is never suggested: that one is your call. Days with less
 * than 500 kcal logged are treated as not fully logged, so nothing is
 * suggested (a half-logged day would look like a big miss).
 */
export type DietBand = 'on_track' | 'protein_short' | 'below' | 'slightly_above' | 'way_below' | 'way_above';
export type AutoTag = Exclude<DietDay['tag'], 'event' | 'partial'>;

export interface DietVerdict {
  band: DietBand;
  /** What it saves as in the Diet card. */
  tag: AutoTag;
  label: string;
  /** Calories vs target, e.g. +0.07 for 7% over. */
  delta: number;
  kcal: number;
  protein: number;
  /** The note saved with it, e.g. "From food log: 2,610 / 2,450 kcal (+7%), protein 142 g. On track." */
  note: string;
}

export const MIN_LOGGED_KCAL = 500;
/** Notes the app wrote: a day carrying one follows the food log until you pick a tag yourself. */
export const FROM_LOG = 'From food log:';
const ON_TRACK = 0.1;
const WAY_OFF = 0.25;

const BAND: Record<DietBand, { tag: AutoTag; label: string }> = {
  on_track: { tag: 'on_plan', label: 'On track' },
  protein_short: { tag: 'under', label: 'Protein short' },
  below: { tag: 'under', label: 'Below target' },
  slightly_above: { tag: 'over', label: 'Slightly above' },
  way_below: { tag: 'way_off', label: 'Way below' },
  way_above: { tag: 'way_off', label: 'Way above' },
};

/** How each tag reads in the app. */
export const TAG_LABEL: Record<DietDay['tag'], string> = {
  on_plan: 'On track',
  under: 'Below target',
  over: 'Slightly above',
  way_off: 'Way off',
  partial: 'Partial (older)',
  event: 'Event / travel',
};

export function dietVerdict(logged: { kcal: number; protein: number }, target: { kcal: number; protein_min: number }): DietVerdict | null {
  if (!(target.kcal > 0) || logged.kcal < MIN_LOGGED_KCAL) return null;
  // Rounded so the band edges (±10%, ±25%) behave as written, free of float noise.
  const delta = Math.round((logged.kcal / target.kcal - 1) * 10000) / 10000;
  const band: DietBand =
    delta > WAY_OFF
      ? 'way_above'
      : delta > ON_TRACK
        ? 'slightly_above'
        : delta < -WAY_OFF
          ? 'way_below'
          : delta < -ON_TRACK
            ? 'below'
            : logged.protein >= target.protein_min
              ? 'on_track'
              : 'protein_short';
  const kcal = Math.round(logged.kcal);
  const protein = Math.round(logged.protein);
  const pct = `${delta >= 0 ? '+' : '−'}${Math.round(Math.abs(delta) * 100)}%`;
  const { tag, label } = BAND[band];
  return {
    band,
    tag,
    label,
    delta,
    kcal,
    protein,
    note: `${FROM_LOG} ${kcal.toLocaleString('en-IN')} / ${Math.round(target.kcal).toLocaleString('en-IN')} kcal (${pct}), protein ${protein} g. ${label}.`,
  };
}

export interface DietWrite {
  day: string;
  tag: AutoTag;
  kcal_estimate: number;
  notes: string;
}

/**
 * Every day up to `today` the food log can tag: days with enough logged
 * whose tag isn't yours. A day you tagged yourself (no food-log note, Event
 * included) is never touched; days already matching the log are skipped.
 */
export function backfillDiet(
  days: { day: string; kcal: number; protein: number }[],
  targetFor: (day: string) => { kcal: number; protein_min: number },
  existing: { day: string; tag: DietDay['tag']; kcal_estimate: number | null; notes?: string | null }[],
  today: string,
): DietWrite[] {
  const have = new Map(existing.map((d) => [d.day, d]));
  const out: DietWrite[] = [];
  for (const d of days) {
    if (d.day > today) continue;
    const row = have.get(d.day);
    if (row && !(row.notes ?? '').startsWith(FROM_LOG)) continue;
    const v = dietVerdict(d, targetFor(d.day));
    if (!v) continue;
    if (row && row.tag === v.tag && row.kcal_estimate === v.kcal && row.notes === v.note) continue;
    out.push({ day: d.day, tag: v.tag, kcal_estimate: v.kcal, notes: v.note });
  }
  return out.sort((a, b) => a.day.localeCompare(b.day));
}
