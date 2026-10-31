import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MEALS, dayTotals, type Entry } from './foodLog';
import { useNutrition } from './NutritionContext';
import { activeTarget } from './nutritionApi';

const PAGE = 14;

/** Every logged day at a glance: what you ate, meal by meal. Tap a day to open or change it. */
export default function NutritionDays() {
  const { data } = useNutrition();
  const navigate = useNavigate();
  const [shown, setShown] = useState(PAGE);
  const nd = data!;
  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of nd.entries) map.set(e.day, [...(map.get(e.day) ?? []), e]);
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [nd.entries]);

  if (byDay.length === 0) {
    return <Typography color="text.secondary">Nothing logged yet. Days appear here once you add food.</Typography>;
  }
  return (
    <Stack spacing={3} sx={{ maxWidth: 720 }}>
      {byDay.slice(0, shown).map(([day, entries]) => {
        const { total, byMeal } = dayTotals(entries, day);
        const target = activeTarget(nd.targets, day);
        return (
          <Paper key={day} variant="outlined" component="button" onClick={() => navigate('/nutrition', { state: { day } })} sx={{ display: 'block', width: '100%', p: 2.5, borderRadius: '20px', textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit' }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap', mb: 1.25 }}>
              <Typography sx={{ fontWeight: 700, flexGrow: 1 }}>{dayjs(day).format('ddd D MMM')}</Typography>
              <Typography sx={{ fontWeight: 700 }}>
                {total.kcal.toLocaleString('en-IN')}
                {target ? ` / ${target.kcal.toLocaleString('en-IN')}` : ''} kcal
              </Typography>
              <Typography variant="body2" color="text.secondary">
                P {total.protein} g
              </Typography>
            </Box>
            <Stack spacing={0.75}>
              {MEALS.filter((m) => byMeal[m.key].entries.length > 0).map((m) => (
                <Box key={m.key} sx={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 0.5, alignItems: 'baseline' }}>
                  <span aria-label={m.label} role="img">
                    {m.emoji}
                  </span>
                  <Typography variant="body2">{byMeal[m.key].entries.map((e) => e.name).join(', ')}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', pl: 1 }}>
                    {byMeal[m.key].total.kcal}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Paper>
        );
      })}
      {shown < byDay.length && (
        <Button onClick={() => setShown(shown + PAGE)} sx={{ alignSelf: 'center' }}>
          Show earlier days
        </Button>
      )}
    </Stack>
  );
}
