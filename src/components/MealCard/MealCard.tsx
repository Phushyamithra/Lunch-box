import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { ButtonBase, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { AnimatePresence, motion } from 'framer-motion';
import { memo } from 'react';
import { CATEGORY_META } from '../../constants';
import type { Meal } from '../../models';

interface MealCardProps {
  meal: Meal;
  selected: boolean;
  onClick: () => void;
}

/** Selectable meal chip-card used in the logging dialog. */
export const MealCard = memo(function MealCard({ meal, selected, onClick }: MealCardProps) {
  const theme = useTheme();
  const meta = CATEGORY_META[meal.category];

  return (
    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}>
      <ButtonBase
        onClick={onClick}
        aria-pressed={selected}
        sx={{
          width: '100%',
          justifyContent: 'flex-start',
          gap: 1,
          px: 1.5,
          py: 1.25,
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
          {meta.emoji}
        </span>
        <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1 }} noWrap>
          {meal.name}
        </Typography>
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
