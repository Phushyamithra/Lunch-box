import { Box, Paper, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { memo } from 'react';

interface StatTileProps {
  emoji: string;
  label: string;
  value: number;
  unit: string;
  index?: number;
}

/** Small nutrition stat card used in the analytics summary grid. */
export const StatTile = memo(function StatTile({ emoji, label, value, unit, index = 0 }: StatTileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
    >
      <Paper variant="outlined" sx={{ p: 1.25, textAlign: 'center' }}>
        <Typography aria-hidden sx={{ fontSize: 18, lineHeight: 1 }}>
          {emoji}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 0.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            {Math.round(value * 10) / 10}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {unit}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Paper>
    </motion.div>
  );
});
