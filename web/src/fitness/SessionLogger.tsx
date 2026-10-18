import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from '../layout/Snackbar';
import { useFitness } from './FitnessContext';
import type { FitnessData, SessionRow, WorkoutSetRow } from './fitnessApi';
import { NumberStepper } from './NumberStepper';
import { exerciseOptions } from './referenceImport';
import { addDays, isCompoundSlot, isoWeekday, setProgress, suggestSet, variantIndexFor, weekStart } from './rules';
import { Card } from './ui';

const WEEKDAY = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const FINISHER_SLOT = 6;

interface PlannedExercise {
  key: string;
  slot: number;
  title: string; // target, e.g. "Mid Chest"
  options: string[]; // default first, then fallbacks
  sets: number;
  repsHint?: string;
  compound: boolean;
}

/**
 * The day's workout as a checklist of pre-filled sets: pick the exercise
 * (default or fallback), nudge weight/reps if needed, tap ✓. A rest timer
 * starts after each set; session progress fills in by itself.
 */
export function SessionLogger({ day, data }: { day: string; data: FitnessData }) {
  const navigate = useNavigate();
  const toast = useSnackbar();
  const { saveSession } = useFitness();
  const weekday = isoWeekday(day);
  const variant = variantIndexFor(day, data.settings.rotation_start, data.settings.rotation_offset);
  const session = data.sessions.find((s) => s.day === day);
  const usedVariant = session?.variant_index ?? variant;
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const plan: PlannedExercise[] = useMemo(() => {
    const slots = [1, 2, 3, 4, 5]
      .map((n) => data.slots.find((s) => s.weekday === weekday && s.slot === n))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((s) => ({
        key: `slot-${s.slot}`,
        slot: s.slot,
        title: s.label || `Slot ${s.slot}`,
        options: exerciseOptions(s.variants[usedVariant] ?? ''),
        sets: s.default_sets,
        compound: isCompoundSlot(s.slot, s.default_sets),
      }));
    const finishers = data.settings.finishers
      .filter((f) => f.days.includes(weekday))
      .flatMap((f) =>
        f.exercises.map((e, i) => ({
          key: `fin-${f.name}-${i}`,
          slot: FINISHER_SLOT,
          title: `${f.name} finisher`,
          options: exerciseOptions(e.name),
          sets: e.sets,
          repsHint: e.reps,
          compound: false,
        })),
      );
    return [...slots, ...finishers];
  }, [data.slots, data.settings.finishers, weekday, usedVariant]);

  const daySets = useMemo(() => (session ? data.sets.filter((s) => s.session_id === session.id) : []), [data.sets, session]);
  const main = plan.filter((p) => p.slot !== FINISHER_SLOT);
  const progress = setProgress(
    [1, 2, 3, 4, 5].map((n) => main.find((p) => p.slot === n)?.sets ?? 0),
    new Map([1, 2, 3, 4, 5].map((n) => [n, daySets.filter((s) => s.slot === n).length])),
  );
  const cardioThisWeek = data.sessions.filter((s) => s.cardio_done && s.day >= weekStart(day) && s.day <= addDays(weekStart(day), 6)).length;

  if (weekday === 7) {
    return (
      <Card title="Rest day">
        <Typography color="text.secondary">Sunday: walk, stretch, {data.settings.steps_target.toLocaleString('en-IN')} steps.</Typography>
      </Card>
    );
  }

  const persist = async (patch: Partial<Pick<SessionRow, 'completed' | 'slots_completed' | 'cardio_done'>>) => {
    setSaving(true);
    try {
      return await saveSession({
        day,
        variant_index: usedVariant,
        completed: patch.completed ?? session?.completed ?? false,
        slots_completed: patch.slots_completed ?? session?.slots_completed ?? 0,
        cardio_done: patch.cardio_done ?? session?.cardio_done ?? false,
      });
    } catch (e) {
      toast(`Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
      return null;
    } finally {
      setSaving(false);
    }
  };

  /** After each set: refresh slot count, auto-complete when all 5 slots are done, start rest. */
  const afterSet = async (planned: PlannedExercise, setsAfter: WorkoutSetRow[], current: SessionRow) => {
    const done = setProgress(
      [1, 2, 3, 4, 5].map((n) => main.find((p) => p.slot === n)?.sets ?? 0),
      new Map([1, 2, 3, 4, 5].map((n) => [n, setsAfter.filter((s) => s.slot === n).length])),
    );
    const allDone = main.length > 0 && done.slotsDone === main.length;
    if (done.slotsDone !== current.slots_completed || (allDone && !current.completed)) {
      await persist({ slots_completed: done.slotsDone, completed: current.completed || allDone });
      if (allDone && !current.completed) toast('Session complete 💪');
    }
    const seconds = planned.compound ? data.settings.rest_compound_sec : data.settings.rest_isolation_sec;
    setRestEnd(Date.now() + seconds * 1000);
  };

  return (
    <Card
      title={`${WEEKDAY[weekday]}${data.settings.day_focus[String(weekday)] ? ` · ${data.settings.day_focus[String(weekday)]}` : ''}`}
      aside={<Chip size="small" color="secondary" label={`V${usedVariant + 1}`} />}
    >
      <Stack spacing={2}>
        {main.length === 0 ? (
          <Alert severity="info" action={<Button color="inherit" onClick={() => navigate('/fitness/program')}>Set up</Button>}>
            No program for {WEEKDAY[weekday]} yet. Import your reference file under Program.
          </Alert>
        ) : (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {progress.logged} of {progress.planned} working sets
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {progress.slotsDone}/5 slots
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              color="secondary"
              value={progress.planned ? (progress.logged / progress.planned) * 100 : 0}
              aria-label={`${progress.logged} of ${progress.planned} sets`}
            />
          </Box>
        )}

        {restEnd && <RestTimer endsAt={restEnd} onDone={() => setRestEnd(null)} onAdd={(s) => setRestEnd((e) => (e ?? Date.now()) + s * 1000)} />}

        {plan.map((p) => (
          <ExerciseBlock
            key={p.key}
            planned={p}
            day={day}
            data={data}
            session={session}
            daySets={daySets}
            ensureSession={async () => session ?? (await persist({}))}
            afterSet={afterSet}
          />
        ))}

        <Stack spacing={0.5}>
          <FormControlLabel
            control={<Switch checked={session?.cardio_done ?? false} disabled={saving} onChange={(e) => void persist({ cardio_done: e.target.checked })} />}
            label={`Incline walk · 20 min at 8–10% (${cardioThisWeek}/${data.settings.cardio_per_week} this week)`}
          />
          <FormControlLabel
            control={
              <Switch
                checked={session?.completed ?? false}
                disabled={saving}
                onChange={(e) =>
                  void persist({ completed: e.target.checked, slots_completed: e.target.checked && !session?.slots_completed ? 5 : session?.slots_completed })
                }
              />
            }
            label="Session done (quick check-in, no sets needed)"
          />
        </Stack>
      </Stack>
    </Card>
  );
}

function ExerciseBlock({
  planned,
  day,
  data,
  daySets,
  ensureSession,
  afterSet,
}: {
  planned: PlannedExercise;
  day: string;
  data: FitnessData;
  session: SessionRow | undefined;
  daySets: WorkoutSetRow[];
  ensureSession: () => Promise<SessionRow | null>;
  afterSet: (planned: PlannedExercise, setsAfter: WorkoutSetRow[], session: SessionRow) => Promise<void>;
}) {
  const { addSet, removeSet } = useFitness();
  const toast = useSnackbar();
  // Finisher exercises share slot 6, so they are told apart by name.
  const inSlot = daySets.filter((s) => s.slot === planned.slot);
  const mine =
    planned.slot === FINISHER_SLOT
      ? inSlot.filter((s) => planned.options.some((o) => o.toLowerCase() === s.exercise.toLowerCase()))
      : inSlot;
  const logged = [...mine].sort((a, b) => a.set_number - b.set_number);
  const [exercise, setExercise] = useState(logged[0]?.exercise ?? planned.options[0] ?? '');
  const [custom, setCustom] = useState(false);
  const nextNumber = logged.length + 1;
  const suggestion = suggestSet(exercise, nextNumber, day, data.sets, data.sessions, data.presets);
  const [weight, setWeight] = useState(suggestion.weight);
  const [reps, setReps] = useState(suggestion.reps);
  const [busy, setBusy] = useState(false);

  // Re-fill the active row when the exercise or set number changes.
  useEffect(() => {
    setWeight(suggestion.weight);
    setReps(suggestion.reps);
  }, [exercise, nextNumber]);

  const complete = logged.length >= planned.sets;

  const log = async () => {
    if (!exercise.trim()) return toast('Choose or type the exercise first.', { severity: 'info' });
    setBusy(true);
    try {
      const session = await ensureSession();
      if (!session) return;
      const row = await addSet({ session_id: session.id, slot: planned.slot, exercise: exercise.trim(), set_number: nextNumber, reps, weight_kg: weight });
      await afterSet(planned, [...daySets, row], session);
    } catch (e) {
      toast(`Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const hint =
    suggestion.from === 'last'
      ? `last time (${suggestion.lastDay?.slice(5).split('-').reverse().join('/')})`
      : suggestion.from === 'preset'
        ? 'your preset'
        : suggestion.from === 'previous_set'
          ? 'previous set'
          : 'set a starting weight';

  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: '18px', opacity: complete ? 0.75 : 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, flexGrow: 1 }}>
          {planned.slot !== FINISHER_SLOT && `${planned.slot} · `}
          {planned.title}
        </Typography>
        <Typography variant="caption" color={complete ? 'success.main' : 'text.secondary'} sx={{ fontWeight: 700 }}>
          {complete ? '✓ ' : ''}
          {logged.length}/{planned.sets} sets{planned.repsHint ? ` · ${planned.repsHint}` : ''}
        </Typography>
      </Box>

      {/* Default / fallback (station taken) / other */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
        {planned.options.map((o, i) => (
          <Chip
            key={o}
            label={i === 0 ? o : `${o} (fallback)`}
            color={!custom && exercise === o ? 'secondary' : 'default'}
            variant={!custom && exercise === o ? 'filled' : 'outlined'}
            disabled={logged.length > 0 && logged[0].exercise !== o}
            onClick={() => {
              setCustom(false);
              setExercise(o);
            }}
          />
        ))}
        {logged.length === 0 && (
          <Chip label="Other…" variant={custom ? 'filled' : 'outlined'} color={custom ? 'secondary' : 'default'} onClick={() => { setCustom(true); setExercise(''); }} />
        )}
      </Box>
      {custom && logged.length === 0 && (
        <TextField size="small" fullWidth label="Exercise" value={exercise} onChange={(e) => setExercise(e.target.value)} sx={{ mb: 1 }} autoFocus />
      )}

      {logged.map((s) => (
        <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
          <CheckRoundedIcon fontSize="small" color="success" />
          <Typography variant="body2" sx={{ flexGrow: 1 }}>
            Set {s.set_number} · <strong>{Number(s.weight_kg).toString()} kg × {s.reps}</strong>
          </Typography>
          <IconButton size="small" aria-label={`Undo set ${s.set_number}`} onClick={() => void removeSet(s.id)}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}

      {/* Active, pre-filled row for the next set (extra sets allowed).
          Phones: two steppers, then a full-width log button for the thumb. */}
      <Box
        sx={{
          display: 'grid',
          gap: 1,
          mt: 0.5,
          alignItems: 'center',
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'auto auto auto 1fr auto' },
          '& [role=group]': { justifyContent: 'space-between', width: { xs: '100%', sm: 'auto' } },
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 700, display: { xs: 'none', sm: 'block' }, width: 44 }}>
          {complete ? '+1' : `Set ${nextNumber}`}
        </Typography>
        <NumberStepper label={`${exercise} weight`} unit="kg" value={weight} step={2.5} max={500} decimals={1} onChange={setWeight} />
        <NumberStepper label={`${exercise} reps`} unit="reps" value={reps} step={1} max={100} onChange={setReps} />
        <Box sx={{ display: { xs: 'none', sm: 'block' } }} />
        <Button
          variant={complete ? 'outlined' : 'contained'}
          onClick={() => void log()}
          disabled={busy}
          aria-label={`Log set ${nextNumber}: ${weight} kg × ${reps}`}
          startIcon={<CheckRoundedIcon />}
          sx={{ minHeight: 48, px: 2, gridColumn: { xs: '1 / -1', sm: 'auto' } }}
        >
          <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
            {complete ? 'Extra set' : `Log set ${nextNumber}`} · {Number(weight.toFixed(1))} kg × {reps}
          </Box>
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            Log
          </Box>
        </Button>
      </Box>
      {!complete && (
        <Typography variant="caption" color="text.secondary">
          Pre-filled from {hint}. Adjust if needed, then tap ✓.
        </Typography>
      )}
    </Paper>
  );
}

/** Rest countdown with a buzz at the end (where the device supports it). */
function RestTimer({ endsAt, onDone, onAdd }: { endsAt: number; onDone: () => void; onAdd: (seconds: number) => void }) {
  const [now, setNow] = useState(Date.now());
  const buzzed = useRef(false);
  useEffect(() => {
    buzzed.current = false;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [endsAt]);
  const left = Math.max(0, Math.round((endsAt - now) / 1000));
  useEffect(() => {
    if (left === 0 && !buzzed.current) {
      buzzed.current = true;
      navigator.vibrate?.([200, 100, 200]);
    }
  }, [left]);
  return (
    <Paper
      variant="outlined"
      role="timer"
      aria-live="polite"
      sx={{ position: 'sticky', top: 84, zIndex: 2, p: 1, pl: 1.5, borderRadius: 999, display: 'flex', alignItems: 'center', gap: 1 }}
    >
      <TimerRoundedIcon color={left === 0 ? 'success' : 'secondary'} />
      <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexGrow: 1 }}>
        {left === 0 ? 'Rest done, next set' : `Rest ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}
      </Typography>
      <Button size="small" onClick={() => onAdd(30)}>
        +30s
      </Button>
      <Button size="small" onClick={onDone}>
        {left === 0 ? 'Close' : 'Skip'}
      </Button>
    </Paper>
  );
}
