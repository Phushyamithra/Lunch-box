import { Box, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';

interface ProgressRingProps {
  /** 0–100 */
  percent: number;
  size?: number;
  strokeWidth?: number;
  complete?: boolean;
  /** Center label; defaults to "NN%". */
  label?: string;
}

/** Animated circular progress indicator (SVG stroke-dash based). */
export function ProgressRing({
  percent,
  size = 68,
  strokeWidth = 7,
  complete = false,
  label,
}: ProgressRingProps) {
  const theme = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const color = complete ? theme.palette.success.main : theme.palette.primary.main;

  return (
    <Box
      sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={alpha(color, 0.18)}
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - clamped / 100) }}
          transition={{ type: 'spring', stiffness: 60, damping: 18 }}
        />
      </svg>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 800, color }}>
          {label ?? (complete ? '🎉' : `${clamped}%`)}
        </Typography>
      </Box>
    </Box>
  );
}
