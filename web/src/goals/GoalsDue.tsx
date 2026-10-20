import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from '../layout/Snackbar';
import { goalsDue } from './digest';
import { useGoals } from './GoalsContext';
import { useGoalsOverview } from './hooks';

/** Goal check-ins and checkpoints that need you now; hidden when there are none. */
export function GoalsDue() {
  const overview = useGoalsOverview();
  const goals = useGoals();
  const toast = useSnackbar();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  if (!overview) return null;
  const items = goalsDue(overview.summaries, overview.timeline, overview.ctx.today);

  const act = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await fn();
      toast(done);
    } catch (e) {
      toast(`Not saved: ${e instanceof Error ? e.message : 'error'}`, { severity: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <AnimatePresence initial={false}>
      {items.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: '20px' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Goals
            </Typography>
            <Stack spacing={0.75} sx={{ mt: 0.75 }}>
              {items.map((i) => {
                const tick =
                  i.kind === 'checkin'
                    ? () => void act(i.key, () => goals.addCheckin(i.goalId as string, i.periodStart as string), `✅ ${i.title}`)
                    : i.kind === 'checkpoint'
                      ? () => void act(i.key, () => goals.updateMilestone(i.milestoneId as string, { done_on: overview.ctx.today }), `✅ ${i.title}`)
                      : () => navigate('/goals');
                return (
                  <Box
                    key={i.key}
                    component="button"
                    disabled={busy === i.key}
                    onClick={tick}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      width: '100%',
                      p: 1,
                      border: 0,
                      borderRadius: '14px',
                      textAlign: 'left',
                      font: 'inherit',
                      color: 'inherit',
                      cursor: 'pointer',
                      bgcolor: (t) => t.tracker.tonal,
                    }}
                  >
                    <Box aria-hidden sx={{ fontSize: 22 }}>
                      {i.emoji}
                    </Box>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700 }}>{i.title}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {i.detail}
                      </Typography>
                    </Box>
                    <Chip size="small" color={i.kind === 'behind' ? 'warning' : 'primary'} variant={i.kind === 'behind' ? 'outlined' : 'filled'} label={i.kind === 'behind' ? 'Behind' : 'Done'} />
                  </Box>
                );
              })}
            </Stack>
          </Paper>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
