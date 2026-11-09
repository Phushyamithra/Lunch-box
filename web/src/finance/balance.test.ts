import { describe, expect, it } from 'vitest';
import { balanceEntries, clearedDoc, simpleBalance } from './balance';
import { emptyDoc, rupees, type MoneyEvent, type Transaction } from './model';
import { monthSummary } from './engine';
import { replaceDoc } from './vault';

const stamp = '2026-11-01T00:00:00Z';
const tx = (date: string, amount: number, method = 'UPI'): Transaction => ({ id: `${date}-${amount}-${method}`, date, amount: rupees(amount), category: 'Dinner', method, note: null, createdAt: stamp, updatedAt: stamp, deletedAt: null });
const money = (kind: MoneyEvent['kind'], amount: number, date: string): MoneyEvent => ({ id: `${kind}-${date}`, date, kind, amount: rupees(amount), description: kind, status: 'settled', settledOn: date, account: 'bank', cardMethod: null, updatedAt: stamp, deletedAt: null });

describe('simple balance', () => {
  it('starts at zero', () => {
    expect(simpleBalance(emptyDoc('2026-11-01', stamp), '2026-11-07')).toMatchObject({ balance: 0, moneyIn: 0, moneyOut: 0, onCards: 0 });
  });

  it('adds money in and subtracts bank payments; card spends wait for the bill; Amazon Pay is not cash', () => {
    const d = emptyDoc('2026-11-01', stamp);
    d.salaries = [{ id: 's', month: '2026-10', date: '2026-10-30', amount: rupees(61908), note: null, updatedAt: stamp, deletedAt: null }];
    d.events = [money('refund', 1500, '2026-11-04')];
    d.transactions = [tx('2026-11-01', 20105.3), tx('2026-11-02', 321, 'HDFC'), tx('2026-11-02', 212, 'ICICI'), tx('2026-11-03', 500, 'Amazon Pay'), { ...tx('2026-11-03', 99), deletedAt: stamp }];
    const b = simpleBalance(d, '2026-11-07');
    expect(b).toMatchObject({ balance: rupees(61908 + 1500 - 20105.3), moneyIn: rupees(63408), moneyOut: rupees(20105.3), onCards: rupees(533) });
    expect(b.cards.map((c) => [c.method, c.owed])).toEqual([['HDFC', rupees(321)], ['ICICI', rupees(212)]]);
    // Each bank payment moves it the moment it's logged; a card spend doesn't.
    d.transactions.push(tx('2026-11-07', 250), tx('2026-11-07', 100, 'HDFC'));
    expect(simpleBalance(d, '2026-11-07').balance).toBe(rupees(61908 + 1500 - 20105.3 - 250));
    // Paying the HDFC bill takes it out of the bank once and clears what's owed on HDFC.
    d.events.push({ ...money('expense', 421, '2026-11-08'), id: 'bill', cardBill: 'HDFC', description: 'HDFC bill' });
    const after = simpleBalance(d, '2026-11-08');
    expect(after.balance).toBe(rupees(61908 + 1500 - 20105.3 - 250 - 421));
    expect(after.cards.find((c) => c.method === 'HDFC')?.owed).toBe(0);
    expect(balanceEntries(d, '2026-11-08').map((e) => e.amount)).toEqual([rupees(61908), rupees(-20105.3), rupees(1500), rupees(-250), rupees(-421)]);
  });

  it('a card bill payment is never spending in the month', () => {
    const d = emptyDoc('2026-11-01', stamp);
    d.settings.startMonth = '2026-11';
    d.events = [{ ...money('expense', 421, '2026-11-08'), cardBill: 'HDFC' }];
    expect(monthSummary(d, '2026-11', '2026-11-09')).toMatchObject({ eventsOut: 0 });
  });

  it('clearing removes every record on every device and keeps the plan', () => {
    const d = emptyDoc('2026-11-01', stamp);
    d.transactions = [tx('2026-11-01', 100)];
    d.vouchers = [{ id: 'v', date: '2026-11-05', kind: 'adjust', amount: rupees(3290.34), expiresOn: null, note: null, updatedAt: stamp, deletedAt: null }];
    d.settings.openingBalance = rupees(62711.05);
    const out = replaceDoc(d, clearedDoc(d), '2026-11-07T10:00:00Z');
    expect(out.transactions.every((t) => t.deletedAt)).toBe(true);
    expect(out.vouchers.every((v) => v.deletedAt)).toBe(true);
    expect(out.settings.openingBalance).toBe(0);
    expect(out.settings.salary).toBe(d.settings.salary);
    expect(simpleBalance(out, '2026-11-07').balance).toBe(0);
  });
});
