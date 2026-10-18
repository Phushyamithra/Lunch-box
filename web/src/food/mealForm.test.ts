import { describe, expect, it } from 'vitest';
import type { MealRow } from './foodApi';
import { validateMealForm } from './MealFormDialog';

const existing = [{ id: 'm1', name: 'Paneer Sandwich', category_id: 'c1' }] as MealRow[];
const form = (over: Record<string, string> = {}) => ({
  name: 'Veg Club',
  categoryId: 'c1',
  icon: '',
  notes: '',
  calories: '480',
  protein: '18',
  carbs: '',
  fat: '12.5',
  fiber: '',
  ...over,
});

describe('validateMealForm', () => {
  it('builds clean input; blank nutrients become 0', () => {
    expect(validateMealForm(form(), existing)).toEqual({
      name: 'Veg Club',
      categoryId: 'c1',
      icon: null,
      notes: null,
      calories: 480,
      protein: 18,
      carbs: 0,
      fat: 12.5,
      fiber: 0,
    });
  });

  it('rejects missing names, duplicates in the same category, and bad numbers', () => {
    expect(validateMealForm(form({ name: '  ' }), existing)).toMatch(/name/);
    expect(validateMealForm(form({ name: 'paneer sandwich' }), existing)).toMatch(/already exists/);
    expect(validateMealForm(form({ protein: '-1' }), existing)).toMatch(/Protein/);
    expect(validateMealForm(form({ calories: 'lots' }), existing)).toMatch(/Calories/);
  });

  it('allows the same name in another category, and editing a meal itself', () => {
    expect(typeof validateMealForm(form({ name: 'Paneer Sandwich', categoryId: 'c2' }), existing)).toBe('object');
    expect(typeof validateMealForm(form({ name: 'Paneer Sandwich' }), existing, 'm1')).toBe('object');
  });
});
