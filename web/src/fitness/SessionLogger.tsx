import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import {
  Alert,
  Autocomplete,
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
import {
  EXTRA_SLOT_BASE,
  MAX_EXTRAS,
  buildDayPlan,
  dayProgress,
  isMixed,
  setsForItem,
  suggestVariant,
  variantsFor,
  type CustomExercise,
  type CustomWorkout,
  type PlanItem,
} from './dayPlan';
import { useFitness } from './FitnessContext';
import type { FitnessData, SessionInput, SessionRow, WorkoutSetRow } from './fitnessApi';
import {
  MUSCLE_EMOJI,
  buildMuscleMap,
  exerciseEmoji,
  muscleOf,
  muscleOfCard,
  swapGroups,
  swapWarning,
  weeklyCoverage,
  type Muscle,
  type SwapGroup,
} from './muscles';
import { NumberStepper } from './NumberStepper';
import { exerciseOptions } from './referenceImport';
import { addDays, isAway, isoWeekday, suggestSet, variantIndexFor, weekStart } from './rules';
import { SwipeRow, type SwipeRowHandle } from './SwipeRow';
import { Card } from './ui';
import { WorkoutEditor, knownExercises } from './WorkoutEditor';

const WEEKDAY = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const CUSTOM = '__custom__';

type SessionPatch = Partial<Omit<SessionInput, 'day'>>;

/**
 * Today's workout as swipeable cards. First pick what to train (any
 * variant, or one of your own cards; the next variant for this day is
 * suggested), then work through one card per exercise. Every set is
 * pre-filled; swap an exercise or a slot's variant when a machine is taken,
 * and the app flags any muscle that falls behind this week.
 */
export function SessionLogger({ day, data }: { day: string; data: FitnessData }) {
  const navigate = useNavigate();
  const toast = useSnackbar();
  const { saveSession } = useFitness();
  const weekday = isoWeekday(day);
  const rotation = variantIndexFor(day, data.settings.rotation_start, data.settings.rotation_offset);
  const suggestion = suggestVariant(day, data.sessions, data.slots, rotation);
  const session = data.sessions.find((s) => s.day === day);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<CustomWorkout | 'new' | null>(null);
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const deck = useRef<SwipeRowHandle>(null);

  const muscleMap = useMemo(() => buildMuscleMap(data.slots, data.settings.finishers), [data.slots, data.settings.finishers]);
  const current = {
    variant_index: session?.variant_index ?? suggestion.index,
    slot_variants: session?.slot_variants ?? {},
    custom_workout_id: session?.custom_workout_id ?? null,
    extras: session?.extras ?? [],
  };
  const plan = useMemo(
    () => buildDayPlan({ weekday, session: current, slots: data.slots, finishers: data.settings.finishers, workouts: data.workouts }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weekday, session, suggestion.index, data.slots, data.settings.finishers, data.workouts],
  );
  const daySets = useMemo(() => (session ? data.sets.filter((s) => s.session_id === session.id) : []), [data.sets, session]);
  const progress = dayProgress(plan, daySets);
  const workout = current.custom_workout_id ? data.workouts.find((w) => w.id === current.custom_workout_id) : undefined;
  const cardioThisWeek = data.sessions.filter((s) => s.cardio_done && s.day >= weekStart(day) && s.day <= addDays(weekStart(day), 6)).length;
  const hasProgram = variantsFor(weekday, data.slots).length > 0;
  const dayWorkouts = data.workouts.filter((w) => w.weekday === null || w.weekday === weekday);
  const showPicker = picking || (!session && (hasProgram || dayWorkouts.length > 0));

  if (weekday === 7 && !session && dayWorkouts.length === 0) {
    return (
      <Card title="😌 Rest day">
        <Typography color="text.secondary">Sunday: walk, stretch, {data.settings.steps_target.toLocaleString('en-IN')} steps.</Typography>
        <Button size="small" sx={{ mt: 1 }} startIcon={<AddRoundedIcon />} onClick={() => setEditing('new')}>
          Make a Sunday card anyway
        </Button>
        <WorkoutEditor open={editing !== null} workout={null} weekday={weekday} data={data} onClose={() => setEditing(null)} />
      </Card>
    );
  }

  const persist = async (patch: SessionPatch) => {
    setSaving(true);
    try {
      return await saveSession({
        day,
        variant_index: patch.variant_index ?? current.variant_index,
        slot_variants: patch.slot_variants ?? current.slot_variants,
        custom_workout_id: patch.custom_workout_id !== undefined ? patch.custom_workout_id : current.custom_workout_id,
        extras: patch.extras ?? current.extras,
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

  const confirmSwitch = (what: string) => daySets.length === 0 || window.confirm(`Switch today to ${what}? Sets already logged keep the exercises you did.`);
  const pickVariant = async (i: number) => {
    if (!confirmSwitch(`V${i + 1}`)) return;
    if (await persist({ variant_index: i, slot_variants: {}, custom_workout_id: null })) {
      setPicking(false);
      toast(`💪 V${i + 1} today`);
    }
  };
  const pickWorkout = async (w: CustomWorkout) => {
    if (!confirmSwitch(`“${w.name}”`)) return;
    if (await persist({ custom_workout_id: w.id, slot_variants: {} })) {
      setPicking(false);
      toast(`💪 ${w.name} today`);
    }
  };

  const afterSet = async (index: number, item: PlanItem, setsAfter: WorkoutSetRow[], saved: SessionRow, itemDone: boolean) => {
    const done = dayProgress(plan, setsAfter);
    const allDone = done.total > 0 && done.done === done.total;
    if (done.done !== saved.slots_completed || (allDone && !saved.completed)) {
      await persist({ slots_completed: done.done, completed: saved.completed || allDone });
      if (allDone && !saved.completed) toast('🎉 Session complete. Great work!');
    }
    setRestEnd(Date.now() + (item.compound ? data.settings.rest_compound_sec : data.settings.rest_isolation_sec) * 1000);
    if (itemDone && index < plan.length) window.setTimeout(() => deck.current?.scrollTo(index + 1), 450);
  };

  const firstOpen = Math.max(0, plan.findIndex((p) => setsForItem(p, daySets).length < p.sets));
  const label = workout ? workout.name : `V${current.variant_index + 1}`;

  return (
    <Card
      title={`${WEEKDAY[weekday]}${data.settings.day_focus[String(weekday)] ? ` · ${data.settings.day_focus[String(weekday)]}` : ''}`}
      aside={
        session && !showPicker ? (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <Chip size="small" color="secondary" label={`${label}${!workout && isMixed(current) ? ' · mixed' : ''}`} onClick={() => setPicking(true)} icon={<SwapHorizRoundedIcon />} />
          </motion.div>
        ) : undefined
      }
    >
      <Stack spacing={2}>
        {!hasProgram && dayWorkouts.length === 0 && (
          <Alert
            severity="info"
            action={
              <Stack direction="row">
                <Button color="inherit" onClick={() => setEditing('new')}>
                  New card
                </Button>
                <Button color="inherit" onClick={() => navigate('/fitness/program')}>
                  Import
                </Button>
              </Stack>
            }
          >
            No program for {WEEKDAY[weekday]} yet. Import your reference file, or make your own card.
          </Alert>
        )}

        <AnimatePresence initial={false} mode="wait">
          {showPicker ? (
            <motion.div key="picker" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <DayPicker
                data={data}
                weekday={weekday}
                suggested={suggestion.index}
                suggestedWhy={suggestion.reason}
                current={session ? current : null}
                disabled={saving}
                onVariant={(i) => void pickVariant(i)}
                onWorkout={(w) => void pickWorkout(w)}
                onEdit={(w) => setEditing(w)}
                onNew={() => setEditing('new')}
                onCancel={session ? () => setPicking(false) : undefined}
              />
            </motion.div>
          ) : (
            <motion.div key="deck" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.2 }}>
              <Stack spacing={2}>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {progress.logged} of {progress.planned} working sets
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {progress.done}/{progress.total} exercises done
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    color="secondary"
                    value={progress.planned ? (progress.logged / progress.planned) * 100 : 0}
                    aria-label={`${progress.logged} of ${progress.planned} sets`}
                    sx={{ '& .MuiLinearProgress-bar': { transition: 'transform 500ms cubic-bezier(.2,.8,.2,1)' } }}
                  />
                </Box>

                <MuscleCoverageCard data={data} day={day} muscleMap={muscleMap} />

                <AnimatePresence>
                  {restEnd && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={{ position: 'sticky', top: 84, zIndex: 3 }}>
                      <RestTimer endsAt={restEnd} onDone={() => setRestEnd(null)} onAdd={(s) => setRestEnd((e) => (e ?? Date.now()) + s * 1000)} />
                    </motion.div>
                  )}
                </AnimatePresence>

                <SwipeRow ref={deck} label="Exercises" cardWidth="88%" desktopWidth={360} initialIndex={firstOpen}>
                  {[
                    ...plan.map((p, i) => (
                      <ExerciseCard
                        key={`${p.key}-${p.variantIndex}-${p.options.join('|')}`}
                        index={i}
                        count={plan.length}
                        item={p}
                        groups={groupsFor(p, weekday, data, muscleMap)}
                        day={day}
                        data={data}
                        daySets={daySets}
                        muscleMap={muscleMap}
                        dayVariant={current.variant_index}
                        ensureSession={async () => session ?? (await persist({}))}
                        afterSet={afterSet}
                        onVariant={
                          p.kind === 'program'
                            ? async (v) => {
                                const next = { ...current.slot_variants };
                                if (v === current.variant_index) delete next[String(p.slot)];
                                else next[String(p.slot)] = v;
                                if (await persist({ slot_variants: next })) toast(`${p.title}: V${v + 1} today`);
                              }
                            : undefined
                        }
                        onRemove={
                          p.kind === 'extra'
                            ? async () => {
                                const n = p.slot - EXTRA_SLOT_BASE;
                                await persist({ extras: current.extras.filter((_, i) => i !== n) });
                              }
                            : undefined
                        }
                      />
                    )),
                    <AddExerciseCard
                      key="add"
                      data={data}
                      full={current.extras.length >= MAX_EXTRAS}
                      onAdd={async (e) => {
                        const saved = await persist({ extras: [...current.extras, e] });
                        if (saved) {
                          toast(`➕ ${e.exercise} added`);
                          window.setTimeout(() => deck.current?.scrollTo(plan.length), 300);
                        }
                        return Boolean(saved);
                      }}
                    />,
                  ]}
                </SwipeRow>
              </Stack>
            </motion.div>
          )}
        </AnimatePresence>

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
                onChange={(e) => void persist({ completed: e.target.checked, slots_completed: e.target.checked && !session?.slots_completed ? progress.total : session?.slots_completed })}
              />
            }
            label="✅ Session done (quick check-in, no sets needed)"
          />
        </Stack>
      </Stack>
      <WorkoutEditor
        open={editing !== null}
        workout={editing === 'new' ? null : editing}
        weekday={weekday}
        data={data}
        onClose={() => setEditing(null)}
      />
    </Card>
  );
}

function groupsFor(p: PlanItem, weekday: number, data: FitnessData, map: Map<string, Muscle>): SwapGroup[] {
  if (p.kind === 'finisher') return [{ label: p.title.replace(' finisher', ''), options: p.options }];
  const slot = p.kind === 'program' ? data.slots.find((s) => s.weekday === weekday && s.slot === p.slot) : undefined;
  return swapGroups(p.title, p.options, slot ? slot.variants.flatMap(exerciseOptions) : [], data.slots, map);
}

/** Swipeable cards: each variant for this day, your own cards, and “new card”. */
function DayPicker({
  data,
  weekday,
  suggested,
  suggestedWhy,
  current,
  disabled,
  onVariant,
  onWorkout,
  onEdit,
  onNew,
  onCancel,
}: {
  data: FitnessData;
  weekday: number;
  suggested: number;
  suggestedWhy: 'next' | 'rotation';
  current: { variant_index: number; custom_workout_id: string | null } | null;
  disabled: boolean;
  onVariant: (i: number) => void;
  onWorkout: (w: CustomWorkout) => void;
  onEdit: (w: CustomWorkout) => void;
  onNew: () => void;
  onCancel?: () => void;
}) {
  const slots = data.slots.filter((s) => s.weekday === weekday).sort((a, b) => a.slot - b.slot);
  const variants = variantsFor(weekday, data.slots);
  const workouts = data.workouts.filter((w) => w.weekday === null || w.weekday === weekday);
  const activeVariant = current && !current.custom_workout_id ? current.variant_index : null;
  const ordered = [suggested, ...variants.filter((v) => v !== suggested)].filter((v) => variants.includes(v));
  const lastOnDay = suggestedWhy === 'next' ? 'next after last time' : 'from the rotation';

  const cards = [
    ...ordered.map((i) => {
      const active = activeVariant === i;
      return (
        <PickCard key={`v${i}`} active={active} index={i}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 20, flexGrow: 1 }}>V{i + 1}</Typography>
            {i === suggested && (
              <Tooltip title={`Suggested: ${lastOnDay}`}>
                <Chip size="small" color="secondary" label={suggestedWhy === 'next' ? '✨ Next up' : '✨ Suggested'} />
              </Tooltip>
            )}
            {active && <Chip size="small" label="Today" />}
          </Box>
          {slots.map((s) => {
            const [def, fallback] = exerciseOptions(s.variants[i] ?? '');
            return (
              <Box key={s.slot} sx={{ display: 'flex', gap: 0.75, alignItems: 'baseline', minWidth: 0 }}>
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
          <Button variant={active ? 'outlined' : 'contained'} disabled={active || disabled} onClick={() => onVariant(i)} sx={{ minHeight: 44 }}>
            {active ? 'Training today' : `Train V${i + 1}`}
          </Button>
        </PickCard>
      );
    }),
    ...workouts.map((w, n) => {
      const active = current?.custom_workout_id === w.id;
      return (
        <PickCard key={w.id} active={active} index={ordered.length + n}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 18, flexGrow: 1, minWidth: 0 }} noWrap>
              ⭐ {w.name}
            </Typography>
            <IconButton size="small" aria-label={`Edit ${w.name}`} onClick={() => onEdit(w)}>
              <EditRoundedIcon fontSize="small" />
            </IconButton>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Your card · {w.weekday ? `${WEEKDAY[w.weekday]}s` : 'any day'}
          </Typography>
          {w.exercises.slice(0, 6).map((e, k) => (
            <Box key={k} sx={{ display: 'flex', gap: 0.75, alignItems: 'baseline', minWidth: 0 }}>
              <Box component="span" aria-hidden sx={{ width: 22, flexShrink: 0 }}>
                {exerciseEmoji(e.exercise)}
              </Box>
              <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
                {exerciseOptions(e.exercise)[0]}{' '}
                <Typography component="span" variant="caption" color="text.secondary">
                  × {e.sets}
                </Typography>
              </Typography>
            </Box>
          ))}
          {w.exercises.length > 6 && (
            <Typography variant="caption" color="text.secondary">
              +{w.exercises.length - 6} more
            </Typography>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <Button variant={active ? 'outlined' : 'contained'} disabled={active || disabled} onClick={() => onWorkout(w)} sx={{ minHeight: 44 }}>
            {active ? 'Training today' : 'Train this'}
          </Button>
        </PickCard>
      );
    }),
    <PickCard key="new" active={false} index={ordered.length + workouts.length} dashed>
      <Box sx={{ flexGrow: 1, display: 'grid', placeItems: 'center', textAlign: 'center', gap: 1, py: 2 }}>
        <Box aria-hidden sx={{ fontSize: 34 }}>
          🧩
        </Box>
        <Typography sx={{ fontWeight: 700 }}>Make your own card</Typography>
        <Typography variant="body2" color="text.secondary">
          Mix exercises from any variant, or a whole new workout.
        </Typography>
      </Box>
      <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={onNew} sx={{ minHeight: 44 }}>
        New card
      </Button>
    </PickCard>,
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, flexGrow: 1 }}>
          {current ? 'Change today’s workout' : 'What are you training today?'}
        </Typography>
        {onCancel && (
          <Button size="small" onClick={onCancel}>
            Back to sets
          </Button>
        )}
      </Box>
      <SwipeRow label="Workouts for today" cardWidth="80%" desktopWidth={260}>
        {cards}
      </SwipeRow>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        Swipe to pick any variant. You can still swap single exercises (or their variant) on each card.
      </Typography>
    </Box>
  );
}

function PickCard({ active, index, dashed, children }: { active: boolean; index: number; dashed?: boolean; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 6) * 0.05, duration: 0.25 }} whileTap={{ scale: 0.98 }} style={{ height: '100%' }}>
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          height: '100%',
          minHeight: 260,
          borderRadius: '20px',
          borderColor: active ? 'secondary.main' : undefined,
          borderWidth: active ? 2 : 1,
          borderStyle: dashed ? 'dashed' : 'solid',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.75,
        }}
      >
        {children}
      </Paper>
    </motion.div>
  );
}

/** Last card in the deck: add an exercise to today only. */
function AddExerciseCard({ data, full, onAdd }: { data: FitnessData; full: boolean; onAdd: (e: CustomExercise) => Promise<boolean> }) {
  const [exercise, setExercise] = useState('');
  const [sets, setSets] = useState(3);
  const [busy, setBusy] = useState(false);
  const options = useMemo(() => knownExercises(data), [data]);
  const add = async () => {
    if (!exercise.trim()) return;
    setBusy(true);
    if (await onAdd({ label: '', exercise: exercise.trim(), sets })) setExercise('');
    setBusy(false);
  };
  return (
    <Paper variant="outlined" sx={{ p: 1.75, borderRadius: '22px', borderStyle: 'dashed', height: '100%', display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box aria-hidden sx={{ width: 44, height: 44, borderRadius: '14px', display: 'grid', placeItems: 'center', fontSize: 24, bgcolor: (t) => t.tracker.tonal }}>
          ➕
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700 }}>Add an exercise</Typography>
          <Typography variant="caption" color="text.secondary">
            Today only, e.g. make up a muscle that’s behind.
          </Typography>
        </Box>
      </Box>
      <Autocomplete
        freeSolo
        options={options}
        inputValue={exercise}
        onInputChange={(_, v) => setExercise(v)}
        renderOption={(props, o) => (
          <li {...props} key={o}>
            <Box component="span" aria-hidden sx={{ mr: 1 }}>
              {exerciseEmoji(o)}
            </Box>
            {o}
          </li>
        )}
        renderInput={(p) => <TextField {...p} size="small" label="Exercise" />}
      />
      <NumberStepper label="Sets to add" unit="sets" value={sets} step={1} min={1} max={10} onChange={setSets} />
      <Box sx={{ flexGrow: 1 }} />
      <Button variant="contained" startIcon={<AddRoundedIcon />} disabled={busy || full || !exercise.trim()} onClick={() => void add()} sx={{ minHeight: 50 }}>
        {full ? 'Limit reached for today' : 'Add card'}
      </Button>
    </Paper>
  );
}

/** This week's direct sets per muscle vs the plan so far; flags what's falling behind. */
function MuscleCoverageCard({ data, day, muscleMap }: { data: FitnessData; day: string; muscleMap: Map<string, Muscle> }) {
  const start = weekStart(day);
  // Today only counts once it's done, so the warning doesn't fire before you start.
  const doneToday = data.sessions.some((s) => s.day === day && s.completed);
  const daysSoFar = [1, 2, 3, 4, 5, 6].filter((d) => (d < isoWeekday(day) || (d === isoWeekday(day) && doneToday)) && !isAway(addDays(start, d - 1), data.away));
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
  item,
  groups,
  day,
  data,
  daySets,
  muscleMap,
  dayVariant,
  ensureSession,
  afterSet,
  onVariant,
  onRemove,
}: {
  index: number;
  count: number;
  item: PlanItem;
  groups: SwapGroup[];
  day: string;
  data: FitnessData;
  daySets: WorkoutSetRow[];
  muscleMap: Map<string, Muscle>;
  dayVariant: number;
  ensureSession: () => Promise<SessionRow | null>;
  afterSet: (index: number, item: PlanItem, setsAfter: WorkoutSetRow[], session: SessionRow, itemDone: boolean) => Promise<void>;
  onVariant?: (variant: number) => Promise<void>;
  onRemove?: () => Promise<void>;
}) {
  const { addSet, removeSet } = useFitness();
  const toast = useSnackbar();
  const allOptions = groups.flatMap((g) => g.options);
  const logged = [...setsForItem(item, daySets)].sort((a, b) => a.set_number - b.set_number);
  const [exercise, setExercise] = useState(logged[0]?.exercise ?? item.options[0] ?? '');
  const [custom, setCustom] = useState(Boolean(logged[0] && !allOptions.some((o) => o.toLowerCase() === logged[0].exercise.toLowerCase())));
  const nextNumber = logged.length + 1;
  const suggestion = suggestSet(exercise, nextNumber, day, data.sets, data.sessions, data.presets);
  const [weight, setWeight] = useState(suggestion.weight);
  const [reps, setReps] = useState(suggestion.reps);
  const [busy, setBusy] = useState(false);
  const complete = logged.length >= item.sets;
  const checksMuscle = item.kind === 'program' || item.kind === 'custom';
  const warning = checksMuscle ? swapWarning(item.title, exercise, muscleMap) : null;
  const muscle = (exercise ? muscleOf(exercise, muscleMap) : null) ?? muscleOfCard(item.title, exercise, muscleMap);
  const slot = item.kind === 'program' ? data.slots.find((s) => s.weekday === isoWeekday(day) && s.slot === item.slot) : undefined;
  const slotVariants = slot ? slot.variants.map((v, i) => ({ i, first: exerciseOptions(v)[0] })).filter((v) => v.first) : [];

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
    const w = checksMuscle ? swapWarning(item.title, value, muscleMap) : null;
    if (w) toast(`⚠️ ${value} trains ${w.to ?? 'a different muscle'}, not ${w.from}: ${w.from} will be ${item.sets} sets short this week.`, { severity: 'warning' });
  };

  const log = async () => {
    if (!exercise.trim()) return toast('Choose or type the exercise first.', { severity: 'info' });
    setBusy(true);
    try {
      const session = await ensureSession();
      if (!session) return;
      const row = await addSet({ session_id: session.id, slot: item.slot, exercise: exercise.trim(), set_number: nextNumber, reps, weight_kg: weight });
      navigator.vibrate?.(30);
      await afterSet(index, item, [...daySets, row], session, logged.length + 1 === item.sets);
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
  const kindLabel = item.kind === 'finisher' ? 'Finisher' : item.kind === 'extra' ? 'Added today' : item.kind === 'custom' ? 'Your card' : null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: Math.min(index, 6) * 0.04 }}>
      <Paper
        variant="outlined"
        sx={{
          p: 1.75,
          borderRadius: '22px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
          borderColor: complete ? 'success.main' : undefined,
          transition: 'border-color 300ms ease',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <motion.div key={`${exercise}-${complete}`} initial={{ scale: 0.6, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
            <Box aria-hidden sx={{ width: 44, height: 44, borderRadius: '14px', display: 'grid', placeItems: 'center', fontSize: 24, bgcolor: (t) => t.tracker.tonal }}>
              {complete ? '✅' : exerciseEmoji(exercise || item.title)}
            </Box>
          </motion.div>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" noWrap component="p" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {index + 1}/{count} · {item.title}
            </Typography>
            <Typography variant="body2" color={complete ? 'success.main' : 'text.secondary'} sx={{ fontWeight: 700 }}>
              {logged.length}/{item.sets} sets{item.repsHint ? ` · ${item.repsHint}` : ''}
              {kindLabel ? ` · ${kindLabel}` : ''}
            </Typography>
          </Box>
          {muscle && <Chip size="small" variant="outlined" label={`${MUSCLE_EMOJI[muscle]} ${muscle}`} />}
          {onRemove && logged.length === 0 && (
            <IconButton size="small" aria-label={`Remove ${item.title}`} onClick={() => void onRemove()}>
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

        {onVariant && slotVariants.length > 1 && (
          <Box sx={{ display: 'flex', gap: 0.5, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }} role="group" aria-label={`${item.title} variant`}>
            {slotVariants.map((v) => (
              <Tooltip key={v.i} title={v.first}>
                <span>
                  <Chip
                    size="small"
                    label={`V${v.i + 1}`}
                    color={v.i === item.variantIndex ? 'secondary' : 'default'}
                    variant={v.i === item.variantIndex ? 'filled' : 'outlined'}
                    disabled={logged.length > 0 && v.i !== item.variantIndex}
                    onClick={v.i === item.variantIndex ? undefined : () => void onVariant(v.i)}
                    sx={{ fontWeight: v.i === dayVariant ? 800 : 500 }}
                  />
                </span>
              </Tooltip>
            ))}
          </Box>
        )}

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
          {groups.flatMap((g) => [
            <ListSubheader key={`h-${g.label}`}>{g.label}</ListSubheader>,
            ...g.options.map((o, i) => (
              <MenuItem key={`${g.label}-${o}`} value={o}>
                <Box component="span" aria-hidden sx={{ mr: 1 }}>
                  {exerciseEmoji(o)}
                </Box>
                {o}
                {g.label === 'Today' && i === 1 && (
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>
                    fallback
                  </Typography>
                )}
              </MenuItem>
            )),
          ])}
          {!allOptions.some((o) => o.toLowerCase() === exercise.toLowerCase()) && exercise && !custom && <MenuItem value={exercise}>{exercise}</MenuItem>}
          <MenuItem value={CUSTOM}>✏️ Type another exercise…</MenuItem>
        </TextField>
        {custom && logged.length === 0 && <TextField size="small" label="Exercise name" value={exercise} onChange={(e) => setExercise(e.target.value)} autoFocus />}
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
