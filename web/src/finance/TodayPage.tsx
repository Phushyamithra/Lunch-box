import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Metric } from '../fitness/ui';
import { useSnackbar } from '../layout/Snackbar';
import { cardStatus, combinedCap, monthOf, monthSummary, salaryDate, salaryReceipt } from './engine';
import { useFinance } from './FinanceContext';
import { balanceEntries, MONEY_IN_KINDS, simpleBalance, type BalanceEntry, type MoneyInKind } from './balance';
import { budgetMonth, formatINR, planFor, type MoneyEvent, type Paise, type SalaryReceipt, type Transaction } from './model';
import { WeeklyCapBar } from './PlannerCards';
import { EditTransactionDialog, QuickAdd, TransactionRow } from './TransactionForm';
import { AmountField, FINANCE_SECTIONS } from './ui';

const KEY = 'YYYY-MM-DD';

/** What's still unknown from setup (asked, never guessed). */
function setupGaps(s: NonNullable<ReturnType<typeof useFinance>['doc']>['settings']): string[] {
  const gaps: string[] = [];
  if (s.cards.some((c) => c.statementDay === null || c.dueDay === null)) gaps.push('card statement and due days');
  return gaps;
}

function MoneyInDialog({ plannedSalary, onClose }: { plannedSalary: Paise; onClose: () => void }) {
  const { update } = useFinance();
  const toast = useSnackbar();
  const [kind, setKind] = useState<MoneyInKind>('salary');
  const [amount, setAmount] = useState<Paise | null>(plannedSalary);
  const [date, setDate] = useState(dayjs().format(KEY));
  const [note, setNote] = useState('');
  const save = async () => {
    if (amount === null || amount <= 0 || !date) return;
    const stamp = new Date().toISOString();
    const label = MONEY_IN_KINDS.find((k) => k.key === kind)!.label;
    if (kind === 'salary') {
      const month = date.slice(0, 7);
      await update((d) => {
        // One salary per month: a second one for the same month replaces it.
        const salaries = (d.salaries ?? []).map((r) => (!r.deletedAt && r.month === month ? { ...r, deletedAt: stamp, updatedAt: stamp } : r));
        const row: SalaryReceipt = { id: crypto.randomUUID(), month, date, amount, note: note.trim() || null, updatedAt: stamp, deletedAt: null };
        return { ...d, salaries: [...salaries, row] };
      });
    } else {
      const row: MoneyEvent = { id: crypto.randomUUID(), date, kind, amount, description: note.trim() || label, status: 'settled', settledOn: date, account: 'bank', cardMethod: null, updatedAt: stamp, deletedAt: null };
      await update((d) => ({ ...d, events: [...(d.events ?? []), row] }));
    }
    toast(`➕ ${label} ${formatINR(amount)} added`);
    onClose();
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Add money in</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction="row" spacing={1}>
            {MONEY_IN_KINDS.map((k) => (
              <Chip
                key={k.key}
                label={k.label}
                color={kind === k.key ? 'primary' : 'default'}
                variant={kind === k.key ? 'filled' : 'outlined'}
                onClick={() => {
                  setKind(k.key);
                  if (k.key === 'salary' && amount === null) setAmount(plannedSalary);
                }}
              />
            ))}
          </Stack>
          <AmountField label="Amount" value={amount} onChange={setAmount} autoFocus />
          <TextField type="date" label="Date" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={amount === null || amount <= 0 || !date} onClick={() => void save()}>
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** A money-in entry: shown, and removable. */
function MoneyInRow({ entry }: { entry: BalanceEntry }) {
  const { update } = useFinance();
  const toast = useSnackbar();
  const [confirm, setConfirm] = useState(false);
  const remove = async () => {
    const stamp = new Date().toISOString();
    const gone = <T extends { id: string }>(rows: T[] | undefined) => (rows ?? []).map((r) => (r.id === entry.id ? { ...r, deletedAt: stamp, updatedAt: stamp } : r));
    await update((d) => (entry.source === 'salary' ? { ...d, salaries: gone(d.salaries) } : { ...d, events: gone(d.events) }));
    toast('Removed');
    setConfirm(false);
  };
  return (
    <>
      <Box
        component="button"
        onClick={() => setConfirm(true)}
        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', py: 1, px: 0.5, border: 0, borderBottom: 1, borderColor: 'divider', bgcolor: 'transparent', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}
      >
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600 }}>{entry.label}</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {dayjs(entry.date).format('ddd D MMM')} · money in{entry.note ? ` · ${entry.note}` : ''}
          </Typography>
        </Box>
        <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} color="success.main">
          {formatINR(entry.amount, { sign: entry.amount > 0 })}
        </Typography>
      </Box>
      <Dialog open={confirm} onClose={() => setConfirm(false)}>
        <DialogTitle>Remove this entry?</DialogTitle>
        <DialogContent>
          <Typography>
            {entry.label}, {formatINR(entry.amount)} on {dayjs(entry.date).format('D MMM')}.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(false)}>Cancel</Button>
          <Button color="error" onClick={() => void remove()}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

/** Finance home: the money in your account, what the cards have used, then everything else. */
export default function FinanceToday() {
  const { doc } = useFinance();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [adding, setAdding] = useState(false);
  const [moneyIn, setMoneyIn] = useState(false);
  const today = dayjs().format(KEY);
  const month = doc ? budgetMonth(doc, today) : today.slice(0, 7);
  const account = useMemo(() => (doc ? simpleBalance(doc, today) : null), [doc, today]);
  const recent = useMemo(() => (doc ? balanceEntries(doc, today).reverse().slice(0, 8) : []), [doc, today]);
  if (!doc || !account) return null;

  const gaps = setupGaps(doc.settings);
  const summary = monthSummary(doc, month, today);
  const cards = doc.settings.cards.map((c) => cardStatus(doc, c, today));
  const owed = cards.reduce((a, c) => a + c.outstanding, 0);
  const cap = combinedCap(doc, today);
  const plan = planFor(doc.settings, month);
  const plannedDate = salaryDate(plan, month);
  const salaryNear = !salaryReceipt(doc, monthOf(plannedDate)) && dayjs(plannedDate).diff(today, 'day') <= 3 && dayjs(plannedDate).diff(today, 'day') >= 0;

  return (
    <Stack spacing={3} sx={{ maxWidth: 860 }}>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography color="text.secondary">Balance</Typography>
        <Typography component="p" sx={{ fontSize: 40, fontWeight: 700, lineHeight: 1.15, my: 0.5, fontVariantNumeric: 'tabular-nums' }} color={account.balance < 0 ? 'error.main' : undefined}>
          {formatINR(account.balance)}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          In {formatINR(account.moneyIn)} · Out {formatINR(account.moneyOut)}
        </Typography>
        <Stack direction="row" useFlexGap spacing={1} sx={{ mt: 2, flexWrap: 'wrap', rowGap: 1 }}>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setMoneyIn(true)}>
            Money in
          </Button>
          <Button variant="contained" color="secondary" startIcon={<RemoveRoundedIcon />} onClick={() => setAdding(true)}>
            Expense
          </Button>
        </Stack>
        {salaryNear && (
          <Typography variant="body2" color="primary" sx={{ mt: 1.5 }}>
            Salary is due {dayjs(plannedDate).format('ddd D MMM')}. Add it with Money in when it lands.
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

      <Card title="🧾 Recent" aside={<Button size="small" onClick={() => navigate('/finance/transactions')}>All</Button>}>
        {recent.length ? (
          recent.map((e) => {
            const t = e.source === 'transaction' ? doc.transactions.find((x) => x.id === e.id) : undefined;
            return t ? <TransactionRow key={e.id} tx={t} onOpen={() => setEditing(t)} /> : <MoneyInRow key={e.id} entry={e} />;
          })
        ) : (
          <Typography variant="body2" color="text.secondary">
            Nothing yet. Add money in (salary, refunds) and your expenses: the balance is in minus out.
          </Typography>
        )}
      </Card>

      {editing && <EditTransactionDialog tx={editing} onClose={() => setEditing(null)} />}
      {moneyIn && <MoneyInDialog plannedSalary={plan.salary} onClose={() => setMoneyIn(false)} />}
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
