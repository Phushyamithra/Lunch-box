import { describe, expect, it } from 'vitest';
import { emptyDoc, newTransaction } from '../finance/model';
import type { FitnessData } from '../fitness/fitnessApi';
import { dropExamples, missingColumn, planFinance, planMeasurements, planWorkouts, readDate, tableToCsv } from './templates';

describe('readDate', () => {
  it('reads the shapes spreadsheets save', () => {
    expect(readDate('2026-10-05')).toBe('2026-10-05');
    expect(readDate('05/10/2026')).toBe('2026-10-05');
    expect(readDate('5-10-2026')).toBe('2026-10-05');
    expect(readDate('5 Oct 2026')).toBe('2026-10-05');
    expect(readDate('05-Oct-2026')).toBe('2026-10-05');
    expect(readDate('46000')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('refuses what isn’t a real date', () => {
    expect(readDate('31/02/2026')).toBeNull();
    expect(readDate('yesterday')).toBeNull();
  });
});

describe('planFinance', () => {
  const doc = emptyDoc('2026-10-01');
  const { methods, categories } = doc.settings;
  const head = ['date', 'amount', 'category', 'method', 'note', 'one_off'];

  it('reads rows, ignoring the example', () => {
    const p = planFinance(
      [head, ['2026-10-01', '250', categories[0], methods[0], 'EXAMPLE delete this row', ''], ['2026-10-02', '₹1,250.50', categories[0], methods[0].toLowerCase(), 'Lunch', 'yes']],
      doc,
    );
    expect(p.errors).toEqual([]);
    expect(p.transactions).toHaveLength(1);
    expect(p.transactions[0]).toMatchObject({ date: '2026-10-02', amount: 125050, method: methods[0], note: 'Lunch', oneOff: true });
  });

  it('names the row and the allowed methods when one is wrong', () => {
    const p = planFinance([head, ['2026-10-02', '100', categories[0], 'Barter', '', '']], doc);
    expect(p.errors[0].where).toBe('Row 2');
    expect(p.errors[0].message).toContain(methods[0]);
  });

  it('skips what is already recorded, matching each existing row once', () => {
    const had = newTransaction({ date: '2026-10-02', amount: 10000, category: categories[0], method: methods[0], note: null });
    const row = ['2026-10-02', '100', categories[0], methods[0], '', ''];
    const p = planFinance([head, row, row], { ...doc, transactions: [had] });
    expect(p.duplicates).toBe(1);
    expect(p.transactions).toHaveLength(1);
  });
});

describe('planMeasurements', () => {
  const none = { weighIns: [], waists: [], steps: [] };
  const head = ['date', 'weight_kg', 'time_of_day', 'waist_cm', 'steps', 'note'];

  it('splits one row into what it fills in', () => {
    const p = planMeasurements([head, ['2026-10-02', '72.4', '', '84', '9000', '']], none);
    expect(p.weighIns[0]).toMatchObject({ day: '2026-10-02', weight_kg: 72.4, time_of_day: 'morning' });
    expect(p.waists[0].waist_cm).toBe(84);
    expect(p.steps[0].steps).toBe(9000);
  });

  it('keeps the good parts of a row with one bad value', () => {
    const p = planMeasurements([head, ['2026-10-02', '7', '', '84', '', '']], none);
    expect(p.errors).toHaveLength(1);
    expect(p.waists).toHaveLength(1);
  });

  it('never replaces a day’s steps', () => {
    const p = planMeasurements([head, ['2026-10-02', '', '', '', '500', '']], { ...none, steps: [{ id: 's', day: '2026-10-02', steps: 9000, source: 'manual' }] });
    expect(p.steps).toEqual([]);
    expect(p.duplicates).toBe(1);
  });
});

describe('planWorkouts', () => {
  const head = ['date', 'exercise', 'set', 'weight_kg', 'reps'];
  const data = { sessions: [] as FitnessData['sessions'], sets: [] as FitnessData['sets'] };

  it('groups by day, numbers missing sets and gives each exercise a slot', () => {
    const p = planWorkouts([head, ['2026-10-02', 'Bench Press', '', '60', '8'], ['2026-10-02', 'bench press', '', '60', '7'], ['2026-10-02', 'Row', '1', '50', '10']], data);
    expect(p.days).toHaveLength(1);
    expect(p.days[0].sessionId).toBeNull();
    expect(p.days[0].sets.map((s) => [s.slot, s.set_number])).toEqual([[21, 1], [21, 2], [22, 1]]);
  });

  it('joins an existing session and skips sets it already has', () => {
    const session = { id: 'x', day: '2026-10-02' } as FitnessData['sessions'][number];
    const set = { id: 'y', session_id: 'x', slot: 2, exercise: 'Bench Press', set_number: 1, reps: 8, weight_kg: 60, notes: null } as FitnessData['sets'][number];
    const p = planWorkouts([head, ['2026-10-02', 'Bench Press', '1', '60', '8'], ['2026-10-02', 'Bench Press', '2', '60', '7']], { sessions: [session], sets: [set] });
    expect(p.duplicates).toBe(1);
    expect(p.days[0]).toMatchObject({ sessionId: 'x', sets: [{ slot: 2, set_number: 2 }] });
  });
});

describe('table helpers', () => {
  it('finds a missing column', () => {
    expect(missingColumn([['date', 'amount']], ['date', 'method'])).toBe('method');
    expect(missingColumn([['Date']], ['date'])).toBeNull();
  });
  it('drops examples and writes CSV back', () => {
    const csv = tableToCsv(dropExamples([['a', 'b'], ['EXAMPLE', '1'], ['x', '2']]));
    expect(csv).toContain('x,2');
    expect(csv).not.toContain('EXAMPLE');
  });
});
