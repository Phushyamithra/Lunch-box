import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../../../src/constants';
import type { LunchBoxBackup } from '../../../src/core/backupFormat';
import { planImport } from './importPlan';

const nutrition = { calories: 400, protein: 20, carbs: 40, fiber: 5, fat: 10 };

function backup(data: Record<string, unknown>): LunchBoxBackup {
  return { format: 'lunchbox-backup', schemaVersion: 1, appVersion: '1.4.0', exportedAt: '2026-10-18T09:00:00.000Z', data };
}

const base = {
  [STORAGE_KEYS.categories]: [
    { id: 'cat_s', name: 'Sandwich', icon: '🥪', color: '#F59E0B', order: 0, enabled: true },
    { id: 'cat_x', name: 'Smoothie', icon: '🥤', color: '#EC4899', order: 1, enabled: false },
  ],
  [STORAGE_KEYS.meals]: [
    { id: 'm_paneer', name: 'Paneer Sandwich', category: 'Sandwich', nutrition, icon: '🥪' },
    { id: 'm_greek', name: 'Greek Salad', category: 'Salad', nutrition: { calories: -1, protein: 'x' } },
  ],
  [STORAGE_KEYS.logs]: {
    'me@example.com': {
      '2026-10-01': [
        { id: 'log_1', email: 'me@example.com', date: '2026-10-01', mealId: 'm_paneer', loggedAt: '2026-10-01T07:00:00.000Z' },
        { id: 'log_2', email: 'me@example.com', date: '2026-10-01', mealId: 'm_greek', loggedAt: 'garbage' },
      ],
      // Legacy single-object day (pre-1.3 shape).
      '2026-09-30': { email: 'me@example.com', date: '2026-09-30', mealId: 'm_paneer', loggedAt: '2026-09-30T07:00:00.000Z' },
    },
  },
  [STORAGE_KEYS.syncTasks]: { 'me@example.com': { log_1: 'task-abc' } },
  [STORAGE_KEYS.goals]: { totalDays: 30, categoryTargets: { Sandwich: 15 } },
  [STORAGE_KEYS.achievements]: { 'me@example.com': { days_goal: '2026-10-01T00:00:00.000Z' } },
};

describe('planImport', () => {
  it('keeps every category, meal and log, including the legacy day shape', () => {
    const plan = planImport(backup(base));
    expect(plan.categories.map((c) => [c.name, c.enabled])).toEqual([
      ['Sandwich', true],
      ['Smoothie', false],
      ['Salad', true], // referenced by a meal but missing from the category list
    ]);
    expect(plan.meals.map((m) => m.legacyId)).toEqual(['m_paneer', 'm_greek']);
    expect(plan.logs.map((l) => [l.legacyId, l.logDate])).toEqual([
      ['me@example.com:2026-09-30', '2026-09-30'],
      ['me@example.com:log_1', '2026-10-01'],
      ['me@example.com:log_2', '2026-10-01'],
    ]);
  });

  it('sanitizes nutrition, repairs bad timestamps, and keeps Google Task ids', () => {
    const plan = planImport(backup(base));
    expect(plan.meals[1].nutrition).toEqual({ calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 });
    const log2 = plan.logs.find((l) => l.legacyId.endsWith('log_2'));
    expect(log2?.loggedAt).toBe('2026-10-01T12:00:00.000Z');
    expect(plan.logs.find((l) => l.legacyId.endsWith('log_1'))?.externalTaskId).toBe('task-abc');
  });

  it('keeps logs whose meal was deleted, under an archived placeholder', () => {
    const data = {
      ...base,
      [STORAGE_KEYS.logs]: {
        'me@example.com': { '2026-10-02': [{ id: 'l9', date: '2026-10-02', mealId: 'm_gone', loggedAt: '2026-10-02T07:00:00Z' }] },
      },
    };
    const plan = planImport(backup(data));
    const placeholder = plan.meals.find((m) => m.legacyId === 'm_gone');
    expect(placeholder).toMatchObject({ name: 'Deleted meal', archived: true });
    expect(plan.logs).toHaveLength(1);
    expect(plan.warnings.some((w) => w.includes('Deleted meal'))).toBe(true);
  });

  it('reports invalid records instead of silently dropping them', () => {
    const data = {
      [STORAGE_KEYS.meals]: [{ id: 'm1', name: '', category: 'X' }],
      [STORAGE_KEYS.logs]: { 'me@example.com': { 'not-a-date': [{ id: 'a', mealId: 'm1' }] } },
    };
    const plan = planImport(backup(data));
    expect(plan.meals).toEqual([]);
    expect(plan.logs).toEqual([]);
    expect(plan.warnings).toHaveLength(2);
  });

  it('dedupes categories by name and merges achievements across accounts (earliest wins)', () => {
    const data = {
      [STORAGE_KEYS.categories]: [
        { id: 'a', name: 'Salad' },
        { id: 'b', name: 'salad' },
      ],
      [STORAGE_KEYS.achievements]: {
        'a@x.com': { days_goal: '2026-10-05T00:00:00Z' },
        'b@x.com': { days_goal: '2026-10-01T00:00:00Z', balance: '2026-10-02T00:00:00Z' },
      },
      [STORAGE_KEYS.logs]: { 'a@x.com': {}, 'b@x.com': {} },
    };
    const plan = planImport(backup(data));
    expect(plan.categories).toHaveLength(1);
    expect(plan.achievements).toEqual({ days_goal: '2026-10-01T00:00:00Z', balance: '2026-10-02T00:00:00Z' });
    expect(plan.warnings.some((w) => w.includes('2 extension accounts'))).toBe(true);
  });

  it('is deterministic, so re-running produces the same legacy ids', () => {
    expect(planImport(backup(base))).toEqual(planImport(backup(base)));
  });
});
