import type { GoalSettings, Meal, MealCategory } from '../models';

export const APP_NAME = 'LunchBox';
export const APP_VERSION = '1.1.0';
export const APP_TAGLINE = 'Your daily lunch, logged with joy.';

export const DATE_KEY_FORMAT = 'YYYY-MM-DD';
export const MONTH_KEY_FORMAT = 'YYYY-MM';

/** Single source of truth for storage keys — no magic strings elsewhere. */
export const STORAGE_KEYS = {
  user: 'lunchbox.user',
  meals: 'lunchbox.meals',
  logs: 'lunchbox.logs',
  theme: 'lunchbox.theme',
  seeded: 'lunchbox.seeded',
  smoothiesSeeded: 'lunchbox.seeded.smoothies',
  goals: 'lunchbox.goals',
  achievements: 'lunchbox.achievements',
} as const;

interface CategoryMeta {
  emoji: string;
  plural: string;
  /** Accent color used for badges / calendar fills / progress bars. */
  color: string;
  /** Gradient used on the big category picker cards. */
  gradient: string;
  description: string;
}

export const CATEGORY_META: Record<MealCategory, CategoryMeta> = {
  Sandwich: {
    emoji: '🥪',
    plural: 'Sandwiches',
    color: '#F59E0B',
    gradient: 'linear-gradient(135deg, #FDE68A 0%, #F59E0B 100%)',
    description: 'Toasty, stacked & satisfying',
  },
  Salad: {
    emoji: '🥗',
    plural: 'Salads',
    color: '#22C55E',
    gradient: 'linear-gradient(135deg, #BBF7D0 0%, #22C55E 100%)',
    description: 'Fresh, crunchy & colorful',
  },
  Smoothie: {
    emoji: '🥤',
    plural: 'Smoothies',
    color: '#EC4899',
    gradient: 'linear-gradient(135deg, #FBCFE8 0%, #EC4899 100%)',
    description: 'Cool, blended & fruity',
  },
};

export const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

const BASE_MEALS: readonly Omit<Meal, 'createdAt'>[] = [
  { id: 'meal_001', name: 'Paneer Sandwich', category: 'Sandwich' },
  { id: 'meal_002', name: 'Club Sandwich', category: 'Sandwich' },
  { id: 'meal_003', name: 'Veg Sandwich', category: 'Sandwich' },
  { id: 'meal_004', name: 'Grilled Cheese', category: 'Sandwich' },
  { id: 'meal_005', name: 'Caesar Salad', category: 'Salad' },
  { id: 'meal_006', name: 'Greek Salad', category: 'Salad' },
  { id: 'meal_007', name: 'Garden Salad', category: 'Salad' },
  { id: 'meal_008', name: 'Pasta Salad', category: 'Salad' },
];

/** Seeded separately so existing installs (pre-Smoothie) get them once. */
export const DEFAULT_SMOOTHIE_MEALS: readonly Omit<Meal, 'createdAt'>[] = [
  { id: 'meal_009', name: 'Mango Smoothie', category: 'Smoothie' },
  { id: 'meal_010', name: 'Banana Smoothie', category: 'Smoothie' },
  { id: 'meal_011', name: 'Strawberry Smoothie', category: 'Smoothie' },
  { id: 'meal_012', name: 'Mixed Berry Smoothie', category: 'Smoothie' },
  { id: 'meal_013', name: 'Chocolate Protein Smoothie', category: 'Smoothie' },
  { id: 'meal_014', name: 'Green Smoothie', category: 'Smoothie' },
];

/** Full starter catalog for fresh installs. */
export const DEFAULT_MEALS: readonly Omit<Meal, 'createdAt'>[] = [
  ...BASE_MEALS,
  ...DEFAULT_SMOOTHIE_MEALS,
];

export const DEFAULT_GOAL_SETTINGS: GoalSettings = {
  totalDays: 30,
  categoryTargets: { Sandwich: 15, Salad: 15, Smoothie: 0 },
};

export const GOAL_MAX_TARGET = 365;

export const RECENT_LOGS_LIMIT = 10;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EXPORT_FILE_BASENAME = 'lunchbox-meals';
