/**
 * Staples missing from IFCT 2017 (sugar, butter, curd…), from USDA
 * FoodData Central, SR Legacy (public domain), per 100 g. Fetched 2026-10-19.
 * Carbs are *available* carbohydrate (USDA "by difference" minus fibre) to
 * match IFCT; kcal is USDA's own value. Chocolate, cocoa, rice flour, coconut
 * milk and mozzarella fetched 2026-11-20 (coconut milk has no fibre or sugar
 * in its record, so fibre is 0 and sugar blank).
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
  cocoa: { fdcId: 169593, name: 'Cocoa, dry powder, unsweetened', kcal: 228, protein: 19.6, fat: 13.7, carbs: 20.9, fibre: 37, sugar: 1.75, sodium_mg: 21 },
  milk_chocolate: { fdcId: 167587, name: 'Candies, milk chocolate', kcal: 535, protein: 7.65, fat: 29.7, carbs: 56, fibre: 3.4, sugar: 51.5, sodium_mg: 79 },
  dark_chocolate: { fdcId: 170273, name: 'Chocolate, dark, 70-85% cacao solids', kcal: 598, protein: 7.79, fat: 42.6, carbs: 35, fibre: 10.9, sugar: 24, sodium_mg: 20 },
  rice_flour: { fdcId: 169714, name: 'Rice flour, white, unenriched', kcal: 366, protein: 5.95, fat: 1.42, carbs: 77.7, fibre: 2.4, sugar: 0.12, sodium_mg: 0 },
  coconut_milk: { fdcId: 170173, name: 'Nuts, coconut milk, canned (liquid expressed from grated meat and water)', kcal: 197, protein: 2.02, fat: 21.3, carbs: 2.81, fibre: 0, sugar: null, sodium_mg: 13 },
  mozzarella: { fdcId: 170845, name: 'Cheese, mozzarella, whole milk', kcal: 299, protein: 22.2, fat: 22.1, carbs: 2.4, fibre: 0, sugar: 0, sodium_mg: 486 },
  cream_cheese: { fdcId: 173418, name: 'Cheese, cream', kcal: 350, protein: 6.15, fat: 34.4, carbs: 5.52, fibre: 0, sugar: 3.76, sodium_mg: 314 },
  // Popcorn and snacks, fetched 2026-11-22. Lotus seeds have no fibre or sugar in their record.
  popcorn_air: { fdcId: 167959, name: 'Snacks, popcorn, air-popped', kcal: 387, protein: 12.9, fat: 4.54, carbs: 63.3, fibre: 14.5, sugar: 0.87, sodium_mg: 8 },
  popcorn_oil_salted: { fdcId: 170247, name: 'Snacks, popcorn, oil-popped, white popcorn, salt added', kcal: 500, protein: 9, fat: 28.1, carbs: 47.2, fibre: 10, sugar: null, sodium_mg: 884 },
  popcorn_microwave: { fdcId: 167549, name: 'Snacks, popcorn, oil-popped, microwave, regular flavor, no trans fat', kcal: 583, protein: 7.29, fat: 43.6, carbs: 37, fibre: 8.1, sugar: 0.46, sodium_mg: 909 },
  popcorn_microwave_lowfat: { fdcId: 174778, name: 'Snacks, popcorn, microwave, low fat', kcal: 424, protein: 12.6, fat: 9.5, carbs: 57.8, fibre: 14.2, sugar: 0.92, sodium_mg: 629 },
  popcorn_caramel: { fdcId: 167552, name: 'Snacks, popcorn, caramel-coated, without peanuts', kcal: 431, protein: 3.8, fat: 12.8, carbs: 73.9, fibre: 5.2, sugar: 53.2, sodium_mg: 206 },
  popcorn_cheese: { fdcId: 167960, name: 'Snacks, popcorn, cheese-flavor', kcal: 526, protein: 9.3, fat: 33.2, carbs: 41.7, fibre: 9.9, sugar: 0.79, sodium_mg: 889 },
  potato_chips: { fdcId: 169677, name: 'Snacks, potato chips, plain, salted', kcal: 532, protein: 6.39, fat: 34, carbs: 50.7, fibre: 3.1, sugar: 0.33, sodium_mg: 527 },
  tortilla_chips: { fdcId: 167558, name: 'Snacks, tortilla chips, plain, white corn, salted', kcal: 472, protein: 7.1, fat: 20.7, carbs: 62.4, fibre: 5.4, sugar: 0.78, sodium_mg: 328 },
  cheese_puffs: { fdcId: 167949, name: 'Snacks, corn-based, extruded, puffs or twists, cheese-flavor', kcal: 567, protein: 5.46, fat: 36.5, carbs: 53.7, fibre: 0.8, sugar: 3.57, sodium_mg: 928 },
  lotus_seeds: { fdcId: 170149, name: 'Seeds, lotus seeds, dried', kcal: 332, protein: 15.4, fat: 1.97, carbs: 64.5, fibre: 0, sugar: null, sodium_mg: 5 },
  soy_flour_defatted: { fdcId: 174275, name: 'Soy flour, defatted', kcal: 327, protein: 51.5, fat: 1.22, carbs: 16.4, fibre: 17.5, sugar: 16.4, sodium_mg: 20 },
};
