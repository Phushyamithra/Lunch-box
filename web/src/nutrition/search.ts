/**
 * Food search. Pure.
 * Matches every word of the query against name, brand, aliases (Hindi and
 * regional names) and category; ranks name hits first, your own foods
 * before the catalog on ties.
 */
import type { DietType, Food } from './foodLog';

export type DietFilter = 'veg' | 'egg' | 'all';

/** Veg shows veg + vegan; Egg adds egg dishes; All includes non-veg. */
export const dietAllowed = (diet: DietType | null, filter: DietFilter): boolean =>
  filter === 'all' || diet === null || diet === 'vegan' || diet === 'veg' || (filter === 'egg' && diet === 'egg');

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9 ]+/g, ' ');

export function searchFoods(foods: Food[], query: string, filter: DietFilter, limit = 60): Food[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const scored: { food: Food; score: number }[] = [];
  for (const f of foods) {
    if (!dietAllowed(f.diet, filter)) continue;
    const name = norm(f.name);
    const hay = `${name} ${norm(f.brand ?? '')} ${norm(f.aliases ?? '')} ${norm(f.category ?? '')}`;
    if (!words.every((w) => hay.includes(w))) continue;
    let score = 0;
    if (name.trim() === words.join(' ')) score += 40;
    if (name.startsWith(words[0])) score += 50;
    score += words.filter((w) => new RegExp(`\\b${w}`).test(name)).length * 20;
    score += words.filter((w) => name.includes(w)).length * 5;
    const aliases = norm(f.aliases ?? '');
    if (aliases.startsWith(words[0])) score += 10;
    if (f.user_id !== null) score += 8;
    scored.push({ food: f, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length || a.food.name.localeCompare(b.food.name))
    .slice(0, limit)
    .map((s) => s.food);
}
