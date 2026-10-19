import type { DietType } from '../foodLog';

/** One orderable size/crust of an item, with nutrition per serving as published. */
export interface RawOption {
  label: string;
  /** Serving weight (g or ml) when published. */
  grams?: number | null;
  /** Slices in one published serving (pizzas), so you can log by slice. */
  slices?: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number | null;
  sodium_mg?: number | null;
}

export interface RawMenuItem {
  name: string;
  category: string;
  ml?: boolean;
  diet?: DietType;
  options: RawOption[];
}

export type ChainId = 'mcdonalds' | 'dominos' | 'california-burrito';

export interface Chain {
  id: ChainId;
  name: string;
  emoji: string;
  source: { title: string; url: string; captured: string };
  /** What's covered and what isn't, shown to you. */
  coverage: string;
}

export interface MenuItem extends RawMenuItem {
  id: string;
  chain: ChainId;
  diet: DietType;
}
