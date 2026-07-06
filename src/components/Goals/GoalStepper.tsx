import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import { Box, IconButton, Typography } from '@mui/material';
import { GOAL_MAX_TARGET } from '../../constants';

interface GoalStepperProps {
  label: string;
  emoji: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

/** Compact +/- stepper row used in the Settings → Goals section. */
export function GoalStepper({
  label,
  emoji,
  value,
  min = 0,
  max = GOAL_MAX_TARGET,
  onChange,
}: GoalStepperProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <span aria-hidden style={{ fontSize: 16 }}>
        {emoji}
      </span>
      <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: 600 }}>
        {label}
      </Typography>
      <IconButton
        size="small"
        aria-label={`Decrease ${label}`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <RemoveRoundedIcon fontSize="small" />
      </IconButton>
      <Typography
        variant="body2"
        sx={{ width: 36, textAlign: 'center', fontWeight: 800 }}
        aria-live="polite"
      >
        {value}
      </Typography>
      <IconButton
        size="small"
        aria-label={`Increase ${label}`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <AddRoundedIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
