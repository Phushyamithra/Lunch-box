import type { GoalSettings, MealCategory, Nutrition } from '../models';

export const APP_NAME = 'LunchBox';
export const APP_VERSION = '1.4.0';
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
  workbookSeeded: 'lunchbox.seeded.workbook',
  goals: 'lunchbox.goals',
  achievements: 'lunchbox.achievements',
  sync: 'lunchbox.sync',
  syncTasks: 'lunchbox.sync.tasks',
  syncToken: 'lunchbox.sync.token',
  workbooks: 'lunchbox.workbooks',
  categories: 'lunchbox.categories',
  categoriesSeeded: 'lunchbox.seeded.categories',
} as const;

export interface CategoryMeta {
  emoji: string;
  plural: string;
  /** Accent color used for badges / calendar fills / progress bars. */
  color: string;
  /** Gradient used on the big category picker cards. */
  gradient: string;
  description: string;
}

/** Rich metadata for categories we know about. */
const KNOWN_CATEGORY_META: Record<string, CategoryMeta> = {
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
  Beverage: {
    emoji: '🧃',
    plural: 'Beverages',
    color: '#38BDF8',
    gradient: 'linear-gradient(135deg, #BAE6FD 0%, #38BDF8 100%)',
    description: 'Sip something delicious',
  },
};

/** Preferred display order for known categories (others follow, A→Z). */
export const KNOWN_CATEGORY_ORDER = Object.keys(KNOWN_CATEGORY_META);

/** Palette for auto-generated metadata of unknown categories. */
const FALLBACK_COLORS = ['#8B5CF6', '#F97316', '#06B6D4', '#84CC16', '#F43F5E', '#A855F7'];

/**
 * User-managed categories override the static metadata below.
 * CategoryService registers {icon, color} per category name at bootstrap
 * and after every category mutation, so ALL components pick up custom
 * icons/colors through the same getCategoryMeta call — no prop changes.
 */
const categoryOverrides = new Map<string, { icon: string; color: string }>();

export function registerCategoryOverrides(
  categories: { name: string; icon: string; color: string }[],
): void {
  categoryOverrides.clear();
  for (const c of categories) {
    categoryOverrides.set(c.name.trim().toLowerCase(), { icon: c.icon, color: c.color });
  }
}

const toGradient = (color: string): string =>
  `linear-gradient(135deg, ${color}55 0%, ${color} 100%)`;

/**
 * Metadata for ANY category: user overrides (Manage Categories) first,
 * then curated known meta, then a stable generated fallback — so new
 * categories work with zero code changes.
 */
export function getCategoryMeta(category: MealCategory): CategoryMeta {
  const key = category.trim().toLowerCase();
  const known = Object.keys(KNOWN_CATEGORY_META).find((k) => k.toLowerCase() === key);
  const base = known ? KNOWN_CATEGORY_META[known] : null;
  const override = categoryOverrides.get(key);
  if (override) {
    return {
      emoji: override.icon,
      plural: base?.plural ?? (category.endsWith('s') ? category : `${category}s`),
      color: override.color,
      gradient: toGradient(override.color),
      description: base?.description ?? 'Tasty & tracked',
    };
  }
  if (base) return base;

  let hash = 0;
  for (const ch of category) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const color = FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
  return {
    emoji: '🍽️',
    plural: category.endsWith('s') ? category : `${category}s`,
    color,
    gradient: `linear-gradient(135deg, ${color}55 0%, ${color} 100%)`,
    description: 'Tasty & tracked',
  };
}

/** Known categories first (curated order), then the rest alphabetically. */
export function orderCategories(categories: MealCategory[]): MealCategory[] {
  return [...new Set(categories)].sort((a, b) => {
    const ia = KNOWN_CATEGORY_ORDER.indexOf(a);
    const ib = KNOWN_CATEGORY_ORDER.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b);
  });
}

export const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

/** Display metadata for the five tracked nutrients. */
export const NUTRIENT_META: { key: keyof Nutrition; label: string; unit: string; emoji: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal', emoji: '🔥' },
  { key: 'protein', label: 'Protein', unit: 'g', emoji: '💪' },
  { key: 'carbs', label: 'Carbs', unit: 'g', emoji: '🍞' },
  { key: 'fiber', label: 'Fiber', unit: 'g', emoji: '🌾' },
  { key: 'fat', label: 'Fat', unit: 'g', emoji: '🥑' },
];

export const EMPTY_NUTRITION: Nutrition = { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 };

export const DEFAULT_GOAL_SETTINGS: GoalSettings = {
  totalDays: 30,
  categoryTargets: { Sandwich: 15, Salad: 15, Smoothie: 0 },
};

export const GOAL_MAX_TARGET = 365;

/** Preset accent colors offered in the category editor. */
export const CATEGORY_COLOR_PALETTE = [
  '#F59E0B', '#22C55E', '#EC4899', '#38BDF8', '#8B5CF6',
  '#F97316', '#06B6D4', '#84CC16', '#F43F5E', '#A855F7',
] as const;

export const RECENT_LOGS_LIMIT = 10;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EXPORT_FILE_BASENAME = 'lunchbox-meals';
export const IMPORT_ACCEPT = '.xlsx,.xls,.xlsm,.csv';
/** Max size (bytes) of an original workbook we keep for future export. */
export const MAX_STORED_WORKBOOK_BYTES = 3 * 1024 * 1024;
