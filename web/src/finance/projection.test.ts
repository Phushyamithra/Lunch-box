import { describe, expect, it } from 'vitest';
import { emptyDoc, rupees, type FinanceDoc, type Transaction } from './model';
import { compareBalance, finishMonth, projection, reconcile } from './projection';

let n = 0;
const tx = (date: string, amount: number, category: string, method = 'UPI'): Transaction => ({
  id: `t${++n}`,
  date,
  amount: rupees(amount),
  category,
  method,
  note: null,
  createdAt: `${date}T10:00:00Z`,
  updatedAt: `${date}T10:00:00Z`,
  deletedAt: null,
});
const doc = (over: (d: FinanceDoc) => void = () => undefined): FinanceDoc => {
  const d = emptyDoc('2026-10-20', '2026-10-01T00:00:00Z');
  d.settings.startMonth = '2026-10';
  over(d);
  return d;
};

describe('projection', () => {
  const rows = projection(doc(), '2026-10-20');

  it('labels each month and stops when the last goal is full', () => {
    // 20 Oct: needs counted for the 12 days left.
    expect(rows[0]).toMatchObject({ month: '2026-10', kind: 'current', savings: rupees(17830) - Math.round((rupees(10000) * 12) / 31 / 100) * 100 });
    expect(rows[1]).toMatchObject({ month: '2026-11', kind: 'projected', savings: rupees(11000) });
    const last = rows[rows.length - 1];
    expect(last.total).toBeGreaterThanOrEqual(rupees(634000));
    expect(last.filling).toBe(-1);
    expect(rows[rows.length - 2].total).toBeLessThan(rupees(634000));
  });

  it('marks gym in December, insurance quarters and the gold scheme ending', () => {
    const at = (m: string) => rows.find((r) => r.month === m)!;
    expect(at('2026-12')).toMatchObject({ savings: rupees(-6750), notes: ['Gym'] });
    expect(at('2027-01').notes).toEqual(['Insurance']);
    expect(at('2027-08').notes).toEqual(['last Gold scheme']);
    expect(at('2027-09')).toMatchObject({ savings: rupees(21000), notes: ['Gold scheme over'] });
  });

  it('pours savings through the waterfall and notes when each goal completes', () => {
    const completions = rows.flatMap((r) => r.completes.map((g) => [g, r.month]));
    expect(completions.map(([g]) => g)).toEqual([0, 1, 2, 3, 4]);
    // The top-up only needs ₹70,000 more, not another ₹1,00,000.
    const done = rows.find((r) => r.completes.includes(3))!;
    expect(done.goals[3]).toBe(rupees(70000));
    expect(finishMonth(rows, doc().settings)).toBe(rows[rows.length - 1].month);
  });

  it('finished months use what really happened', () => {
    const d = doc((x) => {
      x.settings.startMonth = '2026-09';
      x.transactions = [tx('2026-09-10', 3000, 'Groceries', 'HDFC')];
    });
    const r = projection(d, '2026-10-20');
    // September: 62,000 − committed 39,000 − wants/unplanned 0 − everyday 3,000.
    expect(r[0]).toMatchObject({ month: '2026-09', kind: 'actual', savings: rupees(20000), total: rupees(20000) });
  });
});

describe('bank reconciliation', () => {
  const base = (over: (d: FinanceDoc) => void = () => undefined) =>
    doc((x) => {
      x.settings.openingBalance = rupees(50000);
      x.settings.cards[0].statementDay = 15;
      x.settings.cards[0].dueDay = 5;
      over(x);
    });

  it('opening + salaries − UPI/debit − card bills on due dates; this month’s unlogged costs stay pending', () => {
    const d = base((x) => {
      x.transactions = [tx('2026-10-02', 20000, 'Rent'), tx('2026-10-10', 2000, 'Groceries', 'HDFC'), tx('2026-10-20', 1500, 'Groceries', 'HDFC')];
    });
    const oct = reconcile(d, '2026-10-25', { savingsPot: 0, cardsOwed: rupees(3500) });
    // No salary yet (31 Oct); rent left the bank; the card bill isn't due until 5 Nov.
    expect(oct.expected).toBe(rupees(30000));
    // Gold 10,000 + SIP 3,000 + dinner 3,500 + protein 2,500 + insurance 3,170 not logged yet.
    expect(oct.pendingThisMonth).toBe(rupees(22170));
    expect(oct.earmarks).toEqual({ savings: 0, cards: rupees(3500), committed: rupees(22170), free: rupees(30000 - 3500 - 22170) });

    const nov = reconcile(d, '2026-11-06', { savingsPot: 0, cardsOwed: 0 });
    // + salary 62,000 on 31 Oct; − HDFC bill 2,000 on 5 Nov; − October's unlogged committed 22,170 (assumed paid).
    expect(nov.expected).toBe(rupees(30000 + 62000 - 2000 - 22170));
    expect(nov.lines.some((l) => l.assumed && /not logged in earlier months/.test(l.label))).toBe(true);
  });

  it('no opening balance: no expected figure, nothing guessed', () => {
    expect(reconcile(doc(), '2026-10-25', { savingsPot: 0, cardsOwed: 0 }).expected).toBeNull();
  });

  it('flags only gaps nothing explains', () => {
    const r = reconcile(base(), '2026-10-25', { savingsPot: 0, cardsOwed: 0 });
    expect(r.expected).toBe(rupees(50000));
    expect(compareBalance(r, rupees(50300))?.verdict).toBe('match');
    // Rent etc. (₹42,170 this month) probably paid but not logged: lower by up to that is explained.
    expect(compareBalance(r, rupees(30000))?.verdict).toBe('explained');
    expect(compareBalance(r, rupees(5000))).toMatchObject({ verdict: 'unexplained', message: expect.stringContaining('less than expected') });
    expect(compareBalance(r, rupees(58000))).toMatchObject({ verdict: 'unexplained', diff: rupees(8000), message: expect.stringContaining('more than expected') });
  });
});
