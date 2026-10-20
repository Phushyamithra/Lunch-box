import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Metric } from '../fitness/ui';
import { monthSummary } from './engine';
import { useFinance } from './FinanceContext';
import { formatINR, monthTransactions, type Transaction } from './model';
import { EditTransactionDialog, QuickAdd, TransactionRow } from './TransactionForm';

/** What's still unknown from setup (asked, never guessed). */
function setupGaps(s: NonNullable<ReturnType<typeof useFinance>['doc']>['settings']): string[] {
  const gaps: string[] = [];
  if (s.cards.some((c) => c.statementDay === null || c.dueDay === null)) gaps.push('card statement and due days');
  if (s.openingBalance === null) gaps.push('your bank balance when tracking started');
  if (s.goals.every((g) => g.savedAtStart === 0)) gaps.push('what you’ve already saved toward each goal (0 is fine if nothing yet)');
  return gaps;
}

/** Quick add and this month at a glance. Budgets, cards and the savings waterfall come in stage 2. */
export default function FinanceToday() {
  const { doc } = useFinance();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const month = dayjs().format('YYYY-MM');
  const txs = useMemo(() => (doc ? monthTransactions(doc, month) : []), [doc, month]);
  if (!doc) return null;
  const total = txs.reduce((a, t) => a + t.amount, 0);
  const byCategory = [...txs.reduce((m, t) => m.set(t.category, (m.get(t.category) ?? 0) + t.amount), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const gaps = setupGaps(doc.settings);
  const summary = monthSummary(doc, month, dayjs().format('YYYY-MM-DD'));

  return (
    <Stack spacing={2} sx={{ maxWidth: 860 }}>
      {gaps.length > 0 && (
        <Alert severity="info" action={<Button color="inherit" onClick={() => navigate('/finance/settings')}>Settings</Button>}>
          To finish setup, add {gaps.join(', ')}.
        </Alert>
      )}
      <Card title="➕ Quick add">
        <QuickAdd />
      </Card>
      <Card title={`📅 ${dayjs().format('MMMM')} so far`} aside={<Button size="small" onClick={() => navigate('/finance/month')}>Month</Button>}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: byCategory.length ? 2 : 0 }}>
          <Metric value={formatINR(summary.leftInBudgets)} caption="left in budgets this month" />
          <Metric value={formatINR(summary.savings)} caption="expected to save" />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: byCategory.length ? 1 : 0 }}>
          Logged {formatINR(total)} in {txs.length} transaction{txs.length === 1 ? '' : 's'}.
        </Typography>
        {byCategory.length > 0 && (
          <Stack spacing={0.5}>
            {byCategory.map(([c, v]) => (
              <Stack key={c} direction="row" justifyContent="space-between">
                <Typography variant="body2">{c}</Typography>
                <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatINR(v)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </Card>
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
    </Stack>
  );
}
