import { Box, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { Card, Metric } from '../fitness/ui';
import { savingsState } from './engine';
import { useFinance } from './FinanceContext';
import { formatINR } from './model';

const ym = (m: string) => dayjs(`${m}-01`).format('MMM YYYY');

/** The waterfall: each goal fills only after the ones above it. */
export default function SavingsPage() {
  const { doc } = useFinance();
  const today = dayjs().format('YYYY-MM-DD');
  const st = useMemo(() => (doc ? savingsState(doc, today) : null), [doc, today]);
  if (!doc || !st) return null;
  const total = doc.settings.goals.reduce((a, g) => a + g.target, 0);

  return (
    <Stack spacing={2} sx={{ maxWidth: 860 }}>
      <Card title="🪜 Savings">
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Metric value={formatINR(st.actualTotal)} caption={`saved (actual) of ${formatINR(total)}`} />
          <Metric value={st.allDoneBy ? ym(st.allDoneBy) : '—'} caption="all goals, if the plan holds (estimate)" />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Actual = what you’d saved before tracking + every finished month. This month adds about {formatINR(st.currentProjected, { sign: true })} (projected). Dates ahead
          follow your plan: salary, committed costs, budgets fully used, everyday spending at the card cap, December’s gym, and the gold scheme ending.
        </Typography>
      </Card>

      {st.goals.map((g, i) => {
        const active = !g.done && (i === 0 || st.goals[i - 1].done);
        return (
          <motion.div key={g.goal.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.2 }}>
            <Card
              title={`${i + 1}. ${g.goal.name}`}
              aside={g.done ? <Chip size="small" color="success" label="Funded" /> : active ? <Chip size="small" color="primary" label="Filling now" /> : <Chip size="small" variant="outlined" label="Waiting" />}
            >
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatINR(g.saved)} of {formatINR(g.goal.target)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {g.percent}%
                </Typography>
              </Stack>
              <LinearProgress variant="determinate" value={g.percent} color={g.done ? 'success' : 'primary'} sx={{ height: 10, borderRadius: 5, opacity: g.done || active ? 1 : 0.5 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {g.done ? 'Done.' : `${formatINR(g.remaining)} to go · expected ${g.eta ? ym(g.eta) : 'beyond 10 years at this rate'} (estimate)`}
              </Typography>
              {g.goal.note && (
                <Typography variant="caption" color="text.secondary">
                  {g.goal.note}
                </Typography>
              )}
            </Card>
          </motion.div>
        );
      })}

      {st.months.length > 0 && (
        <Card title="📜 Finished months (actual)">
          <Stack spacing={0.5}>
            {[...st.months].reverse().map((m) => (
              <Stack key={m.month} direction="row" justifyContent="space-between">
                <Typography variant="body2">{ym(m.month)}</Typography>
                <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }} color={m.savings < 0 ? 'error.main' : undefined}>
                  {formatINR(m.savings, { sign: true })}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
