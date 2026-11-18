import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
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
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import { useMemo, useState, type ChangeEvent } from 'react';
import { useSnackbar } from '../layout/Snackbar';
import { useFitness } from './FitnessContext';
import type { FitnessData } from './fitnessApi';
import { classicWeekly, rotatingCycle } from './classicSplit';
import { NumberStepper } from './NumberStepper';
import { deriveKeyLifts, exerciseOptions, parseReference, type ParsedReference } from './referenceImport';
import { Card } from './ui';

const DAY = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The two splits kept in the app, each loadable in one tap. */
const BUILT_IN = [
  { key: 'classic', title: 'Classic weekly (Mon–Sat)', parse: classicWeekly, days: [1, 2, 3, 4, 5, 6], name: (d: number) => DAY[d] },
  { key: 'cycle', title: 'Rotating 5-day', parse: rotatingCycle, days: [11, 12, 13, 14, 15], name: (d: number) => `Day ${d - 10}` },
] as const;

/**
 * Both splits, built in: the classic Mon–Sat split (7 variants a slot) and
 * the current rotating cycle (6 variants a slot), each with its finishers.
 * Loading one fills only its own days: the other split, targets, logged
 * sessions and the split Today follows are left alone.
 */
export function BuiltInSplitsCard({ data }: { data: FitnessData }) {
  const { importProgram } = useFitness();
  const toast = useSnackbar();
  const [open, setOpen] = useState<(typeof BUILT_IN)[number] | null>(null);
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => Object.fromEntries(BUILT_IN.map((b) => [b.key, b.parse()])) as Record<(typeof BUILT_IN)[number]['key'], ParsedReference>, []);
  const isLoaded = (days: readonly number[]) => days.every((d) => data.slots.some((s) => s.weekday === d && s.variants.some(Boolean)));

  const load = async () => {
    if (!open) return;
    setBusy(true);
    try {
      await importProgram(parsed[open.key], false);
      toast(`${open.title} loaded. Pick it under Your split to train it.`);
      setOpen(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'error';
      toast(/program_mode|cycle_start|_check|check constraint/i.test(msg) ? 'Run migration 0018 in Supabase first, then load again.' : `Not loaded: ${msg}`, { severity: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Built-in splits">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Both splits live in the app with every variant. Load either (or both) any time: each fills only its own days.
      </Typography>
      <Stack spacing={2.5}>
        {BUILT_IN.map((b) => {
          const p = parsed[b.key];
          const variants = Math.max(...p.slots.map((s) => s.variants.filter(Boolean).length));
          const loaded = isLoaded(b.days);
          return (
            <Box key={b.key}>
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>
                {b.title} · {variants} variants
              </Typography>
              <Stack spacing={0.25} sx={{ mb: 1.25 }}>
                {b.days.map((d) => (
                  <Typography key={d} variant="body2">
                    <strong>{b.name(d)}</strong> · {p.dayFocus[String(d)] ?? ''}
                  </Typography>
                ))}
              </Stack>
              <Button variant={loaded ? 'outlined' : 'contained'} startIcon={<HistoryRoundedIcon />} onClick={() => setOpen(b)}>
                {loaded ? 'Reload' : 'Load'} {b.key === 'classic' ? 'classic split' : 'rotating split'}
              </Button>
            </Box>
          );
        })}
      </Stack>
      <Dialog open={Boolean(open)} onClose={() => !busy && setOpen(null)} maxWidth="sm" fullWidth aria-labelledby="builtin-title">
        <DialogTitle id="builtin-title">Load {open?.title}?</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <Typography variant="body2">
              {open?.key === 'classic'
                ? 'Fills Mon–Sat with its slots, set counts and all 7 variants, and adds the Abs (Mon, Wed, Fri) and Forearms (Tue, Thu, Sat) finishers.'
                : 'Fills Upper, Lower, Push, Pull and Legs with their slots, set counts and all 6 variants, and adds the Abs (Upper, Push, Legs) and Forearms (Lower) finishers.'}
            </Typography>
            <Alert severity="info">The other split, your targets and logged sessions stay as they are. Today keeps following the split you picked under Your split.</Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(null)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void load()} disabled={busy}>
            {busy ? 'Loading…' : 'Load split'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

/** One-tap import of the Daily Reference file, with a preview first. */
export function ImportReferenceCard({ data }: { data: FitnessData }) {
  const { importProgram } = useFitness();
  const toast = useSnackbar();
  const [parsed, setParsed] = useState<ParsedReference | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const hasProgram = data.slots.some((s) => s.variants.some(Boolean));

  const choose = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast('That file is too large for a reference file.', { severity: 'error' });
    const result = parseReference(await file.text());
    if (result.slots.length === 0) return toast('No training days found in that file.', { severity: 'error' });
    setFileName(file.name);
    setParsed(result);
  };

  const confirm = async () => {
    if (!parsed) return;
    setBusy(true);
    try {
      await importProgram(parsed);
      toast('Program loaded from your reference file');
      setParsed(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'error';
      toast(/program_mode|cycle_start|_check|check constraint/i.test(msg) ? 'Run migration 0018 in Supabase first (it lets both splits live side by side), then import again.' : `Not imported: ${msg}`, { severity: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const keyLifts = parsed ? deriveKeyLifts(parsed.slots) : [];
  return (
    <Card title="Load from your reference file">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Choose your <code>00_Daily_Reference_Bulk.md</code> to fill the training days, their slots and variants (default / fallback), set
        counts, finishers and targets. Mon–Sat files load the weekly split, “DAY 1 — UPPER” files the rotating cycle; both are kept and you switch between them
        below. Importing a split makes it the active one. Re-import any time you edit the file.
      </Typography>
      <Button variant={hasProgram ? 'outlined' : 'contained'} component="label" startIcon={<UploadFileRoundedIcon />}>
        {hasProgram ? 'Re-import file' : 'Import reference file'}
        <input hidden type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={(e) => void choose(e)} />
      </Button>

      <Dialog open={Boolean(parsed)} onClose={() => setParsed(null)} maxWidth="sm" fullWidth aria-labelledby="import-title">
        <DialogTitle id="import-title">Import {fileName}?</DialogTitle>
        <DialogContent>
          {parsed && (
            <Stack spacing={1.5}>
              {(parsed.cycle ? [11, 12, 13, 14, 15] : [1, 2, 3, 4, 5, 6]).map((d) => {
                const slots = parsed.slots.filter((s) => s.weekday === d);
                if (!slots.length) return null;
                return (
                  <Typography key={d} variant="body2">
                    <strong>{parsed.cycle ? `Day ${d - 10}` : DAY[d]}</strong> · {parsed.dayFocus[String(d)] ?? ''} · {slots.map((s) => s.sets).join(' / ')} ={' '}
                    {slots.reduce((a, s) => a + s.sets, 0)} sets
                  </Typography>
                );
              })}
              {parsed.finishers.map((f) => (
                <Typography key={f.name} variant="body2">
                  <strong>{f.name}</strong> after {f.days.map((d) => (parsed.cycle ? (parsed.dayFocus[String(d)] ?? `Day ${d}`).split(/\s+[—–-]\s+/)[0] : DAY[d])).join(', ')}: {f.exercises.map((e) => e.name).join(', ')}
                </Typography>
              ))}
              <Typography variant="body2" color="text.secondary">
                {parsed.baselineDate && `Phase/baseline from ${dayjs(parsed.baselineDate).format('D MMM YYYY')}. `}
                {parsed.stepsTarget !== null && `Steps target ${parsed.stepsTarget.toLocaleString('en-IN')}. `}
                {keyLifts.length > 0 && `Key lifts: ${keyLifts.map((k) => k.label).join(', ')}.`}
              </Typography>
              {parsed.cycle && (
                <Alert severity="info">Rotating cycle: days run in order from Day 1, whatever the weekday, starting on V1. Your weekly split stays as it is. Needs migration 0018.</Alert>
              )}
              {parsed.warnings.map((w) => (
                <Alert key={w} severity="warning">
                  {w}
                </Alert>
              ))}
              <Alert severity="info">Program slots are replaced. Logged sessions, sets and weights are never changed.</Alert>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setParsed(null)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void confirm()} disabled={busy}>
            {busy ? 'Importing…' : 'Import program'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

/** Finishers for the selected day (from the reference file). */
export function FinishersCard({ data, weekday }: { data: FitnessData; weekday: number }) {
  const today = data.settings.finishers.filter((f) => f.days.includes(weekday));
  if (!today.length) return null;
  return (
    <Card title="Finisher">
      {today.map((f) => (
        <Box key={f.name}>
          <Typography sx={{ fontWeight: 600 }}>{f.name}</Typography>
          {f.exercises.map((e) => (
            <Typography key={e.name} variant="body2" color="text.secondary">
              {e.name} · {e.sets} × {e.reps}
            </Typography>
          ))}
        </Box>
      ))}
      <Typography variant="caption" color="text.secondary">
        Logged under the day’s session on Today. Edit finishers in the reference file and re-import.
      </Typography>
    </Card>
  );
}

/** Starting weight × reps per exercise; kept up to date by every logged set. */
export function PresetsCard({ data }: { data: FitnessData }) {
  const { savePreset, removePreset } = useFitness();
  const toast = useSnackbar();
  const [name, setName] = useState('');
  const [weight, setWeight] = useState(20);
  const [reps, setReps] = useState(8);
  const allExercises = useMemo(
    () => [...new Set(data.slots.flatMap((s) => s.variants.flatMap(exerciseOptions)))].sort(),
    [data.slots],
  );
  const presets = [...data.presets].sort((a, b) => a.exercise.localeCompare(b.exercise));
  const missing = allExercises.filter((e) => !presets.some((p) => p.exercise.toLowerCase() === e.toLowerCase()));

  const add = async () => {
    if (!name.trim()) return;
    try {
      await savePreset(name, weight, reps);
      setName('');
    } catch (e) {
      toast(`Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    }
  };

  return (
    <Card title="Starting weights" aside={<Typography variant="caption" color="text.secondary">{presets.length} saved</Typography>}>
      <Stack spacing={1.25}>
        <Typography variant="body2" color="text.secondary">
          Every set row is pre-filled from the last time you did that exercise. For exercises you haven’t logged yet, set a
          starting weight here, e.g. Machine Chest Press · 45 kg × 8. Logging a set updates these automatically.
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <Autocomplete
            freeSolo
            options={missing}
            value={name}
            onInputChange={(_, v) => setName(v)}
            sx={{ flex: '1 1 220px' }}
            renderInput={(params) => <TextField {...params} size="small" label="Exercise" />}
          />
          <NumberStepper label="starting weight" unit="kg" value={weight} step={2.5} max={500} decimals={1} onChange={setWeight} />
          <NumberStepper label="starting reps" unit="reps" value={reps} step={1} max={100} onChange={setReps} />
          <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => void add()} disabled={!name.trim()}>
            Save
          </Button>
        </Box>
        {presets.map((p) => (
          <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Typography sx={{ flex: '1 1 160px', fontWeight: 600 }}>{p.exercise}</Typography>
            <NumberStepper label={`${p.exercise} weight`} unit="kg" value={Number(p.weight_kg)} step={2.5} max={500} decimals={1} onChange={(v) => void savePreset(p.exercise, v, p.reps)} />
            <NumberStepper label={`${p.exercise} reps`} unit="reps" value={p.reps} step={1} max={100} onChange={(v) => void savePreset(p.exercise, Number(p.weight_kg), v)} />
            <IconButton aria-label={`Delete preset for ${p.exercise}`} onClick={() => void removePreset(p.id)}>
              <DeleteOutlineRoundedIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
        {missing.length > 0 && (
          <Typography variant="caption" color="text.secondary">
            {missing.length} exercise{missing.length === 1 ? '' : 's'} in your program {missing.length === 1 ? 'has' : 'have'} no starting weight yet;
            their first set starts empty.
          </Typography>
        )}
      </Stack>
    </Card>
  );
}
