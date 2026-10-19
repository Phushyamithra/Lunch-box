import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { Alert, Box, Button, IconButton, Stack, TextField, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useSnackbar } from '../layout/Snackbar';
import { useFitness } from './FitnessContext';
import type { FitnessSettings } from './fitnessApi';
import { trendsResumeOn, type AwayPeriod, type KeyLiftGroup } from './rules';
import { RemindersCard } from './RemindersUi';
import { Card } from './ui';

type NumKey = Exclude<keyof FitnessSettings, 'rotation_start' | 'phase_start' | 'key_lifts' | 'rotation_offset' | 'weigh_time' | 'day_focus' | 'finishers' | 'reminders'>;
const FIELDS: { key: NumKey; label: string; step?: string }[] = [
  { key: 'gain_target_kg_month', label: 'Target gain (kg/month)', step: '0.05' },
  { key: 'gain_high_kg_month', label: 'Review above (kg/month)', step: '0.05' },
  { key: 'gain_low_kg_month', label: 'Review below (kg/month)', step: '0.05' },
  { key: 'kcal_target', label: 'Calories (kcal/day)' },
  { key: 'protein_min_g', label: 'Protein min (g)' },
  { key: 'protein_max_g', label: 'Protein max (g)' },
  { key: 'fat_min_g', label: 'Fat min (g)' },
  { key: 'fat_max_g', label: 'Fat max (g)' },
  { key: 'carbs_target_g', label: 'Carbs (g)' },
  { key: 'waist_interval_days', label: 'Waist check every (days)' },
  { key: 'phase_months', label: 'Phase length (months)' },
  { key: 'steps_target', label: 'Steps per day' },
  { key: 'cardio_per_week', label: 'Cardio sessions / week' },
  { key: 'rest_compound_sec', label: 'Rest, compounds (sec)' },
  { key: 'rest_isolation_sec', label: 'Rest, isolation (sec)' },
];

/** Validates the targets form; returns an error or the numeric patch. */
export function validateTargets(form: Record<string, string>): string | Partial<FitnessSettings> {
  const out: Record<string, number> = {};
  for (const f of FIELDS) {
    const v = Number(form[f.key]);
    if (!form[f.key]?.trim() || !Number.isFinite(v) || v < 0) return `${f.label} must be a number of 0 or more.`;
    out[f.key] = v;
  }
  if (out.protein_min_g > out.protein_max_g) return 'Protein min must not exceed protein max.';
  if (out.fat_min_g > out.fat_max_g) return 'Fat min must not exceed fat max.';
  if (out.gain_low_kg_month > out.gain_high_kg_month) return 'The "review below" rate must be lower than "review above".';
  if (out.waist_interval_days < 1 || out.waist_interval_days > 90) return 'Waist interval must be 1–90 days.';
  if (out.phase_months < 1 || out.phase_months > 24) return 'Phase length must be 1–24 months.';
  if (out.rest_compound_sec < 15 || out.rest_compound_sec > 600 || out.rest_isolation_sec < 15 || out.rest_isolation_sec > 600) {
    return 'Rest times must be 15–600 seconds.';
  }
  return out as Partial<FitnessSettings>;
}

export default function FitnessSettingsPage() {
  const { data } = useFitness();
  if (!data) return null;
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, alignItems: 'start' }}>
      <Targets settings={data.settings} />
      <Stack spacing={2}>
        <RemindersCard />
        <AwayPeriods periods={data.away} />
        <KeyLifts groups={data.settings.key_lifts} />
      </Stack>
    </Box>
  );
}

function Targets({ settings }: { settings: FitnessSettings }) {
  const { saveSettings } = useFitness();
  const toast = useSnackbar();
  const initial = () => ({
    ...Object.fromEntries(FIELDS.map((f) => [f.key, String(settings[f.key])])),
    phase_start: settings.phase_start,
    rotation_start: settings.rotation_start,
    weigh_time: settings.weigh_time,
  });
  const [form, setForm] = useState<Record<string, string>>(initial);
  const [error, setError] = useState<string | null>(null);
  // Re-sync the form whenever saved settings change.
  useEffect(() => setForm(initial()), [settings]);

  const save = async () => {
    const result = validateTargets(form);
    if (typeof result === 'string') return setError(result);
    if (!dayjs(form.phase_start).isValid() || !dayjs(form.rotation_start).isValid()) return setError('Enter valid dates.');
    setError(null);
    try {
      await saveSettings({ ...result, phase_start: form.phase_start, rotation_start: form.rotation_start, weigh_time: form.weigh_time as FitnessSettings['weigh_time'] });
      toast('Targets saved. History is unchanged.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not saved.');
    }
  };

  return (
    <Card title="Targets">
      <Stack spacing={2}>
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: '1fr 1fr' }}>
          {FIELDS.map((f) => (
            <TextField
              key={f.key}
              size="small"
              label={f.label}
              inputMode="decimal"
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            />
          ))}
          <TextField size="small" type="date" label="Phase started" value={form.phase_start} onChange={(e) => setForm({ ...form, phase_start: e.target.value })} InputLabelProps={{ shrink: true }} />
          <TextField size="small" select label="Trend uses weigh-ins from" value={form.weigh_time} onChange={(e) => setForm({ ...form, weigh_time: e.target.value })} SelectProps={{ native: true }} sx={{ gridColumn: '1 / -1' }}>
            <option value="morning">Mornings only (recommended)</option>
            <option value="evening">Evenings only</option>
            <option value="any">Any time of day</option>
          </TextField>
          <TextField size="small" type="date" label="V1 week starts" value={form.rotation_start} onChange={(e) => setForm({ ...form, rotation_start: e.target.value })} InputLabelProps={{ shrink: true }} />
        </Box>
        <Typography variant="caption" color="text.secondary">
          Protein is a range to land in, not a number to keep pushing up. Changing targets never edits past entries.
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <Button variant="contained" onClick={() => void save()} sx={{ alignSelf: 'flex-start' }}>
          Save targets
        </Button>
      </Stack>
    </Card>
  );
}

function AwayPeriods({ periods }: { periods: AwayPeriod[] }) {
  const { saveAway, removeAway } = useFitness();
  const toast = useSnackbar();
  const today = dayjs().format('YYYY-MM-DD');
  const blank = { starts_on: today, ends_on: today, label: '' };
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!form.starts_on || !form.ends_on || form.ends_on < form.starts_on) return setError('The end date must be on or after the start date.');
    setError(null);
    try {
      await saveAway({ starts_on: form.starts_on, ends_on: form.ends_on, label: form.label.trim() || null }, editing ?? undefined);
      toast(editing ? 'Away period updated' : 'Away period added');
      setForm(blank);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not saved.');
    }
  };

  return (
    <Card title="Away mode">
      <Stack spacing={1.5}>
        <Typography variant="body2" color="text.secondary">
          During an away period, weigh-ins and waist entries are kept but flagged and left out of trends; training days are not
          counted against you; diet can be tagged as event/travel.
        </Typography>
        {periods.map((p) => (
          <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography sx={{ fontWeight: 600 }}>
                {dayjs(p.starts_on).format('D MMM')} – {dayjs(p.ends_on).format('D MMM YYYY')}
                {p.label ? ` · ${p.label}` : ''}
              </Typography>
              {p.ends_on < today && (
                <Typography variant="caption" color="text.secondary">
                  Trends use full weeks again from {dayjs(trendsResumeOn(p)).format('D MMM')}.
                </Typography>
              )}
            </Box>
            <IconButton aria-label="Edit away period" onClick={() => { setEditing(p.id); setForm({ starts_on: p.starts_on, ends_on: p.ends_on, label: p.label ?? '' }); }}>
              <EditRoundedIcon fontSize="small" />
            </IconButton>
            <IconButton
              aria-label="Delete away period"
              onClick={() => {
                if (window.confirm('Delete this away period? Measurements are kept; they will simply count in trends again.')) {
                  void removeAway(p.id).catch((e: unknown) => toast(e instanceof Error ? e.message : 'Not deleted.', { severity: 'error' }));
                }
              }}
            >
              <DeleteOutlineRoundedIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: '1fr 1fr' }}>
          <TextField size="small" type="date" label="From" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} InputLabelProps={{ shrink: true }} />
          <TextField size="small" type="date" label="To" value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} InputLabelProps={{ shrink: true }} />
          <TextField size="small" label="Label (optional)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} sx={{ gridColumn: '1 / -1' }} />
        </Box>
        {error && <Alert severity="error">{error}</Alert>}
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => void save()}>
            {editing ? 'Save changes' : 'Add away period'}
          </Button>
          {editing && <Button onClick={() => { setEditing(null); setForm(blank); }}>Cancel</Button>}
        </Stack>
      </Stack>
    </Card>
  );
}

function KeyLifts({ groups }: { groups: KeyLiftGroup[] }) {
  const { saveSettings } = useFitness();
  const toast = useSnackbar();
  const [rows, setRows] = useState(() => groups.map((g) => ({ label: g.label, exercises: g.exercises.join(', ') })));
  useEffect(() => setRows(groups.map((g) => ({ label: g.label, exercises: g.exercises.join(', ') }))), [groups]);

  const save = async () => {
    const next: KeyLiftGroup[] = rows
      .map((r) => ({ label: r.label.trim(), exercises: r.exercises.split(',').map((e) => e.trim()).filter(Boolean) }))
      .filter((g) => g.label && g.exercises.length > 0);
    try {
      await saveSettings({ key_lifts: next });
      toast('Key lifts saved');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Not saved.', { severity: 'error' });
    }
  };

  return (
    <Card title="Key lifts">
      <Stack spacing={1.5}>
        <Typography variant="body2" color="text.secondary">
          Exercise names must match what you log. Each exercise gets its own trend line.
        </Typography>
        {rows.map((r, i) => (
          <Box key={i} sx={{ display: 'grid', gap: 1, gridTemplateColumns: '1fr 2fr auto', alignItems: 'center' }}>
            <TextField size="small" label="Group" value={r.label} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <TextField size="small" label="Exercises (comma-separated)" value={r.exercises} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, exercises: e.target.value } : x)))} />
            <IconButton aria-label={`Remove ${r.label || 'group'}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
              <DeleteOutlineRoundedIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
        <Stack direction="row" spacing={1}>
          <Button startIcon={<AddRoundedIcon />} onClick={() => setRows([...rows, { label: '', exercises: '' }])}>
            Add group
          </Button>
          <Button variant="contained" onClick={() => void save()}>
            Save key lifts
          </Button>
        </Stack>
      </Stack>
    </Card>
  );
}
