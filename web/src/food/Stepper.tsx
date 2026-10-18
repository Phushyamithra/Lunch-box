import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import { Box, IconButton, Typography } from '@mui/material';

interface StepperProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}

/** Compact −/+ number control with large tap targets. */
export function Stepper({ label, value, min = 0, max = 999, disabled, onChange }: StepperProps) {
  return (
    <Box role="group" aria-label={label} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      <IconButton
        aria-label={`Decrease ${label}`}
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
        sx={{ bgcolor: 'action.hover' }}
      >
        <RemoveRoundedIcon fontSize="small" />
      </IconButton>
      <Typography aria-live="polite" sx={{ minWidth: 32, textAlign: 'center', fontWeight: 700 }}>
        {value}
      </Typography>
      <IconButton
        aria-label={`Increase ${label}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
        sx={{ bgcolor: 'action.hover' }}
      >
        <AddRoundedIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
