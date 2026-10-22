import { Box, Button, Chip, LinearProgress, Stack, Table, TableBody, TableCell, TableHead, TableRow, ToggleButton, ToggleButtonGroup, Typography, useTheme } from '@mui/material';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '../fitness/ui';
import { addMonths } from './engine';
import { useFinance } from './FinanceContext';
import { formatINR, VOUCHER_METHOD } from './model';
import { cardTrends, categoryTrends, goalReport, monthlyCsv, monthlyRows, transactionsCsv } from './reports';

const mon = (m: string, f = 'MMM YY') => dayjs(`${m}-01`).format(f);
const k = (p: number) => {
  const r = p / 100;
  return Math.abs(r) >= 1000 ? `${Math.round(r / 1000)}k` : String(Math.round(r));
};
function download(name: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Monthly summaries, actual vs plan, category and card trends, goals, and exports. */
export default function ReportsPage() {
  const { doc } = useFinance();
  const theme = useTheme();
  const navigate = useNavigate();
  const today = dayjs().format('YYYY-MM-DD');
  const current = today.slice(0, 7);
  const [span, setSpan] = useState<3 | 6 | 12 | 0>(6);
  const from = doc ? (span === 0 ? doc.settings.startMonth : addMonths(current, -(span - 1))) : current;
  const rows = useMemo(() => (doc ? monthlyRows(doc, from, current, today) : []), [doc, from, current, today]);
  const months = rows.map((r) => r.month);
  const cats = useMemo(() => (doc ? categoryTrends(doc, months) : []), [doc, months.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const cards = useMemo(() => (doc ? cardTrends(doc, months) : []), [doc, months.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const goals = useMemo(() => (doc ? goalReport(doc, today) : null), [doc, today]);
  if (!doc || !goals) return null;

  const actualRows = rows.filter((r) => r.kind === 'actual');
  const saved = actualRows.reduce((a, r) => a + r.savings, 0);
  const plan = actualRows.reduce((a, r) => a + r.planned, 0);
  const axis = { tick: { fill: theme.palette.text.secondary, fontSize: 11 }, stroke: theme.palette.divider };
  const tip = { background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 12 };
  const lineColours = [theme.palette.primary.main, theme.palette.warning.main, theme.palette.info.main, theme.palette.success.main];
  const chart = rows.map((r) => ({ month: r.month, saved: r.savings / 100, plan: r.planned / 100, kind: r.kind }));
  const cardChart = months.map((m, i) => ({ month: m, ...Object.fromEntries(cards.map((c, j) => [`c${j}`, c.byMonth[i] / 100])) }));

  return (
    <Stack spacing={2} sx={{ maxWidth: 960 }}>
      <ToggleButtonGroup exclusive size="small" value={span} onChange={(_, v) => v !== null && setSpan(v)} aria-label="Period">
        {([3, 6, 12, 0] as const).map((v) => (
          <ToggleButton key={v} value={v} sx={{ textTransform: 'none', px: 2 }}>
            {v === 0 ? 'Since start' : `${v} months`}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {rows.length === 0 ? (
        <Card title="📊 Reports">
          <Typography color="text.secondary">No tracked months in this period yet.</Typography>
        </Card>
      ) : (
        <>
          <Card title="📊 Actual vs plan">
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {actualRows.length
                ? `Finished months saved ${formatINR(saved)} against a plan of ${formatINR(plan)} (${formatINR(saved - plan, { sign: true })}).`
                : 'No finished months in this period yet; this month is part estimate.'}
            </Typography>
            <Box sx={{ height: 220 }} role="img" aria-label="Saved each month against the plan">
              <ResponsiveContainer>
                <ComposedChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                  <CartesianGrid stroke={theme.palette.divider} vertical={false} />
                  <XAxis dataKey="month" tickFormatter={(v) => mon(v)} {...axis} />
                  <YAxis tickFormatter={(v) => k(v * 100)} {...axis} width={40} />
                  <Tooltip contentStyle={tip} labelFormatter={(v) => mon(v as string, 'MMMM YYYY')} formatter={(v: number, name) => [formatINR(Math.round(v * 100)), name === 'saved' ? 'Saved' : 'Plan said']} />
                  <Bar dataKey="saved" fill={theme.palette.success.main} radius={[4, 4, 0, 0]} />
                  <Line dataKey="plan" stroke={theme.palette.text.primary} strokeDasharray="4 4" dot={{ r: 3 }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </Box>
            <Typography variant="caption" color="text.secondary">
              Bars: saved (this month’s bar is part estimate). Dashed: what the plan said for that month.
            </Typography>
          </Card>

          <Card title="🗓️ Monthly summary">
            <Box sx={{ overflowX: 'auto', mx: -1 }}>
              <Table size="small" aria-label="Monthly summary">
                <TableHead>
                  <TableRow>
                    <TableCell>Month</TableCell>
                    <TableCell align="right">Committed</TableCell>
                    <TableCell align="right">Budgets</TableCell>
                    <TableCell align="right">Needs</TableCell>
                    <TableCell align="right">Saved</TableCell>
                    <TableCell align="right">vs plan</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...rows].reverse().map((r) => (
                    <TableRow key={r.month}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {mon(r.month, 'MMM YYYY')}
                        <Typography variant="caption" color="text.secondary" component="div">
                          {r.kind === 'actual' ? 'actual' : 'part estimate'}
                          {r.otherIncome + r.events ? ` · +${formatINR(r.otherIncome + r.events)} extra` : ''}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatINR(r.committed)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatINR(r.budgets)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatINR(r.needs)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: r.savings < 0 ? 'error.main' : undefined }}>
                        {formatINR(r.savings)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: r.savings >= r.planned ? 'success.main' : 'warning.main' }}>
                        {formatINR(r.savings - r.planned, { sign: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Card>

          <Card title="🏷️ Spending by category (logged)">
            {cats.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nothing logged in this period.
              </Typography>
            ) : (
              <Stack spacing={1.25}>
                {cats.slice(0, 10).map((c) => {
                  const max = cats[0].total;
                  return (
                    <Box key={c.category}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {c.category}
                        </Typography>
                        <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatINR(c.total)} · avg {formatINR(Math.round(c.total / months.length))}/mo
                        </Typography>
                      </Stack>
                      <LinearProgress variant="determinate" value={(c.total / max) * 100} sx={{ height: 6, borderRadius: 3 }} />
                      <Typography variant="caption" color="text.secondary">
                        {c.byMonth.map((v, i) => `${mon(months[i], 'MMM')} ${v ? formatINR(v) : '—'}`).join(' · ')}
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
            )}
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
              Everything you logged, including purchases paid with {VOUCHER_METHOD} vouchers. Committed costs you didn’t log aren’t here.
            </Typography>
          </Card>

          <Card title="💳 Cards by month">
            <Box sx={{ height: 200 }} role="img" aria-label="Card spending per month">
              <ResponsiveContainer>
                <LineChart data={cardChart} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                  <CartesianGrid stroke={theme.palette.divider} vertical={false} />
                  <XAxis dataKey="month" tickFormatter={(v) => mon(v)} {...axis} />
                  <YAxis tickFormatter={(v) => k(v * 100)} {...axis} width={40} />
                  <Tooltip contentStyle={tip} labelFormatter={(v) => mon(v as string, 'MMMM YYYY')} formatter={(v: number, name) => [formatINR(Math.round(v * 100)), cards[Number(String(name).slice(1))]?.name ?? name]} />
                  <Legend formatter={(v) => cards[Number(String(v).slice(1))]?.name ?? v} wrapperStyle={{ fontSize: 12 }} />
                  {cards.map((c, i) => (
                    <Line key={c.name} dataKey={`c${i}`} stroke={lineColours[i % lineColours.length]} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Box>
            <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
              {cards.map((c) => {
                const peak = Math.max(...c.byMonth);
                return <Chip key={c.name} size="small" variant="outlined" color={peak > c.limit ? 'error' : 'default'} label={`${c.name}: peak ${formatINR(peak)} of ${formatINR(c.limit)}`} />;
              })}
            </Stack>
          </Card>
        </>
      )}

      <Card title="🪜 Goal progress">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Saved so far (actual): {formatINR(goals.actualTotal)}. Everything funded by {goals.finish ? mon(goals.finish, 'MMM YYYY') : 'beyond 10 years'} (estimate).
        </Typography>
        <Stack spacing={1.25}>
          {goals.goals.map((g) => (
            <Box key={g.name}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {g.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {g.saved >= g.target ? 'done' : `${formatINR(g.saved)} / ${formatINR(g.target)}${g.eta ? ` · ${mon(g.eta, 'MMM YYYY')}` : ''}`}
                </Typography>
              </Stack>
              <LinearProgress variant="determinate" value={Math.min(100, (g.saved / g.target) * 100)} color={g.saved >= g.target ? 'success' : 'primary'} sx={{ height: 8, borderRadius: 4 }} />
            </Box>
          ))}
        </Stack>
      </Card>

      <Card title="⬇️ Export">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          CSV files open in Sheets or Excel. They’re <b>not encrypted</b>: keep them private. For a full restorable backup, use Settings → Download backup.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button variant="outlined" onClick={() => download(`tracker-finance-transactions-${today}.csv`, transactionsCsv(doc, span === 0 ? undefined : `${from}-01`))}>
            Transactions (.csv)
          </Button>
          <Button variant="outlined" disabled={!rows.length} onClick={() => download(`tracker-finance-months-${today}.csv`, monthlyCsv(rows))}>
            Monthly summary (.csv)
          </Button>
          <Button onClick={() => navigate('/finance/settings')}>Backup (.json)</Button>
        </Stack>
      </Card>
    </Stack>
  );
}
