import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Card } from '../fitness/ui';
import { useSnackbar } from '../layout/Snackbar';
import { incomesOf } from './extras';
import { useFinance } from './FinanceContext';
import { formatINR, type IncomeSource, type Paise } from './model';
import { AmountField } from './ui';

const now = () => new Date().toISOString();
const ym = (m: string) => dayjs(`${m}-01`).format('MMM YYYY');

function IncomeDialog({ income, onClose }: { income: IncomeSource | 'new'; onClose: () => void }) {
  const { update } = useFinance();
  const toast = useSnackbar();
  const isNew = income === 'new';
  const [f, setF] = useState<Omit<IncomeSource, 'id' | 'updatedAt' | 'deletedAt' | 'amount'> & { amount: Paise | null }>(() =>
    isNew
      ? { name: '', amount: null, cadence: 'once', month: dayjs().format('YYYY-MM'), until: null, reliability: 'bonus', certainty: 'estimated', receivedOn: null, receivedAmount: null }
      : { ...income },
  );
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const ok = f.name.trim() && f.amount !== null && f.amount > 0 && /^\d{4}-\d{2}$/.test(f.month) && (!f.until || f.until >= f.month);
  const save = async () => {
    if (!ok || f.amount === null) return;
    const row: IncomeSource = { ...(isNew ? { id: crypto.randomUUID(), deletedAt: null } : { id: income.id, deletedAt: null }), ...f, amount: f.amount, name: f.name.trim(), until: f.cadence === 'monthly' ? f.until : null, updatedAt: now() };
    await update((d) => ({ ...d, incomes: isNew ? [...(d.incomes ?? []), row] : (d.incomes ?? []).map((x) => (x.id === row.id ? row : x)) }));
    toast(isNew ? 'Income added' : 'Saved');
    onClose();
  };
  const remove = async () => {
    if (isNew) return;
    await update((d) => ({ ...d, incomes: (d.incomes ?? []).map((x) => (x.id === income.id ? { ...x, deletedAt: now(), updatedAt: now() } : x)) }));
    onClose();
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{isNew ? 'Other income' : 'Edit income'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Name" value={f.name} onChange={(e) => set({ name: e.target.value })} autoFocus placeholder="e.g. Diwali bonus, freelance" inputProps={{ maxLength: 80 }} />
          <AmountField label="Amount" value={f.amount} onChange={(amount) => set({ amount })} />
          <ToggleButtonGroup exclusive size="small" value={f.reliability} onChange={(_, v) => v && set({ reliability: v })} aria-label="Reliability">
            <ToggleButton value="reliable" sx={{ textTransform: 'none', px: 2 }}>
              Reliable
            </ToggleButton>
            <ToggleButton value="bonus" sx={{ textTransform: 'none', px: 2 }}>
              Bonus-only
            </ToggleButton>
          </ToggleButtonGroup>
          <Stack direction="row" spacing={1}>
            <ToggleButtonGroup exclusive size="small" value={f.cadence} onChange={(_, v) => v && set({ cadence: v })} aria-label="How often">
              <ToggleButton value="once" sx={{ textTransform: 'none', px: 2 }}>
                Once
              </ToggleButton>
              <ToggleButton value="monthly" sx={{ textTransform: 'none', px: 2 }}>
                Monthly
              </ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup exclusive size="small" value={f.certainty} onChange={(_, v) => v && set({ certainty: v })} aria-label="Certainty">
              <ToggleButton value="confirmed" sx={{ textTransform: 'none', px: 1.5 }}>
                Confirmed
              </ToggleButton>
              <ToggleButton value="estimated" sx={{ textTransform: 'none', px: 1.5 }}>
                Estimate
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Stack direction="row" spacing={1}>
            <TextField type="month" label={f.cadence === 'monthly' ? 'From' : 'Expected in'} value={f.month} onChange={(e) => set({ month: e.target.value })} InputLabelProps={{ shrink: true }} fullWidth />
            {f.cadence === 'monthly' && <TextField type="month" label="Until (optional)" value={f.until ?? ''} onChange={(e) => set({ until: e.target.value || null })} InputLabelProps={{ shrink: true }} fullWidth />}
          </Stack>
          {f.cadence === 'once' && (
            <Stack direction="row" spacing={1}>
              <TextField type="date" label="Received on" value={f.receivedOn ?? ''} onChange={(e) => set({ receivedOn: e.target.value || null })} InputLabelProps={{ shrink: true }} fullWidth />
              {f.receivedOn && <AmountField label="Amount received" value={f.receivedAmount ?? f.amount} onChange={(v) => set({ receivedAmount: v })} />}
            </Stack>
          )}
          <Typography variant="caption" color="text.secondary">
            {f.reliability === 'reliable'
              ? 'Reliable income is part of projections and the salary-day plan.'
              : 'Bonus-only income is left out of projections until you mark it received; then it counts in that month.'}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        {!isNew && (
          <Button color="error" onClick={() => void remove()} sx={{ mr: 'auto' }}>
            Delete
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!ok} onClick={() => void save()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Income besides salary, tagged reliable or bonus-only. */
export function IncomeCard() {
  const { doc, update } = useFinance();
  const toast = useSnackbar();
  const [editing, setEditing] = useState<IncomeSource | 'new' | null>(null);
  if (!doc) return null;
  const list = incomesOf(doc).sort((a, b) => a.month.localeCompare(b.month));
  const receive = (i: IncomeSource) =>
    void update((d) => ({ ...d, incomes: (d.incomes ?? []).map((x) => (x.id === i.id ? { ...x, receivedOn: dayjs().format('YYYY-MM-DD'), updatedAt: now() } : x)) })).then(() => toast(`Received: ${i.name}`));
  return (
    <Card title="💵 Other income" aside={<Button size="small" startIcon={<AddRoundedIcon />} onClick={() => setEditing('new')}>Add</Button>}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Income besides salary. Reliable income is planned; bonus-only income counts only once it arrives.
      </Typography>
      {list.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          None yet.
        </Typography>
      )}
      {list.map((i) => (
        <Stack key={i.id} direction="row" spacing={1} alignItems="center" sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Box component="button" onClick={() => setEditing(i)} sx={{ flexGrow: 1, minWidth: 0, border: 0, p: 0, bgcolor: 'transparent', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
            <Typography sx={{ fontWeight: 600 }} noWrap>
              {i.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {i.cadence === 'monthly' ? `monthly from ${ym(i.month)}${i.until ? ` to ${ym(i.until)}` : ''}` : i.receivedOn ? `received ${dayjs(i.receivedOn).format('D MMM YYYY')}` : `expected ${ym(i.month)}`}
            </Typography>
          </Box>
          <Stack alignItems="flex-end" spacing={0.25}>
            <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} color="success.main">
              +{formatINR(i.receivedOn && i.receivedAmount !== null ? i.receivedAmount : i.amount)}
            </Typography>
            <Stack direction="row" spacing={0.5}>
              <Chip size="small" label={i.reliability === 'reliable' ? 'Reliable' : 'Bonus'} color={i.reliability === 'reliable' ? 'success' : 'default'} variant="outlined" />
              <Chip size="small" label={i.certainty === 'confirmed' ? 'Confirmed' : 'Estimate'} variant="outlined" />
            </Stack>
          </Stack>
          {i.reliability === 'bonus' && !i.receivedOn && (
            <Button size="small" variant="outlined" onClick={() => receive(i)}>
              Received
            </Button>
          )}
        </Stack>
      ))}
      {editing && <IncomeDialog income={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}
