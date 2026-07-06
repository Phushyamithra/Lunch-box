import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { Fab, Tooltip } from '@mui/material';
import { motion } from 'framer-motion';

interface FABProps {
  onClick: () => void;
}

/** Floating action button — quick-log today's meal. */
export function FAB({ onClick }: FABProps) {
  return (
    <motion.div
      initial={{ scale: 0, rotate: -45 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.2 }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 10 }}
    >
      <Tooltip title="Log today's meal" placement="left">
        <Fab color="primary" aria-label="Log today's meal" onClick={onClick}>
          <AddRoundedIcon />
        </Fab>
      </Tooltip>
    </motion.div>
  );
}
