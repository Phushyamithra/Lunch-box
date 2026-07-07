import { Box, Paper, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { memo } from 'react';
import { NUTRIENT_META, getCategoryMeta } from '../../constants';
import type { Meal } from '../../models';

interface NutritionCardProps {
  meal: Meal;
  /** Hide the meal-name header (when shown right under a selected card). */
  hideHeader?: boolean;
}

/** Material card listing a meal's five tracked nutrients. */
export const NutritionCard = memo(function NutritionCard({ meal, hideHeader = false }: NutritionCardProps) {
  const icon = meal.icon ?? getCategoryMeta(meal.category).emoji;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        {!hideHeader && (
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            <span aria-hidden>{icon}</span> {meal.name}
          </Typography>
        )}
        <Box
          role="list"
          aria-label={`Nutrition for ${meal.name}`}
          sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0.5 }}
        >
          {NUTRIENT_META.map(({ key, label, unit, emoji }) => (
            <Box key={key} role="listitem" sx={{ textAlign: 'center' }}>
              <Typography aria-hidden sx={{ fontSize: 14, lineHeight: 1 }}>
                {emoji}
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 800, display: 'block', lineHeight: 1.4 }}>
                {meal.nutrition?.[key] ?? 0}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9, display: 'block', lineHeight: 1 }}>
                {label} ({unit})
              </Typography>
            </Box>
          ))}
        </Box>
      </Paper>
    </motion.div>
  );
});
