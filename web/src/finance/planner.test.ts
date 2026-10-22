import { describe, expect, it } from 'vitest';
import { cardStatus, combinedCap, monthSummary } from './engine';
import { awaitedBonuses, pendingCash } from './extras';
import { emptyDoc, parseFinanceDoc, rupees, type FinanceDoc, type IncomeSource, type MoneyEvent, type Transaction } from './model';
import { cashOut, checkTransfer, peakMonths, reminders, salaryDayPlan, sinkingFunds, weeklyCap } from './planner';
import { projection } from './projection';

let n = 0;
const stamp = '2026-10-01T00:00:00Z';
const tx = (date: string, amount: number, category: string, method = 'UPI', extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${++n}`,
  date,
  amount: rupees(amount),
  category,
  method,
  note: null,
  createdAt: `${date}T10:00:00Z`,
  updatedAt: stamp,
  deletedAt: null,
  ...extra,
});
const income = (over: Partial<IncomeSource>): IncomeSource => ({
  id: `i${++n}`,
  name: 'Freelance',
  amount: rupees(5000),
  cadence: 'monthly',
  month: '2026-10',
  until: null,
  reliability: 'reliable',
  certainty: 'confirmed',
  receivedOn: null,
  receivedAmount: null,
  updatedAt: stamp,
  deletedAt: null,
  ...over,
});
const doc = (over: (d: FinanceDoc) => void = () => undefined): FinanceDoc => {
  const d = emptyDoc('2026-10-22', stamp);
  d.settings.startMonth = '2026-10';
  d.settings.cards[0].statementDay = 15;
  d.settings.cards[0].dueDay = 5;
  over(d);
  return d;
};
const TODAY = '2026-10-22';

describe('yearly bills and peak months', () => {
  it('monthly set-aside per bill, and what should be put by now', () => {
    const f = sinkingFunds(doc().settings, TODAY);
    expect(f.map((x) => [x.name, x.monthly / 100, x.nextDue, x.monthsToGo, x.shouldHave / 100])).toEqual([
      ['Insurance', 1057, '2026-10', 0, 3170],
      ['Gym', 1479, '2026-12', 2, 14790],
    ]);
  });
  it('flags the heavy months (insurance quarters, December gym)', () => {
    const p = peakMonths(doc().settings, TODAY);
    expect(p.filter((m) => m.peak).map((m) => [m.month, m.extras])).toEqual([
      ['2026-10', ['Insurance']],
      ['2026-12', ['Gym']],
      ['2027-01', ['Insurance']],
      ['2027-04', ['Insurance']],
      ['2027-07', ['Insurance']],
    ]);
    expect(p.find((m) => m.month === '2027-09')).toMatchObject({ committed: rupees(29000), peak: false }); // gold over
  });
});

describe('salary-day transfer', () => {
  it('the 31 Oct salary covers November; the rest is safe to move', () => {
    const p = salaryDayPlan(doc(), TODAY);
    expect(p).toMatchObject({ date: '2026-10-31', covers: '2026-11', salary: rupees(62000), safe: rupees(11000), shortfall: 0 });
    expect(p.bills.total).toBe(rupees(39000 + 2000 + 10000));
    expect(checkTransfer(p, rupees(10000))).toEqual({ ok: true, uncovered: 0 });
    expect(checkTransfer(p, rupees(15000))).toEqual({ ok: false, uncovered: rupees(4000) });
  });
  it('a big card month raises next month’s bill', () => {
    const p = salaryDayPlan(doc((x) => (x.transactions = [tx('2026-10-05', 14000, 'Groceries', 'HDFC')])), TODAY);
    expect(p.safe).toBe(rupees(7000));
  });
  it('reliable other income helps; bonuses don’t until received', () => {
    const d = doc((x) => (x.incomes = [income({}), income({ name: 'Diwali bonus', reliability: 'bonus', cadence: 'once', month: '2026-11', amount: rupees(20000), certainty: 'estimated' })]));
    expect(salaryDayPlan(d, TODAY).safe).toBe(rupees(16000));
    expect(awaitedBonuses(d).map((b) => b.name)).toEqual(['Diwali bonus']);
  });
});

describe('card-free mode', () => {
  const free = (from: string) => doc((x) => (x.settings.cardFree = { from, weeklyCap: rupees(2500) }));
  it('the switch month pays twice once; later months pay the same month', () => {
    const nov = cashOut(free('2026-11'), '2026-11', TODAY);
    expect(nov.doublePayment).toBe(rupees(10000));
    expect(nov.total).toBe(rupees(39000 + 2000 + 10000 + 10000));
    expect(salaryDayPlan(free('2026-11'), TODAY)).toMatchObject({ safe: rupees(1000), shortfall: 0 });
    // December: gym + same-month spending, no card bill.
    const dec = cashOut(free('2026-11'), '2026-12', TODAY);
    expect(dec).toMatchObject({ doublePayment: 0, total: rupees(39000 + 17750 + 2000 + 10000) });
    expect(salaryDayPlan(free('2026-11'), '2026-11-15')).toMatchObject({ covers: '2026-12', shortfall: rupees(6750), safe: 0 });
  });
  it('shows the switch in projections without changing savings', () => {
    const rows = projection(free('2026-11'), TODAY);
    expect(rows.find((r) => r.month === '2026-11')?.notes).toContain('card-free starts: last card bill + this month in cash');
    expect(rows.find((r) => r.month === '2026-11')?.savings).toBe(projection(doc(), TODAY).find((r) => r.month === '2026-11')?.savings);
  });
  it('weekly cap counts everyday spending only', () => {
    const d = free('2026-10');
    d.transactions = [
      tx('2026-10-20', 800, 'Groceries'),
      tx('2026-10-21', 20000, 'Rent'),
      tx('2026-10-21', 300, 'Wants'),
      tx('2026-10-21', 5000, 'Travel', 'UPI', { oneOff: true }),
      tx('2026-10-22', 400, 'Pet', 'Amazon Pay'),
      tx('2026-10-18', 999, 'Fuel'), // last week
      tx('2026-10-22', 1300, 'Fuel'),
    ];
    expect(weeklyCap(d, TODAY)).toEqual({ start: '2026-10-19', end: '2026-10-25', spent: rupees(2100), cap: rupees(2500), level: 'warn' });
    expect(weeklyCap(doc(), TODAY)).toBeNull();
  });
});

describe('one-off card purchases', () => {
  it('count as spending but don’t trip limit warnings', () => {
    const d = doc((x) => (x.transactions = [tx('2026-10-17', 5500, 'Travel', 'HDFC', { oneOff: true }), tx('2026-10-18', 500, 'Groceries', 'HDFC')]));
    expect(cardStatus(d, d.settings.cards[0], TODAY)).toMatchObject({ spent: rupees(6000), oneOffSpent: rupees(5500), level: 'ok' });
    expect(combinedCap(d, TODAY).level).toBe('ok');
    const plain = doc((x) => (x.transactions = [tx('2026-10-17', 5500, 'Travel', 'HDFC'), tx('2026-10-18', 500, 'Groceries', 'HDFC')]));
    expect(cardStatus(plain, plain.settings.cards[0], TODAY).level).toBe('warn');
  });
  it('remind to verify cashback once the statement has closed', () => {
    const d = doc((x) => (x.transactions = [tx('2026-10-10', 3000, 'Travel', 'HDFC', { oneOff: true, cashbackCheck: true }), tx('2026-10-18', 2000, 'Travel', 'HDFC', { cashbackCheck: true })]));
    const r = reminders(d, TODAY);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ title: 'Check the cashback on HDFC RuPay / UPI', detail: expect.stringContaining('statement closed 2026-10-15') });
    d.transactions[0].cashbackVerified = true;
    expect(reminders(d, TODAY)).toEqual([]);
  });
});

describe('income and reimbursements', () => {
  it('reliable income counts each month; a bonus only once received', () => {
    const d = doc((x) => (x.incomes = [income({}), income({ name: 'Bonus', reliability: 'bonus', cadence: 'once', month: '2026-12', amount: rupees(20000) })]));
    expect(monthSummary(d, '2026-10', TODAY).otherIncome).toBe(rupees(5000));
    const rows = projection(d, TODAY);
    expect(rows.find((r) => r.month === '2026-11')?.savings).toBe(rupees(16000));
    expect(rows.find((r) => r.month === '2026-12')?.savings).toBe(rupees(-6750 + 5000));
    d.incomes[1].receivedOn = '2026-12-20';
    d.incomes[1].receivedAmount = rupees(18000);
    expect(monthSummary(d, '2026-12', '2027-01-05').otherIncome).toBe(rupees(23000));
  });
  it('a filed claim is still not money', () => {
    const claim: MoneyEvent = { id: 'c', date: '2026-10-10', kind: 'reimbursement', amount: rupees(2400), description: 'Office travel', status: 'filed', settledOn: null, account: 'bank', cardMethod: null, updatedAt: stamp, deletedAt: null };
    const d = doc((x) => (x.events = [claim]));
    expect(pendingCash(d).in).toBe(rupees(2400));
    expect(monthSummary(d, '2026-10', TODAY).eventsIn).toBe(0);
  });
  it('older files without incomes or lists still open', () => {
    const old = JSON.parse(JSON.stringify(doc()));
    delete old.incomes;
    delete old.lists;
    const p = parseFinanceDoc(old);
    expect('doc' in p && [p.doc.incomes, p.doc.lists]).toEqual([[], []]);
  });
});
