import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import { Box, IconButton, InputBase } from '@mui/material';
import { useEffect, useState } from 'react';

interface NumberStepperProps {
  label: string;
  unit: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  decimals?: number;
  onChange: (value: number) => void;
}

/**
 * Compact − value + control: tap ± to nudge, or tap the number to type.
 * Built for one-handed use between sets.
 */
export function NumberStepper({ label, unit, value, step, min = 0, max = 999, decimals = 0, onChange }: NumberStepperProps) {
  const [text, setText] = useState(value.toFixed(decimals));
  // Follow outside changes (± buttons, pre-fills) unless the typed text already means this value.
  useEffect(() => {
    setText((t) => (Number(t.replace(',', '.')) === value ? t : value.toFixed(decimals).replace(/\.0+$/, '')));
  }, [value, decimals]);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const commit = () => {
    const v = Number(text.replace(',', '.'));
    if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
    else setText(value.toFixed(decimals));
  };
  return (
    <Box
      role="group"
      aria-label={label}
      sx={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, bgcolor: 'action.hover', p: 0.25 }}
    >
      <IconButton size="small" aria-label={`Less ${label}`} disabled={value <= min} onClick={() => onChange(clamp(value - step))}>
        <RemoveRoundedIcon fontSize="small" />
      </IconButton>
      <InputBase
        value={text}
        onChange={(e) => {
          // Apply valid numbers as they are typed, so tapping Save/✓ while
          // the field still has focus uses what is on screen.
          setText(e.target.value);
          const v = Number(e.target.value.replace(',', '.'));
          if (e.target.value.trim() !== '' && Number.isFinite(v) && v >= min && v <= max) onChange(v);
        }}
        onBlur={commit}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        inputProps={{ inputMode: 'decimal', 'aria-label': label, style: { textAlign: 'center', padding: 0, fontWeight: 700 } }}
        sx={{ width: `${Math.max(3, text.length + 1)}ch`, fontSize: 16 }}
      />
      <Box component="span" sx={{ fontSize: 12, color: 'text.secondary', mr: 0.5 }}>
        {unit}
      </Box>
      <IconButton size="small" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(clamp(value + step))}>
        <AddRoundedIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
