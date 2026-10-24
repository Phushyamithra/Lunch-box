import { describe, expect, it } from 'vitest';
import { emptyDoc, rupees, type FinanceDoc, type Transaction } from './model';
import { cardTrends, categoryTrends, financeMarkdown, goalReport, monthlyCsv, monthlyRows, transactionsCsv } from './reports';

let n = 0;
const tx = (date: string, amount: number, category: string, method = 'UPI', extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${++n}`,
  date,
  amount: rupees(amount),
  category,
  method,
  note: null,
  createdAt: `${date}T10:00:00Z`,
  updatedAt: '2026-10-01T00:00:00Z',
  deletedAt: null,
  ...extra,
});
const doc = (): FinanceDoc => {
  const d = emptyDoc('2026-11-05', '2026-09-01T00:00:00Z');
  d.settings.startMonth = '2026-09';
  d.transactions = [
    tx('2026-09-03', 3000, 'Groceries', 'HDFC'),
    tx('2026-09-14', 400, 'Wants'),
    tx('2026-10-08', 2500, 'Groceries', 'HDFC'),
    tx('2026-10-19', 1800, 'Fuel', 'ICICI', { note: 'Pune, "full tank"' }),
    tx('2026-10-20', 350, 'Pet', 'Amazon Pay'),
    tx('2026-11-02', 900, 'Groceries', 'HDFC'),
  ];
  return d;
};
const TODAY = '2026-11-05';

describe('finance reports', () => {
  it('monthly rows: actual months vs this month, with what the plan said', () => {
    const r = monthlyRows(doc(), '2026-06', '2026-12', TODAY);
    expect(r.map((x) => [x.month, x.kind])).toEqual([
      ['2026-09', 'actual'],
      ['2026-10', 'actual'],
      ['2026-11', 'current'],
    ]);
    // September: 62,000 − committed 39,000 − Wants 400 − needs 3,000; the plan said 11,000.
    expect(r[0]).toMatchObject({ savings: rupees(19600), planned: rupees(11000), needs: rupees(3000), transactions: 2 });
    // October: voucher spending kept apart.
    expect(r[1]).toMatchObject({ voucherSpend: rupees(350), needs: rupees(4300), planned: rupees(7830) });
  });

  it('category and card trends', () => {
    const months = ['2026-09', '2026-10'];
    expect(categoryTrends(doc(), months)[0]).toEqual({ category: 'Groceries', byMonth: [rupees(3000), rupees(2500)], total: rupees(5500) });
    expect(cardTrends(doc(), months).map((c) => [c.name, c.byMonth])).toEqual([
      ['HDFC RuPay / UPI', [rupees(3000), rupees(2500)]],
      ['ICICI Amazon', [0, rupees(1800)]],
    ]);
  });

  it('goal progress from actual savings', () => {
    const g = goalReport(doc(), TODAY);
    expect(g.actualTotal).toBe(rupees(19600) + monthlyRows(doc(), '2026-10', '2026-10', TODAY)[0].savings);
    expect(g.goals[0]).toMatchObject({ name: 'Starter emergency fund', saved: rupees(30000) });
  });

  it('CSV: quoted safely, amounts in rupees, voucher payments marked', () => {
    const csv = transactionsCsv(doc(), '2026-10-01', '2026-10-31');
    const lines = csv.trim().split('\r\n');
    expect(csv.startsWith('﻿')).toBe(true); // so Excel reads UTF-8 (₹) correctly
    expect(lines[0]).toBe('date,amount,category,method,note,one_off,paid_with_voucher,id');
    expect(lines).toHaveLength(4);
    expect(lines[2]).toContain('"Pune, ""full tank"""');
    expect(lines[3]).toMatch(/^2026-10-20,350.00,Pet,Amazon Pay,,,yes,/);
    expect(monthlyCsv(monthlyRows(doc(), '2026-09', '2026-09', TODAY))).toContain('2026-09,actual,62000.00,0.00,0.00,39000.00,400.00,3000.00,42400.00,19600.00,11000.00,8600.00,0.00');
  });

  it('Markdown section', () => {
    const m = financeMarkdown(doc(), '2026-09-01', '2026-10-31', TODAY);
    expect(m).toContain('# PART 6 — FINANCE');
    expect(m).toContain('| Sep 2026 | actual | ₹62,000 |');
    expect(m).toContain('| Groceries | ₹3,000 | ₹2,500 | ₹5,500 |');
    expect(m).toContain('| ICICI Amazon | ₹4,000 | ₹0 (0%) | ₹1,800 (45%) |');
    expect(m).toContain('## Savings goals (waterfall)');
  });
});

describe('by method and budget timelines', () => {
  it('totals each payment method; bank one-offs listed separately', async () => {
    const { byMethod } = await import('./reports');
    const d = doc();
    d.events = [{ id: 'e', date: '2026-10-02', kind: 'expense', amount: rupees(8888), description: 'Old HDFC bill', status: 'settled', settledOn: '2026-10-02', account: 'bank', cardMethod: null, updatedAt: '', deletedAt: null }];
    const r = byMethod(d, '2026-10');
    expect(r.methods.map((m) => [m.method, m.total / 100, m.count, m.kind])).toEqual([
      ['HDFC', 2500, 1, 'card'],
      ['ICICI', 1800, 1, 'card'],
      ['Amazon Pay', 350, 1, 'voucher'],
    ]);
    expect(r.bankOneOffs).toBe(rupees(8888));
  });

  it('a budget’s purchases in order, with the day it ran out', async () => {
    const { budgetTimeline } = await import('./reports');
    const d = doc();
    d.transactions = [
      tx('2026-10-05', 849, 'Wants', 'UPI', { note: 'Shaker' }),
      tx('2026-10-12', 185, 'Wants', 'UPI', { note: 'Ice cream' }),
      tx('2026-10-15', 300, 'Wants', 'Amazon Pay'), // voucher: not the cash budget
      tx('2026-10-23', 378, 'Wants', 'UPI', { note: 'Shawarma' }),
    ];
    const b = budgetTimeline(d, 'Wants', '2026-10');
    expect(b).toMatchObject({ limit: rupees(1000), usedUpOn: '2026-10-12', spent: rupees(1412) });
    expect(b.steps.map((s) => [s.label, s.running / 100, s.crossed])).toEqual([
      ['Shaker', 849, false],
      ['Ice cream', 1034, true],
      ['Shawarma', 1412, false],
    ]);
  });
});
