import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { Alert, Box, Chip, Collapse, IconButton, LinearProgress, Stack, Typography, Button } from '@mui/material';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { Card, Metric } from '../fitness/ui';
import { addMonths, monthSummary, savingsState, upcoming } from './engine';
import { useFinance } from './FinanceContext';
import { formatINR, type Paise } from './model';

export function Bar({ label, value, max, detail, warnAt = 0.8 }: { label: string; value: Paise; max: Paise; detail?: string; warnAt?: number }) {
  const ratio = max > 0 ? value / max : value > 0 ? 2 : 0;
  const color = ratio > 1 ? 'error' : ratio >= warnAt ? 'warning' : 'primary';
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }} color={ratio > 1 ? 'error.main' : 'text.secondary'}>
          {formatINR(value)} / {formatINR(max)}
        </Typography>
      </Stack>
      <LinearProgress variant="determinate" color={color} value={Math.min(100, ratio * 100)} sx={{ height: 8, borderRadius: 4 }} aria-label={`${label}: ${Math.round(ratio * 100)}%`} />
      {detail && (
        <Typography variant="caption" color={ratio > 1 ? 'error.main' : 'text.secondary'}>
          {detail}
        </Typography>
      )}
    </Box>
  );
}

const monthName = (ym: string) => dayjs(`${ym}-01`).format('MMMM YYYY');

/** One month: what pays for it, what's committed, budgets, everyday spend, savings and what's coming up. */
export default function MonthPage() {
  const { doc } = useFinance();
  const today = dayjs().format('YYYY-MM-DD');
  const current = today.slice(0, 7);
  const [month, setMonth] = useState(current);
  const [how, setHow] = useState(false);
  const m = useMemo(() => (doc ? monthSummary(doc, month, today) : null), [doc, month, today]);
  const sav = useMemo(() => (doc ? savingsState(doc, today) : null), [doc, today]);
  const next = useMemo(() => (doc ? upcoming(doc, today) : []), [doc, today]);
  if (!doc || !m || !sav) return null;
  const isCurrent = month === current;
  const activeGoal = sav.goals.find((g) => !g.done);

  return (
    <Stack spacing={2} sx={{ maxWidth: 860 }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <IconButton aria-label="Previous month" disabled={month <= doc.settings.startMonth} onClick={() => setMonth(addMonths(month, -1))}>
          <ChevronLeftRoundedIcon />
        </IconButton>
        <Typography variant="h6" component="h2" sx={{ flexGrow: 1, textAlign: 'center' }}>
          {monthName(month)}
        </Typography>
        <IconButton aria-label="Next month" disabled={isCurrent} onClick={() => setMonth(addMonths(month, 1))}>
          <ChevronRightRoundedIcon />
        </IconButton>
      </Box>

      {!m.tracked && <Alert severity="info">Before tracking started ({monthName(doc.settings.startMonth)}); nothing is counted for this month.</Alert>}

      <Card
        title={isCurrent ? '💰 This month' : '💰 How the month went'}
        aside={<Chip size="small" variant="outlined" color={m.final ? 'success' : 'default'} label={m.final ? 'Actual' : 'Projected'} />}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Metric value={formatINR(m.savings)} caption={m.final ? 'saved (actual)' : 'expected to save'} />
          {isCurrent ? <Metric value={formatINR(m.leftInBudgets)} caption="left in budgets (keeps savings on plan)" /> : <Metric value={formatINR(m.spend)} caption="spent (actual)" />}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Paid for by the salary of {dayjs(m.fundingDate).format('D MMM')} ({formatINR(m.funding)}). Logged so far: {formatINR(m.loggedTotal)}
          {isCurrent && m.stillToPay > 0 ? `; committed costs still to pay: ${formatINR(m.stillToPay)}` : ''}.
          {isCurrent && ` Uncommitted cash: ${formatINR(m.available)} (this includes what you plan to save).`}
        </Typography>
        {(m.eventsIn > 0 || m.eventsOut > 0) && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Settled refunds and one-offs: {m.eventsIn ? `+${formatINR(m.eventsIn)}` : ''}
            {m.eventsIn && m.eventsOut ? ' · ' : ''}
            {m.eventsOut ? `−${formatINR(m.eventsOut)}` : ''} (included above).
          </Typography>
        )}
        {m.otherIncome > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Other income this month: +{formatINR(m.otherIncome)} (included above).
          </Typography>
        )}
        {m.voucherSpend > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Paid with Amazon Pay vouchers: {formatINR(m.voucherSpend)}. Not cash, so not in these figures.
          </Typography>
        )}
        <Button size="small" onClick={() => setHow((v) => !v)} sx={{ mt: 0.5, px: 0 }}>
          {how ? 'Hide' : 'How this is worked out'}
        </Button>
        <Collapse in={how}>
          <Box component="ul" sx={{ m: 0, pl: 2.5, color: 'text.secondary', typography: 'body2' }}>
            <li>The salary credited at the end of a month pays the next month.</li>
            <li>Committed costs (rent, gold, SIP, dinner, protein, and insurance or gym in their months) count as paid even if not logged. If you log them, the bigger of planned and logged counts, so nothing is counted twice.</li>
            <li>Wants and Unplanned count what you logged; whatever is left over stays saved.</li>
            <li>Everything else is everyday spending. {m.final ? 'Finished months count what you logged.' : `This month counts what you’ve logged plus the everyday allowance (${formatINR(doc.settings.combinedCardCap)} a month) for the days left.`}</li>
            <li>Card purchases count once, when you buy. Paying the card bill later isn’t a second expense.</li>
          </Box>
        </Collapse>
      </Card>

      <Card title="🏠 Committed">
        <Stack spacing={1}>
          {m.committed.map((c) => (
            <Stack key={c.category} direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {c.items.map((i) => i.name).join(' + ')}
                </Typography>
                <Typography variant="caption" color={c.logged > c.planned ? 'warning.main' : 'text.secondary'}>
                  {c.logged === 0 ? 'Not logged; counted as paid' : c.logged > c.planned ? `Logged ${formatINR(c.logged)}: ${formatINR(c.logged - c.planned)} over plan` : `Logged ${formatINR(c.logged)}`}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {formatINR(c.counted)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Card>

      <Card title="🎚️ Budgets">
        <Stack spacing={1.75}>
          {m.budgets.map((b) => (
            <Bar
              key={b.category}
              label={b.category}
              value={b.logged}
              max={b.planned}
              detail={b.logged > b.planned ? `${formatINR(b.logged - b.planned)} over` : `${formatINR(b.remaining)} left${b.rollover ? (m.final ? ' (saved)' : '; whatever’s left is saved') : ''}`}
            />
          ))}
          <Bar
            label="Needs (everyday)"
            value={m.everyday.logged}
            max={m.everyday.planned}
            detail={m.everyday.byCategory.length ? m.everyday.byCategory.map((x) => `${x.category} ${formatINR(x.amount)}`).join(' · ') : 'Groceries, fuel, pet and the rest, against the card cap'}
          />
        </Stack>
      </Card>

      {isCurrent && (
        <Card title="⏭️ Coming up">
          {next.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nothing due.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {next.slice(0, 10).map((u, i) => (
                <Stack key={i} direction="row" justifyContent="space-between" spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {u.kind === 'salary' ? '💼 ' : u.kind === 'card' ? '💳 ' : ''}
                      {u.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {u.date ? dayjs(u.date).format('ddd D MMM') : dayjs(`${u.month}-01`).format('MMMM')}
                      {u.note ? ` · ${u.note}` : ''}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }} color={u.kind === 'salary' ? 'success.main' : undefined}>
                    {u.kind === 'salary' ? '+' : ''}
                    {formatINR(u.amount)}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </Card>
      )}

      <Card title="🪜 Savings">
        <Typography variant="body2">
          Saved so far (actual): <b>{formatINR(sav.actualTotal)}</b>
          {isCurrent ? ` · this month expected ${formatINR(sav.currentProjected, { sign: true })}` : ''}
        </Typography>
        {activeGoal ? (
          <Box sx={{ mt: 1.5 }}>
            <Bar label={`Now filling: ${activeGoal.goal.name}`} value={activeGoal.saved} max={activeGoal.goal.target} warnAt={2} detail={activeGoal.eta ? `Expected by ${dayjs(`${activeGoal.eta}-01`).format('MMM YYYY')} (estimate)` : undefined} />
          </Box>
        ) : (
          <Typography sx={{ mt: 1 }}>🎉 Every goal is funded.</Typography>
        )}
      </Card>
    </Stack>
  );
}
