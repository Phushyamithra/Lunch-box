import AddRoundedIcon from '@mui/icons-material/AddRounded';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { Card } from '../fitness/ui';
import { useFood } from '../food/FoodContext';
import { useSnackbar } from '../layout/Snackbar';
import { summariseGoal } from './engine';
import { useGoals } from './GoalsContext';
import { useGoalContext } from './hooks';
import { buildTimeline, phaseCheckpoints, splitTimeline, validateMilestone, type ItemKind, type ItemStatus, type Milestone, type MilestoneInput, type TimelineItem } from './timeline';

type Filter = 'all' | 'plan' | 'wins';
const PLAN_KINDS: ItemKind[] = ['checkpoint', 'review', 'waist'];
const STATUS: Record<ItemStatus, { label: string | null; color: string }> = {
  done: { label: null, color: 'success.main' },
  due: { label: 'due soon', color: 'warning.main' },
  upcoming: { label: null, color: 'primary.main' },
  past: { label: 'not marked done', color: 'text.disabled' },
  info: { label: null, color: 'text.secondary' },
};
const dateLabel = (i: Pick<TimelineItem, 'date' | 'approx'>) => (i.approx ? `~${dayjs(i.date).format('MMM YYYY')}` : dayjs(i.date).format('ddd D MMM YYYY'));

function Row({ item, onOpen, last }: { item: TimelineItem; onOpen?: () => void; last: boolean }) {
  const s = STATUS[item.status];
  const hollow = item.status === 'upcoming' || item.status === 'past';
  return (
    <Box
      component={onOpen ? 'button' : 'div'}
      onClick={onOpen}
      sx={{ display: 'flex', gap: 1.5, width: '100%', textAlign: 'left', border: 0, bgcolor: 'transparent', color: 'inherit', font: 'inherit', p: 0, cursor: onOpen ? 'pointer' : 'default' }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 0.75 }}>
        <Box sx={{ width: 12, height: 12, borderRadius: '50%', border: 2, borderColor: s.color, bgcolor: hollow ? 'transparent' : s.color, flexShrink: 0 }} />
        {!last && <Box sx={{ width: 2, flexGrow: 1, bgcolor: 'divider', mt: 0.5 }} />}
      </Box>
      <Box sx={{ pb: last ? 0 : 2, minWidth: 0, flexGrow: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {dateLabel(item)}
          {s.label && (
            <Typography component="span" variant="caption" sx={{ color: s.color, fontWeight: 600 }}>
              {' '}
              · {s.label}
            </Typography>
          )}
        </Typography>
        <Typography sx={{ fontWeight: 600, lineHeight: 1.35 }}>
          <span aria-hidden>{item.emoji}</span> {item.title}
        </Typography>
        {item.detail && (
          <Typography variant="body2" color="text.secondary">
            {item.detail}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function Section({ title, items, onOpen, limit }: { title: string; items: TimelineItem[]; onOpen: (m: Milestone) => void; limit?: number }) {
  const [all, setAll] = useState(false);
  const shown = limit && !all ? items.slice(0, limit) : items;
  return (
    <Card title={title}>
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Nothing here yet.
        </Typography>
      ) : (
        <Box>
          {shown.map((i, n) => (
            <motion.div key={i.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(n, 10) * 0.025, duration: 0.18 }}>
              <Row item={i} last={n === shown.length - 1} onOpen={i.milestone ? () => onOpen(i.milestone as Milestone) : undefined} />
            </motion.div>
          ))}
          {limit && items.length > limit && (
            <Button size="small" onClick={() => setAll((v) => !v)} sx={{ mt: 1 }}>
              {all ? 'Show less' : `Show all ${items.length}`}
            </Button>
          )}
        </Box>
      )}
    </Card>
  );
}

const blank = (today: string): MilestoneInput => ({ title: '', emoji: null, notes: null, due_on: today, approx: false, done_on: null, kind: 'checkpoint', source: 'user' });

function MilestoneDialog({ milestone, today, onClose }: { milestone: Milestone | 'new'; today: string; onClose: () => void }) {
  const goals = useGoals();
  const toast = useSnackbar();
  const isNew = milestone === 'new';
  const [form, setForm] = useState<MilestoneInput>(() =>
    isNew
      ? blank(today)
      : { title: milestone.title, emoji: milestone.emoji, notes: milestone.notes, due_on: milestone.due_on, approx: milestone.approx, done_on: milestone.done_on, kind: milestone.kind, source: milestone.source },
  );
  const [saving, setSaving] = useState(false);
  const clean: MilestoneInput = {
    ...form,
    title: form.title.trim(),
    emoji: form.emoji?.trim() || null,
    notes: form.notes?.trim() || null,
    // An achievement is something that happened: its date is the done date.
    due_on: form.kind === 'achievement' ? null : form.due_on,
    done_on: form.kind === 'achievement' ? form.done_on ?? form.due_on ?? today : form.done_on,
    approx: form.kind === 'achievement' ? false : form.approx,
  };
  const error = validateMilestone(clean);

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setSaving(true);
    try {
      await fn();
      toast(message);
      onClose();
    } catch (e) {
      toast(`Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    } finally {
      setSaving(false);
    }
  };
  const save = () => run(() => (isNew ? goals.addMilestones([clean]) : goals.updateMilestone(milestone.id, clean)), isNew ? '📍 Added to your timeline' : 'Saved');

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{isNew ? 'Add to timeline' : 'Edit milestone'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <ToggleButtonGroup exclusive size="small" value={form.kind} onChange={(_, v: Milestone['kind'] | null) => v && setForm((f) => ({ ...f, kind: v }))} aria-label="Kind">
            <ToggleButton value="checkpoint" sx={{ textTransform: 'none', px: 2 }}>
              📍 Checkpoint
            </ToggleButton>
            <ToggleButton value="achievement" sx={{ textTransform: 'none', px: 2 }}>
              🏅 Achievement
            </ToggleButton>
          </ToggleButtonGroup>
          <TextField label="Name" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} autoFocus={isNew} />
          <Stack direction="row" spacing={1}>
            <TextField label="Emoji" value={form.emoji ?? ''} onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))} sx={{ width: 96 }} inputProps={{ maxLength: 8 }} />
            {form.kind === 'checkpoint' ? (
              <TextField label="Planned for" type="date" value={form.due_on ?? ''} onChange={(e) => setForm((f) => ({ ...f, due_on: e.target.value || null }))} InputLabelProps={{ shrink: true }} fullWidth />
            ) : (
              <TextField label="When" type="date" value={form.done_on ?? form.due_on ?? ''} onChange={(e) => setForm((f) => ({ ...f, done_on: e.target.value || null }))} InputLabelProps={{ shrink: true }} fullWidth />
            )}
          </Stack>
          {form.kind === 'checkpoint' && (
            <>
              <FormControlLabel control={<Switch checked={form.approx} onChange={(e) => setForm((f) => ({ ...f, approx: e.target.checked }))} />} label="Approximate (show the month only)" />
              <Stack direction="row" spacing={1} alignItems="center">
                <FormControlLabel
                  control={<Switch checked={!!form.done_on} onChange={(e) => setForm((f) => ({ ...f, done_on: e.target.checked ? (f.due_on && f.due_on <= today ? f.due_on : today) : null }))} />}
                  label="Done"
                />
                {form.done_on && (
                  <TextField size="small" label="Done on" type="date" value={form.done_on} onChange={(e) => setForm((f) => ({ ...f, done_on: e.target.value || null }))} InputLabelProps={{ shrink: true }} />
                )}
              </Stack>
            </>
          )}
          <TextField label="Notes" value={form.notes ?? ''} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} multiline minRows={2} />
          {error && form.title && <Typography color="warning.main" variant="body2">{error}</Typography>}
        </Stack>
      </DialogContent>
      <DialogActions>
        {!isNew && (
          <Button
            color="inherit"
            sx={{ mr: 'auto' }}
            disabled={saving}
            onClick={() => void run(() => goals.updateMilestone(milestone.id, { archived_at: new Date().toISOString() }), 'Removed from the timeline')}
          >
            Remove
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

function PhaseSetup({ today }: { today: string }) {
  const goals = useGoals();
  const ctx = useGoalContext();
  const toast = useSnackbar();
  const [saving, setSaving] = useState(false);
  if (!ctx?.fitness) return null;
  const list = phaseCheckpoints(ctx.fitness);
  const add = async () => {
    setSaving(true);
    try {
      await goals.addMilestones(list);
      toast('📍 Phase checkpoints added');
    } catch (e) {
      toast(`Not added: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card title="🧭 Lay out your phase">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        From your phase start ({dayjs(ctx.fitness.settings.phase_start).format('D MMM YYYY')}) and length ({ctx.fitness.settings.phase_months} months) in Fitness settings. You can edit or remove any of them.
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 1.5 }}>
        {list.map((m) => (
          <li key={m.title}>
            <Typography variant="body2">
              {m.emoji} {m.title} · {dateLabel({ date: m.due_on as string, approx: m.approx })}
              {m.done_on && m.done_on <= today ? ' ✅' : ''}
            </Typography>
          </li>
        ))}
      </Box>
      <Button variant="contained" disabled={saving} onClick={() => void add()}>
        Add {list.length} checkpoints
      </Button>
    </Card>
  );
}

/** Everything dated in one place: your plan ahead, and what you've done. */
export default function TimelinePage() {
  const goals = useGoals();
  const ctx = useGoalContext();
  const food = useFood();
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<Milestone | 'new' | null>(null);

  const items = useMemo(() => {
    if (!ctx || !goals.data) return [];
    return buildTimeline({
      today: ctx.today,
      fitness: ctx.fitness,
      milestones: goals.data.milestones,
      goals: goals.data.goals.map((g) => summariseGoal(g, ctx)),
      plans: food.error ? [] : food.data.plans,
      legacyAchievements: food.data.settings?.legacy_achievements ?? null,
    });
  }, [ctx, goals.data, food.data, food.error]);

  if (!ctx || !goals.data) return null;
  const shown = items.filter((i) => (filter === 'all' ? true : filter === 'plan' ? PLAN_KINDS.includes(i.kind) : !PLAN_KINDS.includes(i.kind)));
  const { ahead, behind } = splitTimeline(shown, ctx.today);
  const hasPhase = goals.data.milestones.some((m) => m.source === 'phase' && !m.archived_at);

  return (
    <Stack spacing={2} sx={{ maxWidth: 860 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Stack direction="row" spacing={0.75} sx={{ flexGrow: 1, flexWrap: 'wrap', rowGap: 0.75 }}>
          {(
            [
              ['all', 'All'],
              ['plan', 'Plan'],
              ['wins', 'Wins'],
            ] as const
          ).map(([k, label]) => (
            <Chip key={k} label={label} color={filter === k ? 'primary' : 'default'} variant={filter === k ? 'filled' : 'outlined'} onClick={() => setFilter(k)} />
          ))}
        </Stack>
        <Button startIcon={<AddRoundedIcon />} variant="contained" onClick={() => setEditing('new')}>
          Add
        </Button>
      </Stack>

      {!hasPhase && <PhaseSetup today={ctx.today} />}
      <Section title="⏭️ Coming up" items={ahead} onOpen={setEditing} />
      <Section title="📜 So far" items={behind} onOpen={setEditing} limit={25} />

      {editing && <MilestoneDialog milestone={editing} today={ctx.today} onClose={() => setEditing(null)} />}
    </Stack>
  );
}
