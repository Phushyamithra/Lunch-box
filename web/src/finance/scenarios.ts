/**
 * "Can I afford it?" and "what if?". Pure; nothing here changes your data.
 * A hypothetical purchase only becomes real when you confirm it, and a
 * scenario only changes your settings when you apply it (from a month on,
 * so past months stay as they were).
 */
import { cardCycles, cardStatus, combinedCap, commitmentsFor, dueDateAfter, monthOf, monthSummary } from './engine';
import { formatINR, newTransaction, planFor, withPlanFrom, type FinanceDoc, type FinanceSettings, type Paise, type TransactionInput } from './model';
import { finishMonth, projection, type ProjectionRow } from './projection';

/** Month each goal becomes full (the first month if it already was; null = not within the horizon). */
export function goalMonths(rows: ProjectionRow[], targets: Paise[]): (string | null)[] {
  return targets.map((t, i) => rows.find((r) => r.goals[i] >= t)?.month ?? null);
}

/** Whole months between two YYYY-MM (b − a); null if either is missing. */
export const monthsBetween = (a: string | null, b: string | null): number | null => {
  if (!a || !b) return null;
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return by * 12 + bm - (ay * 12 + am);
};

// ---------- affordability ----------

export type CategoryKind = 'committed' | 'budget' | 'everyday';

export interface Affordability {
  kind: CategoryKind;
  /** This month's expected savings before → after. */
  savings: { before: Paise; after: Paise };
  budget: { category: string; before: Paise; after: Paise; limit: Paise } | null;
  everyday: { before: Paise; after: Paise; cap: Paise } | null;
  card: { name: string; before: Paise; after: Paise; limit: Paise; level: 'ok' | 'warn' | 'over'; billDue: string | null; billAmount: Paise } | null;
  combined: { before: Paise; after: Paise; cap: Paise; level: 'ok' | 'warn' | 'over' } | null;
  goals: { name: string; before: string | null; after: string | null; delay: number | null }[];
  finish: { before: string | null; after: string | null };
  /** Plain-language summary lines, most important first. */
  verdict: string[];
  /** 'fine' = within plan; 'stretch' = costs savings; 'over' = breaks a limit. */
  level: 'fine' | 'stretch' | 'over';
}

const rs = (p: Paise) => `₹${Math.round(Math.abs(p) / 100).toLocaleString('en-IN')}`;

export function affordability(doc: FinanceDoc, today: string, input: TransactionInput): Affordability {
  const s = planFor(doc.settings, monthOf(input.date));
  const ym = monthOf(input.date);
  const tx = { ...newTransaction(input, `${today}T00:00:00Z`), createdAt: '9999' };
  const after: FinanceDoc = { ...doc, transactions: [...doc.transactions, tx] };
  const kind: CategoryKind = commitmentsFor(doc.settings, ym).some((c) => c.category === input.category)
    ? 'committed'
    : s.budgets.some((b) => b.category === input.category)
      ? 'budget'
      : 'everyday';

  const m0 = monthSummary(doc, ym, today);
  const m1 = monthSummary(after, ym, today);
  const verdict: string[] = [];
  let level: Affordability['level'] = 'fine';

  let budget: Affordability['budget'] = null;
  let everyday: Affordability['everyday'] = null;
  if (kind === 'budget') {
    const b0 = m0.budgets.find((b) => b.category === input.category)!;
    const b1 = m1.budgets.find((b) => b.category === input.category)!;
    budget = { category: input.category, before: b0.logged, after: b1.logged, limit: b0.planned };
    if (b1.logged > b0.planned) {
      verdict.push(`Puts ${input.category} ${rs(b1.logged - b0.planned)} over its ${rs(b0.planned)} budget.`);
      level = 'stretch';
    } else verdict.push(`Fits in ${input.category}: ${rs(b0.planned - b1.logged)} left after.`);
  } else if (kind === 'everyday') {
    everyday = { before: m0.everyday.logged, after: m1.everyday.logged, cap: m0.everyday.planned };
    if (m1.everyday.logged > m0.everyday.planned) {
      verdict.push(`Takes everyday spending ${rs(m1.everyday.logged - m0.everyday.planned)} past the ${rs(m0.everyday.planned)} allowance.`);
      level = 'stretch';
    } else verdict.push(`Fits in this month’s everyday allowance: ${rs(m0.everyday.planned - m1.everyday.logged)} left after.`);
  } else {
    const c1 = m1.committed.find((c) => c.category === input.category)!;
    verdict.push(c1.logged > c1.planned ? `More than the planned ${rs(c1.planned)} for ${input.category}: ${rs(c1.logged - c1.planned)} extra.` : `Part of the planned ${input.category} cost; nothing extra.`);
    if (c1.logged > c1.planned) level = 'stretch';
  }

  let card: Affordability['card'] = null;
  let combined: Affordability['combined'] = null;
  const c = doc.settings.cards.find((x) => x.method === input.method);
  if (c) {
    const st0 = cardStatus(doc, c, input.date);
    const st1 = cardStatus(after, c, input.date);
    const cycle = cardCycles(c, input.date).current;
    card = { name: c.name, before: st0.spent, after: st1.spent, limit: c.limit, level: st1.level, billDue: dueDateAfter(c, cycle.end), billAmount: st1.spent };
    if (st1.level === 'over') {
      verdict.unshift(`Over the ${c.name} limit by ${rs(st1.spent - c.limit)}: pay another way.`);
      level = 'over';
    } else if (st1.level === 'warn') verdict.push(`${c.name} would be ${Math.round((st1.spent / c.limit) * 100)}% used.`);
    const k0 = combinedCap(doc, input.date);
    const k1 = combinedCap(after, input.date);
    combined = { before: k0.spent, after: k1.spent, cap: k1.cap, level: k1.level };
    if (k1.level === 'over' && level !== 'over') {
      verdict.push(`Both cards together go ${rs(k1.spent - k1.cap)} over the ${rs(k1.cap)} cap.`);
      level = 'over';
    }
  }

  const savings = { before: m0.savings, after: m1.savings };
  if (m1.savings < m0.savings) verdict.push(`This month saves ${rs(m0.savings - m1.savings)} less (${formatINR(m1.savings)} instead of ${formatINR(m0.savings)}).`);
  else if (kind !== 'committed') verdict.push('Savings this month stay on plan.');

  const p0 = projection(doc, today);
  const p1 = projection(after, today);
  const targets = doc.settings.goals.map((g) => g.target);
  const g0 = goalMonths(p0, targets);
  const g1 = goalMonths(p1, targets);
  const goals = doc.settings.goals.map((g, i) => ({ name: g.name, before: g0[i], after: g1[i], delay: monthsBetween(g0[i], g1[i]) }));
  const firstDelayed = goals.find((g) => (g.delay ?? 0) > 0);
  if (firstDelayed) verdict.push(`${firstDelayed.name} moves ${firstDelayed.delay} month${firstDelayed.delay === 1 ? '' : 's'} later (estimate).`);
  else if (m1.savings < m0.savings) verdict.push('No goal date moves.');

  return { kind, savings, budget, everyday, card, combined, goals, finish: { before: finishMonth(p0, doc.settings), after: finishMonth(p1, doc.settings) }, verdict, level };
}

// ---------- what-if ----------

export interface WhatIf {
  salary: Paise;
  combinedCardCap: Paise;
  sip: Paise;
  rent: Paise;
  /** Last month of the gold scheme (YYYY-MM). */
  goldEndsOn: string | null;
}

const find = (s: FinanceSettings, id: string, name: RegExp) => s.fixed.find((f) => f.id === id) ?? s.fixed.find((f) => name.test(f.name));

/** The levers as they stand this month. */
export function currentLevers(s0: FinanceSettings, ym: string): WhatIf {
  const s = planFor(s0, ym);
  return {
    salary: s.salary,
    combinedCardCap: s.combinedCardCap,
    sip: find(s, 'sip', /\bsip\b/i)?.amount ?? 0,
    rent: find(s, 'rent', /rent/i)?.amount ?? 0,
    goldEndsOn: find(s, 'gold', /gold/i)?.endsOn ?? null,
  };
}

/** Settings with the levers changed from `from` on (earlier months keep their values). */
export function scenarioSettings(s: FinanceSettings, w: WhatIf, from: string): FinanceSettings {
  const cur = planFor(s, from);
  const ids = { sip: find(cur, 'sip', /\bsip\b/i)?.id, rent: find(cur, 'rent', /rent/i)?.id, gold: find(cur, 'gold', /gold/i)?.id };
  const fixed = cur.fixed.map((f) => (f.id === ids.sip ? { ...f, amount: w.sip } : f.id === ids.rent ? { ...f, amount: w.rent } : f.id === ids.gold ? { ...f, endsOn: w.goldEndsOn } : f));
  const next: FinanceSettings = { ...s, salary: w.salary, salaryDay: cur.salaryDay, periodic: cur.periodic, budgets: cur.budgets, combinedCardCap: w.combinedCardCap, fixed, updatedAt: new Date().toISOString() };
  return withPlanFrom({ ...s, ...planValuesOf(cur) }, next, from);
}
const planValuesOf = (s: FinanceSettings) => ({ salary: s.salary, salaryDay: s.salaryDay, fixed: s.fixed, periodic: s.periodic, budgets: s.budgets, combinedCardCap: s.combinedCardCap });

export interface ScenarioResult {
  /** A typical month's savings (next month) before → after. */
  monthly: { before: Paise; after: Paise };
  goals: { name: string; before: string | null; after: string | null; change: number | null }[];
  finish: { before: string | null; after: string | null; change: number | null };
  rows: ProjectionRow[];
  baseRows: ProjectionRow[];
}

export function compareScenario(doc: FinanceDoc, today: string, w: WhatIf): ScenarioResult {
  const from = monthOf(today);
  const s1 = scenarioSettings(doc.settings, w, from);
  const baseRows = projection(doc, today);
  const rows = projection({ ...doc, settings: s1 }, today);
  const targets = doc.settings.goals.map((g) => g.target);
  const g0 = goalMonths(baseRows, targets);
  const g1 = goalMonths(rows, targets);
  const next = baseRows.find((r) => r.kind === 'projected');
  const nextAfter = rows.find((r) => r.month === next?.month);
  const f0 = finishMonth(baseRows, doc.settings);
  const f1 = finishMonth(rows, s1);
  return {
    monthly: { before: next?.savings ?? 0, after: nextAfter?.savings ?? 0 },
    goals: doc.settings.goals.map((g, i) => ({ name: g.name, before: g0[i], after: g1[i], change: monthsBetween(g0[i], g1[i]) })),
    finish: { before: f0, after: f1, change: monthsBetween(f0, f1) },
    rows,
    baseRows,
  };
}
