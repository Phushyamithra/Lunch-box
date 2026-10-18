import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from '../layout/Snackbar';
import { capColor, capLabel } from './capLabels';
import { useFood } from './FoodContext';
import { DATE_KEY, todayKey } from './foodModel';
import { itemUsage, logsInPlan, quotaProgress, type PlanRow, type PlanState } from './plans';
import { Stepper } from './Stepper';

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography variant="subtitle1" component="h2" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>
        {aside}
      </Box>
      {children}
    </Paper>
  );
}

export default function PlanPage() {
  const navigate = useNavigate();
  const { data, activePlan, stateOf } = useFood();
  const history = useMemo(
    () => data.plans.filter((p) => p.completed_at).sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')),
    [data.plans],
  );

  return (
    <Stack spacing={2} sx={{ maxWidth: 760 }}>
      <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/food')} sx={{ alignSelf: 'flex-start' }}>
        Back to Food
      </Button>
      {activePlan ? <ActivePlan state={activePlan} /> : <NewPlanForm previous={history[0] ? stateOf(history[0]) : null} />}
      {history.length > 0 && (
        <Section title="Past plans">
          <Stack spacing={1.5}>
            {history.map((plan) => (
              <PastPlan key={plan.id} state={stateOf(plan)} />
            ))}
          </Stack>
        </Section>
      )}
    </Stack>
  );
}

// ---------- Active plan ----------

function ActivePlan({ state }: { state: PlanState }) {
  const { data, categoryOf, completePlan, setDefaultCap, setMealCap, setQuotaQuantity } = useFood();
  const showToast = useSnackbar();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const categoryById = new Map(data.categories.map((c) => [c.id, c]));
  const quotas = quotaProgress(state, data.logs, categoryOf);
  const planLogs = logsInPlan(state.plan.id, data.logs);
  const overrides = planLogs.filter((l) => l.cap_override).length;

  const run = async (action: () => Promise<void>, done?: string) => {
    setBusy(true);
    try {
      await action();
      if (done) showToast(done);
    } catch (e) {
      showToast(`Not saved: ${e instanceof Error ? e.message : 'unknown error'}`, { severity: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const quotaCategories = new Set(state.quotas.map((q) => q.category_id));
  const items = data.meals
    .filter((m) => quotaCategories.has(m.category_id) && (!m.archived_at || planLogs.some((l) => l.meal_id === m.id)))
    .map((m) => ({ meal: m, usage: itemUsage(state, m.id, data.logs), custom: state.caps.find((c) => c.meal_id === m.id) }))
    .sort((a, b) => (a.usage.remaining ?? 999) - (b.usage.remaining ?? 999) || a.meal.name.localeCompare(b.meal.name));

  return (
    <>
      <Section
        title={state.plan.name}
        aside={<Chip size="small" color="secondary" label={`since ${dayjs(state.plan.started_on).format('D MMM')}`} />}
      >
        <Stack spacing={2}>
          {quotas.map((q) => {
            const quota = state.quotas.find((x) => x.category_id === q.categoryId);
            const category = categoryById.get(q.categoryId);
            return (
              <Box key={q.categoryId}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                  <Typography sx={{ fontWeight: 600, flexGrow: 1 }}>
                    {category?.icon} {category?.name}
                  </Typography>
                  <Typography color="text.secondary">
                    {q.used} of {q.quantity} · {q.remaining} left
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, (q.used / q.quantity) * 100)}
                  color="secondary"
                  aria-label={`${category?.name}: ${q.used} of ${q.quantity}`}
                />
                {quota && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                      Quantity in this plan
                    </Typography>
                    <Stepper
                      label={`${category?.name} quantity`}
                      value={quota.quantity}
                      min={Math.max(1, q.used)}
                      disabled={busy}
                      onChange={(v) => void run(() => setQuotaQuantity(quota, v))}
                    />
                  </Box>
                )}
              </Box>
            );
          })}
          {overrides > 0 && (
            <Alert severity="warning">
              {overrides} meal{overrides === 1 ? ' was' : 's were'} logged past a limit in this plan (recorded overrides).
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary">
            The plan completes by itself when every quota is used up.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<FlagRoundedIcon />}
            disabled={busy}
            onClick={() => setConfirming(true)}
            sx={{ alignSelf: 'flex-start' }}
          >
            Complete plan now
          </Button>
        </Stack>
      </Section>

      <Section title="Item caps">
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography sx={{ fontWeight: 600 }}>Default cap per item</Typography>
              <Typography variant="body2" color="text.secondary">
                Applies to every item unless you set its own cap below.
              </Typography>
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={state.plan.default_item_cap !== null}
                  disabled={busy}
                  onChange={(e) => void run(() => setDefaultCap(state.plan, e.target.checked ? 4 : null))}
                />
              }
              label={state.plan.default_item_cap === null ? 'No cap' : 'Capped'}
            />
            {state.plan.default_item_cap !== null && (
              <Stepper
                label="default cap"
                value={state.plan.default_item_cap}
                disabled={busy}
                onChange={(v) => void run(() => setDefaultCap(state.plan, v))}
              />
            )}
          </Box>

          <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />} spacing={1.25}>
            {items.map(({ meal, usage, custom }) => (
              <Box key={meal.id} sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ flex: '1 1 180px', minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }} noWrap>
                    {meal.icon ?? categoryById.get(meal.category_id)?.icon} {meal.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {usage.used} of {usage.cap ?? '∞'} used · {custom ? 'own cap' : 'default cap'}
                  </Typography>
                </Box>
                <Chip size="small" color={capColor(usage.status)} label={capLabel(usage)} />
                {(custom || state.plan.default_item_cap !== null) && (
                  <Stepper
                    label={`${meal.name} cap`}
                    value={usage.cap ?? 0}
                    disabled={busy}
                    onChange={(v) => void run(() => setMealCap(state.plan, meal.id, v))}
                  />
                )}
                {custom ? (
                  <Button size="small" disabled={busy} onClick={() => void run(() => setMealCap(state.plan, meal.id, null), `${meal.name} uses the default cap again`)}>
                    Use default
                  </Button>
                ) : (
                  state.plan.default_item_cap === null && (
                    <Button size="small" disabled={busy} onClick={() => void run(() => setMealCap(state.plan, meal.id, 4))}>
                      Set a cap
                    </Button>
                  )
                )}
              </Box>
            ))}
            {items.length === 0 && <Typography color="text.secondary">No meals in this plan's categories yet.</Typography>}
          </Stack>
        </Stack>
      </Section>

      <Dialog open={confirming} onClose={() => setConfirming(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Complete this plan now?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            {quotas.map((q) => `${categoryById.get(q.categoryId)?.name}: ${q.used} of ${q.quantity}`).join(' · ')}. The
            plan and all its meals stay in your history. Item counts start fresh in your next plan.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirming(false)}>Keep going</Button>
          <Button
            variant="contained"
            onClick={() => {
              setConfirming(false);
              void run(() => completePlan(state.plan), 'Plan completed');
            }}
          >
            Complete plan
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ---------- New plan ----------

function NewPlanForm({ previous }: { previous: PlanState | null }) {
  const { data, startPlan } = useFood();
  const showToast = useSnackbar();
  const enabled = data.categories.filter((c) => c.enabled);
  const [name, setName] = useState(`Plan from ${dayjs().format('D MMM')}`);
  const [startedOn, setStartedOn] = useState(todayKey());
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(enabled.map((c) => [c.id, previous?.quotas.find((q) => q.category_id === c.id)?.quantity ?? 0])),
  );
  const [capOn, setCapOn] = useState(previous ? previous.plan.default_item_cap !== null : true);
  const [cap, setCap] = useState(previous?.plan.default_item_cap ?? 4);
  const [keepCustom, setKeepCustom] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const customCaps = previous?.caps ?? [];

  const handleStart = async () => {
    const quotas = Object.entries(quantities)
      .filter(([, q]) => q > 0)
      .map(([categoryId, quantity]) => ({ categoryId, quantity }));
    if (!name.trim()) return setError('Give the plan a name.');
    if (quotas.length === 0) return setError('Set a quantity for at least one category.');
    if (!dayjs(startedOn, DATE_KEY, true).isValid()) return setError('Choose a valid start date.');
    setBusy(true);
    setError(null);
    try {
      await startPlan({
        name,
        startedOn,
        defaultItemCap: capOn ? cap : null,
        quotas,
        caps: keepCustom ? customCaps.map((c) => ({ mealId: c.meal_id, cap: c.cap })) : [],
      });
      showToast('Plan started');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the plan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title={previous ? 'Start your next plan' : 'Set up a meal plan'}>
      <Stack spacing={2}>
        <Typography color="text.secondary">
          A plan is the set of meals you've ordered, for example 20 salads and 20 sandwiches. It completes when every
          quantity is used up, and you can complete it early.
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, gap: 1.5 }}>
          <TextField label="Plan name" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField
            label="Starts on"
            type="date"
            value={startedOn}
            onChange={(e) => setStartedOn(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Box>
        <Typography sx={{ fontWeight: 600 }}>How many of each?</Typography>
        <Stack spacing={1}>
          {enabled.map((c) => (
            <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ flexGrow: 1 }}>
                {c.icon} {c.name}
              </Typography>
              <TextField
                size="small"
                inputMode="numeric"
                value={quantities[c.id] ?? 0}
                onChange={(e) => {
                  const v = Number(e.target.value.replace(/\D/g, '').slice(0, 3) || 0);
                  setQuantities((q) => ({ ...q, [c.id]: v }));
                }}
                inputProps={{ 'aria-label': `${c.name} quantity`, style: { textAlign: 'center', width: 56 } }}
              />
            </Box>
          ))}
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Leave a category at 0 to keep it out of the plan.
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <FormControlLabel
            control={<Switch checked={capOn} onChange={(e) => setCapOn(e.target.checked)} />}
            label="Cap each item"
            sx={{ flexGrow: 1 }}
          />
          {capOn && <Stepper label="cap per item" value={cap} min={1} onChange={setCap} />}
        </Box>
        {customCaps.length > 0 && (
          <FormControlLabel
            control={<Switch checked={keepCustom} onChange={(e) => setKeepCustom(e.target.checked)} />}
            label={`Keep ${customCaps.length} item-specific cap${customCaps.length === 1 ? '' : 's'} from the last plan`}
          />
        )}
        {error && <Alert severity="error">{error}</Alert>}
        <Button variant="contained" size="large" disabled={busy} onClick={() => void handleStart()} sx={{ alignSelf: 'flex-start' }}>
          {busy ? 'Starting…' : 'Start plan'}
        </Button>
      </Stack>
    </Section>
  );
}

// ---------- History ----------

function PastPlan({ state }: { state: PlanState }) {
  const { data, categoryOf } = useFood();
  const categoryById = new Map(data.categories.map((c) => [c.id, c]));
  const quotas = quotaProgress(state, data.logs, categoryOf);
  const overrides = logsInPlan(state.plan.id, data.logs).filter((l) => l.cap_override).length;
  const plan: PlanRow = state.plan;
  return (
    <Box sx={{ p: 1.5, borderRadius: '16px', bgcolor: 'action.hover' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontWeight: 600, flexGrow: 1 }}>{plan.name}</Typography>
        <Chip
          size="small"
          color={plan.completion === 'quota_met' ? 'success' : 'default'}
          label={plan.completion === 'quota_met' ? 'Completed' : 'Completed early'}
        />
      </Box>
      <Typography variant="body2" color="text.secondary">
        {dayjs(plan.started_on).format('D MMM YYYY')} – {dayjs(plan.completed_at).format('D MMM YYYY')} ·{' '}
        {quotas.map((q) => `${categoryById.get(q.categoryId)?.name} ${q.used}/${q.quantity}`).join(' · ')}
        {overrides > 0 && ` · ${overrides} override${overrides === 1 ? '' : 's'}`}
      </Typography>
    </Box>
  );
}
