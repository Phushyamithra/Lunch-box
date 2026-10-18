import { describe, expect, it } from 'vitest';
import {
  allQuotasMet,
  capFor,
  capStatus,
  checkLog,
  completionAfterChange,
  itemUsage,
  quotaProgress,
  type PlanLog,
  type PlanRow,
  type PlanState,
} from './plans';

const SANDWICH = 'cat-sandwich';
const SALAD = 'cat-salad';
const SMOOTHIE = 'cat-smoothie';
const categoryOf = (mealId: string) =>
  ({ paneer: SANDWICH, club: SANDWICH, greek: SALAD, caesar: SALAD, mango: SMOOTHIE } as Record<string, string>)[mealId];

const plan = (over: Partial<PlanRow> = {}): PlanRow => ({
  id: 'p1',
  name: 'November',
  started_on: '2026-11-01',
  default_item_cap: 4,
  completed_at: null,
  completion: null,
  created_at: '2026-11-01T00:00:00Z',
  ...over,
});

const state = (over: Partial<PlanRow> = {}): PlanState => ({
  plan: plan(over),
  quotas: [
    { id: 'q1', plan_id: 'p1', category_id: SANDWICH, quantity: 6 },
    { id: 'q2', plan_id: 'p1', category_id: SALAD, quantity: 2 },
  ],
  caps: [{ id: 'c1', plan_id: 'p1', meal_id: 'club', cap: 2 }],
});

let n = 0;
const log = (meal_id: string, extra: Partial<PlanLog> = {}): PlanLog => ({
  id: `l${(n += 1)}`,
  meal_id,
  log_date: '2026-11-05',
  kind: 'consumed',
  deleted_at: null,
  plan_id: 'p1',
  cap_override: false,
  ...extra,
});

describe('item caps', () => {
  it('uses the plan default unless the item has its own cap', () => {
    expect(capFor(state(), 'paneer')).toBe(4);
    expect(capFor(state(), 'club')).toBe(2);
    expect(capFor(state({ default_item_cap: null }), 'paneer')).toBeNull();
  });

  it('reports status as the cap fills: ok → last → reached → over', () => {
    expect(capStatus(2, 4)).toBe('ok');
    expect(capStatus(3, 4)).toBe('last');
    expect(capStatus(4, 4)).toBe('reached');
    expect(capStatus(5, 4)).toBe('over');
    expect(capStatus(9, null)).toBe('uncapped');
  });

  it('counts only live logs of this plan, and shows overrides', () => {
    const logs = [
      log('paneer'),
      log('paneer'),
      log('paneer', { deleted_at: '2026-11-05T10:00:00Z' }), // undone
      log('paneer', { plan_id: 'old-plan' }), // previous plan
      log('paneer', { plan_id: null }), // outside any plan
      log('club'),
      log('club'),
      log('club', { cap_override: true }),
    ];
    expect(itemUsage(state(), 'paneer', logs)).toMatchObject({ used: 2, cap: 4, remaining: 2, status: 'ok' });
    expect(itemUsage(state(), 'club', logs)).toMatchObject({ used: 3, cap: 2, remaining: 0, status: 'over', overrides: 1 });
  });
});

describe('checkLog', () => {
  it('allows logging within the cap and quota', () => {
    const r = checkLog(state(), 'paneer', '2026-11-05', [log('paneer')], categoryOf);
    expect(r.kind).toBe('allowed');
  });

  it('blocks the log that would exceed an item cap (no silent fifth)', () => {
    const logs = [log('paneer'), log('paneer'), log('paneer'), log('paneer')];
    const r = checkLog(state(), 'paneer', '2026-11-05', logs, categoryOf);
    expect(r).toMatchObject({ kind: 'blocked', reason: 'item_cap' });
  });

  it('blocks a category whose quota is used up, even if the item has cap left', () => {
    const logs = [log('greek'), log('caesar')];
    const r = checkLog(state(), 'greek', '2026-11-05', logs, categoryOf);
    expect(r).toMatchObject({ kind: 'blocked', reason: 'category_quota' });
  });

  it('treats meals outside the plan as unrestricted', () => {
    expect(checkLog(state(), 'mango', '2026-11-05', [], categoryOf).kind).toBe('outside'); // no smoothie quota
    expect(checkLog(state(), 'paneer', '2026-10-31', [], categoryOf).kind).toBe('outside'); // before start
    expect(checkLog(null, 'paneer', '2026-11-05', [], categoryOf).kind).toBe('outside'); // no plan
    const done = state({ completed_at: '2026-11-20T00:00:00Z', completion: 'forced' });
    expect(checkLog(done, 'paneer', '2026-11-21', [], categoryOf).kind).toBe('outside');
  });

  it('a new plan starts with fresh counts while old logs stay intact', () => {
    const oldLogs = [log('paneer'), log('paneer'), log('paneer'), log('paneer')];
    const next: PlanState = { ...state({ id: 'p2' }), quotas: [{ id: 'q9', plan_id: 'p2', category_id: SANDWICH, quantity: 6 }], caps: [] };
    expect(checkLog(next, 'paneer', '2026-11-05', oldLogs, categoryOf).kind).toBe('allowed');
    expect(oldLogs.every((l) => l.plan_id === 'p1')).toBe(true);
  });
});

describe('plan completion', () => {
  const fullLogs = [
    ...['paneer', 'paneer', 'paneer', 'club', 'club', 'paneer'].map((m) => log(m)),
    log('greek'),
    log('caesar'),
  ];

  it('completes only when every category quota is met', () => {
    const progress = quotaProgress(state(), fullLogs, categoryOf);
    expect(progress.map((q) => [q.used, q.quantity])).toEqual([
      [6, 6],
      [2, 2],
    ]);
    expect(allQuotasMet(progress)).toBe(true);
    expect(completionAfterChange(state(), fullLogs, categoryOf)).toBe('complete');
    expect(completionAfterChange(state(), fullLogs.slice(1), categoryOf)).toBe('unchanged');
  });

  it('undoing the final log reopens an automatic completion, not a forced one', () => {
    const auto = state({ completed_at: '2026-11-30T00:00:00Z', completion: 'quota_met' });
    const forced = state({ completed_at: '2026-11-30T00:00:00Z', completion: 'forced' });
    const afterUndo = fullLogs.slice(1);
    expect(completionAfterChange(auto, afterUndo, categoryOf)).toBe('reopen');
    expect(completionAfterChange(forced, afterUndo, categoryOf)).toBe('unchanged');
    expect(completionAfterChange(auto, fullLogs, categoryOf)).toBe('unchanged'); // no duplicate completion
  });

  it('a plan with no quotas never completes by itself', () => {
    expect(allQuotasMet([])).toBe(false);
  });
});
