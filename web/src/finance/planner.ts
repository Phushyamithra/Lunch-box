/**
 * Planning helpers: yearly bills (sinking funds), peak months, the
 * salary-day transfer, card-free mode and reminders. Pure; money in paise.
 */
import { addMonths, cardCycles, commitmentsFor, monthOf, salaryDate } from './engine';
import { reliableIncome, voucherState } from './extras';
import { planFor, VOUCHER_METHOD, type FinanceDoc, type FinanceSettings, type Paise, type Transaction } from './model';

const live = (t: Transaction[]) => t.filter((x) => !x.deletedAt);
const months = (from: string, n: number) => Array.from({ length: n }, (_, i) => addMonths(from, i));

// ---------- yearly bills / sinking funds ----------

export interface SinkingFund {
  id: string;
  name: string;
  /** Per payment. */
  amount: Paise;
  months: number[];
  perYear: Paise;
  /** Put this aside every month to have it ready. */
  monthly: Paise;
  nextDue: string;
  monthsToGo: number;
  /** What should be set aside by now toward the next payment. */
  shouldHave: Paise;
}

export function sinkingFunds(s0: FinanceSettings, today: string): SinkingFund[] {
  const ym = monthOf(today);
  const s = planFor(s0, ym);
  return s.periodic
    .filter((p) => p.months.length > 0 && p.amount > 0)
    .map((p) => {
      const perYear = p.amount * p.months.length;
      const monthly = Math.round(perYear / 1200) * 100; // whole rupees
      const ahead = months(ym, 13).find((m) => p.months.includes(Number(m.slice(5)))) as string;
      const toGo = monthsBetween(ym, ahead);
      // Months since the previous payment (or the gap if it's due now).
      const gap = 12 / p.months.length;
      const elapsed = Math.max(0, gap - toGo);
      return { id: p.id, name: p.name, amount: p.amount, months: p.months, perYear, monthly, nextDue: ahead, monthsToGo: toGo, shouldHave: Math.min(p.amount, Math.round(monthly * elapsed)) };
    })
    .sort((a, b) => a.nextDue.localeCompare(b.nextDue));
}
const monthsBetween = (a: string, b: string) => {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return by * 12 + bm - (ay * 12 + am);
};

export interface PeakMonth {
  month: string;
  committed: Paise;
  /** Periodic bills landing that month. */
  extras: string[];
  peak: boolean;
}

/** The next 12 months' committed outgoings; heavy months (well above the usual) are flagged. */
export function peakMonths(s: FinanceSettings, today: string): PeakMonth[] {
  const rows = months(monthOf(today), 12).map((m) => {
    const c = commitmentsFor(s, m);
    return { month: m, committed: c.reduce((a, x) => a + x.planned, 0), extras: c.flatMap((x) => x.items.filter((i) => i.kind === 'periodic').map((i) => i.name)) };
  });
  const sorted = [...rows].map((r) => r.committed).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return rows.map((r) => ({ ...r, peak: r.committed > median * 1.05 }));
}

// ---------- card-free mode ----------

export const cardFreeFrom = (s: FinanceSettings) => s.cardFree?.from ?? null;

/** Everyday spending planned for a month (the card cap is the everyday allowance). */
const everydayPlan = (s: FinanceSettings, ym: string) => planFor(s, ym).combinedCardCap;

export interface CashOut {
  month: string;
  items: { name: string; amount: Paise; note?: string }[];
  total: Paise;
  /** Card-free switch month: the one-time extra (last month's card bill). */
  doublePayment: Paise;
}

/**
 * What leaves the bank in a month, on the plan: committed costs, budgets
 * (paid as you go), and everyday spending: on cards it's paid the month
 * after (last month's card bill); card-free it's paid the same month. The
 * switch month pays both once.
 */
export function cashOut(doc: FinanceDoc, ym: string, today: string): CashOut {
  const s = doc.settings;
  const p = planFor(s, ym);
  const items: CashOut['items'] = [];
  for (const c of commitmentsFor(s, ym)) for (const i of c.items) items.push({ name: i.name, amount: i.amount });
  const budgets = p.budgets.reduce((a, b) => a + b.amount, 0);
  if (budgets) items.push({ name: p.budgets.map((b) => b.category).join(' + '), amount: budgets, note: 'budgets, paid as you go' });
  const from = cardFreeFrom(s);
  const prev = addMonths(ym, -1);
  // Last month's card spending: actual if that month is the current or past and bigger than plan.
  const cardMethods = new Set(s.cards.map((c) => c.method));
  const loggedCard = live(doc.transactions)
    .filter((t) => cardMethods.has(t.method) && monthOf(t.date) === prev)
    .reduce((a, t) => a + t.amount, 0);
  const lastCardBill = prev <= monthOf(today) ? Math.max(everydayPlan(s, prev), loggedCard) : everydayPlan(s, prev);
  let doublePayment = 0;
  if (from && ym >= from) {
    items.push({ name: 'Everyday spending (card-free, same month)', amount: everydayPlan(s, ym) });
    if (ym === from) {
      doublePayment = lastCardBill;
      items.push({ name: 'Last card bill (one-time, switching to card-free)', amount: lastCardBill, note: 'paid once while switching' });
    }
  } else {
    items.push({ name: 'Card bills (last month’s spending)', amount: lastCardBill });
  }
  return { month: ym, items, total: items.reduce((a, i) => a + i.amount, 0), doublePayment };
}

/** This week's (Mon–Sun) everyday spending against the weekly cap. Committed costs, budgets, vouchers and planned one-offs don't count. */
export function weeklyCap(doc: FinanceDoc, today: string): { start: string; end: string; spent: Paise; cap: Paise; level: 'ok' | 'warn' | 'over' } | null {
  const s = doc.settings;
  if (!s.cardFree) return null;
  const t = new Date(`${today}T00:00:00Z`);
  const start = new Date(t.getTime() - ((t.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10);
  const end = new Date(Date.parse(`${start}T00:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10);
  const ym = monthOf(today);
  const p = planFor(s, ym);
  const skip = new Set([...commitmentsFor(s, ym).map((c) => c.category), ...p.budgets.map((b) => b.category)]);
  const spent = live(doc.transactions)
    .filter((x) => x.date >= start && x.date <= end && x.method !== VOUCHER_METHOD && !x.oneOff && !skip.has(x.category))
    .reduce((a, x) => a + x.amount, 0);
  const cap = s.cardFree.weeklyCap;
  return { start, end, spent, cap, level: spent > cap ? 'over' : cap > 0 && spent / cap >= 0.8 ? 'warn' : 'ok' };
}

// ---------- salary-day transfer ----------

export interface SalaryDayPlan {
  /** When the salary lands. */
  date: string;
  /** The month it pays for. */
  covers: string;
  salary: Paise;
  otherIncome: Paise;
  bills: CashOut;
  /** Salary + reliable income − next month's bills. Never negative. */
  safe: Paise;
  /** Bills the salary can't cover (> 0 = warning). */
  shortfall: Paise;
}

/** The next salary day: what it must cover next month, and what can safely go to savings. */
export function salaryDayPlan(doc: FinanceDoc, today: string): SalaryDayPlan {
  const s = doc.settings;
  let ym = monthOf(today);
  if (salaryDate(planFor(s, ym), ym) < today) ym = addMonths(ym, 1);
  const date = salaryDate(planFor(s, ym), ym);
  const covers = addMonths(ym, 1);
  const salary = planFor(s, ym).salary;
  const otherIncome = reliableIncome(doc, covers);
  const bills = cashOut(doc, covers, today);
  const net = salary + otherIncome - bills.total;
  return { date, covers, salary, otherIncome, bills, safe: Math.max(0, net), shortfall: Math.max(0, -net) };
}

/** Would moving `amount` to savings on salary day leave next month's bills uncovered? */
export function checkTransfer(plan: SalaryDayPlan, amount: Paise): { ok: boolean; uncovered: Paise } {
  const uncovered = Math.max(0, amount - plan.safe);
  return { ok: uncovered === 0, uncovered };
}

// ---------- reminders ----------

export interface Reminder {
  key: string;
  title: string;
  detail: string;
  /** For cashback checks: the transaction to mark verified. */
  transactionId?: string;
}

/** Cashback to verify (statement closed), and voucher value about to expire. */
export function reminders(doc: FinanceDoc, today: string): Reminder[] {
  const out: Reminder[] = [];
  for (const t of live(doc.transactions)) {
    if (!t.cashbackCheck || t.cashbackVerified) continue;
    const card = doc.settings.cards.find((c) => c.method === t.method);
    if (!card) continue;
    const close = cardCycles(card, t.date).current.end;
    if (close >= today) continue;
    out.push({ key: `cb-${t.id}`, title: `Check the cashback on ${card.name}`, detail: `${t.category}${t.note ? ` (${t.note})` : ''}, ₹${Math.round(t.amount / 100).toLocaleString('en-IN')} on ${t.date}: statement closed ${close}.`, transactionId: t.id });
  }
  for (const x of voucherState(doc, today).expiringSoon) {
    out.push({ key: `vx-${x.expiresOn}`, title: 'Use Amazon Pay value before it expires', detail: `₹${Math.round(x.amount / 100).toLocaleString('en-IN')} expires ${x.expiresOn}.` });
  }
  return out;
}
