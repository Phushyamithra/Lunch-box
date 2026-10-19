import { describe, expect, it } from 'vitest';
import type { Food } from './foodLog';
import { buildReferenceFoods } from './reference/build';
import { dietAllowed, searchFoods } from './search';

const catalog: Food[] = buildReferenceFoods().map((r) => ({
  ...r,
  id: r.code,
  user_id: null,
  brand: null,
  serving_g: null,
  parent_food_id: null,
  archived_at: null,
  ref_code: r.code,
}));
const mine: Food = { ...catalog.find((f) => f.ref_code === 'dish-toor-dal')!, id: 'mine', user_id: 'u', name: 'My dal (mom’s)', ref_code: null };
const names = (q: string, filter: 'veg' | 'egg' | 'all' = 'all') => searchFoods([...catalog, mine], q, filter).map((f) => f.name);

describe('food search', () => {
  it('finds by English, Hindi and regional names', () => {
    expect(names('arhar')).toContain('Toor dal tadka');
    expect(names('chawal')[0]).toMatch(/^Rice/);
    expect(names('thayir')).toContain('Curd rice');
    expect(names('golgappa')).toEqual(['Pani puri (6 pcs)']);
  });

  it('ranks name matches first and needs every word', () => {
    expect(names('paneer')[0]).toBe('Paneer');
    expect(names('dal')).toContain('My dal (mom’s)');
    expect(names('chicken curry')).toEqual(['Chicken curry']);
    expect(names('')).toEqual([]);
  });

  it('filters by diet: veg includes vegan, egg adds eggs, all adds non-veg', () => {
    expect(dietAllowed('vegan', 'veg')).toBe(true);
    expect(dietAllowed('egg', 'veg')).toBe(false);
    expect(dietAllowed('egg', 'egg')).toBe(true);
    expect(dietAllowed('nonveg', 'egg')).toBe(false);
    expect(names('curry', 'veg')).not.toContain('Chicken curry');
    expect(names('curry', 'egg')).toContain('Egg curry (2 eggs)');
    expect(names('curry', 'all')).toContain('Chicken curry');
  });
});
