import * as XLSX from 'xlsx';
import { EXPORT_FILE_BASENAME } from '../constants';
import type { ExportFormat, Meal, Nutrition } from '../models';

export interface RawMealRow {
  name: string;
  category: string;
  nutrition: Nutrition;
  /** 1-based spreadsheet row, for potential error reporting. */
  rowIndex: number;
}

export interface ParsedWorkbook {
  rows: RawMealRow[];
  /** VBA project detected. Macros are NEVER executed — only meal data is read. */
  hasMacros: boolean;
  fileName: string;
}

// Header detection — tolerant of both the legacy template
// (Meal Name / Category) and the nutrition workbook (Item Name / Type).
const NAME_HEADER = /^((meal|item)\s*)?name$/i;
const CATEGORY_HEADER = /^(category|type)$/i;
const NUTRIENT_HEADERS: { key: keyof Nutrition; pattern: RegExp }[] = [
  { key: 'calories', pattern: /calor/i },
  { key: 'protein', pattern: /protein/i },
  { key: 'carbs', pattern: /carb/i },
  { key: 'fiber', pattern: /fib(er|re)/i },
  { key: 'fat', pattern: /^fat\b|fat\s*\(/i },
];

/** Nutrition cells must be numeric; anything else (or missing) becomes 0. */
function parseNutrient(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
  const parsed = Number(String(value ?? '').replace(/[^\d.\-]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Parses .xlsx / .xls / .xlsm / .csv into raw rows. Macro-enabled
 * workbooks are detected and flagged; VBA is preserved but never
 * executed. Throws friendly Errors for anything unreadable.
 */
export async function parseSpreadsheet(file: File): Promise<ParsedWorkbook> {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', bookVBA: true });
  } catch {
    throw new Error("Couldn't read that file. Please upload a valid .xlsx, .xls, .xlsm or .csv file.");
  }

  const hasMacros =
    Boolean((workbook as { vbaraw?: unknown }).vbaraw) ||
    /\.xlsm$/i.test(file.name);

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('The file has no sheets.');

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (rows.length === 0) throw new Error('The file has no data rows.');

  const headers = Object.keys(rows[0]);
  const nameKey = headers.find((h) => NAME_HEADER.test(h.trim()));
  const categoryKey = headers.find((h) => CATEGORY_HEADER.test(h.trim()));
  if (!nameKey || !categoryKey) {
    throw new Error(
      'Missing required columns. Expected "Item Name"/"Meal Name" and "Type"/"Category" headers.',
    );
  }
  const nutrientKeys = NUTRIENT_HEADERS.map(({ key, pattern }) => ({
    key,
    header: headers.find((h) => pattern.test(h.trim())),
  }));

  const parsed: RawMealRow[] = rows.map((row, i) => {
    const nutrition = { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 };
    for (const { key, header } of nutrientKeys) {
      if (header) nutrition[key] = parseNutrient(row[header]);
    }
    return {
      name: String(row[nameKey]).trim(),
      category: String(row[categoryKey]).trim(),
      nutrition,
      rowIndex: i + 2, // +1 header, +1 to 1-based
    };
  });

  return { rows: parsed, hasMacros, fileName: file.name };
}

/**
 * Downloads the catalog as .xlsx or .csv using the same column layout as
 * the bundled default workbook, so exports can be re-imported anywhere.
 */
export function downloadCatalog(meals: Meal[], format: ExportFormat): void {
  const worksheet = XLSX.utils.json_to_sheet(
    meals.map((m) => ({
      Type: m.category,
      'Item Name': m.name,
      'Calories (kcal)': m.nutrition.calories,
      'Protein (g)': m.nutrition.protein,
      'Carbs (g)': m.nutrition.carbs,
      'Fiber (g)': m.nutrition.fiber,
      'Fat (g)': m.nutrition.fat,
    })),
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Meals');
  XLSX.writeFile(workbook, `${EXPORT_FILE_BASENAME}.${format}`, { bookType: format });
}

/** Base64 of the original file, for preserving macro workbooks verbatim. */
export async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
