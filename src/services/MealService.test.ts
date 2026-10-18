import { describe, expect, it } from 'vitest';
import { EMPTY_NUTRITION } from '../constants';
import type { Meal } from '../models';
import { MemoryStorageAdapter } from '../test/MemoryStorageAdapter';
import type { RawMealRow } from '../utils/spreadsheet';
import { MealService } from './MealService';
import { StorageService } from './StorageService';

const service = new MealService(new StorageService(new MemoryStorageAdapter()));
const existing: Meal[] = [
  { id: 'm1', name: 'Paneer Sandwich', category: 'Sandwich', nutrition: EMPTY_NUTRITION, createdAt: 'x' },
];
const row = (name: string, category: string, rowIndex: number): RawMealRow => ({
  name,
  category,
  nutrition: EMPTY_NUTRITION,
  rowIndex,
});

describe('MealService', () => {
  it('normalizes categories (trim, drop trailing s, capitalize)', () => {
    expect(service.normalizeCategory('  salads ')).toBe('Salad');
    expect(service.normalizeCategory('smoothie')).toBe('Smoothie');
    expect(service.normalizeCategory('   ')).toBeNull();
  });

  it('import is merge-only: skips duplicates (case-insensitive) and invalid rows', () => {
    const { meals, summary } = service.buildImport(
      [
        row('paneer sandwich', 'Sandwich', 2),
        row('Greek Salad', 'salads', 3),
        row('Greek Salad', 'Salad', 4),
        row('', 'Salad', 5),
        row('', '', 6),
      ],
      existing,
    );
    expect(meals.map((m) => [m.name, m.category])).toEqual([['Greek Salad', 'Salad']]);
    expect(summary).toEqual({ imported: 1, duplicates: 2, invalid: 1 });
  });

  it('rejects duplicate names in the same category but allows editing itself', () => {
    expect(() => service.validateNewMeal('PANEER sandwich', 'Sandwich', existing)).toThrow();
    expect(() =>
      service.validateNewMeal('Paneer Sandwich', 'Sandwich', existing, 'm1'),
    ).not.toThrow();
  });

  it('sanitizes negative and non-numeric nutrition values to 0', () => {
    expect(service.sanitizeNutrition({ calories: -5, protein: Number.NaN, carbs: 12 })).toEqual({
      calories: 0,
      protein: 0,
      carbs: 12,
      fiber: 0,
      fat: 0,
    });
  });
});
