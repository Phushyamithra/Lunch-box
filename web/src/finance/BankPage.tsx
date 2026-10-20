import { Alert, Box, Button, Chip, Divider, Stack, TextField, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../fitness/ui';
import { useSnackbar } from '../layout/Snackbar';
import { cardStatus, savingsState } from './engine';
import { useFinance } from './FinanceContext';
import { formatINR, type BalanceCheck, type Paise } from './model';
import { compareBalance, reconcile, type Verdict } from './projection';
import { AmountField } from './ui';

const VERDICT: Record<Verdict, { color: 'success' | 'info' | 'warning'; label: string }> = {
  match: { color: 'success', label: 'Matches' },
  explained: { color: 'info', label: 'Explained' },
  unexplained: { color: 'warning', label: 'Check this' },
};

/** What the bank should hold, compared with what it does. */
export default function BankPage() {
  const { doc, update } = useFinance();
  const toast = useSnackbar();
  const navigate = useNavigate();
  const today = dayjs().format('YYYY-MM-DD');
  const [amount, setAmount] = useState<Paise | null>(null);
  const [date, setDate] = useState(today);
  const [formKey, setFormKey] = useState(0);

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
      <Alert severity="info" action={<Button color="inherit" onClick={() => navigate('/finance/settings')}>Settings</Button>}>
        Add your bank balance when tracking started (Settings → Starting point) to see what your account should hold.
      </Alert>
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
  const remove = (b: BalanceCheck) =>
    void update((d) => ({ ...d, balances: d.balances.map((x) => (x.id === b.id ? { ...x, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : x)) }));

  return (
    <Stack spacing={2} sx={{ maxWidth: 860 }}>
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
                    </Typography>
                    {r && <Chip size="small" color={VERDICT[r.verdict].color} label={VERDICT[r.verdict].label} />}
                    <Button size="small" color="inherit" onClick={() => remove(b)}>
                      Remove
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
    </Stack>
  );
}
