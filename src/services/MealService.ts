import { EMPTY_NUTRITION } from '../constants';
import { DEFAULT_MEAL_DATABASE } from '../data/defaultMeals';
import type { ImportSummary, Meal, MealCategory, Nutrition } from '../models';
import { assignMealIcon } from '../utils/icons';
import { createId } from '../utils/id';
import type { RawMealRow } from '../utils/spreadsheet';
import { storageService, type StorageService } from './StorageService';

export interface MealInput {
  name: string;
  category: MealCategory;
  nutrition: Nutrition;
}

/**
 * Business rules around the meal catalog: seeding from the bundled
 * workbook, migrations, validation, duplicate detection and import shaping.
 */
export class MealService {
  constructor(private readonly storage: StorageService) {}

  /**
   * Fresh installs: seed the full default meal database (from the bundled
   * workbook) with nutrition + auto-assigned icons.
   * Existing installs: one-time migration that backfills nutrition/icons
   * on user meals and merges in workbook meals that aren't already present.
   */
  async ensureSeeded(): Promise<Meal[]> {
    const now = new Date().toISOString();

    const seeded = await this.storage.isSeeded();
    let meals = await this.storage.getMeals();

    if (!seeded && meals.length === 0) {
      meals = DEFAULT_MEAL_DATABASE.map((row) => ({
        ...row,
        icon: assignMealIcon(row.name, row.category),
        createdAt: now,
      }));
      await this.storage.setMeals(meals);
      await Promise.all([this.storage.markSeeded(), this.storage.markWorkbookSeeded()]);
      return meals;
    }
    if (!seeded) await this.storage.markSeeded();

    const workbookSeeded = await this.storage.isWorkbookSeeded();
    if (!workbookSeeded) {
      const existingKeys = new Map(meals.map((m) => [this.dedupeKey(m.name, m.category), m]));

      // 1. Backfill nutrition (from workbook when names match) and icons.
      meals = meals.map((meal) => {
        const workbookMatch = DEFAULT_MEAL_DATABASE.find(
          (row) => this.dedupeKey(row.name, row.category) === this.dedupeKey(meal.name, meal.category),
        );
        return {
          ...meal,
          nutrition: meal.nutrition ?? workbookMatch?.nutrition ?? { ...EMPTY_NUTRITION },
          icon: meal.icon ?? assignMealIcon(meal.name, meal.category),
        };
      });

      // 2. Merge workbook meals the user doesn't have yet (never overwrite).
      for (const row of DEFAULT_MEAL_DATABASE) {
        if (!existingKeys.has(this.dedupeKey(row.name, row.category))) {
          meals.push({
            id: createId('meal'),
            name: row.name,
            category: row.category,
            nutrition: row.nutrition,
            icon: assignMealIcon(row.name, row.category),
            createdAt: now,
          });
        }
      }

      await this.storage.setMeals(meals);
      await this.storage.markWorkbookSeeded();
    }

    return meals;
  }

  /**
   * Canonicalizes a category string: trims, singularizes a trailing "s",
   * and title-cases. Any non-empty category is valid — new categories
   * work without code changes. Returns null only for blank input.
   */
  normalizeCategory(raw: string): MealCategory | null {
    let value = raw.trim();
    if (!value) return null;
    if (value.length > 3 && /s$/i.test(value)) value = value.slice(0, -1);
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  /** Throws a user-friendly Error when a name/category pair is invalid. */
  validateNewMeal(name: string, category: MealCategory, existing: Meal[], excludeId?: string): void {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Please give the meal a name.');
    if (!category.trim()) throw new Error('Please choose a category.');
    const duplicate = existing.some(
      (m) => m.id !== excludeId && this.dedupeKey(m.name, m.category) === this.dedupeKey(trimmed, category),
    );
    if (duplicate) throw new Error(`"${trimmed}" already exists in that category.`);
  }

  /** Builds a Meal entity from validated input. */
  createMeal(input: MealInput): Meal {
    return {
      id: createId('meal'),
      name: input.name.trim(),
      category: input.category,
      nutrition: this.sanitizeNutrition(input.nutrition),
      icon: assignMealIcon(input.name, input.category),
      createdAt: new Date().toISOString(),
    };
  }

  /** Non-numeric / negative nutrition values become 0. */
  sanitizeNutrition(nutrition: Partial<Nutrition> | undefined): Nutrition {
    const clean = { ...EMPTY_NUTRITION };
    for (const key of Object.keys(clean) as (keyof Nutrition)[]) {
      const value = Number(nutrition?.[key]);
      clean[key] = Number.isFinite(value) && value > 0 ? value : 0;
    }
    return clean;
  }

  /**
   * Turns raw spreadsheet rows into new Meal entities plus an import
   * summary. Merge-only: skips blank/invalid rows and duplicates (against
   * both the existing catalog and earlier rows in the same file) — user
   * meals are preserved and never overwritten.
   */
  buildImport(rows: RawMealRow[], existing: Meal[]): { meals: Meal[]; summary: ImportSummary } {
    const seen = new Set(existing.map((m) => this.dedupeKey(m.name, m.category)));
    const meals: Meal[] = [];
    let duplicates = 0;
    let invalid = 0;
    const now = new Date().toISOString();

    for (const row of rows) {
      if (!row.name && !row.category) continue; // fully blank row — ignore silently
      const category = row.category ? this.normalizeCategory(row.category) : null;
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
      meals.push({
        id: createId('meal'),
        name: row.name,
        category,
        nutrition: this.sanitizeNutrition(row.nutrition),
        icon: assignMealIcon(row.name, category),
        createdAt: now,
      });
    }

    return { meals, summary: { imported: meals.length, duplicates, invalid } };
  }

  private dedupeKey(name: string, category: MealCategory): string {
    return `${category.trim().toLowerCase()}::${name.trim().toLowerCase()}`;
  }
}

export const mealService = new MealService(storageService);
