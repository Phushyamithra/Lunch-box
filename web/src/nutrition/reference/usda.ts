/**
 * Staples missing from IFCT 2017 (sugar, butter, curd…), from USDA
 * FoodData Central, SR Legacy (public domain), per 100 g. Fetched 2026-10-19.
 * Carbs are *available* carbohydrate (USDA "by difference" minus fibre) to
 * match IFCT; kcal is USDA's own value.
 */
export interface RefNutrients {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fibre: number;
  sugar: number | null;
  sodium_mg: number | null;
}

export const USDA: Record<string, RefNutrients & { name: string; fdcId: number }> = {
  butter: { fdcId: 173410, name: 'Butter, salted', kcal: 717, protein: 0.85, fat: 81.1, carbs: 0.06, fibre: 0, sugar: 0.06, sodium_mg: 643 },
  sugar: { fdcId: 169655, name: 'Sugars, granulated', kcal: 387, protein: 0, fat: 0, carbs: 100, fibre: 0, sugar: 99.8, sodium_mg: 1 },
  honey: { fdcId: 169640, name: 'Honey', kcal: 304, protein: 0.3, fat: 0, carbs: 82.2, fibre: 0.2, sugar: 82.1, sodium_mg: 4 },
  cream: { fdcId: 170859, name: 'Cream, fluid, heavy whipping', kcal: 340, protein: 2.84, fat: 36.1, carbs: 2.84, fibre: 0, sugar: 2.92, sodium_mg: 27 },
  curd: { fdcId: 171284, name: 'Yogurt, plain, whole milk', kcal: 61, protein: 3.47, fat: 3.25, carbs: 4.66, fibre: 0, sugar: 4.66, sodium_mg: 46 },
  oats: { fdcId: 173904, name: 'Cereals, oats, regular and quick, not fortified, dry', kcal: 379, protein: 13.2, fat: 6.52, carbs: 57.6, fibre: 10.1, sugar: 0.99, sodium_mg: 6 },
  peanut_butter: { fdcId: 172470, name: 'Peanut butter, smooth style, without salt', kcal: 598, protein: 22.2, fat: 51.4, carbs: 17.3, fibre: 5, sugar: 10.5, sodium_mg: 17 },
  soy_flour_defatted: { fdcId: 174275, name: 'Soy flour, defatted', kcal: 327, protein: 51.5, fat: 1.22, carbs: 16.4, fibre: 17.5, sugar: 16.4, sodium_mg: 20 },
};
