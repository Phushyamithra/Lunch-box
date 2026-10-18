import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import type { LogCheck } from './plans';

interface LimitDialogProps {
  open: boolean;
  mealName: string;
  categoryName: string;
  result: Extract<LogCheck, { kind: 'blocked' }> | null;
  busy: boolean;
  onCancel: () => void;
  onOverride: (reason: string | null) => void;
}

/**
 * Shown instead of logging when a limit is reached. Cancelling is the
 * default; logging anyway is an explicit, recorded override.
 */
export function LimitDialog({ open, mealName, categoryName, result, busy, onCancel, onOverride }: LimitDialogProps) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (open) setReason('');
  }, [open]);
  if (!result) return null;

  const isCap = result.reason === 'item_cap';
  const message = isCap
    ? `${mealName} has reached its cap for this plan: ${result.usage.used} of ${result.usage.cap} used.`
    : `The ${categoryName} quota for this plan is used up: ${result.quota.used} of ${result.quota.quantity}.`;

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth aria-labelledby="limit-title">
      <DialogTitle id="limit-title">{isCap ? 'Cap reached' : 'Quota used up'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Alert severity="warning">{message}</Alert>
          <Typography color="text.secondary">
            Logging it anyway records an override. It shows in your history as over the limit.
          </Typography>
          <TextField
            label="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            inputProps={{ maxLength: 200 }}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" color="error" disabled={busy} onClick={() => onOverride(reason || null)}>
          Log anyway
        </Button>
        <Button variant="contained" autoFocus disabled={busy} onClick={onCancel}>
          Don't log
        </Button>
      </DialogActions>
    </Dialog>
  );
}
