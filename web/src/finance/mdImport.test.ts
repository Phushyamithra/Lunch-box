import { describe, expect, it } from 'vitest';
import { monthSummary } from './engine';
import { voucherState } from './extras';
import { applyMonthImport, guessCategory, markDuplicates, parseAmount, parseDay, parseExpenseSheets, parseMonthMarkdown, type ParsedMonth } from './mdImport';
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

describe('Excel expense sheets', () => {
  const sheets = [
    {
      name: 'Transactions',
      rows: [
        ['March 2027 expenses'],
        [],
        ['Date', 'Item', 'Amount (₹)', 'Category', 'Sub-category', 'Paid via', 'Method confirmed', 'Notes'],
        ['', 'Rent', 20000, 'Fixed', 'Housing', 'Bank / UPI', 'Yes', ''],
        ['', 'SIP', 3000, 'Savings/Investment', 'Mutual fund', 'Bank / UPI', 'Yes', ''],
        ['', 'HDFC card bill (previous cycle)', 4321, 'Card bill payment', 'HDFC', 'Bank / UPI', 'Yes', ''],
        [46462, 'Domain renewal (annual)', 1200, 'Yearly bill', 'Web', 'ICICI card', 'Yes', 'Planned one-off. Verify cashback on the next statement'],
        ['', 'Other ICICI purchases (not itemised)', 700, 'Unitemised ICICI', 'Petrol / misc', 'ICICI card', 'Estimate', ''],
        [46450, 'Earbuds tips', 299, 'Needs', 'Parts', 'Amazon Pay voucher', 'Yes', ''],
        ['', 'Jacket', 2000, 'Wants', 'Clothing', 'Bank / UPI', 'Yes', 'Returned'],
        ['', 'Jacket refund', -2000, 'Wants', 'Clothing', 'Bank / UPI', 'Yes', 'Refund received'],
        [46465, 'Shawarma', 378, 'Wants', 'Eating out', 'Bank / UPI', 'Yes', ''],
        ['', 'Socks (sports)', 499, 'Wants', 'Clothing', 'Bank / UPI', 'Yes', ''],
        ['', 'Total logged', 27397],
      ],
    },
    { name: 'Notes', rows: [['6. Amazon voucher: 1,000 received Mar 5, of which 299 is logged.'], ['7. Pending reimbursement: phone recharge 299.']] },
  ];
  const sheetOpts = { ...opts, today: '2027-03-25' };

  it('reads the table, its dates and the notes', () => {
    const p = parseExpenseSheets(sheets, sheetOpts) as ParsedMonth;
    expect(p).toMatchObject({ title: 'March 2027 expenses', month: '2027-03', generated: '2027-03-19' }); // latest dated row
    const by = (label: string) => p.items.find((i) => i.label.startsWith(label))!;
    expect(by('Rent')).toMatchObject({ category: 'Rent', method: 'UPI', date: '2027-03-01', include: true });
    expect(by('SIP')).toMatchObject({ category: 'Bills', date: '2027-03-01' });
    expect(by('HDFC card bill')).toMatchObject({ kind: 'event', date: '2027-03-01', record: { kind: 'expense' } });
    expect(by('Domain renewal')).toMatchObject({ date: '2027-03-16', category: 'Other', method: 'ICICI', record: { oneOff: true, cashbackCheck: true } });
    expect(by('Other ICICI purchases')).toMatchObject({ category: 'Other', include: true, note: expect.stringContaining('Estimate') });
    expect(by('Earbuds tips')).toMatchObject({ method: 'Amazon Pay', date: '2027-03-04' });
    expect(by('Jacket refund')).toMatchObject({ include: false });
    expect(p.items.find((i) => i.label === 'Jacket')).toMatchObject({ include: false });
    expect(p.items.some((i) => /^Total/.test(i.label))).toBe(false);
    expect(by('Amazon Pay value received 2027-03-05')).toMatchObject({ kind: 'voucher', amount: rupees(1000) });
    expect(by('Phone recharge: reimbursement')).toMatchObject({ kind: 'event', amount: rupees(299), record: { status: 'pending' } });
    expect(p.skippedSections).toEqual(['Notes (only the voucher and reimbursement lines were read)']);
  });

  it('needs Item and Amount columns', () => {
    expect(parseExpenseSheets([{ name: 'S', rows: [['a', 'b']] }], sheetOpts)).toEqual({ error: expect.stringContaining('“Item” and “Amount”') });
  });

  it('flags rows already recorded from another file', () => {
    const md = parse(); // the Markdown month (March 2027) imported first
    const first = applyMonthImport(emptyDoc('2027-03-20'), md, md.items.filter((i) => i.include), '2027-03-15').doc;
    const p = parseExpenseSheets(sheets, sheetOpts) as ParsedMonth;
    const marked = markDuplicates(first, p.items, p.month);
    const by = (label: string) => marked.find((i) => i.label.startsWith(label))!;
    expect(by('Rent')).toMatchObject({ include: false, note: expect.stringContaining('Already imported') });
    expect(by('HDFC card bill')).toMatchObject({ include: false });
    expect(by('Domain renewal')).toMatchObject({ include: false }); // same name and amount: same id
    expect(by('Other ICICI purchases')).toMatchObject({ include: true });
    expect(by('Amazon Pay value received')).toMatchObject({ include: false });
    expect(by('Shawarma')).toMatchObject({ include: true });
    // Different name, same amount and method as "Running socks" from the Markdown file.
    expect(by('Socks (sports)')).toMatchObject({ include: false, note: expect.stringContaining('Looks already recorded: Wants · Running socks') });
  });
});
