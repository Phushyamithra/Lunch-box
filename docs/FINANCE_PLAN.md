# FINANCE_PLAN.md — Phase 6

## Audit (2026-10-20)

**Source:** the original platform brief, section 8 ("Finance and savings
module"), plus the decisions in `PLATFORM_PLAN.md`.

| Topic | Brief | Decision since | Resolution |
| --- | --- | --- | --- |
| Storage | Browser-local (IndexedDB), JSON backup and restore | Sync anyway, end-to-end encrypted, phone primary | Records live in IndexedDB on each device. The cloud holds one **encrypted blob** per user. The key comes from a passphrase that never leaves the device, so Supabase only ever sees ciphertext. |
| Login | "No login, no backend" | The app already has a Supabase sign-in | The sign-in only decides *whose* blob it is. Finance data is never stored in readable form in any table, and never sits in the fitness or nutrition tables. |
| Bank access | Never ask for bank credentials; never read SMS | — | Kept. All entry is manual. |
| Losing the passphrase | — | Accepted | The cloud copy can't be recovered. A device that's already unlocked keeps working, and a plain JSON backup still restores. The app says this before you set the passphrase. |
| Presentation | Offline storage must not be described as sync | — | The status reads "Saved on this device" and "Synced (encrypted)" separately, and sync errors are shown. |

**Existing code:** a placeholder screen and no data. Nothing to migrate.

## Seed values from the brief (all editable)

- **Salary:** ₹62,000. It's credited on the last day of the month and pays
  the next month's bills.
- **Fixed costs:**
  - rent ₹20,000;
  - gold scheme ₹10,000, ending August 2027;
  - SIP ₹3,000;
  - dinner ₹3,500;
  - protein ₹2,500.
- **Cards:** HDFC RuPay/UPI (limit ₹6,000; groceries and chai) and ICICI
  Amazon (limit ₹4,000; petrol, pet food and essentials). The combined cap
  is ₹10,000, and both are paid in full from the next salary.
- **Variable budgets:** wants ₹1,000 and unplanned ₹1,000. Whatever is
  unspent rolls into savings.
- **Periodic costs:** insurance ₹3,170 in January, April, July and
  October; gym ₹17,750 every December.
- **Savings waterfall, in order:**
  1. Starter emergency fund ₹30,000
  2. Switch fund ₹1,00,000
  3. LASIK ₹2,10,000
  4. Emergency fund top-up (+₹70,000, bringing it to ₹1,00,000)
  5. Bike down payment ₹2,24,000
- **Categories and payment methods:** as listed in the brief.

**Unknown (asked during setup, not guessed):**
- each card's statement day and due day;
- your current bank balance;
- what's already saved toward each goal;
- the month tracking starts.

## Design

- **Money:** whole paise as integers (no floating-point drift), shown in
  Indian format (₹1,00,000).
- **Document:** one versioned JSON document (`schema: tracker.finance`).
  - Every record has an `id`, `updatedAt` and an optional `deletedAt`, so
    deletes can be undone and devices can merge.
  - Settings are one block with their own `updatedAt`.
- **Encryption:**
  - The key: PBKDF2-SHA-256 (600,000 iterations, random salt) → AES-GCM
    256 with a fresh IV on every save.
  - "Remember on this device" keeps the key in IndexedDB as a
    non-extractable CryptoKey, so the passphrase itself is never stored.
- **Sync:** the `finance_vault` table holds one row per user: ciphertext,
  IV, salt, KDF settings and a revision number. RLS lets you touch only
  your own row.
  - A save only lands if the revision hasn't moved.
  - If another device saved in between, this device downloads that copy,
    merges record by record (the newest `updatedAt` wins) and saves again.
  - Nothing is lost on conflict.
- **Spending model:**
  - A card purchase is an expense when it happens. Its payment later is a
    settlement, not a second expense.
  - Salary credited on the 31st pays the next month's bills.

## Stages

1. **Done — Foundation** (migration `0015_finance_vault.sql`):
   - `model.ts`, `vault.ts` (tested), `localStore.ts` (IndexedDB),
     `vaultApi.ts` and `FinanceContext.tsx` (sync, merge, retry).
   - Setup and unlock, with an optional remembered key, lock, passphrase
     change and "remove from this device".
   - Quick-add (keeps category, method and date for the next entry),
     editing, delete with undo, and a month view with a category filter.
   - All settings are editable: salary and its day, card limits with
     statement and due days, fixed costs (with end month), periodic costs,
     budgets with rollover, waterfall goals (with already-saved amounts
     and reordering), start month and opening balance.
   - Backup download (readable; this is clearly stated) and restore by
     merging.
   - **Checked in the preview:**
     - the server only receives ciphertext;
     - a wrong passphrase is refused;
     - a second device unlocks and downloads;
     - a simultaneous save from another device is merged, with no entry
       lost.
2. **Month engine and dashboard:**
   - salary timing, fixed and periodic costs;
   - budgets with rollover;
   - card cycles, settlements and utilisation warnings at 80% and over
     the limit;
   - the savings waterfall;
   - the monthly dashboard and card tracking.
3. **Projections and reconciliation:**
   - month-by-month until the last goal, with actual and projected values
     clearly separated;
   - charts;
   - bank-balance check with discrepancies flagged.
4. **Affordability and what-if:** test a purchase, or change salary, card
   cap, SIP, rent or the gold end date. Nothing changes until you apply it.
5. **Vouchers and one-off events:**
   - Amazon Pay voucher balance, history and expiry (never counted as
     cash);
   - refunds, pending exchanges and cashbacks, marked pending or settled.
6. **Reports:** monthly summaries, trends, CSV export and finance in the
   Markdown report (opt-in).
