import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import SettingsBrightnessRoundedIcon from '@mui/icons-material/SettingsBrightnessRounded';
import { IconButton, Tooltip } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppData } from '../../context/AppDataContext';
import type { ThemeMode } from '../../models';

const NEXT_MODE: Record<ThemeMode, ThemeMode> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const MODE_META: Record<ThemeMode, { label: string; icon: JSX.Element }> = {
  light: { label: 'Light theme', icon: <LightModeRoundedIcon fontSize="small" /> },
  dark: { label: 'Dark theme', icon: <DarkModeRoundedIcon fontSize="small" /> },
  system: { label: 'System theme', icon: <SettingsBrightnessRoundedIcon fontSize="small" /> },
};

/** Cycles light → dark → system with a playful icon spin. */
export function ThemeToggle() {
  const { themeMode, setThemeMode } = useAppData();
  const meta = MODE_META[themeMode];

  return (
    <Tooltip title={`${meta.label} — click to switch`}>
      <IconButton
        aria-label={`Current: ${meta.label}. Switch theme`}
        onClick={() => void setThemeMode(NEXT_MODE[themeMode])}
        size="small"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={themeMode}
            initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.18 }}
            style={{ display: 'inline-flex' }}
          >
            {meta.icon}
          </motion.span>
        </AnimatePresence>
      </IconButton>
    </Tooltip>
  );
}
