import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFitness } from '../fitness/FitnessContext';
import { assessGain, gainRate, waistSummary, weeklyAverages } from '../fitness/rules';
import { Card, Metric, kg, signed } from '../fitness/ui';
import { useSnackbar } from '../layout/Snackbar';
import { MODES, adjustForTrend, checkConsistency, type MacroTargets } from './engine';
import { useNutrition } from './NutritionContext';
import { activeTarget, type TargetRow } from './nutritionApi';

const KEY = 'YYYY-MM-DD';

/** Current targets at a glance, plus the lean-bulk dashboard when that's the goal. */
export default function OverviewPage() {
  const { data } = useNutrition();
  const navigate = useNavigate();
  const today = dayjs().format(KEY);
  const target = activeTarget(data!.targets, today);

  if (!target) {
    return (
      <Card title="🎯 Set your targets">
        <Stack spacing={1.5}>
          <Typography color="text.secondary">
            Pick a goal and get a calorie and macro estimate with the working shown, or start from your existing lean-bulk preset.
          </Typography>
          <Button variant="contained" onClick={() => navigate('/nutrition/targets')}>
            Set targets
          </Button>
        </Stack>
      </Card>
    );
  }

  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, alignItems: 'start' }}>
      <TargetCard target={target} />
      {target.mode === 'lean_bulk' && <LeanBulkCard target={target} />}
    </Box>
  );
}

function TargetCard({ target }: { target: TargetRow }) {
  const c = checkConsistency(target);
  const rows = [
    { label: 'Protein', emoji: '🥚', aim: target.protein_g, range: `${target.protein_min}–${target.protein_max} g`, kcal: target.protein_g * 4 },
    { label: 'Carbs', emoji: '🍚', aim: target.carbs_g, range: '', kcal: target.carbs_g * 4 },
    { label: 'Fat', emoji: '🥜', aim: target.fat_g, range: `${target.fat_min}–${target.fat_max} g`, kcal: target.fat_g * 9 },
    { label: 'Fibre', emoji: '🥦', aim: target.fibre_g, range: '', kcal: 0 },
  ];
  return (
    <Card title={`${MODES[target.mode].emoji} ${MODES[target.mode].label}`} aside={<Chip size="small" label={`since ${dayjs(target.effective_from).format('D MMM')}`} />}>
      <Stack spacing={1.5}>
        <Metric value={target.kcal.toLocaleString('en-IN')} unit="kcal / day" caption={target.reason || 'Daily target'} />
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {rows.map((r, i) => (
            <motion.div key={r.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Box sx={{ p: 1.25, borderRadius: '16px', bgcolor: (t) => t.tracker.tonal }}>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  {r.emoji} {r.label}
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 20 }}>{r.aim} g</Typography>
                <Typography variant="caption" color="text.secondary">
                  {[r.range, r.kcal ? `${Math.round((r.kcal / target.kcal) * 100)}% of kcal` : ''].filter(Boolean).join(' · ')}
                </Typography>
              </Box>
            </motion.div>
          ))}
        </Box>
        <Alert severity={c.status === 'inconsistent' ? 'warning' : 'info'}>{c.message}</Alert>
        <Typography variant="caption" color="text.secondary">
          Log what you eat under Today: totals, what's left and meal-by-meal breakdowns use these targets.
        </Typography>
      </Stack>
    </Card>
  );
}

/** Lean-bulk progress: phase, weekly-average weight, gain rate, waist, and the review rules. */
function LeanBulkCard({ target }: { target: TargetRow }) {
  const { data } = useFitness();
  const { addTargets } = useNutrition();
  const toast = useSnackbar();
  const [review, setReview] = useState<{ direction: 'down' | 'up'; next: MacroTargets; summary: string } | null>(null);
  const today = dayjs().format(KEY);
  const fit = data!;
  const s = fit.settings;
  const weeks = weeklyAverages(fit.weighIns, fit.away, today, s.weigh_time);
  const rate = gainRate(weeks, fit.away, today);
  const verdict = assessGain(rate, s);
  const waist = waistSummary(fit.waists, fit.away, s.waist_interval_days, today);
  const latest = [...weeks].reverse().find((w) => w.average !== null);
  const totalDays = Math.round(s.phase_months * 30.4375);
  const elapsed = Math.max(0, dayjs(today).diff(dayjs(s.phase_start), 'day'));
  const action = verdict.kind === 'fast' ? 'down' : verdict.kind === 'slow' ? 'up' : null;

  const openReview = (direction: 'down' | 'up') => setReview({ direction, ...(({ targets, summary }) => ({ next: targets, summary }))(adjustForTrend(target, direction)) });
  const apply = async () => {
    if (!review) return;
    try {
      await addTargets({
        ...review.next,
        effective_from: today,
        mode: target.mode,
        rate_kg_month: target.rate_kg_month,
        reason: `Weight trend: ${review.summary}`,
        inputs: { rate_kg_month: rate?.kgPerMonth ?? null, weeks: rate ? `${rate.from.weekStart} → ${rate.to.weekStart}` : null, verdict: verdict.kind },
      });
      toast(`🎯 New targets from today: ${review.next.kcal} kcal`);
      setReview(null);
    } catch (e) {
      toast(`Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    }
  };

  return (
    <Card title="💪 Lean-bulk progress" aside={<Chip size="small" label={`aim +${target.rate_kg_month ?? s.gain_target_kg_month} kg/month`} />}>
      <Stack spacing={1.5}>
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Week {Math.floor(elapsed / 7) + 1} of {Math.round(totalDays / 7)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              since {dayjs(s.phase_start).format('D MMM YYYY')}
            </Typography>
          </Box>
          <LinearProgress variant="determinate" color="secondary" value={Math.min(100, (elapsed / totalDays) * 100)} aria-label="Phase progress" />
        </Box>
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Metric value={kg(latest?.average)} unit="kg" caption={latest ? `weekly avg (${s.weigh_time})` : 'no weekly average yet'} />
          <Metric value={rate ? signed(rate.kgPerMonth) : '–'} unit="kg/mo" caption="gain rate" />
          <Metric value={waist.changeFromBaseline === null ? '–' : signed(waist.changeFromBaseline, 1)} unit="cm" caption="waist vs baseline" />
        </Box>
        <Alert
          severity={verdict.kind === 'on_track' ? 'success' : action ? 'warning' : 'info'}
          action={
            action ? (
              <Button color="inherit" size="small" onClick={() => openReview(action)}>
                Review
              </Button>
            ) : undefined
          }
        >
          {verdict.message}
        </Alert>
        {rate && (
          <Typography variant="caption" color="text.secondary">
            Based on weekly averages {dayjs(rate.from.weekStart).format('D MMM')} ({kg(rate.from.average)} kg) → {dayjs(rate.to.weekStart).format('D MMM')} ({kg(rate.to.average)} kg),{' '}
            {rate.spanWeeks} weeks. Rules: above {s.gain_high_kg_month} kg/month suggests −100 kcal (fat first); below {s.gain_low_kg_month} after a full month suggests +100 kcal
            (carbs first). Suggestions only; nothing changes until you confirm.
          </Typography>
        )}
      </Stack>

      <Dialog open={review !== null} onClose={() => setReview(null)} aria-labelledby="review-title">
        <DialogTitle id="review-title">Change targets from today?</DialogTitle>
        {review && (
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {review.summary}. Earlier days keep their old targets.
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
                    <TableCell align="right">{target[k]}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: review.next[k] !== target[k] ? 800 : 400 }}>
                      {review.next[k]}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setReview(null)}>Not now</Button>
          <Button variant="contained" onClick={() => void apply()}>
            Apply from today
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
