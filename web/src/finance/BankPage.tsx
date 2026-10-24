import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, TextField, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { Card } from '../fitness/ui';
import { useSnackbar } from '../layout/Snackbar';
import { cardStatus, savingsState } from './engine';
import { useFinance } from './FinanceContext';
import { formatINR, type BalanceCheck, type Paise } from './model';
import { compareBalance, reconcile, type Verdict } from './projection';
import { SalaryDayCard } from './PlannerCards';
import { AmountField } from './ui';

/** Opening balance and start month: the starting point everything is measured from. Editable any time. */
function OpeningCard() {
  const { doc, updateSettings } = useFinance();
  const toast = useSnackbar();
  const s = doc!.settings;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<Paise | null>(s.openingBalance);
  const [month, setMonth] = useState(s.startMonth);
  const save = async () => {
    await updateSettings({ openingBalance: amount, startMonth: month });
    toast('Starting point saved');
    setOpen(false);
  };
  return (
    <Card title="📍 Starting point" aside={<Button size="small" onClick={() => (setAmount(s.openingBalance), setMonth(s.startMonth), setOpen(true))}>{s.openingBalance === null ? 'Set' : 'Edit'}</Button>}>
      <Typography variant="body2" color={s.openingBalance === null ? 'warning.main' : 'text.secondary'}>
        {s.openingBalance === null
          ? 'Add what your bank held on the 1st of the month you started tracking, so the app can work out what it should hold now.'
          : `${formatINR(s.openingBalance)} in the bank on 1 ${dayjs(`${s.startMonth}-01`).format('MMM YYYY')} (after the previous salary). Tracking starts that month.`}
      </Typography>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Starting point</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField type="month" label="Tracking starts" value={month} onChange={(e) => setMonth(e.target.value)} InputLabelProps={{ shrink: true }} />
            <AmountField label="Bank balance on the 1st of that month" value={amount} onChange={setAmount} helperText="All your accounts together, after the previous month’s salary landed." />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!/^\d{4}-\d{2}$/.test(month)} onClick={() => void save()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

/** Edit or delete a balance you entered. */
function BalanceDialog({ check, onClose }: { check: BalanceCheck; onClose: () => void }) {
  const { update } = useFinance();
  const toast = useSnackbar();
  const [amount, setAmount] = useState<Paise | null>(check.amount);
  const [date, setDate] = useState(check.date);
  const [note, setNote] = useState(check.note ?? '');
  const stamp = () => new Date().toISOString();
  const save = async () => {
    if (amount === null) return;
    await update((d) => ({ ...d, balances: d.balances.map((x) => (x.id === check.id ? { ...x, amount, date, note: note.trim() || null, updatedAt: stamp() } : x)) }));
    toast('Balance updated');
    onClose();
  };
  const remove = async () => {
    await update((d) => ({ ...d, balances: d.balances.map((x) => (x.id === check.id ? { ...x, deletedAt: stamp(), updatedAt: stamp() } : x)) }));
    toast('Balance removed', { action: { label: 'Undo', run: () => void update((d) => ({ ...d, balances: d.balances.map((x) => (x.id === check.id ? { ...x, deletedAt: null, updatedAt: stamp() } : x)) })) } });
    onClose();
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Edit balance</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <AmountField label="Balance" value={amount} onChange={setAmount} />
          <TextField type="date" label="On" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} inputProps={{ maxLength: 200 }} placeholder="e.g. Main 2,013.05 + Savings 5,197.92" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="error" onClick={() => void remove()} sx={{ mr: 'auto' }}>
          Delete
        </Button>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={amount === null || !date} onClick={() => void save()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const VERDICT: Record<Verdict, { color: 'success' | 'info' | 'warning'; label: string }> = {
  match: { color: 'success', label: 'Matches' },
  explained: { color: 'info', label: 'Explained' },
  unexplained: { color: 'warning', label: 'Check this' },
};

/** What the bank should hold, compared with what it does. */
export default function BankPage() {
  const { doc, update } = useFinance();
  const toast = useSnackbar();
  const today = dayjs().format('YYYY-MM-DD');
  const [amount, setAmount] = useState<Paise | null>(null);
  const [date, setDate] = useState(today);
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<BalanceCheck | null>(null);

  const ctx = useMemo(() => {
    if (!doc) return null;
    const pot = savingsState(doc, today).actualTotal;
    const owed = doc.settings.cards.reduce((a, c) => a + cardStatus(doc, c, today).outstanding, 0);
    return { pot, owed, now: reconcile(doc, today, { savingsPot: pot, cardsOwed: owed }) };
  }, [doc, today]);
  if (!doc || !ctx) return null;
  const { now } = ctx;
  const checks = doc.balances.filter((b) => !b.deletedAt).sort((a, b) => b.date.localeCompare(a.date));

  if (now.expected === null) {
    return (
      <Stack spacing={2} sx={{ maxWidth: 860 }}>
        <SalaryDayCard />
        <OpeningCard />
      </Stack>
    );
  }

  const save = async () => {
    if (amount === null) return;
    const stamp = new Date().toISOString();
    const row: BalanceCheck = { id: crypto.randomUUID(), date, amount, note: null, updatedAt: stamp, deletedAt: null };
    await update((d) => ({ ...d, balances: [...d.balances, row] }));
    const r = compareBalance(reconcile(doc, date, { savingsPot: ctx.pot, cardsOwed: ctx.owed }), amount);
    toast(r ? `Saved · ${VERDICT[r.verdict].label}` : 'Saved');
    setAmount(null);
    setFormKey((k) => k + 1);
  };

  return (
    <Stack spacing={2} sx={{ maxWidth: 860 }}>
      <SalaryDayCard />
      <OpeningCard />
      <Card title="🏦 Your bank should hold">
        <Typography sx={{ fontSize: 32, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatINR(now.expected)}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          today, if everything is logged
          {now.pendingThisMonth > 0 ? `; or ${formatINR(now.expected - now.pendingThisMonth)} if this month’s unlogged committed costs (${formatINR(now.pendingThisMonth)}) have already gone out` : ''}.
        </Typography>
        <Stack spacing={0.5}>
          {now.lines.map((l) => (
            <Stack key={l.label} direction="row" justifyContent="space-between" spacing={1}>
              <Typography variant="body2" color={l.assumed ? 'text.secondary' : undefined}>
                {l.label}
                {l.assumed ? ' *' : ''}
              </Typography>
              <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {l.amount === 0 ? '—' : formatINR(l.amount, { sign: true })}
              </Typography>
            </Stack>
          ))}
        </Stack>
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
          * Assumed from your settings, not logged: salary on its day, card bills paid in full on the due date, earlier months’ committed costs paid.
        </Typography>
      </Card>

      <Card title="🧩 What that money is for">
        <Stack spacing={0.75}>
          {[
            ['Savings so far (actual)', now.earmarks.savings],
            ['Card bills owed', now.earmarks.cards],
            ['Committed costs still to pay this month', now.earmarks.committed],
          ].map(([label, v]) => (
            <Stack key={label as string} direction="row" justifyContent="space-between">
              <Typography variant="body2">{label}</Typography>
              <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatINR(v as Paise)}
              </Typography>
            </Stack>
          ))}
          <Divider />
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Free (not earmarked)
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} color={now.earmarks.free < 0 ? 'warning.main' : undefined}>
              {formatINR(now.earmarks.free)}
            </Typography>
          </Stack>
        </Stack>
        {now.earmarks.free < 0 && (
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
            Negative usually means some savings sit outside this account (an FD, the SIP), or the opening balance wasn’t the balance on the 1st of the start month after the previous salary. Nothing is counted twice: each rupee is either
            savings, owed, or free.
          </Typography>
        )}
      </Card>

      <Card title="✍️ Check against the real balance">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} key={formKey}>
          <AmountField label="Balance in your banking app" value={amount} onChange={setAmount} />
          <TextField type="date" label="On" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: 160 }} />
          <Button variant="contained" disabled={amount === null || !date || date > today} onClick={() => void save()} sx={{ whiteSpace: 'nowrap' }}>
            Check
          </Button>
        </Stack>
        {checks.length > 0 && (
          <Stack spacing={1.5} sx={{ mt: 2 }}>
            {checks.map((b) => {
              const r = compareBalance(reconcile(doc, b.date, { savingsPot: ctx.pot, cardsOwed: ctx.owed }), b.amount);
              return (
                <Box key={b.id} sx={{ p: 1.25, borderRadius: 2, bgcolor: (t) => t.tracker.tonal }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1 }}>
                      {dayjs(b.date).format('ddd D MMM YYYY')} · {formatINR(b.amount)}
                      {b.note && (
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 400 }}>
                          {b.note}
                        </Typography>
                      )}
                    </Typography>
                    {r && <Chip size="small" color={VERDICT[r.verdict].color} label={VERDICT[r.verdict].label} />}
                    <Button size="small" color="inherit" onClick={() => setEditing(b)}>
                      Edit
                    </Button>
                  </Stack>
                  {r && (
                    <Typography variant="body2" color="text.secondary">
                      Expected {formatINR(r.expected)} ({formatINR(r.diff, { sign: true })}). {r.message}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Stack>
        )}
      </Card>
      {editing && <BalanceDialog check={editing} onClose={() => setEditing(null)} />}
    </Stack>
  );
}
