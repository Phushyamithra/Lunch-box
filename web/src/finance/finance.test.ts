import { describe, expect, it } from 'vitest';
import { defaultSettings, emptyDoc, formatINR, newTransaction, parseFinanceDoc, parseINR, rupees, validateSettings, validateTransaction, type FinanceDoc } from './model';
import { deriveKey, mergeDocs, newKdfParams, open, passphraseProblem, seal, WrongPassphraseError } from './vault';

describe('money', () => {
  it('formats rupees the Indian way, in paise', () => {
    expect(formatINR(rupees(100000))).toBe('₹1,00,000');
    expect(formatINR(rupees(224000))).toBe('₹2,24,000');
    expect(formatINR(rupees(2450.5))).toBe('₹2,450.50');
    expect(formatINR(rupees(12345678))).toBe('₹1,23,45,678');
    expect(formatINR(rupees(999))).toBe('₹999');
    expect(formatINR(-rupees(3170))).toBe('−₹3,170');
    expect(formatINR(rupees(500), { sign: true })).toBe('+₹500');
  });
  it('parses typed amounts', () => {
    expect(parseINR('1,50,000')).toBe(15000000);
    expect(parseINR('₹ 249.5')).toBe(24950);
    expect(parseINR('0.1')).toBe(10);
    expect(parseINR('12.345')).toBeNull();
    expect(parseINR('-5')).toBeNull();
    expect(parseINR('abc')).toBeNull();
  });
  it('avoids floating-point drift', () => {
    expect(rupees(0.1) + rupees(0.2)).toBe(rupees(0.3));
  });
});

describe('settings and transactions', () => {
  const s = defaultSettings('2026-10-20', '2026-10-20T00:00:00Z');
  it('seeds the brief: salary, costs, cards, waterfall with a top-up (not a second full fund)', () => {
    expect(validateSettings(s)).toBeNull();
    expect(s.salary).toBe(rupees(62000));
    expect(s.fixed.find((f) => f.id === 'gold')?.endsOn).toBe('2027-08');
    expect(s.cards.map((c) => [c.name, c.limit, c.statementDay])).toEqual([
      ['HDFC RuPay / UPI', rupees(6000), null],
      ['ICICI Amazon', rupees(4000), null],
    ]);
    expect(s.goals.map((g) => g.target)).toEqual([30000, 100000, 210000, 70000, 224000].map(rupees));
    expect(s.startMonth).toBe('2026-10');
  });
  it('checks settings', () => {
    expect(validateSettings({ ...s, salaryDay: 31 })).toMatch(/1–28/);
    expect(validateSettings({ ...s, cards: [{ ...s.cards[0], statementDay: 30 }] })).toMatch(/1–28/);
    expect(validateSettings({ ...s, fixed: [{ ...s.fixed[1], endsOn: 'Aug 2027' }] })).toMatch(/2027-08/);
  });
  it('checks transactions', () => {
    const t = { date: '2026-10-20', amount: rupees(250), category: 'Groceries', method: 'HDFC', note: null };
    expect(validateTransaction(t, s)).toBeNull();
    expect(validateTransaction({ ...t, amount: 0 }, s)).toMatch(/more than/);
    expect(validateTransaction({ ...t, date: '2026-02-30' }, s)).toMatch(/date/);
    expect(validateTransaction({ ...t, method: 'Crypto' }, s)).toMatch(/paid/);
  });
  it('reads back its own documents and refuses others', () => {
    const doc = emptyDoc('2026-10-20');
    doc.transactions.push(newTransaction({ date: '2026-10-20', amount: rupees(250), category: 'Groceries', method: 'HDFC', note: ' chai ' }));
    expect(doc.transactions[0].note).toBe('chai');
    expect('doc' in parseFinanceDoc(JSON.parse(JSON.stringify(doc)))).toBe(true);
    expect(parseFinanceDoc({ schema: 'x' })).toEqual({ error: 'This isn’t a Tracker finance file.' });
    expect(parseFinanceDoc({ ...doc, version: 9 })).toMatchObject({ error: expect.stringContaining('newer version') });
    expect(parseFinanceDoc({ ...doc, transactions: [{ id: 'x', amount: 1.5 }] })).toMatchObject({ error: expect.stringContaining('damaged') });
  });
});

describe('encryption', () => {
  const kdf = newKdfParams(1000); // fast for tests; the app uses 600,000
  it('round-trips, and the ciphertext reveals nothing readable', async () => {
    const doc = emptyDoc('2026-10-20');
    doc.transactions.push(newTransaction({ date: '2026-10-20', amount: rupees(20000), category: 'Rent', method: 'UPI', note: 'October rent' }));
    const key = await deriveKey('correct horse battery', kdf);
    const sealed = await seal(doc, key, kdf);
    expect(atob(sealed.ciphertext)).not.toContain('Rent');
    expect(atob(sealed.ciphertext)).not.toContain('October');
    expect(await open(sealed, key)).toEqual(doc);
  });
  it('a fresh IV every save', async () => {
    const key = await deriveKey('correct horse battery', kdf);
    const a = await seal(emptyDoc('2026-10-20', 'x'), key, kdf);
    const b = await seal(emptyDoc('2026-10-20', 'x'), key, kdf);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });
  it('a wrong passphrase or tampered data fails clearly', async () => {
    const sealed = await seal(emptyDoc('2026-10-20'), await deriveKey('correct horse battery', kdf), kdf);
    await expect(open(sealed, await deriveKey('wrong horse battery', kdf))).rejects.toBeInstanceOf(WrongPassphraseError);
    const flipped = atob(sealed.ciphertext);
    const tampered = btoa(String.fromCharCode(flipped.charCodeAt(0) ^ 1) + flipped.slice(1));
    await expect(open({ ...sealed, ciphertext: tampered }, await deriveKey('correct horse battery', kdf))).rejects.toBeInstanceOf(WrongPassphraseError);
  });
  it('asks for a reasonable passphrase', () => {
    expect(passphraseProblem('short')).toMatch(/at least 10/);
    expect(passphraseProblem('aaaaaaaaaaaa')).toMatch(/easy/);
    expect(passphraseProblem('mango rickshaw lamp', 'mango rickshaw lamb')).toMatch(/match/);
    expect(passphraseProblem('mango rickshaw lamp', 'mango rickshaw lamp')).toBeNull();
  });
});

describe('merging two devices', () => {
  const base = (): FinanceDoc => emptyDoc('2026-10-20', '2026-10-20T00:00:00Z');
  const tx = (id: string, updatedAt: string, amount: number, deletedAt: string | null = null) => ({
    id,
    updatedAt,
    deletedAt,
    createdAt: '2026-10-20T00:00:00Z',
    date: '2026-10-20',
    amount: rupees(amount),
    category: 'Groceries',
    method: 'UPI',
    note: null,
  });

  it('keeps both sides’ new records and the newer edit of a shared one', () => {
    const phone = { ...base(), transactions: [tx('a', '2026-10-20T10:00:00Z', 100), tx('shared', '2026-10-20T12:00:00Z', 300)] };
    const laptop = { ...base(), transactions: [tx('b', '2026-10-20T11:00:00Z', 200), tx('shared', '2026-10-20T11:30:00Z', 250)] };
    const m = mergeDocs(phone, laptop);
    expect(m.transactions.map((t) => [t.id, t.amount]).sort()).toEqual([
      ['a', 10000],
      ['b', 20000],
      ['shared', 30000],
    ]);
    // Same answer whichever side merges.
    expect(mergeDocs(laptop, phone).transactions.map((t) => t.id)).toEqual(m.transactions.map((t) => t.id));
  });

  it('a delete on one device wins over an older edit on the other', () => {
    const phone = { ...base(), transactions: [tx('x', '2026-10-20T12:00:00Z', 100, '2026-10-20T12:00:00Z')] };
    const laptop = { ...base(), transactions: [tx('x', '2026-10-20T11:00:00Z', 150)] };
    expect(mergeDocs(laptop, phone).transactions[0].deletedAt).toBe('2026-10-20T12:00:00Z');
  });

  it('settings: the newer block wins', () => {
    const phone = { ...base(), settings: { ...base().settings, salary: rupees(65000), updatedAt: '2026-10-21T00:00:00Z' } };
    expect(mergeDocs(base(), phone).settings.salary).toBe(rupees(65000));
    expect(mergeDocs(phone, base()).settings.salary).toBe(rupees(65000));
  });
});
