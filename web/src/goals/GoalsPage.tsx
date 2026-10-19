import AddRoundedIcon from '@mui/icons-material/AddRounded';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  ListSubheader,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useFitness } from '../fitness/FitnessContext';
import { Card } from '../fitness/ui';
import { useFood } from '../food/FoodContext';
import { useSnackbar } from '../layout/Snackbar';
import { useNutrition } from '../nutrition/NutritionContext';
import {
  CADENCE_LABEL,
  cycleStart,
  METRICS,
  metricOf,
  suggestedGoals,
  summariseGoal,
  validateGoal,
  type Cadence,
  type Cycle,
  type CycleStatus,
  type Goal,
  type GoalContext,
  type GoalInput,
  type GoalSummary,
} from './engine';
import { useGoals } from './GoalsContext';

const KEY = 'YYYY-MM-DD';
const MODULE_LABEL = { fitness: '🏋️ Fitness', nutrition: '🍛 Nutrition', meal_prep: '🚚 Meal prep', any: '✍️ Anything' } as const;
const STATUS: Record<CycleStatus, { label: string; color: string; outline?: boolean }> = {
  met: { label: 'met', color: 'success.main' },
  missed: { label: 'missed', color: 'error.light' },
  in_progress: { label: 'in progress', color: 'primary.main', outline: true },
  away: { label: 'away (not counted)', color: 'text.disabled' },
  partial: { label: 'started mid-cycle (not counted)', color: 'text.disabled', outline: true },
  no_data: { label: 'no data (not counted)', color: 'text.disabled', outline: true },
};

/** Everything a goal can be measured against, from the other modules. */
export function useGoalContext(): GoalContext | null {
  const { data: fitness } = useFitness();
  const { data: nutrition } = useNutrition();
  const food = useFood();
  const { data } = useGoals();
  const today = dayjs().format(KEY);
  return useMemo(
    () =>
      data
        ? {
            today,
            fitness,
            nutrition,
            mealPrepDays: food.error ? null : food.data.logs.filter((l) => !l.deleted_at && l.kind === 'consumed').map((l) => l.log_date),
            checkins: data.checkins,
          }
        : null,
    [data, fitness, nutrition, food.data.logs, food.error, today],
  );
}

const periodName = (cadence: Cadence, start: string, today: string) => {
  if (cadence === 'daily') return start === today ? 'today' : dayjs(start).format('D MMM');
  if (cadence === 'weekly') return start === cycleStart('weekly', today) ? 'this week' : `week of ${dayjs(start).format('D MMM')}`;
  return start === cycleStart('monthly', today) ? 'this month' : dayjs(start).format('MMMM');
};
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

function HistoryDots({ cycles, cadence }: { cycles: Cycle[]; cadence: Cadence }) {
  const shown = cycles.slice(-(cadence === 'daily' ? 14 : 12));
  return (
    <Stack direction="row" spacing={0.5} aria-label="Recent cycles" sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
      {shown.map((c) => {
        const s = STATUS[c.status];
        const when = cadence === 'monthly' ? dayjs(c.start).format('MMM YYYY') : cadence === 'weekly' ? `Week of ${dayjs(c.start).format('D MMM')}` : dayjs(c.start).format('ddd D MMM');
        return (
          <Tooltip key={c.start} title={`${when}: ${c.value === null ? '—' : fmt(c.value)} / ${fmt(c.target)} · ${s.label}`}>
            <Box
              component="span"
              sx={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                bgcolor: s.outline ? 'transparent' : s.color,
                border: 2,
                borderColor: s.color,
                display: 'inline-block',
              }}
            />
          </Tooltip>
        );
      })}
    </Stack>
  );
}

function GoalCard({ s, today, onEdit, onToggleCheckin, busy }: { s: GoalSummary; today: string; onEdit: () => void; onToggleCheckin: () => void; busy: boolean }) {
  const { goal, metric, current } = s;
  const manual = goal.metric === 'manual';
  const fixed = metric?.fixedTarget !== undefined;
  let body: React.ReactNode;
  if (!metric) {
    body = <Typography color="text.secondary">This goal measures something this version of the app doesn’t know.</Typography>;
  } else if (goal.cadence === 'one_off') {
    const target = goal.versions[goal.versions.length - 1].target;
    body = s.achievedOn ? (
      <Typography sx={{ fontWeight: 600 }}>✅ Reached {dayjs(s.achievedOn).format('D MMM YYYY')}</Typography>
    ) : manual ? (
      <Typography color="text.secondary">Not done yet.</Typography>
    ) : (
      <Box>
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          {s.progress === null ? 'No data yet' : `${fmt(s.progress)} / ${fmt(target)} ${metric.unit}`}
        </Typography>
        {s.progress !== null && metric.direction === 'up' && goal.params.direction !== 'down' && (
          <LinearProgress variant="determinate" value={Math.min(100, (s.progress / target) * 100)} sx={{ height: 8, borderRadius: 4 }} />
        )}
      </Box>
    );
  } else {
    const label = current ? periodName(goal.cadence, current.start, today) : '';
    body = (
      <Stack spacing={1}>
        {current && !fixed && goal.cadence === 'daily' && current.target === 1 && (
          <Typography variant="body2">{current.status === 'met' ? '✅ Done today' : current.value === null ? 'Nothing recorded yet today' : 'Not yet today'}</Typography>
        )}
        {current && !fixed && !(goal.cadence === 'daily' && current.target === 1) && (
          <Box>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              {current.value === null ? `No data ${label}` : `${fmt(current.value)} / ${fmt(current.target)} ${metric.unit} ${label}`}
            </Typography>
            <LinearProgress
              variant="determinate"
              color={current.status === 'met' ? 'success' : 'primary'}
              value={current.value === null ? 0 : Math.min(100, (current.value / current.target) * 100)}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        )}
        {current && fixed && !manual && (
          <Typography variant="body2">{current.value === null ? `Not enough data yet ${label}` : current.value >= 1 ? `On track so far ${label}` : `Outside the band so far ${label}`}</Typography>
        )}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
          <HistoryDots cycles={s.cycles} cadence={goal.cadence} />
          <Box sx={{ flexGrow: 1 }} />
          {s.streak > 0 && <Chip size="small" label={`🔥 ${s.streak}`} />}
          <Typography variant="caption" color="text.secondary">
            {s.met} met{s.missed ? ` · ${s.missed} missed` : ''}
            {s.best > 1 ? ` · best run ${s.best}` : ''}
          </Typography>
        </Stack>
      </Stack>
    );
  }
  const checked = manual && (goal.cadence === 'one_off' ? !!s.achievedOn : current?.status === 'met');

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1.25 }}>
        <Typography component="span" sx={{ fontSize: 24, lineHeight: 1.2 }} aria-hidden>
          {goal.emoji ?? '🎯'}
        </Typography>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" component="h2" sx={{ lineHeight: 1.3 }}>
            {goal.title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {CADENCE_LABEL[goal.cadence]} · {metric?.label ?? goal.metric}
            {goal.ends_on ? ` · until ${dayjs(goal.ends_on).format('D MMM YYYY')}` : ''}
          </Typography>
        </Box>
        {manual && (goal.cadence !== 'one_off' ? current : true) && (
          <Checkbox
            checked={checked}
            disabled={busy || (goal.cadence !== 'one_off' && current?.end !== undefined && current.end < today)}
            onChange={onToggleCheckin}
            inputProps={{ 'aria-label': checked ? 'Undo check-in' : 'Check in' }}
          />
        )}
        <Button size="small" onClick={onEdit}>
          Edit
        </Button>
      </Stack>
      {body}
    </Paper>
  );
}

const blank = (today: string): GoalInput => ({ title: '', emoji: null, metric: 'fitness.sessions', params: {}, cadence: 'weekly', target: 6, starts_on: today, ends_on: null });
const autoTitle = (g: GoalInput, liftLabel?: string) => {
  const m = metricOf(g.metric);
  if (!m) return '';
  if (g.metric === 'manual') return '';
  if (g.metric === 'fitness.lift_reach') return `${liftLabel ?? 'Lift'} ${fmt(g.target)} kg`;
  if (g.metric === 'fitness.weight_reach') return `Weekly average ${g.params.direction === 'down' ? 'down to' : 'up to'} ${fmt(g.target)} kg`;
  if (m.fixedTarget !== undefined) return m.label;
  return `${m.label}: ${fmt(g.target)} ${CADENCE_LABEL[g.cadence].toLowerCase()}`;
};

function GoalDialog({ goal, onClose, ctx }: { goal: Goal | 'new'; onClose: () => void; ctx: GoalContext }) {
  const goals = useGoals();
  const toast = useSnackbar();
  const isNew = goal === 'new';
  const lifts = ctx.fitness?.settings.key_lifts ?? [];
  const [form, setForm] = useState<GoalInput>(() =>
    isNew
      ? blank(ctx.today)
      : { title: goal.title, emoji: goal.emoji, metric: goal.metric, params: goal.params, cadence: goal.cadence, target: goal.versions[goal.versions.length - 1].target, starts_on: goal.starts_on, ends_on: goal.ends_on },
  );
  const [titleTouched, setTitleTouched] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const metric = metricOf(form.metric);
  const set = (patch: Partial<GoalInput>) =>
    setForm((f) => {
      const next = { ...f, ...patch };
      const m = metricOf(next.metric);
      if (m && !m.cadences.includes(next.cadence)) next.cadence = m.cadences[0];
      if (m?.fixedTarget !== undefined) next.target = m.fixedTarget;
      if (next.metric === 'fitness.lift_reach' && !next.params.lift && lifts[0]) next.params = { ...next.params, lift: lifts[0].label };
      if (!titleTouched) next.title = autoTitle(next, String(next.params.lift ?? ''));
      return next;
    });
  const error = validateGoal(form, ctx);

  const save = async () => {
    setSaving(true);
    try {
      if (isNew) {
        await goals.addGoals([
          {
            title: form.title.trim(),
            emoji: form.emoji?.trim() || null,
            metric: form.metric,
            params: form.params,
            cadence: form.cadence,
            versions: [{ from: form.starts_on, target: form.target }],
            starts_on: form.starts_on,
            ends_on: form.ends_on,
            sort_order: (goals.data?.goals.length ?? 0) + 1,
          },
        ]);
        toast('🎯 Goal added');
      } else {
        const last = goal.versions[goal.versions.length - 1];
        const versions =
          last.target === form.target ? goal.versions : last.from >= ctx.today ? [...goal.versions.slice(0, -1), { from: last.from, target: form.target }] : [...goal.versions, { from: ctx.today, target: form.target }];
        await goals.updateGoal(goal.id, { title: form.title.trim(), emoji: form.emoji?.trim() || null, params: form.params, versions, ends_on: form.ends_on });
        toast('Goal saved');
      }
      onClose();
    } catch (e) {
      toast(`Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    } finally {
      setSaving(false);
    }
  };
  const archive = async (on: boolean) => {
    if (isNew) return;
    setSaving(true);
    try {
      await goals.updateGoal(goal.id, { archived_at: on ? new Date().toISOString() : null });
      toast(on ? 'Goal archived; its history is kept' : 'Goal restored', on ? { action: { label: 'Undo', run: () => void goals.updateGoal(goal.id, { archived_at: null }) } } : undefined);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const grouped = (['fitness', 'nutrition', 'meal_prep', 'any'] as const).flatMap((mod) => [
    <ListSubheader key={mod}>{MODULE_LABEL[mod]}</ListSubheader>,
    ...METRICS.filter((m) => m.module === mod).map((m) => (
      <MenuItem key={m.key} value={m.key}>
        {m.label}
      </MenuItem>
    )),
  ]);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{isNew ? 'New goal' : 'Edit goal'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField select label="Measure" value={form.metric} onChange={(e) => set({ metric: e.target.value, params: {} })} disabled={!isNew} helperText={metric?.hint}>
            {grouped}
          </TextField>
          {isNew && metric && metric.cadences.length > 1 && (
            <ToggleButtonGroup exclusive size="small" value={form.cadence} onChange={(_, v: Cadence | null) => v && set({ cadence: v })} aria-label="How often">
              {metric.cadences.map((c) => (
                <ToggleButton key={c} value={c} sx={{ textTransform: 'none', px: 2 }}>
                  {CADENCE_LABEL[c]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}
          {form.metric === 'fitness.lift_reach' && (
            <TextField select label="Key lift" value={String(form.params.lift ?? '')} onChange={(e) => set({ params: { lift: e.target.value } })} disabled={!isNew}>
              {lifts.map((l) => (
                <MenuItem key={l.label} value={l.label}>
                  {l.label}
                </MenuItem>
              ))}
            </TextField>
          )}
          {form.metric === 'fitness.weight_reach' && isNew && (
            <ToggleButtonGroup exclusive size="small" value={form.params.direction === 'down' ? 'down' : 'up'} onChange={(_, v: string | null) => v && set({ params: { direction: v } })} aria-label="Direction">
              <ToggleButton value="up" sx={{ textTransform: 'none', px: 2 }}>
                Up to (bulk)
              </ToggleButton>
              <ToggleButton value="down" sx={{ textTransform: 'none', px: 2 }}>
                Down to (cut)
              </ToggleButton>
            </ToggleButtonGroup>
          )}
          {metric?.fixedTarget === undefined && (
            <TextField
              label={`Target${metric?.unit ? ` (${metric.unit})` : ''}`}
              type="number"
              value={Number.isNaN(form.target) ? '' : form.target}
              onChange={(e) => set({ target: e.target.value === '' ? NaN : Number(e.target.value) })}
              inputProps={{ inputMode: 'decimal', step: form.metric.endsWith('_reach') ? 0.5 : 1, min: 0 }}
              helperText={!isNew ? 'A new target applies from today; earlier cycles keep theirs.' : undefined}
            />
          )}
          <TextField
            label="Name"
            value={form.title}
            onChange={(e) => {
              setTitleTouched(true);
              setForm((f) => ({ ...f, title: e.target.value }));
            }}
          />
          <Stack direction="row" spacing={1}>
            <TextField label="Emoji" value={form.emoji ?? ''} onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))} sx={{ width: 96 }} inputProps={{ maxLength: 8 }} />
            <TextField
              label="Starts"
              type="date"
              value={form.starts_on}
              onChange={(e) => setForm((f) => ({ ...f, starts_on: e.target.value }))}
              disabled={!isNew}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>
          <TextField
            label="Ends (optional)"
            type="date"
            value={form.ends_on ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, ends_on: e.target.value || null }))}
            InputLabelProps={{ shrink: true }}
          />
          {error && form.title && <Alert severity="warning">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        {!isNew && (
          <Button color="inherit" onClick={() => void archive(!goal.archived_at)} disabled={saving} sx={{ mr: 'auto' }}>
            {goal.archived_at ? 'Restore' : 'Archive'}
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!!error || saving} onClick={() => void save()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Suggestions({ ctx, existing }: { ctx: GoalContext; existing: Goal[] }) {
  const goals = useGoals();
  const toast = useSnackbar();
  const all = suggestedGoals(ctx.fitness, ctx.today).filter((s) => !existing.some((g) => !g.archived_at && g.metric === s.metric && g.cadence === s.cadence));
  const [picked, setPicked] = useState<Set<string>>(() => new Set(all.map((s) => s.title)));
  const [saving, setSaving] = useState(false);
  if (!all.length) return null;
  const add = async () => {
    setSaving(true);
    try {
      const rows = all.filter((s) => picked.has(s.title));
      await goals.addGoals(
        rows.map((s, i) => ({
          title: s.title,
          emoji: s.emoji,
          metric: s.metric,
          params: s.params,
          cadence: s.cadence,
          versions: [{ from: s.starts_on, target: s.target }],
          starts_on: s.starts_on,
          ends_on: null,
          sort_order: existing.length + i + 1,
        })),
      );
      toast(`🎯 Added ${rows.length} goal${rows.length === 1 ? '' : 's'}`);
    } catch (e) {
      toast(`Not added: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card title={existing.length ? '💡 More from your plan' : '💡 Start from your plan'}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Built from your reference routine and settings. They count from your phase start ({dayjs(all[0].starts_on).format('D MMM YYYY')}), using what you’ve already logged. Check-in goals, like photos, you tick yourself.
      </Typography>
      <Stack>
        {all.map((s) => (
          <Box key={s.title} component="label" sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}>
            <Checkbox
              size="small"
              checked={picked.has(s.title)}
              onChange={(e) => setPicked((p) => {
                const n = new Set(p);
                if (e.target.checked) n.add(s.title);
                else n.delete(s.title);
                return n;
              })}
            />
            <Typography variant="body2" sx={{ flexGrow: 1 }}>
              {s.emoji} {s.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {CADENCE_LABEL[s.cadence]}
            </Typography>
          </Box>
        ))}
      </Stack>
      <Button variant="contained" sx={{ mt: 1 }} disabled={!picked.size || saving} onClick={() => void add()}>
        Add {picked.size} goal{picked.size === 1 ? '' : 's'}
      </Button>
    </Card>
  );
}

/** Your goals, measured from the data the other modules hold. */
export default function GoalsPage() {
  const goals = useGoals();
  const ctx = useGoalContext();
  const toast = useSnackbar();
  const [editing, setEditing] = useState<Goal | 'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const summaries = useMemo(() => (ctx && goals.data ? goals.data.goals.map((g) => summariseGoal(g, ctx)) : []), [ctx, goals.data]);

  if (goals.error) {
    return (
      <Alert severity="error" action={<Button color="inherit" onClick={() => void goals.reload()}>Retry</Button>}>
        {goals.error}
        {/(relation|table).*(goals|goal_checkins|milestones)/.test(goals.error) && ' — run supabase/migrations/0014_goals.sql in the Supabase SQL Editor, then Retry.'}
      </Alert>
    );
  }
  if (!ctx || !goals.data) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
        <CircularProgress aria-label="Loading goals" />
      </Box>
    );
  }

  const live = summaries.filter((s) => !s.goal.archived_at);
  const archived = summaries.filter((s) => s.goal.archived_at);
  const toggle = async (s: GoalSummary) => {
    const g = s.goal;
    const period = g.cadence === 'one_off' ? ctx.today : cycleStart(g.cadence, ctx.today);
    const existing = goals.data!.checkins.find((c) => c.goal_id === g.id && (g.cadence === 'one_off' ? true : c.period_start === period));
    setBusy(g.id);
    try {
      if (existing) {
        await goals.removeCheckin(existing.id);
        toast('Check-in removed');
      } else {
        await goals.addCheckin(g.id, period);
        toast(`✅ ${g.title}`);
      }
    } catch (e) {
      toast(`Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Stack spacing={2} sx={{ maxWidth: 860 }}>
      <Stack direction="row" alignItems="center">
        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
          Measured from what you log. Away days and partial first cycles don’t count against you.
        </Typography>
        <Button startIcon={<AddRoundedIcon />} variant="contained" onClick={() => setEditing('new')}>
          New
        </Button>
      </Stack>

      {live.map((s, i) => (
        <motion.div key={s.goal.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03, duration: 0.2 }}>
          <GoalCard s={s} today={ctx.today} onEdit={() => setEditing(s.goal)} onToggleCheckin={() => void toggle(s)} busy={busy === s.goal.id} />
        </motion.div>
      ))}

      <Suggestions ctx={ctx} existing={goals.data.goals} />

      {archived.length > 0 && (
        <Box>
          <Button size="small" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
          </Button>
          {showArchived && (
            <Stack spacing={1.5} sx={{ mt: 1, opacity: 0.8 }}>
              {archived.map((s) => (
                <GoalCard key={s.goal.id} s={s} today={ctx.today} onEdit={() => setEditing(s.goal)} onToggleCheckin={() => undefined} busy />
              ))}
            </Stack>
          )}
        </Box>
      )}

      {editing && <GoalDialog goal={editing} ctx={ctx} onClose={() => setEditing(null)} />}
    </Stack>
  );
}
