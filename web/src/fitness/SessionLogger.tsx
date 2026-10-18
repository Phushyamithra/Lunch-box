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
  ListSubheader,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from '../layout/Snackbar';
import { useFitness } from './FitnessContext';
import type { FitnessData, SessionRow, WorkoutSetRow } from './fitnessApi';
import {
  MUSCLE_EMOJI,
  buildMuscleMap,
  exerciseEmoji,
  muscleForTarget,
  muscleOf,
  swapOptions,
  swapWarning,
  weeklyCoverage,
  type Muscle,
  type SwapGroup,
} from './muscles';
import { NumberStepper } from './NumberStepper';
import { exerciseOptions } from './referenceImport';
import { addDays, isAway, isCompoundSlot, isoWeekday, setProgress, suggestSet, variantIndexFor, weekStart } from './rules';
import { SwipeRow, type SwipeRowHandle } from './SwipeRow';
import { Card } from './ui';

const WEEKDAY = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const FINISHER_SLOT = 6;
const CUSTOM = '__custom__';

interface PlannedExercise {
  key: string;
  slot: number;
  title: string;
  muscle: Muscle | null;
  groups: SwapGroup[];
  sets: number;
  repsHint?: string;
  compound: boolean;
}

/**
 * Today's workout as swipeable cards: pick the week's variant (or another),
 * then work through one card per exercise. Every set is pre-filled; swap an
 * exercise from the dropdown when a machine is taken, and the app flags any
 * muscle the swap leaves short this week.
 */
export function SessionLogger({ day, data }: { day: string; data: FitnessData }) {
  const navigate = useNavigate();
  const toast = useSnackbar();
  const { saveSession } = useFitness();
  const weekday = isoWeekday(day);
  const plannedVariant = variantIndexFor(day, data.settings.rotation_start, data.settings.rotation_offset);
  const session = data.sessions.find((s) => s.day === day);
  const usedVariant = session?.variant_index ?? plannedVariant;
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const deck = useRef<SwipeRowHandle>(null);

  const daySlots = useMemo(
    () => [1, 2, 3, 4, 5].map((n) => data.slots.find((s) => s.weekday === weekday && s.slot === n)).filter((s): s is NonNullable<typeof s> => Boolean(s)),
    [data.slots, weekday],
  );
  const muscleMap = useMemo(() => buildMuscleMap(data.slots, data.settings.finishers), [data.slots, data.settings.finishers]);

  const plan: PlannedExercise[] = useMemo(() => {
    const main = daySlots.map((s) => ({
      key: `slot-${s.slot}`,
      slot: s.slot,
      title: s.label || `Slot ${s.slot}`,
      muscle: muscleForTarget(s.label),
      groups: swapOptions(s, usedVariant, data.slots, muscleMap),
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
          muscle: muscleForTarget(f.name),
          groups: [{ label: f.name, options: exerciseOptions(e.name) }],
          sets: e.sets,
          repsHint: e.reps,
          compound: false,
        })),
      );
    return [...main, ...finishers];
  }, [daySlots, data.slots, data.settings.finishers, weekday, usedVariant, muscleMap]);

  const daySets = useMemo(() => (session ? data.sets.filter((s) => s.session_id === session.id) : []), [data.sets, session]);
  const main = plan.filter((p) => p.slot !== FINISHER_SLOT);
  const plannedPerSlot = [1, 2, 3, 4, 5].map((n) => main.find((p) => p.slot === n)?.sets ?? 0);
  const progressFor = (sets: WorkoutSetRow[]) =>
    setProgress(plannedPerSlot, new Map([1, 2, 3, 4, 5].map((n) => [n, sets.filter((s) => s.slot === n).length])));
  const progress = progressFor(daySets);
  const cardioThisWeek = data.sessions.filter((s) => s.cardio_done && s.day >= weekStart(day) && s.day <= addDays(weekStart(day), 6)).length;

  if (weekday === 7) {
    return (
      <Card title="😌 Rest day">
        <Typography color="text.secondary">Sunday: walk, stretch, {data.settings.steps_target.toLocaleString('en-IN')} steps.</Typography>
      </Card>
    );
  }

  const persist = async (patch: Partial<Pick<SessionRow, 'completed' | 'slots_completed' | 'cardio_done' | 'variant_index'>>) => {
    setSaving(true);
    try {
      return await saveSession({
        day,
        variant_index: patch.variant_index ?? usedVariant,
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

  const afterSet = async (index: number, planned: PlannedExercise, setsAfter: WorkoutSetRow[], current: SessionRow, slotDone: boolean) => {
    const done = progressFor(setsAfter);
    const allDone = main.length > 0 && done.slotsDone === main.length;
    if (done.slotsDone !== current.slots_completed || (allDone && !current.completed)) {
      await persist({ slots_completed: done.slotsDone, completed: current.completed || allDone });
      if (allDone && !current.completed) toast('🎉 Session complete. Great work!');
    }
    setRestEnd(Date.now() + (planned.compound ? data.settings.rest_compound_sec : data.settings.rest_isolation_sec) * 1000);
    if (slotDone && index < plan.length - 1) window.setTimeout(() => deck.current?.scrollTo(index + 1), 450);
  };

  const firstOpen = Math.max(
    0,
    plan.findIndex((p) => {
      const n = daySets.filter((s) => s.slot === p.slot && (p.slot !== FINISHER_SLOT || p.groups[0].options.some((o) => o.toLowerCase() === s.exercise.toLowerCase()))).length;
      return n < p.sets;
    }),
  );

  return (
    <Card
      title={`${WEEKDAY[weekday]}${data.settings.day_focus[String(weekday)] ? ` · ${data.settings.day_focus[String(weekday)]}` : ''}`}
      aside={<Chip size="small" color="secondary" label={`V${usedVariant + 1}${usedVariant !== plannedVariant ? ' (swapped)' : ''}`} />}
    >
      <Stack spacing={2}>
        {main.length === 0 ? (
          <Alert severity="info" action={<Button color="inherit" onClick={() => navigate('/fitness/program')}>Set up</Button>}>
            No program for {WEEKDAY[weekday]} yet. Import your reference file under Program.
          </Alert>
        ) : (
          <>
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {progress.logged} of {progress.planned} working sets
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {progress.slotsDone}/{main.length} exercises done
                </Typography>
              </Box>
              <LinearProgress variant="determinate" color="secondary" value={progress.planned ? (progress.logged / progress.planned) * 100 : 0} aria-label={`${progress.logged} of ${progress.planned} sets`} />
            </Box>

            <VariantCarousel
              data={data}
              weekday={weekday}
              planned={plannedVariant}
              used={usedVariant}
              disabled={saving}
              onPick={async (i) => {
                if (daySets.length && !window.confirm(`Switch today to V${i + 1}? Sets already logged keep the exercises you did.`)) return;
                const saved = await persist({ variant_index: i });
                if (saved) toast(`Training V${i + 1} today`);
              }}
            />

            <MuscleCoverageCard data={data} day={day} muscleMap={muscleMap} />
          </>
        )}

        <AnimatePresence>
          {restEnd && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={{ position: 'sticky', top: 84, zIndex: 3 }}>
              <RestTimer endsAt={restEnd} onDone={() => setRestEnd(null)} onAdd={(s) => setRestEnd((e) => (e ?? Date.now()) + s * 1000)} />
            </motion.div>
          )}
        </AnimatePresence>

        {plan.length > 0 && (
          <SwipeRow ref={deck} label="Exercises" cardWidth="88%" desktopWidth={360} initialIndex={firstOpen}>
            {plan.map((p, i) => (
              <ExerciseCard
                key={`${p.key}-${usedVariant}`}
                index={i}
                count={plan.length}
                planned={p}
                day={day}
                data={data}
                daySets={daySets}
                muscleMap={muscleMap}
                ensureSession={async () => session ?? (await persist({}))}
                afterSet={afterSet}
              />
            ))}
          </SwipeRow>
        )}

        <Stack spacing={0.5}>
          <FormControlLabel
            control={<Switch checked={session?.cardio_done ?? false} disabled={saving} onChange={(e) => void persist({ cardio_done: e.target.checked })} />}
            label={`🚶 Incline walk · 20 min at 8–10% (${cardioThisWeek}/${data.settings.cardio_per_week} this week)`}
          />
          <FormControlLabel
            control={
              <Switch
                checked={session?.completed ?? false}
                disabled={saving}
                onChange={(e) => void persist({ completed: e.target.checked, slots_completed: e.target.checked && !session?.slots_completed ? 5 : session?.slots_completed })}
              />
            }
            label="✅ Session done (quick check-in, no sets needed)"
          />
        </Stack>
      </Stack>
    </Card>
  );
}

/** V1–V7 for this weekday as swipeable cards; pick which one to train today. */
function VariantCarousel({
  data,
  weekday,
  planned,
  used,
  disabled,
  onPick,
}: {
  data: FitnessData;
  weekday: number;
  planned: number;
  used: number;
  disabled: boolean;
  onPick: (i: number) => void;
}) {
  const slots = [1, 2, 3, 4, 5].map((n) => data.slots.find((s) => s.weekday === weekday && s.slot === n));
  return (
    <SwipeRow label="Variants for today" cardWidth="78%" desktopWidth={250} initialIndex={used}>
      {Array.from({ length: 7 }, (_, i) => {
        const active = i === used;
        return (
          <motion.div key={i} whileTap={{ scale: 0.98 }} style={{ height: '100%' }}>
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                height: '100%',
                borderRadius: '20px',
                borderColor: active ? 'secondary.main' : undefined,
                borderWidth: active ? 2 : 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.75,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 18, flexGrow: 1 }}>V{i + 1}</Typography>
                {i === planned && <Chip size="small" label="This week" color="secondary" />}
                {active && i !== planned && <Chip size="small" label="Today" />}
              </Box>
              {slots.map((s, n) => {
                const [def, fallback] = exerciseOptions(s?.variants[i] ?? '');
                return (
                  <Box key={n} sx={{ display: 'flex', gap: 0.75, alignItems: 'baseline', minWidth: 0 }}>
                    <Box component="span" aria-hidden sx={{ width: 22, flexShrink: 0 }}>
                      {def ? exerciseEmoji(def) : '·'}
                    </Box>
                    <Typography variant="body2" noWrap sx={{ minWidth: 0 }} title={[def, fallback].filter(Boolean).join(' / ')}>
                      {def || <em>not set</em>}
                      {fallback && (
                        <Typography component="span" variant="caption" color="text.secondary">
                          {' '}
                          / {fallback}
                        </Typography>
                      )}
                    </Typography>
                  </Box>
                );
              })}
              <Box sx={{ flexGrow: 1 }} />
              <Button size="small" variant={active ? 'contained' : 'outlined'} disabled={active || disabled} onClick={() => onPick(i)}>
                {active ? 'Training today' : `Train V${i + 1} today`}
              </Button>
            </Paper>
          </motion.div>
        );
      })}
    </SwipeRow>
  );
}

/** This week's direct sets per muscle vs the plan so far; flags what's falling behind. */
function MuscleCoverageCard({ data, day, muscleMap }: { data: FitnessData; day: string; muscleMap: Map<string, Muscle> }) {
  const start = weekStart(day);
  const daysSoFar = [1, 2, 3, 4, 5, 6].filter((d) => d <= isoWeekday(day) && !isAway(addDays(start, d - 1), data.away));
  const weekSessions = new Map(data.sessions.filter((s) => s.day >= start && s.day <= addDays(start, 6)).map((s) => [s.id, s.day]));
  const logged = data.sets.filter((s) => weekSessions.has(s.session_id)).map((s) => ({ exercise: s.exercise, slot: s.slot, day: weekSessions.get(s.session_id) as string }));
  const coverage = weeklyCoverage(data.slots, data.settings.finishers, logged, daysSoFar, muscleMap);
  const behind = coverage.filter((c) => c.status === 'behind' && c.expectedSoFar - c.done >= 2 && c.muscle !== 'Abs' && c.muscle !== 'Forearms');
  if (coverage.length === 0) return null;
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        This week’s muscles · sets done / planned
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
        {coverage.map((c, i) => (
          <motion.div key={c.muscle} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}>
            <Tooltip title={`${c.done} done · ${c.expectedSoFar} planned so far · ${c.planned} this week`}>
              <Chip
                size="small"
                label={`${MUSCLE_EMOJI[c.muscle]} ${c.muscle} ${c.done}/${c.planned}`}
                color={c.status === 'behind' && c.expectedSoFar - c.done >= 2 ? 'warning' : c.done >= c.planned && c.planned > 0 ? 'success' : 'default'}
                variant={c.status === 'not_started' ? 'outlined' : 'filled'}
              />
            </Tooltip>
          </motion.div>
        ))}
      </Box>
      <AnimatePresence>
        {behind.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Alert severity="warning" sx={{ mt: 1 }}>
              Behind so far this week: {behind.map((c) => `${c.muscle} (${c.expectedSoFar - c.done} sets)`).join(', ')}. A swapped machine may have
              skipped it; add a set or two where it fits.
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}

function ExerciseCard({
  index,
  count,
  planned,
  day,
  data,
  daySets,
  muscleMap,
  ensureSession,
  afterSet,
}: {
  index: number;
  count: number;
  planned: PlannedExercise;
  day: string;
  data: FitnessData;
  daySets: WorkoutSetRow[];
  muscleMap: Map<string, Muscle>;
  ensureSession: () => Promise<SessionRow | null>;
  afterSet: (index: number, planned: PlannedExercise, setsAfter: WorkoutSetRow[], session: SessionRow, slotDone: boolean) => Promise<void>;
}) {
  const { addSet, removeSet } = useFitness();
  const toast = useSnackbar();
  const allOptions = planned.groups.flatMap((g) => g.options);
  const inSlot = daySets.filter((s) => s.slot === planned.slot);
  const mine = planned.slot === FINISHER_SLOT ? inSlot.filter((s) => allOptions.some((o) => o.toLowerCase() === s.exercise.toLowerCase())) : inSlot;
  const logged = [...mine].sort((a, b) => a.set_number - b.set_number);
  const [exercise, setExercise] = useState(logged[0]?.exercise ?? allOptions[0] ?? '');
  const [custom, setCustom] = useState(Boolean(logged[0] && !allOptions.some((o) => o.toLowerCase() === logged[0].exercise.toLowerCase())));
  const nextNumber = logged.length + 1;
  const suggestion = suggestSet(exercise, nextNumber, day, data.sets, data.sessions, data.presets);
  const [weight, setWeight] = useState(suggestion.weight);
  const [reps, setReps] = useState(suggestion.reps);
  const [busy, setBusy] = useState(false);
  const complete = logged.length >= planned.sets;
  const warning = planned.slot === FINISHER_SLOT ? null : swapWarning(planned.title, exercise, muscleMap);
  const muscle = exercise ? muscleOf(exercise, muscleMap) ?? planned.muscle : planned.muscle;

  // Re-fill the active row when the exercise or set number changes.
  useEffect(() => {
    setWeight(suggestion.weight);
    setReps(suggestion.reps);
  }, [exercise, nextNumber]);

  const choose = (value: string) => {
    if (value === CUSTOM) {
      setCustom(true);
      setExercise('');
      return;
    }
    setCustom(false);
    setExercise(value);
    const w = planned.slot === FINISHER_SLOT ? null : swapWarning(planned.title, value, muscleMap);
    if (w) {
      toast(`⚠️ ${value} trains ${w.to ?? 'a different muscle'}, not ${w.from}: ${w.from} will be ${planned.sets} sets short this week.`, { severity: 'warning' });
    }
  };

  const log = async () => {
    if (!exercise.trim()) return toast('Choose or type the exercise first.', { severity: 'info' });
    setBusy(true);
    try {
      const session = await ensureSession();
      if (!session) return;
      const row = await addSet({ session_id: session.id, slot: planned.slot, exercise: exercise.trim(), set_number: nextNumber, reps, weight_kg: weight });
      await afterSet(index, planned, [...daySets, row], session, logged.length + 1 === planned.sets);
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
        ? 'your starting weight'
        : suggestion.from === 'previous_set'
          ? 'your previous set'
          : 'nothing yet: set the weight';

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: Math.min(index, 6) * 0.04 }}>
      <Paper variant="outlined" sx={{ p: 1.75, borderRadius: '22px', height: '100%', display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <motion.div key={exercise} initial={{ scale: 0.6, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
            <Box
              aria-hidden
              sx={{ width: 44, height: 44, borderRadius: '14px', display: 'grid', placeItems: 'center', fontSize: 24, bgcolor: (t) => t.tracker.tonal }}
            >
              {complete ? '✅' : exerciseEmoji(exercise || planned.title)}
            </Box>
          </motion.div>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {index + 1}/{count} · {planned.title}
            </Typography>
            <Typography variant="body2" color={complete ? 'success.main' : 'text.secondary'} sx={{ fontWeight: 700 }}>
              {logged.length}/{planned.sets} sets{planned.repsHint ? ` · ${planned.repsHint}` : ''}
            </Typography>
          </Box>
          {muscle && <Chip size="small" variant="outlined" label={`${MUSCLE_EMOJI[muscle]} ${muscle}`} />}
        </Box>

        <TextField
          select
          size="small"
          label="Exercise"
          value={custom ? CUSTOM : exercise}
          onChange={(e) => choose(e.target.value)}
          disabled={logged.length > 0}
          helperText={logged.length > 0 ? 'Undo the logged sets to change the exercise.' : 'Machine taken? Pick another.'}
          SelectProps={{ MenuProps: { PaperProps: { sx: { maxHeight: 420 } } } }}
        >
          {planned.groups.flatMap((g) => [
            <ListSubheader key={`h-${g.label}`}>{g.label}</ListSubheader>,
            ...g.options.map((o, i) => (
              <MenuItem key={`${g.label}-${o}`} value={o}>
                <Box component="span" aria-hidden sx={{ mr: 1 }}>
                  {exerciseEmoji(o)}
                </Box>
                {o}
                {g.label === 'This week' && i === 1 && (
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>
                    fallback
                  </Typography>
                )}
              </MenuItem>
            )),
          ])}
          <MenuItem value={CUSTOM}>✏️ Type another exercise…</MenuItem>
        </TextField>
        {custom && logged.length === 0 && (
          <TextField size="small" label="Exercise name" value={exercise} onChange={(e) => setExercise(e.target.value)} autoFocus />
        )}
        <AnimatePresence>
          {warning && logged.length === 0 && exercise && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <Alert severity="warning" sx={{ py: 0 }}>
                Trains {warning.to ?? 'a different muscle'}, not {warning.from}.
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          <AnimatePresence initial={false}>
            {logged.map((s) => (
              <motion.li
                key={s.id}
                layout
                initial={{ opacity: 0, x: -12, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}
              >
                <CheckRoundedIcon fontSize="small" color="success" />
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  Set {s.set_number} · <strong>{Number(s.weight_kg).toString()} kg × {s.reps}</strong>
                  {s.exercise.toLowerCase() !== exercise.toLowerCase() && ` · ${s.exercise}`}
                </Typography>
                <IconButton size="small" aria-label={`Undo set ${s.set_number}`} onClick={() => void removeSet(s.id)}>
                  <CloseRoundedIcon fontSize="small" />
                </IconButton>
              </motion.li>
            ))}
          </AnimatePresence>
        </Box>

        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: '1fr 1fr', '& [role=group]': { justifyContent: 'space-between', width: '100%' } }}>
          <NumberStepper label={`${exercise} weight`} unit="kg" value={weight} step={2.5} max={500} decimals={1} onChange={setWeight} />
          <NumberStepper label={`${exercise} reps`} unit="reps" value={reps} step={1} max={100} onChange={setReps} />
          <motion.div whileTap={{ scale: 0.97 }} style={{ gridColumn: '1 / -1' }}>
            <Button
              fullWidth
              variant={complete ? 'outlined' : 'contained'}
              onClick={() => void log()}
              disabled={busy}
              aria-label={`Log set ${nextNumber}: ${weight} kg × ${reps}`}
              startIcon={<CheckRoundedIcon />}
              sx={{ minHeight: 50 }}
            >
              {complete ? 'Extra set' : `Log set ${nextNumber}`} · {Number(weight.toFixed(1))} kg × {reps}
            </Button>
          </motion.div>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {complete ? 'All planned sets done. Swipe for the next exercise →' : `Pre-filled from ${hint}.`}
        </Typography>
      </Paper>
    </motion.div>
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
    <Paper variant="outlined" role="timer" aria-live="polite" sx={{ p: 1, pl: 1.5, borderRadius: 999, display: 'flex', alignItems: 'center', gap: 1 }}>
      <TimerRoundedIcon color={left === 0 ? 'success' : 'secondary'} />
      <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexGrow: 1 }}>
        {left === 0 ? '⏰ Rest done, next set' : `Rest ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}
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
