import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { Box, ButtonBase, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { AnimatePresence, motion } from 'framer-motion';
import { memo } from 'react';
import { getCategoryMeta } from '../../constants';
import type { Meal } from '../../models';

interface MealCardProps {
  meal: Meal;
  selected: boolean;
  onClick: () => void;
}

/** Selectable meal chip-card used in the logging dialog. */
export const MealCard = memo(function MealCard({ meal, selected, onClick }: MealCardProps) {
  const theme = useTheme();
  const icon = meal.icon ?? getCategoryMeta(meal.category).emoji;

  return (
    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}>
      <ButtonBase
        onClick={onClick}
        aria-pressed={selected}
        aria-label={`${meal.name}, ${meal.nutrition?.calories ?? 0} kilocalories`}
        sx={{
          width: '100%',
          justifyContent: 'flex-start',
          gap: 1,
          px: 1.5,
          py: 1,
          borderRadius: 3.5,
          border: '2px solid',
          borderColor: selected ? 'primary.main' : 'divider',
          bgcolor: selected
            ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.24 : 0.1)
            : 'background.paper',
          transition: 'border-color 0.15s, background-color 0.15s',
          textAlign: 'left',
        }}
      >
        <span aria-hidden style={{ fontSize: 20 }}>
          {icon}
        </span>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {meal.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {meal.nutrition?.calories ?? 0} kcal
          </Typography>
        </Box>
        <AnimatePresence>
          {selected && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              style={{ display: 'inline-flex' }}
            >
              <CheckCircleRoundedIcon color="primary" fontSize="small" />
            </motion.span>
          )}
        </AnimatePresence>
      </ButtonBase>
    </motion.div>
  );
});
