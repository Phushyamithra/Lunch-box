import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import { Box, Chip, Divider, Paper, Typography } from '@mui/material';
import { memo } from 'react';
import { CATEGORY_META } from '../../constants';
import { useAppData } from '../../context/AppDataContext';
import { goalService } from '../../services/GoalService';
import { ProgressBar } from './ProgressBar';
import { ProgressRing } from './ProgressRing';

/**
 * "Goals & Progress" dashboard card: circular 30-day progress, per-category
 * animated bars, remaining counts, badges and a dynamic motivational nudge.
 * All numbers are derived by GoalService — this component only renders.
 */
export const GoalsCard = memo(function GoalsCard() {
  const { goalProgress, achievements } = useAppData();
  const { days, categories, balanceComplete } = goalProgress;
  const enabledCategories = categories.filter((c) => c.enabled);
  const message = goalService.motivationalMessage(goalProgress);

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ flexGrow: 1, color: 'text.secondary' }}>
          Goals & Progress
        </Typography>
        {balanceComplete && (
          <Chip
            icon={<EmojiEventsRoundedIcon />}
            label="Meal Balance"
            size="small"
            color="success"
            variant="outlined"
            aria-label="Meal Balance goal completed"
          />
        )}
      </Box>

      {/* Overall days goal */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <ProgressRing percent={days.percent} complete={days.complete} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            {days.target}-Day Goal{' '}
            {achievements.days_goal && (
              <span role="img" aria-label="completed">
                🏅
              </span>
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {days.count} / {days.target} days logged · {days.percent}%
          </Typography>
          <Typography variant="caption" color={days.complete ? 'success.main' : 'text.secondary'}>
            {days.complete
              ? 'Goal complete — incredible! 🎉'
              : `${days.remaining} day${days.remaining === 1 ? '' : 's'} remaining`}
          </Typography>
        </Box>
      </Box>

      {/* Category goals */}
      {enabledCategories.length > 0 && <Divider sx={{ my: 1.5 }} />}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {enabledCategories.map((cat) => {
          const meta = CATEGORY_META[cat.category];
          return (
            <Box key={cat.category}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                <span aria-hidden style={{ fontSize: 15 }}>
                  {meta.emoji}
                </span>
                <Typography variant="body2" sx={{ fontWeight: 700, flexGrow: 1 }}>
                  {cat.category}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {cat.count} / {cat.target}
                </Typography>
                {cat.complete ? (
                  <Chip label="Done ✅" size="small" color="success" sx={{ height: 20 }} />
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    · {cat.remaining} to go
                  </Typography>
                )}
              </Box>
              <ProgressBar percent={cat.percent} color={meta.color} />
            </Box>
          );
        })}
        {enabledCategories.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            Set category goals in Settings to track them here.
          </Typography>
        )}
      </Box>

      {/* Motivational nudge */}
      <Typography
        variant="caption"
        sx={{ display: 'block', mt: 1.5, color: 'primary.main', fontWeight: 600 }}
        aria-live="polite"
      >
        ✨ {message}
      </Typography>
    </Paper>
  );
});
