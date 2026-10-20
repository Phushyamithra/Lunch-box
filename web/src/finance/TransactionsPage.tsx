import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { Box, Chip, IconButton, Stack, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { Card } from '../fitness/ui';
import { useFinance } from './FinanceContext';
import { formatINR, monthTransactions, type Transaction } from './model';
import { EditTransactionDialog, TransactionRow } from './TransactionForm';

/** A month of transactions by day, filterable by category; tap one to edit or delete. */
export default function TransactionsPage() {
  const { doc } = useFinance();
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [category, setCategory] = useState<string | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const all = useMemo(() => (doc ? monthTransactions(doc, month) : []), [doc, month]);
  if (!doc) return null;
  const txs = category ? all.filter((t) => t.category === category) : all;
  const days = [...new Set(txs.map((t) => t.date))];
  const cats = [...new Set(all.map((t) => t.category))];
  const total = txs.reduce((a, t) => a + t.amount, 0);
  const isCurrent = month === dayjs().format('YYYY-MM');

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
      {cats.length > 1 && (
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
          <Chip label="All" color={!category ? 'primary' : 'default'} variant={!category ? 'filled' : 'outlined'} onClick={() => setCategory(null)} />
          {cats.map((c) => (
            <Chip key={c} label={c} color={category === c ? 'primary' : 'default'} variant={category === c ? 'filled' : 'outlined'} onClick={() => setCategory(c)} />
          ))}
        </Stack>
      )}
      <Typography color="text.secondary">
        {txs.length} transaction{txs.length === 1 ? '' : 's'} · {formatINR(total)}
      </Typography>
      {days.length === 0 && (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          Nothing recorded this month.
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
