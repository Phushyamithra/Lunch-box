import { Alert, Box, Button, Chip, Stack, Tab, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { Stepper } from '../food/Stepper';
import { useSnackbar } from '../layout/Snackbar';
import { useFitness } from './FitnessContext';
import type { SlotRow } from './fitnessApi';
import { CYCLE_DAYS, WEEK_DAYS, finisherCards, nextCycleDay, suggestVariant } from './dayPlan';
import { addDays, isoWeekday, variantIndexFor, weekStart } from './rules';
import { FinishersCard, ImportReferenceCard, PresetsCard } from './ProgramExtras';
import { Card } from './ui';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EMPTY = ['', '', '', '', '', '', ''];

/** Two splits side by side: Mon–Sat with weekly variants, and the rotating Upper → Lower → Push → Pull → Legs cycle. Pick which one is active. */
export default function ProgramPage() {
  const { data, saveSettings, saveWorkout } = useFitness();
  const toast = useSnackbar();
  const today = dayjs().format('YYYY-MM-DD');
  const cycle = data?.settings.program_mode === 'cycle';
  const since = data ? (data.settings.cycle_start ?? data.settings.rotation_start) : today;
  const next = data ? nextCycleDay(data.sessions, addDays(today, 1), since) : CYCLE_DAYS[0];
  const [day, setDay] = useState<number | null>(null);
  if (!data) return null;
  const days = cycle ? CYCLE_DAYS : WEEK_DAYS;
  const weekday = day !== null && days.includes(day) ? day : cycle ? next : Math.min(isoWeekday(today), 6);
  const current = cycle
    ? suggestVariant(addDays(today, 1), data.sessions, data.slots, (((data.settings.rotation_offset % 6) + 6) % 6), weekday, since).index
    : variantIndexFor(today, data.settings.rotation_start, data.settings.rotation_offset);
  const dayName = (d: number) => (data.settings.day_focus[String(d)] ?? `Day ${d - 10}`).split(/\s+[—–-]\s+/)[0];
  const hasSplit = (ds: number[]) => data.slots.some((s) => ds.includes(s.weekday) && s.variants.some(Boolean));
  const cards = finisherCards(data.settings.finishers, data.workouts);

  const shift = async (by: number) => {
    try {
      await saveSettings({ rotation_offset: data.settings.rotation_offset + by });
      toast(`This week is now V${((current + by + 7) % 7) + 1}`);
    } catch (e) {
      toast(`Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    }
  };
  const switchTo = async (mode: 'weekday' | 'cycle') => {
    if (mode === data.settings.program_mode) return;
    try {
      await saveSettings(mode === 'cycle' && !data.settings.cycle_start ? { program_mode: mode, cycle_start: today } : { program_mode: mode });
      setDay(null);
      toast(mode === 'cycle' ? `🔁 Rotating cycle on: next is ${dayName(next)}` : '📅 Weekly split on');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'error';
      toast(/program_mode|cycle_start/.test(msg) ? 'Run migration 0018 in Supabase first, then switch.' : `Not saved: ${msg}`, { severity: 'error' });
    }
  };
  const makeCards = async () => {
    try {
      for (const c of cards) await saveWorkout(c);
      toast(`⭐ ${cards.map((c) => c.name).join(' and ')} card${cards.length === 1 ? '' : 's'} added: pick them on any day`);
    } catch (e) {
      toast(`Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    }
  };

  return (
    <Stack spacing={3} sx={{ maxWidth: 820 }}>
      <Card title="Your split">
        <ToggleButtonGroup exclusive fullWidth value={data.settings.program_mode} onChange={(_, v) => v && void switchTo(v)} aria-label="Active split">
          <ToggleButton value="weekday" sx={{ minHeight: 48 }}>
            📅 Weekly (Mon–Sat)
          </ToggleButton>
          <ToggleButton value="cycle" sx={{ minHeight: 48 }}>
            🔁 Rotating 5-day
          </ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Both splits are kept; Today follows the one picked here. Switch any time: history stays as it was.
          {!hasSplit(days) && ' This split is empty: load its reference file below.'}
        </Typography>
      </Card>
      <ImportReferenceCard data={data} />
      {cards.length > 0 && (
        <Card title="⭐ Quick cards">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Turn your finishers into cards ({cards.map((c) => c.name).join(', ')}) you can pick on any day, as a short session of their own.
          </Typography>
          <Button variant="contained" onClick={() => void makeCards()}>
            Add {cards.map((c) => c.name).join(' and ')} card{cards.length === 1 ? '' : 's'}
          </Button>
        </Card>
      )}
      {cycle ? (
        <Card title="🔁 Rotating cycle" aside={<Chip color="secondary" label={`Next: ${dayName(next)}`} />}>
          <Typography color="text.secondary" variant="body2">
            {CYCLE_DAYS.map(dayName).join(' → ')}, then repeat. Train whenever you can: the next day in the sequence comes up, whatever the calendar says, and rest
            days don’t skip or reset it. Each day moves to its next variant once you’ve trained it, so the first full pass is V1, the next V2, and so on. Started{' '}
            {dayjs(since).format('D MMM YYYY')}; you can always pick a different day or variant on the day.
          </Typography>
        </Card>
      ) : (
      <Card title="Weekly rotation" aside={<Chip color="secondary" label={`This week: V${current + 1}`} />}>
        <Typography color="text.secondary" variant="body2" sx={{ mb: 1.5 }}>
          The whole program moves to the next variant every Monday: V1 → V7, then back to V1. Started the week of{' '}
          {dayjs(weekStart(data.settings.rotation_start)).format('D MMM YYYY')}. Past sessions keep the variant and exercises
          actually done.
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => void shift(-1)}>
            Back one variant
          </Button>
          <Button variant="contained" onClick={() => void shift(1)}>
            Advance to V{((current + 1) % 7) + 1}
          </Button>
        </Stack>
      </Card>
      )}

      <Tabs value={days.indexOf(weekday)} onChange={(_, v: number) => setDay(days[v])} variant={cycle ? 'scrollable' : 'fullWidth'} allowScrollButtonsMobile aria-label="Training day">
        {(cycle ? CYCLE_DAYS.map(dayName) : DAYS).map((d, i) => (
          <Tab key={d} label={d} value={i} sx={{ minWidth: 0, textTransform: 'none', fontWeight: 600 }} />
        ))}
      </Tabs>
      {data.settings.day_focus[String(weekday)] && (
        <Typography variant="h6" component="h2">
          {data.settings.day_focus[String(weekday)]}
        </Typography>
      )}
      {(cycle ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]).map((slot) => (
        <SlotEditor key={`${weekday}-${slot}`} weekday={weekday} slot={slot} row={data.slots.find((s) => s.weekday === weekday && s.slot === slot)} current={current} />
      ))}
      <FinishersCard data={data} weekday={weekday} />
      <Alert severity="info">{cycle ? 'Rest whenever you need to: the sequence carries on from the last day you trained.' : 'Sunday is the rest day.'}</Alert>
      <PresetsCard data={data} />
    </Stack>
  );
}

function SlotEditor({ weekday, slot, row, current }: { weekday: number; slot: number; row: SlotRow | undefined; current: number }) {
  const { saveSlot } = useFitness();
  const toast = useSnackbar();
  const [label, setLabel] = useState(row?.label ?? '');
  const [sets, setSets] = useState(row?.default_sets ?? 3);
  const [variants, setVariants] = useState<string[]>(row?.variants ?? EMPTY);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setLabel(row?.label ?? '');
    setSets(row?.default_sets ?? 3);
    setVariants(row?.variants ?? EMPTY);
  }, [row]);
  const dirty =
    label !== (row?.label ?? '') || sets !== (row?.default_sets ?? 3) || variants.some((v, i) => v !== (row?.variants ?? EMPTY)[i]);

  const save = async () => {
    setBusy(true);
    try {
      await saveSlot({ weekday, slot, label: label.trim(), default_sets: sets, variants: variants.map((v) => v.trim()) });
      toast(`Slot ${slot} saved`);
    } catch (e) {
      toast(`Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title={`Slot ${slot}${label ? ` · ${label}` : ''}`}
      aside={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            sets
          </Typography>
          <Stepper label={`slot ${slot} sets`} value={sets} min={1} max={6} onChange={setSets} />
        </Box>
      }
    >
      <Stack spacing={1.5}>
        <TextField size="small" label="Slot name (e.g. Chest)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          {variants.map((v, i) => (
            <TextField
              key={i}
              size="small"
              label={`V${i + 1}${i === current ? ' · this week' : ''}`}
              placeholder="Default / Fallback"
              value={v}
              color={i === current ? 'secondary' : undefined}
              focused={i === current ? true : undefined}
              onChange={(e) => setVariants((all) => all.map((x, j) => (j === i ? e.target.value : x)))}
            />
          ))}
        </Box>
        {dirty && (
          <Button variant="contained" disabled={busy} onClick={() => void save()} sx={{ alignSelf: 'flex-start' }}>
            Save slot {slot}
          </Button>
        )}
      </Stack>
    </Card>
  );
}
