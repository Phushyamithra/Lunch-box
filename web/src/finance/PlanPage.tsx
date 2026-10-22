import { Box, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, ToggleButton, ToggleButtonGroup, Typography, useTheme } from '@mui/material';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { Area, Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, Metric } from '../fitness/ui';
import { cardStatus } from './engine';
import { awaitedBonuses, pendingCash } from './extras';
import { YearlyBillsCard } from './PlannerCards';
import { useFinance } from './FinanceContext';
import { formatINR } from './model';
import { projection, type RowKind } from './projection';

const ym = (m: string, fmt = 'MMM YY') => dayjs(`${m}-01`).format(fmt);
const KIND: Record<RowKind, string> = { actual: 'Actual', current: 'This month (part estimate)', projected: 'Estimate' };
const lakh = (p: number) => {
  const r = p / 100;
  return Math.abs(r) >= 100000 ? `${(r / 100000).toFixed(r % 100000 === 0 ? 0 : 1)}L` : Math.abs(r) >= 1000 ? `${Math.round(r / 1000)}k` : String(Math.round(r));
};

/** Month by month until the last goal: actual months, then the plan. */
export default function PlanPage() {
  const { doc } = useFinance();
  const theme = useTheme();
  const today = dayjs().format('YYYY-MM-DD');
  const [view, setView] = useState<'total' | 'goals'>('total');
  const rows = useMemo(() => {
    if (!doc) return [];
    const owed = doc.settings.cards.map((c) => cardStatus(doc, c, today).outstanding).reduce((a, b) => a + b, 0);
    return projection(doc, today, { cardOwed: owed });
  }, [doc, today]);
  if (!doc || !rows.length) return null;
  const goals = doc.settings.goals;
  const last = rows[rows.length - 1];
  const done = last.filling === -1;
  const current = rows.find((r) => r.kind === 'current');
  const thresholds = goals.reduce<{ name: string; at: number }[]>((acc, g) => [...acc, { name: g.name, at: (acc[acc.length - 1]?.at ?? 0) + g.target }], []);

  // Chart series: actual total solid, estimate dashed (the current month joins the two).
  const data = rows.map((r) => ({
    month: r.month,
    savings: r.savings / 100,
    actual: r.kind !== 'projected' ? r.total / 100 : null,
    estimate: r.kind !== 'actual' ? r.total / 100 : null,
    kind: r.kind,
    ...Object.fromEntries(goals.map((_, i) => [`g${i}`, r.goals[i] / 100])),
  }));
  const goalColours = [theme.palette.success.main, theme.palette.primary.main, theme.palette.warning.main, theme.palette.info.main, theme.palette.secondary.main];
  const tip = { background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 12 };
  const axis = { tick: { fill: theme.palette.text.secondary, fontSize: 11 }, stroke: theme.palette.divider };

  return (
    <Stack spacing={2} sx={{ maxWidth: 960 }}>
      <Card title="🧭 Where the plan goes">
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Metric value={done ? ym(last.month, 'MMM YYYY') : '10 yrs+'} caption="every goal funded (estimate)" />
          <Metric value={formatINR(goals.reduce((a, g) => a + g.target, 0))} caption={`across ${goals.length} goals`} />
        </Box>
        {pendingCash(doc).in + pendingCash(doc).out > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Not included: pending refunds and one-offs ({pendingCash(doc).in ? `+${formatINR(pendingCash(doc).in)}` : ''}
            {pendingCash(doc).in && pendingCash(doc).out ? ', ' : ''}
            {pendingCash(doc).out ? `−${formatINR(pendingCash(doc).out)}` : ''}). They count once settled.
          </Typography>
        )}
        {awaitedBonuses(doc).length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Not included: bonus income until received ({awaitedBonuses(doc)
              .map((b) => `${b.name} ${formatINR(b.amount)}${b.certainty === 'estimated' ? ' est.' : ''}`)
              .join(', ')}).
          </Typography>
        )}
        {current && current.pending > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Pending now: {formatINR(current.pending)} (committed costs not yet paid and card bills owed). Already counted in this month’s figures, not extra.
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Finished months are actual. This month mixes what you logged with the plan. Later months assume your salary and costs as set, Wants and Unplanned fully spent
          (anything left over is a bonus), and everyday spending at the card cap.
        </Typography>
      </Card>

      <Card
        title="📈 Savings over time"
        aside={
          <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)} aria-label="Chart view">
            <ToggleButton value="total" sx={{ textTransform: 'none', py: 0.25 }}>
              Total
            </ToggleButton>
            <ToggleButton value="goals" sx={{ textTransform: 'none', py: 0.25 }}>
              By goal
            </ToggleButton>
          </ToggleButtonGroup>
        }
      >
        <Box sx={{ height: 260 }} role="img" aria-label={view === 'total' ? 'Total savings, actual then estimated, with goal milestones' : 'Savings in each goal over time'}>
          <ResponsiveContainer>
            {view === 'total' ? (
              <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
                <CartesianGrid stroke={theme.palette.divider} vertical={false} />
                <XAxis dataKey="month" tickFormatter={(v) => ym(v)} {...axis} minTickGap={16} />
                <YAxis tickFormatter={(v) => lakh(v * 100)} {...axis} width={44} />
                <Tooltip
                  contentStyle={tip}
                  labelFormatter={(v) => ym(v as string, 'MMMM YYYY')}
                  formatter={(v: number, name) => [formatINR(Math.round(v * 100)), name === 'savings' ? 'Saved that month' : name === 'actual' ? 'Total (actual)' : 'Total (estimate)']}
                />
                {thresholds.map((t) => (
                  <ReferenceLine key={t.name} y={t.at / 100} stroke={theme.palette.text.disabled} strokeDasharray="2 4" label={{ value: t.name, position: 'insideTopLeft', fill: theme.palette.text.secondary, fontSize: 10 }} />
                ))}
                <Bar dataKey="savings" radius={[3, 3, 0, 0]}>
                  {data.map((d) => (
                    <Cell key={d.month} fill={d.savings < 0 ? theme.palette.error.main : theme.palette.primary.main} fillOpacity={d.kind === 'projected' ? 0.35 : 0.9} />
                  ))}
                </Bar>
                <Line dataKey="actual" stroke={theme.palette.success.main} strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
                <Line dataKey="estimate" stroke={theme.palette.success.main} strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls={false} isAnimationActive={false} />
              </ComposedChart>
            ) : (
              <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
                <CartesianGrid stroke={theme.palette.divider} vertical={false} />
                <XAxis dataKey="month" tickFormatter={(v) => ym(v)} {...axis} minTickGap={16} />
                <YAxis tickFormatter={(v) => lakh(v * 100)} {...axis} width={44} />
                <Tooltip contentStyle={tip} labelFormatter={(v) => ym(v as string, 'MMMM YYYY')} formatter={(v: number, name) => [formatINR(Math.round(v * 100)), goals[Number(String(name).slice(1))]?.name ?? name]} />
                {goals.map((g, i) => (
                  <Area key={g.id} dataKey={`g${i}`} stackId="1" stroke={goalColours[i % goalColours.length]} fill={goalColours[i % goalColours.length]} fillOpacity={0.35} isAnimationActive={false} />
                ))}
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {view === 'total'
            ? 'Bars: saved each month (faded = estimate, red = a month that dips into savings). Line: running total, solid = actual, dashed = estimate. Dotted lines: where each goal is full.'
            : 'Each colour is a goal, filled in order: the next one starts only when the one below is full.'}
        </Typography>
      </Card>

      <YearlyBillsCard />

      <Card title="🗓️ Month by month">
        <Box sx={{ overflowX: 'auto', mx: -1 }}>
          <Table size="small" aria-label="Monthly projection">
            <TableHead>
              <TableRow>
                <TableCell>Month</TableCell>
                <TableCell align="right">Saves</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell>Filling</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.month} sx={{ opacity: r.kind === 'projected' ? 0.85 : 1, bgcolor: r.kind === 'current' ? (t) => t.tracker.tonal : undefined }}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Typography variant="body2" sx={{ fontWeight: r.kind === 'current' ? 700 : 400 }}>
                      {ym(r.month, 'MMM YYYY')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {KIND[r.kind]}
                      {r.notes.length ? ` · ${r.notes.join(', ')}` : ''}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: r.savings < 0 ? 'error.main' : undefined, fontStyle: r.kind === 'projected' ? 'italic' : undefined }}>
                    {formatINR(r.savings, { sign: true })}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontStyle: r.kind === 'projected' ? 'italic' : undefined }}>
                    {formatINR(r.total)}
                  </TableCell>
                  <TableCell>
                    {r.completes.length > 0 ? (
                      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                        {r.completes.map((g) => (
                          <Chip key={g} size="small" color="success" label={`✓ ${goals[g].name}`} />
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {r.filling >= 0 ? goals[r.filling].name : 'All funded'}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <Typography variant="caption" color="text.secondary">
          Italics: estimates. Totals include what you’d saved before tracking.
        </Typography>
      </Card>
    </Stack>
  );
}
