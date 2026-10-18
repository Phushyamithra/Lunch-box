import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stepper } from '../food/Stepper';
import { useSnackbar } from '../layout/Snackbar';
import { useFitness } from './FitnessContext';
import type { FitnessData, SessionRow } from './fitnessApi';
import {
  addDays,
  awayPeriodFor,
  isoWeekday,
  variantIndexFor,
  waistSummary,
  weeklyAverages,
  weekStart,
  type DietDay,
  type WeighIn,
} from './rules';
import { Card, kg } from './ui';

const KEY = 'YYYY-MM-DD';
const WEEKDAY = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
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
      <WeightCard key={`w-${day}`} day={day} data={data} />
      <WorkoutCard key={`t-${day}`} day={day} data={data} />
      <DietCard key={`d-${day}`} day={day} data={data} />
      <StepsCard key={`s-${day}`} day={day} data={data} />
      <WaistCard key={`c-${day}`} day={day} data={data} />
    </Stack>
  );
}

function WeightCard({ day, data }: { day: string; data: FitnessData }) {
  const { addWeighIn, setMeasurementDeleted } = useFitness();
  const toast = useSnackbar();
  const [value, setValue] = useState('');
  const [time, setTime] = useState(defaultTime);
  const [busy, setBusy] = useState(false);
  const entries = data.weighIns.filter((w) => w.day === day);
  const week = weeklyAverages(data.weighIns, data.away, day).find((w) => w.weekStart === weekStart(day));

  const save = async () => {
    const v = parseNum(value);
    if (v === null || v < 20 || v > 300) return toast('Enter a weight between 20 and 300 kg.', { severity: 'error' });
    setBusy(true);
    try {
      const row = await addWeighIn(day, v, time);
      setValue('');
      toast(`Saved ${v} kg`, { action: { label: 'Undo', run: () => void setMeasurementDeleted('weight', row, true) } });
    } catch (e) {
      toast(`Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Weight"
      aside={
        <Typography variant="body2" color="text.secondary">
          week avg {kg(week?.average)} kg · {week?.days ?? 0} day{week?.days === 1 ? '' : 's'}
        </Typography>
      }
    >
      <Stack spacing={1.5}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            label="Weight (kg)"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void save()}
            sx={{ flexGrow: 1 }}
          />
          <Button variant="contained" size="large" disabled={busy || !value.trim()} onClick={() => void save()} sx={{ minHeight: 52 }}>
            Save
          </Button>
        </Box>
        <ToggleButtonGroup value={time} exclusive onChange={(_, v) => v && setTime(v)} aria-label="Time of day" size="small" fullWidth>
          {TIMES.map((t) => (
            <ToggleButton key={t} value={t} sx={{ textTransform: 'capitalize' }}>
              {t}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
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
          Daily weight moves around a lot. The weekly average is what counts.
        </Typography>
      </Stack>
    </Card>
  );
}

function WorkoutCard({ day, data }: { day: string; data: FitnessData }) {
  const navigate = useNavigate();
  const { saveSession, addSet, removeSet } = useFitness();
  const toast = useSnackbar();
  const weekday = isoWeekday(day);
  const variant = variantIndexFor(day, data.settings.rotation_start, data.settings.rotation_offset);
  const session: SessionRow | undefined = data.sessions.find((s) => s.day === day);
  const slots = [1, 2, 3, 4, 5].map((n) => data.slots.find((s) => s.weekday === weekday && s.slot === n));
  const [showSets, setShowSets] = useState(false);
  const [busy, setBusy] = useState(false);

  if (weekday === 7) {
    return (
      <Card title="Training">
        <Typography color="text.secondary">Sunday is your rest day.</Typography>
      </Card>
    );
  }

  const save = async (patch: Partial<Pick<SessionRow, 'completed' | 'slots_completed'>>) => {
    setBusy(true);
    try {
      return await saveSession({
        day,
        variant_index: session?.variant_index ?? variant,
        completed: patch.completed ?? session?.completed ?? false,
        slots_completed: patch.slots_completed ?? session?.slots_completed ?? 0,
      });
    } catch (e) {
      toast(`Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
      return null;
    } finally {
      setBusy(false);
    }
  };
  const usedVariant = session?.variant_index ?? variant;
  const programEmpty = slots.every((s) => !s || !s.variants[usedVariant]);

  return (
    <Card title={`Training · ${WEEKDAY[weekday]}`} aside={<Chip size="small" color="secondary" label={`V${usedVariant + 1}`} />}>
      <Stack spacing={1.5}>
        {programEmpty ? (
          <Alert severity="info" action={<Button color="inherit" onClick={() => navigate('/fitness/program')}>Set up</Button>}>
            No exercises set for {WEEKDAY[weekday]} V{usedVariant + 1} yet.
          </Alert>
        ) : (
          <Box component="ol" sx={{ m: 0, pl: 3 }}>
            {slots.map((s, i) => (
              <Typography component="li" key={i} color={s?.variants[usedVariant] ? 'text.primary' : 'text.secondary'}>
                {s?.variants[usedVariant] || `${s?.label || `Slot ${i + 1}`}: not set`}
                {s?.variants[usedVariant] && (
                  <Typography component="span" variant="body2" color="text.secondary">
                    {' '}
                    · {s.default_sets} sets
                  </Typography>
                )}
              </Typography>
            ))}
          </Box>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <FormControlLabel
            control={
              <Switch
                checked={session?.completed ?? false}
                disabled={busy}
                onChange={(e) =>
                  // Marking a fresh session complete assumes all five slots;
                  // an explicit slot count is kept.
                  void save({
                    completed: e.target.checked,
                    slots_completed: e.target.checked && !session?.slots_completed ? 5 : session?.slots_completed,
                  })
                }
              />
            }
            label="Session completed"
            sx={{ flexGrow: 1 }}
          />
          <Typography variant="body2" color="text.secondary">
            Slots done
          </Typography>
          <Stepper label="slots completed" value={session?.slots_completed ?? 0} max={5} disabled={busy} onChange={(v) => void save({ slots_completed: v })} />
        </Box>
        <Button onClick={() => setShowSets((v) => !v)} sx={{ alignSelf: 'flex-start' }}>
          {showSets ? 'Hide set logging' : 'Log sets (optional)'}
        </Button>
        <Collapse in={showSets} unmountOnExit>
          <Stack spacing={2}>
            {slots.map((s, i) => (
              <SlotSets
                key={i}
                slot={i + 1}
                exercise={s?.variants[usedVariant] ?? ''}
                session={session}
                sets={data.sets.filter((x) => session && x.session_id === session.id && x.slot === i + 1)}
                ensureSession={async () => session ?? (await save({}))}
                onAdd={addSet}
                onRemove={removeSet}
              />
            ))}
          </Stack>
        </Collapse>
      </Stack>
    </Card>
  );
}

function SlotSets({
  slot,
  exercise,
  sets,
  ensureSession,
  onAdd,
  onRemove,
}: {
  slot: number;
  exercise: string;
  session: SessionRow | undefined;
  sets: FitnessData['sets'];
  ensureSession: () => Promise<SessionRow | null | undefined>;
  onAdd: ReturnType<typeof useFitness>['addSet'];
  onRemove: (id: string) => Promise<void>;
}) {
  const toast = useSnackbar();
  const [name, setName] = useState(exercise);
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState(sets.length ? String(sets[sets.length - 1].weight_kg) : '');
  const ordered = useMemo(() => [...sets].sort((a, b) => a.set_number - b.set_number), [sets]);

  const add = async () => {
    const r = parseNum(reps);
    const wkg = parseNum(weight) ?? 0;
    if (!name.trim() || r === null || r < 0) return toast('Enter the exercise and reps.', { severity: 'error' });
    try {
      const session = await ensureSession();
      if (!session) return;
      await onAdd({ session_id: session.id, slot, exercise: name.trim(), set_number: ordered.length + 1, reps: r, weight_kg: wkg });
      setReps('');
    } catch (e) {
      toast(`Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    }
  };

  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
        Slot {slot}
      </Typography>
      {ordered.map((s) => (
        <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ flexGrow: 1 }}>
            Set {s.set_number} · {s.exercise} · {s.reps} × {kg(s.weight_kg, 1)} kg
          </Typography>
          <IconButton size="small" aria-label={`Delete set ${s.set_number}`} onClick={() => void onRemove(s.id)}>
            <DeleteOutlineRoundedIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '2fr 1fr 1fr auto' }, gap: 1, mt: 0.5 }}>
        <TextField size="small" label="Exercise" value={name} onChange={(e) => setName(e.target.value)} sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }} />
        <TextField size="small" label="Reps" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} />
        <TextField size="small" label="kg" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
        <Button variant="outlined" onClick={() => void add()} sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
          Add set {ordered.length + 1}
        </Button>
      </Box>
    </Box>
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
    <Card title="Steps" aside={<Chip size="small" variant="outlined" label="Source: manual entry" />}>
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
    <Card title="Waist" aside={<Chip size="small" color="warning" label={summary.latest ? (summary.overdue ? 'Overdue' : 'Due today') : 'First measurement'} />}>
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
