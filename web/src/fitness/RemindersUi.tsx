import EventRoundedIcon from '@mui/icons-material/EventRounded';
import { Alert, Box, Button, Chip, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useSnackbar } from '../layout/Snackbar';
import { useFitness } from './FitnessContext';
import type { FitnessData } from './fitnessApi';
import { buildIcs, dueToday, validateReminders, type DueItem, type ReminderSettings } from './reminders';
import { MIN_DAYS_PER_WEEK, isAway, waistSummary } from './rules';
import { Card } from './ui';

const DAY_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function dueItemsFor(data: FitnessData, today: string): DueItem[] {
  const waist = waistSummary(data.waists, data.away, data.settings.waist_interval_days, today);
  return dueToday({
    today,
    reminders: data.settings.reminders,
    weighIns: data.weighIns.filter((w) => !w.deleted_at && !isAway(w.day, data.away)),
    trendTime: data.settings.weigh_time,
    minPerWeek: MIN_DAYS_PER_WEEK,
    waistNextDue: waist.nextDue,
    hasWaist: waist.latest !== null,
    away: isAway(today, data.away),
  });
}

/** "Due today" strip on the Today screen. Tapping an item scrolls to its card. */
export function DueToday({ data, today }: { data: FitnessData; today: string }) {
  const items = dueItemsFor(data, today);
  const target: Record<DueItem['key'], string> = { weigh: 'weight-card', waist: 'waist-card', review: '' };
  return (
    <AnimatePresence initial={false}>
      {items.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: '20px' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Due today
            </Typography>
            <Stack spacing={0.75} sx={{ mt: 0.75 }}>
              <AnimatePresence initial={false}>
                {items.map((i, n) => (
                  <motion.div key={i.key} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ delay: n * 0.05 }}>
                    <Box
                      component={target[i.key] ? 'button' : 'div'}
                      onClick={target[i.key] ? () => document.getElementById(target[i.key])?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : undefined}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        width: '100%',
                        p: 1,
                        border: 0,
                        borderRadius: '14px',
                        textAlign: 'left',
                        font: 'inherit',
                        color: 'inherit',
                        cursor: target[i.key] ? 'pointer' : 'default',
                        bgcolor: (t) => t.tracker.tonal,
                      }}
                    >
                      <Box aria-hidden sx={{ fontSize: 22 }}>
                        {i.emoji}
                      </Box>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700 }}>{i.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {i.detail}
                        </Typography>
                      </Box>
                      {i.overdue && <Chip size="small" color="warning" label="Behind" />}
                    </Box>
                  </motion.div>
                ))}
              </AnimatePresence>
            </Stack>
          </Paper>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Reminder days and times, plus a calendar file so your phone rings. */
export function RemindersCard() {
  const { data, saveSettings } = useFitness();
  const toast = useSnackbar();
  const [form, setForm] = useState<ReminderSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (data) setForm(data.settings.reminders);
  }, [data?.settings.reminders]);
  if (!data || !form) return null;
  const today = dayjs().format('YYYY-MM-DD');

  const toggleDay = (d: number) =>
    setForm({ ...form, weigh_days: form.weigh_days.includes(d) ? form.weigh_days.filter((x) => x !== d) : [...form.weigh_days, d].sort() });

  const save = async () => {
    const problem = validateReminders(form);
    if (problem) return setError(problem);
    setError(null);
    try {
      await saveSettings({ reminders: form });
      toast('Reminders saved. Download the calendar file again to update your phone.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not saved.');
    }
  };

  const download = () => {
    const problem = validateReminders(form);
    if (problem) return setError(problem);
    const waist = waistSummary(data.waists, data.away, data.settings.waist_interval_days, today);
    const ics = buildIcs({
      today,
      reminders: form,
      trendTime: data.settings.weigh_time,
      waistIntervalDays: data.settings.waist_interval_days,
      waistNextDue: waist.nextDue,
      nowUtc: new Date(),
    });
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'tracker-reminders.ics' });
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <Card title="⏰ Reminders">
      <Stack spacing={1.5}>
        <Typography variant="body2" color="text.secondary">
          Due items show on Today. For alarms on your phone, add the calendar file: weigh-ins on the days below, waist every{' '}
          {data.settings.waist_interval_days} days, and the monthly review.
        </Typography>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
            Weigh-in days
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }} role="group" aria-label="Weigh-in days">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <Chip
                key={d}
                label={DAY_SHORT[d]}
                color={form.weigh_days.includes(d) ? 'secondary' : 'default'}
                variant={form.weigh_days.includes(d) ? 'filled' : 'outlined'}
                onClick={() => toggleDay(d)}
                aria-pressed={form.weigh_days.includes(d)}
              />
            ))}
          </Box>
        </Box>
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' } }}>
          <TextField size="small" type="time" label="Weigh-in time" value={form.weigh_time} onChange={(e) => setForm({ ...form, weigh_time: e.target.value })} InputLabelProps={{ shrink: true }} />
          <TextField size="small" type="time" label="Waist & review time" value={form.waist_time} onChange={(e) => setForm({ ...form, waist_time: e.target.value })} InputLabelProps={{ shrink: true }} />
          <TextField size="small" select label="Monthly review on" value={form.review_day} onChange={(e) => setForm({ ...form, review_day: Number(e.target.value) })} sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <MenuItem key={d} value={d}>
                Day {d}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        {error && <Alert severity="error">{error}</Alert>}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={() => void save()}>
            Save
          </Button>
          <Button variant="outlined" startIcon={<EventRoundedIcon />} onClick={download}>
            Add to calendar (.ics)
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary">
          Open the downloaded file on your phone and choose Add. Re-adding after a change updates the same events.
        </Typography>
      </Stack>
    </Card>
  );
}
