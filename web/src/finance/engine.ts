/**
 * Finance month engine. Pure; all money in paise.
 *
 * How a month is counted (shown in the app as "how this is worked out"):
 * - The salary credited at the end of a month pays the NEXT month, so
 *   month M is funded by the salary of M−1.
 * - Committed costs (fixed costs still running, periodic costs due that
 *   month) are assumed paid even if you don't log them. If you do log
 *   them, the bigger of planned and logged counts, so nothing is counted
 *   twice and overspending still shows.
 * - Budgets (Wants, Unplanned) count what you logged; unspent money stays
 *   in savings (the rollover).
 * - Everything else is everyday spending, planned at the combined card cap.
 * - A card purchase is spending when it happens; paying the card bill
 *   later is a settlement, never a second expense.
 */
import { cardEventsBetween, settledCashIn } from './extras';
import { planFor, VOUCHER_METHOD, type Card, type FinanceDoc, type FinanceSettings, type Paise, type SavingsGoal, type Transaction } from './model';

// ---------- dates ----------

export const addMonths = (ym: string, n: number): string => {
  const [y, m] = ym.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};
export const monthOf = (day: string) => day.slice(0, 7);
const daysInMonth = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
const dateIn = (ym: string, day: number) => `${ym}-${String(Math.min(day, daysInMonth(ym))).padStart(2, '0')}`;
const nextDay = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

export function salaryDate(s: Pick<FinanceSettings, 'salaryDay'>, ym: string): string {
  return s.salaryDay === 'last' ? dateIn(ym, 31) : dateIn(ym, s.salaryDay);
}

// ---------- plan for a month ----------

export interface PlannedItem {
  name: string;
  amount: Paise;
  kind: 'fixed' | 'periodic';
}
export interface Commitment {
  category: string;
  planned: Paise;
  items: PlannedItem[];
}

/** Fixed costs still running and periodic costs due in `ym`, by category. */
export function commitmentsFor(s0: FinanceSettings, ym: string): Commitment[] {
  const s = planFor(s0, ym);
  const month = Number(ym.slice(5));
  const by = new Map<string, Commitment>();
  const add = (category: string, item: PlannedItem) => {
    const c = by.get(category) ?? { category, planned: 0, items: [] };
    c.planned += item.amount;
    c.items.push(item);
    by.set(category, c);
  };
  for (const f of s.fixed) if (!f.endsOn || ym <= f.endsOn) add(f.category, { name: f.name, amount: f.amount, kind: 'fixed' });
  for (const p of s.periodic) if (p.months.includes(month)) add(p.category, { name: p.name, amount: p.amount, kind: 'periodic' });
  return [...by.values()];
}

/** What the plan says a month should save (no logs involved). */
export function plannedSavings(s0: FinanceSettings, ym: string): { salary: Paise; committed: Paise; budgets: Paise; everyday: Paise; savings: Paise } {
  const s = planFor(s0, ym);
  const committed = commitmentsFor(s, ym).reduce((a, c) => a + c.planned, 0);
  const budgets = s.budgets.reduce((a, b) => a + b.amount, 0);
  const everyday = s.combinedCardCap;
  return { salary: s.salary, committed, budgets, everyday, savings: s.salary - committed - budgets - everyday };
}

// ---------- a month with its logs ----------

export interface CategoryLine {
  category: string;
  planned: Paise;
  logged: Paise;
  /** What counts toward spending (final months) or is expected (current month). */
  counted: Paise;
}
export interface MonthSummary {
  month: string;
  /** Before tracking started: nothing is counted. */
  tracked: boolean;
  /** Month is over: numbers are actual. Otherwise savings is a projection. */
  final: boolean;
  /** Salary that pays this month (credited at the end of the previous one). */
  funding: Paise;
  fundingDate: string;
  committed: (CategoryLine & { items: PlannedItem[] })[];
  budgets: (CategoryLine & { rollover: boolean; remaining: Paise })[];
  everyday: { planned: Paise; logged: Paise; counted: Paise; byCategory: { category: string; amount: Paise }[] };
  /** Everything logged this month. */
  loggedTotal: Paise;
  /** Final: actual spending. Current: expected spending for the whole month. */
  spend: Paise;
  savings: Paise;
  /** Committed costs not yet covered by logs (assumed still to be paid). */
  stillToPay: Paise;
  /** Funding minus logs and committed costs still to pay (includes what you mean to save). */
  available: Paise;
  /** What's left within plan: budgets left + everyday allowance left. Spending this keeps planned savings intact. */
  leftInBudgets: Paise;
  /** Paid from Amazon Pay voucher value: not cash, so not in any figure above. */
  voucherSpend: Paise;
  /** Settled refunds and other one-offs (cash: bank or card) this month. */
  eventsIn: Paise;
  eventsOut: Paise;
}

const live = (t: Transaction[]) => t.filter((x) => !x.deletedAt);
const sumBy = (txs: Transaction[]) => {
  const m = new Map<string, Paise>();
  for (const t of txs) m.set(t.category, (m.get(t.category) ?? 0) + t.amount);
  return m;
};

export function monthSummary(doc: FinanceDoc, ym: string, today: string): MonthSummary {
  const s = planFor(doc.settings, ym);
  const current = monthOf(today);
  const final = ym < current;
  const monthTxs = live(doc.transactions).filter((t) => monthOf(t.date) === ym);
  // Voucher value isn't cash: it doesn't use budgets or touch savings.
  const txs = monthTxs.filter((t) => t.method !== VOUCHER_METHOD);
  const voucherSpend = monthTxs.filter((t) => t.method === VOUCHER_METHOD).reduce((a, t) => a + t.amount, 0);
  const ev = settledCashIn(doc, ym);
  const logged = sumBy(txs);
  const take = (c: string) => {
    const v = logged.get(c) ?? 0;
    logged.delete(c);
    return v;
  };

  const committed = commitmentsFor(s, ym).map((c) => {
    const l = take(c.category);
    return { category: c.category, planned: c.planned, logged: l, counted: Math.max(c.planned, l), items: c.items };
  });
  const budgets = s.budgets.map((b) => {
    const l = take(b.category);
    return { category: b.category, planned: b.amount, logged: l, counted: final ? l : Math.max(b.amount, l), rollover: b.rollover, remaining: Math.max(0, b.amount - l) };
  });
  const everydayByCategory = [...logged].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  const everydayLogged = everydayByCategory.reduce((a, x) => a + x.amount, 0);
  const everyday = { planned: s.combinedCardCap, logged: everydayLogged, counted: final ? everydayLogged : Math.max(s.combinedCardCap, everydayLogged), byCategory: everydayByCategory };

  const spend = committed.reduce((a, c) => a + c.counted, 0) + budgets.reduce((a, b) => a + b.counted, 0) + everyday.counted;
  const loggedTotal = txs.reduce((a, t) => a + t.amount, 0);
  const stillToPay = committed.reduce((a, c) => a + Math.max(0, c.planned - c.logged), 0);
  const funding = s.salary;
  return {
    month: ym,
    tracked: ym >= s.startMonth,
    final,
    funding,
    fundingDate: salaryDate(planFor(doc.settings, addMonths(ym, -1)), addMonths(ym, -1)),
    committed,
    budgets,
    everyday,
    loggedTotal,
    spend,
    savings: funding + ev.in - ev.out - spend,
    stillToPay,
    available: funding + ev.in - ev.out - loggedTotal - stillToPay,
    leftInBudgets: budgets.reduce((a, b) => a + b.remaining, 0) + Math.max(0, everyday.planned - everyday.logged),
    voucherSpend,
    eventsIn: ev.in,
    eventsOut: ev.out,
  };
}

// ---------- savings and the waterfall ----------

export interface GoalProgress {
  goal: SavingsGoal;
  index: number;
  saved: Paise;
  remaining: Paise;
  percent: number;
  done: boolean;
  /** Month the goal is expected to fill (YYYY-MM), from the plan; null if beyond the horizon. */
  eta: string | null;
  /** Filled already (by actual savings). */
  reached: boolean;
}

/** Pours `total` into the goals in order: a later goal gets money only when the earlier ones are full. */
export function allocate(goals: SavingsGoal[], total: Paise): { goal: SavingsGoal; saved: Paise }[] {
  let left = Math.max(0, total);
  return goals.map((goal) => {
    const saved = Math.min(goal.target, left);
    left -= saved;
    return { goal, saved };
  });
}

export interface SavingsState {
  /** Saved before tracking (what you entered per goal), pooled. */
  opening: Paise;
  /** Actual savings of finished, tracked months. */
  months: { month: string; savings: Paise }[];
  /** Opening + finished months: the real pot today. */
  actualTotal: Paise;
  /** This month's expected savings (not yet real). */
  currentProjected: Paise;
  goals: GoalProgress[];
  /** All goals expected to be done by (YYYY-MM), or null beyond 10 years. */
  allDoneBy: string | null;
}

/** Month-by-month planned savings from `from` on, as a running total starting at `start`. */
export function projectTotals(s: FinanceSettings, from: string, start: Paise, months: number): { month: string; savings: Paise; total: Paise }[] {
  const out: { month: string; savings: Paise; total: Paise }[] = [];
  let total = start;
  for (let i = 0; i < months; i++) {
    const month = addMonths(from, i);
    const savings = plannedSavings(s, month).savings;
    total += savings;
    out.push({ month, savings, total });
  }
  return out;
}

const HORIZON = 120;

export function savingsState(doc: FinanceDoc, today: string): SavingsState {
  const s = doc.settings;
  const current = monthOf(today);
  const opening = s.goals.reduce((a, g) => a + g.savedAtStart, 0);
  const months: { month: string; savings: Paise }[] = [];
  for (let m = s.startMonth; m < current; m = addMonths(m, 1)) months.push({ month: m, savings: monthSummary(doc, m, today).savings });
  const actualTotal = opening + months.reduce((a, m) => a + m.savings, 0);
  const cur = current >= s.startMonth ? monthSummary(doc, current, today) : null;
  const currentProjected = cur ? cur.savings : 0;

  // Expected path: actual so far, this month's projection, then the plan.
  const path = [{ month: current, total: actualTotal + currentProjected }, ...projectTotals(s, addMonths(current, 1), actualTotal + currentProjected, HORIZON)];
  const now = allocate(s.goals, actualTotal);
  let threshold = 0;
  const goals = s.goals.map((goal, index) => {
    threshold += goal.target;
    const saved = now[index].saved;
    const reached = saved >= goal.target;
    const hit = reached ? current : path.find((p) => p.total >= threshold)?.month ?? null;
    return { goal, index, saved, remaining: goal.target - saved, percent: Math.min(100, Math.round((saved / goal.target) * 100)), done: reached, eta: hit, reached };
  });
  return { opening, months, actualTotal, currentProjected, goals, allDoneBy: goals.length ? goals[goals.length - 1].eta : current };
}

// ---------- cards ----------

export interface CardCycle {
  start: string;
  end: string;
}
export interface CardStatus {
  card: Card;
  /** Statement day not set: cycles fall back to calendar months. */
  assumedCycle: boolean;
  current: CardCycle;
  spent: Paise;
  available: Paise;
  utilisation: number;
  level: 'ok' | 'warn' | 'over';
  /** Last closed statement. */
  lastBill: { cycle: CardCycle; amount: Paise; dueDate: string | null; paid: boolean } | null;
  /** Unpaid closed bill plus the current cycle so far. */
  outstanding: Paise;
}

/** The statement cycle containing `day`, and the one before it. */
export function cardCycles(card: Card, day: string): { current: CardCycle; previous: CardCycle } {
  const ym = monthOf(day);
  if (card.statementDay === null) {
    const prev = addMonths(ym, -1);
    return { current: { start: `${ym}-01`, end: dateIn(ym, 31) }, previous: { start: `${prev}-01`, end: dateIn(prev, 31) } };
  }
  const thisStatement = dateIn(ym, card.statementDay);
  const lastClose = day <= thisStatement ? dateIn(addMonths(ym, -1), card.statementDay) : thisStatement;
  const lastMonth = monthOf(lastClose);
  const nextClose = dateIn(addMonths(lastMonth, 1), card.statementDay);
  const prevClose = dateIn(addMonths(lastMonth, -1), card.statementDay);
  return { current: { start: nextDay(lastClose), end: nextClose }, previous: { start: nextDay(prevClose), end: lastClose } };
}

/** Bill due after a statement closing on `close`: the next `dueDay` after it. */
export function dueDateAfter(card: Card, close: string): string | null {
  if (card.dueDay === null) return null;
  const ym = monthOf(close);
  const same = dateIn(ym, card.dueDay);
  return same > close ? same : dateIn(addMonths(ym, 1), card.dueDay);
}

export function cardStatus(doc: FinanceDoc, card: Card, today: string): CardStatus {
  const { current, previous } = cardCycles(card, today);
  const txs = live(doc.transactions).filter((t) => t.method === card.method);
  // Purchases plus settled refunds/charges on this card (a refund lowers the bill).
  const inRange = (c: CardCycle) => txs.filter((t) => t.date >= c.start && t.date <= c.end).reduce((a, t) => a + t.amount, 0) + cardEventsBetween(doc, card.method, c.start, c.end);
  const spent = inRange(current);
  const billAmount = inRange(previous);
  const dueDate = dueDateAfter(card, previous.end);
  const paid = dueDate ? today > dueDate : false;
  const utilisation = card.limit > 0 ? spent / card.limit : 0;
  const tracked = previous.end >= `${doc.settings.startMonth}-01`;
  const lastBill = tracked ? { cycle: previous, amount: billAmount, dueDate, paid } : null;
  return {
    card,
    assumedCycle: card.statementDay === null,
    current,
    spent,
    available: card.limit - spent,
    utilisation,
    level: spent > card.limit ? 'over' : utilisation >= 0.8 ? 'warn' : 'ok',
    lastBill,
    outstanding: spent + (lastBill && !lastBill.paid ? lastBill.amount : 0),
  };
}

/** Card spending this calendar month against the combined cap. */
export function combinedCap(doc: FinanceDoc, today: string): { spent: Paise; cap: Paise; level: 'ok' | 'warn' | 'over' } {
  const methods = new Set(doc.settings.cards.map((c) => c.method));
  const ym = monthOf(today);
  const spent = live(doc.transactions)
    .filter((t) => methods.has(t.method) && monthOf(t.date) === ym)
    .reduce((a, t) => a + t.amount, 0);
  const cap = planFor(doc.settings, ym).combinedCardCap;
  return { spent, cap, level: spent > cap ? 'over' : cap > 0 && spent / cap >= 0.8 ? 'warn' : 'ok' };
}

// ---------- upcoming ----------

export interface Upcoming {
  date: string | null;
  month: string;
  name: string;
  amount: Paise;
  kind: 'card' | 'fixed' | 'periodic' | 'salary';
  note: string | null;
}

/** Bills and salary from today to the end of next month. */
export function upcoming(doc: FinanceDoc, today: string): Upcoming[] {
  const ym = monthOf(today);
  const s = planFor(doc.settings, ym);
  const out: Upcoming[] = [];
  for (const card of s.cards) {
    const st = cardStatus(doc, card, today);
    if (st.lastBill && !st.lastBill.paid && st.lastBill.amount > 0) {
      out.push({ date: st.lastBill.dueDate, month: monthOf(st.lastBill.dueDate ?? today), name: `${card.name} bill`, amount: st.lastBill.amount, kind: 'card', note: st.lastBill.dueDate ? null : 'Set the due day in Settings' });
    }
    const nextDue = dueDateAfter(card, st.current.end);
    if (st.spent > 0) out.push({ date: nextDue, month: monthOf(nextDue ?? st.current.end), name: `${card.name} bill (this cycle so far)`, amount: st.spent, kind: 'card', note: 'Grows until the statement closes' });
  }
  const sal = salaryDate(s, ym);
  if (sal >= today) out.push({ date: sal, month: ym, name: 'Salary', amount: s.salary, kind: 'salary', note: 'Pays next month' });
  const next = addMonths(ym, 1);
  for (const c of commitmentsFor(s, next)) for (const i of c.items) out.push({ date: null, month: next, name: i.name, amount: i.amount, kind: i.kind, note: null });
  const thisMonth = monthSummary(doc, ym, today);
  for (const c of thisMonth.committed) {
    const left = c.planned - c.logged;
    if (left > 0) out.push({ date: null, month: ym, name: c.items.map((i) => i.name).join(' + '), amount: left, kind: c.items.some((i) => i.kind === 'periodic') ? 'periodic' : 'fixed', note: c.logged ? 'Rest of it' : 'Not logged yet; assumed this month' });
  }
  return out.sort((a, b) => a.month.localeCompare(b.month) || (a.date ?? `${a.month}-99`).localeCompare(b.date ?? `${b.month}-99`));
}
