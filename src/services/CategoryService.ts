import { getCategoryMeta, registerCategoryOverrides } from '../constants';
import type { Category, Meal } from '../models';
import { createId } from '../utils/id';
import { storageService, type StorageService } from './StorageService';

export interface CategoryInput {
  name: string;
  icon: string;
  color: string;
}

/**
 * Business rules for user-manageable categories. Categories are entities
 * (icon, color, order, enabled) whose `name` is the open-string key meals
 * reference. After every load/mutation the service registers overrides so
 * getCategoryMeta() serves custom icons/colors app-wide.
 */
export class CategoryService {
  constructor(private readonly storage: StorageService) {}

  private sort(categories: Category[]): Category[] {
    return [...categories].sort((a, b) => a.order - b.order);
  }

  private register(categories: Category[]): void {
    registerCategoryOverrides(categories);
  }

  private async persist(categories: Category[]): Promise<Category[]> {
    const sorted = this.sort(categories).map((c, i) => ({ ...c, order: i }));
    await this.storage.setCategories(sorted);
    this.register(sorted);
    return sorted;
  }

  private build(name: string, order: number): Category {
    const meta = getCategoryMeta(name);
    return {
      id: createId('cat'),
      name: name.trim(),
      icon: meta.emoji,
      color: meta.color,
      order,
      enabled: true,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * First run: creates entities for every category present in the catalog
   * (defaults included). Later runs: backfills entities for any meal
   * category missing from the list (e.g. arriving via import).
   */
  async ensureSeeded(meals: Meal[]): Promise<Category[]> {
    const seeded = await this.storage.isCategoriesSeeded();
    let categories = await this.storage.getCategories();

    if (!seeded) {
      const names = [...new Set(meals.map((m) => m.category))];
      categories = names.map((name, i) => this.build(name, i));
      categories = await this.persist(categories);
      await this.storage.markCategoriesSeeded();
      return categories;
    }

    const have = new Set(categories.map((c) => c.name.toLowerCase()));
    const missing = [...new Set(meals.map((m) => m.category))].filter(
      (n) => !have.has(n.toLowerCase()),
    );
    if (missing.length > 0) {
      categories = await this.persist([
        ...categories,
        ...missing.map((name, i) => this.build(name, categories.length + i)),
      ]);
    } else {
      this.register(categories);
    }
    return this.sort(categories);
  }

  private validateName(name: string, existing: Category[], excludeId?: string): void {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Please give the category a name.');
    if (existing.some((c) => c.id !== excludeId && c.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error(`A category named "${trimmed}" already exists.`);
    }
  }

  async add(categories: Category[], input: CategoryInput): Promise<Category[]> {
    this.validateName(input.name, categories);
    const category: Category = {
      id: createId('cat'),
      name: input.name.trim(),
      icon: input.icon,
      color: input.color,
      order: categories.length,
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    return this.persist([...categories, category]);
  }

  /** Ensures an entity exists for a (possibly new) category name. */
  async ensureCategory(categories: Category[], name: string): Promise<Category[]> {
    if (categories.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) {
      return categories;
    }
    return this.persist([...categories, this.build(name, categories.length)]);
  }

  /** Returns the updated list plus the previous name when renamed. */
  async update(
    categories: Category[],
    id: string,
    input: CategoryInput,
  ): Promise<{ categories: Category[]; previousName: string | null }> {
    const existing = categories.find((c) => c.id === id);
    if (!existing) throw new Error('Category not found.');
    this.validateName(input.name, categories, id);
    const renamed = existing.name !== input.name.trim();
    const updated = await this.persist(
      categories.map((c) =>
        c.id === id ? { ...c, name: input.name.trim(), icon: input.icon, color: input.color } : c,
      ),
    );
    return { categories: updated, previousName: renamed ? existing.name : null };
  }

  async setEnabled(categories: Category[], id: string, enabled: boolean): Promise<Category[]> {
    return this.persist(categories.map((c) => (c.id === id ? { ...c, enabled } : c)));
  }

  async move(categories: Category[], id: string, direction: 'up' | 'down'): Promise<Category[]> {
    const sorted = this.sort(categories);
    const index = sorted.findIndex((c) => c.id === id);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (index === -1 || target < 0 || target >= sorted.length) return sorted;
    [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
    return this.persist(sorted.map((c, i) => ({ ...c, order: i })));
  }

  async remove(categories: Category[], id: string): Promise<Category[]> {
    return this.persist(categories.filter((c) => c.id !== id));
  }
}

export const categoryService = new CategoryService(storageService);
