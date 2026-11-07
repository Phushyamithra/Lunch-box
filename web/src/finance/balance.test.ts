import { describe, expect, it } from 'vitest';
import { balanceEntries, clearedDoc, simpleBalance } from './balance';
import { emptyDoc, rupees, type MoneyEvent, type Transaction } from './model';
import { replaceDoc } from './vault';

const stamp = '2026-11-01T00:00:00Z';
const tx = (date: string, amount: number, method = 'UPI'): Transaction => ({ id: `${date}-${amount}-${method}`, date, amount: rupees(amount), category: 'Dinner', method, note: null, createdAt: stamp, updatedAt: stamp, deletedAt: null });
const money = (kind: MoneyEvent['kind'], amount: number, date: string): MoneyEvent => ({ id: `${kind}-${date}`, date, kind, amount: rupees(amount), description: kind, status: 'settled', settledOn: date, account: 'bank', cardMethod: null, updatedAt: stamp, deletedAt: null });

describe('simple balance', () => {
  it('starts at zero', () => {
    expect(simpleBalance(emptyDoc('2026-11-01', stamp), '2026-11-07')).toEqual({ balance: 0, moneyIn: 0, moneyOut: 0 });
  });

  it('adds money in and subtracts every expense, card ones included; Amazon Pay is not cash', () => {
    const d = emptyDoc('2026-11-01', stamp);
    d.salaries = [{ id: 's', month: '2026-10', date: '2026-10-30', amount: rupees(61908), note: null, updatedAt: stamp, deletedAt: null }];
    d.events = [money('refund', 1500, '2026-11-04')];
    d.transactions = [tx('2026-11-01', 20105.3), tx('2026-11-02', 321, 'HDFC'), tx('2026-11-03', 500, 'Amazon Pay'), { ...tx('2026-11-03', 99), deletedAt: stamp }];
    expect(simpleBalance(d, '2026-11-07')).toEqual({ balance: rupees(61908 + 1500 - 20105.3 - 321), moneyIn: rupees(63408), moneyOut: rupees(20426.3) });
    // Each entry moves it the moment it's logged.
    d.transactions.push(tx('2026-11-07', 250));
    expect(simpleBalance(d, '2026-11-07').balance).toBe(rupees(61908 + 1500 - 20105.3 - 321 - 250));
    expect(balanceEntries(d, '2026-11-07').map((e) => e.amount)).toEqual([rupees(61908), rupees(-20105.3), rupees(-321), rupees(1500), rupees(-250)]);
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
