/**
 * The bank balance on the Finance home, kept as simple as a notebook: it
 * starts at ₹0, money you add as coming in adds, and every payment from the
 * bank (UPI, debit…) subtracts. Card spends don't touch it until you pay
 * the card bill, which subtracts once. Amazon Pay is voucher money, never
 * cash. Nothing is planned, assumed or carried over.
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
  /** A card bill paid from the bank (that card's method). */
  cardBill?: string;
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
    out.push({ id: e.id, date: e.settledOn, amount: inflow(e.kind) ? e.amount : -e.amount, label: e.description, note: null, source: 'event', stamp: e.updatedAt, cardBill: e.cardBill ?? undefined });
  }
  const cards = new Set(doc.settings.cards.map((c) => c.method));
  for (const t of doc.transactions) {
    if (t.deletedAt || t.method === VOUCHER_METHOD || cards.has(t.method) || t.date > today) continue;
    out.push({ id: t.id, date: t.date, amount: -t.amount, label: t.category, note: t.note, source: 'transaction', stamp: t.createdAt });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.stamp.localeCompare(b.stamp));
}

export interface CardOwed {
  method: string;
  name: string;
  /** Card spends logged minus card bills paid: what's still to pay from the bank. */
  owed: Paise;
}

export function simpleBalance(doc: FinanceDoc, today: string): { balance: Paise; moneyIn: Paise; moneyOut: Paise; cards: CardOwed[]; onCards: Paise } {
  const entries = balanceEntries(doc, today);
  const moneyIn = entries.filter((e) => e.amount > 0).reduce((a, e) => a + e.amount, 0);
  const moneyOut = entries.filter((e) => e.amount < 0).reduce((a, e) => a - e.amount, 0);
  const cards = doc.settings.cards.map((c) => {
    const spent = doc.transactions.filter((t) => !t.deletedAt && t.method === c.method && t.date <= today).reduce((a, t) => a + t.amount, 0);
    const paid = entries.filter((e) => e.cardBill === c.method).reduce((a, e) => a - e.amount, 0);
    return { method: c.method, name: c.name, owed: Math.max(0, spent - paid) };
  });
  return { balance: moneyIn - moneyOut, moneyIn, moneyOut, cards, onCards: cards.reduce((a, c) => a + c.owed, 0) };
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
