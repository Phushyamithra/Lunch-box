import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material';
import dayjs from 'dayjs';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFitness } from '../fitness/FitnessContext';
import { gainRate, isAway, weeklyAverages, weekStart } from '../fitness/rules';
import { Card, Metric } from '../fitness/ui';
import { useSnackbar } from '../layout/Snackbar';
import { pickTargets } from './engine';
import { useNutrition } from './NutritionContext';
import { activeTarget } from './nutritionApi';
import { calibrateMaintenance, periodStats, retargetFromMaintenance, summariseDays, topFoods, type DaySummary } from './trends';

const KEY = 'YYYY-MM-DD';
const PERIODS = [
  { days: 7, label: 'Week' },
  { days: 30, label: 'Month' },
  { days: 90, label: '3 months' },
];

/** Intake over time: adherence, averages, what you ate most, and maintenance from your own data. */
export default function TrendsPage() {
  const { data, addTargets } = useNutrition();
  const fitness = useFitness();
  const toast = useSnackbar();
  const theme = useTheme();
  const [period, setPeriod] = useState(30);
  const [confirm, setConfirm] = useState(false);
  const today = dayjs().format(KEY);
  const nd = data!;
  const fit = fitness.data!;
  const from = dayjs(today).subtract(period - 1, 'day').format(KEY);

  const summarise = (start: string) =>
    summariseDays({
      from: start,
      to: today,
      entries: nd.entries,
      targetFor: (d) => activeTarget(nd.targets, d),
      isAway: (d) => isAway(d, fit.away),
      isEvent: (d) => fit.diet.some((x) => x.day === d && x.tag === 'event'),
    });
  const days = useMemo(() => summarise(from), [nd, fit, from]);
  const stats = periodStats(days);
  const foods = topFoods(nd.entries, from, today);

  // Calibration looks at the weight-trend window (up to ~5 weeks), whatever period is shown.
  const rate = gainRate(weeklyAverages(fit.weighIns, fit.away, today, fit.settings.weigh_time), fit.away, today);
  const calibration = useMemo(
    () =>
      calibrateMaintenance({
        days: summarise(dayjs(today).subtract(120, 'day').format(KEY)),
        rate: rate ? { kgPerMonth: rate.kgPerMonth, fromWeek: rate.from.weekStart, toWeekEnd: dayjs(rate.to.weekStart).add(6, 'day').format(KEY) } : null,
      }),
    [nd, fit, rate?.kgPerMonth],
  );
  const current = activeTarget(nd.targets, today);
  const proposal = current && calibration.maintenance ? retargetFromMaintenance(pickTargets(current), calibration.maintenance, current.rate_kg_month ?? 0) : null;

  const apply = async () => {
    if (!current || !proposal) return;
    try {
      await addTargets({
        ...proposal,
        effective_from: today,
        mode: current.mode,
        rate_kg_month: current.rate_kg_month,
        reason: `Calibrated maintenance ≈ ${calibration.maintenance} kcal`,
        inputs: { avg_intake: calibration.avgIntake, tracked_days: calibration.trackedDays, kg_per_month: calibration.kgPerMonth },
      });
      toast(`🎯 New targets from today: ${proposal.kcal} kcal`);
      setConfirm(false);
    } catch (e) {
      toast(`Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    }
  };

  const colour = (d: DaySummary) =>
    d.status === 'tracked' ? (d.kcalOnTarget ? theme.palette.success.main : theme.palette.secondary.main) : d.status === 'partial' ? theme.palette.warning.light : theme.palette.action.disabled;
  const chart = days.map((d) => ({ day: d.day, kcal: Math.round(d.total.kcal), protein: d.total.protein, target: d.target?.kcal ?? null, pmin: d.target?.protein_min ?? null, d }));
  const weeks = [...new Set(days.map((d) => weekStart(d.day)))].map((w) => {
    const s = periodStats(days.filter((d) => weekStart(d.day) === w));
    return { w, ...s };
  });
  const pct = (n: number) => (stats.tracked ? `${Math.round((n / stats.tracked) * 100)}%` : '–');

  return (
    <Stack spacing={2} sx={{ maxWidth: 900 }}>
      <ToggleButtonGroup exclusive size="small" value={period} onChange={(_, v) => v && setPeriod(v)} aria-label="Period">
        {PERIODS.map((p) => (
          <ToggleButton key={p.days} value={p.days}>
            {p.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        <Card title="📅 Adherence">
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Metric value={pct(stats.kcalOnTarget)} caption={`calories within ±10% (${stats.kcalOnTarget}/${stats.tracked} days)`} />
            <Metric value={pct(stats.proteinOk)} caption={`protein at or above the minimum (${stats.proteinOk}/${stats.tracked})`} />
          </Box>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            {stats.tracked} fully logged of {stats.days} days
            {[
              stats.partial && `${stats.partial} partly logged`,
              stats.empty && `${stats.empty} not logged`,
              stats.away && `${stats.away} away`,
              stats.event && `${stats.event} event/travel`,
            ]
              .filter(Boolean)
              .map((s) => ` · ${s}`)
              .join('')}
            . Only fully logged days count toward averages and adherence (a day under half the calorie target looks incomplete).
          </Typography>
        </Card>
        <Card title="⚖️ Averages (fully logged days)">
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Metric value={stats.avgKcal === null ? '–' : Math.round(stats.avgKcal).toLocaleString('en-IN')} unit="kcal" caption={stats.avgKcalGap === null ? 'per day' : `${stats.avgKcalGap > 0 ? '+' : ''}${stats.avgKcalGap} vs target`} />
            <Metric value={stats.avgProtein === null ? '–' : String(Math.round(stats.avgProtein))} unit="g" caption="protein / day" />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Carbs {stats.avgCarbs ?? '–'} g · fat {stats.avgFat ?? '–'} g · fibre {stats.avgFibre ?? '–'} g
          </Typography>
        </Card>
      </Box>

      <Card title="🔥 Calories per day">
        <Box sx={{ height: 220 }} role="img" aria-label="Daily calories against target">
          <ResponsiveContainer>
            <ComposedChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid stroke={theme.palette.divider} vertical={false} />
              <XAxis dataKey="day" tickFormatter={(v) => dayjs(v).format(period > 30 ? 'D/M' : 'D')} tick={{ fill: theme.palette.text.secondary, fontSize: 11 }} stroke={theme.palette.divider} minTickGap={8} />
              <YAxis tick={{ fill: theme.palette.text.secondary, fontSize: 11 }} stroke={theme.palette.divider} />
              <Tooltip
                labelFormatter={(v) => dayjs(v as string).format('ddd D MMM')}
                contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 12 }}
                formatter={(v: number, name) => [name === 'kcal' ? `${v} kcal` : `${v} kcal`, name === 'kcal' ? 'Eaten' : 'Target']}
              />
              <Bar dataKey="kcal" radius={[6, 6, 0, 0]} isAnimationActive>
                {chart.map((c) => (
                  <Cell key={c.day} fill={colour(c.d)} />
                ))}
              </Bar>
              <Line dataKey="target" type="stepAfter" stroke={theme.palette.text.primary} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Box>
        <Typography variant="caption" color="text.secondary">
          Green: within ±10% of target · teal: logged but off target · amber: partly logged · grey: not counted. Dashed line: your target that day.
        </Typography>
      </Card>

      <Card title="🥚 Protein per day">
        <Box sx={{ height: 180 }} role="img" aria-label="Daily protein against the minimum">
          <ResponsiveContainer>
            <ComposedChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid stroke={theme.palette.divider} vertical={false} />
              <XAxis dataKey="day" tickFormatter={(v) => dayjs(v).format(period > 30 ? 'D/M' : 'D')} tick={{ fill: theme.palette.text.secondary, fontSize: 11 }} stroke={theme.palette.divider} minTickGap={8} />
              <YAxis tick={{ fill: theme.palette.text.secondary, fontSize: 11 }} stroke={theme.palette.divider} />
              <Tooltip
                labelFormatter={(v) => dayjs(v as string).format('ddd D MMM')}
                contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 12 }}
                formatter={(v: number, name) => [`${v} g`, name === 'protein' ? 'Protein' : 'Minimum']}
              />
              <Bar dataKey="protein" radius={[6, 6, 0, 0]}>
                {chart.map((c) => (
                  <Cell key={c.day} fill={c.d.status !== 'tracked' ? theme.palette.action.disabled : c.d.proteinOk ? theme.palette.success.main : theme.palette.warning.main} />
                ))}
              </Bar>
              <Line dataKey="pmin" type="stepAfter" stroke={theme.palette.text.primary} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Box>
      </Card>

      {period > 7 && (
        <Card title="🗓️ By week">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Week of</TableCell>
                <TableCell align="right">Logged</TableCell>
                <TableCell align="right">Avg kcal</TableCell>
                <TableCell align="right">Avg protein</TableCell>
                <TableCell align="right">On target</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[...weeks].reverse().map((w) => (
                <TableRow key={w.w}>
                  <TableCell>{dayjs(w.w).format('D MMM')}</TableCell>
                  <TableCell align="right">
                    {w.tracked}/{w.days}
                  </TableCell>
                  <TableCell align="right">{w.avgKcal === null ? '–' : Math.round(w.avgKcal)}</TableCell>
                  <TableCell align="right">{w.avgProtein === null ? '–' : `${Math.round(w.avgProtein)} g`}</TableCell>
                  <TableCell align="right">{w.tracked ? `${w.kcalOnTarget}/${w.tracked}` : '–'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Card title="🧮 Your real maintenance">
        <Stack spacing={1}>
          <Alert severity={calibration.status === 'ready' ? 'success' : 'info'}>{calibration.message}</Alert>
          {calibration.status === 'ready' && current && proposal && (
            <>
              <Typography variant="body2">
                Your targets assume {current.kcal} kcal for {current.rate_kg_month ? `${current.rate_kg_month > 0 ? '+' : ''}${current.rate_kg_month} kg/month` : 'maintenance'}. Built on the
                measured maintenance, that would be <strong>{proposal.kcal} kcal</strong> (carbs {proposal.carbs_g} g; protein and fat unchanged).
              </Typography>
              {Math.abs(proposal.kcal - current.kcal) >= 100 ? (
                <Button variant="outlined" onClick={() => setConfirm(true)} sx={{ alignSelf: 'flex-start' }}>
                  Review new targets
                </Button>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  Within 100 kcal of your targets: nothing to change.
                </Typography>
              )}
            </>
          )}
          <Typography variant="caption" color="text.secondary">
            Weight trend and fully logged days from the same weeks; estimates only, applied only if you confirm. Away and event days are left out.
          </Typography>
        </Stack>
      </Card>

      <Card title="🍛 What you ate most">
        {foods.length === 0 ? (
          <Typography color="text.secondary">Nothing logged in this period.</Typography>
        ) : (
          <Stack spacing={0.75}>
            {foods.map((f, i) => (
              <motion.div key={f.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
                  <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
                    {f.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {f.times}× · {f.kcal.toLocaleString('en-IN')} kcal · P {f.protein} g
                  </Typography>
                </Box>
              </motion.div>
            ))}
          </Stack>
        )}
      </Card>

      <Dialog open={confirm} onClose={() => setConfirm(false)} aria-labelledby="calibrate-title">
        <DialogTitle id="calibrate-title">Use your measured maintenance?</DialogTitle>
        {current && proposal && (
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 1 }}>
              New targets from today. Earlier days keep their old targets.
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell align="right">Now</TableCell>
                  <TableCell align="right">New</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(['kcal', 'protein_g', 'carbs_g', 'fat_g'] as const).map((k) => (
                  <TableRow key={k}>
                    <TableCell>{{ kcal: 'Calories', protein_g: 'Protein (g)', carbs_g: 'Carbs (g)', fat_g: 'Fat (g)' }[k]}</TableCell>
                    <TableCell align="right">{current[k]}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: proposal[k] !== current[k] ? 800 : 400 }}>
                      {proposal[k]}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setConfirm(false)}>Not now</Button>
          <Button variant="contained" onClick={() => void apply()}>
            Apply from today
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
