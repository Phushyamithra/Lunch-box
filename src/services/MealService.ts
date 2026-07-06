import { DEFAULT_MEALS, DEFAULT_SMOOTHIE_MEALS } from '../constants';
import { MEAL_CATEGORIES, type ImportSummary, type Meal, type MealCategory } from '../models';
import { createId } from '../utils/id';
import type { RawMealRow } from '../utils/spreadsheet';
import { storageService, type StorageService } from './StorageService';

/**
 * Business rules around the meal catalog: seeding, validation,
 * duplicate detection and spreadsheet import shaping.
 */
export class MealService {
  constructor(private readonly storage: StorageService) {}

  /**
   * Seeds the starter catalog exactly once, then returns the catalog.
   * Also runs one-time migrations for categories added after install
   * (e.g. Smoothies for users seeded before v1.1).
   */
  async ensureSeeded(): Promise<Meal[]> {
    const now = new Date().toISOString();

    const seeded = await this.storage.isSeeded();
    let meals = await this.storage.getMeals();
    if (!seeded && meals.length === 0) {
      meals = DEFAULT_MEALS.map((m) => ({ ...m, createdAt: now }));
      await this.storage.setMeals(meals);
    }
    if (!seeded) await this.storage.markSeeded();

    // Migration: existing installs get starter smoothies once.
    const smoothiesSeeded = await this.storage.isSmoothiesSeeded();
    if (!smoothiesSeeded) {
      if (!meals.some((m) => m.category === 'Smoothie')) {
        meals = [...meals, ...DEFAULT_SMOOTHIE_MEALS.map((m) => ({ ...m, createdAt: now }))];
        await this.storage.setMeals(meals);
      }
      await this.storage.markSmoothiesSeeded();
    }

    return meals;
  }

  /** "smoothie" / "Smoothies" / " SALAD " → canonical category, else null. */
  normalizeCategory(raw: string): MealCategory | null {
    const value = raw.trim().toLowerCase().replace(/s$/, '');
    return (
      MEAL_CATEGORIES.find((c) => c.toLowerCase().replace(/s$/, '') === value) ?? null
    );
  }

  /** Throws a user-friendly Error when a name/category pair is invalid. */
  validateNewMeal(name: string, category: MealCategory, existing: Meal[], excludeId?: string): void {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Please give the meal a name.');
    const duplicate = existing.some(
      (m) => m.id !== excludeId && this.dedupeKey(m.name, m.category) === this.dedupeKey(trimmed, category),
    );
    if (duplicate) throw new Error(`"${trimmed}" already exists in that category.`);
  }

  /**
   * Turns raw spreadsheet rows into new Meal entities plus an import
   * summary. Skips invalid rows and duplicates (against both the existing
   * catalog and earlier rows in the same file).
   */
  buildImport(rows: RawMealRow[], existing: Meal[]): { meals: Meal[]; summary: ImportSummary } {
    const seen = new Set(existing.map((m) => this.dedupeKey(m.name, m.category)));
    const meals: Meal[] = [];
    let duplicates = 0;
    let invalid = 0;
    const now = new Date().toISOString();

    for (const row of rows) {
      const category = this.normalizeCategory(row.category);
      if (!row.name || !category) {
        invalid += 1;
        continue;
      }
      const key = this.dedupeKey(row.name, category);
      if (seen.has(key)) {
        duplicates += 1;
        continue;
      }
      seen.add(key);
      meals.push({ id: createId('meal'), name: row.name, category, createdAt: now });
    }

    return { meals, summary: { imported: meals.length, duplicates, invalid } };
  }

  private dedupeKey(name: string, category: MealCategory): string {
    return `${category}::${name.trim().toLowerCase()}`;
  }
}

export const mealService = new MealService(storageService);
