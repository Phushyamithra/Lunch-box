import { Alert, Box, Chip, LinearProgress, Stack, Typography, useTheme } from '@mui/material';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useFitness } from './FitnessContext';
import {
  addDays,
  assessGain,
  compositionSignal,
  dailyWeights,
  dietSummary,
  gainRate,
  trendsResumeOn,
  variantIndexFor,
  waistSummary,
  weekAdherence,
  weeklyAverages,
  weekStart,
} from './rules';
import { Card, kg, Metric, signed } from './ui';

const KEY = 'YYYY-MM-DD';

/** Long-term view: weekly averages first, daily readings in the background. */
export default function DashboardPage() {
  const theme = useTheme();
  const { data } = useFitness();
  const today = dayjs().format(KEY);

  const derived = useMemo(() => {
    if (!data) return null;
    const weeks = weeklyAverages(data.weighIns, data.away, today);
    const rate = gainRate(weeks, data.away, today);
    const verdict = assessGain(rate, data.settings);
    const waist = waistSummary(data.waists, data.away, data.settings.waist_interval_days, today);
    const composition = compositionSignal(waist.trend, rate);
    const thisWeek = weekStart(today);
    const adherence = [0, 1, 2, 3].map((i) => weekAdherence(addDays(thisWeek, -7 * i), data.sessions, data.away));
    const diet7 = dietSummary(data.diet, addDays(today, -6), today);
    const diet30 = dietSummary(data.diet, addDays(today, -29), today);
    const steps7 = data.steps.filter((s) => s.day > addDays(today, -7));
    const lastAway = [...data.away].filter((p) => p.ends_on < today).sort((a, b) => b.ends_on.localeCompare(a.ends_on))[0];
    const daily = dailyWeights(data.weighIns, []); // all days, away included, for the faint dots
    return { weeks, rate, verdict, waist, composition, adherence, diet7, diet30, steps7, lastAway, daily };
  }, [data, today]);

  if (!data || !derived) return null;
  const { weeks, rate, verdict, waist, composition, adherence, diet7, diet30, steps7, lastAway, daily } = derived;
  const latestWeek = [...weeks].reverse().find((w) => w.average !== null);
  const variant = variantIndexFor(today, data.settings.rotation_start, data.settings.rotation_offset);
  const phaseWeeks = Math.max(0, Math.floor(dayjs(today).diff(dayjs(data.settings.phase_start), 'day') / 7));
  const phaseTotalWeeks = Math.round((data.settings.phase_months * 30.4375) / 7);

  const chartData = weeks.map((w) => ({ x: dayjs(w.weekStart).add(3, 'day').valueOf(), avg: w.average === null ? null : Number(w.average.toFixed(2)) }));
  const dots = [...daily].map(([day, v]) => ({ x: dayjs(day).valueOf(), daily: Number(v.toFixed(2)), away: data.away.some((p) => day >= p.starts_on && day <= p.ends_on) }));
  const verdictSeverity = verdict.kind === 'on_track' ? 'success' : verdict.kind === 'insufficient' || verdict.kind === 'slow_early' ? 'info' : 'warning';

  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' }, alignItems: 'start' }}>
      <Stack spacing={2}>
        <Card title="Body weight" aside={<Chip size="small" label="weekly average" />}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Metric
                value={kg(latestWeek?.average)}
                unit="kg"
                caption={latestWeek ? `week of ${dayjs(latestWeek.weekStart).format('D MMM')} · ${latestWeek.days} day${latestWeek.days === 1 ? '' : 's'}` : 'no weigh-ins yet'}
              />
              <Metric
                value={rate ? signed(rate.kgPerMonth) : '–'}
                unit="kg/month"
                caption={rate ? `${dayjs(rate.from.weekStart).format('D MMM')} → ${dayjs(rate.to.weekStart).format('D MMM')} (${rate.spanWeeks} wk)` : 'gain rate'}
              />
            </Box>
            <Alert severity={verdictSeverity}>
              {verdict.message}
              {rate?.spansAway && ' This comparison spans an away period, so read it with care.'}
            </Alert>
            {chartData.length > 0 && (
              <Box sx={{ height: 220 }} role="img" aria-label="Weekly average weight chart">
                <ResponsiveContainer>
                  <ComposedChart margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid stroke={theme.palette.divider} vertical={false} />
                    <XAxis
                      dataKey="x"
                      type="number"
                      scale="time"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={(v) => dayjs(v).format('D MMM')}
                      tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                      stroke={theme.palette.divider}
                    />
                    <YAxis domain={['auto', 'auto']} tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} stroke={theme.palette.divider} />
                    {data.away.map((p) => (
                      <ReferenceArea
                        key={p.id}
                        x1={dayjs(p.starts_on).valueOf()}
                        x2={dayjs(p.ends_on).valueOf()}
                        fill={theme.palette.text.secondary}
                        fillOpacity={0.08}
                        label={{ value: 'away', fill: theme.palette.text.secondary, fontSize: 11, position: 'insideTop' }}
                      />
                    ))}
                    <Tooltip
                      labelFormatter={(v) => dayjs(v as number).format('D MMM YYYY')}
                      contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 12 }}
                      formatter={(v: number, name) => [`${v} kg`, name === 'avg' ? 'Weekly average' : 'Daily']}
                    />
                    <Scatter data={dots} dataKey="daily" fill={theme.palette.text.secondary} fillOpacity={0.35} isAnimationActive={false} />
                    <Line data={chartData} dataKey="avg" stroke={theme.palette.primary.main} strokeWidth={3} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
            )}
            <Typography variant="caption" color="text.secondary">
              Line: weekly averages (gaps mean no data, never filled in). Faint dots: daily readings. Shaded: away periods, kept out of
              the averages.
              {lastAway && ` After your last trip, trends use full weeks from ${dayjs(trendsResumeOn(lastAway)).format('D MMM')}.`}
            </Typography>
          </Stack>
        </Card>

        <Card title="Waist" aside={waist.nextDue && <Chip size="small" color={waist.overdue ? 'warning' : 'default'} label={`${waist.overdue ? 'overdue' : 'next'} ${dayjs(waist.nextDue).format('D MMM')}`} />}>
          {waist.baseline ? (
            <Stack spacing={1.5}>
              <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <Metric value={kg(waist.latest?.waist_cm)} unit="cm" caption={`latest · ${dayjs(waist.latest?.day).format('D MMM')}`} />
                <Metric value={waist.changeFromBaseline === null ? '–' : signed(waist.changeFromBaseline, 1)} unit="cm" caption={`since baseline (${dayjs(waist.baseline.day).format('D MMM')})`} />
              </Box>
              <Alert severity={composition.signal === 'review' ? 'warning' : composition.signal === 'favourable' ? 'success' : 'info'}>
                {composition.signal === 'favourable' && 'Weight is rising while your waist holds steady, which suggests good-quality gain.'}
                {composition.signal === 'review' && 'Waist and weight are both rising. Worth reviewing intake.'}
                {composition.signal === 'neutral' && 'No clear signal from waist and weight together yet.'}
                {composition.signal === 'insufficient' && 'Needs at least two waist measurements and a weight trend.'}{' '}
                Indicative only, not a body-composition measurement.
              </Alert>
            </Stack>
          ) : (
            <Typography color="text.secondary">No waist measurement yet. Add one on Today; the first becomes your baseline.</Typography>
          )}
        </Card>
      </Stack>

      <Stack spacing={2}>
        <Card title="Training this week" aside={<Chip size="small" color="secondary" label={`V${variant + 1}`} />}>
          <Metric value={`${adherence[0].completed}/${adherence[0].eligible}`} caption={`sessions${adherence[0].awayDays ? ` · ${adherence[0].awayDays} away day${adherence[0].awayDays === 1 ? '' : 's'} excluded` : ''}`} />
          <Stack spacing={1} sx={{ mt: 1.5 }}>
            {adherence.slice(1).map((w) => (
              <Box key={w.weekStart}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Week of {dayjs(w.weekStart).format('D MMM')}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {w.completed}/{w.eligible}
                  </Typography>
                </Box>
                <LinearProgress variant="determinate" color="secondary" value={w.eligible ? (w.completed / w.eligible) * 100 : 0} aria-label={`Week of ${w.weekStart}: ${w.completed} of ${w.eligible}`} />
              </Box>
            ))}
          </Stack>
        </Card>

        <Card title="Diet">
          <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Metric value={diet7.adherence === null ? '–' : `${Math.round(diet7.adherence * 100)}%`} caption={`on plan, last 7 days${diet7.event ? ` · ${diet7.event} event` : ''}`} />
            <Metric value={diet30.adherence === null ? '–' : `${Math.round(diet30.adherence * 100)}%`} caption={`last 30 days${diet30.event ? ` · ${diet30.event} event` : ''}`} />
          </Box>
          <Typography variant="caption" color="text.secondary">
            Share of tagged days marked on plan. Event and travel days are counted separately.
          </Typography>
        </Card>

        <Card title="Steps" aside={<Chip size="small" variant="outlined" label="manual entry" />}>
          <Metric
            value={steps7.length ? Math.round(steps7.reduce((a, s) => a + s.steps, 0) / steps7.length).toLocaleString('en-IN') : '–'}
            caption={`average over ${steps7.length} logged day${steps7.length === 1 ? '' : 's'} this week`}
          />
        </Card>

        <Card title="Lean-bulk phase">
          <Typography>
            Week {Math.min(phaseWeeks + 1, phaseTotalWeeks)} of about {phaseTotalWeeks}
          </Typography>
          <LinearProgress variant="determinate" color="secondary" value={Math.min(100, (phaseWeeks / phaseTotalWeeks) * 100)} sx={{ mt: 1 }} aria-label="Phase progress" />
        </Card>
      </Stack>
    </Box>
  );
}
