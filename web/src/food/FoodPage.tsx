import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { computeGoalProgress } from '../../../src/core/goals';
import { useSnackbar } from '../layout/Snackbar';
import { useFood } from './FoodContext';
import type { LogRow, MealRow } from './foodApi';
import { parseGoalSettings, toCoreMeals, toLogsByDate, todayKey, totalNutrition, weekOf, DATE_KEY } from './foodModel';
import { MealPicker } from './MealPicker';

function Card({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 1.5, gap: 1 }}>
        <Typography variant="subtitle1" component="h2" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>
        {aside}
      </Box>
      {children}
    </Paper>
  );
}

function dateLabel(key: string): string {
  const today = todayKey();
  if (key === today) return 'Today';
  if (key === dayjs(today).subtract(1, 'day').format(DATE_KEY)) return 'Yesterday';
  return dayjs(key).format('ddd D MMM');
}

export default function FoodPage() {
  const { loading, error, data, mealById, reload, logMeal, removeLog, restoreLog } = useFood();
  const showToast = useSnackbar();
  const navigate = useNavigate();
  const [date, setDate] = useState(todayKey);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  const categoryById = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);
  const dayLogs = useMemo(
    () => data.logs.filter((l) => l.log_date === date && l.kind === 'consumed'),
    [data.logs, date],
  );
  const totals = useMemo(() => totalNutrition(dayLogs, mealById), [dayLogs, mealById]);
  const week = useMemo(() => weekOf(date), [date]);
  const logsByDate = useMemo(() => toLogsByDate(data.logs), [data.logs]);
  const progress = useMemo(() => {
    const enabledNames = data.categories.filter((c) => c.enabled).map((c) => c.name);
    return computeGoalProgress(
      logsByDate,
      toCoreMeals(data.meals, data.categories),
      parseGoalSettings(data.settings?.goal_settings),
      enabledNames,
    );
  }, [logsByDate, data.meals, data.categories, data.settings]);

  if (loading && data.meals.length === 0) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
        <CircularProgress aria-label="Loading meals" />
      </Box>
    );
  }
  if (error) {
    return (
      <Alert severity="error" action={<Button color="inherit" onClick={() => void reload()}>Retry</Button>}>
        {error}
      </Alert>
    );
  }
  if (data.meals.length === 0) {
    return (
      <Card title="No meals yet">
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Bring over your meals, logs and goals from the LunchBox Chrome extension. In the extension, open
          Settings → Backup and download the backup file first.
        </Typography>
        <Button variant="contained" size="large" startIcon={<UploadFileRoundedIcon />} onClick={() => navigate('/food/import')}>
          Import from LunchBox backup
        </Button>
      </Card>
    );
  }

  const handlePick = async (meal: MealRow) => {
    setPicking(false);
    setBusy(true);
    try {
      const row = await logMeal(meal.id, date);
      showToast(`Logged ${meal.name}`, {
        action: { label: 'Undo', run: () => void removeLog(row).catch(() => showToast('Undo failed.', { severity: 'error' })) },
      });
    } catch (e) {
      showToast(`Not saved: ${e instanceof Error ? e.message : 'unknown error'}`, { severity: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (log: LogRow) => {
    const name = mealById.get(log.meal_id)?.name ?? 'Meal';
    try {
      await removeLog(log);
      showToast(`Removed ${name}`, {
        severity: 'info',
        action: { label: 'Undo', run: () => void restoreLog(log).catch(() => showToast('Undo failed.', { severity: 'error' })) },
      });
    } catch (e) {
      showToast(`Not removed: ${e instanceof Error ? e.message : 'unknown error'}`, { severity: 'error' });
    }
  };

  const isToday = date === todayKey();

  return (
    <Stack spacing={2} sx={{ maxWidth: 720 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton aria-label="Previous day" onClick={() => setDate(dayjs(date).subtract(1, 'day').format(DATE_KEY))} size="large">
          <ChevronLeftRoundedIcon />
        </IconButton>
        <Typography variant="h6" component="p" sx={{ flexGrow: 1, textAlign: 'center' }}>
          {dateLabel(date)}
        </Typography>
        <IconButton
          aria-label="Next day"
          disabled={isToday}
          onClick={() => setDate(dayjs(date).add(1, 'day').format(DATE_KEY))}
          size="large"
        >
          <ChevronRightRoundedIcon />
        </IconButton>
      </Box>

      <Button variant="contained" size="large" startIcon={<AddRoundedIcon />} onClick={() => setPicking(true)} disabled={busy} sx={{ minHeight: 52 }}>
        {busy ? 'Saving…' : 'Log a meal'}
      </Button>

      <Card title={`Meals · ${dateLabel(date)}`} aside={<Typography color="text.secondary">{dayLogs.length}</Typography>}>
        {dayLogs.length === 0 ? (
          <Typography color="text.secondary">Nothing logged for this day.</Typography>
        ) : (
          <List disablePadding>
            {dayLogs.map((log) => {
              const meal = mealById.get(log.meal_id);
              const category = meal ? categoryById.get(meal.category_id) : undefined;
              return (
                <ListItem
                  key={log.id}
                  disableGutters
                  secondaryAction={
                    <IconButton edge="end" aria-label={`Remove ${meal?.name ?? 'meal'}`} onClick={() => void handleRemove(log)} size="large">
                      <DeleteOutlineRoundedIcon />
                    </IconButton>
                  }
                >
                  <Box aria-hidden sx={{ fontSize: 24, width: 40, textAlign: 'center' }}>
                    {meal?.icon ?? category?.icon}
                  </Box>
                  <ListItemText
                    primary={meal?.name ?? 'Unknown meal'}
                    secondary={`${category?.name ?? ''} · ${Math.round(meal?.calories ?? 0)} kcal`}
                  />
                </ListItem>
              );
            })}
          </List>
        )}
        {dayLogs.length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Estimated from catalog values: {Math.round(totals.calories)} kcal · {Math.round(totals.protein)} g protein ·{' '}
            {Math.round(totals.carbs)} g carbs · {Math.round(totals.fat)} g fat
          </Typography>
        )}
      </Card>

      <Card title="This week">
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.75 }}>
          {week.map((key) => {
            const count = logsByDate[key]?.length ?? 0;
            const selected = key === date;
            const future = key > todayKey();
            return (
              <Box
                key={key}
                component="button"
                disabled={future}
                onClick={() => setDate(key)}
                aria-label={`${dayjs(key).format('dddd D MMMM')}: ${count} meal${count === 1 ? '' : 's'}`}
                aria-pressed={selected}
                sx={{
                  border: 1,
                  borderColor: selected ? 'secondary.main' : 'divider',
                  borderRadius: 1.5,
                  bgcolor: count > 0 ? 'action.selected' : 'transparent',
                  color: 'text.primary',
                  font: 'inherit',
                  py: 1,
                  minHeight: 56,
                  cursor: future ? 'default' : 'pointer',
                  opacity: future ? 0.4 : 1,
                }}
              >
                <Typography variant="caption" color="text.secondary" component="div">
                  {dayjs(key).format('dd')}
                </Typography>
                <Typography variant="subtitle1" component="div">
                  {future ? '' : count}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Card>

      <Card title="Goals" aside={<Typography variant="caption" color="text.secondary">all time · from LunchBox</Typography>}>
        <Stack spacing={1.5}>
          <ProgressRow label="Days with a logged meal" count={progress.days.count} target={progress.days.target} />
          {progress.categories
            .filter((c) => c.enabled)
            .map((c) => (
              <ProgressRow key={c.category} label={c.category} count={c.count} target={c.target} />
            ))}
        </Stack>
      </Card>

      <Button startIcon={<UploadFileRoundedIcon />} onClick={() => navigate('/food/import')} sx={{ alignSelf: 'flex-start' }}>
        Import from LunchBox backup
      </Button>

      <MealPicker
        open={picking}
        dateLabel={dateLabel(date)}
        meals={data.meals}
        categories={data.categories}
        onClose={() => setPicking(false)}
        onPick={(meal) => void handlePick(meal)}
      />
    </Stack>
  );
}

function ProgressRow({ label, count, target }: { label: string; count: number; target: number }) {
  const percent = target > 0 ? Math.min(100, Math.round((count / target) * 100)) : 0;
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {count} / {target}
          {count >= target ? ' · done' : ''}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percent}
        color={count >= target ? 'success' : 'secondary'}
        aria-label={`${label}: ${count} of ${target}`}
        sx={{ height: 8, borderRadius: 4 }}
      />
    </Box>
  );
}
