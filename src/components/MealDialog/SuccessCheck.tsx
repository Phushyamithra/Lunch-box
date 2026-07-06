import { Box, Typography, useTheme } from '@mui/material';
import { motion } from 'framer-motion';

/** Springy circle + drawn checkmark shown after a successful save. */
export function SuccessCheck({ message = 'Saved!' }: { message?: string }) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        py: 5,
      }}
      role="status"
      aria-live="polite"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 14 }}
      >
        <svg width="88" height="88" viewBox="0 0 52 52" aria-hidden>
          <circle cx="26" cy="26" r="25" fill={theme.palette.success.main} />
          <motion.path
            d="M14.5 27l8 8 15.5-16"
            fill="none"
            stroke="#fff"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.15, duration: 0.35, ease: 'easeOut' }}
          />
        </svg>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Typography variant="h6">{message}</Typography>
      </motion.div>
    </Box>
  );
}
