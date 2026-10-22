import { describe, expect, it } from 'vitest';
import { monthSummary } from './engine';
import { emptyDoc, planFor, rupees, type FinanceDoc } from './model';
import { affordability, compareScenario, currentLevers, scenarioSettings } from './scenarios';

const doc = (over: (d: FinanceDoc) => void = () => undefined): FinanceDoc => {
  const d = emptyDoc('2026-10-22', '2026-10-01T00:00:00Z');
  d.settings.startMonth = '2026-10';
  d.settings.cards[0].statementDay = 15;
  d.settings.cards[0].dueDay = 5;
  over(d);
  return d;
};
const buy = (amount: number, category: string, method = 'UPI', date = '2026-10-22') => ({ date, amount: rupees(amount), category, method, note: null });

const OCT22 = rupees(17830) - Math.round((rupees(10000) * 10) / 31 / 100) * 100;

describe('affordability', () => {
  it('within the everyday allowance: savings and goal dates unchanged', () => {
    const a = affordability(doc(), '2026-10-22', buy(1500, 'Groceries', 'HDFC'));
    expect(a).toMatchObject({ kind: 'everyday', level: 'fine', savings: { before: OCT22, after: OCT22 - rupees(1500) } });
    expect(a.card).toMatchObject({ before: 0, after: rupees(1500), billDue: '2026-12-05' }); // bought after the 15 Oct statement: on the bill closing 15 Nov, due 5 Dec
    expect(a.goals.every((g) => g.delay === 0)).toBe(true);
    expect(a.verdict.join(' ')).toMatch(/Fits in this month’s everyday allowance: ₹8,500 left/);
  });

  it('a big purchase: savings drop, goal dates move, the card limit breaks', () => {
    const a = affordability(doc(), '2026-10-22', buy(40000, 'Travel', 'HDFC'));
    expect(a.level).toBe('over');
    expect(a.verdict[0]).toMatch(/Over the HDFC RuPay \/ UPI limit by ₹34,000/);
    expect(a.savings.after).toBe(OCT22 - rupees(40000));
    expect(a.verdict.join(' ')).toMatch(/would save −₹25,396: ₹33,226 below the plan’s ₹7,830/);
    expect(a.goals[0].delay).toBeGreaterThan(0);
    expect(a.combined?.level).toBe('over');
  });

  it('a Wants purchase past its budget is a stretch, not a block', () => {
    const a = affordability(doc(), '2026-10-22', buy(1600, 'Wants'));
    expect(a).toMatchObject({ kind: 'budget', level: 'stretch', budget: { before: 0, after: rupees(1600), limit: rupees(1000) } });
    expect(a.savings.after).toBe(OCT22 - rupees(600));
  });

  it('never touches the real data', () => {
    const d = doc();
    affordability(d, '2026-10-22', buy(999, 'Pet'));
    expect(d.transactions).toEqual([]);
  });
});

describe('what-if', () => {
  it('reads the current levers', () => {
    expect(currentLevers(doc().settings, '2026-10')).toEqual({ salary: rupees(62000), combinedCardCap: rupees(10000), sip: rupees(3000), rent: rupees(20000), goldEndsOn: '2027-08' });
  });

  it('a raise brings goals forward; past months are untouched', () => {
    const d = doc((x) => (x.settings.startMonth = '2026-09'));
    const w = { ...currentLevers(d.settings, '2026-10'), salary: rupees(72000) };
    const r = compareScenario(d, '2026-10-22', w);
    expect(r.monthly).toEqual({ before: rupees(11000), after: rupees(21000) });
    expect(r.finish.change).toBeLessThan(0);
    expect(r.goals.every((g) => (g.change ?? 0) <= 0)).toBe(true);
    const s1 = scenarioSettings(d.settings, w, '2026-10');
    expect(planFor(s1, '2026-09').salary).toBe(rupees(62000));
    expect(monthSummary({ ...d, settings: s1 }, '2026-09', '2026-10-22').funding).toBe(rupees(62000));
    expect(d.settings.salary).toBe(rupees(62000)); // the real settings are unchanged
  });

  it('ending the gold scheme earlier, or a higher rent, moves dates the right way', () => {
    const d = doc();
    const base = currentLevers(d.settings, '2026-10');
    expect(compareScenario(d, '2026-10-22', { ...base, goldEndsOn: '2026-12' }).finish.change).toBeLessThan(0);
    expect(compareScenario(d, '2026-10-22', { ...base, rent: rupees(25000) }).finish.change).toBeGreaterThan(0);
    expect(compareScenario(d, '2026-10-22', base).finish.change).toBe(0);
  });
});
