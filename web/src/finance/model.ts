/**
 * Finance data model. Pure.
 *
 * Money is whole paise (integers), never floating rupees. Every record has
 * an id and `updatedAt`, and deletes are soft (`deletedAt`), so devices can
 * merge and anything can be undone.
 */

export const FINANCE_SCHEMA = 'tracker.finance';
export const FINANCE_VERSION = 1;

export type Paise = number;
export const rupees = (r: number): Paise => Math.round(r * 100);
export const toRupees = (p: Paise): number => p / 100;

/** ₹1,00,000 · ₹2,450.50 (Indian grouping; paise only when present). */
export function formatINR(p: Paise, opts: { sign?: boolean } = {}): string {
  const neg = p < 0;
  const abs = Math.abs(p);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const s = whole.toString();
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const grouped = rest ? `${rest},${last3}` : last3;
  const body = `₹${grouped}${frac ? `.${String(frac).padStart(2, '0')}` : ''}`;
  return neg ? `−${body}` : opts.sign && p > 0 ? `+${body}` : body;
}

/** "1,50,000.5" / "₹ 2450" → paise; null when not a valid amount. */
export function parseINR(input: string): Paise | null {
  const s = input.replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return rupees(Number(s));
}

export const CATEGORIES = ['Rent', 'Groceries', 'Fuel', 'Pet', 'Dinner', 'Protein', 'Wants', 'Unplanned', 'Travel', 'Health', 'Bills', 'Gym', 'Other'] as const;
export const METHODS = ['UPI', 'Debit', 'HDFC', 'ICICI', 'Amazon Pay'] as const;
export type Method = string;

export interface Stamped {
  id: string;
  /** ISO timestamp; the newest wins when two devices edited the same record. */
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Transaction extends Stamped {
  /** YYYY-MM-DD */
  date: string;
  amount: Paise;
  category: string;
  method: Method;
  note: string | null;
  createdAt: string;
}

export interface Card {
  id: string;
  name: string;
  /** The payment method that means "this card". */
  method: Method;
  limit: Paise;
  purpose: string;
  /** Day of month the statement closes (1–28; null until you set it). */
  statementDay: number | null;
  /** Day of month the bill is due. */
  dueDay: number | null;
}

export interface FixedExpense {
  id: string;
  name: string;
  amount: Paise;
  category: string;
  /** Last month it's paid (YYYY-MM), or null for ongoing. */
  endsOn: string | null;
}

export interface PeriodicExpense {
  id: string;
  name: string;
  amount: Paise;
  category: string;
  /** Months it falls in (1–12). */
  months: number[];
}

export interface VariableBudget {
  category: string;
  amount: Paise;
  /** Unspent amount goes to savings at month end. */
  rollover: boolean;
}

export interface SavingsGoal {
  id: string;
  name: string;
  /** Amount this step adds (a top-up is only the extra, not the full fund). */
  target: Paise;
  /** Already saved toward it when tracking started. */
  savedAtStart: Paise;
  note: string | null;
}

export interface FinanceSettings {
  updatedAt: string;
  salary: Paise;
  /** 'last' = last day of the month; that salary pays next month's bills. */
  salaryDay: 'last' | number;
  fixed: FixedExpense[];
  periodic: PeriodicExpense[];
  budgets: VariableBudget[];
  cards: Card[];
  combinedCardCap: Paise;
  /** Waterfall order: earlier goals fill first. */
  goals: SavingsGoal[];
  categories: string[];
  methods: Method[];
  /** First month tracked (YYYY-MM). */
  startMonth: string;
  /** Bank balance when tracking started (null until set). */
  openingBalance: Paise | null;
}

export interface BalanceCheck extends Stamped {
  date: string;
  amount: Paise;
  note: string | null;
}

export interface FinanceDoc {
  schema: typeof FINANCE_SCHEMA;
  version: number;
  settings: FinanceSettings;
  transactions: Transaction[];
  balances: BalanceCheck[];
}

const id = () => crypto.randomUUID();

/** Starting values from your brief. Card dates, balances and savings so far are asked for, never guessed. */
export function defaultSettings(today: string, now = new Date().toISOString()): FinanceSettings {
  return {
    updatedAt: now,
    salary: rupees(62000),
    salaryDay: 'last',
    fixed: [
      { id: 'rent', name: 'Rent', amount: rupees(20000), category: 'Rent', endsOn: null },
      { id: 'gold', name: 'Gold scheme', amount: rupees(10000), category: 'Bills', endsOn: '2027-08' },
      { id: 'sip', name: 'SIP', amount: rupees(3000), category: 'Bills', endsOn: null },
      { id: 'dinner', name: 'Dinner', amount: rupees(3500), category: 'Dinner', endsOn: null },
      { id: 'protein', name: 'Protein', amount: rupees(2500), category: 'Protein', endsOn: null },
    ],
    periodic: [
      { id: 'insurance', name: 'Insurance', amount: rupees(3170), category: 'Health', months: [1, 4, 7, 10] },
      { id: 'gym', name: 'Gym', amount: rupees(17750), category: 'Gym', months: [12] },
    ],
    budgets: [
      { category: 'Wants', amount: rupees(1000), rollover: true },
      { category: 'Unplanned', amount: rupees(1000), rollover: true },
    ],
    cards: [
      { id: 'hdfc', name: 'HDFC RuPay / UPI', method: 'HDFC', limit: rupees(6000), purpose: 'Groceries and chai', statementDay: null, dueDay: null },
      { id: 'icici', name: 'ICICI Amazon', method: 'ICICI', limit: rupees(4000), purpose: 'Petrol, pet food and essentials', statementDay: null, dueDay: null },
    ],
    combinedCardCap: rupees(10000),
    goals: [
      { id: 'starter', name: 'Starter emergency fund', target: rupees(30000), savedAtStart: 0, note: null },
      { id: 'switch', name: 'Switch fund', target: rupees(100000), savedAtStart: 0, note: null },
      { id: 'lasik', name: 'LASIK', target: rupees(210000), savedAtStart: 0, note: null },
      { id: 'ef_topup', name: 'Emergency fund top-up', target: rupees(70000), savedAtStart: 0, note: 'Brings the emergency fund from ₹30,000 to ₹1,00,000; not another full ₹1,00,000.' },
      { id: 'bike', name: 'Bike down payment', target: rupees(224000), savedAtStart: 0, note: null },
    ],
    categories: [...CATEGORIES],
    methods: [...METHODS],
    startMonth: today.slice(0, 7),
    openingBalance: null,
  };
}

export function emptyDoc(today: string, now?: string): FinanceDoc {
  return { schema: FINANCE_SCHEMA, version: FINANCE_VERSION, settings: defaultSettings(today, now), transactions: [], balances: [] };
}

export interface TransactionInput {
  date: string;
  amount: Paise;
  category: string;
  method: Method;
  note: string | null;
}

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

export function validateTransaction(t: TransactionInput, s: Pick<FinanceSettings, 'categories' | 'methods'>): string | null {
  if (!Number.isInteger(t.amount) || t.amount <= 0) return 'Enter an amount more than ₹0.';
  if (t.amount > rupees(10_000_000)) return 'That amount looks too large; check it.';
  if (!isDay(t.date)) return 'Pick a date.';
  if (!s.categories.includes(t.category)) return 'Pick a category.';
  if (!s.methods.includes(t.method)) return 'Pick how you paid.';
  if (t.note && t.note.length > 200) return 'Keep the note under 200 characters.';
  return null;
}

export function newTransaction(t: TransactionInput, now = new Date().toISOString()): Transaction {
  return { ...t, note: t.note?.trim() || null, id: id(), createdAt: now, updatedAt: now, deletedAt: null };
}

export function validateSettings(s: FinanceSettings): string | null {
  const money = (v: number) => Number.isInteger(v) && v >= 0;
  if (!money(s.salary) || s.salary === 0) return 'Salary must be more than ₹0.';
  if (s.salaryDay !== 'last' && !(Number.isInteger(s.salaryDay) && s.salaryDay >= 1 && s.salaryDay <= 28)) return 'Salary day must be 1–28, or the last day.';
  for (const f of s.fixed) {
    if (!f.name.trim() || !money(f.amount)) return `Check the fixed cost “${f.name || '?'}”.`;
    if (f.endsOn && !/^\d{4}-(0[1-9]|1[0-2])$/.test(f.endsOn)) return `“${f.name}” end month must look like 2027-08.`;
  }
  for (const p of s.periodic) {
    if (!p.name.trim() || !money(p.amount) || !p.months.length || p.months.some((m) => !(m >= 1 && m <= 12))) return `Check the periodic cost “${p.name || '?'}”.`;
  }
  for (const c of s.cards) {
    if (!c.name.trim() || !money(c.limit)) return `Check the card “${c.name || '?'}”.`;
    for (const d of [c.statementDay, c.dueDay]) if (d !== null && !(Number.isInteger(d) && d >= 1 && d <= 28)) return `${c.name}: statement and due days must be 1–28.`;
    if (!s.methods.includes(c.method)) return `${c.name}: its payment method isn’t in your list.`;
  }
  if (!money(s.combinedCardCap)) return 'Check the combined card cap.';
  for (const g of s.goals) if (!g.name.trim() || !money(g.target) || g.target === 0 || !money(g.savedAtStart)) return `Check the goal “${g.name || '?'}”.`;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s.startMonth)) return 'Start month must look like 2026-10.';
  if (s.openingBalance !== null && !Number.isInteger(s.openingBalance)) return 'Check the opening balance.';
  return null;
}

/** A finance document from anywhere (backup file, decrypted vault) → checked, or why not. */
export function parseFinanceDoc(raw: unknown): { doc: FinanceDoc } | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'This isn’t a Tracker finance file.' };
  const d = raw as Partial<FinanceDoc>;
  if (d.schema !== FINANCE_SCHEMA) return { error: 'This isn’t a Tracker finance file.' };
  if (typeof d.version !== 'number' || d.version < 1) return { error: 'The file has no version.' };
  if (d.version > FINANCE_VERSION) return { error: `Made by a newer version of the app (format ${d.version}). Update the app first.` };
  if (!d.settings || !Array.isArray(d.transactions) || !Array.isArray(d.balances)) return { error: 'The file is missing parts.' };
  const bad = validateSettings(d.settings as FinanceSettings);
  if (bad) return { error: `Settings in the file are invalid: ${bad}` };
  for (const t of d.transactions) {
    if (!t || typeof t.id !== 'string' || typeof t.updatedAt !== 'string' || !Number.isInteger(t.amount) || !isDay(String(t.date))) return { error: 'A transaction in the file is damaged.' };
  }
  for (const b of d.balances) {
    if (!b || typeof b.id !== 'string' || !Number.isInteger(b.amount) || !isDay(String(b.date))) return { error: 'A balance entry in the file is damaged.' };
  }
  return { doc: d as FinanceDoc };
}

/** Live transactions for a month (YYYY-MM), newest first. */
export const monthTransactions = (doc: FinanceDoc, month: string) =>
  doc.transactions.filter((t) => !t.deletedAt && t.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
