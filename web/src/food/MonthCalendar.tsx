import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { Box, IconButton, Paper, Typography, useTheme } from '@mui/material';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import type { LogsByDate } from '../../../src/core/logs';
import { CTA_GRADIENT, PALETTE } from '../theme';
import { MONTH_KEY, monthGrid, todayKey } from './foodModel';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_DOTS = 4;

interface MonthCalendarProps {
  month: string; // YYYY-MM
  selected: string; // YYYY-MM-DD
  logsByDate: LogsByDate;
  /** Category colour for each meal id, for the per-day dots. */
  colorForMeal: (mealId: string) => string;
  onMonthChange: (month: string) => void;
  onSelect: (date: string) => void;
}

/**
 * Month-at-a-glance: each day shows its meal count as coloured dots (one
 * per meal, by category). Tap a day to see and edit it below.
 */
export function MonthCalendar({ month, selected, logsByDate, colorForMeal, onMonthChange, onSelect }: MonthCalendarProps) {
  const theme = useTheme();
  const today = todayKey();
  const weeks = useMemo(() => monthGrid(month), [month]);
  const current = dayjs(`${month}-01`);
  const isCurrentMonth = month === dayjs(today).format(MONTH_KEY);

  const monthDays = weeks.flat().filter((d): d is string => Boolean(d));
  const loggedDays = monthDays.filter((d) => (logsByDate[d]?.length ?? 0) > 0).length;
  const mealCount = monthDays.reduce((sum, d) => sum + (logsByDate[d]?.length ?? 0), 0);

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <IconButton aria-label="Previous month" onClick={() => onMonthChange(current.subtract(1, 'month').format(MONTH_KEY))}>
          <ChevronLeftRoundedIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1, textAlign: 'center' }}>
          <Typography variant="h6" component="h2">
            {current.format('MMMM YYYY')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {loggedDays} day{loggedDays === 1 ? '' : 's'} logged · {mealCount} meal{mealCount === 1 ? '' : 's'}
          </Typography>
        </Box>
        <IconButton
          aria-label="Next month"
          disabled={isCurrentMonth}
          onClick={() => onMonthChange(current.add(1, 'month').format(MONTH_KEY))}
        >
          <ChevronRightRoundedIcon />
        </IconButton>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: { xs: 0.5, sm: 0.75 } }}>
        {WEEKDAYS.map((d) => (
          <Typography key={d} variant="caption" color="text.secondary" align="center" sx={{ fontWeight: 600, pb: 0.5 }}>
            {d.slice(0, 1)}
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              {d.slice(1)}
            </Box>
          </Typography>
        ))}
        {weeks.flat().map((key, index) => {
          if (!key) return <Box key={`pad-${index}`} />;
          const logs = logsByDate[key] ?? [];
          const isSelected = key === selected;
          const isToday = key === today;
          const future = key > today;
          return (
            <Box
              key={key}
              component="button"
              disabled={future}
              onClick={() => onSelect(key)}
              aria-pressed={isSelected}
              aria-label={`${dayjs(key).format('dddd D MMMM')}${isToday ? ', today' : ''}: ${logs.length} meal${logs.length === 1 ? '' : 's'}`}
              sx={{
                aspectRatio: '1 / 1',
                minHeight: 44,
                border: 0,
                borderRadius: '14px',
                font: 'inherit',
                cursor: future ? 'default' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.5,
                color: isSelected ? PALETTE.ink : 'text.primary',
                background: isSelected ? CTA_GRADIENT : logs.length > 0 ? theme.tracker.tonal : 'transparent',
                boxShadow: isToday && !isSelected ? `inset 0 0 0 2px ${theme.palette.secondary.main}` : 'none',
                opacity: future ? 0.35 : 1,
                transition: 'transform 120ms ease',
                '&:not(:disabled):active': { transform: 'scale(0.94)' },
                '&:focus-visible': { outline: `2px solid ${theme.palette.text.primary}`, outlineOffset: 2 },
              }}
            >
              <Typography
                component="span"
                sx={{
                  fontWeight: isToday || isSelected ? 700 : 500,
                  fontSize: { xs: 14, sm: 15 },
                  lineHeight: 1,
                  color: !isSelected && logs.length > 0 ? theme.tracker.onTonal : 'inherit',
                }}
              >
                {dayjs(key).date()}
              </Typography>
              <Box aria-hidden sx={{ display: 'flex', gap: '3px', height: 6 }}>
                {logs.slice(0, MAX_DOTS).map((log) => (
                  <Box
                    key={log.id}
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: colorForMeal(log.mealId),
                      boxShadow: `0 0 0 1px ${isSelected ? 'rgba(31,58,65,0.35)' : 'rgba(255,255,255,0.5)'}`,
                    }}
                  />
                ))}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}
