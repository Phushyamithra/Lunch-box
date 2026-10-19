import { describe, expect, it } from 'vitest';
import { energyCheck, validateFood } from '../foodLog';
import { buildDish, buildReferenceFoods, combineDiet, ingredient } from './build';
import { DISHES, INGREDIENTS } from './catalog';

const foods = buildReferenceFoods();
const byCode = new Map(foods.map((f) => [f.code, f]));

describe('reference catalog', () => {
  it('has unique codes and only known ingredients', () => {
    expect(new Set(foods.map((f) => f.code)).size).toBe(foods.length);
    expect(foods.length).toBe(INGREDIENTS.length + DISHES.length);
    for (const d of DISHES) for (const [ref] of d.recipe) expect(() => ingredient(ref)).not.toThrow();
  });

  it('every food passes the same checks as a food you enter yourself', () => {
    for (const f of foods) {
      expect(validateFood({ ...f, brand: null, serving_g: null }), f.code).toBeNull();
      expect(f.kcal, f.code).toBeGreaterThanOrEqual(0);
    }
  });

  it('calories agree with the macros (4/4/9 plus fibre) within label tolerance', () => {
    const off = foods.filter((f) => !energyCheck(f).ok && Math.abs(energyCheck(f).computed - f.kcal) > 20);
    expect(off.map((f) => `${f.code} ${f.kcal} vs ${energyCheck(f).computed}`)).toEqual([]);
  });

  it('IFCT and USDA ingredients are official; dishes are estimated and show their recipe', () => {
    expect(byCode.get('ing-toor-dal')).toMatchObject({ verification: 'official', source: 'ifct', protein: 21.7 });
    expect(byCode.get('ing-curd')).toMatchObject({ verification: 'official', source: 'usda', kcal: 61 });
    const dal = byCode.get('dish-toor-dal')!;
    expect(dal).toMatchObject({ verification: 'estimated', source: 'recipe', sodium_mg: null });
    expect(dal.notes).toContain('→ 250 g cooked');
  });

  it('works dishes out per 100 g of cooked food', () => {
    // 100 g raw rice → 300 g cooked: a third of the raw values.
    const raw = ingredient('A015');
    const cooked = buildDish({ code: 'x', name: 'x', aliases: '', category: 'Rice & grains', recipe: [['A015', 100]], cooked_g: 300, portions: [] });
    expect(cooked.kcal).toBe(Math.round(raw.kcal / 3));
    expect(cooked.carbs).toBeCloseTo(raw.carbs / 3, 1);
  });

  it('sensible ballparks for everyday foods', () => {
    expect(byCode.get('dish-roti')!.kcal).toBeGreaterThan(200); // ~80–100 kcal per 40 g roti
    expect(byCode.get('dish-roti')!.kcal).toBeLessThan(300);
    expect(byCode.get('dish-rice')!.kcal).toBeGreaterThan(100);
    expect(byCode.get('dish-rice')!.kcal).toBeLessThan(140);
    expect(byCode.get('ing-paneer')!.protein).toBeGreaterThan(15);
    expect(byCode.get('ing-ghee')!.fat).toBeGreaterThan(95);
  });

  it('works out veg / vegan / egg / non-veg from the ingredients', () => {
    expect(combineDiet(['vegan', 'veg'])).toBe('veg');
    expect(combineDiet(['veg', 'egg'])).toBe('egg');
    expect(combineDiet(['egg', 'nonveg', 'vegan'])).toBe('nonveg');
    expect(byCode.get('dish-toor-dal')!.diet).toBe('vegan');
    expect(byCode.get('dish-dal-makhani')!.diet).toBe('veg');
    expect(byCode.get('dish-egg-curry')!.diet).toBe('egg');
    expect(byCode.get('dish-chicken-biryani')!.diet).toBe('nonveg');
    expect(byCode.get('ing-honey')!.diet).toBe('veg');
  });
});
