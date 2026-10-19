import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useSnackbar } from '../layout/Snackbar';
import { useFitness } from './FitnessContext';
import type { FitnessData } from './fitnessApi';
import {
  addDays,
  awayPeriodFor,
  waistSummary,
  weeklyAverages,
  weekStart,
  type DietDay,
  type WeighIn,
} from './rules';
import { NumberStepper } from './NumberStepper';
import { DueToday } from './RemindersUi';
import { SessionLogger } from './SessionLogger';
import { Card, kg } from './ui';

const KEY = 'YYYY-MM-DD';
const TIMES: WeighIn['time_of_day'][] = ['morning', 'afternoon', 'evening', 'night'];
const defaultTime = (): WeighIn['time_of_day'] => {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 22 ? 'evening' : 'night';
};
const parseNum = (s: string): number | null => {
  const v = Number(s.replace(',', '.'));
  return s.trim() && Number.isFinite(v) ? v : null;
};

/** Daily check-in: weight, diet tag, workout, steps (and waist when due). */
export default function TodayPage() {
  const { data } = useFitness();
  const today = dayjs().format(KEY);
  const [day, setDay] = useState(today);
  if (!data) return null;
  const away = awayPeriodFor(day, data.away);

  return (
    <Stack spacing={2} sx={{ maxWidth: 720 }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <IconButton aria-label="Previous day" onClick={() => setDay(addDays(day, -1))} size="large">
          <ChevronLeftRoundedIcon />
        </IconButton>
        <Typography variant="h6" component="p" sx={{ flexGrow: 1, textAlign: 'center' }}>
          {day === today ? 'Today' : dayjs(day).format('ddd D MMM')}
        </Typography>
        <IconButton aria-label="Next day" disabled={day >= today} onClick={() => setDay(addDays(day, 1))} size="large">
          <ChevronRightRoundedIcon />
        </IconButton>
      </Box>
      {away && (
        <Alert severity="info">
          Away{away.label ? `: ${away.label}` : ''} ({dayjs(away.starts_on).format('D MMM')} – {dayjs(away.ends_on).format('D MMM')}).
          Entries today are kept but flagged, and stay out of trends and training adherence.
        </Alert>
      )}
      {day === today && <DueToday data={data} today={today} />}
      <WeightCard key={`w-${day}`} day={day} data={data} />
      <SessionLogger key={`t-${day}`} day={day} data={data} />
      <DietCard key={`d-${day}`} day={day} data={data} />
      <StepsCard key={`s-${day}`} day={day} data={data} />
      <WaistCard key={`c-${day}`} day={day} data={data} />
    </Stack>
  );
}

const CHECKLIST: Record<string, string[]> = {
  morning: ['After the loo', 'Before food or water', 'Same clothes'],
  evening: ['Gym scale', 'Before training', 'Shoes off', 'Similar clothes'],
};

function WeightCard({ day, data }: { day: string; data: FitnessData }) {
  const { addWeighIn, setMeasurementDeleted, saveSettings } = useFitness();
  const toast = useSnackbar();
  const trendTime = data.settings.weigh_time;
  const last = [...data.weighIns].filter((w) => trendTime === 'any' || w.time_of_day === trendTime).sort((a, b) => a.measured_at.localeCompare(b.measured_at)).pop();
  const [value, setValue] = useState(last ? Number(last.weight_kg) : 65);
  const [time, setTime] = useState<WeighIn['time_of_day']>(trendTime === 'any' ? defaultTime() : trendTime);
  const [busy, setBusy] = useState(false);
  const entries = data.weighIns.filter((w) => w.day === day);
  const checklist = CHECKLIST[trendTime] ?? [];

  const switchTrend = async (next: 'morning' | 'evening') => {
    try {
      await saveSettings({ weigh_time: next });
      setTime(next);
      toast(`Trend now uses ${next} weigh-ins`);
    } catch (e) {
      toast(`Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    }
  };
  const week = weeklyAverages(data.weighIns, data.away, day, trendTime).find((w) => w.weekStart === weekStart(day));

  const save = async () => {
    if (value < 20 || value > 300) return toast('Enter a weight between 20 and 300 kg.', { severity: 'error' });
    setBusy(true);
    try {
      const row = await addWeighIn(day, value, time);
      toast(`Saved ${value} kg (${time})`, { action: { label: 'Undo', run: () => void setMeasurementDeleted('weight', row, true) } });
    } catch (e) {
      toast(`Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      id="weight-card"
      title="Weight"
      aside={
        <Typography variant="body2" color="text.secondary">
          {week?.days ?? 0}/3 {trendTime === 'any' ? 'days' : `${trendTime}s`} this week · avg {kg(week?.average)} kg
        </Typography>
      }
    >
      <Stack spacing={1.5}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">
            Trend uses
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={trendTime === 'morning' || trendTime === 'evening' ? trendTime : null}
            onChange={(_, v) => v && void switchTrend(v)}
            aria-label="Weigh-ins used for the trend"
          >
            <ToggleButton value="morning">🌅 Mornings</ToggleButton>
            <ToggleButton value="evening">🌇 Evenings</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        {checklist.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {checklist.map((c, i) => (
              <motion.div key={`${trendTime}-${c}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Chip size="small" variant="outlined" label={`✓ ${c}`} />
              </motion.div>
            ))}
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <NumberStepper label="weight" unit="kg" value={value} step={0.1} min={20} max={300} decimals={1} onChange={setValue} />
          <Box sx={{ flexGrow: 1 }} />
          <Button variant="contained" size="large" disabled={busy} onClick={() => void save()} sx={{ minHeight: 48 }}>
            Save {value.toFixed(1)} kg
          </Button>
        </Box>
        <ToggleButtonGroup value={time} exclusive onChange={(_, v) => v && setTime(v)} aria-label="Time of day" size="small" fullWidth>
          {TIMES.map((t) => (
            <ToggleButton key={t} value={t} sx={{ textTransform: 'capitalize' }}>
              {t}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {trendTime !== 'any' && time !== trendTime && (
          <Alert severity="info">
            Only {trendTime} weigh-ins feed your trend; {time} readings are kept but run 0.5–1 kg different.
          </Alert>
        )}
        {entries.map((w) => (
          <Box key={w.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontWeight: 600 }}>{kg(w.weight_kg)} kg</Typography>
            <Chip size="small" label={w.time_of_day} />
            <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
              {dayjs(w.measured_at).format('HH:mm')}
            </Typography>
            <IconButton
              aria-label={`Delete ${w.weight_kg} kg`}
              onClick={() =>
                void setMeasurementDeleted('weight', w, true).then(() =>
                  toast('Weigh-in removed', { severity: 'info', action: { label: 'Undo', run: () => void setMeasurementDeleted('weight', w, false) } }),
                )
              }
            >
              <DeleteOutlineRoundedIcon />
            </IconButton>
          </Box>
        ))}
        <Typography variant="caption" color="text.secondary">
          3 {trendTime === 'any' ? 'weigh-ins' : `${trendTime}s`} a week is enough{trendTime === 'evening' ? ', on the same scale' : ''}. Daily swings of 1.5–2 kg are water and mean nothing; the weekly average is what counts.
        </Typography>
      </Stack>
    </Card>
  );
}

function DietCard({ day, data }: { day: string; data: FitnessData }) {
  const { setDiet } = useFitness();
  const toast = useSnackbar();
  const current = data.diet.find((d) => d.day === day);
  const [kcal, setKcal] = useState(current?.kcal_estimate ? String(current.kcal_estimate) : '');
  const [notes, setNotes] = useState(current?.notes ?? '');
  const save = async (tag: DietDay['tag'] | undefined = current?.tag) => {
    if (!tag) return toast('Pick a tag first.', { severity: 'info' });
    try {
      await setDiet(day, tag, parseNum(kcal), notes.trim() || null);
    } catch (e) {
      toast(`Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    }
  };
  const t = data.settings;
  return (
    <Card title="Diet">
      <Stack spacing={1.5}>
        <ToggleButtonGroup value={current?.tag ?? null} exclusive onChange={(_, v) => v && void save(v)} fullWidth aria-label="Diet tag">
          <ToggleButton value="on_plan">On plan</ToggleButton>
          <ToggleButton value="partial">Partial</ToggleButton>
          <ToggleButton value="event">Event / travel</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" color="text.secondary">
          Target ≈ {t.kcal_target} kcal · protein {t.protein_min_g}–{t.protein_max_g} g · fat {t.fat_min_g}–{t.fat_max_g} g · carbs ≈ {t.carbs_target_g} g.
          Event days are kept separate from adherence.
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' }, gap: 1 }}>
          <TextField size="small" label="kcal estimate (optional)" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} onBlur={() => current && void save()} />
          <TextField size="small" label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => current && void save()} />
        </Box>
      </Stack>
    </Card>
  );
}

function StepsCard({ day, data }: { day: string; data: FitnessData }) {
  const { setSteps } = useFitness();
  const toast = useSnackbar();
  const current = data.steps.find((s) => s.day === day);
  const [value, setValue] = useState(current ? String(current.steps) : '');
  const save = async () => {
    const v = parseNum(value);
    if (v === null || v < 0) return toast('Enter a step count.', { severity: 'error' });
    try {
      await setSteps(day, Math.round(v));
      toast('Steps saved');
    } catch (e) {
      toast(`Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    }
  };
  return (
    <Card
      title={`Steps · target ${data.settings.steps_target.toLocaleString('en-IN')}`}
      aside={<Chip size="small" variant="outlined" label="Source: manual entry" />}
    >
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField label="Steps" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} sx={{ flexGrow: 1 }} />
        <Button variant="outlined" onClick={() => void save()}>
          Save
        </Button>
      </Box>
    </Card>
  );
}

function WaistCard({ day, data }: { day: string; data: FitnessData }) {
  const { addWaist } = useFitness();
  const toast = useSnackbar();
  const [value, setValue] = useState('');
  const summary = waistSummary(data.waists, data.away, data.settings.waist_interval_days, day);
  const due = !summary.latest || (summary.nextDue !== null && summary.nextDue <= day);
  const loggedToday = data.waists.some((w) => w.day === day);
  if (!due && !loggedToday) return null;
  const save = async () => {
    const v = parseNum(value);
    if (v === null || v < 30 || v > 250) return toast('Enter a waist measurement in cm.', { severity: 'error' });
    try {
      await addWaist(day, v);
      setValue('');
      toast(summary.baseline ? 'Waist saved' : 'Waist saved as your baseline');
    } catch (e) {
      toast(`Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    }
  };
  return (
    <Card id="waist-card" title="Waist" aside={<Chip size="small" color="warning" label={summary.latest ? (summary.overdue ? 'Overdue' : 'Due today') : 'First measurement'} />}>
      {loggedToday ? (
        <Typography color="text.secondary">Measured today. Next check in {data.settings.waist_interval_days} days.</Typography>
      ) : (
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            {summary.latest
              ? `Last measured ${dayjs(summary.latest.day).format('D MMM')} (${summary.latest.waist_cm} cm).`
              : 'Your first measurement becomes the baseline. Earlier history is not filled in.'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField label="Waist (cm)" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} sx={{ flexGrow: 1 }} />
            <Button variant="outlined" onClick={() => void save()}>
              Save
            </Button>
          </Box>
        </Stack>
      )}
    </Card>
  );
}
