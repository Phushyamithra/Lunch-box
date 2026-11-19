/**
 * The Indian food catalog: what appears in search before you add anything.
 *
 * - Ingredients: straight from IFCT 2017 (NIN-ICMR) or USDA, per 100 g of
 *   the food as bought (raw / dry), so they are labelled official.
 * - Dishes: built from a typical home recipe (raw ingredient grams → cooked
 *   weight), so they are labelled *estimated*. Salt isn't counted (sodium is
 *   left blank), and real kitchens vary, especially in oil.
 *
 * - Packaged foods: the maker's own label, per 100 g → official (the page
 *   is linked). Where the label prints no fibre, fibre is 0 and noted.
 *
 * Ingredient keys: an IFCT code ("A015") or "usda:<key>" (see usda.ts).
 * Household portions are approximate and always shown in grams.
 */

export type Category =
  | 'Rice & grains'
  | 'Rotis & breads'
  | 'Dals & legumes'
  | 'Sabzi & curries'
  | 'Non-veg'
  | 'Breakfast'
  | 'Snacks & street food'
  | 'Sweets'
  | 'Beverages'
  | 'Dairy & eggs'
  | 'Vegetables'
  | 'Fruits'
  | 'Nuts & seeds'
  | 'Oils & sugar'
  | 'Meat & fish';

/** Browse order: everyday meals first, raw ingredients last. */
export const CATEGORY_ORDER: Category[] = [
  'Breakfast',
  'Rice & grains',
  'Rotis & breads',
  'Dals & legumes',
  'Sabzi & curries',
  'Non-veg',
  'Snacks & street food',
  'Sweets',
  'Beverages',
  'Dairy & eggs',
  'Fruits',
  'Nuts & seeds',
  'Vegetables',
  'Meat & fish',
  'Oils & sugar',
];

export interface PortionDef {
  label: string;
  grams: number;
}

export interface IngredientDef {
  ref: string;
  /** Unique, stable: never change once released (logs don't depend on it, but re-seeding does). */
  code: string;
  name: string;
  aliases: string;
  category: Category;
  basis?: '100g' | '100ml';
  portions: PortionDef[];
}

export interface BrandedDef {
  code: string;
  name: string;
  aliases: string;
  category: Category;
  diet: 'vegan' | 'veg' | 'egg' | 'nonveg';
  per100: { kcal: number; protein: number; fat: number; carbs: number; fibre: number; sugar: number | null; sodium_mg: number | null };
  portions: PortionDef[];
  url: string;
  note: string;
}

export interface DishDef {
  code: string;
  name: string;
  aliases: string;
  category: Category;
  /** Raw ingredients in grams for one batch. */
  recipe: [ref: string, grams: number][];
  /** Weight of that batch once cooked (water included). */
  cooked_g: number;
  basis?: '100g' | '100ml';
  portions: PortionDef[];
}

const katori: PortionDef = { label: '1 katori', grams: 150 };
const plate = (g: number): PortionDef => ({ label: '1 plate', grams: g });
const piece = (g: number, label = '1 piece'): PortionDef => ({ label, grams: g });
const cup: PortionDef = { label: '1 cup', grams: 150 };
const glass: PortionDef = { label: '1 glass', grams: 250 };
const tbsp = (g: number): PortionDef => ({ label: '1 tbsp', grams: g });
const tsp = (g: number): PortionDef => ({ label: '1 tsp', grams: g });
const handful = (g: number): PortionDef => ({ label: '1 handful', grams: g });

export const INGREDIENTS: IngredientDef[] = [
  // Grains (dry)
  { ref: 'A015', code: 'ing-rice-white', name: 'Rice, white, raw (uncooked)', aliases: 'chawal basmati sona masoori', category: 'Rice & grains', portions: [{ label: '1 cup (dry)', grams: 185 }] },
  { ref: 'A013', code: 'ing-rice-brown', name: 'Rice, brown, raw (uncooked)', aliases: 'brown chawal', category: 'Rice & grains', portions: [{ label: '1 cup (dry)', grams: 185 }] },
  { ref: 'A014', code: 'ing-rice-parboiled', name: 'Rice, parboiled, raw (uncooked)', aliases: 'ukda chawal ponni idli rice', category: 'Rice & grains', portions: [{ label: '1 cup (dry)', grams: 185 }] },
  { ref: 'A019', code: 'ing-atta', name: 'Wheat flour, whole (atta)', aliases: 'gehun chapati flour', category: 'Rice & grains', portions: [tbsp(8), { label: '1 cup', grams: 120 }] },
  { ref: 'A018', code: 'ing-maida', name: 'Wheat flour, refined (maida)', aliases: 'all purpose flour', category: 'Rice & grains', portions: [tbsp(8), { label: '1 cup', grams: 125 }] },
  { ref: 'A022', code: 'ing-sooji', name: 'Semolina (sooji / rava)', aliases: 'suji rawa', category: 'Rice & grains', portions: [tbsp(10), { label: '1 cup', grams: 170 }] },
  { ref: 'A011', code: 'ing-poha', name: 'Rice flakes (poha), dry', aliases: 'aval chivda beaten rice', category: 'Rice & grains', portions: [{ label: '1 cup', grams: 60 }] },
  { ref: 'A012', code: 'ing-murmura', name: 'Puffed rice (murmura)', aliases: 'kurmura mandakki pori', category: 'Rice & grains', portions: [{ label: '1 cup', grams: 15 }] },
  { ref: 'A023', code: 'ing-vermicelli', name: 'Vermicelli (semiya), dry', aliases: 'seviyan', category: 'Rice & grains', portions: [{ label: '1 cup', grams: 80 }] },
  { ref: 'A010', code: 'ing-ragi', name: 'Ragi (finger millet)', aliases: 'nachni nagli mandua', category: 'Rice & grains', portions: [tbsp(10)] },
  { ref: 'A003', code: 'ing-bajra', name: 'Bajra (pearl millet)', aliases: 'kambu sajje', category: 'Rice & grains', portions: [tbsp(10)] },
  { ref: 'A005', code: 'ing-jowar', name: 'Jowar (sorghum)', aliases: 'cholam jonna', category: 'Rice & grains', portions: [tbsp(10)] },
  { ref: 'A009', code: 'ing-quinoa', name: 'Quinoa, dry', aliases: '', category: 'Rice & grains', portions: [{ label: '1 cup (dry)', grams: 170 }] },
  { ref: 'A004', code: 'ing-barley', name: 'Barley, dry', aliases: 'jau', category: 'Rice & grains', portions: [tbsp(12)] },
  { ref: 'usda:oats', code: 'ing-oats', name: 'Oats, rolled, dry', aliases: 'oatmeal porridge', category: 'Rice & grains', portions: [{ label: '1/2 cup (dry)', grams: 40 }, tbsp(5)] },
  // Pulses (dry)
  { ref: 'B021', code: 'ing-toor-dal', name: 'Toor dal (arhar), dry', aliases: 'red gram tuvar pigeon pea', category: 'Dals & legumes', portions: [{ label: '1/4 cup (dry)', grams: 50 }] },
  { ref: 'B010', code: 'ing-moong-dal', name: 'Moong dal (yellow), dry', aliases: 'green gram split mung', category: 'Dals & legumes', portions: [{ label: '1/4 cup (dry)', grams: 50 }] },
  { ref: 'B011', code: 'ing-moong-whole', name: 'Moong, whole green, dry', aliases: 'sabut moong mung beans', category: 'Dals & legumes', portions: [{ label: '1/4 cup (dry)', grams: 50 }] },
  { ref: 'B013', code: 'ing-masoor-dal', name: 'Masoor dal (red lentil), dry', aliases: 'lentil split', category: 'Dals & legumes', portions: [{ label: '1/4 cup (dry)', grams: 50 }] },
  { ref: 'B001', code: 'ing-chana-dal', name: 'Chana dal / besan, dry', aliases: 'bengal gram split gram flour besan', category: 'Dals & legumes', portions: [{ label: '1/4 cup (dry)', grams: 50 }, tbsp(8)] },
  { ref: 'B002', code: 'ing-chana-whole', name: 'Chana, whole (kala chana), dry', aliases: 'bengal gram chickpea chole', category: 'Dals & legumes', portions: [{ label: '1/4 cup (dry)', grams: 50 }] },
  { ref: 'B003', code: 'ing-urad-dal', name: 'Urad dal, dry', aliases: 'black gram split', category: 'Dals & legumes', portions: [{ label: '1/4 cup (dry)', grams: 50 }] },
  { ref: 'B004', code: 'ing-urad-whole', name: 'Urad, whole (sabut), dry', aliases: 'black gram whole kali dal', category: 'Dals & legumes', portions: [{ label: '1/4 cup (dry)', grams: 50 }] },
  { ref: 'B020', code: 'ing-rajma', name: 'Rajma (red kidney beans), dry', aliases: 'kidney beans', category: 'Dals & legumes', portions: [{ label: '1/4 cup (dry)', grams: 50 }] },
  { ref: 'B012', code: 'ing-horse-gram', name: 'Horse gram (kulthi), dry', aliases: 'kollu hurali', category: 'Dals & legumes', portions: [{ label: '1/4 cup (dry)', grams: 50 }] },
  { ref: 'B025', code: 'ing-soya-bean', name: 'Soya bean, white, dry', aliases: 'soybean', category: 'Dals & legumes', portions: [{ label: '1/4 cup (dry)', grams: 45 }] },
  { ref: 'usda:soy_flour_defatted', code: 'ing-soya-chunks', name: 'Soya chunks, dry (defatted soy)', aliases: 'nutrela meal maker soy granules', category: 'Dals & legumes', portions: [{ label: '1/2 cup (dry)', grams: 25 }] },
  // Dairy & eggs
  { ref: 'L002', code: 'ing-milk-cow', name: 'Milk, cow, whole', aliases: 'doodh', category: 'Dairy & eggs', basis: '100ml', portions: [glass, cup] },
  { ref: 'L001', code: 'ing-milk-buffalo', name: 'Milk, buffalo, whole', aliases: 'bhains doodh', category: 'Dairy & eggs', basis: '100ml', portions: [glass, cup] },
  { ref: 'usda:curd', code: 'ing-curd', name: 'Curd (dahi), whole milk, plain', aliases: 'yogurt thayir mosaru', category: 'Dairy & eggs', portions: [katori, tbsp(15)] },
  { ref: 'L003', code: 'ing-paneer', name: 'Paneer', aliases: 'cottage cheese', category: 'Dairy & eggs', portions: [{ label: '1 cube', grams: 15 }, { label: '1/2 cup cubes', grams: 75 }] },
  { ref: 'L004', code: 'ing-khoa', name: 'Khoa (mawa)', aliases: 'khoya', category: 'Dairy & eggs', portions: [tbsp(15)] },
  { ref: 'T013', code: 'ing-ghee', name: 'Ghee', aliases: 'clarified butter neyyi', category: 'Oils & sugar', portions: [tsp(5), tbsp(14)] },
  { ref: 'usda:butter', code: 'ing-butter', name: 'Butter, salted', aliases: 'makhan', category: 'Dairy & eggs', portions: [tsp(5), tbsp(14)] },
  { ref: 'usda:cream', code: 'ing-cream', name: 'Cream, heavy (malai)', aliases: 'fresh cream', category: 'Dairy & eggs', portions: [tbsp(15)] },
  { ref: 'M001', code: 'ing-egg', name: 'Egg, whole, raw', aliases: 'anda', category: 'Dairy & eggs', portions: [piece(50, '1 egg')] },
  { ref: 'M004', code: 'ing-egg-boiled', name: 'Egg, whole, boiled', aliases: 'anda ubla hard boiled', category: 'Dairy & eggs', portions: [piece(50, '1 egg')] },
  { ref: 'M002', code: 'ing-egg-white', name: 'Egg white, raw', aliases: 'anda safedi', category: 'Dairy & eggs', portions: [piece(33, '1 egg white')] },
  { ref: 'M007', code: 'ing-omelette', name: 'Omelette (egg only)', aliases: 'omlet', category: 'Dairy & eggs', portions: [piece(60, '1-egg omelette')] },
  // Meat & fish (raw)
  { ref: 'N003', code: 'ing-chicken-breast', name: 'Chicken breast, skinless, raw', aliases: 'murgh', category: 'Meat & fish', portions: [] },
  { ref: 'N001', code: 'ing-chicken-leg', name: 'Chicken leg, skinless, raw', aliases: 'drumstick murgh', category: 'Meat & fish', portions: [] },
  { ref: 'N002', code: 'ing-chicken-thigh', name: 'Chicken thigh, skinless, raw', aliases: 'murgh', category: 'Meat & fish', portions: [] },
  { ref: 'O003', code: 'ing-mutton', name: 'Mutton (goat), leg, raw', aliases: 'gosht goat meat', category: 'Meat & fish', portions: [] },
  { ref: 'S006', code: 'ing-rohu', name: 'Rohu, raw', aliases: 'fish machli', category: 'Meat & fish', portions: [] },
  { ref: 'P034', code: 'ing-mackerel', name: 'Mackerel (bangda), raw', aliases: 'ayala fish', category: 'Meat & fish', portions: [] },
  { ref: 'P071', code: 'ing-sardine', name: 'Sardine (mathi), raw', aliases: 'chaala fish', category: 'Meat & fish', portions: [] },
  { ref: 'P057', code: 'ing-pomfret', name: 'Pomfret, white, raw', aliases: 'paplet fish', category: 'Meat & fish', portions: [] },
  { ref: 'S009', code: 'ing-prawns', name: 'Prawns, small, raw', aliases: 'jhinga shrimp', category: 'Meat & fish', portions: [] },
  { ref: 'P084', code: 'ing-tuna', name: 'Tuna, raw', aliases: 'fish', category: 'Meat & fish', portions: [] },
  // Vegetables (raw)
  { ref: 'C033', code: 'ing-spinach', name: 'Spinach (palak), raw', aliases: 'keerai', category: 'Vegetables', portions: [{ label: '1 bunch', grams: 200 }] },
  { ref: 'C020', code: 'ing-methi', name: 'Fenugreek leaves (methi), raw', aliases: 'vendhaya keerai', category: 'Vegetables', portions: [] },
  { ref: 'D056', code: 'ing-okra', name: 'Okra (bhindi), raw', aliases: 'ladies finger vendakkai', category: 'Vegetables', portions: [] },
  { ref: 'D031', code: 'ing-brinjal', name: 'Brinjal (baingan), raw', aliases: 'eggplant kathirikai', category: 'Vegetables', portions: [] },
  { ref: 'D036', code: 'ing-cauliflower', name: 'Cauliflower (gobi), raw', aliases: '', category: 'Vegetables', portions: [] },
  { ref: 'C015', code: 'ing-cabbage', name: 'Cabbage (patta gobi), raw', aliases: '', category: 'Vegetables', portions: [] },
  { ref: 'D061', code: 'ing-peas', name: 'Peas (matar), fresh', aliases: 'green peas', category: 'Vegetables', portions: [handful(40)] },
  { ref: 'F006', code: 'ing-potato', name: 'Potato (aloo), raw', aliases: 'batata', category: 'Vegetables', portions: [piece(150, '1 medium')] },
  { ref: 'F002', code: 'ing-carrot', name: 'Carrot (gajar), raw', aliases: '', category: 'Vegetables', portions: [piece(70, '1 medium')] },
  { ref: 'D076', code: 'ing-tomato', name: 'Tomato, ripe, raw', aliases: 'tamatar thakkali', category: 'Vegetables', portions: [piece(100, '1 medium')] },
  { ref: 'G017', code: 'ing-onion', name: 'Onion, raw', aliases: 'pyaz kanda vengayam', category: 'Vegetables', portions: [piece(110, '1 medium')] },
  { ref: 'D033', code: 'ing-capsicum', name: 'Capsicum, green, raw', aliases: 'shimla mirch bell pepper', category: 'Vegetables', portions: [piece(120, '1 medium')] },
  { ref: 'D007', code: 'ing-lauki', name: 'Bottle gourd (lauki), raw', aliases: 'dudhi sorakkai', category: 'Vegetables', portions: [] },
  { ref: 'D004', code: 'ing-karela', name: 'Bitter gourd (karela), raw', aliases: 'pavakkai', category: 'Vegetables', portions: [] },
  { ref: 'D049', code: 'ing-beans', name: 'French beans, raw', aliases: 'beans', category: 'Vegetables', portions: [] },
  { ref: 'D043', code: 'ing-cucumber', name: 'Cucumber (kheera), raw', aliases: 'kakdi', category: 'Vegetables', portions: [piece(200, '1 medium')] },
  { ref: 'F001', code: 'ing-beetroot', name: 'Beetroot, raw', aliases: 'chukandar', category: 'Vegetables', portions: [piece(100, '1 medium')] },
  { ref: 'F013', code: 'ing-sweet-potato', name: 'Sweet potato (shakarkandi), raw', aliases: '', category: 'Vegetables', portions: [piece(130, '1 medium')] },
  { ref: 'D066', code: 'ing-pumpkin', name: 'Pumpkin (kaddu), raw', aliases: 'parangikai', category: 'Vegetables', portions: [] },
  { ref: 'J001', code: 'ing-mushroom', name: 'Mushroom, button, raw', aliases: '', category: 'Vegetables', portions: [] },
  // Fruits
  { ref: 'E012', code: 'ing-banana', name: 'Banana, ripe (robusta)', aliases: 'kela', category: 'Fruits', portions: [piece(100, '1 medium (peeled)')] },
  { ref: 'E001', code: 'ing-apple', name: 'Apple', aliases: 'seb', category: 'Fruits', portions: [piece(150, '1 medium')] },
  { ref: 'E047', code: 'ing-orange', name: 'Orange (pulp)', aliases: 'santra', category: 'Fruits', portions: [piece(130, '1 medium (peeled)')] },
  { ref: 'E049', code: 'ing-papaya', name: 'Papaya, ripe', aliases: 'papita', category: 'Fruits', portions: [katori] },
  { ref: 'E036', code: 'ing-mango', name: 'Mango, ripe (banganapalli)', aliases: 'aam', category: 'Fruits', portions: [katori] },
  { ref: 'E028', code: 'ing-guava', name: 'Guava (white)', aliases: 'amrood peru', category: 'Fruits', portions: [piece(100, '1 medium')] },
  { ref: 'E055', code: 'ing-pomegranate', name: 'Pomegranate seeds', aliases: 'anar', category: 'Fruits', portions: [katori] },
  { ref: 'E065', code: 'ing-watermelon', name: 'Watermelon', aliases: 'tarbooz', category: 'Fruits', portions: [katori] },
  { ref: 'E026', code: 'ing-grapes', name: 'Grapes, green, seedless', aliases: 'angoor', category: 'Fruits', portions: [katori] },
  { ref: 'E053', code: 'ing-pineapple', name: 'Pineapple', aliases: 'ananas', category: 'Fruits', portions: [katori] },
  { ref: 'E060', code: 'ing-chikoo', name: 'Sapota (chikoo)', aliases: 'chiku', category: 'Fruits', portions: [piece(80, '1 medium')] },
  { ref: 'E018', code: 'ing-dates', name: 'Dates, dry (dark)', aliases: 'khajur', category: 'Fruits', portions: [piece(8, '1 date')] },
  { ref: 'E057', code: 'ing-raisins', name: 'Raisins, black', aliases: 'kishmish', category: 'Fruits', portions: [tbsp(10)] },
  // Nuts & seeds
  { ref: 'H001', code: 'ing-almond', name: 'Almonds', aliases: 'badam', category: 'Nuts & seeds', portions: [piece(1.2, '1 almond'), handful(25)] },
  { ref: 'H005', code: 'ing-cashew', name: 'Cashew nuts', aliases: 'kaju', category: 'Nuts & seeds', portions: [piece(1.5, '1 cashew'), handful(25)] },
  { ref: 'H012', code: 'ing-peanuts', name: 'Peanuts (groundnut), raw', aliases: 'moongphali shenga', category: 'Nuts & seeds', portions: [handful(30), tbsp(10)] },
  { ref: 'usda:peanut_butter', code: 'ing-peanut-butter', name: 'Peanut butter, unsalted', aliases: 'pb', category: 'Nuts & seeds', portions: [tbsp(16)] },
  { ref: 'H021', code: 'ing-walnut', name: 'Walnuts', aliases: 'akhrot', category: 'Nuts & seeds', portions: [handful(25)] },
  { ref: 'H018', code: 'ing-pistachio', name: 'Pistachios', aliases: 'pista', category: 'Nuts & seeds', portions: [handful(25)] },
  { ref: 'H007', code: 'ing-coconut-fresh', name: 'Coconut, fresh (grated)', aliases: 'nariyal thengai', category: 'Nuts & seeds', portions: [tbsp(10)] },
  { ref: 'H006', code: 'ing-coconut-dry', name: 'Coconut, dry (copra)', aliases: 'kopra', category: 'Nuts & seeds', portions: [tbsp(7)] },
  { ref: 'H014', code: 'ing-flaxseed', name: 'Flaxseeds (alsi)', aliases: 'linseed', category: 'Nuts & seeds', portions: [tbsp(10)] },
  { ref: 'H011', code: 'ing-sesame', name: 'Sesame seeds (til), white', aliases: 'gingelly', category: 'Nuts & seeds', portions: [tbsp(9)] },
  // Oils & sugar
  { ref: 'T005', code: 'ing-oil-groundnut', name: 'Groundnut oil', aliases: 'cooking oil peanut oil', category: 'Oils & sugar', portions: [tsp(5), tbsp(14)] },
  { ref: 'T012', code: 'ing-oil-sunflower', name: 'Sunflower oil', aliases: 'cooking oil refined', category: 'Oils & sugar', portions: [tsp(5), tbsp(14)] },
  { ref: 'T006', code: 'ing-oil-mustard', name: 'Mustard oil', aliases: 'sarson tel', category: 'Oils & sugar', portions: [tsp(5), tbsp(14)] },
  { ref: 'T001', code: 'ing-oil-coconut', name: 'Coconut oil', aliases: '', category: 'Oils & sugar', portions: [tsp(5), tbsp(14)] },
  { ref: 'usda:sugar', code: 'ing-sugar', name: 'Sugar', aliases: 'cheeni shakkar', category: 'Oils & sugar', portions: [tsp(4), tbsp(12)] },
  { ref: 'I001', code: 'ing-jaggery', name: 'Jaggery (gur)', aliases: 'bellam vellam', category: 'Oils & sugar', portions: [tsp(5), piece(20, '1 small piece')] },
  { ref: 'usda:honey', code: 'ing-honey', name: 'Honey', aliases: 'shahad', category: 'Oils & sugar', portions: [tsp(7), tbsp(21)] },
  // Chocolate, cocoa and a few staples (USDA)
  { ref: 'usda:milk_chocolate', code: 'ing-milk-chocolate', name: 'Milk chocolate', aliases: 'dairy milk chocolate bar candy', category: 'Sweets', portions: [piece(6, '1 square'), { label: '1 small bar', grams: 13 }, { label: '1 bar', grams: 40 }] },
  { ref: 'usda:dark_chocolate', code: 'ing-dark-chocolate', name: 'Dark chocolate (70–85%)', aliases: 'bitter chocolate cacao bar', category: 'Sweets', portions: [piece(10, '1 square'), { label: '1 bar', grams: 40 }] },
  { ref: 'usda:cocoa', code: 'ing-cocoa', name: 'Cocoa powder, unsweetened', aliases: 'cacao powder', category: 'Oils & sugar', portions: [tsp(2.5), tbsp(5)] },
  { ref: 'usda:rice_flour', code: 'ing-rice-flour', name: 'Rice flour', aliases: 'chawal ka atta akki hittu', category: 'Rice & grains', portions: [tbsp(10), { label: '1 cup', grams: 160 }] },
  { ref: 'usda:coconut_milk', code: 'ing-coconut-milk', name: 'Coconut milk, canned', aliases: 'thengai paal nariyal doodh', category: 'Nuts & seeds', portions: [tbsp(15), { label: '1/2 cup', grams: 120 }] },
  { ref: 'usda:mozzarella', code: 'ing-mozzarella', name: 'Mozzarella cheese', aliases: 'pizza cheese', category: 'Dairy & eggs', portions: [{ label: '1 slice', grams: 20 }, { label: '1/4 cup grated', grams: 28 }] },
  { ref: 'K002', code: 'ing-coconut-water', name: 'Coconut water', aliases: 'nariyal pani elaneer', category: 'Beverages', basis: '100ml', portions: [glass] },
];

// Typical spice/aromatic amounts are left out: they add little energy.
const OIL = 'T005';
export const DISHES: DishDef[] = [
  // Rice
  { code: 'dish-rice', name: 'Rice, white, cooked (plain)', aliases: 'chawal steamed boiled bhaat', category: 'Rice & grains', recipe: [['A015', 100]], cooked_g: 300, portions: [katori, plate(250)] },
  { code: 'dish-brown-rice', name: 'Rice, brown, cooked', aliases: 'brown chawal', category: 'Rice & grains', recipe: [['A013', 100]], cooked_g: 290, portions: [katori, plate(250)] },
  { code: 'dish-jeera-rice', name: 'Jeera rice', aliases: 'cumin rice', category: 'Rice & grains', recipe: [['A015', 100], ['T013', 8]], cooked_g: 305, portions: [katori, plate(250)] },
  { code: 'dish-veg-pulao', name: 'Veg pulao', aliases: 'pulav', category: 'Rice & grains', recipe: [['A015', 80], ['F002', 30], ['D049', 30], ['D061', 30], ['G017', 20], [OIL, 8], ['T013', 4]], cooked_g: 330, portions: [katori, plate(300)] },
  { code: 'dish-veg-biryani', name: 'Veg biryani', aliases: 'biriyani', category: 'Rice & grains', recipe: [['A015', 80], ['F002', 30], ['D049', 30], ['D061', 20], ['F006', 30], ['G017', 30], ['usda:curd', 20], [OIL, 10], ['T013', 5]], cooked_g: 340, portions: [plate(350), katori] },
  { code: 'dish-chicken-biryani', name: 'Chicken biryani', aliases: 'biriyani dum', category: 'Non-veg', recipe: [['A015', 80], ['N001', 100], ['G017', 40], ['usda:curd', 20], [OIL, 10], ['T013', 5]], cooked_g: 350, portions: [plate(350), katori] },
  { code: 'dish-khichdi', name: 'Moong dal khichdi', aliases: 'khichri', category: 'Rice & grains', recipe: [['A015', 40], ['B010', 20], ['T013', 5]], cooked_g: 250, portions: [katori, plate(300)] },
  { code: 'dish-curd-rice', name: 'Curd rice', aliases: 'thayir sadam dahi chawal', category: 'Rice & grains', recipe: [['A015', 50], ['usda:curd', 100], [OIL, 3]], cooked_g: 280, portions: [katori, plate(250)] },
  { code: 'dish-lemon-rice', name: 'Lemon rice', aliases: 'chitranna nimmakaya pulihora', category: 'Rice & grains', recipe: [['A015', 60], ['H012', 8], [OIL, 8]], cooked_g: 200, portions: [katori, plate(250)] },
  // Breads
  { code: 'dish-roti', name: 'Roti / chapati (no ghee)', aliases: 'phulka fulka chapathi', category: 'Rotis & breads', recipe: [['A019', 30]], cooked_g: 40, portions: [piece(40, '1 roti')] },
  { code: 'dish-roti-ghee', name: 'Roti with ghee', aliases: 'chapati ghee phulka', category: 'Rotis & breads', recipe: [['A019', 30], ['T013', 3]], cooked_g: 43, portions: [piece(43, '1 roti')] },
  { code: 'dish-paratha', name: 'Paratha, plain', aliases: 'parantha lachha', category: 'Rotis & breads', recipe: [['A019', 40], [OIL, 6]], cooked_g: 60, portions: [piece(60, '1 paratha')] },
  { code: 'dish-aloo-paratha', name: 'Aloo paratha', aliases: 'potato parantha', category: 'Rotis & breads', recipe: [['A019', 50], ['F006', 60], ['G017', 5], [OIL, 7]], cooked_g: 120, portions: [piece(120, '1 paratha')] },
  { code: 'dish-puri', name: 'Puri', aliases: 'poori', category: 'Rotis & breads', recipe: [['A019', 15], [OIL, 5]], cooked_g: 22, portions: [piece(22, '1 puri')] },
  { code: 'dish-bhatura', name: 'Bhatura', aliases: 'bhature', category: 'Rotis & breads', recipe: [['A018', 50], ['usda:curd', 10], [OIL, 12]], cooked_g: 80, portions: [piece(80, '1 bhatura')] },
  { code: 'dish-naan', name: 'Naan, plain', aliases: 'nan', category: 'Rotis & breads', recipe: [['A018', 70], ['usda:curd', 10], [OIL, 3]], cooked_g: 95, portions: [piece(95, '1 naan')] },
  { code: 'dish-bajra-roti', name: 'Bajra roti', aliases: 'bajre ki roti bhakri', category: 'Rotis & breads', recipe: [['A003', 40]], cooked_g: 55, portions: [piece(55, '1 roti')] },
  { code: 'dish-jowar-roti', name: 'Jowar roti (bhakri)', aliases: 'jolada rotti', category: 'Rotis & breads', recipe: [['A005', 40]], cooked_g: 55, portions: [piece(55, '1 roti')] },
  { code: 'dish-ragi-mudde', name: 'Ragi mudde', aliases: 'ragi ball kali', category: 'Rotis & breads', recipe: [['A010', 50]], cooked_g: 150, portions: [piece(150, '1 ball')] },
  // Dals
  { code: 'dish-toor-dal', name: 'Toor dal tadka', aliases: 'arhar dal fry tuvar', category: 'Dals & legumes', recipe: [['B021', 50], ['G017', 10], ['D076', 20], [OIL, 5]], cooked_g: 250, portions: [katori] },
  { code: 'dish-moong-dal', name: 'Moong dal', aliases: 'yellow dal', category: 'Dals & legumes', recipe: [['B010', 50], ['D076', 20], [OIL, 5]], cooked_g: 250, portions: [katori] },
  { code: 'dish-masoor-dal', name: 'Masoor dal', aliases: 'red lentil dal', category: 'Dals & legumes', recipe: [['B013', 50], ['G017', 10], ['D076', 20], [OIL, 5]], cooked_g: 250, portions: [katori] },
  { code: 'dish-chana-dal', name: 'Chana dal', aliases: 'bengal gram dal', category: 'Dals & legumes', recipe: [['B001', 50], ['G017', 10], ['D076', 20], [OIL, 5]], cooked_g: 230, portions: [katori] },
  { code: 'dish-dal-makhani', name: 'Dal makhani', aliases: 'maa ki dal', category: 'Dals & legumes', recipe: [['B004', 40], ['B020', 10], ['usda:butter', 8], ['usda:cream', 10], ['D076', 30], ['G017', 15]], cooked_g: 230, portions: [katori] },
  { code: 'dish-rajma', name: 'Rajma masala', aliases: 'rajma chawal curry', category: 'Dals & legumes', recipe: [['B020', 60], ['G017', 30], ['D076', 40], [OIL, 8]], cooked_g: 280, portions: [katori] },
  { code: 'dish-chole', name: 'Chole (chana masala)', aliases: 'chickpea curry chhole', category: 'Dals & legumes', recipe: [['B002', 60], ['G017', 30], ['D076', 40], [OIL, 8]], cooked_g: 280, portions: [katori] },
  { code: 'dish-sambar', name: 'Sambar', aliases: 'sambhar kuzhambu', category: 'Dals & legumes', recipe: [['B021', 30], ['D046', 20], ['D066', 20], ['D031', 20], ['D076', 20], ['G017', 15], ['E064', 5], [OIL, 4]], cooked_g: 350, portions: [katori] },
  { code: 'dish-rasam', name: 'Rasam', aliases: 'saaru charu', category: 'Dals & legumes', recipe: [['B021', 10], ['D076', 60], ['E064', 5], [OIL, 3]], cooked_g: 300, basis: '100ml', portions: [katori] },
  { code: 'dish-kadhi', name: 'Kadhi', aliases: 'kadi pakora-less', category: 'Dals & legumes', recipe: [['usda:curd', 100], ['B001', 15], [OIL, 5]], cooked_g: 250, portions: [katori] },
  { code: 'dish-sprouts', name: 'Moong sprouts salad', aliases: 'sprouted moong chaat', category: 'Dals & legumes', recipe: [['B011', 40], ['G017', 20], ['D076', 20], ['E033', 5]], cooked_g: 145, portions: [katori] },
  // Sabzi & curries
  { code: 'dish-aloo-sabzi', name: 'Aloo sabzi (dry)', aliases: 'potato fry batata bhaji', category: 'Sabzi & curries', recipe: [['F006', 200], ['G017', 20], [OIL, 12]], cooked_g: 230, portions: [katori] },
  { code: 'dish-aloo-gobi', name: 'Aloo gobi', aliases: 'potato cauliflower', category: 'Sabzi & curries', recipe: [['F006', 100], ['D036', 150], ['G017', 20], ['D076', 20], [OIL, 12]], cooked_g: 280, portions: [katori] },
  { code: 'dish-bhindi', name: 'Bhindi masala', aliases: 'okra fry vendakkai', category: 'Sabzi & curries', recipe: [['D056', 200], ['G017', 40], [OIL, 15]], cooked_g: 200, portions: [katori] },
  { code: 'dish-baingan-bharta', name: 'Baingan bharta', aliases: 'brinjal mash', category: 'Sabzi & curries', recipe: [['D031', 300], ['G017', 40], ['D076', 50], [OIL, 12]], cooked_g: 300, portions: [katori] },
  { code: 'dish-palak-paneer', name: 'Palak paneer', aliases: 'spinach paneer', category: 'Sabzi & curries', recipe: [['C033', 200], ['L003', 80], ['G017', 30], ['D076', 30], ['usda:cream', 10], [OIL, 10]], cooked_g: 330, portions: [katori] },
  { code: 'dish-paneer-butter-masala', name: 'Paneer butter masala', aliases: 'paneer makhani', category: 'Sabzi & curries', recipe: [['L003', 100], ['usda:butter', 10], ['usda:cream', 20], ['D076', 100], ['G017', 30], ['H005', 10], [OIL, 5]], cooked_g: 260, portions: [katori] },
  { code: 'dish-matar-paneer', name: 'Matar paneer', aliases: 'peas paneer', category: 'Sabzi & curries', recipe: [['D061', 60], ['L003', 80], ['G017', 30], ['D076', 60], [OIL, 10]], cooked_g: 260, portions: [katori] },
  { code: 'dish-paneer-bhurji', name: 'Paneer bhurji', aliases: 'scrambled paneer', category: 'Sabzi & curries', recipe: [['L003', 100], ['G017', 30], ['D076', 30], ['D033', 20], [OIL, 7]], cooked_g: 170, portions: [katori] },
  { code: 'dish-mixed-veg', name: 'Mixed veg sabzi', aliases: 'mix vegetable curry', category: 'Sabzi & curries', recipe: [['F002', 50], ['D049', 50], ['D061', 40], ['F006', 50], ['D036', 50], ['G017', 20], ['D076', 30], [OIL, 10]], cooked_g: 280, portions: [katori] },
  { code: 'dish-cabbage-poriyal', name: 'Cabbage poriyal', aliases: 'patta gobi sabzi thoran', category: 'Sabzi & curries', recipe: [['C015', 200], ['H007', 15], [OIL, 8]], cooked_g: 200, portions: [katori] },
  { code: 'dish-lauki', name: 'Lauki sabzi', aliases: 'bottle gourd dudhi', category: 'Sabzi & curries', recipe: [['D007', 250], ['D076', 30], [OIL, 8]], cooked_g: 230, portions: [katori] },
  { code: 'dish-methi-aloo', name: 'Aloo methi', aliases: 'methi potato', category: 'Sabzi & curries', recipe: [['F006', 150], ['C020', 50], [OIL, 10]], cooked_g: 180, portions: [katori] },
  { code: 'dish-soya-curry', name: 'Soya chunks curry', aliases: 'meal maker nutrela', category: 'Sabzi & curries', recipe: [['usda:soy_flour_defatted', 40], ['G017', 30], ['D076', 40], [OIL, 8]], cooked_g: 250, portions: [katori] },
  { code: 'dish-raita', name: 'Cucumber raita', aliases: 'kheera raita pachadi', category: 'Sabzi & curries', recipe: [['usda:curd', 100], ['D043', 30]], cooked_g: 130, portions: [katori] },
  // Non-veg
  { code: 'dish-egg-curry', name: 'Egg curry (2 eggs)', aliases: 'anda curry', category: 'Non-veg', recipe: [['M004', 100], ['G017', 40], ['D076', 50], [OIL, 10]], cooked_g: 250, portions: [katori, { label: '2-egg serving', grams: 250 }] },
  { code: 'dish-egg-bhurji', name: 'Egg bhurji (2 eggs)', aliases: 'anda bhurji scrambled', category: 'Non-veg', recipe: [['M001', 100], ['G017', 30], ['D076', 30], [OIL, 8]], cooked_g: 150, portions: [{ label: '2-egg serving', grams: 150 }] },
  { code: 'dish-chicken-curry', name: 'Chicken curry', aliases: 'murgh curry', category: 'Non-veg', recipe: [['N001', 150], ['G017', 50], ['D076', 50], ['usda:curd', 30], [OIL, 12]], cooked_g: 280, portions: [katori] },
  { code: 'dish-butter-chicken', name: 'Butter chicken', aliases: 'murgh makhani', category: 'Non-veg', recipe: [['N002', 150], ['usda:butter', 15], ['usda:cream', 25], ['D076', 100], ['H005', 10], ['G017', 20]], cooked_g: 300, portions: [katori] },
  { code: 'dish-chicken-tikka', name: 'Chicken tikka', aliases: 'tikka kebab', category: 'Non-veg', recipe: [['N003', 150], ['usda:curd', 30], [OIL, 5]], cooked_g: 120, portions: [{ label: '6 pieces', grams: 120 }] },
  { code: 'dish-tandoori-chicken', name: 'Tandoori chicken (leg)', aliases: 'tangdi', category: 'Non-veg', recipe: [['N001', 200], ['usda:curd', 30], [OIL, 5]], cooked_g: 150, portions: [piece(150, '1 leg')] },
  { code: 'dish-grilled-chicken-breast', name: 'Chicken breast, grilled', aliases: 'pan seared chicken', category: 'Non-veg', recipe: [['N003', 100], [OIL, 3]], cooked_g: 75, portions: [] },
  { code: 'dish-mutton-curry', name: 'Mutton curry', aliases: 'gosht rogan josh', category: 'Non-veg', recipe: [['O003', 150], ['G017', 60], ['D076', 50], ['usda:curd', 30], [OIL, 15]], cooked_g: 300, portions: [katori] },
  { code: 'dish-fish-curry', name: 'Fish curry (rohu)', aliases: 'machli macher jhol meen kulambu', category: 'Non-veg', recipe: [['S006', 150], ['G017', 40], ['D076', 50], ['H007', 20], [OIL, 12]], cooked_g: 300, portions: [katori] },
  { code: 'dish-fish-fry', name: 'Fish fry (mackerel)', aliases: 'bangda fry meen varuval', category: 'Non-veg', recipe: [['P034', 150], [OIL, 12]], cooked_g: 120, portions: [piece(60, '1 piece')] },
  { code: 'dish-prawn-masala', name: 'Prawn masala', aliases: 'jhinga', category: 'Non-veg', recipe: [['S009', 150], ['G017', 40], ['D076', 50], [OIL, 12]], cooked_g: 250, portions: [katori] },
  // Breakfast
  { code: 'dish-idli', name: 'Idli', aliases: 'iddli', category: 'Breakfast', recipe: [['A014', 10], ['B003', 3.5]], cooked_g: 40, portions: [piece(40, '1 idli')] },
  { code: 'dish-dosa', name: 'Dosa, plain', aliases: 'dosai sada', category: 'Breakfast', recipe: [['A014', 22], ['B003', 7], [OIL, 4]], cooked_g: 80, portions: [piece(80, '1 dosa')] },
  { code: 'dish-masala-dosa', name: 'Masala dosa', aliases: 'dosai potato', category: 'Breakfast', recipe: [['A014', 22], ['B003', 7], ['F006', 80], ['G017', 15], [OIL, 9]], cooked_g: 190, portions: [piece(190, '1 dosa')] },
  { code: 'dish-uttapam', name: 'Uttapam', aliases: 'uthappam', category: 'Breakfast', recipe: [['A014', 30], ['B003', 10], ['G017', 20], ['D076', 15], [OIL, 6]], cooked_g: 140, portions: [piece(140, '1 uttapam')] },
  { code: 'dish-medu-vada', name: 'Medu vada', aliases: 'uddina vade vadai', category: 'Breakfast', recipe: [['B003', 30], [OIL, 8]], cooked_g: 50, portions: [piece(50, '1 vada')] },
  { code: 'dish-upma', name: 'Upma', aliases: 'uppittu rava khara bath', category: 'Breakfast', recipe: [['A022', 50], ['G017', 15], ['D061', 10], [OIL, 8]], cooked_g: 220, portions: [plate(220), katori] },
  { code: 'dish-poha', name: 'Poha', aliases: 'kanda poha aval', category: 'Breakfast', recipe: [['A011', 50], ['G017', 20], ['F006', 20], ['H012', 8], [OIL, 7]], cooked_g: 180, portions: [plate(180), katori] },
  { code: 'dish-pongal', name: 'Ven pongal', aliases: 'khara pongal', category: 'Breakfast', recipe: [['A015', 40], ['B010', 20], ['T013', 8], ['H005', 3]], cooked_g: 220, portions: [plate(220), katori] },
  { code: 'dish-besan-chilla', name: 'Besan chilla', aliases: 'puda cheela', category: 'Breakfast', recipe: [['B001', 40], ['G017', 15], ['D076', 10], [OIL, 5]], cooked_g: 90, portions: [piece(90, '1 chilla')] },
  { code: 'dish-moong-chilla', name: 'Moong dal chilla', aliases: 'pesarattu cheela', category: 'Breakfast', recipe: [['B010', 40], [OIL, 5]], cooked_g: 90, portions: [piece(90, '1 chilla')] },
  { code: 'dish-oats-milk', name: 'Oats porridge with milk', aliases: 'oatmeal', category: 'Breakfast', recipe: [['usda:oats', 40], ['L002', 200]], cooked_g: 260, portions: [{ label: '1 bowl', grams: 260 }] },
  // Snacks & street food
  { code: 'dish-samosa', name: 'Samosa', aliases: 'singara', category: 'Snacks & street food', recipe: [['A018', 25], ['F006', 40], ['D061', 5], [OIL, 12]], cooked_g: 80, portions: [piece(80, '1 samosa')] },
  { code: 'dish-pakora', name: 'Onion pakora', aliases: 'bhaji bhajji pakoda', category: 'Snacks & street food', recipe: [['B001', 35], ['G017', 60], [OIL, 15]], cooked_g: 100, portions: [piece(20, '1 pakora'), plate(100)] },
  { code: 'dish-pani-puri', name: 'Pani puri (6 pcs)', aliases: 'golgappa puchka gupchup', category: 'Snacks & street food', recipe: [['A022', 25], [OIL, 8], ['F006', 30], ['B002', 10]], cooked_g: 90, portions: [{ label: '1 plate (6)', grams: 90 }] },
  { code: 'dish-pav-bhaji', name: 'Pav bhaji', aliases: 'paav bhaji', category: 'Snacks & street food', recipe: [['A018', 60], ['F006', 80], ['D061', 20], ['D036', 30], ['D076', 50], ['G017', 20], ['usda:butter', 20]], cooked_g: 330, portions: [{ label: '1 plate (2 pav)', grams: 330 }] },
  { code: 'dish-vada-pav', name: 'Vada pav', aliases: 'wada pav', category: 'Snacks & street food', recipe: [['A018', 45], ['F006', 70], ['B001', 15], [OIL, 10]], cooked_g: 160, portions: [piece(160, '1 vada pav')] },
  { code: 'dish-dhokla', name: 'Dhokla', aliases: 'khaman', category: 'Snacks & street food', recipe: [['B001', 40], ['usda:sugar', 3], [OIL, 4]], cooked_g: 100, portions: [piece(30, '1 piece')] },
  { code: 'dish-bhel', name: 'Bhel puri', aliases: 'jhalmuri churmuri', category: 'Snacks & street food', recipe: [['A012', 30], ['G017', 20], ['D076', 15], ['B001', 10], [OIL, 4], ['H012', 5]], cooked_g: 100, portions: [plate(100)] },
  // Sweets
  { code: 'dish-gulab-jamun', name: 'Gulab jamun', aliases: 'jamun', category: 'Sweets', recipe: [['L004', 12], ['A018', 3], ['usda:sugar', 15], ['T013', 5]], cooked_g: 40, portions: [piece(40, '1 piece')] },
  { code: 'dish-rasgulla', name: 'Rasgulla', aliases: 'rosogolla', category: 'Sweets', recipe: [['L003', 15], ['usda:sugar', 15]], cooked_g: 40, portions: [piece(40, '1 piece')] },
  { code: 'dish-kheer', name: 'Rice kheer', aliases: 'payasam payesh', category: 'Sweets', recipe: [['L002', 200], ['A015', 15], ['usda:sugar', 15]], cooked_g: 180, portions: [katori] },
  { code: 'dish-sooji-halwa', name: 'Sooji halwa', aliases: 'sheera kesari', category: 'Sweets', recipe: [['A022', 30], ['T013', 15], ['usda:sugar', 25]], cooked_g: 130, portions: [katori] },
  { code: 'dish-gajar-halwa', name: 'Gajar halwa', aliases: 'carrot halwa', category: 'Sweets', recipe: [['F002', 150], ['L002', 100], ['usda:sugar', 25], ['T013', 10], ['L004', 10]], cooked_g: 180, portions: [katori] },
  { code: 'dish-besan-ladoo', name: 'Besan ladoo', aliases: 'laddu', category: 'Sweets', recipe: [['B001', 13], ['T013', 7], ['usda:sugar', 10]], cooked_g: 30, portions: [piece(30, '1 ladoo')] },
  { code: 'dish-jalebi', name: 'Jalebi', aliases: 'jilebi', category: 'Sweets', recipe: [['A018', 30], [OIL, 15], ['usda:sugar', 50]], cooked_g: 100, portions: [piece(25, '1 piece')] },
  // Beverages (per 100 ml)
  { code: 'dish-chai', name: 'Masala chai (milk, sugar)', aliases: 'tea cutting chaya', category: 'Beverages', recipe: [['L002', 60], ['usda:sugar', 8]], cooked_g: 150, basis: '100ml', portions: [cup, { label: '1 cutting', grams: 75 }] },
  { code: 'dish-filter-coffee', name: 'Filter coffee (milk, sugar)', aliases: 'kaapi', category: 'Beverages', recipe: [['L002', 80], ['usda:sugar', 8]], cooked_g: 150, basis: '100ml', portions: [cup] },
  { code: 'dish-lassi', name: 'Sweet lassi', aliases: '', category: 'Beverages', recipe: [['usda:curd', 150], ['usda:sugar', 20]], cooked_g: 220, basis: '100ml', portions: [glass] },
  { code: 'dish-mango-lassi', name: 'Mango lassi', aliases: '', category: 'Beverages', recipe: [['usda:curd', 120], ['E036', 80], ['usda:sugar', 15]], cooked_g: 230, basis: '100ml', portions: [glass] },
  { code: 'dish-chaas', name: 'Buttermilk (chaas)', aliases: 'majjige moru mattha', category: 'Beverages', recipe: [['usda:curd', 60]], cooked_g: 250, basis: '100ml', portions: [glass] },
  { code: 'dish-badam-milk', name: 'Badam milk', aliases: 'almond milk sweet', category: 'Beverages', recipe: [['L002', 200], ['H001', 10], ['usda:sugar', 15]], cooked_g: 225, basis: '100ml', portions: [glass] },
  { code: 'dish-banana-shake', name: 'Banana milkshake', aliases: 'banana shake', category: 'Beverages', recipe: [['L002', 200], ['E012', 100], ['usda:sugar', 10]], cooked_g: 310, basis: '100ml', portions: [glass] },
  { code: 'dish-nimbu-pani', name: 'Nimbu pani (sweet)', aliases: 'lemonade shikanji', category: 'Beverages', recipe: [['E033', 10], ['usda:sugar', 15]], cooked_g: 250, basis: '100ml', portions: [glass] },
  // South Indian breakfasts (more)
  { code: 'dish-rava-dosa', name: 'Rava dosa', aliases: 'rava dosai semolina dosa', category: 'Breakfast', recipe: [['A022', 15], ['usda:rice_flour', 15], ['A018', 5], [OIL, 6]], cooked_g: 70, portions: [piece(70, '1 dosa')] },
  { code: 'dish-set-dosa', name: 'Set dosa', aliases: 'sponge dosa', category: 'Breakfast', recipe: [['A014', 18], ['B003', 4], [OIL, 3]], cooked_g: 65, portions: [piece(65, '1 dosa'), { label: '1 set (3)', grams: 195 }] },
  { code: 'dish-ghee-roast-dosa', name: 'Ghee roast dosa', aliases: 'ghee dosa nei roast', category: 'Breakfast', recipe: [['A014', 22], ['B003', 7], ['T013', 8]], cooked_g: 80, portions: [piece(80, '1 dosa')] },
  { code: 'dish-mysore-masala-dosa', name: 'Mysore masala dosa', aliases: 'mysore dosai red chutney', category: 'Breakfast', recipe: [['A014', 22], ['B003', 7], ['F006', 80], ['G017', 15], ['H007', 5], [OIL, 11]], cooked_g: 200, portions: [piece(200, '1 dosa')] },
  { code: 'dish-cheese-dosa', name: 'Cheese dosa', aliases: 'cheese dosai', category: 'Breakfast', recipe: [['A014', 22], ['B003', 7], ['usda:mozzarella', 25], [OIL, 5]], cooked_g: 105, portions: [piece(105, '1 dosa')] },
  { code: 'dish-neer-dosa', name: 'Neer dosa', aliases: 'neer dose', category: 'Breakfast', recipe: [['A015', 25], ['H007', 5], [OIL, 2]], cooked_g: 70, portions: [piece(70, '1 dosa')] },
  { code: 'dish-ragi-dosa', name: 'Ragi dosa', aliases: 'nachni dosa finger millet', category: 'Breakfast', recipe: [['A010', 20], ['A015', 5], [OIL, 4]], cooked_g: 60, portions: [piece(60, '1 dosa')] },
  { code: 'dish-pesarattu', name: 'Pesarattu', aliases: 'moong dosa green gram dosa', category: 'Breakfast', recipe: [['B011', 35], ['A015', 5], ['G017', 10], [OIL, 5]], cooked_g: 90, portions: [piece(90, '1 pesarattu')] },
  { code: 'dish-rava-idli', name: 'Rava idli', aliases: 'semolina idli', category: 'Breakfast', recipe: [['A022', 25], ['usda:curd', 15], [OIL, 2]], cooked_g: 50, portions: [piece(50, '1 idli')] },
  { code: 'dish-appam', name: 'Appam', aliases: 'palappam hoppers', category: 'Breakfast', recipe: [['A015', 30], ['H007', 8], ['usda:sugar', 2]], cooked_g: 75, portions: [piece(75, '1 appam')] },
  { code: 'dish-idiyappam', name: 'Idiyappam', aliases: 'string hoppers nool puttu', category: 'Breakfast', recipe: [['usda:rice_flour', 100]], cooked_g: 230, portions: [piece(40, '1 idiyappam')] },
  { code: 'dish-puttu', name: 'Puttu', aliases: 'rice puttu', category: 'Breakfast', recipe: [['usda:rice_flour', 60], ['H007', 20]], cooked_g: 130, portions: [piece(130, '1 puttu')] },
  { code: 'dish-masala-vada', name: 'Masala vada', aliases: 'parippu vada chana vada ambode', category: 'Breakfast', recipe: [['B001', 30], ['G017', 10], [OIL, 8]], cooked_g: 50, portions: [piece(50, '1 vada')] },
  { code: 'dish-kesari-bath', name: 'Kesari bath (rava kesari)', aliases: 'sheera kesari sweet', category: 'Sweets', recipe: [['A022', 40], ['usda:sugar', 40], ['T013', 15], ['H005', 5], ['E057', 5]], cooked_g: 200, portions: [katori, { label: '1 small bowl', grams: 100 }] },
  { code: 'dish-bisi-bele-bath', name: 'Bisi bele bath', aliases: 'bisibele sambar rice', category: 'Rice & grains', recipe: [['A015', 40], ['B021', 25], ['F002', 15], ['D049', 15], ['D061', 10], ['G017', 10], ['E064', 3], ['T013', 5], [OIL, 5]], cooked_g: 330, portions: [plate(300), katori] },
  { code: 'dish-tomato-rice', name: 'Tomato rice', aliases: 'thakkali sadam tomato bath', category: 'Rice & grains', recipe: [['A015', 60], ['D076', 60], ['G017', 20], [OIL, 8]], cooked_g: 230, portions: [katori, plate(250)] },
  { code: 'dish-vangi-bath', name: 'Vangi bath', aliases: 'brinjal rice baingan rice', category: 'Rice & grains', recipe: [['A015', 60], ['D031', 60], ['G017', 15], ['H012', 5], [OIL, 10]], cooked_g: 230, portions: [katori, plate(250)] },
  { code: 'dish-puliyogare', name: 'Puliyogare (tamarind rice)', aliases: 'puliyodarai pulihora imli rice', category: 'Rice & grains', recipe: [['A015', 60], ['E064', 8], ['H012', 8], ['I001', 3], [OIL, 10]], cooked_g: 200, portions: [katori, plate(250)] },
  // Curries (more)
  { code: 'dish-kadai-paneer', name: 'Kadai paneer', aliases: 'karahi paneer', category: 'Sabzi & curries', recipe: [['L003', 150], ['D033', 60], ['G017', 50], ['D076', 80], [OIL, 15]], cooked_g: 330, portions: [katori] },
  { code: 'dish-paneer-tikka-masala', name: 'Paneer tikka masala', aliases: 'paneer masala', category: 'Sabzi & curries', recipe: [['L003', 150], ['usda:curd', 30], ['D076', 100], ['G017', 40], ['usda:cream', 15], [OIL, 12]], cooked_g: 330, portions: [katori] },
  { code: 'dish-shahi-paneer', name: 'Shahi paneer', aliases: 'paneer korma', category: 'Sabzi & curries', recipe: [['L003', 150], ['usda:cream', 30], ['H005', 15], ['usda:curd', 30], ['G017', 30], ['T013', 10]], cooked_g: 300, portions: [katori] },
  { code: 'dish-malai-kofta', name: 'Malai kofta', aliases: 'kofta curry', category: 'Sabzi & curries', recipe: [['L003', 60], ['F006', 60], ['A018', 5], [OIL, 23], ['usda:cream', 30], ['D076', 80], ['G017', 30], ['H005', 15]], cooked_g: 320, portions: [katori, piece(60, '1 kofta with gravy')] },
  { code: 'dish-paneer-tikka', name: 'Paneer tikka (dry)', aliases: 'paneer kebab tandoori paneer', category: 'Sabzi & curries', recipe: [['L003', 150], ['usda:curd', 30], ['D033', 30], ['G017', 30], [OIL, 8]], cooked_g: 210, portions: [{ label: '6 pieces', grams: 150 }] },
  { code: 'dish-veg-kurma', name: 'Veg kurma', aliases: 'korma vegetable kuruma', category: 'Sabzi & curries', recipe: [['F002', 40], ['D049', 40], ['D061', 40], ['F006', 50], ['H007', 30], ['H005', 5], ['G017', 20], [OIL, 10]], cooked_g: 330, portions: [katori] },
  { code: 'dish-avial', name: 'Avial', aliases: 'aviyal mixed veg coconut', category: 'Sabzi & curries', recipe: [['F002', 40], ['D049', 40], ['D046', 30], ['D066', 40], ['H007', 40], ['usda:curd', 30], ['T001', 8]], cooked_g: 280, portions: [katori] },
  { code: 'dish-aloo-matar', name: 'Aloo matar', aliases: 'potato peas curry', category: 'Sabzi & curries', recipe: [['F006', 120], ['D061', 60], ['G017', 30], ['D076', 60], [OIL, 10]], cooked_g: 330, portions: [katori] },
  { code: 'dish-mushroom-masala', name: 'Mushroom masala', aliases: 'mushroom curry khumb', category: 'Sabzi & curries', recipe: [['J001', 200], ['G017', 50], ['D076', 80], [OIL, 12], ['usda:cream', 10]], cooked_g: 300, portions: [katori] },
  { code: 'dish-dal-fry', name: 'Dal fry', aliases: 'dal tadka restaurant', category: 'Dals & legumes', recipe: [['B021', 50], ['G017', 20], ['D076', 30], [OIL, 8], ['T013', 3]], cooked_g: 250, portions: [katori] },
  { code: 'dish-palak-dal', name: 'Palak dal', aliases: 'dal palak spinach dal keerai', category: 'Dals & legumes', recipe: [['B010', 50], ['C033', 80], ['D076', 20], [OIL, 5]], cooked_g: 300, portions: [katori] },
  { code: 'dish-chicken-tikka-masala', name: 'Chicken tikka masala', aliases: 'tikka masala murgh', category: 'Non-veg', recipe: [['N003', 150], ['usda:curd', 30], ['D076', 100], ['G017', 40], ['usda:cream', 20], [OIL, 12]], cooked_g: 330, portions: [katori] },
  { code: 'dish-kadai-chicken', name: 'Kadai chicken', aliases: 'karahi chicken', category: 'Non-veg', recipe: [['N001', 200], ['D033', 50], ['G017', 50], ['D076', 80], [OIL, 15]], cooked_g: 360, portions: [katori] },
  { code: 'dish-chicken-chettinad', name: 'Chicken chettinad', aliases: 'chettinad kozhi', category: 'Non-veg', recipe: [['N001', 200], ['G017', 60], ['D076', 60], ['H007', 20], [OIL, 15]], cooked_g: 360, portions: [katori] },
  { code: 'dish-chicken-korma', name: 'Chicken korma', aliases: 'murgh korma kurma', category: 'Non-veg', recipe: [['N001', 200], ['usda:curd', 50], ['G017', 60], ['H005', 15], ['T013', 10], [OIL, 10]], cooked_g: 380, portions: [katori] },
  { code: 'dish-rogan-josh', name: 'Mutton rogan josh', aliases: 'roghan josh lamb curry', category: 'Non-veg', recipe: [['O003', 200], ['usda:curd', 50], ['G017', 40], [OIL, 15], ['T013', 5]], cooked_g: 330, portions: [katori] },
  { code: 'dish-kerala-fish-curry', name: 'Kerala fish curry (coconut)', aliases: 'meen curry fish moilee', category: 'Non-veg', recipe: [['P034', 200], ['usda:coconut_milk', 80], ['G017', 30], ['D076', 40], ['E064', 5], ['T001', 10]], cooked_g: 400, portions: [katori] },
  // Indian sweets (more), estimated from typical recipes; syrup and ghee vary a lot by shop
  { code: 'dish-kaju-katli', name: 'Kaju katli', aliases: 'kaju barfi cashew burfi', category: 'Sweets', recipe: [['H005', 100], ['usda:sugar', 60]], cooked_g: 155, portions: [piece(12, '1 piece')] },
  { code: 'dish-mysore-pak', name: 'Mysore pak', aliases: 'mysorepak ghee', category: 'Sweets', recipe: [['B001', 50], ['T013', 70], ['usda:sugar', 100]], cooked_g: 220, portions: [piece(25, '1 piece')] },
  { code: 'dish-motichoor-ladoo', name: 'Motichoor ladoo', aliases: 'laddu motichur', category: 'Sweets', recipe: [['B001', 50], ['usda:sugar', 60], ['T013', 25]], cooked_g: 140, portions: [piece(30, '1 ladoo')] },
  { code: 'dish-boondi-ladoo', name: 'Boondi ladoo', aliases: 'laddu bundi tirupati laddu', category: 'Sweets', recipe: [['B001', 50], ['usda:sugar', 60], [OIL, 20], ['H005', 3], ['E057', 3]], cooked_g: 140, portions: [piece(35, '1 ladoo')] },
  { code: 'dish-rava-ladoo', name: 'Rava ladoo', aliases: 'sooji laddu rava unde', category: 'Sweets', recipe: [['A022', 50], ['usda:sugar', 40], ['T013', 15], ['H007', 15]], cooked_g: 125, portions: [piece(30, '1 ladoo')] },
  { code: 'dish-coconut-ladoo', name: 'Coconut ladoo', aliases: 'nariyal laddu thengai', category: 'Sweets', recipe: [['H007', 60], ['usda:sugar', 30], ['L002', 30]], cooked_g: 110, portions: [piece(25, '1 ladoo')] },
  { code: 'dish-dry-fruit-ladoo', name: 'Dry fruit ladoo (dates & nuts)', aliases: 'khajur laddu dates ladoo', category: 'Sweets', recipe: [['E018', 60], ['H001', 15], ['H005', 15], ['H021', 10]], cooked_g: 100, portions: [piece(25, '1 ladoo')] },
  { code: 'dish-til-ladoo', name: 'Til ladoo', aliases: 'sesame laddu ellu urundai', category: 'Sweets', recipe: [['H011', 60], ['I001', 40]], cooked_g: 95, portions: [piece(20, '1 ladoo')] },
  { code: 'dish-peanut-chikki', name: 'Peanut chikki', aliases: 'groundnut chikki gajak brittle', category: 'Sweets', recipe: [['H012', 60], ['I001', 40]], cooked_g: 95, portions: [piece(20, '1 piece')] },
  { code: 'dish-peda', name: 'Peda', aliases: 'pedha doodh peda mathura', category: 'Sweets', recipe: [['L004', 100], ['usda:sugar', 30]], cooked_g: 120, portions: [piece(20, '1 peda')] },
  { code: 'dish-milk-barfi', name: 'Milk barfi (khoa)', aliases: 'burfi mawa barfi', category: 'Sweets', recipe: [['L004', 100], ['usda:sugar', 35]], cooked_g: 125, portions: [piece(25, '1 piece')] },
  { code: 'dish-kalakand', name: 'Kalakand', aliases: 'milk cake', category: 'Sweets', recipe: [['L003', 100], ['L002', 200], ['usda:sugar', 30]], cooked_g: 170, portions: [piece(30, '1 piece')] },
  { code: 'dish-sandesh', name: 'Sandesh', aliases: 'sondesh chenna', category: 'Sweets', recipe: [['L003', 100], ['usda:sugar', 25]], cooked_g: 115, portions: [piece(25, '1 piece')] },
  { code: 'dish-cham-cham', name: 'Cham cham', aliases: 'chum chum', category: 'Sweets', recipe: [['L003', 60], ['usda:sugar', 25], ['L004', 10]], cooked_g: 90, portions: [piece(45, '1 piece')] },
  { code: 'dish-rasmalai', name: 'Rasmalai', aliases: 'ras malai', category: 'Sweets', recipe: [['L003', 60], ['L002', 200], ['usda:sugar', 30], ['H018', 3]], cooked_g: 220, portions: [piece(70, '1 piece with milk')] },
  { code: 'dish-rabri', name: 'Rabri', aliases: 'rabdi', category: 'Sweets', recipe: [['L002', 500], ['usda:sugar', 30]], cooked_g: 170, portions: [{ label: '1 small bowl', grams: 100 }] },
  { code: 'dish-basundi', name: 'Basundi', aliases: 'basundi sweet milk', category: 'Sweets', recipe: [['L002', 500], ['usda:sugar', 40], ['H001', 5]], cooked_g: 250, portions: [{ label: '1 small bowl', grams: 100 }] },
  { code: 'dish-kulfi', name: 'Kulfi', aliases: 'malai kulfi matka', category: 'Sweets', recipe: [['L002', 400], ['usda:sugar', 30], ['H018', 5]], cooked_g: 180, portions: [piece(60, '1 kulfi')] },
  { code: 'dish-shrikhand', name: 'Shrikhand', aliases: 'amrakhand srikhand', category: 'Sweets', recipe: [['usda:curd', 250], ['usda:sugar', 40]], cooked_g: 165, portions: [{ label: '1 small bowl', grams: 100 }] },
  { code: 'dish-phirni', name: 'Phirni', aliases: 'firni rice pudding', category: 'Sweets', recipe: [['A015', 20], ['L002', 250], ['usda:sugar', 25]], cooked_g: 230, portions: [{ label: '1 small bowl', grams: 100 }] },
  { code: 'dish-semiya-payasam', name: 'Semiya payasam', aliases: 'seviyan kheer vermicelli kheer', category: 'Sweets', recipe: [['L002', 200], ['A023', 20], ['usda:sugar', 25], ['T013', 5], ['H005', 5]], cooked_g: 220, portions: [katori] },
  { code: 'dish-sheer-khurma', name: 'Sheer khurma', aliases: 'sheer korma eid', category: 'Sweets', recipe: [['L002', 300], ['A023', 15], ['E018', 10], ['usda:sugar', 20], ['T013', 5], ['H001', 5], ['H018', 5]], cooked_g: 300, portions: [katori] },
  { code: 'dish-sakkarai-pongal', name: 'Sakkarai pongal', aliases: 'sweet pongal chakkara pongali', category: 'Sweets', recipe: [['A015', 40], ['B010', 10], ['I001', 50], ['T013', 15], ['H005', 5]], cooked_g: 260, portions: [katori] },
  { code: 'dish-moong-dal-halwa', name: 'Moong dal halwa', aliases: 'moong halwa', category: 'Sweets', recipe: [['B010', 50], ['T013', 50], ['usda:sugar', 50], ['L002', 100]], cooked_g: 220, portions: [{ label: '1 small bowl', grams: 100 }] },
  { code: 'dish-badam-halwa', name: 'Badam halwa', aliases: 'almond halwa', category: 'Sweets', recipe: [['H001', 50], ['T013', 25], ['usda:sugar', 40], ['L002', 50]], cooked_g: 140, portions: [{ label: '1 small bowl', grams: 70 }] },
  { code: 'dish-atta-halwa', name: 'Atta halwa (sheera)', aliases: 'wheat halwa kada prasad', category: 'Sweets', recipe: [['A019', 40], ['T013', 30], ['usda:sugar', 40]], cooked_g: 160, portions: [{ label: '1 small bowl', grams: 100 }] },
  { code: 'dish-mohanthal', name: 'Mohanthal', aliases: 'besan barfi', category: 'Sweets', recipe: [['B001', 50], ['T013', 40], ['usda:sugar', 50], ['L004', 15]], cooked_g: 150, portions: [piece(30, '1 piece')] },
  { code: 'dish-soan-papdi', name: 'Soan papdi', aliases: 'son papdi patisa', category: 'Sweets', recipe: [['B001', 30], ['A018', 30], ['T013', 30], ['usda:sugar', 60]], cooked_g: 150, portions: [piece(20, '1 piece')] },
  { code: 'dish-balushahi', name: 'Balushahi', aliases: 'badusha', category: 'Sweets', recipe: [['A018', 50], ['T013', 15], [OIL, 15], ['usda:sugar', 40]], cooked_g: 115, portions: [piece(40, '1 piece')] },
  { code: 'dish-imarti', name: 'Imarti', aliases: 'jangiri jhangri', category: 'Sweets', recipe: [['B003', 30], ['usda:sugar', 50], [OIL, 15]], cooked_g: 100, portions: [piece(40, '1 piece')] },
  { code: 'dish-malpua', name: 'Malpua', aliases: 'malpura', category: 'Sweets', recipe: [['A018', 30], ['L002', 50], ['usda:sugar', 30], [OIL, 10]], cooked_g: 110, portions: [piece(55, '1 malpua')] },
  { code: 'dish-gujiya', name: 'Gujiya', aliases: 'karanji kajjikayalu', category: 'Sweets', recipe: [['A018', 30], ['L004', 20], ['usda:sugar', 15], ['T013', 3], [OIL, 10]], cooked_g: 75, portions: [piece(40, '1 gujiya')] },
  { code: 'dish-modak', name: 'Modak (steamed)', aliases: 'ukadiche modak kozhukattai', category: 'Sweets', recipe: [['usda:rice_flour', 30], ['H007', 30], ['I001', 20], ['T013', 3]], cooked_g: 110, portions: [piece(40, '1 modak')] },
  { code: 'dish-puran-poli', name: 'Puran poli', aliases: 'obbattu holige bobbatlu', category: 'Sweets', recipe: [['A019', 40], ['B001', 40], ['I001', 40], ['T013', 8]], cooked_g: 150, portions: [piece(80, '1 poli')] },
  { code: 'dish-adhirasam', name: 'Adhirasam', aliases: 'ariselu kajjaya', category: 'Sweets', recipe: [['usda:rice_flour', 50], ['I001', 40], [OIL, 15]], cooked_g: 105, portions: [piece(35, '1 piece')] },
  { code: 'dish-unniyappam', name: 'Unniyappam', aliases: 'nei appam', category: 'Sweets', recipe: [['usda:rice_flour', 30], ['I001', 20], ['E012', 20], ['H007', 5], [OIL, 8]], cooked_g: 85, portions: [piece(20, '1 piece')] },
  { code: 'dish-shakarpara', name: 'Shakarpara', aliases: 'shankarpali', category: 'Sweets', recipe: [['A018', 50], ['usda:sugar', 20], ['T013', 8], [OIL, 12]], cooked_g: 90, portions: [handful(30)] },
  // Churros and chocolate
  { code: 'dish-churros', name: 'Churros (cinnamon sugar)', aliases: 'churro spanish doughnut', category: 'Sweets', recipe: [['A018', 50], ['usda:butter', 10], ['usda:sugar', 10], [OIL, 15]], cooked_g: 110, portions: [piece(25, '1 churro'), { label: '4 churros', grams: 100 }] },
  { code: 'dish-churros-chocolate', name: 'Churros with chocolate dip', aliases: 'churro chocolate sauce', category: 'Sweets', recipe: [['A018', 50], ['usda:butter', 10], ['usda:sugar', 10], [OIL, 15], ['usda:dark_chocolate', 25], ['usda:cream', 25]], cooked_g: 160, portions: [{ label: '4 churros + dip', grams: 145 }] },
  { code: 'dish-chocolate-sauce', name: 'Chocolate dipping sauce (ganache)', aliases: 'chocolate dip ganache', category: 'Sweets', recipe: [['usda:dark_chocolate', 50], ['usda:cream', 50]], cooked_g: 100, portions: [tbsp(20), { label: '1 small dip cup', grams: 50 }] },
  { code: 'dish-spanish-hot-chocolate', name: 'Thick hot chocolate (Spanish style)', aliases: 'chocolate a la taza churros drink', category: 'Beverages', recipe: [['L002', 150], ['usda:dark_chocolate', 40], ['usda:sugar', 5]], cooked_g: 190, basis: '100ml', portions: [cup] },
  // Hot chocolate
  { code: 'dish-hot-chocolate', name: 'Hot chocolate (cocoa, milk, sugar)', aliases: 'hot cocoa drinking chocolate', category: 'Beverages', recipe: [['L002', 200], ['usda:cocoa', 10], ['usda:sugar', 15]], cooked_g: 220, basis: '100ml', portions: [{ label: '1 mug', grams: 250 }, cup] },
  { code: 'dish-hot-chocolate-bar', name: 'Hot chocolate (melted milk chocolate)', aliases: 'hot cocoa rich chocolate drink', category: 'Beverages', recipe: [['L002', 200], ['usda:milk_chocolate', 30]], cooked_g: 230, basis: '100ml', portions: [{ label: '1 mug', grams: 250 }, cup] },
];

/** Packaged foods, from the maker's own label (per 100 g). */
export const BRANDED: BrandedDef[] = [
  {
    code: 'brand-ferrero-rocher',
    name: 'Ferrero Rocher',
    aliases: 'ferrero chocolate praline hazelnut',
    category: 'Sweets',
    diet: 'veg',
    per100: { kcal: 603, protein: 8.2, fat: 42.7, carbs: 44.4, fibre: 0, sugar: 39.9, sodium_mg: 60 },
    portions: [piece(12.5, '1 piece'), { label: 'Pack of 4', grams: 50 }],
    url: 'https://www.ferrerorocher.com/in/en/our-products/ferrero-rocher/sharing-pack-with-4-pieces',
    note: 'Ferrero India label, per 100 g (1 piece = 12.5 g), read 2026-11-20. Fibre isn’t printed, so it shows as 0.',
  },
  {
    code: 'brand-nutella',
    name: 'Nutella hazelnut spread',
    aliases: 'nutella chocolate spread',
    category: 'Sweets',
    diet: 'veg',
    per100: { kcal: 533, protein: 6.3, fat: 30.9, carbs: 57.5, fibre: 0, sugar: 56.3, sodium_mg: 43 },
    portions: [{ label: '1 portion (about 1 tsp)', grams: 15 }, tbsp(20)],
    url: 'https://www.nutella.com/in/en/products/nutella',
    note: 'Nutella India label, per 100 g (portion 15 g), read 2026-11-20. Sodium from the printed salt (0.107 g). Fibre isn’t printed, so it shows as 0.',
  },
];
