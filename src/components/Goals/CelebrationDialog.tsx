import { Box, Button, Dialog, DialogContent, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { getCategoryMeta } from '../../constants';
import { useAppData } from '../../context/AppDataContext';
import type { AchievementId } from '../../models';
import { Confetti } from './Confetti';

interface CelebrationContent {
  emoji: string;
  title: string;
  body: React.ReactNode;
}

/**
 * Shows one pending achievement at a time (FIFO) with confetti.
 * The queue lives in AppDataContext; each achievement fires only once
 * because GoalService records awards permanently.
 */
export function CelebrationDialog() {
  const { pendingCelebrations, dismissCelebration, goalProgress, goalSettings } = useAppData();
  const current: AchievementId | undefined = pendingCelebrations[0];

  if (!current) return null;

  const content = buildContent(current);

  return (
    <Dialog open fullWidth maxWidth="xs" aria-labelledby="celebration-title">
      <Confetti />
      <DialogContent sx={{ textAlign: 'center', py: 4, position: 'relative' }}>
        <motion.div
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 12 }}
          aria-hidden
          style={{ fontSize: 64, lineHeight: 1 }}
        >
          {content.emoji}
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Typography id="celebration-title" variant="h6" sx={{ mt: 1.5 }}>
            {content.title}
          </Typography>
          <Box sx={{ mt: 1, color: 'text.secondary' }}>{content.body}</Box>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>
          <Button variant="contained" size="large" sx={{ mt: 3 }} onClick={dismissCelebration} autoFocus>
            Keep it up!
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );

  function buildContent(id: AchievementId): CelebrationContent {
    if (id === 'days_goal') {
      return {
        emoji: '🎉',
        title: 'Congratulations!',
        body: (
          <Typography variant="body2">
            You've completed your {goalSettings.totalDays}-day meal logging goal!
          </Typography>
        ),
      };
    }

    if (id === 'balance' || id === 'nutrition_champion') {
      const completed = goalProgress.categories.filter((c) => c.enabled);
      const champion = id === 'nutrition_champion';
      return {
        emoji: '🏆',
        title: champion ? 'Nutrition Champion!' : 'Meal Balance Goal Completed!',
        body: (
          <Box>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              You achieved your target of:
            </Typography>
            {champion && (
              <Typography variant="body2">✅ {goalSettings.totalDays} logged days</Typography>
            )}
            {completed.map((c) => (
              <Typography key={c.category} variant="body2">
                ✅ {c.target} {getCategoryMeta(c.category).plural}
              </Typography>
            ))}
            <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 700 }}>
              Amazing consistency!
            </Typography>
          </Box>
        ),
      };
    }

    // category_<name>
    const category = id.slice('category_'.length);
    const meta = getCategoryMeta(category);
    const target = goalSettings.categoryTargets[category] ?? 0;
    return {
      emoji: meta.emoji,
      title: `${category} goal complete!`,
      body: (
        <Typography variant="body2">
          You logged {target} {meta.plural.toLowerCase()} — way to go!
        </Typography>
      ),
    };
  }
}
