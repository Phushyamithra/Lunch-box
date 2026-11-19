/**
 * California Burrito (India): build-your-own from the chain's own nutrition
 * calculator (californiaburrito.in/nutrition, data captured 2026-10-19).
 * Every component's values are the chain's; a bowl or burrito is the sum of
 * what you pick, exactly as their calculator adds it up.
 */
import data from './californiaBurritoData.json';
import type { RawMenuItem } from './types';

export const CB_SOURCE = {
  title: 'California Burrito nutrition calculator',
  url: 'https://californiaburrito.in/nutrition',
  captured: '2026-10-19',
};

export interface CbComponent {
  name: string;
  cal: number;
  fat: number;
  protein: number;
  carbs: number;
}
export type CbMeal = 'burrito' | 'ricebowl' | 'salad';
export interface CbGroup {
  key: string;
  label: string;
  /** one = pick exactly one; many = any number; fixed = always included. */
  pick: 'one' | 'many' | 'fixed';
  options: CbComponent[];
}

type Sized = Record<string, CbComponent[]>;
type CbItem = CbComponent & { type?: 'veg' | 'nonveg' };
const D = data as unknown as Record<string, Record<string, Sized | CbComponent[]>> & {
  sides: CbComponent[];
  /** Ready-made items from the same calculator (captured 2026-11-20). */
  menu: Record<'desserts' | 'munchies' | 'dips' | 'quesadillas' | 'quesadillaAddOns' | 'overcrowdedTacos', CbItem[]>;
};

export const CB_MEALS: { key: CbMeal; label: string; emoji: string }[] = [
  { key: 'burrito', label: 'Burrito', emoji: '🌯' },
  { key: 'ricebowl', label: 'Rice bowl', emoji: '🍚' },
  { key: 'salad', label: 'Salad bowl', emoji: '🥗' },
];

const SIZES: Record<CbMeal, string[]> = {
  burrito: ['regular', 'mini', 'habanero'],
  ricebowl: ['regular', 'mini', 'pro'],
  salad: ['regular', 'mini', 'pro'],
};
export const cbSizes = (meal: CbMeal) => SIZES[meal];

const GROUPS: { key: string; label: string; pick: CbGroup['pick'] }[] = [
  { key: 'tortilla', label: 'Tortilla', pick: 'fixed' },
  { key: 'proteins', label: 'Filling', pick: 'one' },
  { key: 'rice', label: 'Rice', pick: 'one' },
  { key: 'beans', label: 'Beans', pick: 'one' },
  { key: 'toppings', label: 'Toppings', pick: 'many' },
  { key: 'dressing', label: 'Dressing', pick: 'one' },
  { key: 'extraFillings', label: 'Extra filling', pick: 'many' },
  { key: 'extraToppings', label: 'Extra toppings', pick: 'many' },
  { key: 'makeItRich', label: 'Make it rich', pick: 'many' },
];

/** The choices for a meal and size, as the chain's calculator offers them. */
export function cbGroups(meal: CbMeal, size: string): CbGroup[] {
  const m = D[meal] as Record<string, Sized | CbComponent[]>;
  return GROUPS.flatMap((g) => {
    const raw = m[g.key];
    if (!raw) return [];
    const options = Array.isArray(raw) ? raw : (raw[size] ?? raw.regular ?? []);
    return options.length ? [{ ...g, options }] : [];
  });
}

export interface CbSelection {
  meal: CbMeal;
  size: string;
  /** group key → chosen component names */
  picks: Record<string, string[]>;
}

/** Sum of the picked components (fixed groups always included). */
export function cbTotal(sel: CbSelection): { kcal: number; protein: number; carbs: number; fat: number; parts: string[] } {
  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  const parts: string[] = [];
  for (const g of cbGroups(sel.meal, sel.size)) {
    const chosen = g.pick === 'fixed' ? g.options : g.options.filter((o) => (sel.picks[g.key] ?? []).includes(o.name));
    for (const c of chosen) {
      kcal += c.cal;
      protein += c.protein;
      carbs += c.carbs;
      fat += c.fat;
      if (c.cal > 0) parts.push(c.name.toLowerCase());
    }
  }
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return { kcal: Math.round(kcal), protein: r1(protein), carbs: r1(carbs), fat: r1(fat), parts };
}

/** A sensible starting build: the first option of each pick-one group. */
export function cbDefaults(meal: CbMeal, size: string): Record<string, string[]> {
  return Object.fromEntries(cbGroups(meal, size).filter((g) => g.pick === 'one').map((g) => [g.key, [g.options[0].name]]));
}

/** "CHEESY CHIPOTLE CHICKEN" → "Cheesy chipotle chicken"; mixed-case names stay as they are. */
const tidy = (name: string) => (name === name.toUpperCase() ? `${name[0]}${name.slice(1).toLowerCase()}` : name);
const dietOf = (c: CbItem) => (c.type === 'nonveg' || /chicken/i.test(c.name) ? 'nonveg' : 'veg') as 'veg' | 'nonveg';
const item = (c: CbItem, category: string, suffix: string, label: string): RawMenuItem => ({
  name: `${tidy(c.name)}${suffix}`,
  category,
  diet: dietOf(c),
  options: [{ label, kcal: c.cal, protein: c.protein, carbs: c.carbs, fat: c.fat }],
});

/** Desserts, munchies, quesadillas, Overcrowded tacos, dips and add-ons, each as the calculator lists it. */
export const CB_ITEMS: RawMenuItem[] = [
  ...D.menu.desserts.map((c) => item(c, 'Desserts', '', '1 serving')),
  ...D.menu.quesadillas.map((c) => item(c, 'Quesadillas', ' quesadilla', '1 quesadilla (no dip or add-ons)')),
  ...D.menu.overcrowdedTacos.map((c) => item(c, 'Tacos', ' (Overcrowded)', '1 Overcrowded taco plate')),
  ...D.menu.munchies.map((c) => item(c, 'Munchies', '', '1 serving')),
  ...D.menu.dips.map((c) => item(c, 'Dips & add-ons', ' (dip)', '1 dip')),
  ...D.menu.quesadillaAddOns.map((c) => item(c, 'Dips & add-ons', ' (quesadilla add-on)', '1 add-on')),
];

/** Sides sold on their own (whole portion, as the calculator lists them). */
export const CB_SIDES: RawMenuItem[] = D.sides.map((s) => ({
  name: `${s.name[0]}${s.name.slice(1).toLowerCase()} (side)`,
  category: 'Sides',
  diet: /chicken/i.test(s.name) ? 'nonveg' : 'veg',
  options: [{ label: 'Side portion', kcal: s.cal, protein: s.protein, carbs: s.carbs, fat: s.fat }],
}));
