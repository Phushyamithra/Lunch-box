import { Box, Chip, Paper, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { NAV_ITEMS } from '../layout/navItems';
import { MODULES } from './ModulePlaceholder';

const CARDS = [
  { path: '/food', module: MODULES.food, metric: "Today's meals and item caps" },
  { path: '/fitness', module: MODULES.fitness, metric: 'Weekly-average weight and workouts' },
  { path: '/finance', module: MODULES.finance, metric: 'Monthly spend and savings goal' },
  { path: '/goals', module: MODULES.goals, metric: 'Recently completed milestones' },
];

/** Platform summary. Each card links to its module; no data exists yet. */
export default function Home() {
  const navigate = useNavigate();
  return (
    <Box>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Summaries from each module will appear here as they are built.
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
              bgcolor: 'background.paper',
              minHeight: 120,
              '&:hover, &:focus-visible': { borderColor: 'primary.main' },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              {NAV_ITEMS.find((item) => item.path === path)?.icon}
              <Typography variant="subtitle1" sx={{ fontWeight: 700, flexGrow: 1 }}>
                {module.title}
              </Typography>
              <Chip size="small" variant="outlined" label="Not set up" />
            </Box>
            <Typography color="text.secondary">{metric}</Typography>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
