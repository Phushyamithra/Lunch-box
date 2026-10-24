/**
 * Finance reports: monthly summaries, actual vs plan, category and card
 * trends, CSV exports and a Markdown section. Pure; money in paise.
 * Every figure says whether it's actual or an estimate.
 */
import { toCsv } from '../nutrition/backup';
import { addMonths, allocate, cardStatus, monthOf, monthSummary, plannedSavings } from './engine';
import { reliableIncome, voucherState } from './extras';
import { formatINR, planFor, VOUCHER_METHOD, type FinanceDoc, type Paise } from './model';
import { finishMonth, projection } from './projection';

const live = (d: FinanceDoc) => d.transactions.filter((t) => !t.deletedAt);
const monthsBetween = (from: string, to: string) => {
  const out: string[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
};

export interface MonthRow {
  month: string;
  kind: 'actual' | 'current';
  salary: Paise;
  otherIncome: Paise;
  events: Paise;
  committed: Paise;
  budgets: Paise;
  needs: Paise;
  spend: Paise;
  savings: Paise;
  /** What the plan said this month would save. */
  planned: Paise;
  voucherSpend: Paise;
  transactions: number;
}

/** Tracked months from `from` to `to` (never before tracking started, never after this month). */
export function monthlyRows(doc: FinanceDoc, from: string, to: string, today: string): MonthRow[] {
  const current = monthOf(today);
  const start = from < doc.settings.startMonth ? doc.settings.startMonth : from;
  const end = to > current ? current : to;
  return monthsBetween(start, end).map((m) => {
    const s = monthSummary(doc, m, today);
    return {
      month: m,
      kind: m < current ? 'actual' : 'current',
      salary: s.funding,
      otherIncome: s.otherIncome,
      events: s.eventsIn - s.eventsOut,
      committed: s.committed.reduce((a, c) => a + c.counted, 0),
      budgets: s.budgets.reduce((a, b) => a + b.counted, 0),
      needs: s.everyday.counted,
      spend: s.spend,
      savings: s.savings,
      planned: plannedSavings(doc.settings, m).savings + reliableIncome(doc, m),
      voucherSpend: s.voucherSpend,
      transactions: live(doc).filter((t) => monthOf(t.date) === m).length,
    };
  });
}

/** Logged spending by category per month (vouchers included, marked separately in the UI). */
export function categoryTrends(doc: FinanceDoc, months: string[]): { category: string; byMonth: Paise[]; total: Paise }[] {
  const by = new Map<string, Paise[]>();
  for (const t of live(doc)) {
    const i = months.indexOf(monthOf(t.date));
    if (i < 0) continue;
    const row = by.get(t.category) ?? months.map(() => 0);
    row[i] += t.amount;
    by.set(t.category, row);
  }
  return [...by]
    .map(([category, byMonth]) => ({ category, byMonth, total: byMonth.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total);
}

/** Card spending per calendar month against each limit. */
export function cardTrends(doc: FinanceDoc, months: string[]): { name: string; limit: Paise; byMonth: Paise[] }[] {
  return doc.settings.cards.map((c) => ({
    name: c.name,
    limit: c.limit,
    byMonth: months.map((m) => live(doc).filter((t) => t.method === c.method && monthOf(t.date) === m).reduce((a, t) => a + t.amount, 0)),
  }));
}

export interface GoalReport {
  name: string;
  target: Paise;
  saved: Paise;
  eta: string | null;
}

export function goalReport(doc: FinanceDoc, today: string): { goals: GoalReport[]; actualTotal: Paise; finish: string | null } {
  const rows = projection(doc, today);
  const current = rows.find((r) => r.kind === 'current');
  const actualTotal = (current ? current.total - current.savings : rows[rows.length - 1]?.total) ?? 0;
  const now = allocate(doc.settings.goals, actualTotal);
  return {
    goals: doc.settings.goals.map((g, i) => ({ name: g.name, target: g.target, saved: now[i].saved, eta: rows.find((r) => r.goals[i] >= g.target)?.month ?? null })),
    actualTotal,
    finish: finishMonth(rows, doc.settings),
  };
}

// ---------- CSV ----------

const rs = (p: Paise) => (p / 100).toFixed(2);

export const TX_COLUMNS = ['date', 'amount', 'category', 'method', 'note', 'one_off', 'paid_with_voucher', 'id'] as const;
export function transactionsCsv(doc: FinanceDoc, from?: string, to?: string): string {
  const rows = live(doc)
    .filter((t) => (!from || t.date >= from) && (!to || t.date <= to))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .map((t) => ({ date: t.date, amount: rs(t.amount), category: t.category, method: t.method, note: t.note, one_off: t.oneOff ? 'yes' : '', paid_with_voucher: t.method === VOUCHER_METHOD ? 'yes' : '', id: t.id }));
  return toCsv(TX_COLUMNS, rows);
}

export const MONTH_COLUMNS = ['month', 'status', 'salary', 'other_income', 'refunds_and_one_offs', 'committed', 'budgets', 'needs', 'total_spend', 'saved', 'plan_said', 'difference', 'voucher_spend'] as const;
export function monthlyCsv(rows: MonthRow[]): string {
  return toCsv(
    MONTH_COLUMNS,
    rows.map((r) => ({
      month: r.month,
      status: r.kind === 'actual' ? 'actual' : 'this month (part estimate)',
      salary: rs(r.salary),
      other_income: rs(r.otherIncome),
      refunds_and_one_offs: rs(r.events),
      committed: rs(r.committed),
      budgets: rs(r.budgets),
      needs: rs(r.needs),
      total_spend: rs(r.spend),
      saved: rs(r.savings),
      plan_said: rs(r.planned),
      difference: rs(r.savings - r.planned),
      voucher_spend: rs(r.voucherSpend),
    })),
  );
}

// ---------- Markdown ----------

const md = (s: string) => s.replace(/\|/g, '/');
const table = (h: string[], rows: string[][]) => [`| ${h.join(' | ')} |`, `|${h.map((_, i) => (i ? '---:' : '---')).join('|')}|`, ...rows.map((r) => `| ${r.map(md).join(' | ')} |`)].join('\n');
const mon = (m: string) => {
  const [y, mm] = m.split('-').map(Number);
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][mm - 1]} ${y}`;
};

/** "PART 6 — FINANCE" for the Markdown report. Plain text: only included when you tick it. */
export function financeMarkdown(doc: FinanceDoc, from: string, to: string, today: string): string {
  const rows = monthlyRows(doc, monthOf(from), monthOf(to), today);
  const months = rows.map((r) => r.month);
  const s = planFor(doc.settings, monthOf(today));
  const g = goalReport(doc, today);
  const out: string[] = ['# PART 6 — FINANCE', '', '*Actual figures for finished months; the current month mixes logs with the plan. Voucher (Amazon Pay) value is not cash and is listed separately.*', ''];
  out.push('## Plan', '', table(['Item', 'Value'], [
    ['Salary (pays next month)', formatINR(s.salary)],
    ['Committed monthly', s.fixed.filter((f) => !f.endsOn || monthOf(today) <= f.endsOn).map((f) => `${f.name} ${formatINR(f.amount)}${f.endsOn ? ` (to ${f.endsOn})` : ''}`).join(', ')],
    ['Periodic', s.periodic.map((p) => `${p.name} ${formatINR(p.amount)} in ${p.months.map((n) => mon(`2000-${String(n).padStart(2, '0')}`).slice(0, 3)).join('/')}`).join(', ') || '—'],
    ['Budgets', s.budgets.map((b) => `${b.category} ${formatINR(b.amount)}`).join(', ')],
    ['Card cap (everyday)', formatINR(s.combinedCardCap)],
    ...(s.cardFree ? [['Card-free from', `${s.cardFree.from}, weekly cap ${formatINR(s.cardFree.weeklyCap)}`]] : []),
  ]), '');
  if (rows.length) {
    out.push('## Month by month', '', table(
      ['Month', 'Status', 'Income', 'Committed', 'Budgets', 'Needs', 'Saved', 'Plan said'],
      rows.map((r) => [mon(r.month), r.kind === 'actual' ? 'actual' : 'part estimate', formatINR(r.salary + r.otherIncome + r.events), formatINR(r.committed), formatINR(r.budgets), formatINR(r.needs), formatINR(r.savings), formatINR(r.planned)]),
    ), '');
    const cats = categoryTrends(doc, months);
    if (cats.length) out.push('## Spending by category (logged)', '', table(['Category', ...months.map(mon), 'Total'], cats.map((c) => [c.category, ...c.byMonth.map((v) => (v ? formatINR(v) : '')), formatINR(c.total)])), '');
    const cards = cardTrends(doc, months);
    out.push('## Cards (calendar months)', '', table(['Card', 'Limit', ...months.map(mon)], cards.map((c) => [c.name, formatINR(c.limit), ...c.byMonth.map((v) => `${formatINR(v)} (${c.limit ? Math.round((v / c.limit) * 100) : 0}%)`)])), '');
    const statuses = s.cards.map((c) => cardStatus(doc, c, today));
    out.push(`Owed on cards now: ${formatINR(statuses.reduce((a, c) => a + c.outstanding, 0))}.`, '');
  } else out.push('*No tracked months in this period.*', '');
  out.push('## Savings goals (waterfall)', '', `Saved so far (actual): ${formatINR(g.actualTotal)}. All goals funded (estimate): ${g.finish ? mon(g.finish) : 'beyond 10 years'}.`, '', table(['Goal', 'Target', 'Saved', 'Expected (estimate)'], g.goals.map((x) => [x.name, formatINR(x.target), formatINR(x.saved), x.saved >= x.target ? 'done' : x.eta ? mon(x.eta) : '—'])), '');
  const v = voucherState(doc, today);
  if (v.balance || v.expired) out.push('## Amazon Pay (not cash)', '', `Balance ${formatINR(v.balance)}${v.expired ? `; expired unused ${formatINR(v.expired)}` : ''}.`, '');
  return out.join('\n');
}

// ---------- by payment method, and budget timelines ----------

export interface MethodTotal {
  method: string;
  total: Paise;
  count: number;
  kind: 'bank' | 'card' | 'voucher' | 'other';
}

/** A month's logged spending by how it was paid, plus one-offs that left the bank. */
export function byMethod(doc: FinanceDoc, ym: string): { methods: MethodTotal[]; bankOneOffs: Paise; total: Paise } {
  const cards = new Set(doc.settings.cards.map((c) => c.method));
  const m = new Map<string, MethodTotal>();
  for (const t of live(doc)) {
    if (monthOf(t.date) !== ym) continue;
    const kind: MethodTotal['kind'] = t.method === VOUCHER_METHOD ? 'voucher' : cards.has(t.method) ? 'card' : t.method === 'UPI' || t.method === 'Debit' ? 'bank' : 'other';
    const row = m.get(t.method) ?? { method: t.method, total: 0, count: 0, kind };
    row.total += t.amount;
    row.count++;
    m.set(t.method, row);
  }
  const bankOneOffs = (doc.events ?? [])
    .filter((e) => !e.deletedAt && e.status === 'settled' && e.account === 'bank' && e.kind === 'expense' && e.settledOn?.startsWith(ym))
    .reduce((a, e) => a + e.amount, 0);
  const methods = [...m.values()].sort((a, b) => b.total - a.total);
  return { methods, bankOneOffs, total: methods.reduce((a, x) => a + x.total, 0) };
}

export interface BudgetStep {
  id: string;
  date: string;
  label: string;
  amount: Paise;
  method: string;
  /** Running total after this purchase. */
  running: Paise;
  /** This purchase took the budget past its limit. */
  crossed: boolean;
}

/** A budget category's purchases in order, with a running total and the day it ran out. */
export function budgetTimeline(doc: FinanceDoc, category: string, ym: string): { limit: Paise | null; steps: BudgetStep[]; usedUpOn: string | null; spent: Paise } {
  const limit = planFor(doc.settings, ym).budgets.find((b) => b.category === category)?.amount ?? null;
  const txs = live(doc)
    .filter((t) => t.category === category && monthOf(t.date) === ym && t.method !== VOUCHER_METHOD)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  let running = 0;
  let usedUpOn: string | null = null;
  const steps = txs.map((t) => {
    const before = running;
    running += t.amount;
    const crossed = limit !== null && before < limit && running >= limit;
    if (crossed && !usedUpOn) usedUpOn = t.date;
    return { id: t.id, date: t.date, label: t.note || t.category, amount: t.amount, method: t.method, running, crossed };
  });
  return { limit, steps, usedUpOn, spent: running };
}
