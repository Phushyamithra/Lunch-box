import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import RestaurantMenuRoundedIcon from '@mui/icons-material/RestaurantMenuRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import type { Dayjs } from 'dayjs';
import { AnimatePresence, motion } from 'framer-motion';
import { APP_NAME } from '../../constants';
import { useNavigation } from '../../context/NavigationContext';
import { ThemeToggle } from '../ThemeToggle/ThemeToggle';

interface HeaderProps {
  month: Dayjs;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onGoToday: () => void;
}

export function Header({ month, onPrevMonth, onNextMonth, onGoToday }: HeaderProps) {
  const { navigate } = useNavigation();

  return (
    <Box component="header" sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
      {/* Row 1: brand + quick actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography
          variant="h6"
          component="h1"
          sx={{
            flexGrow: 1,
            background: 'linear-gradient(90deg, #6750A4, #E91E8C)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          🥪 {APP_NAME}
        </Typography>
        <ThemeToggle />
        <Tooltip title="Manage meals">
          <IconButton aria-label="Manage meals" size="small" onClick={() => navigate('meals')}>
            <RestaurantMenuRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Settings">
          <IconButton aria-label="Settings" size="small" onClick={() => navigate('settings')}>
            <SettingsRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Row 2: month navigation */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 0.5 }}>
        <IconButton aria-label="Previous month" size="small" onClick={onPrevMonth}>
          <ChevronLeftRoundedIcon />
        </IconButton>
        <Box sx={{ minWidth: 140, textAlign: 'center', overflow: 'hidden' }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={month.format('YYYY-MM')}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <Typography
                variant="subtitle1"
                component="button"
                onClick={onGoToday}
                aria-label={`${month.format('MMMM YYYY')} — click to jump to today`}
                sx={{
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                  background: 'none',
                  color: 'text.primary',
                  fontFamily: 'inherit',
                  fontSize: '1rem',
                }}
              >
                {month.format('MMMM YYYY')}
              </Typography>
            </motion.div>
          </AnimatePresence>
        </Box>
        <IconButton aria-label="Next month" size="small" onClick={onNextMonth}>
          <ChevronRightRoundedIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
