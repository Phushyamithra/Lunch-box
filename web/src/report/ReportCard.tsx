import { Button, Checkbox, FormControlLabel, FormGroup, MenuItem, Stack, TextField, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useFitness } from '../fitness/FitnessContext';
import { Card } from '../fitness/ui';
import { useSnackbar } from '../layout/Snackbar';
import { useNutrition } from '../nutrition/NutritionContext';
import { buildMarkdownReport, reportFileName, type ReportSections } from './markdownReport';

const KEY = 'YYYY-MM-DD';
type Period = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'last_3_months' | 'phase' | 'custom';
const PERIODS: { key: Period; label: string }[] = [
  { key: 'this_week', label: 'This week' },
  { key: 'last_week', label: 'Last week' },
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'last_3_months', label: 'Last 3 months' },
  { key: 'phase', label: 'Whole phase so far' },
  { key: 'custom', label: 'Custom dates' },
];

function rangeFor(p: Period, today: string, phaseStart: string, custom: { from: string; to: string }): { from: string; to: string } {
  const t = dayjs(today);
  const monday = t.subtract((t.day() + 6) % 7, 'day');
  switch (p) {
    case 'this_week':
      return { from: monday.format(KEY), to: today };
    case 'last_week':
      return { from: monday.subtract(7, 'day').format(KEY), to: monday.subtract(1, 'day').format(KEY) };
    case 'this_month':
      return { from: t.startOf('month').format(KEY), to: today };
    case 'last_month':
      return { from: t.subtract(1, 'month').startOf('month').format(KEY), to: t.subtract(1, 'month').endOf('month').format(KEY) };
    case 'last_3_months':
      return { from: t.subtract(3, 'month').add(1, 'day').format(KEY), to: today };
    case 'phase':
      return { from: phaseStart <= today ? phaseStart : today, to: today };
    default:
      return custom;
  }
}

/** Markdown report in the daily-reference layout, to read or hand to an assistant for analysis. */
export function ReportCard() {
  const { data: fitness } = useFitness();
  const { data: nutrition } = useNutrition();
  const toast = useSnackbar();
  const today = dayjs().format(KEY);
  const [period, setPeriod] = useState<Period>('last_week');
  const [custom, setCustom] = useState({ from: dayjs().subtract(13, 'day').format(KEY), to: today });
  const [sections, setSections] = useState<ReportSections>({ food: true, measurements: true, workouts: true });
  if (!fitness) return null;

  const range = rangeFor(period, today, fitness.settings.phase_start, custom);
  const invalid = !range.from || !range.to || range.from > range.to || dayjs(range.to).diff(range.from, 'day') > 400;
  const make = () => buildMarkdownReport({ fitness, nutrition, ...range, today, sections, now: new Date() });
  const name = reportFileName(range.from, range.to);

  const download = () => {
    const url = URL.createObjectURL(new Blob([make()], { type: 'text/markdown;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(make());
      toast('📋 Report copied: paste it into your notes or an assistant');
    } catch {
      toast('Couldn’t copy here; use Download instead.', { severity: 'error' });
    }
  };
  const file = () => new File([make()], name, { type: 'text/markdown' });
  const canShare = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'x.md', { type: 'text/markdown' })] });
  const share = async () => {
    try {
      await navigator.share({ files: [file()], title: 'Tracker report' });
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') toast('Couldn’t open the share sheet; use Download instead.', { severity: 'error' });
    }
  };

  return (
    <Card title="📝 Report for analysis (.md)">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Laid out like your daily reference: snapshot, eating, training and measurements, then the weekly and monthly log templates filled in from what you recorded.
        Blanks stay blank. Finance is never included.
      </Typography>
      <Stack spacing={1.5}>
        <TextField select size="small" label="Period" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
          {PERIODS.map((p) => (
            <MenuItem key={p.key} value={p.key}>
              {p.label}
            </MenuItem>
          ))}
        </TextField>
        {period === 'custom' && (
          <Stack direction="row" spacing={1}>
            <TextField size="small" type="date" label="From" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField size="small" type="date" label="To" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
          </Stack>
        )}
        <Typography variant="caption" color={invalid ? 'error' : 'text.secondary'}>
          {invalid ? 'Pick a start on or before the end, at most about 13 months.' : `${dayjs(range.from).format('D MMM YYYY')} – ${dayjs(range.to).format('D MMM YYYY')}`}
        </Typography>
        <FormGroup row>
          {(
            [
              ['food', 'Food'],
              ['measurements', 'Measurements'],
              ['workouts', 'Workouts'],
            ] as const
          ).map(([k, label]) => (
            <FormControlLabel key={k} control={<Checkbox size="small" checked={sections[k]} onChange={(e) => setSections((s) => ({ ...s, [k]: e.target.checked }))} />} label={label} />
          ))}
        </FormGroup>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
          <Button variant="contained" disabled={invalid} onClick={download}>
            Download
          </Button>
          <Button variant="outlined" disabled={invalid} onClick={() => void copy()}>
            Copy
          </Button>
          {canShare && (
            <Button variant="outlined" disabled={invalid} onClick={() => void share()}>
              Share
            </Button>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}
