import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useState } from 'react';
import { addDays } from '../fitness/rules';
import { useSnackbar } from '../layout/Snackbar';
import { MEALS, type Entry, type MealSlot } from './foodLog';
import { useNutrition } from './NutritionContext';

const KEY = 'YYYY-MM-DD';
const mealLabel = (m: MealSlot) => MEALS.find((x) => x.key === m)?.label ?? m;

/**
 * Copy or move a whole meal (or one food) to another meal and/or day:
 * lunch → dinner, yesterday's breakfast → today. One food can also be removed here.
 */
export function MealActions({ entries, day, meal, single, onClose }: { entries: Entry[]; day: string; meal: MealSlot; single?: boolean; onClose: () => void }) {
  const { copyEntries, moveEntries, setEntryDeleted } = useNutrition();
  const toast = useSnackbar();
  const today = dayjs().format(KEY);
  const [mode, setMode] = useState<'copy' | 'move'>('copy');
  // Viewing another day: today is the likely target; on today, another meal is.
  const [toDay, setToDay] = useState(day === today ? today : today);
  const [toMeal, setToMeal] = useState<MealSlot>(day === today ? (MEALS.find((m) => m.key !== meal)?.key ?? meal) : meal);
  const [busy, setBusy] = useState(false);
  const same = toDay === day && toMeal === meal;
  const what = single ? entries[0].name : `${mealLabel(meal)} (${entries.length} item${entries.length === 1 ? '' : 's'})`;
  const where = `${mealLabel(toMeal)}, ${toDay === today ? 'today' : toDay === addDays(today, -1) ? 'yesterday' : dayjs(toDay).format('D MMM')}`;

  const run = async () => {
    setBusy(true);
    try {
      if (mode === 'copy') await copyEntries(entries, toDay, toMeal);
      else await moveEntries(entries, toDay, toMeal);
      toast(`${mode === 'copy' ? '📋 Copied' : '➡️ Moved'} ${what} to ${where}`);
      onClose();
    } catch (e) {
      toast(`Not done: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    const e = entries[0];
    try {
      await setEntryDeleted(e, true);
      toast(`Removed ${e.name}`, { severity: 'info', action: { label: 'Undo', run: () => void setEntryDeleted(e, false) } });
      onClose();
    } catch (err) {
      toast(`Not removed: ${err instanceof Error ? err.message : 'error'}`, { severity: 'error' });
    }
  };

  const dayChips = [today, addDays(today, -1), addDays(today, -2)];
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{what}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <ToggleButtonGroup exclusive fullWidth value={mode} onChange={(_, v) => v && setMode(v)} aria-label="Copy or move">
            <ToggleButton value="copy" sx={{ minHeight: 48 }}>
              Copy
            </ToggleButton>
            <ToggleButton value="move" sx={{ minHeight: 48 }}>
              Move
            </ToggleButton>
          </ToggleButtonGroup>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              To meal
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              {MEALS.map((m) => (
                <Chip key={m.key} label={`${m.emoji} ${m.label}`} color={toMeal === m.key ? 'primary' : 'default'} variant={toMeal === m.key ? 'filled' : 'outlined'} onClick={() => setToMeal(m.key)} sx={{ height: 44 }} />
              ))}
            </Box>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              On day
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, mb: 1.5 }}>
              {dayChips.map((d, i) => (
                <Chip key={d} label={['Today', 'Yesterday', dayjs(d).format('ddd D')][i]} color={toDay === d ? 'primary' : 'default'} variant={toDay === d ? 'filled' : 'outlined'} onClick={() => setToDay(d)} sx={{ height: 44 }} />
              ))}
            </Box>
            <TextField type="date" label="Or pick a date" size="small" fullWidth value={toDay} inputProps={{ max: today }} onChange={(e) => e.target.value && setToDay(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Box>
          {same && (
            <Typography variant="body2" color="text.secondary">
              That’s where it already is: pick another meal or day.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2.5 }}>
        {single && (
          <Button color="error" onClick={() => void remove()} sx={{ mr: 'auto' }}>
            Remove
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={same || busy} onClick={() => void run()}>
          {mode === 'copy' ? 'Copy' : 'Move'} to {where}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
