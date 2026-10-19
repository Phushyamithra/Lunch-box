import { describe, expect, it } from 'vitest';
import { LEAN_BULK_PRESET } from './engine';
import {
  dayTotals,
  energyCheck,
  frequentFoods,
  mealPrepSnapshot,
  nutrientsFor,
  progressAgainst,
  unitsFor,
  validateFood,
  type Entry,
  type Food,
} from './foodLog';

const food = (over: Partial<Food>): Food => ({
  id: 'f',
  user_id: 'u',
  name: 'Food',
  brand: null,
  diet: 'veg',
  basis: '100g',
  serving_g: null,
  portions: [],
  source: 'user',
  verification: 'user',
  parent_food_id: null,
  source_url: null,
  archived_at: null,
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fibre: 0,
  sugar: null,
  sodium_mg: null,
  ...over,
});

// Cooked toor dal per 100 g (illustrative numbers for the maths only).
const dal = food({ name: 'Dal', kcal: 116, protein: 6.8, carbs: 16.5, fat: 2.3, fibre: 3.2, portions: [{ label: '1 katori', grams: 150 }] });
const bar = food({ name: 'Protein bar', basis: 'serving', serving_g: 60, kcal: 240, protein: 20, carbs: 22, fat: 8, fibre: 4, sugar: 3, verification: 'official' });

describe('portions and scaling', () => {
  it('offers grams, household portions and servings', () => {
    expect(unitsFor(dal).map((u) => u.key)).toEqual(['g', 'p:1 katori']);
    expect(unitsFor(bar).map((u) => u.key)).toEqual(['serving', 'g']);
    expect(unitsFor({ ...bar, serving_g: null }).map((u) => u.key)).toEqual(['serving']);
  });

  it('scales per-100 g foods by weight, including household portions', () => {
    expect(nutrientsFor(dal, 1.5, 'p:1 katori')).toEqual({
      grams: 225,
      nutrients: { kcal: 261, protein: 15.3, carbs: 37.1, fat: 5.2, fibre: 7.2, sugar: null, sodium_mg: null },
    });
    expect(nutrientsFor(dal, 50, 'g').nutrients.kcal).toBe(58);
  });

  it('scales per-serving foods by servings, or by grams when the serving weight is known', () => {
    expect(nutrientsFor(bar, 2, 'serving').nutrients).toMatchObject({ kcal: 480, protein: 40, sugar: 6 });
    expect(nutrientsFor(bar, 30, 'g').nutrients).toMatchObject({ kcal: 120, protein: 10 });
    expect(() => nutrientsFor(bar, 1, 'p:cup')).toThrow(/Unknown unit/);
  });
});

const e = (over: Partial<Entry>): Entry => ({
  id: Math.random().toString(36),
  day: '2026-10-19',
  meal: 'lunch',
  food_id: null,
  meal_log_id: null,
  name: 'x',
  quantity: 1,
  unit: 'g',
  grams: null,
  verification: 'user',
  source: 'food',
  logged_at: '2026-10-19T12:00:00Z',
  deleted_at: null,
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fibre: 0,
  sugar: null,
  sodium_mg: null,
  ...over,
});

describe('daily totals', () => {
  const entries = [
    e({ meal: 'breakfast', kcal: 400, protein: 30, carbs: 40, fat: 12, fibre: 5 }),
    e({ meal: 'lunch', kcal: 700, protein: 35.5, carbs: 90, fat: 20, fibre: 8, sugar: 4 }),
    e({ meal: 'lunch', kcal: 100, protein: 2, deleted_at: '2026-10-19T13:00:00Z' }), // removed
    e({ meal: 'dinner', day: '2026-10-18', kcal: 900 }), // another day
  ];
  it('adds up live entries per meal and for the day', () => {
    const d = dayTotals(entries, '2026-10-19');
    expect(d.total).toEqual({ kcal: 1100, protein: 65.5, carbs: 130, fat: 32, fibre: 13, sugar: 4, sodium_mg: null });
    expect(d.byMeal.lunch.entries).toHaveLength(1);
    expect(d.byMeal.dinner.total.kcal).toBe(0);
  });

  it('compares with the targets using the protein and fat ranges', () => {
    const p = progressAgainst({ kcal: 2450, protein: 160, carbs: 295, fat: 60, fibre: 20, sugar: null, sodium_mg: null }, LEAN_BULK_PRESET);
    const by = Object.fromEntries(p.map((x) => [x.key, x]));
    expect(by.kcal).toMatchObject({ status: 'in_range', remaining: 0 });
    expect(by.protein).toMatchObject({ status: 'over', remaining: -15 }); // above 150 is over, not a win
    expect(by.fat.status).toBe('in_range');
    expect(by.fibre.status).toBe('under');
  });
});

describe('helpers', () => {
  it('ranks frequent foods from the last 30 days, ignoring removed and meal-prep entries', () => {
    const rows = [
      e({ food_id: 'dal', name: 'Dal' }),
      e({ food_id: 'dal', name: 'Dal', logged_at: '2026-10-19T20:00:00Z' }),
      e({ name: 'Chai', source: 'quick' }),
      e({ food_id: 'dal', name: 'Dal', deleted_at: 'x' }),
      e({ name: 'Old', day: '2026-08-01' }),
      e({ name: 'Delivery', source: 'meal_prep' }),
    ];
    const f = frequentFoods(rows, '2026-10-19');
    expect(f.map((x) => [x.name, x.count])).toEqual([
      ['Dal', 2],
      ['Chai', 1],
    ]);
  });

  it('checks label energy against 4/4/9 and validates foods', () => {
    expect(energyCheck({ kcal: 116, protein: 6.8, carbs: 16.5, fat: 2.3 }).ok).toBe(true);
    expect(energyCheck({ kcal: 50, protein: 20, carbs: 20, fat: 10 }).ok).toBe(false);
    expect(validateFood({ ...dal, name: ' ' })).toMatch(/name/);
    expect(validateFood({ ...dal, protein: 60, carbs: 60 })).toMatch(/exceed 100/);
    expect(validateFood({ ...dal, portions: [{ label: '1 katori', grams: 0 }] })).toMatch(/portion/);
    expect(validateFood(dal)).toBeNull();
  });

  it('turns a meal-prep delivery into a snapshot', () => {
    expect(mealPrepSnapshot({ name: 'Paneer bowl', calories: 612.4, protein: 38.25, carbs: 60, fat: 22, fiber: 7 })).toMatchObject({ kcal: 612, protein: 38.3, fibre: 7 });
  });
});
