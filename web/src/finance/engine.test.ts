import { describe, expect, it } from 'vitest';
import { addMonths, allocate, cardCycles, cardStatus, combinedCap, commitmentsFor, dueDateAfter, monthSummary, plannedSavings, salaryDate, savingsState, upcoming } from './engine';
import { emptyDoc, rupees, type FinanceDoc, type Transaction } from './model';

const doc = (over: (d: FinanceDoc) => void = () => undefined): FinanceDoc => {
  const d = emptyDoc('2026-10-20', '2026-10-01T00:00:00Z');
  d.settings.startMonth = '2026-10';
  over(d);
  return d;
};
let n = 0;
const tx = (date: string, amount: number, category: string, method = 'UPI', deletedAt: string | null = null): Transaction => ({
  id: `t${++n}`,
  date,
  amount: rupees(amount),
  category,
  method,
  note: null,
  createdAt: `${date}T10:00:00Z`,
  updatedAt: `${date}T10:00:00Z`,
  deletedAt,
});

describe('plan per month (brief numbers)', () => {
  const s = doc().settings;
  it('October: fixed ₹39,000 + insurance ₹3,170; saves ₹7,830 after budgets and the card cap', () => {
    expect(plannedSavings(s, '2026-10')).toEqual({ salary: rupees(62000), committed: rupees(42170), budgets: rupees(2000), everyday: rupees(10000), savings: rupees(7830) });
  });
  it('November saves ₹11,000; December’s gym makes it −₹6,750', () => {
    expect(plannedSavings(s, '2026-11').savings).toBe(rupees(11000));
    expect(plannedSavings(s, '2026-12').savings).toBe(rupees(-6750));
  });
  it('the gold scheme stops after August 2027', () => {
    expect(commitmentsFor(s, '2027-08').find((c) => c.items.some((i) => i.name === 'Gold scheme'))).toBeTruthy();
    expect(commitmentsFor(s, '2027-09').flatMap((c) => c.items).some((i) => i.name === 'Gold scheme')).toBe(false);
    expect(plannedSavings(s, '2027-09').savings).toBe(rupees(21000));
  });
  it('salary on the last day pays next month', () => {
    expect(salaryDate(s, '2026-09')).toBe('2026-09-30');
    expect(salaryDate(s, '2027-02')).toBe('2027-02-28');
    expect(addMonths('2026-11', 3)).toBe('2027-02');
    expect(monthSummary(doc(), '2026-10', '2026-10-20').fundingDate).toBe('2026-09-30');
  });
});

describe('a month with logs', () => {
  it('committed costs are assumed paid; logging them doesn’t double count; overspend shows', () => {
    const d = doc((x) => {
      x.transactions = [tx('2026-10-01', 20000, 'Rent'), tx('2026-10-05', 4200, 'Dinner'), tx('2026-10-06', 800, 'Wants'), tx('2026-10-07', 1500, 'Groceries', 'HDFC'), tx('2026-10-08', 99, 'Groceries', 'UPI', '2026-10-08T11:00:00Z')];
    });
    const m = monthSummary(d, '2026-10', '2026-10-20');
    const rent = m.committed.find((c) => c.category === 'Rent')!;
    expect([rent.planned, rent.logged, rent.counted]).toEqual([rupees(20000), rupees(20000), rupees(20000)]);
    const dinner = m.committed.find((c) => c.category === 'Dinner')!;
    expect(dinner.counted).toBe(rupees(4200)); // over the ₹3,500 plan
    expect(m.budgets.find((b) => b.category === 'Wants')).toMatchObject({ logged: rupees(800), remaining: rupees(200) });
    expect(m.everyday).toMatchObject({ logged: rupees(1500), counted: rupees(10000) }); // current month: expect the cap
    expect(m.loggedTotal).toBe(rupees(26500)); // deleted one ignored
    // Still to pay: gold 10,000 + SIP 3,000 (Bills) + protein 2,500 + insurance 3,170.
    expect(m.stillToPay).toBe(rupees(18670));
    expect(m.available).toBe(rupees(62000 - 26500 - 18670));
    // Wants 200 + Unplanned 1,000 + everyday 10,000 − 1,500.
    expect(m.leftInBudgets).toBe(rupees(9700));
    expect(m.final).toBe(false);
    // Projected: committed (42,170 + 700 dinner over) + budgets 2,000 + cap 10,000.
    expect(m.savings).toBe(rupees(62000 - 42870 - 2000 - 10000));
  });

  it('a finished month counts what really happened: unspent budgets stay saved', () => {
    const d = doc((x) => {
      x.transactions = [tx('2026-10-06', 300, 'Wants'), tx('2026-10-07', 6000, 'Groceries', 'HDFC')];
    });
    const m = monthSummary(d, '2026-10', '2026-11-05');
    expect(m.final).toBe(true);
    // 62,000 − committed 42,170 − wants 300 − everyday 6,000
    expect(m.savings).toBe(rupees(13530));
  });
});

describe('savings waterfall', () => {
  it('fills goals strictly in order; the top-up is only the extra ₹70,000', () => {
    const goals = doc().settings.goals;
    const a = allocate(goals, rupees(150000));
    expect(a.map((x) => x.saved)).toEqual([rupees(30000), rupees(100000), rupees(20000), 0, 0]);
    expect(allocate(goals, rupees(-500)).every((x) => x.saved === 0)).toBe(true);
    expect(goals.reduce((s, g) => s + g.target, 0)).toBe(rupees(634000));
  });

  it('actual pot = saved before + finished months; ETAs follow the plan (gym dips, gold ending)', () => {
    const d = doc((x) => {
      x.settings.goals[0].savedAtStart = rupees(30000); // starter fund already done
      x.transactions = [tx('2026-10-10', 2000, 'Groceries', 'HDFC')];
    });
    const st = savingsState(d, '2026-11-02');
    expect(st.months).toEqual([{ month: '2026-10', savings: rupees(62000 - 42170 - 0 - 2000) }]);
    expect(st.actualTotal).toBe(rupees(30000 + 17830));
    expect(st.goals[0]).toMatchObject({ done: true, percent: 100 });
    expect(st.goals[1]).toMatchObject({ saved: rupees(17830), done: false });
    expect(st.goals[1].eta).toMatch(/^202[78]-\d\d$/);
    // Every later goal finishes no earlier than the one before it.
    const etas = st.goals.map((g) => g.eta ?? '9999');
    expect([...etas].sort()).toEqual(etas);
    expect(st.allDoneBy).toBe(st.goals[4].eta);
  });
});

describe('cards', () => {
  const withDays = (d: FinanceDoc) => {
    d.settings.cards[0].statementDay = 15;
    d.settings.cards[0].dueDay = 5;
  };
  it('cycles run statement to statement; the bill is due on the next due day', () => {
    const card = doc(withDays).settings.cards[0];
    expect(cardCycles(card, '2026-10-20')).toEqual({ current: { start: '2026-10-16', end: '2026-11-15' }, previous: { start: '2026-09-16', end: '2026-10-15' } });
    expect(cardCycles(card, '2026-10-15').current).toEqual({ start: '2026-09-16', end: '2026-10-15' });
    expect(dueDateAfter(card, '2026-10-15')).toBe('2026-11-05');
    expect(dueDateAfter({ ...card, dueDay: 25 }, '2026-10-15')).toBe('2026-10-25');
  });

  it('utilisation warns at 80% and flags over the limit; the closed bill is outstanding until due', () => {
    const d = doc((x) => {
      withDays(x);
      x.transactions = [tx('2026-10-10', 2000, 'Groceries', 'HDFC'), tx('2026-10-18', 5000, 'Groceries', 'HDFC'), tx('2026-10-19', 300, 'Fuel', 'ICICI')];
    });
    const hdfc = cardStatus(d, d.settings.cards[0], '2026-10-20');
    expect(hdfc).toMatchObject({ spent: rupees(5000), available: rupees(1000), level: 'warn', outstanding: rupees(7000) });
    expect(hdfc.lastBill).toMatchObject({ amount: rupees(2000), dueDate: '2026-11-05', paid: false });
    const after = cardStatus(d, d.settings.cards[0], '2026-11-06');
    // After the due date the closed bill counts as paid (in full, from salary); only the open cycle is owed.
    expect(after.lastBill).toMatchObject({ amount: rupees(2000), paid: true });
    expect(after.outstanding).toBe(rupees(5000));
    const over = cardStatus({ ...d, transactions: [...d.transactions, tx('2026-10-19', 1500, 'Groceries', 'HDFC')] }, d.settings.cards[0], '2026-10-20');
    expect(over.level).toBe('over');
    // ICICI has no statement day yet: calendar month, flagged as assumed.
    expect(cardStatus(d, d.settings.cards[1], '2026-10-20')).toMatchObject({ assumedCycle: true, spent: rupees(300) });
    expect(combinedCap(d, '2026-10-20')).toEqual({ spent: rupees(7300), cap: rupees(10000), level: 'ok' });
  });

  it('a card purchase and its bill are not two expenses', () => {
    const d = doc((x) => {
      withDays(x);
      x.transactions = [tx('2026-10-10', 2000, 'Groceries', 'HDFC')];
    });
    // Spending counts the purchase once; the bill appears only as an upcoming payment.
    expect(monthSummary(d, '2026-10', '2026-10-20').loggedTotal).toBe(rupees(2000));
    const bills = upcoming(d, '2026-10-20').filter((u) => u.kind === 'card');
    expect(bills).toEqual([expect.objectContaining({ amount: rupees(2000), date: '2026-11-05' })]);
  });
});
