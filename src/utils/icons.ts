import { getCategoryMeta } from '../constants';
import type { MealCategory } from '../models';

/**
 * Keyword → emoji rules, first match wins. Checked against the meal name;
 * when nothing matches, the category emoji is used. Order matters: put
 * more specific ingredients before generic ones.
 */
const NAME_ICON_RULES: [RegExp, string][] = [
  [/grilled\s*cheese|cheese/i, '🧀'],
  [/chicken/i, '🍗'],
  [/club|bacon/i, '🥓'],
  [/paneer/i, '🧀'],
  [/tofu|soya|soy/i, '🍱'],
  [/chocolate|choco/i, '🍫'],
  [/peanut|nut butter|almond/i, '🥜'],
  [/mango/i, '🥭'],
  [/banana/i, '🍌'],
  [/strawberry/i, '🍓'],
  [/berry|berries/i, '🫐'],
  [/melon|papaya/i, '🍈'],
  [/apple|fruit/i, '🍎'],
  [/avocado/i, '🥑'],
  [/greek|cucumber/i, '🥒'],
  [/broccoli|spinach|garden|green|kale|leaf/i, '🥬'],
  [/tomato/i, '🍅'],
  [/corn/i, '🌽'],
  [/beet/i, '🍠'],
  [/sprout|moong|chana|chickpea|rajma|bean|lentil/i, '🫘'],
  [/oat/i, '🌾'],
  [/mint/i, '🌿'],
  [/dragon/i, '🐉'],
  [/rainbow/i, '🌈'],
  [/egg/i, '🥚'],
  [/caesar/i, '🥗'],
];

/** Best-effort emoji for a meal, based on its name then its category. */
export function assignMealIcon(name: string, category: MealCategory): string {
  for (const [pattern, emoji] of NAME_ICON_RULES) {
    if (pattern.test(name)) return emoji;
  }
  return getCategoryMeta(category).emoji;
}
