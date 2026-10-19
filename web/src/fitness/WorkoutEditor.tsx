import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useSnackbar } from '../layout/Snackbar';
import { MAX_CUSTOM_EXERCISES, validateCustomWorkout, workoutFromVariant, type CustomExercise, type CustomWorkout } from './dayPlan';
import { useFitness } from './FitnessContext';
import type { FitnessData } from './fitnessApi';
import { exerciseEmoji } from './muscles';
import { NumberStepper } from './NumberStepper';

const WEEKDAY = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const blank = (): CustomExercise => ({ label: '', exercise: '', sets: 3 });

/** Every exercise name you have used or planned, for quick picking. */
export function knownExercises(data: FitnessData): string[] {
  const names = new Map<string, string>();
  const add = (n: string) => n.trim() && !names.has(n.trim().toLowerCase()) && names.set(n.trim().toLowerCase(), n.trim());
  for (const s of data.slots) for (const v of s.variants) v.split('/').forEach(add);
  for (const f of data.settings.finishers) for (const e of f.exercises) e.name.split('/').forEach(add);
  for (const p of data.presets) add(p.exercise);
  for (const w of data.workouts) for (const e of w.exercises) e.exercise.split('/').forEach(add);
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * Create or edit your own workout card: a name, the day it shows on, and
 * exercises with sets. Start from a variant to change only what differs.
 */
export function WorkoutEditor({
  open,
  workout,
  weekday,
  data,
  onClose,
}: {
  open: boolean;
  workout: CustomWorkout | null;
  weekday: number;
  data: FitnessData;
  onClose: (saved?: CustomWorkout) => void;
}) {
  const { saveWorkout, removeWorkout } = useFitness();
  const toast = useSnackbar();
  const phone = useMediaQuery(useTheme().breakpoints.down('sm'));
  const [name, setName] = useState('');
  const [day, setDay] = useState<number | 'any'>(weekday);
  const [rows, setRows] = useState<CustomExercise[]>([blank()]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const options = knownExercises(data);
  const variants = Array.from({ length: 7 }, (_, i) => i).filter((i) => workoutFromVariant(weekday, i, data.slots).length > 0);

  useEffect(() => {
    if (!open) return;
    setName(workout?.name ?? '');
    setDay(workout ? (workout.weekday ?? 'any') : weekday);
    setRows(workout?.exercises.length ? workout.exercises : [blank()]);
    setError(null);
  }, [open, workout, weekday]);

  const set = (i: number, patch: Partial<CustomExercise>) => setRows((r) => r.map((row, n) => (n === i ? { ...row, ...patch } : row)));

  const save = async () => {
    const input = { name: name.trim(), weekday: day === 'any' ? null : day, exercises: rows.filter((r) => r.exercise.trim()).map((r) => ({ ...r, exercise: r.exercise.trim(), label: r.label.trim() })) };
    const problem = validateCustomWorkout(input);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      const saved = await saveWorkout(input, workout?.id);
      toast(workout ? 'Card updated' : `“${saved.name}” card created`);
      onClose(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!workout || !window.confirm(`Delete the “${workout.name}” card? Sets you logged with it stay in your history.`)) return;
    setBusy(true);
    try {
      await removeWorkout(workout.id);
      toast('Card deleted');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => onClose()} fullScreen={phone} fullWidth maxWidth="sm" aria-labelledby="workout-editor-title">
      <DialogTitle id="workout-editor-title">{workout ? 'Edit card' : 'New workout card'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hotel gym, Busy-gym chest" autoFocus={!workout} inputProps={{ maxLength: 60 }} />
          <TextField select label="Show on" value={day} onChange={(e) => setDay(e.target.value === 'any' ? 'any' : Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <MenuItem key={d} value={d}>
                {WEEKDAY[d]}s
              </MenuItem>
            ))}
            <MenuItem value="any">Any day</MenuItem>
          </TextField>
          {variants.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
              <Box component="span" sx={{ typography: 'body2', color: 'text.secondary', mr: 0.5 }}>
                Start from:
              </Box>
              {variants.map((v) => (
                <Button
                  key={v}
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    if (rows.some((r) => r.exercise.trim()) && !window.confirm(`Replace the exercises with V${v + 1}?`)) return;
                    setRows(workoutFromVariant(weekday, v, data.slots));
                  }}
                >
                  V{v + 1}
                </Button>
              ))}
            </Box>
          )}
          <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: 1.5 }}>
            <AnimatePresence initial={false}>
              {rows.map((r, i) => (
                <motion.li key={i} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
                  <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: '1fr auto', alignItems: 'start', p: 1.25, borderRadius: '16px', border: 1, borderColor: 'divider' }}>
                    <Autocomplete
                      freeSolo
                      options={options}
                      value={r.exercise}
                      onInputChange={(_, v) => set(i, { exercise: v })}
                      renderOption={(props, o) => (
                        <li {...props} key={o}>
                          <Box component="span" aria-hidden sx={{ mr: 1 }}>
                            {exerciseEmoji(o)}
                          </Box>
                          {o}
                        </li>
                      )}
                      renderInput={(p) => <TextField {...p} size="small" label={`Exercise ${i + 1}`} helperText="Add a fallback with “ / ”, e.g. Push-up / Dips" />}
                    />
                    <IconButton aria-label={`Remove exercise ${i + 1}`} onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, n) => n !== i) : [blank()]))}>
                      <DeleteOutlineRoundedIcon />
                    </IconButton>
                    <Box sx={{ gridColumn: '1 / -1', display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: '1fr auto' }, alignItems: 'center' }}>
                      <TextField size="small" label="Targets (optional)" placeholder="e.g. Upper Chest" value={r.label} onChange={(e) => set(i, { label: e.target.value })} />
                      <NumberStepper label={`Exercise ${i + 1} sets`} unit="sets" value={r.sets} step={1} min={1} max={10} onChange={(v) => set(i, { sets: v })} />
                    </Box>
                  </Box>
                </motion.li>
              ))}
            </AnimatePresence>
          </Box>
          <Button startIcon={<AddRoundedIcon />} onClick={() => setRows((r) => [...r, blank()])} disabled={rows.length >= MAX_CUSTOM_EXERCISES} sx={{ alignSelf: 'flex-start' }}>
            Add exercise
          </Button>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {workout && (
          <Button color="error" onClick={() => void remove()} disabled={busy} sx={{ mr: 'auto' }}>
            Delete
          </Button>
        )}
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button variant="contained" onClick={() => void save()} disabled={busy}>
          Save card
        </Button>
      </DialogActions>
    </Dialog>
  );
}
