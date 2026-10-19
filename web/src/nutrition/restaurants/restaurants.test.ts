import { describe, expect, it } from 'vitest';
import { cbDefaults, cbGroups, cbTotal, CB_SIDES } from './californiaBurrito';
import { MENU, inferDiet, optionNutrients, searchMenu } from './index';

describe('restaurant menus', () => {
  it('has unique ids and every option has numbers', () => {
    expect(new Set(MENU.map((i) => i.id)).size).toBe(MENU.length);
    for (const i of MENU) for (const o of i.options) for (const k of ['kcal', 'protein', 'carbs', 'fat'] as const) expect(Number.isFinite(o[k]), `${i.id} ${o.label} ${k}`).toBe(true);
    expect(MENU.filter((i) => i.chain === 'mcdonalds').length).toBe(76);
    expect(MENU.filter((i) => i.chain === 'dominos').length).toBeGreaterThan(60);
  });

  it('every Domino’s row adds up (catches transcription slips)', () => {
    // Calories should match 4/4/9 within 6% (the sheet's own rounding).
    const off = MENU.filter((i) => i.chain === 'dominos').flatMap((i) =>
      i.options.filter((o) => Math.abs(4 * o.protein + 4 * o.carbs + 9 * o.fat - o.kcal) > Math.max(10, o.kcal * 0.06)).map((o) => `${i.name} ${o.label}: ${o.kcal}`),
    );
    expect(off).toEqual([]);
  });

  it('McDonald’s rows match the booklet’s own energy, except two items the booklet itself publishes that way', () => {
    const off = MENU.filter((i) => i.chain === 'mcdonalds').flatMap((i) =>
      i.options.filter((o) => o.kcal > 30 && Math.abs(4 * o.protein + 4 * o.carbs + 9 * o.fat - o.kcal) > o.kcal * 0.12).map(() => i.name),
    );
    expect(off.sort()).toEqual(['Chipotle Cheesy Dip', 'McSwirl Mango dip']);
  });

  it('logs by serving or by slice', () => {
    const marg = MENU.find((i) => i.name === 'Margherita')!;
    const medium = marg.options.find((o) => o.label === 'Medium · New Hand Tossed')!;
    expect(medium.slices).toBe(3);
    expect(optionNutrients(medium, 1, 'serving').kcal).toBe(581);
    expect(optionNutrients(medium, 2, 'slice').kcal).toBe(387); // 2 of the 3 slices
    expect(optionNutrients(MENU.find((i) => i.name === 'McVeggie Burger')!.options[0], 1, 'serving')).toMatchObject({ kcal: 388, protein: 10.2, sodium_mg: 706 });
  });

  it('marks veg / egg / non-veg and finds items by name or chain', () => {
    expect(inferDiet('McSpicy Chicken Burger')).toBe('nonveg');
    expect(inferDiet('McEgg Burger')).toBe('egg');
    expect(inferDiet('McAloo Tikki')).toBe('veg');
    expect(searchMenu('mcveggie').map((i) => i.name)).toEqual(['McVeggie Burger']);
    expect(searchMenu('dominos farmhouse').map((i) => i.name)).toEqual(['Farmhouse']);
    expect(searchMenu('')).toEqual([]);
  });
});

describe('California Burrito builder', () => {
  it('offers the chain’s choices for each meal and size', () => {
    const groups = cbGroups('burrito', 'regular').map((g) => g.key);
    expect(groups).toEqual(['tortilla', 'proteins', 'rice', 'beans', 'toppings', 'extraFillings', 'extraToppings', 'makeItRich']);
    expect(cbGroups('salad', 'regular').some((g) => g.key === 'dressing')).toBe(true);
  });

  it('adds up exactly what you pick (tortilla always included)', () => {
    const total = cbTotal({
      meal: 'burrito',
      size: 'regular',
      picks: { proteins: ['GRILLED BARBEQUE CHICKEN'], rice: ['BROWN RICE'], beans: ['BLACK BEANS'], toppings: ['SOUR CREAM', 'CHEESE'] },
    });
    // 142 tortilla + 190 + 135 + 94 + 57 + 23
    expect(total.kcal).toBe(641);
    expect(total.protein).toBeCloseTo(3.7 + 21.4 + 2.8 + 4.9 + 0.5 + 1.2, 1);
    expect(total.parts).toContain('brown rice');
  });

  it('starts from a sensible default and lists sides', () => {
    expect(Object.keys(cbDefaults('ricebowl', 'regular'))).toEqual(['proteins', 'rice', 'beans']);
    expect(CB_SIDES.length).toBe(12);
  });
});
