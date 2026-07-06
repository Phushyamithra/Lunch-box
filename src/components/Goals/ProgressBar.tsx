import { Box, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';

interface ProgressBarProps {
  /** 0–100 */
  percent: number;
  color: string;
  height?: number;
}

/** Slim animated linear progress bar with a spring-driven fill. */
export function ProgressBar({ percent, color, height = 8 }: ProgressBarProps) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <Box
      sx={{
        height,
        borderRadius: 999,
        bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.22 : 0.15),
        overflow: 'hidden',
      }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ type: 'spring', stiffness: 60, damping: 18 }}
        style={{ height: '100%', borderRadius: 999, background: color }}
      />
    </Box>
  );
}
