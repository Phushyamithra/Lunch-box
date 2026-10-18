import AddRoundedIcon from '@mui/icons-material/AddRounded';
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
  useTheme,
} from '@mui/material';
import dayjs from 'dayjs';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { computeGoalProgress } from '../../../src/core/goals';
import { useSnackbar } from '../layout/Snackbar';
import { useFood } from './FoodContext';
import type { LogRow, MealRow } from './foodApi';
import {
  DATE_KEY,
  MONTH_KEY,
  parseGoalSettings,
  toCoreMeals,
  toLogsByDate,
  todayKey,
  totalNutrition,
} from './foodModel';
import { MealPicker } from './MealPicker';
import { MonthCalendar } from './MonthCalendar';

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
  const theme = useTheme();
  const { loading, error, data, mealById, reload, logMeal, removeLog, restoreLog } = useFood();
  const showToast = useSnackbar();
  const navigate = useNavigate();
  const [date, setDate] = useState(todayKey);
  const [month, setMonth] = useState(() => dayjs().format(MONTH_KEY));
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  const categoryById = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);
  const dayLogs = useMemo(
    () => data.logs.filter((l) => l.log_date === date && l.kind === 'consumed'),
    [data.logs, date],
  );
  const totals = useMemo(() => totalNutrition(dayLogs, mealById), [dayLogs, mealById]);
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
  const colorForMeal = useCallback(
    (mealId: string) => {
      const meal = mealById.get(mealId);
      return (meal && categoryById.get(meal.category_id)?.color) || theme.palette.secondary.main;
    },
    [mealById, categoryById, theme.palette.secondary.main],
  );

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

  const selectDate = (key: string) => {
    setDate(key);
    setMonth(key.slice(0, 7));
  };

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.1fr) minmax(0, 1fr)' },
        alignItems: 'start',
      }}
    >
      <Stack spacing={2}>
        <MonthCalendar
          month={month}
          selected={date}
          logsByDate={logsByDate}
          colorForMeal={colorForMeal}
          onMonthChange={setMonth}
          onSelect={selectDate}
        />
        <Button
          variant="contained"
          size="large"
          startIcon={<AddRoundedIcon />}
          onClick={() => setPicking(true)}
          disabled={busy}
          sx={{ minHeight: 56, fontSize: 16 }}
        >
          {busy ? 'Saving…' : `Log a meal · ${dateLabel(date)}`}
        </Button>
      </Stack>

      <Stack spacing={2}>
        <Card
          title={dateLabel(date) === dayjs(date).format('ddd D MMM') ? dateLabel(date) : `${dateLabel(date)} · ${dayjs(date).format('D MMM')}`}
          aside={
            <Typography color="text.secondary">
              {dayLogs.length} meal{dayLogs.length === 1 ? '' : 's'}
            </Typography>
          }
        >
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
                    sx={{ gap: 1.5 }}
                    secondaryAction={
                      <IconButton edge="end" aria-label={`Remove ${meal?.name ?? 'meal'}`} onClick={() => void handleRemove(log)} size="large">
                        <DeleteOutlineRoundedIcon />
                      </IconButton>
                    }
                  >
                    <Box
                      aria-hidden
                      sx={{
                        fontSize: 22,
                        width: 42,
                        height: 42,
                        flexShrink: 0,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: '13px',
                        bgcolor: theme.tracker.tonal,
                        boxShadow: `inset 0 0 0 1.5px ${category?.color ?? 'transparent'}55`,
                      }}
                    >
                      {meal?.icon ?? category?.icon}
                    </Box>
                    <ListItemText
                      primary={meal?.name ?? 'Unknown meal'}
                      primaryTypographyProps={{ fontWeight: 600 }}
                      secondary={`${category?.name ?? ''} · ${Math.round(meal?.calories ?? 0)} kcal`}
                    />
                  </ListItem>
                );
              })}
            </List>
          )}
          {dayLogs.length > 0 && (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, mt: 1.5 }}>
              {[
                ['kcal', totals.calories],
                ['protein', totals.protein],
                ['carbs', totals.carbs],
                ['fat', totals.fat],
              ].map(([label, value]) => (
                <Box key={label} sx={{ textAlign: 'center', py: 1, borderRadius: '12px', bgcolor: 'action.hover' }}>
                  <Typography variant="subtitle1" component="div">
                    {Math.round(Number(value))}
                    {label === 'kcal' ? '' : ' g'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
          {dayLogs.length > 0 && (
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              Estimated from catalog nutrition values.
            </Typography>
          )}
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
      </Stack>

      <MealPicker
        open={picking}
        dateLabel={dateLabel(date)}
        meals={data.meals}
        categories={data.categories}
        onClose={() => setPicking(false)}
        onPick={(meal) => void handlePick(meal)}
      />
    </Box>
  );
}

function ProgressRow({ label, count, target }: { label: string; count: number; target: number }) {
  const percent = target > 0 ? Math.min(100, Math.round((count / target) * 100)) : 0;
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
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
      />
    </Box>
  );
}
