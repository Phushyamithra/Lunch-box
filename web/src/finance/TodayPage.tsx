import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Metric } from '../fitness/ui';
import { useSnackbar } from '../layout/Snackbar';
import { addMonths, cardStatus, combinedCap, monthSummary, salaryDate, salaryReceipt } from './engine';
import { useFinance } from './FinanceContext';
import { budgetMonth, formatINR, monthTransactions, planFor, type BalanceCheck, type Paise, type SalaryReceipt, type Transaction } from './model';
import { WeeklyCapBar } from './PlannerCards';
import { accountNow } from './projection';
import { EditTransactionDialog, QuickAdd, TransactionRow } from './TransactionForm';
import { AmountField, FINANCE_SECTIONS } from './ui';

const KEY = 'YYYY-MM-DD';

/** What's still unknown from setup (asked, never guessed). */
function setupGaps(s: NonNullable<ReturnType<typeof useFinance>['doc']>['settings']): string[] {
  const gaps: string[] = [];
  if (s.cards.some((c) => c.statementDay === null || c.dueDay === null)) gaps.push('card statement and due days');
  if (s.openingBalance === null) gaps.push('your bank balance when tracking started');
  return gaps;
}

function SalaryDialog({ month, planned, plannedDate, existing, onClose }: { month: string; planned: Paise; plannedDate: string; existing: SalaryReceipt | null; onClose: () => void }) {
  const { update } = useFinance();
  const toast = useSnackbar();
  const today = dayjs().format(KEY);
  const [amount, setAmount] = useState<Paise | null>(existing?.amount ?? planned);
  const [date, setDate] = useState(existing?.date ?? (plannedDate > today ? today : plannedDate));
  const stamp = () => new Date().toISOString();
  const save = async () => {
    if (amount === null) return;
    const row: SalaryReceipt = { id: existing?.id ?? crypto.randomUUID(), month, date, amount, note: null, updatedAt: stamp(), deletedAt: null };
    await update((d) => ({ ...d, salaries: [...(d.salaries ?? []).filter((r) => r.id !== row.id), row] }));
    toast(`💼 Salary ${formatINR(amount)} recorded`);
    onClose();
  };
  const remove = async () => {
    if (!existing) return;
    await update((d) => ({ ...d, salaries: (d.salaries ?? []).map((r) => (r.id === existing.id ? { ...r, deletedAt: stamp(), updatedAt: stamp() } : r)) }));
    toast('Salary record removed; the planned salary applies again');
    onClose();
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{dayjs(`${month}-01`).format('MMMM')} salary</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <AmountField label="Amount received" value={amount} onChange={setAmount} autoFocus helperText={`Planned: ${formatINR(planned)}. It pays ${dayjs(`${addMonths(month, 1)}-01`).format('MMMM')}’s bills.`} />
          <TextField type="date" label="Credited on" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        {existing && (
          <Button color="error" onClick={() => void remove()} sx={{ mr: 'auto' }}>
            Remove
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={amount === null || amount <= 0 || !date} onClick={() => void save()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function BalanceUpdateDialog({ onClose }: { onClose: () => void }) {
  const { update } = useFinance();
  const toast = useSnackbar();
  const [amount, setAmount] = useState<Paise | null>(null);
  const save = async () => {
    if (amount === null) return;
    const stamp = new Date().toISOString();
    const row: BalanceCheck = { id: crypto.randomUUID(), date: dayjs().format(KEY), amount, note: null, updatedAt: stamp, deletedAt: null };
    await update((d) => ({ ...d, balances: [...d.balances, row] }));
    toast('Balance updated');
    onClose();
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>What’s in your account now?</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          <AmountField label="Balance today" value={amount} onChange={setAmount} autoFocus helperText="All your bank accounts together, from your banking app. Past entries are under Bank." />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={amount === null} onClick={() => void save()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Finance home: the money in your account, what the cards have used, then everything else. */
export default function FinanceToday() {
  const { doc } = useFinance();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [adding, setAdding] = useState(false);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const today = dayjs().format(KEY);
  const month = doc ? budgetMonth(doc, today) : today.slice(0, 7);
  const txs = useMemo(() => (doc ? monthTransactions(doc, month) : []), [doc, month]);
  const account = useMemo(() => (doc ? accountNow(doc, today) : null), [doc, today]);
  if (!doc || !account) return null;

  const gaps = setupGaps(doc.settings);
  const summary = monthSummary(doc, month, today);
  const cards = doc.settings.cards.map((c) => cardStatus(doc, c, today));
  const owed = cards.reduce((a, c) => a + c.outstanding, 0);
  const cap = combinedCap(doc, today);
  const plan = planFor(doc.settings, month);
  const plannedDate = salaryDate(plan, month);
  const receipt = salaryReceipt(doc, month);
  const salaryNear = !receipt && dayjs(plannedDate).diff(today, 'day') <= 3;

  return (
    <Stack spacing={3} sx={{ maxWidth: 860 }}>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography color="text.secondary">In your account</Typography>
        <Typography component="p" sx={{ fontSize: 40, fontWeight: 700, lineHeight: 1.15, my: 0.5, fontVariantNumeric: 'tabular-nums' }}>
          {account.amount === null ? '—' : formatINR(account.amount)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {account.amount === null
            ? 'Enter your balance to start.'
            : account.from
              ? `From your ${formatINR(account.from.amount)} on ${dayjs(account.from.date).format('D MMM')}, plus what’s logged since.`
              : 'Estimated from your opening balance and what’s logged.'}
        </Typography>
        <Stack direction="row" useFlexGap spacing={1} sx={{ mt: 2, flexWrap: 'wrap', rowGap: 1 }}>
          <Button variant="contained" onClick={() => setSalaryOpen(true)}>
            {receipt ? `Salary ${formatINR(receipt.amount)} ✓` : 'Add salary'}
          </Button>
          <Button variant="outlined" onClick={() => setBalanceOpen(true)}>
            Update balance
          </Button>
        </Stack>
        {salaryNear && (
          <Typography variant="body2" color="primary" sx={{ mt: 1.5 }}>
            Salary is due {dayjs(plannedDate).format('ddd D MMM')} ({formatINR(plan.salary)}). Add it when it lands.
          </Typography>
        )}
      </Paper>

      {gaps.length > 0 && (
        <Alert severity="info" action={<Button color="inherit" onClick={() => navigate('/finance/settings')}>Settings</Button>}>
          To finish setup, add {gaps.join(' and ')}.
        </Alert>
      )}

      <Card title="💳 Cards used" aside={<Typography variant="body2" color="text.secondary">Owed {formatINR(owed)}</Typography>}>
        <Stack spacing={2}>
          {cards.map((c) => {
            const ratio = c.card.limit > 0 ? c.spent / c.card.limit : 0;
            return (
              <Box key={c.card.id} component="button" onClick={() => navigate('/finance/cards')} sx={{ display: 'block', width: '100%', p: 0, border: 0, bgcolor: 'transparent', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                  <Typography sx={{ fontWeight: 600 }}>{c.card.name}</Typography>
                  <Typography sx={{ fontVariantNumeric: 'tabular-nums' }} color={c.level === 'over' ? 'error.main' : undefined}>
                    {formatINR(c.spent)} <Typography component="span" variant="body2" color="text.secondary">/ {formatINR(c.card.limit)}</Typography>
                  </Typography>
                </Stack>
                <LinearProgress variant="determinate" value={Math.min(100, ratio * 100)} color={c.level === 'over' ? 'error' : c.level === 'warn' ? 'warning' : 'primary'} sx={{ height: 8, borderRadius: 4 }} aria-label={`${c.card.name} used`} />
              </Box>
            );
          })}
          <Typography variant="body2" color="text.secondary">
            Both this month: {formatINR(cap.spent)} of {formatINR(cap.cap)}
          </Typography>
        </Stack>
      </Card>

      <WeeklyCapBar />

      <Button variant="contained" size="large" startIcon={<AddRoundedIcon />} onClick={() => setAdding(true)} sx={{ py: 1.5 }}>
        Add expense
      </Button>

      <Card title={`📅 ${dayjs(`${month}-01`).format('MMMM')}`}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Metric value={formatINR(summary.leftInBudgets)} caption="left in budgets" />
          <Metric value={formatINR(summary.savings)} caption="expected to save" />
        </Box>
      </Card>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5 }}>
        {FINANCE_SECTIONS.map((s) => (
          <Paper key={s.path} variant="outlined" component="button" onClick={() => navigate(s.path)} sx={{ p: 2, textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit' }}>
            <Typography sx={{ fontSize: 22, lineHeight: 1.2 }} aria-hidden>
              {s.emoji}
            </Typography>
            <Typography sx={{ fontWeight: 700, mt: 0.75 }}>{s.label}</Typography>
            <Typography variant="caption" color="text.secondary">
              {s.hint}
            </Typography>
          </Paper>
        ))}
      </Box>

      <Card title="🧾 Recent" aside={txs.length > 6 ? <Button size="small" onClick={() => navigate('/finance/transactions')}>All</Button> : undefined}>
        {txs.length ? (
          txs.slice(0, 6).map((t) => <TransactionRow key={t.id} tx={t} onOpen={() => setEditing(t)} />)
        ) : (
          <Typography variant="body2" color="text.secondary">
            Nothing yet this month.
          </Typography>
        )}
      </Card>

      {editing && <EditTransactionDialog tx={editing} onClose={() => setEditing(null)} />}
      {salaryOpen && <SalaryDialog month={month} planned={plan.salary} plannedDate={plannedDate} existing={receipt} onClose={() => setSalaryOpen(false)} />}
      {balanceOpen && <BalanceUpdateDialog onClose={() => setBalanceOpen(false)} />}
      <Dialog open={adding} onClose={() => setAdding(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add expense</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <QuickAdd />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdding(false)}>Done</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
