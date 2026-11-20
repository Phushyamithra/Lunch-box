import { describe, expect, it } from 'vitest';
import { dietVerdict } from './dietAuto';

const target = { kcal: 2450, protein_min: 140 };

describe('diet verdict from the food log', () => {
  it('is on plan within ±10% with enough protein', () => {
    expect(dietVerdict({ kcal: 2500, protein: 145 }, target)).toMatchObject({ band: 'on_plan', tag: 'on_plan', label: 'On plan' });
    expect(dietVerdict({ kcal: 2205, protein: 140 }, target)?.band).toBe('on_plan'); // −10% exactly
  });

  it('flags protein short even when calories are right', () => {
    expect(dietVerdict({ kcal: 2450, protein: 110 }, target)).toMatchObject({ band: 'protein_short', tag: 'partial' });
  });

  it('bands calories above and below', () => {
    expect(dietVerdict({ kcal: 2800, protein: 150 }, target)).toMatchObject({ band: 'slightly_above', tag: 'partial' }); // +14%
    expect(dietVerdict({ kcal: 3200, protein: 150 }, target)?.band).toBe('well_above'); // +31%
    expect(dietVerdict({ kcal: 2000, protein: 150 }, target)?.band).toBe('slightly_below'); // −18%
    expect(dietVerdict({ kcal: 1500, protein: 150 }, target)?.band).toBe('well_below'); // −39%
  });

  it('says nothing for a barely logged day or no target', () => {
    expect(dietVerdict({ kcal: 300, protein: 20 }, target)).toBeNull();
    expect(dietVerdict({ kcal: 2400, protein: 150 }, { kcal: 0, protein_min: 0 })).toBeNull();
  });

  it('writes a readable note', () => {
    expect(dietVerdict({ kcal: 2610, protein: 142 }, target)?.note).toBe('From food log: 2,610 / 2,450 kcal (+7%), protein 142 g. On plan.');
  });
});
