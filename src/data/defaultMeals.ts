import type { Nutrition } from '../models';

/**
 * Default meal database, generated from the bundled workbook
 * (public/data/default-meals.xlsx — original preserved verbatim).
 * Seeded into storage on first launch; icons are assigned at seed time
 * by utils/icons.ts. Regenerate this file when the workbook changes.
 */
export interface DefaultMealRow {
  id: string;
  name: string;
  category: string;
  nutrition: Nutrition;
}

export const DEFAULT_MEAL_DATABASE: readonly DefaultMealRow[] = [
  { id: 'meal_001', name: 'Peanut Cucumber Crunch', category: 'Salad', nutrition: { calories: 200, protein: 7, carbs: 13.5, fiber: 3.5, fat: 13 } },
  { id: 'meal_002', name: 'Moong Chaat Salad', category: 'Salad', nutrition: { calories: 240, protein: 13, carbs: 37.5, fiber: 9, fat: 2.5 } },
  { id: 'meal_003', name: 'Black Chana Salad (Desi Street Style)', category: 'Salad', nutrition: { calories: 260, protein: 13.5, carbs: 40.5, fiber: 10, fat: 3.5 } },
  { id: 'meal_004', name: 'Corn & Veggie Salad', category: 'Salad', nutrition: { calories: 220, protein: 6, carbs: 30, fiber: 4.5, fat: 9 } },
  { id: 'meal_005', name: 'Honey Mustard Corn Salad', category: 'Salad', nutrition: { calories: 240, protein: 5, carbs: 34, fiber: 4.5, fat: 10 } },
  { id: 'meal_006', name: 'Mix Sprout Salad', category: 'Salad', nutrition: { calories: 250, protein: 13.5, carbs: 34, fiber: 8, fat: 5 } },
  { id: 'meal_007', name: 'Soya Chunk Power Bowl', category: 'Salad', nutrition: { calories: 305, protein: 22, carbs: 27.5, fiber: 7, fat: 11.5 } },
  { id: 'meal_008', name: 'Broccoli Sesame Salad', category: 'Salad', nutrition: { calories: 240, protein: 11, carbs: 26, fiber: 7, fat: 11 } },
  { id: 'meal_009', name: 'Rajma Salad', category: 'Salad', nutrition: { calories: 280, protein: 13, carbs: 42.5, fiber: 11, fat: 6 } },
  { id: 'meal_010', name: 'Tangy Raw Mango Moong Salad', category: 'Salad', nutrition: { calories: 270, protein: 11, carbs: 34, fiber: 7, fat: 11 } },
  { id: 'meal_011', name: 'Protein Trio Salad', category: 'Salad', nutrition: { calories: 300, protein: 16.5, carbs: 44.5, fiber: 12, fat: 4 } },
  { id: 'meal_012', name: 'Green Velvet Salad', category: 'Salad', nutrition: { calories: 170, protein: 6, carbs: 20, fiber: 4.5, fat: 7 } },
  { id: 'meal_013', name: 'Desi Chickpea Salad', category: 'Salad', nutrition: { calories: 315, protein: 15.5, carbs: 37.5, fiber: 9, fat: 11.5 } },
  { id: 'meal_014', name: 'Tofu Fresh Fusion', category: 'Salad', nutrition: { calories: 260, protein: 13.5, carbs: 24, fiber: 5.5, fat: 12.5 } },
  { id: 'meal_015', name: 'Paneer Peri Peri Crunch', category: 'Salad', nutrition: { calories: 345, protein: 15.5, carbs: 16.5, fiber: 4.5, fat: 24 } },
  { id: 'meal_016', name: 'Golden Corn Paneer Salad', category: 'Salad', nutrition: { calories: 300, protein: 13, carbs: 26, fiber: 3.5, fat: 17.5 } },
  { id: 'meal_017', name: 'Broccoli Peanut Crunch', category: 'Salad', nutrition: { calories: 300, protein: 12, carbs: 26, fiber: 8, fat: 17.5 } },
  { id: 'meal_018', name: 'Avocado Tomato Salad', category: 'Salad', nutrition: { calories: 280, protein: 5, carbs: 20, fiber: 8, fat: 22 } },
  { id: 'meal_019', name: 'Paneer Peanut Creamy Salad', category: 'Salad', nutrition: { calories: 405, protein: 17.5, carbs: 18, fiber: 4.5, fat: 30 } },
  { id: 'meal_020', name: 'Rainbow Salad', category: 'Salad', nutrition: { calories: 290, protein: 7, carbs: 24, fiber: 8, fat: 20 } },
  { id: 'meal_021', name: 'Mix Veg Grill', category: 'Sandwich', nutrition: { calories: 240, protein: 7, carbs: 37.5, fiber: 5.5, fat: 5 } },
  { id: 'meal_022', name: 'Natural Peanut Butter', category: 'Sandwich', nutrition: { calories: 370, protein: 13.5, carbs: 40, fiber: 6.5, fat: 18 } },
  { id: 'meal_023', name: 'Club Sandwich', category: 'Sandwich', nutrition: { calories: 320, protein: 10.5, carbs: 44, fiber: 7, fat: 9.5 } },
  { id: 'meal_024', name: 'Chocolate Peanut Butter', category: 'Sandwich', nutrition: { calories: 400, protein: 12.5, carbs: 47.5, fiber: 5.5, fat: 20 } },
  { id: 'meal_025', name: 'Corn Cheese', category: 'Sandwich', nutrition: { calories: 340, protein: 11, carbs: 42.5, fiber: 4.5, fat: 13.5 } },
  { id: 'meal_026', name: 'Paneer Grill', category: 'Sandwich', nutrition: { calories: 380, protein: 17.5, carbs: 38, fiber: 5.5, fat: 18 } },
  { id: 'meal_027', name: 'Tofu Grill', category: 'Sandwich', nutrition: { calories: 320, protein: 15.5, carbs: 38, fiber: 5.5, fat: 11.5 } },
  { id: 'meal_028', name: 'Avocado Grill', category: 'Sandwich', nutrition: { calories: 340, protein: 8, carbs: 40, fiber: 9, fat: 17.5 } },
  { id: 'meal_029', name: 'Date Almond Energizer', category: 'Beverage', nutrition: { calories: 260, protein: 6.5, carbs: 38, fiber: 4.5, fat: 10 } },
  { id: 'meal_030', name: 'Melon Mint Cooler', category: 'Beverage', nutrition: { calories: 90, protein: 1.5, carbs: 21, fiber: 2, fat: 0.5 } },
  { id: 'meal_031', name: 'Beet Berry Power', category: 'Beverage', nutrition: { calories: 140, protein: 2.5, carbs: 32, fiber: 5, fat: 0.5 } },
  { id: 'meal_032', name: 'Papaya Refresh', category: 'Beverage', nutrition: { calories: 120, protein: 2, carbs: 28, fiber: 3.5, fat: 0.5 } },
  { id: 'meal_033', name: 'Berrylicious Glow', category: 'Beverage', nutrition: { calories: 160, protein: 3, carbs: 36, fiber: 6, fat: 1 } },
  { id: 'meal_034', name: 'Choco Oats Builder', category: 'Beverage', nutrition: { calories: 290, protein: 10, carbs: 48, fiber: 6.5, fat: 7 } },
  { id: 'meal_035', name: 'Green Zen Detox', category: 'Beverage', nutrition: { calories: 110, protein: 3, carbs: 24, fiber: 4.5, fat: 0.5 } },
  { id: 'meal_036', name: 'Golden Aura', category: 'Beverage', nutrition: { calories: 150, protein: 3.5, carbs: 26, fiber: 3, fat: 4 } },
  { id: 'meal_037', name: 'Dragonfuel', category: 'Beverage', nutrition: { calories: 170, protein: 3.5, carbs: 35, fiber: 5.5, fat: 1.5 } },
  { id: 'meal_038', name: 'Avocado Royale', category: 'Beverage', nutrition: { calories: 280, protein: 4.5, carbs: 26, fiber: 7.5, fat: 19 } },
];
