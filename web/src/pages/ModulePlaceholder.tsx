import { Chip, Paper, Stack, Typography } from '@mui/material';

export interface ModuleInfo {
  title: string;
  phase: number;
  summary: string;
  features: string[];
}

export const MODULES = {
  food: {
    title: 'Meal prep',
    phase: 2,
    summary: 'What the meal-prep service delivered and when, moved to the cloud from the Chrome extension.',
    features: ['Delivery log by date', 'Per-item caps for each plan', 'Monthly calendar'],
  },
  nutrition: {
    title: 'Nutrition',
    phase: 4,
    summary: 'Your own calorie and macro tracker, India-first.',
    features: ['Goal-based calorie and macro targets', 'Indian foods, barcodes and restaurant menus', 'Daily totals and trends'],
  },
  fitness: {
    title: 'Fitness',
    phase: 3,
    summary: 'Lean-bulk tracking built around weekly averages.',
    features: ['Evening weigh-ins and waist checks', 'Six-day program with V1–V7 rotation', 'Diet tags and away mode'],
  },
  finance: {
    title: 'Finance',
    phase: 6,
    summary: 'Budgets, cards and the savings waterfall, encrypted on your device before it syncs.',
    features: ['Quick-add transactions', 'Card cycles and settlements', 'Projections until the last goal'],
  },
  goals: {
    title: 'Goals',
    phase: 5,
    summary: 'Milestones shared by every module, with history that is never reset.',
    features: ['Daily, weekly, monthly and one-off goals', 'Cycle history', 'Achievement timeline'],
  },
} satisfies Record<string, ModuleInfo>;

/** Honest "not built yet" screen — no sample numbers that look real. */
export function ModulePlaceholder({ module }: { module: ModuleInfo }) {
  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6" component="h2">
            {module.title}
          </Typography>
          <Chip size="small" label={`Coming in phase ${module.phase}`} />
        </Stack>
        <Typography color="text.secondary">{module.summary}</Typography>
      </Paper>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle2" gutterBottom>
          Planned
        </Typography>
        <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2.5 }}>
          {module.features.map((feature) => (
            <Typography component="li" key={feature} color="text.secondary">
              {feature}
            </Typography>
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}
