import { Box, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { Dayjs } from 'dayjs';
import { motion } from 'framer-motion';
import { memo } from 'react';
import { WEEKDAY_LABELS, getCategoryMeta } from '../../constants';
import type { Meal, MealLog } from '../../models';
import { calendarDays, toDateKey, todayKey } from '../../utils/date';

interface CalendarProps {
  month: Dayjs;
  logs: Record<string, MealLog>;
  mealById: Map<string, Meal>;
  /** Date to briefly pulse (set when jumping from the summary list). */
  highlightDate: string | null;
  onDayClick: (dateKey: string) => void;
}

/**
 * Monthly grid. Logged days get a tonal category-colored fill plus the
 * meal's own icon; today is outlined in the primary color.
 */
export const Calendar = memo(function Calendar({
  month,
  logs,
  mealById,
  highlightDate,
  onDayClick,
}: CalendarProps) {
  const theme = useTheme();
  const days = calendarDays(month);
  const today = todayKey();

  return (
    <Box role="grid" aria-label={`Calendar for ${month.format('MMMM YYYY')}`}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 0.5,
          mb: 0.5,
        }}
      >
        {WEEKDAY_LABELS.map((label, i) => (
          <Typography
            key={`${label}-${i}`}
            variant="caption"
            align="center"
            sx={{ fontWeight: 700, color: 'text.secondary' }}
          >
            {label}
          </Typography>
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
        {days.map((day) => {
          const key = toDateKey(day);
          const inMonth = day.month() === month.month();
          const isToday = key === today;
          const log = logs[key];
          const meal = log ? mealById.get(log.mealId) : undefined;
          const meta = meal ? getCategoryMeta(meal.category) : null;
          const accent = meta?.color ?? theme.palette.primary.main;
          const isHighlighted = highlightDate === key;

          return (
            <motion.button
              key={key}
              type="button"
              role="gridcell"
              aria-label={
                `${day.format('MMMM D, YYYY')}` +
                (meal ? `, logged: ${meal.name}` : log ? ', meal logged' : '')
              }
              onClick={() => onDayClick(key)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              animate={isHighlighted ? { scale: [1, 1.2, 1] } : { scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              style={{
                aspectRatio: '1 / 1',
                border: isToday
                  ? `2px solid ${theme.palette.primary.main}`
                  : '2px solid transparent',
                borderRadius: 12,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                padding: 0,
                background: log
                  ? alpha(accent, theme.palette.mode === 'dark' ? 0.28 : 0.18)
                  : 'transparent',
                opacity: inMonth ? 1 : 0.35,
                fontFamily: 'inherit',
              }}
            >
              <Typography
                variant="body2"
                component="span"
                sx={{
                  fontWeight: isToday ? 800 : 500,
                  lineHeight: 1,
                  color: isToday ? 'primary.main' : 'text.primary',
                }}
              >
                {day.date()}
              </Typography>
              {log && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                  style={{ fontSize: 12, lineHeight: 1 }}
                  aria-hidden
                >
                  {meal ? (meal.icon ?? meta?.emoji) : '✅'}
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </Box>
    </Box>
  );
});
