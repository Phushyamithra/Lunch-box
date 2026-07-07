import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { Box, ButtonBase, Chip, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { AnimatePresence, motion } from 'framer-motion';
import { memo } from 'react';
import { getCategoryMeta } from '../../constants';
import type { Meal } from '../../models';

interface MealCardProps {
  meal: Meal;
  selected: boolean;
  /** Already logged for this day — visible but not selectable again. */
  logged?: boolean;
  onClick: () => void;
}

/** Selectable meal row used in the logging dialog (full-width list item). */
export const MealCard = memo(function MealCard({ meal, selected, logged = false, onClick }: MealCardProps) {
  const theme = useTheme();
  const icon = meal.icon ?? getCategoryMeta(meal.category).emoji;

  return (
    <motion.div whileHover={logged ? undefined : { y: -1 }} whileTap={logged ? undefined : { scale: 0.98 }}>
      <ButtonBase
        onClick={logged ? undefined : onClick}
        disabled={logged}
        aria-pressed={selected}
        aria-label={`${meal.name}, ${meal.nutrition?.calories ?? 0} kilocalories${logged ? ', already logged today' : ''}`}
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
          opacity: logged ? 0.55 : 1,
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
        {logged && <Chip label="Logged ✓" size="small" sx={{ height: 20 }} />}
        <AnimatePresence>
          {selected && !logged && (
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
