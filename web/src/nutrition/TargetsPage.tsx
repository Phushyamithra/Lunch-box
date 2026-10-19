import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useFitness } from '../fitness/FitnessContext';
import { Card } from '../fitness/ui';
import { useSnackbar } from '../layout/Snackbar';
import {
  ACTIVITY,
  LEAN_BULK_PRESET,
  MODES,
  checkConsistency,
  estimateTargets,
  suggestActivity,
  validateTargets,
  type ActivityLevel,
  type Estimate,
  type GoalMode,
  type MacroTargets,
  type Profile,
} from './engine';
import { useNutrition } from './NutritionContext';
import { activeTarget } from './nutritionApi';
import { currentWeight, trainingDays } from './ui';

const KEY = 'YYYY-MM-DD';
type Draft = Record<keyof MacroTargets, string>;
const FIELDS: { key: keyof MacroTargets; label: string; unit: string }[] = [
  { key: 'kcal', label: 'Calories', unit: 'kcal' },
  { key: 'protein_min', label: 'Protein min', unit: 'g' },
  { key: 'protein_g', label: 'Protein aim', unit: 'g' },
  { key: 'protein_max', label: 'Protein max', unit: 'g' },
  { key: 'fat_min', label: 'Fat min', unit: 'g' },
  { key: 'fat_g', label: 'Fat aim', unit: 'g' },
  { key: 'fat_max', label: 'Fat max', unit: 'g' },
  { key: 'carbs_g', label: 'Carbs', unit: 'g' },
  { key: 'fibre_g', label: 'Fibre', unit: 'g' },
];
const toDraft = (t: MacroTargets): Draft => Object.fromEntries(FIELDS.map((f) => [f.key, String(t[f.key])])) as Draft;
const fromDraft = (d: Draft): MacroTargets => Object.fromEntries(FIELDS.map((f) => [f.key, Number(d[f.key])])) as unknown as MacroTargets;

/** Profile, goal, the estimate with its working, and an editor that saves a new target version. */
export default function TargetsPage() {
  const { data, saveProfile, addTargets } = useNutrition();
  const fitness = useFitness();
  const toast = useSnackbar();
  const today = dayjs().format(KEY);
  const fit = fitness.data!;
  const nd = data!;
  const active = activeTarget(nd.targets, today);
  const weight = currentWeight(fit, today);
  const activitySuggestion = suggestActivity(trainingDays(fit), fit.settings.steps_target);

  const [profile, setProfile] = useState<Profile>(nd.profile ?? { sex: 'male', birth_year: 2000, height_cm: 170, activity: activitySuggestion.level });
  const [mode, setMode] = useState<GoalMode>(active?.mode ?? 'lean_bulk');
  const [rate, setRate] = useState(String(active?.rate_kg_month ?? fit.settings.gain_target_kg_month ?? 0.4));
  const [weightText, setWeightText] = useState(weight ? weight.kg.toFixed(1) : '');
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [draft, setDraft] = useState<Draft>(toDraft(active ?? LEAN_BULK_PRESET));
  const [from, setFrom] = useState(today);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (nd.profile) setProfile(nd.profile);
  }, [nd.profile]);

  const targets = fromDraft(draft);
  const consistency = useMemo(() => checkConsistency(targets), [draft]);
  const problem = validateTargets(targets);

  const runEstimate = () => {
    const kg = Number(weightText.replace(',', '.'));
    if (!(kg >= 30 && kg <= 250)) return toast('Enter your current weight first.', { severity: 'info' });
    const e = estimateTargets({ profile, weight_kg: kg, year: dayjs().year(), mode, rateKgPerMonth: Number(rate) || 0 });
    setEstimate(e);
    setDraft(toDraft(e.targets));
    setReason(`Estimate: ${MODES[mode].label.toLowerCase()}`);
  };

  /** Your configured lean-bulk numbers (Fitness → Targets), kept exactly. */
  const usePreset = () => {
    const s = fit.settings;
    setMode('lean_bulk');
    setRate(String(s.gain_target_kg_month));
    setEstimate(null);
    setDraft(
      toDraft({
        kcal: s.kcal_target,
        protein_min: s.protein_min_g,
        protein_max: s.protein_max_g,
        protein_g: Math.round((s.protein_min_g + s.protein_max_g) / 2),
        fat_min: s.fat_min_g,
        fat_max: s.fat_max_g,
        fat_g: Math.round((s.fat_min_g + s.fat_max_g) / 2),
        carbs_g: s.carbs_target_g,
        fibre_g: LEAN_BULK_PRESET.fibre_g,
      }),
    );
    setReason('Lean-bulk preset');
  };

  const save = async () => {
    if (problem) return toast(problem, { severity: 'error' });
    setBusy(true);
    try {
      if (estimate) await saveProfile(profile);
      await addTargets({
        ...targets,
        effective_from: from,
        mode,
        rate_kg_month: mode === 'lean_bulk' || mode === 'deficit' ? Number(rate) * (mode === 'deficit' ? -1 : 1) : null,
        reason: reason.trim() || 'Edited',
        inputs: estimate
          ? { weight_kg: Number(weightText), bmr: Math.round(estimate.bmr), maintenance: Math.round(estimate.maintenance), activity: profile.activity, working: estimate.working }
          : {},
      });
      toast(`🎯 Targets saved from ${dayjs(from).format('D MMM')}`);
      setEstimate(null);
    } catch (e) {
      toast(`Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, alignItems: 'start' }}>
      <Stack spacing={2}>
        <Card title="🎯 Goal">
          <Stack spacing={1.5}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {(Object.keys(MODES) as GoalMode[]).map((m) => (
                <Chip key={m} label={`${MODES[m].emoji} ${MODES[m].label}`} color={m === mode ? 'secondary' : 'default'} variant={m === mode ? 'filled' : 'outlined'} onClick={() => setMode(m)} />
              ))}
            </Box>
            {(mode === 'lean_bulk' || mode === 'deficit') && (
              <TextField
                size="small"
                label={mode === 'lean_bulk' ? 'Gain per month (kg)' : 'Loss per month (kg)'}
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                inputMode="decimal"
                helperText={mode === 'lean_bulk' ? 'Your plan: about 0.4 kg/month' : 'About 0.5–1% of body weight a week is a common pace'}
              />
            )}
            <Button variant="outlined" onClick={usePreset}>
              💪 Use my lean-bulk preset ({fit.settings.kcal_target} kcal)
            </Button>
          </Stack>
        </Card>

        <Card title="🧍 About you (for the estimate)">
          <Stack spacing={1.5}>
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: '1fr 1fr' }}>
              <TextField size="small" select label="Sex (for the equation)" value={profile.sex} onChange={(e) => setProfile({ ...profile, sex: e.target.value as Profile['sex'] })}>
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
              </TextField>
              <TextField size="small" label="Birth year" inputMode="numeric" value={profile.birth_year} onChange={(e) => setProfile({ ...profile, birth_year: Number(e.target.value) || 0 })} />
              <TextField size="small" label="Height (cm)" inputMode="decimal" value={profile.height_cm} onChange={(e) => setProfile({ ...profile, height_cm: Number(e.target.value) || 0 })} />
              <TextField
                size="small"
                label="Weight (kg)"
                inputMode="decimal"
                value={weightText}
                onChange={(e) => setWeightText(e.target.value)}
                helperText={weight ? `From Fitness: ${weight.source}` : 'No weigh-ins yet'}
              />
            </Box>
            <TextField
              size="small"
              select
              label="Activity"
              value={profile.activity}
              onChange={(e) => setProfile({ ...profile, activity: e.target.value as ActivityLevel })}
              helperText={`Suggested: ${ACTIVITY[activitySuggestion.level].label} (${activitySuggestion.why}). Workouts aren't counted as exact burns.`}
            >
              {(Object.keys(ACTIVITY) as ActivityLevel[]).map((a) => (
                <MenuItem key={a} value={a}>
                  {ACTIVITY[a].label} · ×{ACTIVITY[a].factor} — {ACTIVITY[a].hint}
                </MenuItem>
              ))}
            </TextField>
            <Button variant="contained" onClick={runEstimate} disabled={mode === 'custom'}>
              Estimate targets
            </Button>
          </Stack>
        </Card>

        <AnimatePresence>
          {estimate && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
              <Card title="🧮 How this was worked out">
                <Box component="ol" sx={{ m: 0, pl: 2.5, display: 'grid', gap: 0.75 }}>
                  {estimate.working.map((w) => (
                    <Typography key={w} component="li" variant="body2">
                      {w}
                    </Typography>
                  ))}
                </Box>
                <Alert severity="info" sx={{ mt: 1.5 }}>
                  Maintenance is an estimate. After 3–4 weeks, your weekly-average weight and what you actually ate show the real number.
                </Alert>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </Stack>

      <Stack spacing={2}>
        <Card title="✏️ Targets" aside={active && <Chip size="small" label={`Current: ${active.kcal} kcal`} />}>
          <Stack spacing={1.5}>
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {FIELDS.map((f) => (
                <TextField
                  key={f.key}
                  size="small"
                  label={`${f.label} (${f.unit})`}
                  inputMode="decimal"
                  value={draft[f.key]}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  sx={f.key === 'kcal' ? { gridColumn: '1 / -1' } : undefined}
                />
              ))}
            </Box>
            <Alert
              severity={consistency.status === 'inconsistent' ? 'warning' : consistency.status === 'within_ranges' ? 'info' : 'success'}
              action={
                consistency.status !== 'consistent' ? (
                  <Button color="inherit" size="small" onClick={() => setDraft({ ...draft, carbs_g: String(consistency.carbsForPoints) })}>
                    Carbs → {consistency.carbsForPoints} g
                  </Button>
                ) : undefined
              }
            >
              {consistency.message}
            </Alert>
            {problem && consistency.status !== 'inconsistent' && <Alert severity="error">{problem}</Alert>}
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: '1fr 1fr' }}>
              <TextField size="small" type="date" label="Applies from" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
              <TextField size="small" label="Note" value={reason} onChange={(e) => setReason(e.target.value)} inputProps={{ maxLength: 200 }} />
            </Box>
            <Button variant="contained" size="large" onClick={() => void save()} disabled={busy || Boolean(problem)}>
              Save as new targets
            </Button>
            <Typography variant="caption" color="text.secondary">
              Saving adds a new version; earlier days keep the targets they had. Logging food never changes targets.
            </Typography>
          </Stack>
        </Card>

        <Card title="🕘 History" aside={<Typography color="text.secondary">{nd.targets.length}</Typography>}>
          {nd.targets.length === 0 ? (
            <Typography color="text.secondary">No targets saved yet.</Typography>
          ) : (
            <Stack spacing={1}>
              {[...nd.targets].reverse().map((t) => (
                <Box key={t.id} sx={{ display: 'flex', gap: 1, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <Typography sx={{ fontWeight: 700, minWidth: 92 }}>{dayjs(t.effective_from).format('D MMM YYYY')}</Typography>
                  <Typography variant="body2" sx={{ flexGrow: 1 }}>
                    {MODES[t.mode].emoji} {t.kcal} kcal · P {t.protein_g} · C {t.carbs_g} · F {t.fat_g}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t.reason}
                  </Typography>
                  {t.id === active?.id && <Chip size="small" color="secondary" label="Current" />}
                </Box>
              ))}
            </Stack>
          )}
        </Card>
      </Stack>
    </Box>
  );
}
