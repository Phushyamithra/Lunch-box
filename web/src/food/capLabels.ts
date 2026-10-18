import type { CapStatus, ItemUsage } from './plans';

/** Short, plain-language label for an item's cap state. */
export function capLabel(usage: ItemUsage): string {
  const labels: Record<CapStatus, string> = {
    uncapped: `${usage.used} used · no cap`,
    ok: `${usage.remaining} left`,
    last: '1 left',
    reached: 'Cap reached',
    over: `Over cap · ${usage.overrides} override${usage.overrides === 1 ? '' : 's'}`,
  };
  return labels[usage.status];
}

export function capColor(status: CapStatus): 'default' | 'success' | 'warning' | 'error' {
  if (status === 'over') return 'error';
  if (status === 'reached' || status === 'last') return 'warning';
  if (status === 'ok') return 'success';
  return 'default';
}
