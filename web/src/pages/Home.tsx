import InstallMobileRoundedIcon from '@mui/icons-material/InstallMobileRounded';
import { Alert, Box, Button, Chip, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { monthSummary } from '../finance/engine';
import { useFinance } from '../finance/FinanceContext';
import { formatINR } from '../finance/model';
import { reminders as financeReminders, weeklyCap } from '../finance/planner';
import { useFitness } from '../fitness/FitnessContext';
import { dueItemsFor } from '../fitness/RemindersUi';
import { assessGain, gainRate, isoWeekday, weekAdherence, weeklyAverages, weekStart } from '../fitness/rules';
import { useFood } from '../food/FoodContext';
import { todayKey } from '../food/foodModel';
import { goalsHeadline } from '../goals/digest';
import { GoalsDue } from '../goals/GoalsDue';
import { useGoals } from '../goals/GoalsContext';
import { useGoalsOverview } from '../goals/hooks';
import { GlassIcon } from '../layout/GlassIcon';
import { NAV_ITEMS } from '../layout/navItems';
import { useInstall } from '../lib/install';
import { MODES } from '../nutrition/engine';
import { dayTotals } from '../nutrition/foodLog';
import { useNutrition } from '../nutrition/NutritionContext';
import { activeTarget } from '../nutrition/nutritionApi';
import { MODULES } from './ModulePlaceholder';

interface MiniBar {
  label: string;
  value: number;
  max: number;
  text: string;
}
interface Tile {
  path: string;
  title: string;
  chip: string;
  text?: string;
  bars?: MiniBar[];
}

/** Opens a page and scrolls to a card on it once it has rendered. */
function useGoTo() {
  const navigate = useNavigate();
  return (path: string, id?: string) => {
    navigate(path);
    if (!id) return;
    const until = Date.now() + 2500;
    const look = () => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      else if (Date.now() < until) window.setTimeout(look, 120);
    };
    window.setTimeout(look, 150);
  };
}

function Bars({ bars }: { bars: MiniBar[] }) {
  return (
    <Stack spacing={1} sx={{ mt: 1.5 }}>
      {bars.map((b) => {
        const ratio = b.max > 0 ? b.value / b.max : 0;
        return (
          <Box key={b.label}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {b.label}
              </Typography>
              <Typography variant="caption" color={ratio > 1.1 ? 'warning.main' : 'text.secondary'} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {b.text}
              </Typography>
            </Stack>
            <LinearProgress variant="determinate" value={Math.min(100, ratio * 100)} color={ratio > 1.1 ? 'warning' : ratio >= 0.9 ? 'success' : 'primary'} sx={{ height: 6, borderRadius: 3 }} />
          </Box>
        );
      })}
    </Stack>
  );
}

function QuickAction({ emoji, label, onClick }: { emoji: string; label: string; onClick: () => void }) {
  return (
    <Paper
      variant="outlined"
      component={motion.button}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      sx={{ p: 1.25, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, cursor: 'pointer', color: 'inherit', font: 'inherit', borderRadius: '18px', minHeight: 72 }}
    >
      <Box aria-hidden sx={{ fontSize: 24, lineHeight: 1 }}>
        {emoji}
      </Box>
      <Typography variant="caption" sx={{ fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>
        {label}
      </Typography>
    </Paper>
  );
}

function TodayList({ items }: { items: { key: string; emoji: string; title: string; detail: string; onClick: () => void }[] }) {
  if (!items.length) return null;
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: '20px' }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        Due today
      </Typography>
      <Stack spacing={0.75} sx={{ mt: 0.75 }}>
        {items.map((i) => (
          <Box
            key={i.key}
            component="button"
            onClick={i.onClick}
            sx={{ display: 'flex', alignItems: 'center', gap: 1.25, width: '100%', p: 1, border: 0, borderRadius: '14px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', bgcolor: (t) => t.tracker.tonal }}
          >
            <Box aria-hidden sx={{ fontSize: 22 }}>
              {i.emoji}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700 }}>{i.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {i.detail}
              </Typography>
            </Box>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

/** Today across every module: what's due, quick actions, and where each one stands. */
export default function Home() {
  const goTo = useGoTo();
  const food = useFood();
  const fitness = useFitness();
  const nutrition = useNutrition();
  const goals = useGoals();
  const finance = useFinance();
  const overview = useGoalsOverview();
  const { canInstall, install } = useInstall();
  const today = todayKey();

  // ----- due today -----
  const due: { key: string; emoji: string; title: string; detail: string; onClick: () => void }[] = [];
  if (fitness.data) {
    for (const d of dueItemsFor(fitness.data, today)) {
      due.push({ key: `f-${d.key}`, emoji: d.emoji, title: d.title, detail: d.detail, onClick: () => goTo('/fitness', d.key === 'weigh' ? 'weight-card' : d.key === 'waist' ? 'waist-card' : undefined) });
    }
  }
  if (finance.status === 'ready' && finance.doc) {
    for (const r of financeReminders(finance.doc, today)) due.push({ key: `m-${r.key}`, emoji: '💳', title: r.title, detail: r.detail, onClick: () => goTo('/finance/lists') });
  }

  // ----- tiles -----
  const tiles: Tile[] = [];
  {
    const t = nutrition.data ? activeTarget(nutrition.data.targets, today) : null;
    const eaten = nutrition.data ? dayTotals(nutrition.data.entries, today).total : null;
    tiles.push(
      !nutrition.data
        ? { path: '/nutrition', title: MODULES.nutrition.title, chip: nutrition.error ? 'Setup needed' : 'Loading' }
        : t && eaten
          ? {
              path: '/nutrition',
              title: MODULES.nutrition.title,
              chip: `${MODES[t.mode].emoji} ${MODES[t.mode].label}`,
              text: eaten.kcal ? undefined : 'Nothing logged yet today.',
              bars: [
                { label: 'Calories', value: eaten.kcal, max: t.kcal, text: `${Math.round(eaten.kcal)} / ${t.kcal} kcal` },
                { label: 'Protein', value: eaten.protein, max: t.protein_min, text: `${Math.round(eaten.protein)} / ${t.protein_min}–${t.protein_max} g` },
              ],
            }
          : { path: '/nutrition', title: MODULES.nutrition.title, chip: 'Set targets', text: eaten?.kcal ? `Today ${Math.round(eaten.kcal)} kcal` : 'Set your targets to start.' },
    );
  }
  if (fitness.data) {
    const d = fitness.data;
    const weeks = weeklyAverages(d.weighIns, d.away, today, d.settings.weigh_time);
    const week = [...weeks].reverse().find((w) => w.average !== null);
    const verdict = assessGain(gainRate(weeks, d.away, today), d.settings);
    const training = weekAdherence(weekStart(today), d.sessions, d.away);
    const session = d.sessions.find((s) => s.day === today);
    const wd = isoWeekday(today);
    const focus = wd === 7 ? 'Rest day' : d.settings.day_focus[String(wd)] ?? 'Training day';
    tiles.push({
      path: '/fitness',
      title: MODULES.fitness.title,
      chip: verdict.kind === 'insufficient' ? 'Building trend' : verdict.kind === 'on_track' ? '✅ On track' : verdict.kind === 'fast' ? '⚠️ Gaining fast' : '🐢 Slow',
      text: `${week?.average ? `${week.average.toFixed(1)} kg weekly avg` : 'No weigh-ins yet'} · today: ${session?.completed ? `${focus} ✓` : focus}`,
      bars: [{ label: 'Sessions this week', value: training.completed, max: training.eligible || 1, text: `${training.completed} / ${training.eligible}` }],
    });
  } else tiles.push({ path: '/fitness', title: MODULES.fitness.title, chip: fitness.error ? 'Setup needed' : 'Loading' });

  if (finance.status === 'ready' && finance.doc) {
    const m = monthSummary(finance.doc, today.slice(0, 7), today);
    const w = weeklyCap(finance.doc, today);
    const cardFreeLive = !!finance.doc.settings.cardFree && finance.doc.settings.cardFree.from <= today.slice(0, 7);
    const budgetMax = m.budgets.reduce((a, b) => a + b.planned, 0) + m.everyday.planned;
    tiles.push({
      path: '/finance',
      title: MODULES.finance.title,
      chip: 'This month',
      text: `Expected to save ${formatINR(m.savings)}`,
      bars: [
        cardFreeLive && w
          ? { label: 'This week (card-free)', value: w.spent, max: w.cap, text: `${formatINR(w.spent)} / ${formatINR(w.cap)}` }
          : { label: 'Budgets used', value: budgetMax - m.leftInBudgets, max: budgetMax, text: `${formatINR(m.leftInBudgets)} left` },
      ],
    });
  } else {
    tiles.push({
      path: '/finance',
      title: MODULES.finance.title,
      chip: finance.status === 'setup' ? 'Set up' : finance.status === 'locked' ? '🔒 Locked' : finance.status === 'error' ? 'Unavailable' : 'Loading',
      text: finance.status === 'setup' ? 'Encrypted on your devices; starts from your plan.' : finance.status === 'locked' ? 'Unlock to see this month.' : finance.status === 'error' ? finance.error ?? undefined : undefined,
    });
  }

  if (goals.error) tiles.push({ path: '/goals', title: MODULES.goals.title, chip: 'Setup needed' });
  else if (!overview) tiles.push({ path: '/goals', title: MODULES.goals.title, chip: 'Loading' });
  else {
    const h = goalsHeadline(overview.summaries, overview.timeline, today);
    const live = overview.summaries.filter((s) => !s.goal.archived_at && s.goal.cadence !== 'one_off' && s.current);
    const met = live.filter((s) => s.current?.status === 'met').length;
    tiles.push(
      h
        ? { path: '/goals', title: MODULES.goals.title, chip: h.chip, text: h.text, bars: live.length ? [{ label: 'Met this cycle', value: met, max: live.length, text: `${met} / ${live.length}` }] : undefined }
        : { path: '/goals', title: MODULES.goals.title, chip: 'No goals yet', text: 'Start from your plan: training, weigh-ins, food logging and more.' },
    );
  }

  const mealsToday = food.data.logs.filter((l) => l.log_date === today && l.kind === 'consumed' && !l.deleted_at).length;
  tiles.push(
    !food.loading && food.data.meals.length > 0
      ? { path: '/food', title: MODULES.food.title, chip: 'Today', text: `${mealsToday} deliver${mealsToday === 1 ? 'y' : 'ies'} logged today` }
      : { path: '/food', title: MODULES.food.title, chip: food.loading ? 'Loading' : 'Import needed' },
  );

  const actions: { emoji: string; label: string; go: () => void }[] = [
    { emoji: '⚖️', label: 'Weigh in', go: () => goTo('/fitness', 'weight-card') },
    { emoji: '🍛', label: 'Log food', go: () => goTo('/nutrition') },
    { emoji: '🏋️', label: 'Workout', go: () => goTo('/fitness') },
    { emoji: '💸', label: 'Expense', go: () => goTo('/finance') },
  ];

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          {greeting()}
        </Typography>
        <Typography color="text.secondary">{dayjs().format('dddd, D MMMM')}</Typography>
      </Box>

      {canInstall && (
        <Alert
          severity="info"
          icon={<InstallMobileRoundedIcon />}
          action={
            <Button color="inherit" size="small" onClick={() => void install()}>
              Install
            </Button>
          }
        >
          Install Tracker as an app: it opens full screen and works offline.
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
        {actions.map((a) => (
          <QuickAction key={a.label} emoji={a.emoji} label={a.label} onClick={a.go} />
        ))}
      </Box>

      <TodayList items={due} />
      <Box sx={{ '&:empty': { display: 'none' } }}>
        <GoalsDue />
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        {tiles.map((t, i) => (
          <Paper
            key={t.path}
            variant="outlined"
            component={motion.button}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i * 0.06, duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => goTo(t.path)}
            sx={{ p: 2.25, textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit', minHeight: 110, width: '100%' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {(() => {
                const item = NAV_ITEMS.find((n) => n.path === t.path);
                return item ? <GlassIcon icon={item.icon} tint={item.tint} /> : null;
              })()}
              <Typography variant="subtitle1" sx={{ fontWeight: 700, flexGrow: 1 }}>
                {t.title}
              </Typography>
              <Chip size="small" variant="outlined" label={t.chip} />
            </Box>
            {t.text && (
              <Typography color="text.secondary" sx={{ mt: 1.25 }}>
                {t.text}
              </Typography>
            )}
            {t.bars && <Bars bars={t.bars} />}
          </Paper>
        ))}
      </Box>
    </Stack>
  );
}

