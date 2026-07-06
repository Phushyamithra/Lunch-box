import * as XLSX from 'xlsx';
import { EXPORT_FILE_BASENAME } from '../constants';
import type { ExportFormat, Meal } from '../models';

export interface RawMealRow {
  name: string;
  category: string;
  /** 1-based spreadsheet row, for potential error reporting. */
  rowIndex: number;
}

const NAME_HEADER = /^(meal\s*)?name$/i;
const CATEGORY_HEADER = /^category$/i;

/**
 * Parses .xlsx / .xls / .csv into raw rows. Throws friendly Errors for
 * anything unreadable — callers surface `error.message` directly.
 */
export async function parseSpreadsheet(file: File): Promise<RawMealRow[]> {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  } catch {
    throw new Error("Couldn't read that file. Please upload a valid .xlsx, .xls or .csv file.");
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('The file has no sheets.');

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (rows.length === 0) throw new Error('The file has no data rows.');

  const headers = Object.keys(rows[0]);
  const nameKey = headers.find((h) => NAME_HEADER.test(h.trim()));
  const categoryKey = headers.find((h) => CATEGORY_HEADER.test(h.trim()));
  if (!nameKey || !categoryKey) {
    throw new Error('Missing required columns. Expected "Meal Name" and "Category" headers.');
  }

  return rows.map((row, i) => ({
    name: String(row[nameKey]).trim(),
    category: String(row[categoryKey]).trim(),
    rowIndex: i + 2, // +1 header, +1 to 1-based
  }));
}

/** Downloads the catalog as .xlsx or .csv via SheetJS. */
export function downloadCatalog(meals: Meal[], format: ExportFormat): void {
  const worksheet = XLSX.utils.json_to_sheet(
    meals.map((m) => ({ 'Meal Name': m.name, Category: m.category })),
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Meals');
  XLSX.writeFile(workbook, `${EXPORT_FILE_BASENAME}.${format}`, { bookType: format });
}
