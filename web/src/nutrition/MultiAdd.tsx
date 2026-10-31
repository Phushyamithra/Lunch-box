import { Box, Button, Chip, Collapse, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useState } from 'react';
import { addDays } from '../fitness/rules';
import { MEALS, type MealSlot } from './foodLog';
import type { EntryInput } from './nutritionApi';

const KEY = 'YYYY-MM-DD';
const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** Every meal on every picked day: the same food and amount goes to each. */
export function logTargets(days: string[], meals: MealSlot[]): { day: string; meal: MealSlot }[] {
  return days.flatMap((day) => meals.map((meal) => ({ day, meal })));
}

/** Extra meals and days for one add, on top of the meal and day it was opened for. */
export function useAlsoAdd(day: string, meal: MealSlot) {
  const [meals, setMeals] = useState<MealSlot[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const targets = logTargets([day, ...days.filter((d) => d !== day)], [meal, ...meals.filter((m) => m !== meal)]);
  const reset = () => {
    setMeals([]);
    setDays([]);
  };
  return { day, meal, meals, days, setMeals, setDays, targets, reset };
}

/** The add button's action: adds to each target, and says how far it got if one fails. */
export async function addToAll(targets: { day: string; meal: MealSlot }[], input: Omit<EntryInput, 'day' | 'meal'>, add: (e: EntryInput) => Promise<unknown>): Promise<void> {
  let done = 0;
  try {
    for (const t of targets) {
      await add({ ...input, ...t });
      done += 1;
    }
  } catch (e) {
    const why = e instanceof Error ? e.message : 'error';
    throw new Error(done ? `${done} of ${targets.length} added, then: ${why}` : why);
  }
}

export function AlsoAddPicker({ state }: { state: ReturnType<typeof useAlsoAdd> }) {
  const { day, meal, meals, days, setMeals, setDays } = state;
  const [open, setOpen] = useState(false);
  const today = dayjs().format(KEY);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
  const dayChips = week.includes(day) ? week : [day, ...week];
  const label = (d: string) => (d === today ? 'Today' : d === addDays(today, -1) ? 'Yesterday' : dayjs(d).format('ddd D'));
  return (
    <Box>
      <Button size="small" onClick={() => setOpen(!open)} sx={{ px: 0 }} aria-expanded={open}>
        {open ? 'Hide other meals and days' : 'Same amount for other meals or days?'}
      </Button>
      <Collapse in={open} unmountOnExit>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1, mb: 0.75 }}>
          Meals
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {MEALS.map((m) => {
            const on = m.key === meal || meals.includes(m.key);
            return <Chip key={m.key} label={`${m.emoji} ${m.label}`} color={on ? 'secondary' : 'default'} variant={on ? 'filled' : 'outlined'} onClick={m.key === meal ? undefined : () => setMeals(toggle(meals, m.key))} aria-pressed={on} />;
          })}
        </Box>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5, mb: 0.75 }}>
          Days
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {dayChips.map((d) => {
            const on = d === day || days.includes(d);
            return <Chip key={d} label={label(d)} color={on ? 'secondary' : 'default'} variant={on ? 'filled' : 'outlined'} onClick={d === day ? undefined : () => setDays(toggle(days, d))} aria-pressed={on} />;
          })}
        </Box>
      </Collapse>
    </Box>
  );
}
