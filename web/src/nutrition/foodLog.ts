/**
 * Food log maths. Pure.
 *
 * Foods hold nutrients per 100 g, per 100 ml or per serving. A log entry
 * stores a *snapshot* of what it contributed, so editing a food (or a menu
 * update) never rewrites past days.
 */
import type { MacroTargets } from './engine';

export type Basis = '100g' | '100ml' | 'serving';
export type DietType = 'veg' | 'vegan' | 'egg' | 'nonveg';
export type Verification = 'official' | 'estimated' | 'user';
export type MealSlot = 'breakfast' | 'lunch' | 'snacks' | 'dinner';

export const MEALS: { key: MealSlot; label: string; emoji: string }[] = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { key: 'lunch', label: 'Lunch', emoji: '🍛' },
  { key: 'snacks', label: 'Snacks', emoji: '🍪' },
  { key: 'dinner', label: 'Dinner', emoji: '🌙' },
];

export const DIET: Record<DietType, { label: string; emoji: string }> = {
  veg: { label: 'Veg', emoji: '🟢' },
  vegan: { label: 'Vegan', emoji: '🌱' },
  egg: { label: 'Egg', emoji: '🥚' },
  nonveg: { label: 'Non-veg', emoji: '🔴' },
};

export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  sugar: number | null;
  sodium_mg: number | null;
}
export const NUTRIENT_KEYS = ['kcal', 'protein', 'carbs', 'fat', 'fibre', 'sugar', 'sodium_mg'] as const;
export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, sugar: null, sodium_mg: null };

export interface Portion {
  label: string;
  grams: number;
}

export interface Food extends Nutrients {
  id: string;
  /** null = shared reference food (Indian database, menus). */
  user_id: string | null;
  name: string;
  brand: string | null;
  diet: DietType | null;
  basis: Basis;
  /** Grams (or ml) in one serving; needed to log a per-serving food by weight. */
  serving_g: number | null;
  portions: Portion[];
  source: string;
  verification: Verification;
  parent_food_id: string | null;
  source_url: string | null;
  archived_at: string | null;
  /** Catalog foods: stable code, browse category, other names, how the values were made. */
  ref_code?: string | null;
  category?: string | null;
  aliases?: string;
  notes?: string | null;
  barcode?: string | null;
}

/** Units a food can be logged in: grams/ml, its household portions, servings. */
export interface UnitOption {
  key: string;
  label: string;
  /** Grams per 1 of this unit (null when unknown, e.g. a serving with no weight). */
  grams: number | null;
}

export function unitsFor(food: Pick<Food, 'basis' | 'serving_g' | 'portions'>): UnitOption[] {
  const g = food.basis === '100ml' ? 'ml' : 'g';
  const out: UnitOption[] = [];
  if (food.basis === 'serving') out.push({ key: 'serving', label: 'serving', grams: food.serving_g });
  if (food.basis !== 'serving' || food.serving_g) out.push({ key: g, label: g, grams: 1 });
  if (food.basis !== 'serving' && food.serving_g) out.push({ key: 'serving', label: `serving (${food.serving_g} ${g})`, grams: food.serving_g });
  for (const p of food.portions) out.push({ key: `p:${p.label}`, label: `${p.label} (${p.grams} ${g})`, grams: p.grams });
  return out;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** What `quantity` × `unit` of a food contributes, plus the grams if known. */
export function nutrientsFor(food: Food, quantity: number, unitKey: string): { nutrients: Nutrients; grams: number | null } {
  const unit = unitsFor(food).find((u) => u.key === unitKey);
  if (!unit) throw new Error(`Unknown unit “${unitKey}” for ${food.name}`);
  let factor: number;
  let grams: number | null = unit.grams === null ? null : unit.grams * quantity;
  if (food.basis === 'serving') {
    factor = unit.key === 'serving' ? quantity : (grams as number) / (food.serving_g as number);
  } else {
    factor = (grams as number) / 100;
  }
  if (grams !== null) grams = r1(grams);
  const scale = (v: number | null) => (v === null ? null : r1(v * factor));
  return {
    grams,
    nutrients: {
      kcal: Math.round(food.kcal * factor),
      protein: r1(food.protein * factor),
      carbs: r1(food.carbs * factor),
      fat: r1(food.fat * factor),
      fibre: r1(food.fibre * factor),
      sugar: scale(food.sugar),
      sodium_mg: food.sodium_mg === null ? null : Math.round(food.sodium_mg * factor),
    },
  };
}

export interface Entry extends Nutrients {
  id: string;
  day: string;
  meal: MealSlot;
  food_id: string | null;
  meal_log_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  grams: number | null;
  verification: Verification;
  source: 'food' | 'quick' | 'meal_prep' | 'restaurant';
  logged_at: string;
  deleted_at: string | null;
}

export function sumNutrients(rows: Nutrients[]): Nutrients {
  const out: Nutrients = { ...ZERO };
  for (const r of rows) {
    out.kcal += r.kcal;
    out.protein += r.protein;
    out.carbs += r.carbs;
    out.fat += r.fat;
    out.fibre += r.fibre;
    if (r.sugar !== null) out.sugar = (out.sugar ?? 0) + r.sugar;
    if (r.sodium_mg !== null) out.sodium_mg = (out.sodium_mg ?? 0) + r.sodium_mg;
  }
  return { ...out, protein: r1(out.protein), carbs: r1(out.carbs), fat: r1(out.fat), fibre: r1(out.fibre), sugar: out.sugar === null ? null : r1(out.sugar) };
}

export const liveEntries = (entries: Entry[], day: string) => entries.filter((e) => e.day === day && !e.deleted_at);

export function dayTotals(entries: Entry[], day: string): { total: Nutrients; byMeal: Record<MealSlot, { entries: Entry[]; total: Nutrients }> } {
  const live = liveEntries(entries, day).sort((a, b) => a.logged_at.localeCompare(b.logged_at));
  const byMeal = Object.fromEntries(
    MEALS.map(({ key }) => {
      const rows = live.filter((e) => e.meal === key);
      return [key, { entries: rows, total: sumNutrients(rows) }];
    }),
  ) as Record<MealSlot, { entries: Entry[]; total: Nutrients }>;
  return { total: sumNutrients(live), byMeal };
}

export interface MacroProgress {
  key: 'kcal' | 'protein' | 'carbs' | 'fat' | 'fibre';
  eaten: number;
  aim: number;
  min: number | null;
  max: number | null;
  remaining: number;
  status: 'under' | 'in_range' | 'over';
}

/**
 * Eaten vs target. Protein and fat use their ranges ("in range" between min
 * and max; over the max is shown as over, never praised).
 */
export function progressAgainst(total: Nutrients, t: MacroTargets): MacroProgress[] {
  const row = (key: MacroProgress['key'], eaten: number, aim: number, min: number | null, max: number | null): MacroProgress => {
    const lo = min ?? aim * 0.95;
    const hi = max ?? aim * 1.05;
    return { key, eaten, aim, min, max, remaining: Math.round((aim - eaten) * 10) / 10, status: eaten < lo ? 'under' : eaten > hi ? 'over' : 'in_range' };
  };
  return [
    row('kcal', total.kcal, t.kcal, null, null),
    row('protein', total.protein, t.protein_g, t.protein_min, t.protein_max),
    row('carbs', total.carbs, t.carbs_g, null, null),
    row('fat', total.fat, t.fat_g, t.fat_min, t.fat_max),
    { ...row('fibre', total.fibre, t.fibre_g, t.fibre_g, null), status: total.fibre >= t.fibre_g ? 'in_range' : 'under' },
  ];
}

/** Most-logged foods recently (by food, or by name for quick adds), for one-tap re-logging. */
export function frequentFoods(entries: Entry[], today: string, days = 30, limit = 8): { key: string; food_id: string | null; name: string; count: number; last: Entry }[] {
  const since = new Date(new Date(today).getTime() - days * 86400000).toISOString().slice(0, 10);
  const groups = new Map<string, { key: string; food_id: string | null; name: string; count: number; last: Entry }>();
  for (const e of entries) {
    if (e.deleted_at || e.day < since || e.day > today || e.source === 'meal_prep') continue;
    const key = e.food_id ?? `name:${e.name.toLowerCase()}`;
    const g = groups.get(key) ?? { key, food_id: e.food_id, name: e.name, count: 0, last: e };
    g.count += 1;
    if (e.logged_at > g.last.logged_at) g.last = e;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || b.last.logged_at.localeCompare(a.last.logged_at)).slice(0, limit);
}

/** Label energy vs 4/4/9 maths; flags big gaps (likely a typo) without blocking. */
export function energyCheck(n: Pick<Nutrients, 'kcal' | 'protein' | 'carbs' | 'fat'>): { computed: number; gapPct: number; ok: boolean } {
  const computed = Math.round(n.protein * 4 + n.carbs * 4 + n.fat * 9);
  const gapPct = n.kcal > 0 ? Math.round(((computed - n.kcal) / n.kcal) * 100) : computed > 0 ? 100 : 0;
  // Fibre, polyols and alcohol make label energy differ; 15% still counts as plausible.
  return { computed, gapPct, ok: Math.abs(gapPct) <= 15 || Math.abs(computed - n.kcal) <= 15 };
}

export interface FoodInput {
  name: string;
  brand: string | null;
  diet: DietType | null;
  basis: Basis;
  serving_g: number | null;
  portions: Portion[];
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  sugar: number | null;
  sodium_mg: number | null;
  /** Your edited copy of another food (that food stays as it was). */
  parent_food_id?: string | null;
  /** Packaged products: digits only (see barcode.ts). */
  barcode?: string | null;
  /** Where the values came from when it wasn't you (e.g. 'off' + the product page). */
  source?: string;
  source_url?: string | null;
}

export function validateFood(f: FoodInput): string | null {
  if (!f.name.trim()) return 'Give the food a name.';
  if (f.name.trim().length > 120) return 'Keep the name under 120 characters.';
  for (const k of ['kcal', 'protein', 'carbs', 'fat', 'fibre'] as const) if (!(f[k] >= 0)) return `${k === 'kcal' ? 'Calories' : k[0].toUpperCase() + k.slice(1)} must be 0 or more.`;
  if (f.basis !== 'serving' && f.protein + f.carbs + f.fat + f.fibre > 100) return 'Per 100 g, protein + carbs + fat + fibre can’t exceed 100 g.';
  if (f.serving_g !== null && !(f.serving_g > 0)) return 'Serving size must be more than 0.';
  if (f.portions.some((p) => !p.label.trim() || !(p.grams > 0))) return 'Each portion needs a name and a weight.';
  if (f.kcal > 2000 && f.basis !== 'serving') return 'More than 2,000 kcal per 100 g isn’t possible; check the number.';
  return null;
}

/** A meal-prep delivery's values as a log snapshot (one serving, as delivered). */
export function mealPrepSnapshot(meal: { name: string; calories: number; protein: number; carbs: number; fat: number; fiber: number }): Nutrients & { name: string } {
  return { name: meal.name, kcal: Math.round(meal.calories), protein: r1(meal.protein), carbs: r1(meal.carbs), fat: r1(meal.fat), fibre: r1(meal.fiber), sugar: null, sodium_mg: null };
}
