import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import { Card } from '../fitness/ui';
import { cardStatus, combinedCap } from './engine';
import { useFinance } from './FinanceContext';
import { formatINR } from './model';
import { Bar } from './MonthPage';
import { WeeklyCapBar } from './PlannerCards';

const d = (s: string) => dayjs(s).format('D MMM');

/** Each card's current cycle, utilisation, available limit, expected bill and due date. */
export default function CardsPage() {
  const { doc } = useFinance();
  const today = dayjs().format('YYYY-MM-DD');
  const cards = useMemo(() => (doc ? doc.settings.cards.map((c) => cardStatus(doc, c, today)) : []), [doc, today]);
  const cap = useMemo(() => (doc ? combinedCap(doc, today) : null), [doc, today]);
  if (!doc || !cap) return null;
  const owed = cards.reduce((a, c) => a + c.outstanding, 0);

  return (
    <Stack spacing={2} sx={{ maxWidth: 860 }}>
      <WeeklyCapBar />
      <Card title="💳 Both cards">
        <Bar label={`Combined, ${dayjs().format('MMMM')}`} value={cap.spent} max={cap.cap} detail={cap.level === 'over' ? 'Over the combined cap.' : `${formatINR(Math.max(0, cap.cap - cap.spent))} left this month`} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Owed on cards now: <b>{formatINR(owed)}</b>. Bills are paid in full from salary, so this is money already spent, not extra spending.
        </Typography>
      </Card>

      {cards.map((c) => (
        <Card
          key={c.card.id}
          title={c.card.name}
          aside={c.level === 'over' ? <Chip size="small" color="error" label="Over limit" /> : c.level === 'warn' ? <Chip size="small" color="warning" label="80%+ used" /> : undefined}
        >
          {c.assumedCycle && (
            <Alert severity="info" sx={{ mb: 1.5 }}>
              Statement day not set, so cycles are shown as calendar months. Add it (and the due day) in Settings for exact bills.
            </Alert>
          )}
          {c.level === 'over' && (
            <Alert severity="error" sx={{ mb: 1.5 }}>
              {formatINR(c.spent - c.card.limit)} over the {formatINR(c.card.limit)} limit this cycle.
            </Alert>
          )}
          <Bar label={`This cycle: ${d(c.current.start)} – ${d(c.current.end)}`} value={c.spent} max={c.card.limit} detail={`${formatINR(Math.max(0, c.available))} available · ${Math.round(c.utilisation * 100)}% used${c.oneOffSpent ? ` · incl. ${formatINR(c.oneOffSpent)} planned one-off (no warning)` : ''}`} />
          <Box sx={{ mt: 1.5 }}>
            {c.lastBill ? (
              <Stack direction="row" justifyContent="space-between" spacing={1}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Last statement ({d(c.lastBill.cycle.start)} – {d(c.lastBill.cycle.end)})
                  </Typography>
                  <Typography variant="caption" color={c.lastBill.paid ? 'success.main' : 'text.secondary'}>
                    {c.lastBill.paid ? 'Paid (due date passed; paid in full from salary)' : c.lastBill.dueDate ? `Due ${dayjs(c.lastBill.dueDate).format('ddd D MMM')}` : 'Due day not set'}
                  </Typography>
                </Box>
                <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatINR(c.lastBill.amount)}</Typography>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No closed statement since tracking started.
              </Typography>
            )}
          </Box>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
            {c.card.purpose} · logged with “{c.card.method}”
          </Typography>
        </Card>
      ))}
    </Stack>
  );
}
