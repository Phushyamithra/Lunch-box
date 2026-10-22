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
1b. **Done — Fingerprint lock (Finance only; Settings → Security):** a
   passkey through WebAuthn.
   - **PRF mode** (Chrome on Android with a Google Password Manager
     passkey): the finance key on the phone is encrypted with a secret the
     passkey releases only after your fingerprint (HKDF → AES-GCM wrap).
   - **Gate mode** (devices without PRF): a fingerprint check guards the
     stored, non-extractable key.
   - Finance locks again after 5 minutes in the background, and the
     passphrase always works as a fallback.
   - Changing the passphrase switches PRF mode off; turn it on again
     afterwards.
   - The passkey is tied to the site address, so on a new address
     (production) you turn it on again.
2. **Done — Month engine and dashboard** (`engine.ts`, tested against the
   brief's numbers):
   - **Plan:** October saves ₹7,830, November ₹11,000 and December
     −₹6,750 (gym); from September 2027 (gold ended) ₹21,000.
   - **Committed costs:** counted as paid even if not logged; when logged,
     the larger of planned and logged counts (no double counting).
   - **Budgets:** count what you logged, and what's left stays saved.
     Everyday spending is planned at the card cap.
   - **Two numbers:** "left in budgets" (keeps savings on plan) is kept
     apart from "uncommitted cash" (which includes planned savings).
   - **Cards:**
     - cycles run statement to statement, with the bill due on the next
       due day and counted as paid after it;
     - utilisation shows a warning at 80% and a red flag over the limit;
     - the combined cap is tracked per calendar month;
     - a purchase and its bill are never two expenses.
   - **Waterfall:** actual savings = saved before + finished months, poured
     in order. Completion months are estimates from the plan, labelled.
   - **Screens:** Today (left in budgets, expected savings), Month,
     Cards, Savings.
3. **Done — Projections and reconciliation** (`projection.ts`, tested):
   - **Plan tab:** month by month from tracking start until every goal is
     full (10 years at most).
     - Each row is labelled Actual, This month (part estimate) or
       Estimate, and shows insurance, gym and the gold scheme's last month.
     - Each goal's completion month is marked.
     - A chart shows the running total (solid = actual, dashed =
       estimate), monthly bars (faded = estimate, red = dips) and dotted
       lines where each goal fills. A "by goal" view stacks the waterfall.
     - Pending obligations (committed costs not yet paid plus card bills
       owed) are shown as already counted, not extra.
   - **Bank tab:** what the bank should hold today:
     - opening balance (on the 1st of the start month) + salaries − logged
       UPI and debit − card bills on their due dates − earlier months'
       committed costs that weren't logged (assumed paid). Each assumption
       is starred.
     - This month's unlogged committed costs are shown as pending, with
       both figures.
     - "What it's for" splits the balance into savings, cards owed,
       committed and free, so nothing is counted twice.
     - Balance checks you enter are judged as matching (within ₹500),
       explained (lower by no more than the pending costs) or "check this",
       with likely causes.
4. **Done — Affordability and what-if** (`scenarios.ts`, tested;
   Finance → What if):
   - **Can I afford it?** Test an amount, category, payment method and
     date. You see:
     - the effect on the budget or everyday allowance, with this month's
       savings before and after;
     - the card cycle and which bill it lands on;
     - the combined card cap;
     - every goal's date before and after.

     The verdict is "fits your plan", "costs savings" or "breaks a limit".
     It only becomes a transaction after you confirm.
   - **Change the plan:** sliders for salary, card cap, SIP and rent, plus
     the gold scheme's last month. It compares a normal month's savings,
     the date all goals are funded and each goal's date. Apply (with
     confirmation) takes effect from this month only.
   - **Dated plan changes** (`planHistory`): Settings saves and applied
     scenarios keep the earlier values for earlier months, so history and
     actual savings never get rewritten. Settings offers "All months (fix a
     mistake)" for genuine corrections.
5. **Done — Vouchers and one-off events** (`extras.ts`, tested;
   Finance → Vouchers & refunds):
   - **Amazon Pay balance:** gift cards with an optional expiry, and
     corrections.
     - Purchases paid with "Amazon Pay" use the earliest-expiring value
       first.
     - Value that expires unused is shown as lost, and value expiring
       within 30 days gets a warning.
     - Spending that the balance can't cover is flagged.
     - Voucher value is never cash: it isn't in budgets, savings or the
       bank, and the Month page lists it separately.
   - **Refunds, exchange amounts, cashback and other money in or out:**
     - Pending ones are listed with "if they all come through" and are
       labelled "not included" on Plan.
     - Settled ones count in the month they settle: to the bank (savings
       and the Bank check), to a card (lowering that card's bill) or to
       Amazon Pay (voucher value).
   - **Older copies:** saved finance data without these lists still opens
     and merges normally.
5b. **Done — Extra features (requested 2026-10-22)** (`planner.ts`,
   `extras.ts`, tested). Already present before this and not rebuilt:
   periodic bills, "salary pays next month", the voucher balance and
   expiry, separate Wants and Unplanned bars, pending vs settled events.
   - **Yearly bills:** a monthly set-aside per periodic bill, with what
     should be put by now (Plan tab). "Peak months ahead" flags months more
     than 5% above a usual month.
   - **Salary day** (Bank tab):
     - shows what the salary must cover next month (committed costs,
       budgets, last month's card bill or same-month spending if
       card-free) and what is safe to move to savings;
     - enter a planned transfer to get a warning if it leaves bills
       uncovered.
   - **Card-free mode** (Settings):
     - a start month and a weekly cap;
     - the switch month shows the one-time double payment, and Plan notes
       it (savings don't change; only the timing does);
     - a weekly bar on Today and Cards counts everyday categories only.
   - **Planned one-off** on card purchases: still counted as spending, but
     it doesn't trigger card or combined-cap warnings. "Check cashback on
     next statement" adds a reminder once that statement has closed
     (Lists).
   - **Vouchers:** an "earmarked for" note, with the earmarked amounts
     still available shown.
   - **Reimbursement claims:** Pending → Filed → Received. Only Received
     counts as cash.
   - **Other income** (Income & extras): tagged Reliable or Bonus-only,
     and Confirmed or Estimate. Reliable income is projected; bonus-only
     income is left out (and labelled on Plan) until it's marked received.
   - **Needs:** everyday spending is labelled "Needs (everyday)" and never
     draws from Wants. "Buy later" keeps deferred wants: "Afford?" opens
     the check prefilled, and "Bought" records it under Wants.
   - **Lists:** reminders, an open checklist (due dates, tick off, or
     turn into an expense) and buy-later wants.
6. **Done — Reports** (`reports.ts`, tested; Finance → Reports):
   - periods of 3, 6 or 12 months, or since start;
   - actual vs plan (a chart and the gap);
   - a monthly summary (committed, budgets, needs, saved, vs plan);
   - spending by category with monthly figures;
   - each card by month against its limit;
   - goal progress with estimated dates;
   - CSV exports of transactions and the monthly summary (UTF-8 with BOM,
     formula-safe, labelled as not encrypted).

   The Markdown report gains an opt-in **Finance** checkbox (off by
   default, available only while Finance is unlocked, with a plain-text
   warning) that adds "Part 6 — Finance".
