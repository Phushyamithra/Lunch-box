/**
 * Turns the catalog into reference food rows. Pure.
 *
 * kcal for IFCT foods = 4 × protein + 9 × fat + 4 × available carbs + 2 ×
 * fibre (the same factors IFCT uses, in kcal). USDA foods keep USDA's kcal.
 * Dishes: sum each ingredient's nutrients for its grams, divide by the cooked
 * weight → per 100 g. Salt isn't in the recipes, so a dish's sodium is null.
 */
import type { DietType } from '../foodLog';
import { DISHES, INGREDIENTS, type Category, type DishDef, type IngredientDef, type PortionDef } from './catalog';
import { IFCT } from './ifct';
import { USDA, type RefNutrients } from './usda';

export interface ReferenceFood extends RefNutrients {
  code: string;
  name: string;
  aliases: string;
  category: Category;
  diet: DietType;
  basis: '100g' | '100ml';
  portions: PortionDef[];
  source: 'ifct' | 'usda' | 'recipe';
  verification: 'official' | 'estimated';
  source_url: string | null;
  notes: string;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
export const IFCT_URL = 'https://www.nin.res.in/ebooks/IFCT2017.pdf';
const usdaUrl = (id: number) => `https://fdc.nal.usda.gov/food-details/${id}/nutrients`;

/** Per-100 g nutrients and diet for an ingredient key ("A015" or "usda:butter"). */
export function ingredient(ref: string): RefNutrients & { name: string; diet: DietType; source: 'ifct' | 'usda'; url: string } {
  if (ref.startsWith('usda:')) {
    const u = USDA[ref.slice(5)];
    if (!u) throw new Error(`Unknown USDA ingredient ${ref}`);
    const diet: DietType = ['butter', 'cream', 'curd', 'honey'].includes(ref.slice(5)) ? 'veg' : 'vegan';
    const { fdcId, name, ...n } = u;
    return { ...n, name, diet, source: 'usda', url: usdaUrl(fdcId) };
  }
  const i = IFCT[ref];
  if (!i) throw new Error(`Unknown IFCT code ${ref}`);
  const kcal = Math.round(4 * i.protein + 9 * i.fat + 4 * i.carbs + 2 * i.fibre);
  return { name: i.name, kcal, protein: i.protein, fat: i.fat, carbs: i.carbs, fibre: i.fibre, sugar: i.sugar, sodium_mg: i.sodium_mg, diet: dietOfIfct(ref), source: 'ifct', url: IFCT_URL };
}

/** IFCT code letter → group: M eggs; N poultry; O meat; P–S fish and seafood; L milk; T013 ghee. */
function dietOfIfct(code: string): DietType {
  const g = code[0];
  if ('NOPQRS'.includes(g)) return 'nonveg';
  if (g === 'M') return 'egg';
  if (g === 'L' || code === 'T013') return 'veg';
  return 'vegan';
}

const DIET_RANK: Record<DietType, number> = { vegan: 0, veg: 1, egg: 2, nonveg: 3 };
export const combineDiet = (diets: DietType[]): DietType => diets.reduce((a, b) => (DIET_RANK[b] > DIET_RANK[a] ? b : a), 'vegan');

export function buildIngredient(d: IngredientDef): ReferenceFood {
  const n = ingredient(d.ref);
  return {
    code: d.code,
    name: d.name,
    aliases: d.aliases,
    category: d.category,
    diet: n.diet,
    basis: d.basis ?? '100g',
    portions: d.portions,
    kcal: n.kcal,
    protein: r1(n.protein),
    fat: r1(n.fat),
    carbs: r1(n.carbs),
    fibre: r1(n.fibre),
    sugar: n.sugar === null ? null : r1(n.sugar),
    sodium_mg: n.sodium_mg,
    source: n.source,
    verification: 'official',
    source_url: n.url,
    notes: n.source === 'ifct' ? `IFCT 2017 ${d.ref}: ${n.name}` : `USDA FoodData Central: ${n.name}`,
  };
}

export function buildDish(d: DishDef): ReferenceFood {
  const parts = d.recipe.map(([ref, g]) => ({ ref, g, n: ingredient(ref) }));
  const sum = (k: 'kcal' | 'protein' | 'fat' | 'carbs' | 'fibre') => parts.reduce((a, p) => a + (p.n[k] * p.g) / 100, 0);
  const sugar = parts.reduce((a, p) => a + ((p.n.sugar ?? 0) * p.g) / 100, 0);
  const per100 = (v: number) => (v * 100) / d.cooked_g;
  return {
    code: d.code,
    name: d.name,
    aliases: d.aliases,
    category: d.category,
    diet: combineDiet(parts.map((p) => p.n.diet)),
    basis: d.basis ?? '100g',
    portions: d.portions,
    kcal: Math.round(per100(sum('kcal'))),
    protein: r1(per100(sum('protein'))),
    fat: r1(per100(sum('fat'))),
    carbs: r1(per100(sum('carbs'))),
    fibre: r1(per100(sum('fibre'))),
    sugar: r1(per100(sugar)),
    sodium_mg: null,
    source: 'recipe',
    verification: 'estimated',
    source_url: IFCT_URL,
    notes: `Estimated from a typical recipe: ${parts.map((p) => `${p.g} g ${p.n.name.toLowerCase()}`).join(', ')} → ${d.cooked_g} g cooked. Salt not included; oil varies by kitchen.`,
  };
}

export function buildReferenceFoods(): ReferenceFood[] {
  return [...INGREDIENTS.map(buildIngredient), ...DISHES.map(buildDish)];
}
