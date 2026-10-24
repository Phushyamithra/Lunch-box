import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { Box, Chip, IconButton, LinearProgress, Stack, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Card } from '../fitness/ui';
import { useFinance } from './FinanceContext';
import { formatINR, monthTransactions, planFor, type Transaction } from './model';
import { budgetTimeline, byMethod } from './reports';
import { EditTransactionDialog, TransactionRow } from './TransactionForm';

const KIND_HINT = { bank: 'from your bank', card: 'card: billed later', voucher: 'voucher: not cash', other: '' } as const;

function FilterChips({ label, options, value, onChange }: { label: string; options: string[]; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.75 }} alignItems="center" aria-label={label}>
      <Typography variant="caption" color="text.secondary" sx={{ width: 64 }}>
        {label}
      </Typography>
      <Chip size="small" label="All" color={!value ? 'primary' : 'default'} variant={!value ? 'filled' : 'outlined'} onClick={() => onChange(null)} />
      {options.map((o) => (
        <Chip key={o} size="small" label={o} color={value === o ? 'primary' : 'default'} variant={value === o ? 'filled' : 'outlined'} onClick={() => onChange(value === o ? null : o)} />
      ))}
    </Stack>
  );
}

/** A month of transactions: totals by how you paid, filters by category and method, and budget timelines. */
export default function TransactionsPage() {
  const { doc } = useFinance();
  const initial = (useLocation().state ?? null) as { category?: string; method?: string; month?: string } | null;
  const [month, setMonth] = useState(initial?.month ?? dayjs().format('YYYY-MM'));
  const [category, setCategory] = useState<string | null>(initial?.category ?? null);
  const [method, setMethod] = useState<string | null>(initial?.method ?? null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const all = useMemo(() => (doc ? monthTransactions(doc, month) : []), [doc, month]);
  const methods = useMemo(() => (doc ? byMethod(doc, month) : null), [doc, month]);
  const budget = useMemo(() => (doc && category ? budgetTimeline(doc, category, month) : null), [doc, category, month]);
  if (!doc || !methods) return null;
  const txs = all.filter((t) => (!category || t.category === category) && (!method || t.method === method));
  const days = [...new Set(txs.map((t) => t.date))];
  const cats = [...new Set(all.map((t) => t.category))];
  const total = txs.reduce((a, t) => a + t.amount, 0);
  const isCurrent = month === dayjs().format('YYYY-MM');
  const isBudget = !!budget && budget.limit !== null;
  const budgetCategories = planFor(doc.settings, month).budgets.map((b) => b.category);

  return (
    <Stack spacing={2} sx={{ maxWidth: 860 }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <IconButton aria-label="Previous month" onClick={() => setMonth(dayjs(`${month}-01`).subtract(1, 'month').format('YYYY-MM'))}>
          <ChevronLeftRoundedIcon />
        </IconButton>
        <Typography variant="h6" component="h2" sx={{ flexGrow: 1, textAlign: 'center' }}>
          {dayjs(`${month}-01`).format('MMMM YYYY')}
        </Typography>
        <IconButton aria-label="Next month" disabled={isCurrent} onClick={() => setMonth(dayjs(`${month}-01`).add(1, 'month').format('YYYY-MM'))}>
          <ChevronRightRoundedIcon />
        </IconButton>
      </Box>

      {methods.methods.length > 0 && (
        <Card title="💳 Paid via">
          <Stack spacing={0.25}>
            {methods.methods.map((m) => (
              <Box
                key={m.method}
                component="button"
                onClick={() => setMethod(method === m.method ? null : m.method)}
                aria-pressed={method === m.method}
                sx={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 1,
                  width: '100%',
                  py: 0.75,
                  px: 1,
                  border: 0,
                  borderRadius: 2,
                  textAlign: 'left',
                  font: 'inherit',
                  color: 'inherit',
                  cursor: 'pointer',
                  bgcolor: (t) => (method === m.method ? t.tracker.tonal : 'transparent'),
                }}
              >
                <Typography sx={{ fontWeight: 600, flexGrow: 1 }}>
                  {m.method}
                  <Typography component="span" variant="caption" color="text.secondary">
                    {' '}
                    · {m.count} · {KIND_HINT[m.kind]}
                  </Typography>
                </Typography>
                <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatINR(m.total)}</Typography>
              </Box>
            ))}
            {methods.bankOneOffs > 0 && (
              <Stack direction="row" sx={{ px: 1, py: 0.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                  + one-offs out of the bank (e.g. old card bills)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatINR(methods.bankOneOffs)}
                </Typography>
              </Stack>
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Tap one to list only those. Bank total this month (UPI + debit + one-offs):{' '}
            {formatINR(methods.methods.filter((m) => m.kind === 'bank').reduce((a, m) => a + m.total, 0) + methods.bankOneOffs)}.
          </Typography>
        </Card>
      )}

      {isBudget && budget && (
        <Card
          title={`🎚️ ${category} this month`}
          aside={<Chip size="small" color={budget.spent > (budget.limit ?? 0) ? 'warning' : 'success'} variant="outlined" label={budget.usedUpOn ? `Used up ${dayjs(budget.usedUpOn).format('D MMM')}` : `${formatINR((budget.limit ?? 0) - budget.spent)} left`} />}
        >
          <LinearProgress
            variant="determinate"
            value={Math.min(100, (budget.spent / (budget.limit || 1)) * 100)}
            color={budget.spent > (budget.limit ?? 0) ? 'warning' : 'primary'}
            sx={{ height: 8, borderRadius: 4, mb: 1 }}
            aria-label={`${category} budget used`}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {formatINR(budget.spent)} of {formatINR(budget.limit ?? 0)}
            {budget.spent > (budget.limit ?? 0) ? `: ${formatINR(budget.spent - (budget.limit ?? 0))} over` : ''}. Voucher purchases don’t use it.
          </Typography>
          <Stack spacing={0.25}>
            {budget.steps.map((s) => (
              <Stack key={s.id} direction="row" spacing={1} alignItems="baseline" sx={{ color: s.running > (budget.limit ?? 0) && !s.crossed ? 'warning.main' : undefined }}>
                <Typography variant="body2" sx={{ width: 52, flexShrink: 0 }} color="text.secondary">
                  {dayjs(s.date).format('D MMM')}
                </Typography>
                <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
                  {s.label}
                  {s.crossed ? ' · budget used up here' : ''}
                </Typography>
                <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {formatINR(s.amount)} → {formatINR(s.running)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Card>
      )}

      <Stack spacing={1}>
        {cats.length > 1 && <FilterChips label="Category" options={[...new Set([...budgetCategories.filter((c) => cats.includes(c)), ...cats])]} value={category} onChange={setCategory} />}
        {methods.methods.length > 1 && <FilterChips label="Paid via" options={methods.methods.map((m) => m.method)} value={method} onChange={setMethod} />}
      </Stack>

      <Typography color="text.secondary">
        {txs.length} transaction{txs.length === 1 ? '' : 's'} · {formatINR(total)}
        {category || method ? ` (${[category, method].filter(Boolean).join(' · ')})` : ''}
      </Typography>
      {days.length === 0 && (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          Nothing recorded{category || method ? ' with these filters' : ' this month'}.
        </Typography>
      )}
      {days.map((day) => {
        const list = txs.filter((t) => t.date === day);
        return (
          <Card key={day} title={dayjs(day).format('ddd D MMM')} aside={<Typography variant="body2" color="text.secondary">{formatINR(list.reduce((a, t) => a + t.amount, 0))}</Typography>}>
            {list.map((t) => (
              <TransactionRow key={t.id} tx={t} onOpen={() => setEditing(t)} />
            ))}
          </Card>
        );
      })}
      {editing && <EditTransactionDialog tx={editing} onClose={() => setEditing(null)} />}
    </Stack>
  );
}
