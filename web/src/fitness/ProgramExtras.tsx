import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
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
import { NumberStepper } from './NumberStepper';
import { deriveKeyLifts, exerciseOptions, parseReference, type ParsedReference } from './referenceImport';
import { Card } from './ui';

const DAY = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
      toast(`Not imported: ${err instanceof Error ? err.message : 'error'}`, { severity: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const keyLifts = parsed ? deriveKeyLifts(parsed.slots) : [];
  return (
    <Card title="Load from your reference file">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Choose your <code>00_Daily_Reference_Bulk.md</code> to fill all six days, the five slots, the V1–V7 variants
        (default / fallback), set counts, finishers and targets. Re-import any time you edit the file.
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
              {[1, 2, 3, 4, 5, 6].map((d) => {
                const slots = parsed.slots.filter((s) => s.weekday === d);
                if (!slots.length) return null;
                return (
                  <Typography key={d} variant="body2">
                    <strong>{DAY[d]}</strong> · {parsed.dayFocus[String(d)] ?? ''} · {slots.map((s) => s.sets).join(' / ')} ={' '}
                    {slots.reduce((a, s) => a + s.sets, 0)} sets
                  </Typography>
                );
              })}
              {parsed.finishers.map((f) => (
                <Typography key={f.name} variant="body2">
                  <strong>{f.name}</strong> on {f.days.map((d) => DAY[d]).join(', ')}: {f.exercises.map((e) => e.name).join(', ')}
                </Typography>
              ))}
              <Typography variant="body2" color="text.secondary">
                {parsed.baselineDate && `Phase/baseline from ${dayjs(parsed.baselineDate).format('D MMM YYYY')}. `}
                {parsed.stepsTarget !== null && `Steps target ${parsed.stepsTarget.toLocaleString('en-IN')}. `}
                {keyLifts.length > 0 && `Key lifts: ${keyLifts.map((k) => k.label).join(', ')}.`}
              </Typography>
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
