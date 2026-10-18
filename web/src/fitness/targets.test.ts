import { describe, expect, it } from 'vitest';
import { validateTargets } from './FitnessSettingsPage';

const good = {
  gain_target_kg_month: '0.4',
  gain_high_kg_month: '0.6',
  gain_low_kg_month: '0.2',
  kcal_target: '2450',
  protein_min_g: '140',
  protein_max_g: '150',
  fat_min_g: '55',
  fat_max_g: '75',
  carbs_target_g: '295',
  waist_interval_days: '14',
  phase_months: '9',
  steps_target: '10000',
  cardio_per_week: '3',
  rest_compound_sec: '150',
  rest_isolation_sec: '75',
};

describe('validateTargets', () => {
  it('accepts the default targets and returns numbers', () => {
    expect(validateTargets(good)).toMatchObject({ kcal_target: 2450, protein_min_g: 140, gain_target_kg_month: 0.4 });
  });

  it('rejects inverted ranges and bad values', () => {
    expect(validateTargets({ ...good, protein_min_g: '160' })).toMatch(/Protein/);
    expect(validateTargets({ ...good, fat_max_g: '50' })).toMatch(/Fat/);
    expect(validateTargets({ ...good, gain_low_kg_month: '0.8' })).toMatch(/review below/);
    expect(validateTargets({ ...good, kcal_target: 'lots' })).toMatch(/Calories/);
    expect(validateTargets({ ...good, waist_interval_days: '0' })).toMatch(/Waist/);
    expect(validateTargets({ ...good, rest_compound_sec: '5' })).toMatch(/Rest/);
  });
});
