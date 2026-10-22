/**
 * Projections and bank-balance reconciliation. Pure; money in paise.
 *
 * Projection: finished months are actual, the current month is part actual
 * and part estimate, later months follow the plan (budgets assumed fully
 * used, everyday spending at the card cap). Every row says which it is.
 *
 * Reconciliation: what your bank should hold on a date, worked out from
 * the opening balance, salaries credited, what left the bank (UPI and debit
 * payments, card bills on their due dates, committed costs you didn't log),
 * so it can be compared with the real balance you type in.
 */
import { addMonths, allocate, cardCycles, commitmentsFor, dueDateAfter, monthOf, monthSummary, plannedSavings, salaryDate } from './engine';
import { bankEventsUntil, cardEventsBetween } from './extras';
import { planFor, type Card, type FinanceDoc, type FinanceSettings, type Paise } from './model';

// ---------- projection ----------

export type RowKind = 'actual' | 'current' | 'projected';

export interface ProjectionRow {
  month: string;
  kind: RowKind;
  salary: Paise;
  committed: Paise;
  budgets: Paise;
  everyday: Paise;
  savings: Paise;
  /** Running total of savings (incl. what was saved before tracking). */
  total: Paise;
  /** Saved per goal after this month (waterfall). */
  goals: Paise[];
  /** Index of the goal being filled after this month (−1 = all done). */
  filling: number;
  /** Goals that become full in this month. */
  completes: number[];
  /** Notable things in this month (insurance, gym, gold ending). */
  notes: string[];
  /** Current month only: committed costs not yet paid + card bills owed. */
  pending: Paise;
}

const MAX_MONTHS = 120;

function monthNotes(s0: FinanceSettings, ym: string): string[] {
  const s = planFor(s0, ym);
  const m = Number(ym.slice(5));
  const notes: string[] = [];
  for (const p of s.periodic) if (p.months.includes(m)) notes.push(p.name);
  for (const f of s.fixed) {
    if (f.endsOn === ym) notes.push(`last ${f.name}`);
    if (f.endsOn && addMonths(f.endsOn, 1) === ym) notes.push(`${f.name} over`);
  }
  return notes;
}

/** Month by month from tracking start until every goal is expected to be full (10 years at most). */
export function projection(doc: FinanceDoc, today: string, opts: { cardOwed?: Paise } = {}): ProjectionRow[] {
  const s = doc.settings;
  const current = monthOf(today);
  const goals = s.goals;
  const allTarget = goals.reduce((a, g) => a + g.target, 0);
  let total = goals.reduce((a, g) => a + g.savedAtStart, 0);
  let prevAlloc = allocate(goals, total).map((x) => x.saved);
  const rows: ProjectionRow[] = [];
  const first = s.startMonth <= current ? s.startMonth : current;
  for (let i = 0, m = first; i < MAX_MONTHS; i++, m = addMonths(m, 1)) {
    const kind: RowKind = m < current ? 'actual' : m === current ? 'current' : 'projected';
    let salary: Paise, committed: Paise, budgets: Paise, everyday: Paise, savings: Paise, pending = 0;
    if (kind === 'projected') {
      const p = plannedSavings(s, m);
      ({ salary, committed, budgets, everyday, savings } = p);
    } else {
      const sum = monthSummary(doc, m, today);
      salary = sum.funding;
      committed = sum.committed.reduce((a, c) => a + c.counted, 0);
      budgets = sum.budgets.reduce((a, b) => a + b.counted, 0);
      everyday = sum.everyday.counted;
      savings = sum.savings;
      if (kind === 'current') pending = sum.stillToPay + (opts.cardOwed ?? 0);
    }
    total += savings;
    const alloc = allocate(goals, total).map((x) => x.saved);
    const completes = goals.map((g, gi) => (alloc[gi] >= g.target && prevAlloc[gi] < g.target ? gi : -1)).filter((gi) => gi >= 0);
    prevAlloc = alloc;
    const filling = goals.findIndex((g, gi) => alloc[gi] < g.target);
    rows.push({ month: m, kind, salary, committed, budgets, everyday, savings, total, goals: alloc, filling, completes, notes: monthNotes(s, m), pending });
    if (kind === 'projected' && total >= allTarget) break;
  }
  return rows;
}

// ---------- scenarios (for stage 4; also used to compare) ----------

/** Month all goals are full under the given settings, or null beyond the horizon. */
export function finishMonth(rows: ProjectionRow[], s: FinanceSettings): string | null {
  const all = s.goals.reduce((a, g) => a + g.target, 0);
  return rows.find((r) => r.total >= all)?.month ?? null;
}

// ---------- reconciliation ----------

export const BANK_METHODS = ['UPI', 'Debit'];

export interface ReconLine {
  label: string;
  amount: Paise;
  /** An assumption rather than a logged fact. */
  assumed?: boolean;
}

export interface Reconciliation {
  date: string;
  /** null when the opening balance isn't set. */
  expected: Paise | null;
  lines: ReconLine[];
  /** Committed costs due this month and not logged: may or may not have left the bank yet. */
  pendingThisMonth: Paise;
  /** Card bills still owed (closed statements not yet due + the open cycles). */
  cardsOwed: Paise;
  /** Where the expected balance is earmarked; `free` is the rest. */
  earmarks: { savings: Paise; cards: Paise; committed: Paise; free: Paise };
}

/** Card bills paid from the bank between `from` and `to` (on their due dates). */
function cardBills(doc: FinanceDoc, card: Card, from: string, to: string): { paid: Paise; assumedDue: boolean } {
  const txs = doc.transactions.filter((t) => !t.deletedAt && t.method === card.method && t.date >= from);
  let paid = 0;
  let assumedDue = false;
  // Walk statements from the one covering `from` until bills fall after `to`.
  let { current } = cardCycles(card, from);
  for (let i = 0; i < 240; i++) {
    const amount = txs.filter((t) => t.date >= current.start && t.date <= current.end).reduce((a, t) => a + t.amount, 0) + cardEventsBetween(doc, card.method, current.start, current.end);
    let due = dueDateAfter(card, current.end);
    if (!due) {
      assumedDue = true;
      due = `${addMonths(monthOf(current.end), 1)}-05`;
    }
    if (due > to) break;
    paid += amount;
    const next = new Date(Date.parse(`${current.end}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
    current = cardCycles(card, next).current;
  }
  return { paid, assumedDue };
}

export function reconcile(doc: FinanceDoc, date: string, opts: { savingsPot: Paise; cardsOwed: Paise }): Reconciliation {
  const s = doc.settings;
  const start = `${s.startMonth}-01`;
  const lines: ReconLine[] = [];
  const live = doc.transactions.filter((t) => !t.deletedAt && t.date >= start && t.date <= date);
  const dateMonth = monthOf(date);

  // Committed costs not logged at all: past months assumed paid from the bank; this month pending.
  let assumedPaid = 0;
  let pendingThisMonth = 0;
  for (let m = s.startMonth; m <= dateMonth; m = addMonths(m, 1)) {
    const logged = new Map<string, Paise>();
    for (const t of doc.transactions) if (!t.deletedAt && monthOf(t.date) === m) logged.set(t.category, (logged.get(t.category) ?? 0) + t.amount);
    for (const c of commitmentsFor(s, m)) {
      const missing = Math.max(0, c.planned - (logged.get(c.category) ?? 0));
      if (m < dateMonth) assumedPaid += missing;
      else pendingThisMonth += missing;
    }
  }

  if (s.openingBalance === null) {
    return { date, expected: null, lines, pendingThisMonth, cardsOwed: opts.cardsOwed, earmarks: { savings: opts.savingsPot, cards: opts.cardsOwed, committed: pendingThisMonth, free: 0 } };
  }
  lines.push({ label: `Opening balance (${s.startMonth})`, amount: s.openingBalance });
  let salaries = 0;
  let count = 0;
  for (let m = s.startMonth; m <= dateMonth; m = addMonths(m, 1)) {
    const p = planFor(s, m);
    const d = salaryDate(p, m);
    if (d >= start && d <= date) {
      salaries += p.salary;
      count++;
    }
  }
  if (count) lines.push({ label: `Salary × ${count}`, amount: salaries, assumed: true });
  const bank = live.filter((t) => BANK_METHODS.includes(t.method)).reduce((a, t) => a + t.amount, 0);
  if (bank) lines.push({ label: 'Paid by UPI / debit (logged)', amount: -bank });
  let billsPaid = 0;
  let assumedDue = false;
  for (const card of s.cards) {
    const r = cardBills(doc, card, start, date);
    billsPaid += r.paid;
    assumedDue ||= r.assumedDue;
  }
  if (billsPaid) lines.push({ label: assumedDue ? 'Card bills paid (some due dates assumed: 5th)' : 'Card bills paid on their due dates', amount: -billsPaid, assumed: true });
  const events = bankEventsUntil(doc, start, date);
  if (events) lines.push({ label: 'Refunds and one-offs settled to the bank', amount: events });
  if (assumedPaid) lines.push({ label: 'Committed costs not logged in earlier months (assumed paid)', amount: -assumedPaid, assumed: true });
  const other = live.filter((t) => !BANK_METHODS.includes(t.method) && !s.cards.some((c) => c.method === t.method)).reduce((a, t) => a + t.amount, 0);
  if (other) lines.push({ label: 'Paid with Amazon Pay vouchers: not from the bank', amount: 0 });

  const expected = lines.reduce((a, l) => a + l.amount, 0);
  const free = expected - opts.savingsPot - opts.cardsOwed - pendingThisMonth;
  return { date, expected, lines, pendingThisMonth, cardsOwed: opts.cardsOwed, earmarks: { savings: opts.savingsPot, cards: opts.cardsOwed, committed: pendingThisMonth, free } };
}

export type Verdict = 'match' | 'explained' | 'unexplained';
export interface CheckResult {
  actual: Paise;
  expected: Paise;
  /** actual − expected */
  diff: Paise;
  verdict: Verdict;
  message: string;
}

/** Compares a real balance with the expected one. Small gaps (₹500) and unpaid committed costs count as explained. */
export function compareBalance(r: Reconciliation, actual: Paise, tolerance: Paise = 50000): CheckResult | null {
  if (r.expected === null) return null;
  const diff = actual - r.expected;
  const fmt = (p: Paise) => `₹${Math.round(Math.abs(p) / 100).toLocaleString('en-IN')}`;
  if (Math.abs(diff) <= tolerance) return { actual, expected: r.expected, diff, verdict: 'match', message: 'Matches what was expected.' };
  if (diff < 0 && -diff <= r.pendingThisMonth + tolerance) {
    return { actual, expected: r.expected, diff, verdict: 'explained', message: `${fmt(diff)} lower, within this month’s committed costs not logged yet (${fmt(r.pendingThisMonth)}): they’ve probably already left the bank. Log them to settle it.` };
  }
  return {
    actual,
    expected: r.expected,
    diff,
    verdict: 'unexplained',
    message:
      diff < 0
        ? `${fmt(diff)} less than expected and not explained: an expense you haven’t logged, a bill paid early, or a wrong amount somewhere.`
        : `${fmt(diff)} more than expected and not explained: income or a refund not recorded, a bill not yet paid, or an expense logged twice.`,
  };
}
