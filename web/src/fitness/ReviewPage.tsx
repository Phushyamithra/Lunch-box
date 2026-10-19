import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { Alert, Box, Chip, IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { ReportCard } from '../report/ReportCard';
import { useFitness } from './FitnessContext';
import { addDays, assessGain, dietSummary, gainRate, isAway, waistSummary, weekAdherence, weeklyAverages } from './rules';
import { Card, kg, Metric, signed } from './ui';

const KEY = 'YYYY-MM-DD';

/** Month-at-a-time review built only from recorded data. */
export default function ReviewPage() {
  const { data } = useFitness();
  const today = dayjs().format(KEY);
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));

  const review = useMemo(() => {
    if (!data) return null;
    const first = `${month}-01`;
    const last = dayjs(first).endOf('month').format(KEY);
    const asOf = last < today ? addDays(last, 1) : today; // judge the month as it stood at its end
    const allWeeks = weeklyAverages(data.weighIns, data.away, asOf, data.settings.weigh_time);
    const weeks = allWeeks.filter((w) => w.weekStart >= dayjs(first).subtract(6, 'day').format(KEY) && w.weekStart <= last);
    const verdict = assessGain(gainRate(allWeeks, data.away, asOf), data.settings);
    const sufficient = weeks.filter((w) => w.sufficient && w.average !== null && addDays(w.weekStart, 6) < asOf);
    const monthChange = sufficient.length >= 2 ? (sufficient[sufficient.length - 1].average as number) - (sufficient[0].average as number) : null;
    const waists = waistSummary(data.waists.filter((w) => w.day >= first && w.day <= last), data.away, data.settings.waist_interval_days, asOf);
    const training = weeks
      .filter((w) => w.weekStart >= first)
      .map((w) => weekAdherence(w.weekStart, data.sessions, data.away))
      .reduce((a, w) => ({ completed: a.completed + w.completed, eligible: a.eligible + w.eligible }), { completed: 0, eligible: 0 });
    const diet = dietSummary(data.diet, first, last);
    const steps = data.steps.filter((s) => s.day >= first && s.day <= last);
    const awayDays = Array.from({ length: dayjs(last).date() }, (_, i) => addDays(first, i)).filter((d) => isAway(d, data.away)).length;
    return { first, last, weeks, verdict, monthChange, waists, training, diet, steps, awayDays };
  }, [data, month, today]);

  if (!data || !review) return null;
  const { weeks, verdict, monthChange, waists, training, diet, steps, awayDays } = review;
  const isCurrent = month === dayjs().format('YYYY-MM');

  return (
    <Stack spacing={2} sx={{ maxWidth: 860 }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <IconButton aria-label="Previous month" onClick={() => setMonth(dayjs(`${month}-01`).subtract(1, 'month').format('YYYY-MM'))}>
          <ChevronLeftRoundedIcon />
        </IconButton>
        <Typography variant="h6" component="h2" sx={{ flexGrow: 1, textAlign: 'center' }}>
          {dayjs(`${month}-01`).format('MMMM YYYY')}
          {isCurrent && (
            <Typography component="span" variant="body2" color="text.secondary">
              {' '}
              · so far
            </Typography>
          )}
        </Typography>
        <IconButton aria-label="Next month" disabled={isCurrent} onClick={() => setMonth(dayjs(`${month}-01`).add(1, 'month').format('YYYY-MM'))}>
          <ChevronRightRoundedIcon />
        </IconButton>
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
        <Card title="Weight">
          <Metric value={monthChange === null ? '–' : signed(monthChange)} unit="kg" caption="first → last full week" />
        </Card>
        <Card title="Waist">
          <Metric value={waists.changeFromBaseline === null || waists.trend.length < 2 ? '–' : signed(waists.changeFromBaseline, 1)} unit="cm" caption={`${waists.trend.length} measurement${waists.trend.length === 1 ? '' : 's'}`} />
        </Card>
        <Card title="Training">
          <Metric value={`${training.completed}/${training.eligible}`} caption="eligible sessions" />
        </Card>
        <Card title="Diet">
          <Metric value={diet.adherence === null ? '–' : `${Math.round(diet.adherence * 100)}%`} caption={`on plan · ${diet.event} event day${diet.event === 1 ? '' : 's'}`} />
        </Card>
      </Box>

      <Alert severity={verdict.kind === 'on_track' ? 'success' : verdict.kind === 'fast' || verdict.kind === 'slow' ? 'warning' : 'info'}>
        <strong>Suggestion:</strong> {verdict.message}
        {verdict.kind !== 'insufficient' && ` (Gain rate ${signed(verdict.rate.kgPerMonth)} kg/month, from weekly averages.)`}
      </Alert>

      <Card title="Weekly averages" aside={awayDays > 0 && <Chip size="small" variant="outlined" label={`${awayDays} away day${awayDays === 1 ? '' : 's'}`} />}>
        {weeks.length === 0 ? (
          <Typography color="text.secondary">No weigh-ins this month.</Typography>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" aria-label="Weekly averages">
              <TableHead>
                <TableRow>
                  <TableCell>Week of</TableCell>
                  <TableCell align="right">Average (kg)</TableCell>
                  <TableCell align="right">Days weighed</TableCell>
                  <TableCell>Data</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {weeks.map((w) => (
                  <TableRow key={w.weekStart}>
                    <TableCell>{dayjs(w.weekStart).format('D MMM')}</TableCell>
                    <TableCell align="right">{kg(w.average, 2)}</TableCell>
                    <TableCell align="right">{w.days}</TableCell>
                    <TableCell>
                      {w.awayDays > 0 && <Chip size="small" variant="outlined" label={`${w.awayDays} away`} sx={{ mr: 0.5 }} />}
                      <Chip size="small" color={w.sufficient ? 'success' : 'default'} label={w.sufficient ? 'enough' : 'too few'} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Card>

      <Card title="Steps" aside={<Chip size="small" variant="outlined" label="manual entry" />}>
        <Typography>
          {steps.length
            ? `${Math.round(steps.reduce((a, s) => a + s.steps, 0) / steps.length).toLocaleString('en-IN')} average over ${steps.length} logged days`
            : 'No steps logged this month.'}
        </Typography>
      </Card>

      <ReportCard />
    </Stack>
  );
}
