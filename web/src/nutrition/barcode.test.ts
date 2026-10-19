import { describe, expect, it } from 'vitest';
import { isIndianBarcode, isValidBarcode, mapOffProduct, normaliseBarcode, offProductUrl } from './barcode';

describe('barcodes', () => {
  it('checks the GS1 check digit for EAN-13, EAN-8 and UPC-A', () => {
    expect(isValidBarcode('8901063035027')).toBe(true); // Britannia, India
    expect(isValidBarcode('8901063035028')).toBe(false);
    expect(isValidBarcode('96385074')).toBe(true); // EAN-8
    expect(isValidBarcode('036000291452')).toBe(true); // UPC-A
    expect(isValidBarcode('12345')).toBe(false);
  });

  it('normalises spacing and UPC-A so the same product always matches', () => {
    expect(normaliseBarcode(' 890 1063 035027 ')).toBe('8901063035027');
    expect(normaliseBarcode('036000291452')).toBe('0036000291452');
    expect(isIndianBarcode('8901063035027')).toBe(true);
  });

  it('only sends the barcode to Open Food Facts', () => {
    expect(offProductUrl('8901063035027')).toMatch(/^https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/8901063035027\.json\?fields=/);
  });
});

describe('Open Food Facts mapping', () => {
  // Trimmed from a real response (Milk Bikis, 8901063035027).
  const milkBikis = {
    status: 1,
    product: {
      product_name: 'Milk Bikis',
      brands: 'Britannia, Britannia Industries',
      quantity: '200 g',
      nutriments: { 'energy-kcal_100g': 498, proteins_100g: 7, carbohydrates_100g: 68, fat_100g: 22, sugars_100g: 31.5, sodium_100g: 0.25 },
    },
  };

  it('fills the label form per 100 g, ready for you to check', () => {
    const r = mapOffProduct('8901063035027', milkBikis);
    expect(r.status).toBe('found');
    expect(r.draft).toMatchObject({ barcode: '8901063035027', name: 'Milk Bikis', brand: 'Britannia', basis: '100g', kcal: 498, protein: 7, carbs: 68, fat: 22, fibre: 0, sugar: 31.5, sodium_mg: 250 });
    expect(r.url).toBe('https://world.openfoodfacts.org/product/8901063035027');
  });

  it('flags missing values instead of guessing, converts kJ, spots drinks and servings', () => {
    const r = mapOffProduct('8901234567890', {
      status: 1,
      product: { product_name: 'Lassi', quantity: '200 ml', serving_size: '200 ml', serving_quantity: 200, nutriments: { 'energy-kj_100g': 418, proteins_100g: 3 } },
    });
    expect(r.status).toBe('incomplete');
    expect(r.draft).toMatchObject({ kcal: 100, basis: '100ml', serving_g: 200 });
    expect(Number.isNaN(r.draft!.carbs)).toBe(true);
    expect(r.warnings.join(' ')).toMatch(/kJ/);
    expect(r.warnings.join(' ')).toMatch(/Missing carbs, fat/);
    expect(r.draft!.portions).toEqual([{ label: '1 serving (200 ml)', grams: 200 }]);
  });

  it('reports products it doesn’t know', () => {
    expect(mapOffProduct('8900000000000', { status: 0 }).status).toBe('not_found');
    expect(mapOffProduct('8900000000000', null).draft).toBeNull();
  });
});
