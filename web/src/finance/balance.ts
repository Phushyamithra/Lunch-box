/**
 * The balance on the Finance home, kept as simple as a notebook: it starts
 * at ₹0, money you add as coming in adds, and every expense you log
 * subtracts (except Amazon Pay, which is voucher money, not cash). Nothing
 * is planned, assumed or carried over.
 */
import { EVENT_KINDS, VOUCHER_METHOD, type FinanceDoc, type Paise } from './model';

export interface BalanceEntry {
  id: string;
  date: string;
  /** Positive: money in. Negative: money out. */
  amount: Paise;
  label: string;
  note: string | null;
  source: 'salary' | 'event' | 'transaction';
  /** Sorts entries on the same day: newest last. */
  stamp: string;
}

export const MONEY_IN_KINDS = [
  { key: 'salary', label: 'Salary' },
  { key: 'refund', label: 'Refund' },
  { key: 'income', label: 'Other money in' },
] as const;
export type MoneyInKind = (typeof MONEY_IN_KINDS)[number]['key'];

const inflow = (kind: string) => !!EVENT_KINDS.find((k) => k.key === kind)?.inflow;

/** Every entry that moves the balance, oldest first. */
export function balanceEntries(doc: FinanceDoc, today: string): BalanceEntry[] {
  const out: BalanceEntry[] = [];
  for (const r of doc.salaries ?? []) {
    if (!r.deletedAt && r.date <= today) out.push({ id: r.id, date: r.date, amount: r.amount, label: 'Salary', note: r.note, source: 'salary', stamp: r.updatedAt });
  }
  for (const e of doc.events ?? []) {
    if (e.deletedAt || e.status !== 'settled' || e.account !== 'bank' || !e.settledOn || e.settledOn > today) continue;
    out.push({ id: e.id, date: e.settledOn, amount: inflow(e.kind) ? e.amount : -e.amount, label: e.description, note: null, source: 'event', stamp: e.updatedAt });
  }
  for (const t of doc.transactions) {
    if (t.deletedAt || t.method === VOUCHER_METHOD || t.date > today) continue;
    out.push({ id: t.id, date: t.date, amount: -t.amount, label: t.category, note: t.note, source: 'transaction', stamp: t.createdAt });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.stamp.localeCompare(b.stamp));
}

export function simpleBalance(doc: FinanceDoc, today: string): { balance: Paise; moneyIn: Paise; moneyOut: Paise } {
  const entries = balanceEntries(doc, today);
  const moneyIn = entries.filter((e) => e.amount > 0).reduce((a, e) => a + e.amount, 0);
  const moneyOut = entries.filter((e) => e.amount < 0).reduce((a, e) => a - e.amount, 0);
  return { balance: moneyIn - moneyOut, moneyIn, moneyOut };
}

/** Finance with every record removed and every amount back to zero; your plan (salary, budgets, cards, goals) stays. */
export function clearedDoc(doc: FinanceDoc): FinanceDoc {
  return {
    ...doc,
    settings: { ...doc.settings, openingBalance: 0, goals: doc.settings.goals.map((g) => ({ ...g, savedAtStart: 0 })) },
    transactions: [],
    balances: [],
    vouchers: [],
    events: [],
    incomes: [],
    lists: [],
    salaries: [],
  };
}
