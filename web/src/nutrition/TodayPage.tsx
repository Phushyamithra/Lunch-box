import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { Alert, Box, Button, Chip, IconButton, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays } from '../fitness/rules';
import { Card } from '../fitness/ui';
import { useSnackbar } from '../layout/Snackbar';
import { AddFoodSheet } from './AddFoodSheet';
import { MEALS, dayTotals, progressAgainst, type Entry, type MacroProgress, type MealSlot } from './foodLog';
import { useNutrition } from './NutritionContext';
import { activeTarget } from './nutritionApi';

const KEY = 'YYYY-MM-DD';
const LABEL: Record<MacroProgress['key'], { label: string; emoji: string; unit: string }> = {
  kcal: { label: 'Calories', emoji: '🔥', unit: 'kcal' },
  protein: { label: 'Protein', emoji: '🥚', unit: 'g' },
  carbs: { label: 'Carbs', emoji: '🍚', unit: 'g' },
  fat: { label: 'Fat', emoji: '🥜', unit: 'g' },
  fibre: { label: 'Fibre', emoji: '🥦', unit: 'g' },
};
const mealNow = (): MealSlot => {
  const h = new Date().getHours();
  return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 19 ? 'snacks' : 'dinner';
};

/** The day's food log: totals vs targets, then meal by meal. */
export default function NutritionToday() {
  const { data, setEntryDeleted } = useNutrition();
  const navigate = useNavigate();
  const toast = useSnackbar();
  const today = dayjs().format(KEY);
  const [day, setDay] = useState(today);
  const [adding, setAdding] = useState<MealSlot | null>(null);
  const nd = data!;
  const target = activeTarget(nd.targets, day);
  const { total, byMeal } = dayTotals(nd.entries, day);
  const progress = target ? progressAgainst(total, target) : null;

  const remove = async (e: Entry) => {
    try {
      await setEntryDeleted(e, true);
      toast(`Removed ${e.name}`, { severity: 'info', action: { label: 'Undo', run: () => void setEntryDeleted(e, false) } });
    } catch (err) {
      toast(`Not removed: ${err instanceof Error ? err.message : 'error'}`, { severity: 'error' });
    }
  };

  return (
    <Stack spacing={2} sx={{ maxWidth: 720 }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <IconButton aria-label="Previous day" onClick={() => setDay(addDays(day, -1))} size="large">
          <ChevronLeftRoundedIcon />
        </IconButton>
        <Typography variant="h6" component="p" sx={{ flexGrow: 1, textAlign: 'center' }}>
          {day === today ? 'Today' : dayjs(day).format('ddd D MMM')}
        </Typography>
        <IconButton aria-label="Next day" disabled={day >= today} onClick={() => setDay(addDays(day, 1))} size="large">
          <ChevronRightRoundedIcon />
        </IconButton>
      </Box>

      {!target && (
        <Alert severity="info" action={<Button color="inherit" onClick={() => navigate('/nutrition/targets')}>Set targets</Button>}>
          No targets for this day yet. You can still log food; totals show without a target.
        </Alert>
      )}

      <Card title="📊 Totals" aside={target && <Chip size="small" label={`target ${target.kcal} kcal`} />}>
        {progress ? (
          <Stack spacing={1.5}>
            <CalorieHeadline p={progress[0]} />
            {progress.slice(1).map((p, i) => (
              <MacroBar key={p.key} p={p} delay={i * 0.05} />
            ))}
          </Stack>
        ) : (
          <Typography>
            {total.kcal} kcal · P {total.protein} g · C {total.carbs} g · F {total.fat} g · fibre {total.fibre} g
          </Typography>
        )}
        {(total.sugar !== null || total.sodium_mg !== null) && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Where labels give it: sugar {total.sugar ?? '–'} g · sodium {total.sodium_mg ?? '–'} mg
          </Typography>
        )}
      </Card>

      {MEALS.map((m) => {
        const { entries, total: mt } = byMeal[m.key];
        return (
          <Paper key={m.key} variant="outlined" sx={{ p: 1.5, borderRadius: '20px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontWeight: 700, flexGrow: 1 }}>
                {m.emoji} {m.label}
              </Typography>
              {entries.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  {mt.kcal} kcal · P {mt.protein} g
                </Typography>
              )}
              <IconButton aria-label={`Add to ${m.label}`} onClick={() => setAdding(m.key)} sx={{ bgcolor: (t) => t.tracker.tonal }}>
                <AddRoundedIcon />
              </IconButton>
            </Box>
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              <AnimatePresence initial={false}>
                {entries.map((e) => (
                  <motion.li
                    key={e.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10, height: 0 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}
                  >
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                        {e.source === 'meal_prep' && '🚚 '}
                        {e.source === 'restaurant' && '🍽️ '}
                        {e.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {e.source === 'quick' ? 'quick add' : `${e.quantity} × ${e.unit}`}
                        {e.grams !== null && e.unit !== 'g' && e.unit !== 'ml' ? ` (${e.grams} g)` : ''} · P {e.protein} · C {e.carbs} · F {e.fat}
                        {e.verification === 'estimated' ? ' · estimated' : ''}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {e.kcal} kcal
                    </Typography>
                    <IconButton size="small" aria-label={`Remove ${e.name}`} onClick={() => void remove(e)}>
                      <CloseRoundedIcon fontSize="small" />
                    </IconButton>
                  </motion.li>
                ))}
              </AnimatePresence>
            </Box>
          </Paper>
        );
      })}

      <AddFoodSheet open={adding !== null} day={day} meal={adding ?? mealNow()} onClose={() => setAdding(null)} />
    </Stack>
  );
}

function CalorieHeadline({ p }: { p: MacroProgress }) {
  const pct = p.aim ? Math.min(100, (p.eaten / p.aim) * 100) : 0;
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
        <motion.span key={p.eaten} initial={{ scale: 0.9, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }} style={{ display: 'inline-block' }}>
          <Typography component="span" sx={{ fontSize: 32, fontWeight: 800 }}>
            {p.eaten.toLocaleString('en-IN')}
          </Typography>
        </motion.span>
        <Typography component="span" color="text.secondary">
          of {p.aim.toLocaleString('en-IN')} kcal
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Typography sx={{ fontWeight: 700 }} color={p.remaining < 0 ? 'warning.main' : 'text.primary'}>
          {p.remaining >= 0 ? `${Math.round(p.remaining).toLocaleString('en-IN')} left` : `${Math.round(-p.remaining).toLocaleString('en-IN')} over`}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        color={p.status === 'over' ? 'warning' : 'secondary'}
        sx={{ height: 10, borderRadius: 999, mt: 0.5, '& .MuiLinearProgress-bar': { transition: 'transform 500ms cubic-bezier(.2,.8,.2,1)' } }}
        aria-label={`${p.eaten} of ${p.aim} kcal`}
      />
    </Box>
  );
}

function MacroBar({ p, delay }: { p: MacroProgress; delay: number }) {
  const l = LABEL[p.key];
  const scaleMax = Math.max(p.max ?? p.aim, p.eaten, 1);
  const range = p.min !== null && p.max !== null ? `${p.min}–${p.max}` : `${p.aim}`;
  const note =
    p.status === 'in_range' ? (p.key === 'fibre' ? 'reached' : 'in range') : p.status === 'over' ? `${Math.round(p.eaten - (p.max ?? p.aim))} ${l.unit} over` : `${Math.max(0, Math.round((p.min ?? p.aim) - p.eaten))} ${l.unit} to go`;
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {l.emoji} {l.label} {p.eaten} / {range} {l.unit}
        </Typography>
        <Typography variant="body2" color={p.status === 'over' ? 'warning.main' : p.status === 'in_range' ? 'success.main' : 'text.secondary'}>
          {note}
        </Typography>
      </Box>
      <Box sx={{ position: 'relative', mt: 0.5 }}>
        <LinearProgress
          variant="determinate"
          value={Math.min(100, (p.eaten / scaleMax) * 100)}
          color={p.status === 'over' ? 'warning' : p.status === 'in_range' ? 'success' : 'secondary'}
          sx={{ height: 8, borderRadius: 999, '& .MuiLinearProgress-bar': { transition: 'transform 500ms cubic-bezier(.2,.8,.2,1)' } }}
          aria-label={`${l.label} ${p.eaten} of ${range} ${l.unit}`}
        />
        {p.min !== null && p.max !== null && (
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              top: -2,
              bottom: -2,
              left: `${(p.min / scaleMax) * 100}%`,
              width: `${((p.max - p.min) / scaleMax) * 100}%`,
              border: 2,
              borderColor: 'success.main',
              borderRadius: 999,
              opacity: 0.6,
            }}
          />
        )}
      </Box>
    </motion.div>
  );
}
