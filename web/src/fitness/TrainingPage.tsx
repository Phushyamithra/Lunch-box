import { Box, Chip, Stack, Typography, useTheme } from '@mui/material';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFitness } from './FitnessContext';
import { isAway, liftSeries } from './rules';
import { Card, kg } from './ui';

const SERIES_COLOURS = ['primary', 'secondary', 'info', 'success'] as const;

/** Session history (with the exercises actually done) and key-lift trends. */
export default function TrainingPage() {
  const theme = useTheme();
  const { data } = useFitness();
  const sessions = useMemo(() => (data ? [...data.sessions].sort((a, b) => b.day.localeCompare(a.day)) : []), [data]);
  if (!data) return null;

  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, alignItems: 'start' }}>
      <Stack spacing={2}>
        {data.settings.key_lifts.map((group) => {
          const series = liftSeries(group, data.sets, data.sessions);
          const names = [...series.keys()];
          const points = new Map<string, Record<string, number | string>>();
          for (const [name, list] of series) {
            for (const p of list) {
              const row = points.get(p.day) ?? { day: p.day };
              row[name] = p.weight;
              points.set(p.day, row);
            }
          }
          const rows = [...points.values()].sort((a, b) => String(a.day).localeCompare(String(b.day)));
          return (
            <Card key={group.label} title={group.label} aside={<Typography variant="caption" color="text.secondary">top working set, kg</Typography>}>
              {rows.length === 0 ? (
                <Typography color="text.secondary" variant="body2">
                  No sets logged yet for {group.exercises.join(' or ')}.
                </Typography>
              ) : (
                <Box sx={{ height: 180 }} role="img" aria-label={`${group.label} working weight trend`}>
                  <ResponsiveContainer>
                    <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                      <CartesianGrid stroke={theme.palette.divider} vertical={false} />
                      <XAxis dataKey="day" tickFormatter={(d) => dayjs(d).format('D MMM')} tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} stroke={theme.palette.divider} />
                      <YAxis domain={['auto', 'auto']} tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} stroke={theme.palette.divider} />
                      <Tooltip
                        labelFormatter={(d) => dayjs(d as string).format('D MMM YYYY')}
                        contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 12 }}
                      />
                      {names.length > 1 && <Legend />}
                      {names.map((name, i) => (
                        <Line key={name} dataKey={name} stroke={theme.palette[SERIES_COLOURS[i % SERIES_COLOURS.length]].main} strokeWidth={2.5} connectNulls isAnimationActive={false} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </Card>
          );
        })}
        <Typography variant="caption" color="text.secondary">
          Each exercise is its own line: variants are never merged into one trend. Edit the key-lift list under Targets & away.
        </Typography>
      </Stack>

      <Card title="Session history" aside={<Typography color="text.secondary">{sessions.length}</Typography>}>
        {sessions.length === 0 ? (
          <Typography color="text.secondary">No sessions yet. Check in from Today.</Typography>
        ) : (
          <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
            {sessions.slice(0, 60).map((s) => {
              const sets = data.sets.filter((x) => x.session_id === s.id).sort((a, b) => a.slot - b.slot || a.set_number - b.set_number);
              const exercises = [...new Set(sets.map((x) => x.exercise))];
              return (
                <Box key={s.id} sx={{ py: 1.25 }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography sx={{ fontWeight: 600, flexGrow: 1 }}>{dayjs(s.day).format('ddd D MMM')}</Typography>
                    <Chip size="small" label={`V${s.variant_index + 1}`} />
                    {isAway(s.day, data.away) && <Chip size="small" variant="outlined" label="away" />}
                    <Chip size="small" color={s.completed ? 'success' : 'default'} label={s.completed ? 'done' : `${s.slots_completed}/5 slots`} />
                  </Box>
                  {exercises.map((e) => {
                    const mine = sets.filter((x) => x.exercise === e);
                    return (
                      <Typography key={e} variant="body2" color="text.secondary">
                        {e}: {mine.map((x) => `${x.reps}×${kg(x.weight_kg, 1)}`).join(', ')}
                      </Typography>
                    );
                  })}
                </Box>
              );
            })}
          </Stack>
        )}
      </Card>
    </Box>
  );
}
