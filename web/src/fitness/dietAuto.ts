import type { DietDay } from './rules';

/**
 * The Diet card's tag, worked out from the day's food log instead of by eye.
 * Pure.
 *
 * Calories against the day's target decide the band; protein has to reach
 * its minimum for a day to count as on plan:
 *
 *   within ±10% of target, protein at least the minimum → On plan   (on_plan)
 *   within ±10%, protein short                          → Protein short (partial)
 *   10–25% over                                          → Slightly above (partial)
 *   more than 25% over                                   → Well above (partial)
 *   10–25% under                                         → Slightly below (partial)
 *   more than 25% under                                  → Well below (partial)
 *
 * Event / travel is never suggested: that one is your call. Days with less
 * than 500 kcal logged are treated as not fully logged, so nothing is
 * suggested (a half-logged day would look like a big miss).
 */
export type DietBand = 'on_plan' | 'protein_short' | 'slightly_above' | 'well_above' | 'slightly_below' | 'well_below';

export interface DietVerdict {
  band: DietBand;
  /** What it saves as in the Diet card. */
  tag: Exclude<DietDay['tag'], 'event'>;
  label: string;
  /** Calories vs target, e.g. +0.07 for 7% over. */
  delta: number;
  kcal: number;
  protein: number;
  /** The note saved with it, e.g. "From food log: 2,610 / 2,450 kcal (+7%), protein 142 g". */
  note: string;
}

export const MIN_LOGGED_KCAL = 500;
const ON_PLAN = 0.1;
const WELL_OFF = 0.25;

const LABEL: Record<DietBand, string> = {
  on_plan: 'On plan',
  protein_short: 'Protein short',
  slightly_above: 'Slightly above',
  well_above: 'Well above',
  slightly_below: 'Slightly below',
  well_below: 'Well below',
};

export function dietVerdict(logged: { kcal: number; protein: number }, target: { kcal: number; protein_min: number }): DietVerdict | null {
  if (!(target.kcal > 0) || logged.kcal < MIN_LOGGED_KCAL) return null;
  const delta = logged.kcal / target.kcal - 1;
  const band: DietBand =
    delta > WELL_OFF
      ? 'well_above'
      : delta > ON_PLAN
        ? 'slightly_above'
        : delta < -WELL_OFF
          ? 'well_below'
          : delta < -ON_PLAN
            ? 'slightly_below'
            : logged.protein >= target.protein_min
              ? 'on_plan'
              : 'protein_short';
  const kcal = Math.round(logged.kcal);
  const protein = Math.round(logged.protein);
  const pct = `${delta >= 0 ? '+' : '−'}${Math.round(Math.abs(delta) * 100)}%`;
  return {
    band,
    tag: band === 'on_plan' ? 'on_plan' : 'partial',
    label: LABEL[band],
    delta,
    kcal,
    protein,
    note: `From food log: ${kcal.toLocaleString('en-IN')} / ${Math.round(target.kcal).toLocaleString('en-IN')} kcal (${pct}), protein ${protein} g. ${LABEL[band]}.`,
  };
}
