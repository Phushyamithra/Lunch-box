/**
 * Import a month summary written in Markdown (front matter + "## " sections
 * with tables and checklists). Pure. Produces a list of proposed records;
 * the preview decides what is added. Nothing existing is changed, and
 * importing the same file twice adds nothing new (ids are derived from the
 * month and the row).
 *
 * Recognised sections: Balances, Fixed and recurring, Logged purchases and
 * expenses, Income, Amazon Pay voucher, Pending reimbursements, Open
 * checklist. Others (e.g. card cycle estimates, month result) are listed as
 * not imported: the app works those out itself.
 */
import { excelDate, type Sheet } from '../lib/xlsx';
import { addMonths } from './engine';
import { VOUCHER_METHOD, type FinanceDoc, type IncomeSource, type ListItem, type MoneyEvent, type Paise } from './model';

export type ItemKind = 'transaction' | 'event' | 'voucher' | 'income' | 'task' | 'balance' | 'opening';

export interface ImportItem {
  key: string;
  section: string;
  kind: ItemKind;
  label: string;
  amount: Paise | null;
  /** Ticked by default? */
  include: boolean;
  /** Why it's unticked, or what was assumed. */
  note: string | null;
  /** For transactions: editable. */
  category?: string;
  method?: string;
  /** Uses the shared "undated" date. */
  undated?: boolean;
  date?: string;
  record: Record<string, unknown>;
}

export interface ParsedMonth {
  title: string;
  month: string;
  generated: string;
  items: ImportItem[];
  skippedSections: string[];
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const clean = (s: string) => s.replace(/\*\*/g, '').trim();
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

/** "₹2,013.05", "~600", "about 4,650", "2,000-3,000" → paise + whether it's approximate. */
export function parseAmount(s: string): { paise: Paise | null; approx: boolean } {
  const t = s.replace(/₹/g, '');
  const approx = /~|about|approx|expected|-\s*\d|–\s*\d/i.test(t.replace(/^\s*[-–]\s*$/, ''));
  const m = t.replace(/,/g, '').match(/\d+(?:\.\d{1,2})?/);
  if (!m) return { paise: null, approx };
  return { paise: Math.round(Number(m[0]) * 100), approx };
}

/** "Oct 16", "Oct 31", "about Feb 2027" → YYYY-MM-DD (year from the month when missing). */
export function parseDay(s: string, month: string): string | null {
  const m = s.toLowerCase().match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?/);
  if (!m) return null;
  const year = m[3] ? Number(m[3]) : Number(month.slice(0, 4));
  return `${year}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0')}-${String(Number(m[2])).padStart(2, '0')}`;
}
/** "Feb 2027" → that month's first day (conservative for expiries). */
function parseMonthYear(s: string): string | null {
  const m = s.toLowerCase().match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})/);
  return m ? `${m[2]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0')}-01` : null;
}

function tables(lines: string[]): string[][][] {
  const out: string[][][] = [];
  let cur: string[][] | null = null;
  for (const l of lines) {
    if (/^\s*\|/.test(l)) {
      const cells = l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(clean);
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      (cur ??= []).push(cells);
    } else if (cur) {
      out.push(cur);
      cur = null;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Category in the app for a row: kept if it already is one, else guessed from the words. */
export function guessCategory(given: string, text: string, categories: string[]): { category: string; guessed: boolean } {
  const g = given.trim();
  const known = categories.find((c) => c.toLowerCase() === g.toLowerCase());
  if (known) return { category: known, guessed: false };
  // "Bills" holds the planned gold scheme and SIP; extra bills there would look like overspending on them.
  if (/yearly|annual|bill/i.test(g)) return { category: 'Other', guessed: true };
  const t = `${text} ${g}`.toLowerCase();
  const rules: [RegExp, string][] = [
    [/protein|whey/, 'Protein'],
    [/oats|grocer|vegetable|milk|egg|chai|fruit/, 'Groceries'],
    [/petrol|fuel|diesel/, 'Fuel'],
    [/pet food|dog|cat|vet|pet toy|pet/, 'Pet'],
    [/chemist|medic|doctor|pharma|injury|health/, 'Health'],
    [/train|bus|auto|cab|uber|ola|station|flight|trip|travel/, 'Travel'],
    [/gym|cult/, 'Gym'],
    [/dinner|lunch|meal/, 'Dinner'],
  ];
  for (const [re, cat] of rules) if (re.test(t) && categories.includes(cat)) return { category: cat, guessed: true };
  return { category: categories.includes('Other') ? 'Other' : categories[0], guessed: true };
}

function guessMethod(given: string, methods: string[]): { method: string; note: string | null } {
  const g = given.toLowerCase();
  if (/amazon/.test(g)) return { method: VOUCHER_METHOD, note: null };
  for (const m of methods) if (g.includes(m.toLowerCase())) return { method: m, note: null };
  if (/cash/.test(g)) return { method: 'Cash', note: 'Cash: added as a payment method' };
  return { method: 'UPI', note: 'Payment method not given: assumed UPI' };
}

export function parseMonthMarkdown(md: string, opts: { categories: string[]; methods: string[] }): ParsedMonth | { error: string } {
  const text = md.replace(/\r\n/g, '\n');
  const fm: Record<string, string> = {};
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (fmMatch) for (const l of fmMatch[1].split('\n')) {
    const i = l.indexOf(':');
    if (i > 0) fm[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  const month = fm.month;
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { error: 'The file needs a front-matter line like “month: 2026-10”.' };
  const generated = /^\d{4}-\d{2}-\d{2}$/.test(fm.generated ?? '') ? fm.generated : `${month}-28`;
  const body = fmMatch ? text.slice(fmMatch[0].length) : text;

  const sections: { title: string; lines: string[] }[] = [];
  for (const l of body.split('\n')) {
    if (/^##\s+/.test(l)) sections.push({ title: clean(l.replace(/^##\s+/, '')), lines: [] });
    else sections[sections.length - 1]?.lines.push(l);
  }

  const items: ImportItem[] = [];
  const skippedSections: string[] = [];
  const id = (part: string, label: string, amount: Paise | null) => `imp-${month}-${part}-${slug(label)}-${amount ?? 0}`;
  const firstOfMonth = `${month}-01`;

  for (const sec of sections) {
    const t = sec.title.toLowerCase();
    const tbl = tables(sec.lines);
    const rows = tbl[0]?.slice(1) ?? [];

    if (t.startsWith('balances')) {
      const asOf = parseDay(sec.title, month) ?? generated;
      const total = rows.find((r) => /total/i.test(r[0]));
      const parts = rows.filter((r) => !/total/i.test(r[0]));
      const sum = total ? parseAmount(total[1]).paise : parts.reduce((a, r) => a + (parseAmount(r[1]).paise ?? 0), 0);
      if (sum !== null) {
        items.push({
          key: `bal-${asOf}`,
          section: sec.title,
          kind: 'balance',
          label: `Bank balance on ${asOf} (${parts.map((r) => r[0]).join(' + ')})`,
          amount: sum,
          include: true,
          note: 'Added as a balance check (Bank tab compares it with what’s expected).',
          record: { id: id('bal', asOf, sum), date: asOf, amount: sum, note: parts.map((r) => `${r[0]} ${r[1]}`).join('; ') },
        });
      }
      const open = sec.lines.join('\n').match(/opening balance[^:\n]*:\s*₹?\s*([\d,]+(?:\.\d+)?)/i);
      if (open) {
        const p = parseAmount(open[1]).paise;
        items.push({
          key: 'opening',
          section: sec.title,
          kind: 'opening',
          label: `Opening balance ${firstOfMonth} and tracking start ${month}`,
          amount: p,
          include: true,
          note: 'Changes Settings → Starting point.',
          record: { amount: p, month },
        });
      }
      continue;
    }

    if (t.startsWith('fixed')) {
      for (const r of rows) {
        const [name, amt, notes = ''] = r;
        const a = parseAmount(amt);
        if (a.paise === null) continue;
        if (/card bill/i.test(name)) {
          items.push({
            key: id('ev', name, a.paise),
            section: sec.title,
            kind: 'event',
            label: name,
            amount: a.paise,
            include: true,
            note: 'Old card bill (spending from before tracking): counted as one-off money out from the bank, not as a category.',
            undated: true,
            record: { id: id('ev', name, a.paise), kind: 'expense', amount: a.paise, description: `${name}${notes ? ` (${notes})` : ''}`, status: 'settled', account: 'bank', cardMethod: null },
          });
          continue;
        }
        const cat = /rent/i.test(name) ? 'Rent' : /gold|sip/i.test(name) ? 'Bills' : /insurance/i.test(name) ? 'Health' : /gym/i.test(name) ? 'Gym' : guessCategory('', name, opts.categories).category;
        items.push({
          key: id('tx', name, a.paise),
          section: sec.title,
          kind: 'transaction',
          label: name,
          amount: a.paise,
          include: !a.approx,
          note: a.approx ? 'Approximate amount: tick to add anyway.' : 'Logs the payment, so it counts once (not on top of the plan).',
          category: cat,
          method: 'UPI',
          date: firstOfMonth,
          record: { id: id('tx', name, a.paise), note: notes || null },
        });
      }
      continue;
    }

    if (t.startsWith('logged purchases') || t.startsWith('purchases') || t.startsWith('expenses')) {
      for (const r of rows) {
        const [name, amt, given = '', via = '', notes = ''] = r;
        const a = parseAmount(amt);
        if (a.paise === null) continue;
        const words = `${name} ${notes}`;
        const returned = /returned|net 0|refund received/i.test(notes);
        const reserve = /reserve|not yet spent/i.test(words);
        const cat = guessCategory(given, words, opts.categories);
        const m = guessMethod(via, opts.methods);
        const reasons = [returned ? 'Returned and refunded (net 0): not added' : null, reserve ? 'A reserve, not spent yet: not added' : null, a.approx && !reserve ? 'Approximate amount' : null].filter(Boolean);
        items.push({
          key: id('tx', name, a.paise),
          section: sec.title,
          kind: 'transaction',
          label: name,
          amount: a.paise,
          include: !returned && !reserve && !a.approx,
          note: [...reasons, cat.guessed ? `“${given || '—'}” isn’t a category here: guessed ${cat.category}` : null, /yearly|annual/i.test(`${given} ${name}`) ? 'Tip: add it under Settings → Periodic costs so next year is planned' : null, m.note].filter(Boolean).join(' · ') || null,
          category: cat.category,
          method: m.method,
          undated: true,
          record: {
            id: id('tx', name, a.paise),
            note: [name, notes].filter(Boolean).join(' · ').slice(0, 200),
            oneOff: /one-off|yearly|annual/i.test(`${notes} ${given}`) || undefined,
            cashbackCheck: /cashback to verify|verify cashback/i.test(notes) || undefined,
          },
        });
      }
      continue;
    }

    if (t.startsWith('income')) {
      for (const r of rows) {
        const [src, amt, tag = '', status = ''] = r;
        const a = parseAmount(amt);
        if (a.paise === null) continue;
        if (/salary/i.test(src)) {
          items.push({ key: `inc-salary`, section: sec.title, kind: 'income', label: src, amount: a.paise, include: false, note: 'Salary is already in your settings: not added.', record: {} });
          continue;
        }
        if (/not cash|voucher/i.test(`${tag} ${src}`)) {
          const on = parseDay(status, month) ?? generated;
          items.push({ key: `inc-voucher-${slug(src)}`, section: sec.title, kind: 'income', label: src, amount: a.paise, include: false, note: 'Voucher value: added from the “Amazon Pay voucher” section instead.', date: on, record: {} });
          continue;
        }
        const received = /received/i.test(status);
        const bonus = /bonus/i.test(tag);
        // "December bonus" → the next December; no month named → this file's month.
        const named = src.toLowerCase().match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
        const mm = named ? `${month.slice(0, 4)}-${String(MONTHS.indexOf(named[1]) + 1).padStart(2, '0')}` : month;
        const rec: Record<string, unknown> = {
          id: id('inc', src, a.paise),
          name: src,
          amount: a.paise,
          cadence: 'once',
          month: mm < month ? addMonths(mm, 12) : mm,
          until: null,
          reliability: bonus ? 'bonus' : 'reliable',
          certainty: a.approx || /estimat|unconfirmed/i.test(status) ? 'estimated' : 'confirmed',
          receivedOn: received ? generated : null,
          receivedAmount: null,
        };
        items.push({
          key: id('inc', src, a.paise),
          section: sec.title,
          kind: 'income',
          label: `${src} (${bonus ? 'bonus-only' : 'reliable'}, ${received ? 'received' : 'expected'})`,
          amount: a.paise,
          include: true,
          note: received ? `Counts as received on ${generated}.` : 'Not counted until you mark it received.',
          record: rec,
        });
      }
      continue;
    }

    if (t.includes('voucher')) {
      const recv = sec.lines.find((l) => /received/i.test(l));
      if (recv) {
        const a = parseAmount(recv.split(':').slice(1).join(':'));
        const on = parseDay(recv.replace(/^.*?:/, ''), month) ?? generated;
        const exp = /expir/i.test(recv) ? parseMonthYear(recv.slice(recv.search(/expir/i))) : null;
        if (a.paise !== null) {
          items.push({
            key: id('vch', 'load', a.paise),
            section: sec.title,
            kind: 'voucher',
            label: `Amazon Pay value received ${on}${exp ? `, expires ~${exp.slice(0, 7)}` : ''}`,
            amount: a.paise,
            include: true,
            note: exp ? 'Expiry approximate: set to the 1st of that month (warns early). Purchases paid with Amazon Pay come out of it.' : 'Purchases paid with Amazon Pay come out of it.',
            record: { id: id('vch', 'load', a.paise), date: on, kind: 'load', amount: a.paise, expiresOn: exp, note: recv.replace(/^[-*\s]*/, '').slice(0, 120) },
          });
        }
      }
      continue;
    }

    if (t.includes('reimbursement')) {
      for (const l of sec.lines) {
        const m = l.match(/^\s*[-*]\s*\[( |x)\]\s*(.+)$/i);
        if (!m) continue;
        const a = parseAmount(m[2]);
        if (a.paise === null) continue;
        const desc = m[2].split(/\d/)[0].replace(/[,\s]+$/, '').trim() || m[2];
        const filed = /\bfiled\b/i.test(m[2]);
        const received = m[1].toLowerCase() === 'x' || /received/i.test(m[2]);
        items.push({
          key: id('rmb', desc, a.paise),
          section: sec.title,
          kind: 'event',
          label: `${desc}: reimbursement (${received ? 'received' : filed ? 'filed' : 'pending'})`,
          amount: a.paise,
          include: true,
          note: received ? 'Counts as cash received.' : 'Not counted until received.',
          undated: true,
          record: { id: id('rmb', desc, a.paise), kind: 'reimbursement', amount: a.paise, description: desc, status: received ? 'settled' : filed ? 'filed' : 'pending', account: 'bank', cardMethod: null },
        });
      }
      continue;
    }

    if (t.includes('checklist') || t.includes('to do') || t.includes('todo')) {
      for (const l of sec.lines) {
        const m = l.match(/^\s*[-*]\s*\[( |x)\]\s*(.+)$/i);
        if (!m) continue;
        const title = m[2].trim();
        items.push({
          key: id('task', title, null),
          section: sec.title,
          kind: 'task',
          label: title,
          amount: null,
          include: true,
          note: m[1].toLowerCase() === 'x' ? 'Already ticked.' : null,
          record: { id: id('task', title, null), title: title.slice(0, 120), status: m[1].toLowerCase() === 'x' ? 'done' : 'open' },
        });
      }
      continue;
    }

    skippedSections.push(sec.title);
  }
  return { title: fm.title ?? `Month ${month}`, month, generated, items, skippedSections };
}

/** Adds the chosen items to the document. Records already present (same id) are skipped. */
export function applyMonthImport(doc: FinanceDoc, parsed: ParsedMonth, chosen: ImportItem[], undatedDate: string, now = new Date().toISOString()): { doc: FinanceDoc; added: number } {
  const has = new Set([...doc.transactions, ...(doc.events ?? []), ...(doc.vouchers ?? []), ...(doc.incomes ?? []), ...(doc.lists ?? []), ...doc.balances].map((r) => r.id));
  let added = 0;
  const next: FinanceDoc = { ...doc, transactions: [...doc.transactions], events: [...(doc.events ?? [])], vouchers: [...(doc.vouchers ?? [])], incomes: [...(doc.incomes ?? [])], lists: [...(doc.lists ?? [])], balances: [...doc.balances] };
  let settings = doc.settings;
  for (const it of chosen) {
    const r = it.record;
    if (it.kind === 'opening') {
      settings = { ...settings, openingBalance: it.amount, startMonth: parsed.month, updatedAt: now };
      added++;
      continue;
    }
    if (!r.id || has.has(r.id as string)) continue;
    has.add(r.id as string);
    added++;
    const date = it.date ?? (it.undated ? undatedDate : parsed.generated);
    if (it.kind === 'transaction') {
      const method = it.method ?? 'UPI';
      if (!settings.methods.includes(method)) settings = { ...settings, methods: [...settings.methods, method], updatedAt: now };
      if (it.category && !settings.categories.includes(it.category)) settings = { ...settings, categories: [...settings.categories, it.category], updatedAt: now };
      next.transactions.push({ id: r.id as string, date, amount: it.amount as Paise, category: it.category ?? 'Other', method, note: (r.note as string) || null, oneOff: (r.oneOff as boolean) || undefined, cashbackCheck: (r.cashbackCheck as boolean) || undefined, createdAt: now, updatedAt: now, deletedAt: null });
    } else if (it.kind === 'event') {
      next.events!.push({ id: r.id as string, date, kind: r.kind as MoneyEvent['kind'], amount: it.amount as Paise, description: r.description as string, status: r.status as MoneyEvent['status'], settledOn: r.status === 'settled' ? date : null, account: 'bank', cardMethod: null, updatedAt: now, deletedAt: null });
    } else if (it.kind === 'voucher') {
      next.vouchers!.push({ id: r.id as string, date: r.date as string, kind: 'load', amount: it.amount as Paise, expiresOn: (r.expiresOn as string) ?? null, note: (r.note as string) ?? null, earmark: null, updatedAt: now, deletedAt: null });
    } else if (it.kind === 'income') {
      next.incomes!.push({ ...(r as unknown as IncomeSource), updatedAt: now, deletedAt: null });
    } else if (it.kind === 'task') {
      next.lists!.push({ id: r.id as string, kind: 'task', title: r.title as string, status: (r.status as ListItem['status']) ?? 'open', due: null, amount: null, category: null, note: null, createdAt: now, updatedAt: now, deletedAt: null, transactionId: null });
    } else if (it.kind === 'balance') {
      next.balances.push({ id: r.id as string, date: r.date as string, amount: it.amount as Paise, note: (r.note as string) ?? null, updatedAt: now, deletedAt: null });
    }
  }
  return { doc: { ...next, settings }, added };
}

// ---------- Excel expense sheets ----------

const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/**
 * An expense sheet (header row with Item and Amount; optional Date,
 * Category, Sub-category, Paid via, Method confirmed, Notes) → the same
 * proposed records as a Markdown month. Other sheets (summaries, notes)
 * are listed as not imported.
 */
export function parseExpenseSheets(sheets: Sheet[], opts: { categories: string[]; methods: string[]; today: string }): ParsedMonth | { error: string } {
  const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
  let found: { sheet: Sheet; headerRow: number; col: Record<string, number> } | null = null;
  for (const sheet of sheets) {
    for (let r = 0; r < Math.min(sheet.rows.length, 20); r++) {
      const cells = (sheet.rows[r] ?? []).map(norm);
      const item = cells.findIndex((c) => /^(item|description|expense|name)$/.test(c));
      const amount = cells.findIndex((c) => /^amount/.test(c));
      if (item >= 0 && amount >= 0) {
        const at = (re: RegExp) => cells.findIndex((c) => re.test(c));
        found = { sheet, headerRow: r, col: { item, amount, date: at(/^date/), category: at(/^category/), sub: at(/^sub.?category/), via: at(/^(paid via|payment|method$|paid with)/), confirmed: at(/confirmed/), notes: at(/^notes?/) } };
        break;
      }
    }
    if (found) break;
  }
  if (!found) return { error: 'Couldn’t find an expense table: it needs a header row with “Item” and “Amount” columns.' };
  const { sheet, headerRow, col } = found;
  const cell = (row: (string | number)[], c: number) => (c >= 0 ? row[c] ?? '' : '');

  type Row = { date: string | null; item: string; amount: Paise; category: string; sub: string; via: string; estimate: boolean; notes: string; index: number };
  const rows: Row[] = [];
  sheet.rows.slice(headerRow + 1).forEach((row, i) => {
    const item = String(cell(row, col.item)).trim();
    const rawAmount = cell(row, col.amount);
    if (!item || /^total/i.test(item) || rawAmount === '') return;
    const amount = typeof rawAmount === 'number' ? Math.round(rawAmount * 100) : parseAmount(String(rawAmount)).paise;
    if (amount === null || amount === 0) return;
    const d = cell(row, col.date);
    const date = typeof d === 'number' && d > 30000 ? excelDate(d) : typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : null;
    rows.push({
      date,
      item,
      amount,
      category: String(cell(row, col.category)).trim(),
      sub: String(cell(row, col.sub)).trim(),
      via: String(cell(row, col.via)).trim(),
      estimate: /estimate|assumed/i.test(String(cell(row, col.confirmed))),
      notes: String(cell(row, col.notes)).trim(),
      index: i,
    });
  });

  // The month: from the title ("October 2026 …"), else the most common dated month, else today's.
  const titleCell = sheets.flatMap((s) => s.rows.slice(0, 3).flat()).map(String).find((t) => /[a-z]+\s+\d{4}/i.test(t)) ?? '';
  const tm = titleCell.toLowerCase().match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/);
  const datedMonths = rows.filter((r) => r.date).map((r) => (r.date as string).slice(0, 7));
  const common = [...datedMonths].sort((a, b) => datedMonths.filter((x) => x === b).length - datedMonths.filter((x) => x === a).length)[0];
  const month = tm ? `${tm[2]}-${String(MONTH_NAMES.indexOf(tm[1]) + 1).padStart(2, '0')}` : common ?? opts.today.slice(0, 7);
  const latest = rows
    .map((r) => r.date)
    .filter((x): x is string => !!x && x.startsWith(month))
    .sort()
    .pop();
  const generated = latest ?? (opts.today.startsWith(month) ? opts.today : `${month}-28`);

  // A refund row cancels a matching purchase: both are left out (net 0).
  const cancelled = new Set<number>();
  for (const neg of rows.filter((r) => r.amount < 0)) {
    const match = rows.find((p) => p.amount === -neg.amount && !cancelled.has(p.index) && p.index !== neg.index && slug(neg.item).startsWith(slug(p.item).slice(0, 8)));
    if (match) {
      cancelled.add(match.index);
      cancelled.add(neg.index);
    }
  }

  const items: ImportItem[] = [];
  const section = sheet.name;
  const id = (part: string, label: string, amount: Paise) => `imp-${month}-${part}-${slug(label.replace(/^trip:\s*/i, ''))}-${amount}`;
  for (const r of rows) {
    const words = `${r.item} ${r.sub} ${r.notes}`;
    if (/card bill/i.test(`${r.category} ${r.item}`)) {
      items.push({
        key: id('ev', r.item, r.amount),
        section,
        kind: 'event',
        label: r.item,
        amount: r.amount,
        include: true,
        note: 'Old card bill (spending from before tracking): one-off money out from the bank, not a category.',
        date: r.date ?? `${month}-01`,
        record: { id: id('ev', r.item, r.amount), kind: 'expense', amount: r.amount, description: `${r.item}${r.notes ? ` (${r.notes})` : ''}`, status: 'settled', account: 'bank', cardMethod: null },
      });
      continue;
    }
    if (r.amount < 0) {
      items.push({
        key: id('rf', r.item, -r.amount),
        section,
        kind: 'event',
        label: r.item,
        amount: -r.amount,
        include: !cancelled.has(r.index),
        note: cancelled.has(r.index) ? 'Refund of a purchase in this sheet: both left out (net 0).' : 'Refund: money back to the bank.',
        undated: !r.date,
        date: r.date ?? undefined,
        record: { id: id('rf', r.item, -r.amount), kind: 'refund', amount: -r.amount, description: r.item, status: 'settled', account: 'bank', cardMethod: null },
      });
      continue;
    }
    const c = r.category.toLowerCase();
    let category: string;
    let guessedNote: string | null = null;
    if (/fixed/.test(c)) category = /hous|rent/i.test(`${r.sub} ${r.item}`) ? 'Rent' : /insur/i.test(`${r.sub} ${r.item}`) ? 'Health' : guessCategory('', words, opts.categories).category;
    else if (/saving|invest/.test(c)) category = opts.categories.includes('Bills') ? 'Bills' : 'Other';
    else {
      const mixed = r.estimate || /unitemised|not itemised|misc/i.test(`${r.category} ${r.item} ${r.sub}`);
      const g = mixed ? { category: opts.categories.includes('Other') ? 'Other' : opts.categories[0], guessed: true } : guessCategory(/needs/i.test(r.category) ? '' : r.category, words, opts.categories);
      category = g.category;
      if (g.guessed) guessedNote = `“${r.category || '—'}” isn’t a category here: ${mixed ? 'a mix, so' : 'guessed'} ${category}`;
    }
    const m = guessMethod(r.via, opts.methods);
    const fixedLike = /fixed|saving|invest/.test(c);
    const reasons = [
      cancelled.has(r.index) ? 'Returned and refunded in this sheet (net 0): left out' : null,
      r.estimate ? 'Estimate (not itemised): replace with real items when the statement comes' : null,
      guessedNote,
      /yearly|annual/i.test(`${r.category} ${r.item}`) ? 'Tip: add it under Settings → Periodic costs so next year is planned' : null,
      m.note,
    ].filter(Boolean);
    items.push({
      key: id('tx', r.item, r.amount),
      section,
      kind: 'transaction',
      label: r.item,
      amount: r.amount,
      include: !cancelled.has(r.index),
      note: reasons.join(' · ') || null,
      category,
      method: m.method,
      undated: !r.date && !fixedLike,
      date: r.date ?? (fixedLike ? `${month}-01` : undefined),
      record: {
        id: id('tx', r.item, r.amount),
        note: [r.item, r.notes].filter(Boolean).join(' · ').slice(0, 200),
        oneOff: /one-off/i.test(r.notes) || /yearly|annual/i.test(r.category) || undefined,
        cashbackCheck: /verify cashback|cashback to verify/i.test(r.notes) || undefined,
      },
    });
  }
  // Notes elsewhere in the workbook: a voucher received, a reimbursement pending.
  const noteSheets = new Set<string>();
  for (const s of sheets.filter((x) => x !== sheet)) {
    for (const line of s.rows.flat().map(String)) {
      const v = line.match(/voucher[^.]*?(\d[\d,]*)\s+received\s+((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2})/i);
      if (v) {
        const amount = parseAmount(v[1]).paise as Paise;
        const on = parseDay(v[2], month) ?? generated;
        items.push({
          key: id('vch', 'load', amount),
          section: s.name,
          kind: 'voucher',
          label: `Amazon Pay value received ${on}`,
          amount,
          include: true,
          note: 'From your notes. Add the expiry later under Income & extras if it has one. Amazon Pay purchases come out of it.',
          record: { id: id('vch', 'load', amount), date: on, kind: 'load', amount, expiresOn: null, note: line.slice(0, 120) },
        });
        noteSheets.add(s.name);
      }
      const r = line.match(/pending reimbursement:?\s*([a-z][^0-9]*?)\s+(\d[\d,]*)/i);
      if (r) {
        const amount = parseAmount(r[2]).paise as Paise;
        const raw = r[1].replace(/[,:\s]+$/, '');
        const desc = raw.charAt(0).toUpperCase() + raw.slice(1);
        items.push({
          key: id('rmb', desc, amount),
          section: s.name,
          kind: 'event',
          label: `${desc}: reimbursement (pending)`,
          amount,
          include: true,
          note: 'From your notes. Not counted until received.',
          undated: true,
          record: { id: id('rmb', desc, amount), kind: 'reimbursement', amount, description: desc, status: 'pending', account: 'bank', cardMethod: null },
        });
        noteSheets.add(s.name);
      }
    }
  }
  const title = String(sheet.rows[0]?.[0] ?? '').trim() || `Expenses ${month}`;
  return {
    title,
    month,
    generated,
    items,
    skippedSections: sheets.filter((s) => s !== sheet).map((s) => (noteSheets.has(s.name) ? `${s.name} (only the voucher and reimbursement lines were read)` : `${s.name} (sheet)`)),
  };
}

/**
 * Rows that look already recorded (same month, same amount and payment
 * method, or the same kind of one-off) are unticked with a note, so a
 * month imported from two files isn't counted twice.
 */
export function markDuplicates(doc: FinanceDoc, items: ImportItem[], month: string): ImportItem[] {
  const txs = doc.transactions.filter((t) => !t.deletedAt && t.date.startsWith(month));
  const evs = (doc.events ?? []).filter((e) => !e.deletedAt && (e.settledOn ?? e.date).startsWith(month));
  const all = new Set([...doc.transactions, ...(doc.events ?? []), ...(doc.vouchers ?? []), ...(doc.incomes ?? []), ...(doc.lists ?? []), ...doc.balances].map((r) => r.id));
  const usedTx = new Set<string>();
  const usedEv = new Set<string>();
  return items.map((i) => {
    if (i.record.id && all.has(i.record.id as string)) return { ...i, include: false, note: 'Already imported.' };
    if (i.kind === 'transaction') {
      const hit = txs.find((t) => !usedTx.has(t.id) && t.amount === i.amount && t.method === i.method);
      if (hit) {
        usedTx.add(hit.id);
        return { ...i, include: false, note: `Looks already recorded: ${hit.category}${hit.note ? ` · ${hit.note.slice(0, 40)}` : ''} on ${hit.date}. Tick to add anyway.` };
      }
    }
    if (i.kind === 'voucher') {
      const hit = (doc.vouchers ?? []).find((v) => !v.deletedAt && v.kind === 'load' && v.amount === i.amount && v.date.startsWith(month));
      if (hit) return { ...i, include: false, note: `Looks already recorded: Amazon Pay value of the same amount on ${hit.date}. Tick to add anyway.` };
    }
    if (i.kind === 'event') {
      const hit = evs.find((e) => !usedEv.has(e.id) && e.amount === i.amount && e.kind === i.record.kind);
      if (hit) {
        usedEv.add(hit.id);
        return { ...i, include: false, note: `Looks already recorded: ${hit.description.slice(0, 50)}. Tick to add anyway.` };
      }
    }
    return i;
  });
}
