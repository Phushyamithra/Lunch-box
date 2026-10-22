import { Alert, Box, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { Card } from '../fitness/ui';
import { useFinance } from './FinanceContext';
import { formatINR, type Paise } from './model';
import { Bar } from './MonthPage';
import { checkTransfer, peakMonths, salaryDayPlan, sinkingFunds, weeklyCap } from './planner';
import { AmountField } from './ui';

const ym = (m: string, f = 'MMM YYYY') => dayjs(`${m}-01`).format(f);

/** On salary day: what next month's bills need, and what can safely go to savings. */
export function SalaryDayCard() {
  const { doc } = useFinance();
  const today = dayjs().format('YYYY-MM-DD');
  const plan = useMemo(() => (doc ? salaryDayPlan(doc, today) : null), [doc, today]);
  const [transfer, setTransfer] = useState<Paise | null>(null);
  if (!plan) return null;
  const check = transfer !== null ? checkTransfer(plan, transfer) : null;
  return (
    <Card title={`💼 Salary day: ${dayjs(plan.date).format('ddd D MMM')}`}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        This salary pays {ym(plan.covers, 'MMMM')}’s bills. Move the rest to savings the same day.
      </Typography>
      <Stack spacing={0.5}>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2">Salary</Typography>
          <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }} color="success.main">
            +{formatINR(plan.salary)}
          </Typography>
        </Stack>
        {plan.otherIncome > 0 && (
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2">Reliable other income in {ym(plan.covers, 'MMMM')}</Typography>
            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }} color="success.main">
              +{formatINR(plan.otherIncome)}
            </Typography>
          </Stack>
        )}
        {plan.bills.items.map((i) => (
          <Stack key={i.name} direction="row" justifyContent="space-between" spacing={1}>
            <Typography variant="body2" color={i.note === 'paid once while switching' ? 'warning.main' : undefined}>
              {i.name}
            </Typography>
            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              −{formatINR(i.amount)}
            </Typography>
          </Stack>
        ))}
      </Stack>
      <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: (t) => t.tracker.tonal }}>
        <Typography sx={{ fontSize: 26, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatINR(plan.safe)}</Typography>
        <Typography variant="body2" color="text.secondary">
          safe to move to savings on salary day (estimate, from your plan)
        </Typography>
      </Box>
      {plan.shortfall > 0 && (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          {ym(plan.covers, 'MMMM')}’s bills are {formatINR(plan.shortfall)} more than this salary. Keep that much from savings in the account, or trim the month.
        </Alert>
      )}
      {plan.bills.doublePayment > 0 && (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          Switching to card-free: {ym(plan.covers, 'MMMM')} pays last month’s card bill ({formatINR(plan.bills.doublePayment)}) and its own spending once. Spending isn’t higher; it’s
          paid sooner.
        </Alert>
      )}
      <Box sx={{ mt: 2 }}>
        <AmountField label="I plan to move" value={transfer} onChange={setTransfer} />
        {check && (
          <Alert severity={check.ok ? 'success' : 'error'} sx={{ mt: 1 }}>
            {check.ok ? `Fine: next month’s bills stay covered, with ${formatINR(plan.safe - (transfer ?? 0))} spare.` : `That leaves ${ym(plan.covers, 'MMMM')}’s bills ${formatINR(check.uncovered)} short.`}
          </Alert>
        )}
      </Box>
    </Card>
  );
}

/** Yearly and quarterly bills: what to set aside monthly, and the heavy months ahead. */
export function YearlyBillsCard() {
  const { doc } = useFinance();
  const today = dayjs().format('YYYY-MM-DD');
  const funds = useMemo(() => (doc ? sinkingFunds(doc.settings, today) : []), [doc, today]);
  const peaks = useMemo(() => (doc ? peakMonths(doc.settings, today) : []), [doc, today]);
  if (!doc) return null;
  const total = funds.reduce((a, f) => a + f.monthly, 0);
  const max = Math.max(...peaks.map((p) => p.committed), 1);
  return (
    <>
      <Card title="🗓️ Yearly bills (sinking funds)">
        {funds.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No periodic bills. Add them in Settings → Periodic costs (amount and the months they’re due).
          </Typography>
        ) : (
          <>
            <Box sx={{ overflowX: 'auto', mx: -1 }}>
              <Table size="small" aria-label="Sinking funds">
                <TableHead>
                  <TableRow>
                    <TableCell>Bill</TableCell>
                    <TableCell align="right">Set aside / month</TableCell>
                    <TableCell>Next due</TableCell>
                    <TableCell align="right">Should have by now</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {funds.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>
                        {f.name}
                        <Typography variant="caption" color="text.secondary" component="div">
                          {formatINR(f.amount)} × {f.months.length}/yr
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatINR(f.monthly)}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {ym(f.nextDue, 'MMM YY')}
                        <Typography variant="caption" color="text.secondary" component="div">
                          {f.monthsToGo === 0 ? 'this month' : `in ${f.monthsToGo} mo`}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatINR(f.shouldHave)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Setting aside {formatINR(total)} a month smooths these out. Your projections already count each bill in its own month.
            </Typography>
          </>
        )}
      </Card>
      <Card title="⛰️ Peak months ahead">
        <Stack spacing={0.75}>
          {peaks.map((p) => (
            <Stack key={p.month} direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2" sx={{ width: 64, flexShrink: 0, fontWeight: p.peak ? 700 : 400 }}>
                {ym(p.month, 'MMM YY')}
              </Typography>
              <Box sx={{ flexGrow: 1, height: 10, borderRadius: 5, bgcolor: 'action.hover', overflow: 'hidden' }}>
                <Box sx={{ width: `${(p.committed / max) * 100}%`, height: '100%', bgcolor: p.peak ? 'warning.main' : 'primary.main', opacity: p.peak ? 1 : 0.6 }} />
              </Box>
              <Typography variant="body2" sx={{ width: 84, textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {formatINR(p.committed)}
              </Typography>
            </Stack>
          ))}
        </Stack>
        <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.75, mt: 1.5 }}>
          {peaks
            .filter((p) => p.peak)
            .map((p) => (
              <Chip key={p.month} size="small" color="warning" variant="outlined" label={`${ym(p.month, 'MMM')}: ${p.extras.join(', ')}`} />
            ))}
        </Stack>
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
          Committed costs per month (fixed + periodic). Highlighted: more than 5% above a usual month.
        </Typography>
      </Card>
    </>
  );
}

/** Card-free mode: this week's everyday spending against the weekly cap. */
export function WeeklyCapBar() {
  const { doc } = useFinance();
  const today = dayjs().format('YYYY-MM-DD');
  const w = doc ? weeklyCap(doc, today) : null;
  if (!w || (doc!.settings.cardFree && doc!.settings.cardFree.from > today.slice(0, 7))) return null;
  return (
    <Card title="🧮 This week (card-free)">
      <Bar
        label={`${dayjs(w.start).format('D MMM')} – ${dayjs(w.end).format('D MMM')}`}
        value={w.spent}
        max={w.cap}
        detail={w.level === 'over' ? `${formatINR(w.spent - w.cap)} over the weekly cap` : `${formatINR(w.cap - w.spent)} left this week · everyday categories only`}
      />
    </Card>
  );
}
