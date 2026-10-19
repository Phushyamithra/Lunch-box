/**
 * Barcodes and Open Food Facts. Pure.
 *
 * Packaged foods carry EAN-13 (most Indian products start with 890), EAN-8
 * or UPC-A codes. Lookups go: your own products → Open Food Facts (open,
 * community-entered data) → you enter the label. Open Food Facts values are
 * never treated as official: you check them against the pack before saving.
 */
import type { FoodInput } from './foodLog';

/** Digits only; UPC-A (12) becomes EAN-13 with a leading 0 so both spellings match. */
export function normaliseBarcode(raw: string): string {
  const d = raw.replace(/\D/g, '');
  return d.length === 12 ? `0${d}` : d;
}

/** GS1 check digit for EAN-8 / EAN-13 / GTIN-14. */
export function isValidBarcode(raw: string): boolean {
  const d = normaliseBarcode(raw);
  if (![8, 13, 14].includes(d.length)) return false;
  const digits = [...d].map(Number);
  const check = digits.pop() as number;
  const sum = digits
    .reverse()
    .reduce((a, n, i) => a + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

export const isIndianBarcode = (code: string) => normaliseBarcode(code).startsWith('890');

export interface OffLookup {
  status: 'found' | 'incomplete' | 'not_found';
  /** Prefill for the label form (always reviewed by you before saving). */
  draft: (FoodInput & { barcode: string }) | null;
  /** What's missing or looks off, shown next to the form. */
  warnings: string[];
  url: string;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Maps an Open Food Facts v2 product response into a label-form draft. */
export function mapOffProduct(code: string, json: unknown): OffLookup {
  const barcode = normaliseBarcode(code);
  const url = `https://world.openfoodfacts.org/product/${barcode}`;
  const body = (json ?? {}) as { status?: number; product?: Record<string, unknown> };
  if (body.status !== 1 || !body.product) return { status: 'not_found', draft: null, warnings: [], url };
  const p = body.product;
  const n = (p.nutriments ?? {}) as Record<string, unknown>;
  const warnings: string[] = [];

  let kcal = num(n['energy-kcal_100g']);
  if (kcal === null && num(n['energy-kj_100g']) !== null) {
    kcal = Math.round((num(n['energy-kj_100g']) as number) / 4.184);
    warnings.push('Calories converted from kJ.');
  }
  const protein = num(n.proteins_100g);
  const carbs = num(n.carbohydrates_100g);
  const fat = num(n.fat_100g);
  const missing = [
    ['calories', kcal],
    ['protein', protein],
    ['carbs', carbs],
    ['fat', fat],
  ]
    .filter(([, v]) => v === null)
    .map(([k]) => k);
  if (missing.length) warnings.push(`Missing ${missing.join(', ')}: copy them from the pack.`);
  const liquid = /ml|cl|\bl\b|litre/i.test(String(p.quantity ?? '')) || String(n['nutrition_data_per'] ?? p.nutrition_data_per ?? '').includes('ml');
  const servingG = num(p.serving_quantity);
  const sodiumG = num(n.sodium_100g);
  const name = String(p.product_name_en ?? p.product_name ?? '').trim();
  if (!name) warnings.push('No product name: add one.');
  const brand = String(p.brands ?? '')
    .split(',')[0]
    .trim();

  return {
    status: missing.length || !name ? 'incomplete' : 'found',
    warnings,
    url,
    draft: {
      barcode,
      name: name || `Product ${barcode}`,
      brand: brand || null,
      diet: null,
      basis: liquid ? '100ml' : '100g',
      serving_g: servingG && servingG > 0 ? servingG : null,
      portions: servingG && servingG > 0 && p.serving_size ? [{ label: `1 serving (${String(p.serving_size)})`.slice(0, 60), grams: servingG }] : [],
      kcal: kcal ?? NaN,
      protein: protein ?? NaN,
      carbs: carbs ?? NaN,
      fat: fat ?? NaN,
      fibre: num(n.fiber_100g) ?? 0,
      sugar: num(n.sugars_100g),
      sodium_mg: sodiumG === null ? null : Math.round(sodiumG * 1000),
    },
  };
}

export const OFF_FIELDS = 'code,product_name,product_name_en,brands,quantity,serving_size,serving_quantity,nutriments,nutrition_data_per';
export const offProductUrl = (code: string) => `https://world.openfoodfacts.org/api/v2/product/${normaliseBarcode(code)}.json?fields=${OFF_FIELDS}`;
