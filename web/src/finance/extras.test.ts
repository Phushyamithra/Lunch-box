import { describe, expect, it } from 'vitest';
import { cardStatus, monthSummary, savingsState } from './engine';
import { pendingCash, validateEvent, voucherState } from './extras';
import { emptyDoc, parseFinanceDoc, rupees, type FinanceDoc, type MoneyEvent, type Transaction, type VoucherEntry } from './model';
import { reconcile } from './projection';
import { mergeDocs } from './vault';

let n = 0;
const stamp = '2026-10-01T00:00:00Z';
const tx = (date: string, amount: number, category: string, method = 'UPI'): Transaction => ({ id: `t${++n}`, date, amount: rupees(amount), category, method, note: null, createdAt: `${date}T10:00:00Z`, updatedAt: stamp, deletedAt: null });
const load = (date: string, amount: number, expiresOn: string | null, note: string | null = null): VoucherEntry => ({ id: `v${++n}`, date, kind: 'load', amount: rupees(amount), expiresOn, note, updatedAt: stamp, deletedAt: null });
const ev = (over: Partial<MoneyEvent>): MoneyEvent => ({
  id: `e${++n}`,
  date: '2026-10-05',
  kind: 'refund',
  amount: rupees(1200),
  description: 'Myntra return',
  status: 'pending',
  settledOn: null,
  account: 'bank',
  cardMethod: null,
  updatedAt: stamp,
  deletedAt: null,
  ...over,
});
const doc = (over: (d: FinanceDoc) => void = () => undefined): FinanceDoc => {
  const d = emptyDoc('2026-10-22', stamp);
  d.settings.startMonth = '2026-10';
  d.settings.openingBalance = rupees(80000);
  d.settings.cards[0].statementDay = 15;
  d.settings.cards[0].dueDay = 5;
  over(d);
  return d;
};

describe('Amazon Pay vouchers', () => {
  it('spends the earliest-expiring value first; unused value expires and is lost', () => {
    const d = doc((x) => {
      x.vouchers = [load('2026-09-01', 500, '2026-10-10', 'Diwali gift card'), load('2026-09-15', 1000, '2027-09-14')];
      x.transactions = [tx('2026-09-20', 300, 'Pet', 'Amazon Pay'), tx('2026-10-15', 600, 'Groceries', 'Amazon Pay')];
    });
    const v = voucherState(d, '2026-10-22');
    // 300 from the ₹500 lot (expires first); its other ₹200 expired on 10 Oct; ₹600 from the ₹1,000 lot.
    expect(v).toMatchObject({ balance: rupees(400), expired: rupees(200), shortfall: 0 });
    expect(v.lines.map((l) => [l.kind, l.amount / 100, l.balance / 100])).toEqual([
      ['load', 500, 500],
      ['load', 1000, 1500],
      ['spend', -300, 1200],
      ['expired', -200, 1000],
      ['spend', -600, 400],
    ]);
  });

  it('flags value expiring within 30 days, and spending with nothing to cover it', () => {
    const d = doc((x) => {
      x.vouchers = [load('2026-10-01', 800, '2026-11-05')];
      x.transactions = [tx('2026-10-02', 1000, 'Wants', 'Amazon Pay')];
    });
    expect(voucherState(d, '2026-10-22')).toMatchObject({ balance: 0, shortfall: rupees(200), expiringSoon: [] });
    const later = doc((x) => (x.vouchers = [load('2026-10-01', 800, '2026-11-05')]));
    expect(voucherState(later, '2026-10-22').expiringSoon).toEqual([{ amount: rupees(800), expiresOn: '2026-11-05' }]);
  });

  it('voucher value is never cash: no budget, savings or bank effect', () => {
    const base = doc();
    const withVoucher = doc((x) => {
      x.vouchers = [load('2026-10-01', 5000, null)];
      x.transactions = [tx('2026-10-10', 1500, 'Wants', 'Amazon Pay')];
    });
    const m = monthSummary(withVoucher, '2026-10', '2026-10-22');
    expect(m.voucherSpend).toBe(rupees(1500));
    expect(m.budgets.find((b) => b.category === 'Wants')?.logged).toBe(0);
    expect(m.savings).toBe(monthSummary(base, '2026-10', '2026-10-22').savings);
    expect(savingsState(withVoucher, '2026-11-02').actualTotal).toBe(savingsState(base, '2026-11-02').actualTotal);
    const r = reconcile(withVoucher, '2026-10-22', { savingsPot: 0, cardsOwed: 0 });
    expect(r.expected).toBe(rupees(80000));
  });
});

describe('one-off events', () => {
  it('pending: listed for forecasts, never counted', () => {
    const d = doc((x) => (x.events = [ev({}), ev({ kind: 'expense', amount: rupees(400), description: 'Repair deposit' })]));
    expect(pendingCash(d)).toMatchObject({ in: rupees(1200), out: rupees(400) });
    expect(monthSummary(d, '2026-10', '2026-10-22')).toMatchObject({ eventsIn: 0, eventsOut: 0, savings: rupees(7830) });
    expect(reconcile(d, '2026-10-22', { savingsPot: 0, cardsOwed: 0 }).expected).toBe(rupees(80000));
  });

  it('settled to the bank: counts in the month it settled, and in the bank', () => {
    const d = doc((x) => (x.events = [ev({ status: 'settled', settledOn: '2026-10-20' })]));
    expect(monthSummary(d, '2026-10', '2026-10-22')).toMatchObject({ eventsIn: rupees(1200), savings: rupees(7830 + 1200) });
    expect(monthSummary(d, '2026-11', '2026-11-02').eventsIn).toBe(0);
    const r = reconcile(d, '2026-10-22', { savingsPot: 0, cardsOwed: 0 });
    expect(r.expected).toBe(rupees(81200));
    expect(r.lines.some((l) => /Refunds/.test(l.label))).toBe(true);
  });

  it('a refund to a card lowers that card’s bill', () => {
    const d = doc((x) => {
      x.transactions = [tx('2026-10-17', 3000, 'Groceries', 'HDFC')];
      x.events = [ev({ status: 'settled', settledOn: '2026-10-20', account: 'card', cardMethod: 'HDFC', amount: rupees(1000) })];
    });
    expect(cardStatus(d, d.settings.cards[0], '2026-10-22').spent).toBe(rupees(2000));
  });

  it('cashback to Amazon Pay is voucher value, not cash', () => {
    const d = doc((x) => (x.events = [ev({ kind: 'cashback', status: 'settled', settledOn: '2026-10-12', account: 'voucher', amount: rupees(150), description: 'Amazon cashback' })]));
    expect(voucherState(d, '2026-10-22').balance).toBe(rupees(150));
    expect(monthSummary(d, '2026-10', '2026-10-22').eventsIn).toBe(0);
  });

  it('validates events', () => {
    const base = { date: '2026-10-05', amount: rupees(10), description: 'x', status: 'pending' as const, settledOn: null, account: 'bank' as const, cardMethod: null };
    expect(validateEvent(base)).toBeNull();
    expect(validateEvent({ ...base, status: 'settled' })).toMatch(/settled/);
    expect(validateEvent({ ...base, status: 'settled', settledOn: '2026-10-01' })).toMatch(/before/);
    expect(validateEvent({ ...base, account: 'card' })).toMatch(/card/);
  });
});

describe('older copies and merging', () => {
  it('a document from before vouchers reads fine and merges', () => {
    const old = JSON.parse(JSON.stringify(doc()));
    delete old.vouchers;
    delete old.events;
    const parsed = parseFinanceDoc(old);
    expect('doc' in parsed && parsed.doc.vouchers).toEqual([]);
    const fresh = doc((x) => (x.vouchers = [load('2026-10-01', 100, null)]));
    expect(mergeDocs(old, fresh).vouchers).toHaveLength(1);
  });
});
