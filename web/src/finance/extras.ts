/**
 * Amazon Pay vouchers and one-off events. Pure; money in paise.
 *
 * Vouchers: value on the Amazon Pay balance is NOT cash. It is never
 * counted as savings or in the bank. Spending it (transactions paid with
 * Amazon Pay) uses the earliest-expiring value first; whatever passes its
 * expiry date unused is shown as lost.
 *
 * Events (refunds, exchange amounts, cashback, other one-offs): a pending
 * event is listed and labelled but never added to any figure. Once settled
 * it counts in the month it settled: to the bank or a card as cash, to
 * Amazon Pay as voucher value.
 */
import { VOUCHER_METHOD, type FinanceDoc, type MoneyEvent, type Paise } from './model';

export const vouchersOf = (d: FinanceDoc) => (d.vouchers ?? []).filter((v) => !v.deletedAt);
export const eventsOf = (d: FinanceDoc) => (d.events ?? []).filter((e) => !e.deletedAt);
export const isInflow = (e: Pick<MoneyEvent, 'kind'>) => e.kind !== 'expense';
const signed = (e: MoneyEvent) => (isInflow(e) ? e.amount : -e.amount);
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// ---------- vouchers ----------

export interface VoucherLine {
  date: string;
  label: string;
  /** + in, − out. */
  amount: Paise;
  balance: Paise;
  kind: 'load' | 'cashback' | 'spend' | 'adjust' | 'expired';
}
export interface VoucherState {
  balance: Paise;
  /** Usable value that expires within 30 days, soonest first. */
  expiringSoon: { amount: Paise; expiresOn: string }[];
  /** Value that expired unused (lost). */
  expired: Paise;
  /** Amazon Pay spending with no voucher value left to cover it (check your logs). */
  shortfall: Paise;
  lines: VoucherLine[];
}

interface Lot {
  amount: Paise;
  expiresOn: string | null;
}

export function voucherState(doc: FinanceDoc, today: string): VoucherState {
  type Step = { date: string; order: number; label: string; amount: Paise; kind: VoucherLine['kind']; expiresOn: string | null };
  const steps: Step[] = [];
  for (const v of vouchersOf(doc)) {
    steps.push({ date: v.date, order: 0, label: v.note || (v.kind === 'load' ? 'Added to Amazon Pay' : 'Correction'), amount: v.amount, kind: v.kind === 'load' ? 'load' : 'adjust', expiresOn: v.kind === 'load' ? v.expiresOn : null });
  }
  for (const e of eventsOf(doc)) {
    if (e.status !== 'settled' || e.account !== 'voucher' || !e.settledOn) continue;
    steps.push({ date: e.settledOn, order: 0, label: e.description, amount: signed(e), kind: isInflow(e) ? 'cashback' : 'spend', expiresOn: null });
  }
  for (const t of doc.transactions) {
    if (t.deletedAt || t.method !== VOUCHER_METHOD) continue;
    steps.push({ date: t.date, order: 1, label: `${t.category}${t.note ? `: ${t.note}` : ''}`, amount: -t.amount, kind: 'spend', expiresOn: null });
  }
  steps.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);

  let lots: Lot[] = [];
  let expired = 0;
  let shortfall = 0;
  const lines: VoucherLine[] = [];
  const total = () => lots.reduce((a, l) => a + l.amount, 0);
  const expireBefore = (day: string) => {
    for (const l of lots) {
      if (l.expiresOn && l.expiresOn < day && l.amount > 0) {
        expired += l.amount;
        const amt = l.amount;
        l.amount = 0;
        lines.push({ date: addDays(l.expiresOn, 1), label: `Expired unused (valid until ${l.expiresOn})`, amount: -amt, balance: total(), kind: 'expired' });
      }
    }
    lots = lots.filter((l) => l.amount > 0);
  };
  const take = (amount: Paise) => {
    let left = amount;
    lots.sort((a, b) => (a.expiresOn ?? '9999').localeCompare(b.expiresOn ?? '9999'));
    for (const l of lots) {
      const used = Math.min(l.amount, left);
      l.amount -= used;
      left -= used;
      if (!left) break;
    }
    lots = lots.filter((l) => l.amount > 0);
    shortfall += left;
  };

  for (const s of steps) {
    expireBefore(s.date);
    if (s.amount >= 0) lots.push({ amount: s.amount, expiresOn: s.expiresOn });
    else take(-s.amount);
    lines.push({ date: s.date, label: s.label, amount: s.amount, balance: total(), kind: s.kind });
  }
  expireBefore(addDays(today, 1));
  const soon = addDays(today, 30);
  const expiringSoon = lots
    .filter((l) => l.expiresOn && l.expiresOn <= soon)
    .map((l) => ({ amount: l.amount, expiresOn: l.expiresOn as string }))
    .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));
  return { balance: total(), expiringSoon, expired, shortfall, lines: lines.sort((a, b) => a.date.localeCompare(b.date)) };
}

// ---------- events ----------

/** Settled cash events (bank or card) in a month: money in and out. */
export function settledCashIn(doc: FinanceDoc, ym: string): { in: Paise; out: Paise; list: MoneyEvent[] } {
  const list = eventsOf(doc).filter((e) => e.status === 'settled' && e.account !== 'voucher' && e.settledOn?.startsWith(ym));
  return {
    in: list.filter(isInflow).reduce((a, e) => a + e.amount, 0),
    out: list.filter((e) => !isInflow(e)).reduce((a, e) => a + e.amount, 0),
    list,
  };
}

/** Signed card credits/charges from settled events in [from, to] for a card. */
export function cardEventsBetween(doc: FinanceDoc, method: string, from: string, to: string): Paise {
  return eventsOf(doc)
    .filter((e) => e.status === 'settled' && e.account === 'card' && e.cardMethod === method && e.settledOn && e.settledOn >= from && e.settledOn <= to)
    .reduce((a, e) => a - signed(e), 0);
}

/** Settled bank events up to a date (signed). */
export function bankEventsUntil(doc: FinanceDoc, from: string, to: string): Paise {
  return eventsOf(doc)
    .filter((e) => e.status === 'settled' && e.account === 'bank' && e.settledOn && e.settledOn >= from && e.settledOn <= to)
    .reduce((a, e) => a + signed(e), 0);
}

/** Pending cash events, for clearly labelled forecasts only. */
export function pendingCash(doc: FinanceDoc): { in: Paise; out: Paise; list: MoneyEvent[] } {
  const list = eventsOf(doc).filter((e) => e.status === 'pending' && e.account !== 'voucher');
  return { in: list.filter(isInflow).reduce((a, e) => a + e.amount, 0), out: list.filter((e) => !isInflow(e)).reduce((a, e) => a + e.amount, 0), list };
}

export function validateEvent(e: Pick<MoneyEvent, 'date' | 'amount' | 'description' | 'status' | 'settledOn' | 'account' | 'cardMethod'>): string | null {
  if (!Number.isInteger(e.amount) || e.amount <= 0) return 'Enter an amount more than ₹0.';
  if (!e.description.trim()) return 'Say what it is (e.g. “Myntra return”).';
  if (e.description.length > 120) return 'Keep the description under 120 characters.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return 'Pick a date.';
  if (e.status === 'settled' && !e.settledOn) return 'Pick the date it settled.';
  if (e.settledOn && e.settledOn < e.date) return 'It can’t settle before it started.';
  if (e.account === 'card' && !e.cardMethod) return 'Pick the card.';
  return null;
}
