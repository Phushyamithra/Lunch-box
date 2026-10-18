import { Box, Chip, Paper, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useFitness } from '../fitness/FitnessContext';
import { weekAdherence, weeklyAverages, weekStart } from '../fitness/rules';
import { useFood } from '../food/FoodContext';
import { todayKey } from '../food/foodModel';
import { GlassIcon } from '../layout/GlassIcon';
import { NAV_ITEMS } from '../layout/navItems';
import { MODULES } from './ModulePlaceholder';

const CARDS = [
  { path: '/food', module: MODULES.food, metric: "Today's meals and item caps" },
  { path: '/fitness', module: MODULES.fitness, metric: 'Weekly-average weight and workouts' },
  { path: '/finance', module: MODULES.finance, metric: 'Monthly spend and savings goal' },
  { path: '/goals', module: MODULES.goals, metric: 'Recently completed milestones' },
];

/** Platform summary. Each card links to its module and shows live status where built. */
export default function Home() {
  const navigate = useNavigate();
  const food = useFood();
  const fitness = useFitness();
  const today = todayKey();
  const mealsToday = food.data.logs.filter((l) => l.log_date === today && l.kind === 'consumed').length;
  /** Live status for modules that exist; the rest are not built yet. */
  const status = (path: string): { chip: string; text?: string } => {
    if (path === '/food' && !food.loading && food.data.meals.length > 0) {
      return { chip: 'Today', text: `${mealsToday} meal${mealsToday === 1 ? '' : 's'} logged today` };
    }
    if (path === '/food') return { chip: food.loading ? 'Loading' : 'Import needed' };
    if (path === '/fitness' && fitness.data) {
      const d = fitness.data;
      const week = [...weeklyAverages(d.weighIns, d.away, today)].reverse().find((w) => w.average !== null);
      const training = weekAdherence(weekStart(today), d.sessions, d.away);
      const weight = week ? `${week.average?.toFixed(1)} kg weekly avg` : 'No weigh-ins yet';
      return { chip: 'This week', text: `${weight} · ${training.completed}/${training.eligible} sessions` };
    }
    return { chip: 'Not set up' };
  };
  return (
    <Box>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Summaries from each module appear here as they are built.
      </Typography>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        {CARDS.map(({ path, module, metric }) => (
          <Paper
            key={path}
            variant="outlined"
            component="button"
            onClick={() => navigate(path)}
            sx={{
              p: 2.5,
              textAlign: 'left',
              cursor: 'pointer',
              color: 'inherit',
              font: 'inherit',
              minHeight: 120,
              transition: 'transform 150ms ease',
              '&:hover, &:focus-visible': { transform: 'translateY(-2px)' },
              '&:active': { transform: 'scale(0.98)' },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              {(() => {
                const item = NAV_ITEMS.find((n) => n.path === path);
                return item ? <GlassIcon icon={item.icon} tint={item.tint} /> : null;
              })()}
              <Typography variant="subtitle1" sx={{ fontWeight: 700, flexGrow: 1 }}>
                {module.title}
              </Typography>
              <Chip size="small" variant="outlined" label={status(path).chip} />
            </Box>
            <Typography color="text.secondary">{status(path).text ?? metric}</Typography>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
