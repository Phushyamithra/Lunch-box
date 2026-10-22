import { describe, expect, it } from 'vitest';
import { monthSummary } from './engine';
import { voucherState } from './extras';
import { applyMonthImport, guessCategory, parseAmount, parseDay, parseMonthMarkdown, type ParsedMonth } from './mdImport';
import { CATEGORIES, emptyDoc, METHODS, rupees } from './model';

// A made-up month in the same layout as the real summaries.
const SAMPLE = `---
title: March 2027 Budget Import
month: 2027-03
generated: 2027-03-20
currency: INR
---

# March 2027

## Balances (as of Mar 20)

| Account | Balance (₹) | Purpose |
|---|---|---|
| Main | 3,000.50 | Rest of month |
| Savings | 1,000 | Cushion |
| **Total** | **4,000.50** | |

Opening balance Mar 1: 50,000

## Fixed and recurring

| Item | ₹ | Notes |
|---|---|---|
| Rent | 20,000 | |
| SIP | 3,000 | |
| HDFC card bill (old cycle) | 4,321 | Paid in March |

## Logged purchases and expenses

| Item | ₹ | Category | Paid via | Notes |
|---|---|---|---|---|
| Running socks | 499 | Wants | UPI | |
| Jacket | 2,000 | Wants | – | Returned, refund received, net 0 |
| Oats | 300 | Needs | ICICI | |
| Phone recharge | 299 | Needs | Amazon Pay balance | Reimbursement pending |
| Domain renewal (annual) | 1,200 | Yearly bill | ICICI | One-off, cashback to verify |
| Cab home | 180 | Unplanned | UPI | Trip |
| Weekend reserve | ~500 | Unplanned | Cash | Reserved, not yet spent |

## Credit card cycle (ICICI, current)

| Item | ₹ |
|---|---|
| Oats | 300 |

## Income

| Source | ₹ | Tag | Status |
|---|---|---|---|
| Salary (credited Mar 31) | 62,000 | Reliable | Pending |
| Gift voucher | 1,000 | Not cash | Received Mar 5 |
| Side gig | 2,500 | Bonus-only | Received |
| Year-end bonus | ~40,000 | Bonus-only | Estimated |
| December bonus | ~62,000 | Bonus-only | Estimated, in-hand unconfirmed |

## Amazon Pay voucher

- Received: 1,000 (Mar 5), expires about Jun 2027
- Spent: 299

## Pending reimbursements

- [ ] Phone recharge 299, file claim with office (Pending)

## Month result

- Net savings about 0

## Open checklist

- [ ] Renew bike insurance
- [x] Cancel unused subscription
`;

const opts = { categories: [...CATEGORIES], methods: [...METHODS] };
const parse = () => parseMonthMarkdown(SAMPLE, opts) as ParsedMonth;

describe('helpers', () => {
  it('amounts and dates', () => {
    expect(parseAmount('2,013.05')).toEqual({ paise: 201305, approx: false });
    expect(parseAmount('~600').approx).toBe(true);
    expect(parseAmount('~2,000-3,000')).toEqual({ paise: 200000, approx: true });
    expect(parseAmount('–').paise).toBeNull();
    expect(parseDay('Received Oct 16', '2026-10')).toBe('2026-10-16');
    expect(parseDay('as of Mar 20', '2027-03')).toBe('2027-03-20');
  });
  it('categories: kept when known, guessed otherwise', () => {
    expect(guessCategory('Wants', 'socks', opts.categories)).toEqual({ category: 'Wants', guessed: false });
    expect(guessCategory('Needs', 'Oats (2 x 1 kg)', opts.categories)).toEqual({ category: 'Groceries', guessed: true });
    expect(guessCategory('Needs', 'Chemist, minor injury', opts.categories).category).toBe('Health');
    expect(guessCategory('Yearly bill', 'Home internet', opts.categories).category).toBe('Other'); // not Bills: that's gold + SIP
    expect(guessCategory('Needs', 'Inners', opts.categories).category).toBe('Other');
  });
});

describe('parsing a month', () => {
  it('needs the month in the front matter', () => {
    expect(parseMonthMarkdown('# hi', opts)).toEqual({ error: expect.stringContaining('month: 2026-10') });
  });

  it('reads each section into proposed records, with sensible defaults', () => {
    const p = parse();
    expect(p).toMatchObject({ month: '2027-03', generated: '2027-03-20', skippedSections: ['Credit card cycle (ICICI, current)', 'Month result'] });
    const by = (label: string) => p.items.find((i) => i.label.startsWith(label))!;
    expect(by('Bank balance on 2027-03-20')).toMatchObject({ kind: 'balance', amount: 400050, include: true });
    expect(by('Opening balance')).toMatchObject({ kind: 'opening', amount: rupees(50000) });
    expect(by('Rent')).toMatchObject({ kind: 'transaction', category: 'Rent', method: 'UPI', date: '2027-03-01', include: true });
    expect(by('HDFC card bill')).toMatchObject({ kind: 'event', amount: 432100, include: true });
    expect(by('Jacket')).toMatchObject({ include: false, note: expect.stringContaining('net 0') });
    expect(by('Weekend reserve')).toMatchObject({ include: false, method: 'Cash' });
    expect(by('Oats')).toMatchObject({ category: 'Groceries', method: 'ICICI', include: true });
    expect(by('Phone recharge')).toMatchObject({ kind: 'transaction', method: 'Amazon Pay', category: 'Other' });
    expect(by('Domain renewal')).toMatchObject({ category: 'Other', note: expect.stringContaining('Periodic costs') });
    expect(by('Domain renewal').record).toMatchObject({ oneOff: true, cashbackCheck: true });
    expect(by('Salary')).toMatchObject({ include: false });
    expect(by('Side gig').record).toMatchObject({ reliability: 'bonus', receivedOn: '2027-03-20', certainty: 'confirmed' });
    expect(by('Year-end bonus').record).toMatchObject({ reliability: 'bonus', receivedOn: null, certainty: 'estimated', month: '2027-03' });
    expect(by('December bonus').record).toMatchObject({ month: '2027-12', certainty: 'estimated' });
    expect(by('Amazon Pay value received 2027-03-05')).toMatchObject({ kind: 'voucher', amount: rupees(1000), record: { expiresOn: '2027-06-01' } });
    expect(by('Phone recharge: reimbursement')).toMatchObject({ kind: 'event', record: { kind: 'reimbursement', status: 'pending' } });
    expect(p.items.filter((i) => i.kind === 'task').map((i) => [i.label, i.record.status])).toEqual([
      ['Renew bike insurance', 'open'],
      ['Cancel unused subscription', 'done'],
    ]);
  });
});

describe('applying', () => {
  it('adds what was ticked; importing again adds nothing', () => {
    const p = parse();
    const doc = emptyDoc('2027-03-20', '2027-03-01T00:00:00Z');
    const chosen = p.items.filter((i) => i.include);
    const once = applyMonthImport(doc, p, chosen, '2027-03-15', '2027-03-20T10:00:00Z');
    expect(once.doc.settings).toMatchObject({ openingBalance: rupees(50000), startMonth: '2027-03' });
    expect(once.doc.transactions.map((t) => [t.category, t.amount / 100, t.date])).toEqual([
      ['Rent', 20000, '2027-03-01'],
      ['Bills', 3000, '2027-03-01'],
      ['Wants', 499, '2027-03-15'],
      ['Groceries', 300, '2027-03-15'],
      ['Other', 299, '2027-03-15'],
      ['Other', 1200, '2027-03-15'],
      ['Unplanned', 180, '2027-03-15'],
    ]);
    const twice = applyMonthImport(once.doc, p, chosen, '2027-03-15');
    expect(twice.added).toBe(1); // only the opening-balance setting re-applies
    expect(twice.doc.transactions).toHaveLength(7);
  });

  it('the figures follow: voucher not cash, old bill out, bonus in, reimbursement pending', () => {
    const p = parse();
    const { doc } = applyMonthImport(emptyDoc('2027-03-20'), p, p.items.filter((i) => i.include), '2027-03-15');
    expect(voucherState(doc, '2027-03-20').balance).toBe(rupees(1000 - 299));
    const m = monthSummary(doc, '2027-03', '2027-03-20');
    expect(m).toMatchObject({ voucherSpend: rupees(299), eventsOut: rupees(4321), otherIncome: rupees(2500), eventsIn: 0 });
  });
});
