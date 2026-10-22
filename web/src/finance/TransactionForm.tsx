import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { useSnackbar } from '../layout/Snackbar';
import { useFinance } from './FinanceContext';
import { voucherState } from './extras';
import { formatINR, newTransaction, VOUCHER_METHOD, validateTransaction, type Transaction, type TransactionInput } from './model';
import { AmountField } from './ui';

const KEY = 'YYYY-MM-DD';
/** The form while typing: the amount may still be empty. */
export type DraftTx = Omit<TransactionInput, 'amount'> & { amount: number | null };

function ChipPicker({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
        {label}
      </Typography>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <Chip key={o} label={o} role="radio" aria-checked={value === o} color={value === o ? 'primary' : 'default'} variant={value === o ? 'filled' : 'outlined'} onClick={() => onChange(o)} sx={{ minHeight: 36 }} />
        ))}
      </Stack>
    </Box>
  );
}

/** Amount, category, how you paid, date and an optional note. Used for quick-add and edit. */
export function TransactionFields({ value, onChange, autoFocus }: { value: DraftTx; onChange: Dispatch<SetStateAction<DraftTx>>; autoFocus?: boolean }) {
  const { doc } = useFinance();
  const s = doc!.settings;
  return (
    <Stack spacing={1.75}>
      <AmountField label="Amount" value={value.amount} onChange={(amount) => onChange((v) => ({ ...v, amount: amount ?? null }))} autoFocus={autoFocus} />
      <ChipPicker label="Category" options={s.categories} value={value.category} onChange={(category) => onChange((v) => ({ ...v, category }))} />
      <ChipPicker label="Paid with" options={s.methods} value={value.method} onChange={(method) => onChange((v) => ({ ...v, method }))} />
      <Stack direction="row" spacing={1}>
        <TextField label="Date" type="date" value={value.date} onChange={(e) => onChange((v) => ({ ...v, date: e.target.value }))} InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }} />
        <TextField label="Note (optional)" value={value.note ?? ''} onChange={(e) => onChange((v) => ({ ...v, note: e.target.value }))} fullWidth inputProps={{ maxLength: 200 }} />
      </Stack>
    </Stack>
  );
}

export const blankInput = (category = 'Groceries', method = 'UPI'): DraftTx => ({ date: dayjs().format(KEY), amount: null as number | null, category, method, note: null as string | null });

/** Quick add: saved on this device at once, synced (encrypted) in the background. */
export function QuickAdd() {
  const { doc, update } = useFinance();
  const toast = useSnackbar();
  const [form, setForm] = useState(blankInput());
  const [key, setKey] = useState(0);
  const input = { ...form, amount: form.amount ?? 0 };
  const error = form.amount === null ? null : validateTransaction(input, doc!.settings);
  const add = async () => {
    const t = newTransaction(input);
    await update((d) => ({ ...d, transactions: [...d.transactions, t] }));
    toast(`Added ${formatINR(t.amount)} · ${t.category}`, {
      action: { label: 'Undo', run: () => void update((d) => ({ ...d, transactions: d.transactions.map((x) => (x.id === t.id ? { ...x, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : x)) })) },
    });
    // Keep category, method and date: the next entry is often similar.
    setForm((f) => ({ ...f, amount: null, note: null }));
    setKey((k) => k + 1);
  };
  return (
    <Box component="form" onSubmit={(e) => (e.preventDefault(), form.amount !== null && !error && void add())}>
      <TransactionFields key={key} value={form} onChange={setForm} />
      {form.method === VOUCHER_METHOD && <VoucherHint amount={form.amount} />}
      {error && <Alert severity="warning" sx={{ mt: 1.5 }}>{error}</Alert>}
      <Button type="submit" variant="contained" size="large" fullWidth sx={{ mt: 2 }} disabled={form.amount === null || !!error}>
        Add {form.amount ? formatINR(form.amount) : ''}
      </Button>
    </Box>
  );
}

/** Amazon Pay purchases use voucher value, not cash; say how much is left. */
function VoucherHint({ amount }: { amount: number | null }) {
  const { doc } = useFinance();
  const v = voucherState(doc!, dayjs().format(KEY));
  const short = amount !== null && amount > v.balance;
  return (
    <Alert severity={short ? 'warning' : 'info'} sx={{ mt: 1.5 }}>
      Paid from your Amazon Pay voucher balance ({formatINR(v.balance)}): not cash, so it doesn’t touch budgets or savings.
      {short ? ` That’s ${formatINR((amount as number) - v.balance)} more than the balance; add the gift card under Vouchers & refunds.` : ''}
    </Alert>
  );
}

export function EditTransactionDialog({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const { doc, update } = useFinance();
  const toast = useSnackbar();
  const [form, setForm] = useState<DraftTx>({ date: tx.date, amount: tx.amount, category: tx.category, method: tx.method, note: tx.note });
  const input = { ...form, amount: form.amount ?? 0 };
  const error = validateTransaction(input, doc!.settings);
  const stamp = () => new Date().toISOString();
  const save = async () => {
    await update((d) => ({ ...d, transactions: d.transactions.map((x) => (x.id === tx.id ? { ...x, ...input, note: input.note?.trim() || null, updatedAt: stamp() } : x)) }));
    toast('Saved');
    onClose();
  };
  const remove = async () => {
    await update((d) => ({ ...d, transactions: d.transactions.map((x) => (x.id === tx.id ? { ...x, deletedAt: stamp(), updatedAt: stamp() } : x)) }));
    toast(`Deleted ${formatINR(tx.amount)} · ${tx.category}`, {
      action: { label: 'Undo', run: () => void update((d) => ({ ...d, transactions: d.transactions.map((x) => (x.id === tx.id ? { ...x, deletedAt: null, updatedAt: stamp() } : x)) })) },
    });
    onClose();
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Edit transaction</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          <TransactionFields value={form} onChange={setForm} />
        </Box>
        {error && <Alert severity="warning" sx={{ mt: 1.5 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button color="error" onClick={() => void remove()} sx={{ mr: 'auto' }}>
          Delete
        </Button>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!!error} onClick={() => void save()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** One line per transaction; tap to edit. */
export function TransactionRow({ tx, onOpen }: { tx: Transaction; onOpen: () => void }) {
  return (
    <Box
      component="button"
      onClick={onOpen}
      sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', py: 1, px: 0.5, border: 0, borderBottom: 1, borderColor: 'divider', bgcolor: 'transparent', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}
    >
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600 }}>{tx.category}</Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {dayjs(tx.date).format('ddd D MMM')} · {tx.method}
          {tx.note ? ` · ${tx.note}` : ''}
        </Typography>
      </Box>
      <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatINR(tx.amount)}</Typography>
    </Box>
  );
}
