/**
 * Indian restaurant menus with official, published nutrition only. Values
 * are never estimated here: an item is listed only if the chain publishes
 * it. Logged entries keep a snapshot, so menu updates never change past days.
 */
import type { DietType, Nutrients } from '../foodLog';
import { CB_SIDES, CB_SOURCE } from './californiaBurrito';
import { DOMINOS, DOMINOS_SOURCE } from './dominos';
import { MCDONALDS, MCD_SOURCE } from './mcdonalds';
import type { Chain, ChainId, MenuItem, RawMenuItem, RawOption } from './types';

export const CHAINS: Chain[] = [
  {
    id: 'mcdonalds',
    name: "McDonald's India",
    emoji: '🍔',
    source: MCD_SOURCE,
    coverage: 'Full booklet for North & East India (Connaught Plaza). West & South stores (Westlife) use their own booklet; values are close but can differ.',
  },
  {
    id: 'dominos',
    name: "Domino's India",
    emoji: '🍕',
    source: DOMINOS_SOURCE,
    coverage: 'Pizzas by size and crust, sides, pastas and desserts from the official sheet. Each pizza serving is a set number of slices; log by slice if you ate less.',
  },
  {
    id: 'california-burrito',
    name: 'California Burrito',
    emoji: '🌯',
    source: CB_SOURCE,
    coverage: 'Build your burrito or bowl from the chain’s own per-ingredient values, plus sides.',
  },
];

/** Chains asked for that don't publish nutrition we could verify (shown, so nothing is guessed). */
export const NOT_AVAILABLE = [
  { name: 'Pizza Hut India', why: 'The nutrition booklet linked from pizzahut.co.in returns “not found” (checked 2026-10-19).' },
  { name: 'Subway India', why: 'No official Indian nutrition chart found; third-party figures aren’t used.' },
];

export function inferDiet(name: string): DietType {
  if (/chicken|fish|filet|fillet|sausage|nugget|wings|pepperoni|keema|mutton/i.test(name)) return 'nonveg';
  if (/\begg\b|mcegg/i.test(name)) return 'egg';
  return 'veg';
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const withIds = (chain: ChainId, items: RawMenuItem[]): MenuItem[] =>
  items.map((i) => ({ ...i, id: `${chain}:${slug(i.name)}`, chain, diet: i.diet ?? inferDiet(i.name) }));

export const MENU: MenuItem[] = [...withIds('mcdonalds', MCDONALDS), ...withIds('dominos', DOMINOS), ...withIds('california-burrito', CB_SIDES)];

export const chainOf = (id: ChainId): Chain => CHAINS.find((c) => c.id === id) as Chain;

/**
 * What you ate: `quantity` servings, or slices for pizzas (a serving is
 * `option.slices` slices).
 */
export function optionNutrients(option: RawOption, quantity: number, unit: 'serving' | 'slice'): Nutrients {
  const factor = unit === 'slice' ? quantity / (option.slices ?? 1) : quantity;
  const r1 = (v: number) => Math.round(v * factor * 10) / 10;
  return {
    kcal: Math.round(option.kcal * factor),
    protein: r1(option.protein),
    carbs: r1(option.carbs),
    fat: r1(option.fat),
    fibre: 0,
    sugar: option.sugar === null || option.sugar === undefined ? null : r1(option.sugar),
    sodium_mg: option.sodium_mg === null || option.sodium_mg === undefined ? null : Math.round(option.sodium_mg * factor),
  };
}

export function searchMenu(query: string, items: MenuItem[] = MENU): MenuItem[] {
  const norm = (s: string) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9 ]+/g, ' ');
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return items.filter((i) => {
    const hay = norm(`${i.name} ${chainOf(i.chain).name} ${i.category}`);
    return words.every((w) => hay.includes(w));
  });
}
